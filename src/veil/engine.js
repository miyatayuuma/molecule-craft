import { VEIL } from './config.js';
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function createFlight(config=VEIL){return {...config.spawn,speed:0,boost:0,cooldown:0,trail:[]};}
// Frame-rate independent steering. Release brakes gently; no uncontrolled drift.
export function moveFlight(p,input,dt,{config=VEIL,chain=0,assist=null,force={x:0,y:0}}={}){
  dt=clamp(dt,0,config.maxFrame);const magnitude=Math.min(1,Math.hypot(input.x,input.y));
  if(magnitude>.09){
    let desired=Math.atan2(input.y,input.x);
    if(assist&&Math.abs(angleDelta(desired,assist.angle))<.9)desired+=angleDelta(desired,assist.angle)*config.assistStrength;
    const delta=angleDelta(p.angle,desired),rate=p.boost>0?config.boostTurnRate:config.turnRate;
    p.angle+=clamp(delta,-rate*dt,rate*dt);
  }
  const boost=p.boost>0,fever=Math.min(chain/100,1);
  const target=boost?config.boostSpeed:config.speed*(1+fever*config.chainSpeedBonus)*magnitude;
  p.speed+=(target-p.speed)*(1-Math.exp(-dt*(boost?11:config.acceleration)));
  p.x+=(Math.cos(p.angle)*p.speed+force.x*(boost?.12:1))*dt;
  p.y+=(Math.sin(p.angle)*p.speed+force.y*(boost?.12:1))*dt;
  p.x=clamp(p.x,config.bounds.left,config.bounds.right);p.y=clamp(p.y,config.bounds.top,config.bounds.bottom);
  p.boost=Math.max(0,p.boost-dt);p.cooldown=Math.max(0,p.cooldown-dt);
}
export function beginBoost(p,consume,config=VEIL){
  if(p.boost>0||p.cooldown>0||!consume())return false;
  p.boost=config.boostSeconds;p.cooldown=config.boostSeconds+config.boostCooldown;return true;
}

export function createRun(map,config=VEIL){return {map,player:createFlight(config),time:0,chain:0,best:0,chainTime:0,collected:0,dustUnits:0,effects:[],events:[],denseUntil:0,gatePassed:false,departed:false,lap:false,config};}
function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy,t=l?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function stepRunFrame(run,input,dt){
  const {player:p,map,config:c}=run;dt=clamp(dt,0,c.maxFrame);run.time+=dt;run.events.length=0;
  const old={x:p.x,y:p.y},boosted=p.boost>0;
  let nearest=null,distance=c.assistRadius;const desired=Math.atan2(input.y,input.x);
  for(const dust of map.dust){if(dust.ready>run.time)continue;const d=Math.hypot(p.x-dust.x,p.y-dust.y);if(d<distance){distance=d;const angle=Math.abs(angleDelta(desired,dust.angle))<Math.PI/2?dust.angle:dust.angle+Math.PI;nearest={angle:Math.atan2(dust.y+Math.sin(angle)*100-p.y,dust.x+Math.cos(angle)*100-p.x)};}}
  const force={x:0,y:0};
  for(const field of map.fields){const phase=(run.time+field.phase)%6;field.active=phase>=c.fieldWarning&&phase<4.6;field.warning=phase<c.fieldWarning;const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);if(field.active&&d<field.radius&&d>1){const strength=c.fieldForce*(1-d/field.radius);force.x+=dx/d*strength;force.y+=dy/d*strength;}}
  const g=c.gate;
  if(p.x>g.x-g.width/2&&p.x<g.x+g.width/2&&p.y<g.y+g.height&&p.y>g.y-g.height)force.y+=boosted?0:420*clamp((g.y+g.height-p.y)/100,0,1);
  moveFlight(p,input,dt,{config:c,chain:run.chain,assist:nearest,force});
  if(!run.gatePassed&&boosted&&old.y>=g.y-50&&p.y<g.y-50&&Math.abs(p.x-g.x)<g.width/2){run.gatePassed=true;run.events.push({type:'gate'});}
  if(p.y<-1000)run.departed=true;
  if(run.departed&&!run.lap&&run.time>45&&Math.hypot(p.x-c.spawn.x,p.y-c.spawn.y)<150){run.lap=true;run.events.push({type:'lap'});}
  if(run.chainTime>0){run.chainTime-=dt;if(run.chainTime<=0&&run.chain){run.events.push({type:'chainEnd',chain:run.chain});run.chain=0;}}
  const radius=c.suctionRadius+c.chainRadiusBonus*Math.min(run.chain/100,1)+(boosted?c.boostRadius:0);
  let gained=0,picked=0;
  for(const dust of map.dust){
    if(dust.ready>run.time||segmentDistance(dust,old,p)>radius)continue;
    dust.ready=run.time+c.respawnSeconds;run.chain++;run.best=Math.max(run.best,run.chain);run.chainTime=c.chainSeconds;run.dustUnits+=dust.value;const total=Math.floor(run.dustUnits/c.dustPerH);gained+=total-run.collected;run.collected=total;picked++;
    if(run.effects.length<c.maxEffects)run.effects.push({x:dust.x,y:dust.y,startX:dust.x,startY:dust.y,life:0,duration:.22+Math.min(.16,distance/400),kind:dust.kind,side:dust.id%2?1:-1});
    if(dust.kind==='dense'){if(run.time>run.denseUntil)run.events.push({type:'dense'});run.denseUntil=run.time+1.4;}
    if(dust.kind==='rare')run.events.push({type:'rare',id:'pure-h'});
  }
  if(picked)run.events.push({type:'pickup',amount:gained,chain:run.chain});
  for(const e of run.effects){e.life+=dt;const t=clamp(e.life/e.duration,0,1),bend=Math.sin(t*Math.PI)*e.side*26;e.x=e.startX+(p.x-e.startX)*t+bend;e.y=e.startY+(p.y-e.startY)*t-bend*.5;}
  run.effects=run.effects.filter(e=>e.life<e.duration);
  p.trail.push({x:p.x,y:p.y});if(p.trail.length>28)p.trail.shift();
  return run.events;
}

// Advance in fixed small slices so 15/30/60fps use the same pickup and steering path.
export function stepRun(run,input,elapsed){
  const events=[];let remaining=clamp(elapsed,0,.15);
  while(remaining>1e-8){const dt=Math.min(1/60,remaining);events.push(...stepRunFrame(run,input,dt));remaining-=dt;}
  return events;
}
