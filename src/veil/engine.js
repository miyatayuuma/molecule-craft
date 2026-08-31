import { VEIL } from './config.js';
import { GROWTH, regionAt } from './growth.js';
import { environmentAt, animateUniverse } from './universe.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createFlight(config=VEIL){return {...config.spawn,speed:config.driftSpeed,vx:0,vy:0,boost:0,cooldown:0,bank:0,trail:[]};}
// Heading is responsive; a short velocity blend preserves the feeling of banking.
// Countersteering tightens the turn instead of forcing a wide boost U-turn.
export function moveFlight(p,input,dt,{config:c=VEIL,chain=0,assist=null,force={x:0,y:0},environment=null,thrust=1}={}){
  dt=clamp(dt,0,c.maxFrame);const magnitude=Math.min(1,Math.hypot(input.x,input.y)),steering=magnitude>.09,boost=p.boost>0;
  let delta=0;
  if(steering){
    let desired=Math.atan2(input.y,input.x);
    if(assist&&Math.abs(angleDelta(desired,assist.angle))<.8)desired+=angleDelta(desired,assist.angle)*c.assistStrength;
    delta=angleDelta(p.angle,desired);
    const rate=(boost?c.boostTurnRate:c.turnRate)*(Math.abs(delta)>1.8?c.reverseAssist:1);
    const turn=clamp(delta*c.turnResponse,-rate,rate);p.angle+=turn*dt;
    p.bank+=(clamp(turn/rate,-1,1)-p.bank)*(1-Math.exp(-dt*8));
  }else p.bank*=Math.exp(-dt*5);
  const fever=Math.min(chain/c.feverChain,1),corner=1-(1-c.cornerSpeed)*Math.min(Math.abs(delta)/Math.PI,1);
  const target=(boost?(p.drive?.boostSpeed??c.boostSpeed)*corner:steering?c.speed*(1+fever*c.chainSpeedBonus)*magnitude*corner:c.driftSpeed)*thrust;
  p.speed+=(target-p.speed)*(1-Math.exp(-dt*(boost?c.boostAcceleration:steering?c.acceleration:c.releaseDrag)));
  const grip=1-Math.exp(-dt*(boost?c.boostGrip:c.velocityGrip));
  p.vx=(p.vx??Math.cos(p.angle)*p.speed)+(Math.cos(p.angle)*p.speed-(p.vx??Math.cos(p.angle)*p.speed))*grip;
  p.vy=(p.vy??Math.sin(p.angle)*p.speed)+(Math.sin(p.angle)*p.speed-(p.vy??Math.sin(p.angle)*p.speed))*grip;
  // A current may bend a route, but cannot pin the ship or reverse its thrust.
  let fx=force.x,fy=force.y;const dot=fx*Math.cos(p.angle)+fy*Math.sin(p.angle),limit=-p.speed*c.maxOpposingFlow;
  if(dot<limit){fx+=(limit-dot)*Math.cos(p.angle);fy+=(limit-dot)*Math.sin(p.angle);}
  const resistance=boost?c.boostFieldResistance:Math.min(1,p.speed/c.speed);
  p.x=clamp(p.x+(p.vx+fx*resistance+(environment?.flowX??0))*dt,c.bounds.left,c.bounds.right);
  p.y=clamp(p.y+(p.vy+fy*resistance+(environment?.pressure??0))*dt,c.bounds.top,c.bounds.bottom);
  p.boost=Math.max(0,p.boost-dt);p.cooldown=Math.max(0,p.cooldown-dt);
}
export function beginBoost(p,consume,config=VEIL){
  if(p.boost>0||p.cooldown>0||!consume())return false;
  p.drive={boostSpeed:config.boostSpeed,boostRadius:config.boostRadius};p.boost=config.boostSeconds;p.cooldown=config.boostSeconds+config.boostCooldown;return true;
}

export function createRun(map,config=VEIL){return {map,player:createFlight(config),time:0,chain:0,best:0,chainTime:0,collected:0,dustUnits:0,elementDust:{H:0,C:0,O:0},collectedElements:{H:0,C:0,O:0},heat:0,cooling:0,overheated:false,region:'veil',effects:[],events:[],denseUntil:0,gatePassed:false,departed:false,lap:false,laps:0,lastLap:0,config};}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function stepRunFrame(run,input,dt,systems){
  const {player:p,map,config:c}=run;dt=clamp(dt,0,c.maxFrame);run.time+=dt;run.events.length=0;
  animateUniverse(run);
  const environment=map.universe?environmentAt(p,run.time):null;let thrust=1;
  if(environment){
    const coolant=GROWTH.cooling,heat=GROWTH.heat;
    if(run.heat>=coolant.threshold&&run.cooling<=0&&systems.consumeCoolant?.()){run.heat=Math.max(0,run.heat-coolant.drop);run.cooling=coolant.seconds;run.events.push({type:'cooling'});}
    const passiveLoss=heat.ambientLoss*(1-environment.intensity);
    run.heat=clamp(run.heat+(environment.heat-passiveLoss-(run.cooling>0?coolant.rate:0))*dt,0,heat.max);run.cooling=Math.max(0,run.cooling-dt);
    if(run.heat>=heat.max&&!run.overheated){run.overheated=true;p.boost=0;run.events.push({type:'overheat'});}
    if(run.overheated&&run.heat<heat.recover)run.overheated=false;
    thrust=run.overheated?heat.minimumThrust:1-clamp((run.heat-heat.derateStart)/(heat.max-heat.derateStart),0,1)*.7;
  }
  const old={x:p.x,y:p.y},boosted=p.boost>0;
  let nearest=null,distance=c.assistRadius;const desired=Math.atan2(input.y,input.x);
  for(const dust of map.dust){if(dust.ready>run.time)continue;const d=Math.hypot(p.x-dust.x,p.y-dust.y);if(d<distance){distance=d;const angle=Math.abs(angleDelta(desired,dust.angle))<Math.PI/2?dust.angle:dust.angle+Math.PI;nearest={angle:Math.atan2(dust.y+Math.sin(angle)*100-p.y,dust.x+Math.cos(angle)*100-p.x)};}}
  const force={x:0,y:0};
  for(const field of map.fields){
    const phase=(run.time+field.phase)/c.fieldPeriod*Math.PI*2;
    field.intensity=1-c.fieldPulse+c.fieldPulse*Math.sin(phase);field.active=true;
    const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);
    if(d<field.radius){const strength=c.fieldForce*(1-(d/field.radius)**2)*field.intensity;
      force.x+=Math.cos(field.angle??.12)*strength;force.y+=Math.sin(field.angle??.12)*strength;}
  }
  const g=c.gate;
  // The outer veil bends unboosted flight into the return stream, never a wall.
  if(Math.abs(p.x-g.x)<g.width/2&&Math.abs(p.y-g.y)<g.height&&!boosted){
    const strength=c.gateDeflection*(1-Math.abs(p.x-g.x)/(g.width/2));force.x+=strength;force.y+=strength*.25;
  }
  moveFlight(p,input,dt,{config:c,chain:run.chain,assist:nearest,force,environment,thrust});
  if(map.universe){const region=regionAt(p.y);if(region!==run.region){run.region=region;run.events.push({type:'region',region});}}
  if(!run.gatePassed&&boosted&&old.y>=g.y-50&&p.y<g.y-50&&Math.abs(p.x-g.x)<g.width/2){run.gatePassed=true;run.events.push({type:'gate'});}
  if(Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)>c.lapRearmDistance)run.departed=true;
  if(run.departed&&run.time-run.lastLap>c.lapMinSeconds&&Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)<c.lapRadius){run.lap=true;run.laps++;run.lastLap=run.time;run.departed=false;run.events.push({type:'lap',lap:run.laps});}
  if(run.chainTime>0){run.chainTime-=dt;if(run.chainTime<=0&&run.chain){run.events.push({type:'chainEnd',chain:run.chain});run.chain=0;}}
  const radius=c.suctionRadius+c.chainRadiusBonus*Math.min(run.chain/c.feverChain,1)+(boosted?(p.drive?.boostRadius??c.boostRadius):0);
  let gained=0,picked=0;const elements={H:0,C:0,O:0},units={H:0,C:0,O:0};
  for(const dust of map.dust){
    if(dust.ready>run.time||segmentDistance(dust,old,p)>radius)continue;
    dust.ready=dust.cluster!==undefined?Infinity:run.time+c.respawnSeconds;run.chain++;run.best=Math.max(run.best,run.chain);run.chainTime=c.chainSeconds;
    const el=dust.element??'H';units[el]+=dust.value;run.elementDust[el]+=dust.value;
    const total=Math.floor(run.elementDust[el]/(GROWTH.dustPerAtom[el]??c.dustPerH));elements[el]+=total-run.collectedElements[el];run.collectedElements[el]=total;
    run.dustUnits=run.elementDust.H;run.collected=run.collectedElements.H;gained=elements.H;picked++;
    if(run.effects.length<c.maxEffects)run.effects.push({x:dust.x,y:dust.y,startX:dust.x,startY:dust.y,life:0,duration:c.suctionSeconds-(c.suctionSeconds-c.feverSuctionSeconds)*Math.min(run.chain/c.feverChain,1),kind:dust.kind,side:dust.id%2?1:-1,trail:[{x:dust.x,y:dust.y}]});
    if(dust.kind==='dense'){if(run.time>run.denseUntil)run.events.push({type:'dense'});run.denseUntil=run.time+1.4;}
    if(dust.kind==='rare')run.events.push({type:'rare',id:'pure-h'});
  }
  if(picked)run.events.push({type:'pickup',amount:gained,elements,units,chain:run.chain,count:picked});
  for(const e of run.effects){
    e.life+=dt;const t=clamp(e.life/e.duration,0,1)**1.5,dx=p.x-e.startX,dy=p.y-e.startY,length=Math.hypot(dx,dy)||1;
    const bend=e.side*c.suctionBend*(1+Math.min(run.chain/c.feverChain,1)*.5),cx=(e.startX+p.x)/2-dy/length*bend,cy=(e.startY+p.y)/2+dx/length*bend;
    e.x=(1-t)**2*e.startX+2*(1-t)*t*cx+t*t*p.x;e.y=(1-t)**2*e.startY+2*(1-t)*t*cy+t*t*p.y;
    e.trail.push({x:e.x,y:e.y});if(e.trail.length>7)e.trail.shift();
  }
  run.effects=run.effects.filter(e=>e.life<e.duration);
  p.trail.push({x:p.x,y:p.y});if(p.trail.length>28)p.trail.shift();
  return run.events;
}

// Advance in fixed small slices so 15/30/60fps use the same pickup and steering path.
export function stepRun(run,input,elapsed,systems={}){
  const events=[];let remaining=clamp(elapsed,0,.15);
  while(remaining>1e-8){const dt=Math.min(1/60,remaining);events.push(...stepRunFrame(run,input,dt,systems));remaining-=dt;}
  return events;
}
