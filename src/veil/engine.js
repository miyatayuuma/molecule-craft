import { VEIL, EXPEDITION, THERMAL } from './config.js';
import { GROWTH, DRIVES, burstDriveFor, regionAt } from './growth.js';
import { combustionPacketFor,performanceFor } from './molecule-roles.js';
import { environmentAt, animateUniverse } from './universe.js';
import { createExpeditionTelemetry, recordExpeditionFrame, recordFuelUse } from './telemetry.js';

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function createFlight(config=VEIL){
  return {...config.spawn,speed:config.driftSpeed,vx:0,vy:0,boost:0,cooldown:0,combustion:false,drive:null,bank:0,trail:[]};
}

function activePropulsion(p){return p.boost>0?p.drive:p.combustion?DRIVES.combustion:null;}

// CHAIN intentionally does not enter movement or suction calculations. It is
// retained as audiovisual phrasing only.
export function moveFlight(p,input,dt,{config:c=VEIL,assist=null,force={x:0,y:0},environment=null}={}){
  dt=clamp(dt,0,c.maxFrame);const magnitude=Math.min(1,Math.hypot(input.x,input.y)),steering=magnitude>.09,propulsion=activePropulsion(p),propelled=!!propulsion;
  let delta=0;
  if(steering){
    let desired=Math.atan2(input.y,input.x);
    if(assist&&Math.abs(angleDelta(desired,assist.angle))<.8)desired+=angleDelta(desired,assist.angle)*c.assistStrength;
    delta=angleDelta(p.angle,desired);
    const rate=(propelled?c.boostTurnRate:c.turnRate)*(Math.abs(delta)>1.8?c.reverseAssist:1);
    const turn=clamp(delta*c.turnResponse,-rate,rate);p.angle+=turn*dt;
    p.bank+=(clamp(turn/rate,-1,1)-p.bank)*(1-Math.exp(-dt*8));
  }else p.bank*=Math.exp(-dt*5);
  const corner=1-(1-c.cornerSpeed)*Math.min(Math.abs(delta)/Math.PI,1);
  const target=propelled?propulsion.boostSpeed*corner:steering?c.speed*magnitude*corner:c.driftSpeed;
  const acceleration=propelled?(propulsion.boostAcceleration??c.boostAcceleration):steering?c.acceleration:c.releaseDrag;
  p.speed+=(target-p.speed)*(1-Math.exp(-dt*acceleration));
  const grip=1-Math.exp(-dt*(propelled?(propulsion.boostGrip??c.boostGrip):c.velocityGrip));
  p.vx=(p.vx??Math.cos(p.angle)*p.speed)+(Math.cos(p.angle)*p.speed-(p.vx??Math.cos(p.angle)*p.speed))*grip;
  p.vy=(p.vy??Math.sin(p.angle)*p.speed)+(Math.sin(p.angle)*p.speed-(p.vy??Math.sin(p.angle)*p.speed))*grip;
  // A current may bend a route, but cannot pin the ship or reverse its thrust.
  let fx=force.x,fy=force.y;const dot=fx*Math.cos(p.angle)+fy*Math.sin(p.angle),limit=-p.speed*c.maxOpposingFlow;
  if(dot<limit){fx+=(limit-dot)*Math.cos(p.angle);fy+=(limit-dot)*Math.sin(p.angle);}
  const resistance=propelled?c.boostFieldResistance:Math.min(1,p.speed/c.speed);
  p.x=clamp(p.x+(p.vx+fx*resistance+(environment?.flowX??0))*dt,c.bounds.left,c.bounds.right);
  p.y=clamp(p.y+(p.vy+fy*resistance+(environment?.pressure??0))*dt,c.bounds.top,c.bounds.bottom);
  p.boost=Math.max(0,p.boost-dt);p.cooldown=Math.max(0,p.cooldown-dt);
}

export function beginBurst(run,consume){
  const p=run?.player,slot=run?.fuel?.propellant,performance=performanceFor(slot?.molecule,'propellant'),drive=burstDriveFor(slot?.molecule);
  if(!p||!performance||!drive||run.captured||p.boost>0||p.cooldown>0||slot.amount<performance.moleculesPerBurst)return false;
  if(!consume(performance.moleculesPerBurst,slot.molecule))return false;
  slot.amount-=performance.moleculesPerBurst;run.telemetry.burstUses++;recordFuelUse(run.telemetry,'propellant',slot.molecule,performance.moleculesPerBurst);p.drive=drive;p.boost=drive.boostSeconds;p.cooldown=drive.boostSeconds+drive.boostCooldown;return true;
}

export function setCombustionHeld(run,held){if(!run||run.captured)return false;run.driveHeld=!!held;if(!held)run.player.combustion=false;return run.driveHeld;}

export function createRun(map,config=VEIL,{fuel={},predators=true}={}){
  const entry=(use,legacy)=>fuel[use]?.molecule!==undefined?{molecule:fuel[use].molecule,amount:fuel[use].amount??0}:{molecule:legacy,amount:fuel[legacy]??0};
  const loadout={propellant:entry('propellant','hydrogen'),fuel:entry('fuel','methane'),oxidizer:entry('oxidizer','oxygen'),coolant:entry('coolant',null)};
  return {map,player:createFlight(config),time:0,chain:0,best:0,chainTime:0,collected:0,dustUnits:0,elementDust:{H:0,C:0,O:0},collectedElements:{H:0,C:0,O:0},foundElements:[],heat:0,ambientHeat:0,coolantBuffer:0,coolantActive:false,coolantEpisode:false,coolantEmpty:false,overheated:false,region:'veil',effects:[],events:[],denseUntil:0,gatePassed:false,departed:false,lap:false,laps:0,lastLap:0,config,fuel:loadout,driveHeld:false,driveBuffer:0,predators,threat:0,eaters:[],nearestEater:Infinity,danger:'clear',nextEaterSpawn:0,captured:false,captureAt:0,telemetry:createExpeditionTelemetry(loadout)};
}

function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}

function updateCombustion(run,dt,systems){
  const p=run.player;
  if(!run.driveHeld||p.boost>0||run.captured||run.overheated){p.combustion=false;return;}
  const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});
  if(run.driveBuffer<=1e-8){
    if(!packet||oxidizer.molecule!==packet.oxidizer||fuel.amount<packet.fuelAmount||oxidizer.amount<packet.oxygenAmount||!systems.consumeCombustion?.(packet)){p.combustion=false;if(!run.driveEmpty){run.driveEmpty=true;run.events.push({type:'driveEmpty'});}return;}
    fuel.amount-=packet.fuelAmount;oxidizer.amount-=packet.oxygenAmount;recordFuelUse(run.telemetry,'fuel',fuel.molecule,packet.fuelAmount);recordFuelUse(run.telemetry,'oxidizer',oxidizer.molecule,packet.oxygenAmount);run.driveBuffer=packet.seconds;run.driveEmpty=false;run.events.push({type:'driveIgnition'});
  }
  p.drive=DRIVES.combustion;p.combustion=true;run.driveBuffer=Math.max(0,run.driveBuffer-dt);
  if(run.driveBuffer<=0&&(!packet||fuel.amount<packet.fuelAmount||oxidizer.amount<packet.oxygenAmount))p.combustion=false;
}

function updateThermal(run,dt,systems){
  const p=run.player,fuelPerformance=performanceFor(run.fuel.fuel.molecule,'fuel');
  run.heat+=p.combustion?THERMAL.heatPerSecond*(fuelPerformance?.heatFactor??1)*dt:-THERMAL.naturalCoolingPerSecond*dt;
  run.heat=clamp(run.heat,0,THERMAL.overheatThreshold);
  const coolant=run.fuel.coolant,coolantPerformance=performanceFor(coolant?.molecule,'coolant');
  const thermostat=run.heat>=THERMAL.coolantStart&&(p.combustion||run.overheated);
  if(thermostat&&run.coolantBuffer<=1e-8&&coolantPerformance&&coolant.amount>=1){
    if(systems.consumeCoolant?.(1,coolant.molecule)){
      coolant.amount--;run.coolantBuffer=THERMAL.coolantSecondsPerMolecule;recordFuelUse(run.telemetry,'coolant',coolant.molecule,1);run.coolantEmpty=false;
      if(!run.coolantEpisode){run.coolantEpisode=true;run.events.push({type:'coolantStart',molecule:coolant.molecule});}
    }
  }
  const coolingSeconds=Math.min(dt,run.coolantBuffer);run.coolantActive=coolingSeconds>1e-8;
  if(run.coolantActive){run.coolantBuffer=Math.max(0,run.coolantBuffer-coolingSeconds);run.heat=Math.max(0,run.heat-THERMAL.coolantCoolingPerSecond*coolantPerformance.coolingPower*coolingSeconds);}
  if(run.heat<THERMAL.coolantStart&&run.coolantBuffer<=1e-8)run.coolantEpisode=false;
  if(thermostat&&coolantPerformance&&coolant.amount<1&&run.coolantBuffer<=1e-8&&!run.coolantEmpty){run.coolantEmpty=true;run.events.push({type:'coolantEmpty',molecule:coolant.molecule});}
  if(!run.overheated&&run.heat>=THERMAL.overheatThreshold){run.overheated=true;p.combustion=false;run.telemetry.overheatEvents++;run.events.push({type:'overheat'});}
  else if(run.overheated&&run.heat<=THERMAL.recoveryThreshold){run.overheated=false;run.events.push({type:'heatRecovered'});}
}

function spawnEater(run){
  const p=run.player,index=run.eaters.length,slots=[{angle:Math.PI,flank:0,lead:-2.4},{angle:-2.3,flank:-1,lead:.2},{angle:2.3,flank:1,lead:.2},{angle:-1.35,flank:-.7,lead:1},{angle:1.35,flank:.7,lead:1}],slot=slots[index%slots.length],angle=p.angle+slot.angle,distance=EXPEDITION.eaterSpawnDistance+(index%2)*65;
  // Let a new vortex approach from just outside the traversable field. Clamping
  // it to the player's boundary would make edge spawns appear at contact range.
  const x=p.x+Math.cos(angle)*distance,y=p.y+Math.sin(angle)*distance;
  run.eaters.push({id:index,x,y,angle:Math.atan2(p.y-y,p.x-x),speed:EXPEDITION.eaterSpeed*.72,vx:0,vy:0,phase:index*1.731+(run.map.seed??1)*.013,flank:slot.flank,lead:slot.lead,trail:[]});
  run.nextEaterSpawn=run.time+EXPEDITION.eaterSpawnDelay;run.events.push({type:'eaterSpawn',count:run.eaters.length});
}

function updateEaters(run,dt){
  if(!run.predators||run.captured)return;
  const dust=Object.values(run.elementDust).reduce((sum,n)=>sum+n,0);
  run.threat=Math.max(0,run.time-EXPEDITION.safeSeconds)*EXPEDITION.threatPerSecond+dust*EXPEDITION.threatPerDustUnit;
  const target=run.time<EXPEDITION.safeSeconds?0:EXPEDITION.eaterThresholds.filter(level=>run.threat>=level).length;
  if(run.eaters.length<target&&run.time>=run.nextEaterSpawn)spawnEater(run);
  const p=run.player;
  for(const eater of run.eaters){
    let sx=0,sy=0;
    for(const other of run.eaters){if(other===eater)continue;const dx=eater.x-other.x,dy=eater.y-other.y,d=Math.hypot(dx,dy)||1;if(d<EXPEDITION.eaterSeparationRadius){const f=(1-d/EXPEDITION.eaterSeparationRadius)*EXPEDITION.eaterSeparationForce;sx+=dx/d*f;sy+=dy/d*f;}}
    const distance=Math.hypot(p.x-eater.x,p.y-eater.y),lead=Math.min(EXPEDITION.eaterLeadSeconds,distance/650)*(eater.lead??1),heading=Math.atan2(p.vy??Math.sin(p.angle),p.vx??Math.cos(p.angle)),spread=clamp((distance-EXPEDITION.eaterContactRadius)/(EXPEDITION.eaterWarningRadius-EXPEDITION.eaterContactRadius),.12,1),flank=(eater.flank??0)*EXPEDITION.eaterFlankOffset*spread+Math.sin(run.time*.55+eater.phase)*18;
    const tx=p.x+(p.vx??0)*lead-Math.sin(heading)*flank,ty=p.y+(p.vy??0)*lead+Math.cos(heading)*flank;
    const desired=Math.atan2(ty-eater.y+sy,tx-eater.x+sx),turn=clamp(angleDelta(eater.angle,desired),-EXPEDITION.eaterTurnRate*dt,EXPEDITION.eaterTurnRate*dt);eater.angle+=turn;
    eater.speed+=(EXPEDITION.eaterSpeed-eater.speed)*(1-Math.exp(-dt*EXPEDITION.eaterAcceleration));
    const grip=1-Math.exp(-dt*EXPEDITION.eaterGrip),tvx=Math.cos(eater.angle)*eater.speed,tvy=Math.sin(eater.angle)*eater.speed;
    eater.vx+=(tvx-eater.vx)*grip;eater.vy+=(tvy-eater.vy)*grip;
    const margin=EXPEDITION.eaterSpawnDistance+100;eater.x=clamp(eater.x+eater.vx*dt,run.config.bounds.left-margin,run.config.bounds.right+margin);eater.y=clamp(eater.y+eater.vy*dt,run.config.bounds.top-margin,run.config.bounds.bottom+margin);
    eater.trail.push({x:eater.x,y:eater.y});if(eater.trail.length>20)eater.trail.shift();
  }
  run.nearestEater=run.eaters.reduce((best,eater)=>Math.min(best,Math.hypot(eater.x-p.x,eater.y-p.y)),Infinity);
  const danger=run.nearestEater<EXPEDITION.eaterDangerRadius?'danger':run.nearestEater<EXPEDITION.eaterWarningRadius?'warning':'clear';
  if(danger!==run.danger){run.danger=danger;if(danger==='danger')run.telemetry.dangerContacts++;run.events.push({type:'danger',level:danger,distance:run.nearestEater});}
  if(run.nearestEater<=EXPEDITION.eaterContactRadius){run.captured=true;run.captureAt=run.time;run.driveHeld=false;p.combustion=false;p.boost=0;run.events.push({type:'capture'});}
}

function stepRunFrame(run,input,dt,systems){
  const {player:p,map,config:c}=run;dt=clamp(dt,0,c.maxFrame);run.time+=dt;run.events.length=0;
  if(run.captured)return run.events;
  animateUniverse(run);updateCombustion(run,dt,systems);updateThermal(run,dt,systems);
  const environment=map.universe?environmentAt(p,run.time):null;
  const targetHeat=environment?clamp(environment.heat/32*100,0,100):0;run.ambientHeat+=(targetHeat-run.ambientHeat)*(1-Math.exp(-dt*(targetHeat>run.ambientHeat?1.2:.7)));
  const old={x:p.x,y:p.y},propelled=p.boost>0||p.combustion;
  let nearest=null,distance=c.assistRadius;const desired=Math.atan2(input.y,input.x);
  for(const dust of map.dust){if(dust.ready>run.time)continue;const d=Math.hypot(p.x-dust.x,p.y-dust.y);if(d<distance){distance=d;const angle=Math.abs(angleDelta(desired,dust.angle))<Math.PI/2?dust.angle:dust.angle+Math.PI;nearest={angle:Math.atan2(dust.y+Math.sin(angle)*100-p.y,dust.x+Math.cos(angle)*100-p.x)};}}
  const force={x:0,y:0};
  for(const field of map.fields){
    const phase=(run.time+field.phase)/c.fieldPeriod*Math.PI*2;field.intensity=1-c.fieldPulse+c.fieldPulse*Math.sin(phase);field.active=true;
    const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);if(d<field.radius){const strength=c.fieldForce*(1-(d/field.radius)**2)*field.intensity;force.x+=Math.cos(field.angle??.12)*strength;force.y+=Math.sin(field.angle??.12)*strength;}
  }
  const g=c.gate;
  // The boundary is a physical current. A short H₂ burst or the later
  // combustion drive can cross it; merely owning a recipe cannot.
  if(Math.abs(p.x-g.x)<g.width/2&&Math.abs(p.y-g.y)<g.height&&!propelled){const strength=c.gateDeflection*(1-Math.abs(p.x-g.x)/(g.width/2));force.x+=strength;force.y+=strength*.25;}
  moveFlight(p,input,dt,{config:c,assist:nearest,force,environment});
  if(map.universe){const region=regionAt(p.y);if(region!==run.region){run.region=region;run.events.push({type:'region',region});}}
  if(!run.gatePassed&&propelled&&old.y>=g.y-50&&p.y<g.y-50&&Math.abs(p.x-g.x)<g.width/2){run.gatePassed=true;run.events.push({type:'gate'});}
  if(Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)>c.lapRearmDistance)run.departed=true;
  if(run.departed&&run.time-run.lastLap>c.lapMinSeconds&&Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)<c.lapRadius){run.lap=true;run.laps++;run.lastLap=run.time;run.departed=false;run.events.push({type:'lap',lap:run.laps});}
  if(run.chainTime>0){run.chainTime-=dt;if(run.chainTime<=0&&run.chain){run.events.push({type:'chainEnd',chain:run.chain});run.chain=0;}}
  const radius=c.suctionRadius+(propelled?(p.drive?.boostRadius??0):0);
  let gained=0,picked=0;const elements={H:0,C:0,O:0},units={H:0,C:0,O:0};
  for(const dust of map.dust){
    if(dust.ready>run.time||segmentDistance(dust,old,p)>radius)continue;
    dust.ready=dust.cluster!==undefined?Infinity:run.time+c.respawnSeconds;run.chain++;run.best=Math.max(run.best,run.chain);run.chainTime=c.chainSeconds;
    const el=dust.element??'H';units[el]+=dust.value;run.elementDust[el]+=dust.value;
    const total=Math.floor(run.elementDust[el]/(GROWTH.dustPerAtom[el]??c.dustPerH));elements[el]+=total-run.collectedElements[el];run.collectedElements[el]=total;
    if(elements[el]>0&&!run.foundElements.includes(el)){run.foundElements.push(el);run.events.push({type:'element',element:el});}
    run.dustUnits=run.elementDust.H;run.collected=run.collectedElements.H;gained=elements.H;picked++;
    if(run.effects.length<c.maxEffects)run.effects.push({x:dust.x,y:dust.y,startX:dust.x,startY:dust.y,life:0,duration:c.suctionSeconds-(c.suctionSeconds-c.feverSuctionSeconds)*Math.min(run.chain/c.feverChain,1),kind:dust.kind,side:dust.id%2?1:-1,trail:[{x:dust.x,y:dust.y}]});
    if(dust.kind==='dense'){if(run.time>run.denseUntil)run.events.push({type:'dense'});run.denseUntil=run.time+1.4;}if(dust.kind==='rare')run.events.push({type:'rare',id:'pure-h'});
  }
  if(picked)run.events.push({type:'pickup',amount:gained,elements,units,chain:run.chain,count:picked});
  for(const e of run.effects){
    e.life+=dt;const t=clamp(e.life/e.duration,0,1)**1.5,dx=p.x-e.startX,dy=p.y-e.startY,length=Math.hypot(dx,dy)||1;
    const bend=e.side*c.suctionBend*(1+Math.min(run.chain/c.feverChain,1)*.5),cx=(e.startX+p.x)/2-dy/length*bend,cy=(e.startY+p.y)/2+dx/length*bend;
    e.x=(1-t)**2*e.startX+2*(1-t)*t*cx+t*t*p.x;e.y=(1-t)**2*e.startY+2*(1-t)*t*cy+t*t*p.y;e.trail.push({x:e.x,y:e.y});if(e.trail.length>7)e.trail.shift();
  }
  run.effects=run.effects.filter(e=>e.life<e.duration);p.trail.push({x:p.x,y:p.y});if(p.trail.length>28)p.trail.shift();updateEaters(run,dt);recordExpeditionFrame(run,dt);return run.events;
}

// Advance in fixed small slices so 15/30/60fps use the same pickup, pursuit,
// and steering path.
export function stepRun(run,input,elapsed,systems={}){
  const events=[];let remaining=clamp(elapsed,0,.15);
  while(remaining>1e-8){const dt=Math.min(1/60,remaining);events.push(...stepRunFrame(run,input,dt,systems));remaining-=dt;if(run.captured)break;}
  return events;
}
