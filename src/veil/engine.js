import {recordChallengePassage} from './expedition-challenges.js';
import {recordChoDestination} from './cho-campaign.js';
import { VEIL, EXPEDITION, THERMAL } from './config.js';
import { GROWTH, DRIVES, burstDriveFor, combustionDriveFor, regionAt } from './growth.js';
import { combustionChargeFor,performanceFor } from './molecule-roles.js';
import {consumeShockCharge,shockStrength} from './shock.js';
import { environmentAt, animateUniverse } from './universe.js';
import {appendHazard,defineHazard,effectiveHazardScale,HAZARD_TYPES,organicCorridorInfluence} from './hazards.js';
import {nitrogenCoreInRange} from './nitrogen-routes.js';
import {dustEaterWorldTuning} from './world-awakening.js';
import { OXYGEN_THERMAL, recordOxygenPassage } from './oxygen-routes.js';
import { createExpeditionTelemetry, recordExpeditionFrame, recordFuelUse } from './telemetry.js';

export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const VEIL_BOUNDARY_HAZARD=defineHazard('veil-boundary-current',HAZARD_TYPES.MECHANICAL,'pressure',{source:'veil-boundary'});

export function createFlight(config=VEIL){
  return {...config.spawn,speed:config.driftSpeed,vx:0,vy:0,boost:0,cooldown:0,combustion:false,drive:null,bank:0,trail:[]};
}

function activePropulsion(p){return p.boost>0?p.drive:p.combustion?(p.drive??DRIVES.combustion):null;}

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
  p.y=clamp(p.y+(p.vy+fy*resistance+(environment?.pressure??0)+(environment?.flowY??0))*dt,c.bounds.top,c.bounds.bottom);
  p.boost=Math.max(0,p.boost-dt);p.cooldown=Math.max(0,p.cooldown-dt);
}

export function beginBurst(run,consume){
  const p=run?.player,slot=run?.fuel?.propellant,performance=performanceFor(slot?.molecule,'propellant'),drive=burstDriveFor(slot?.molecule);
  if(!p||!performance||!drive||run.captured||p.boost>0||p.cooldown>0||slot.amount<performance.moleculesPerBurst)return false;
  if(!consume(performance.moleculesPerBurst,slot.molecule))return false;
  slot.amount-=performance.moleculesPerBurst;run.telemetry.burstUses++;run.burstStallRecorded=false;recordFuelUse(run.telemetry,'propellant',slot.molecule,performance.moleculesPerBurst);p.drive=drive;p.boost=drive.boostSeconds;p.cooldown=drive.boostSeconds+drive.boostCooldown;return true;
}

export function beginShock(run,consume){
  const spent=consumeShockCharge(run,consume);if(!spent)return false;const {material,remaining,strength}=spent,p=run.player;let affected=0,coreFractured=false;
  if(nitrogenCoreInRange(run,p)){run.map.nitrogenCore.fractured=true;run.map.nitrogenCore.fracturedAt=run.time;run.coreFracturedThisRun=true;coreFractured=true;}
  for(const eater of run.eaters??[]){const dx=eater.x-p.x,dy=eater.y-p.y,distance=Math.hypot(dx,dy);if(distance>strength.radius)continue;const angle=distance>1e-6?Math.atan2(dy,dx):(eater.phase??0),falloff=.55+.45*(1-Math.min(1,distance/strength.radius)),nx=Math.cos(angle),ny=Math.sin(angle),impulse=strength.knockback*falloff;eater.vx=(eater.vx??0)+nx*impulse;eater.vy=(eater.vy??0)+ny*impulse;eater.x+=nx*impulse*.12;eater.y+=ny*impulse*.12;eater.interrupt=Math.max(eater.interrupt??0,strength.interruptSeconds*falloff);affected++;}
  run.shockWaves.push({x:p.x,y:p.y,life:0,duration:coreFractured?.62:.44,radius:strength.radius,material,strength,coreFracture:coreFractured});if(run.telemetry){run.telemetry.shockUses=(run.telemetry.shockUses??0)+1;recordFuelUse(run.telemetry,'shock',material,1);}
  const event={type:'shock',material,remaining,affected,radius:strength.radius,knockback:strength.knockback,interruptSeconds:strength.interruptSeconds,coreFractured};run.events.push(event);if(coreFractured)run.events.push({type:'coreFracture',material,x:run.map.nitrogenCore.x,y:run.map.nitrogenCore.y});return event;
}
export function setCombustionHeld(run,held){if(!run||run.captured)return false;run.driveHeld=!!held;if(!held)run.player.combustion=false;return run.driveHeld;}

export function createRun(map,config=VEIL,{fuel={},predators=true}={}){
  const entry=(use,legacy)=>fuel[use]?.molecule!==undefined?{molecule:fuel[use].molecule,amount:fuel[use].amount??0,capacity:fuel[use].capacity??performanceFor(fuel[use].molecule,use)?.capacity??0}:{molecule:legacy,amount:fuel[legacy]??0};
  const loadout={propellant:entry('propellant','hydrogen'),fuel:entry('fuel','methane'),oxidizer:entry('oxidizer','oxygen'),coolant:entry('coolant',null),shock:entry('shock',null)};
  return {destinationReached:false,map,player:createFlight(config),time:0,chain:0,best:0,chainTime:0,collected:0,dustUnits:0,elementDust:{H:0,C:0,N:0,O:0},collectedElements:{H:0,C:0,N:0,O:0},foundElements:[],heat:0,ambientHeat:0,combustionHeatFactor:1,coolantBuffer:0,coolantActive:false,coolantEpisode:false,coolantEmpty:false,coolantNeedExposure:0,coolantNeedEmitted:false,overheated:false,thermalStrainEmitted:false,region:'veil',effects:[],shockWaves:[],events:[],denseUntil:0,gatePassed:false,departed:false,lap:false,laps:0,lastLap:0,config,fuel:loadout,driveHeld:false,driveBuffer:0,predators,threat:0,eaters:[],nearestEater:Infinity,danger:'clear',currentHazards:[],nextEaterSpawn:0,captured:false,captureAt:0,coreFracturedThisRun:false,coreApproachNotified:false,eaterTuning:dustEaterWorldTuning(config?.worldAwakened===true),telemetry:createExpeditionTelemetry(loadout)};
}

function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}

function availableCombustionCharge(run){
  const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer;if(oxidizer.molecule!=='oxygen')return null;
  return combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds});
}

function updateCombustion(run,dt,systems){
  const p=run.player;
  if(!run.driveHeld||p.boost>0||run.captured||run.overheated){p.combustion=false;return;}
  const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer;
  if(run.driveBuffer<=1e-8){
    const charge=availableCombustionCharge(run);
    if(!charge||!systems.consumeCombustion?.(charge)){p.combustion=false;if(!run.driveEmpty){run.driveEmpty=true;run.events.push({type:'driveEmpty'});}return;}
    fuel.amount-=charge.fuelAmount;oxidizer.amount-=charge.oxygenAmount;recordFuelUse(run.telemetry,'fuel',fuel.molecule,charge.fuelAmount);recordFuelUse(run.telemetry,'oxidizer',oxidizer.molecule,charge.oxygenAmount);run.driveBuffer=charge.seconds;run.driveEmpty=false;run.events.push({type:'driveIgnition'});
  }
  p.drive=combustionDriveFor(fuel.molecule)??DRIVES.combustion;p.combustion=true;run.driveBuffer=Math.max(0,run.driveBuffer-dt);
  if(run.driveBuffer<=0&&!availableCombustionCharge(run))p.combustion=false;
}

function updateThermal(run,dt,systems){
  const p=run.player,fuelPerformance=performanceFor(run.fuel.fuel.molecule,'fuel'),previousHeat=run.heat;
  run.heat+=run.ambientHeat/100*2.5*dt;
  run.heat+=p.combustion?THERMAL.heatPerSecond*(fuelPerformance?.heatFactor??1)*(run.combustionHeatFactor??1)*dt:-THERMAL.naturalCoolingPerSecond*dt;
  run.heat=clamp(run.heat,0,THERMAL.overheatThreshold);
  if(!run.thermalStrainEmitted&&p.combustion&&previousHeat<THERMAL.hotThreshold&&run.heat>=THERMAL.hotThreshold){run.thermalStrainEmitted=true;run.events.push({type:'thermalStrain'});}
  const coolant=run.fuel.coolant,coolantPerformance=performanceFor(coolant?.molecule,'coolant');
  const thermostat=run.heat>=THERMAL.coolantStart&&(p.combustion||run.overheated);
  if(thermostat&&run.coolantBuffer<=1e-8&&coolantPerformance&&coolant.amount>=1){
    if(systems.consumeCoolant?.(1,coolant.molecule)){
      coolant.amount--;run.coolantBuffer=THERMAL.coolantSecondsPerMolecule*(coolantPerformance.durationFactor??1);recordFuelUse(run.telemetry,'coolant',coolant.molecule,1);run.coolantEmpty=false;
      if(!run.coolantEpisode){run.coolantEpisode=true;run.events.push({type:'coolantStart',molecule:coolant.molecule});}
    }
  }
  const exposure=1+.8*(run.ambientHeat/100)/Math.max(.1,coolantPerformance?.environmentTolerance??1);
  const coolingSeconds=Math.min(dt,run.coolantBuffer/exposure);run.coolantActive=coolingSeconds>1e-8;
  if(run.coolantActive){run.coolantBuffer=Math.max(0,run.coolantBuffer-coolingSeconds*exposure);run.heat=Math.max(0,run.heat-THERMAL.coolantCoolingPerSecond*coolantPerformance.coolingPower*coolingSeconds);}
  if(run.heat<THERMAL.coolantStart&&run.coolantBuffer<=1e-8)run.coolantEpisode=false;
  if(thermostat&&coolantPerformance&&coolant.amount<1&&run.coolantBuffer<=1e-8&&!run.coolantEmpty){run.coolantEmpty=true;run.events.push({type:'coolantEmpty',molecule:coolant.molecule});}
  if(!run.overheated&&run.heat>=THERMAL.overheatThreshold){run.overheated=true;p.combustion=false;run.telemetry.overheatEvents++;run.events.push({type:'overheat'});}
  else if(run.overheated&&run.heat<=THERMAL.recoveryThreshold){run.overheated=false;run.events.push({type:'heatRecovered'});}
}

function spawnEater(run){
  const tuning=run.eaterTuning??dustEaterWorldTuning(false),p=run.player,index=run.eaters.length,slots=[{angle:Math.PI,flank:0,lead:-2.4},{angle:-2.3,flank:-1,lead:.2},{angle:2.3,flank:1,lead:.2},{angle:-1.35,flank:-.7,lead:1},{angle:1.35,flank:.7,lead:1}],slot=slots[index%slots.length],angle=p.angle+slot.angle,distance=EXPEDITION.eaterSpawnDistance*tuning.spawnDistanceMultiplier+(index%2)*65;
  // Let a new vortex approach from just outside the traversable field. Clamping
  // it to the player's boundary would make edge spawns appear at contact range.
  const x=p.x+Math.cos(angle)*distance,y=p.y+Math.sin(angle)*distance;
  const targetSpeed=EXPEDITION.eaterSpeed*tuning.speedMultiplier;run.eaters.push({id:index,x,y,angle:Math.atan2(p.y-y,p.x-x),speed:targetSpeed*.72,targetSpeed,vx:0,vy:0,phase:index*1.731+(run.map.seed??1)*.013,flank:slot.flank,lead:slot.lead,trail:[]});
  run.nextEaterSpawn=run.time+EXPEDITION.eaterSpawnDelay*tuning.spawnDelayMultiplier;run.events.push({type:'eaterSpawn',count:run.eaters.length});
}

function updateEaters(run,dt){
  if(!run.predators||run.captured)return;
  const tuning=run.eaterTuning??dustEaterWorldTuning(false),dust=Object.values(run.elementDust).reduce((sum,n)=>sum+n,0),safeSeconds=EXPEDITION.safeSeconds*tuning.safeSecondsMultiplier;
  run.threat=Math.max(0,run.time-safeSeconds)*EXPEDITION.threatPerSecond*tuning.threatPerSecondMultiplier+dust*EXPEDITION.threatPerDustUnit*tuning.threatPerDustMultiplier;
  const thresholds=EXPEDITION.eaterThresholds.map(level=>level*tuning.thresholdMultiplier),thresholdTarget=run.time<safeSeconds?0:thresholds.filter(level=>run.threat>=level).length,earlyTarget=run.time>=tuning.earlyEncounterSeconds?tuning.earlyEncounterCount:0,target=Math.min(tuning.maxPursuers,Math.max(thresholdTarget,earlyTarget));
  if(run.eaters.length<target&&run.time>=run.nextEaterSpawn)spawnEater(run);
  const p=run.player;
  for(const eater of run.eaters){
    if((eater.interrupt??0)>0){eater.interrupt=Math.max(0,eater.interrupt-dt);const drag=Math.exp(-dt*1.15),margin=EXPEDITION.eaterSpawnDistance+100;eater.vx=(eater.vx??0)*drag;eater.vy=(eater.vy??0)*drag;eater.x=clamp(eater.x+eater.vx*dt,run.config.bounds.left-margin,run.config.bounds.right+margin);eater.y=clamp(eater.y+eater.vy*dt,run.config.bounds.top-margin,run.config.bounds.bottom+margin);eater.trail.push({x:eater.x,y:eater.y});if(eater.trail.length>20)eater.trail.shift();continue;}
    let sx=0,sy=0;
    for(const other of run.eaters){if(other===eater)continue;const dx=eater.x-other.x,dy=eater.y-other.y,d=Math.hypot(dx,dy)||1;if(d<EXPEDITION.eaterSeparationRadius){const f=(1-d/EXPEDITION.eaterSeparationRadius)*EXPEDITION.eaterSeparationForce;sx+=dx/d*f;sy+=dy/d*f;}}
    const distance=Math.hypot(p.x-eater.x,p.y-eater.y),lead=Math.min(EXPEDITION.eaterLeadSeconds,distance/650)*(eater.lead??1),heading=Math.atan2(p.vy??Math.sin(p.angle),p.vx??Math.cos(p.angle)),spread=clamp((distance-EXPEDITION.eaterContactRadius)/(EXPEDITION.eaterWarningRadius-EXPEDITION.eaterContactRadius),.12,1),flank=(eater.flank??0)*EXPEDITION.eaterFlankOffset*spread+Math.sin(run.time*.55+eater.phase)*18;
    const tx=p.x+(p.vx??0)*lead-Math.sin(heading)*flank,ty=p.y+(p.vy??0)*lead+Math.cos(heading)*flank;
    const desired=Math.atan2(ty-eater.y+sy,tx-eater.x+sx),turn=clamp(angleDelta(eater.angle,desired),-EXPEDITION.eaterTurnRate*dt,EXPEDITION.eaterTurnRate*dt);eater.angle+=turn;
    eater.speed+=((eater.targetSpeed??EXPEDITION.eaterSpeed)-eater.speed)*(1-Math.exp(-dt*EXPEDITION.eaterAcceleration));
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
  const environment=map.universe?environmentAt(p,run.time,map):null,currentHazards=environment?.hazards?[...environment.hazards]:[];
  const targetHeat=environment?clamp(environment.heat/32*100,0,150):0;run.ambientHeat+=(targetHeat-run.ambientHeat)*(1-Math.exp(-dt*(targetHeat>run.ambientHeat?1.2:.7)));run.combustionHeatFactor=environment?.combustionHeatFactor??1;
  const coolantLearning=!!environment?.coolantLearning&&p.combustion&&!run.fuel.coolant?.molecule;run.coolantNeedExposure=coolantLearning?run.coolantNeedExposure+dt:0;if(!run.coolantNeedEmitted&&run.coolantNeedExposure>=OXYGEN_THERMAL.learningExposureSeconds){run.coolantNeedEmitted=true;run.events.push({type:'coolantNeed',exposure:run.coolantNeedExposure});}
  const old={x:p.x,y:p.y},propelled=p.boost>0||p.combustion;
  let nearest=null,distance=c.assistRadius;const desired=Math.atan2(input.y,input.x);
  for(const dust of map.dust){if(dust.ready>run.time)continue;const d=Math.hypot(p.x-dust.x,p.y-dust.y);if(d<distance){distance=d;const angle=Math.abs(angleDelta(desired,dust.angle))<Math.PI/2?dust.angle:dust.angle+Math.PI;nearest={angle:Math.atan2(dust.y+Math.sin(angle)*100-p.y,dust.x+Math.cos(angle)*100-p.x)};}}
  const routePressure=environment?.traversableRoutePressure,pulseWallPressure=p.boost>0?(environment?.frontierWallPulsePressure??0):0,movementEnvironment=Number.isFinite(routePressure)?{...environment,pressure:environment.pressure-routePressure+pulseWallPressure}:pulseWallPressure?{...environment,pressure:environment.pressure+pulseWallPressure}:environment;
  const force={x:0,y:Number.isFinite(routePressure)?routePressure:0};
  for(const field of map.fields){
    const phase=(run.time+field.phase)/c.fieldPeriod*Math.PI*2;field.intensity=1-c.fieldPulse+c.fieldPulse*Math.sin(phase);field.active=true;
    const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);if(d<field.radius){const fieldForce=Number.isFinite(field.force)?Math.max(0,field.force):c.fieldForce,spatial=1-(d/field.radius)**2,type=field.hazard?.type??HAZARD_TYPES.MECHANICAL,effectiveScale=effectiveHazardScale(spatial*field.intensity,field.baseIntensity??1,type,map.worldState??'base'),strength=fieldForce*effectiveScale,angle=field.angle??.12;field.effectiveIntensity=Math.min(1,effectiveScale);field.effectiveForce=strength;force.x+=Math.cos(angle)*strength;force.y+=Math.sin(angle)*strength;if(field.hazard)appendHazard(currentHazards,field.hazard,Math.min(1,effectiveScale),{severity:strength,vector:{x:Math.cos(angle)*strength,y:Math.sin(angle)*strength}});}
  }
  const g=c.gate,gateEnvelope=organicCorridorInfluence({seed:map.seed??1,id:'veil-boundary-current',x:p.x,y:p.y,centerX:g.x,centerY:g.y,halfWidth:g.width/2,halfLength:g.height,edgeFade:24,centerJitter:0,widthJitter:.06,scale:110});
  // The boundary is a physical current. A short H₂ burst or the later
  // combustion drive can cross it; merely owning a recipe cannot. The authored
  // core stays fixed while the envelope now has deterministic organic falloff.
  if(gateEnvelope.intensity>0&&!propelled){const effectiveScale=effectiveHazardScale(gateEnvelope.intensity,1,HAZARD_TYPES.MECHANICAL,map.worldState??'base'),strength=c.gateDeflection*effectiveScale;force.x+=strength;force.y+=strength*.25;appendHazard(currentHazards,VEIL_BOUNDARY_HAZARD,Math.min(1,effectiveScale),{severity:strength,vector:{x:strength,y:strength*.25}});}
  run.currentHazards=currentHazards;
  moveFlight(p,input,dt,{config:c,assist:nearest,force,environment:movementEnvironment});
  const nitrogenCore=map.nitrogenCore;if(nitrogenCore&&!nitrogenCore.fractured&&!run.coreApproachNotified&&Math.hypot(p.x-nitrogenCore.x,p.y-nitrogenCore.y)<=nitrogenCore.fractureRadius*1.55){run.coreApproachNotified=true;run.events.push({type:'coreApproach',shockAvailable:canShock(run),shockCharges:run.fuel.shock?.amount??0});}
  recordChallengePassage(run,old);recordOxygenPassage(run,old,dt);recordChoDestination(run,old);
  if(map.universe){const region=regionAt(p.y);if(region!==run.region){run.region=region;run.events.push({type:'region',region});}}
  if(!run.gatePassed&&propelled&&old.y>=g.y-50&&p.y<g.y-50&&Math.abs(p.x-g.x)<g.width/2){run.gatePassed=true;run.events.push({type:'gate'});}
  if(Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)>c.lapRearmDistance)run.departed=true;
  if(run.departed&&run.time-run.lastLap>c.lapMinSeconds&&Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)<c.lapRadius){run.lap=true;run.laps++;run.lastLap=run.time;run.departed=false;run.events.push({type:'lap',lap:run.laps});}
  if(run.chainTime>0){run.chainTime-=dt;if(run.chainTime<=0&&run.chain){run.events.push({type:'chainEnd',chain:run.chain});run.chain=0;}}
  const radius=c.suctionRadius+(propelled?(p.drive?.boostRadius??0):0);
  let gained=0,picked=0;const elements={H:0,C:0,N:0,O:0},units={H:0,C:0,N:0,O:0};
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
  run.effects=run.effects.filter(e=>e.life<e.duration);for(const wave of run.shockWaves)wave.life+=dt;run.shockWaves=run.shockWaves.filter(wave=>wave.life<wave.duration);p.trail.push({x:p.x,y:p.y});if(p.trail.length>28)p.trail.shift();updateEaters(run,dt);recordExpeditionFrame(run,dt);return run.events;
}

// Advance in fixed small slices so 15/30/60fps use the same pickup, pursuit,
// and steering path.
export function stepRun(run,input,elapsed,systems={}){
  const events=[];let remaining=clamp(elapsed,0,.15);
  while(remaining>1e-8){const dt=Math.min(1/60,remaining);events.push(...stepRunFrame(run,input,dt,systems));remaining-=dt;if(run.captured)break;}
  return events;
}
