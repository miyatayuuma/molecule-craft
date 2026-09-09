import assert from 'node:assert/strict';
import {OXYGEN_VORTEX,OXYGEN_VORTEX_REWARD,OXYGEN_VORTEX_ROUTE,oxygenVortexFlowAt} from '../src/veil/oxygen-routes.js';
import {animateUniverse,createUniverse,environmentAt} from '../src/veil/universe.js';

const magnitude=v=>Math.hypot(v.x,v.y);
const radialBasis=p=>{
  const dx=p.x-OXYGEN_VORTEX.center.x,dy=p.y-OXYGEN_VORTEX.center.y,r=Math.hypot(dx,dy)||1;
  const rx=dx/r,ry=dy/r,tx=-ry*OXYGEN_VORTEX.direction,ty=rx*OXYGEN_VORTEX.direction;
  return {r,rx,ry,tx,ty};
};
const dot=(v,x,y)=>v.x*x+v.y*y;

// The authored approach starts with a warning-scale current, then ramps into a
// clearly dominant circular flow without a hard boundary.
const cue=oxygenVortexFlowAt({x:170,y:-8090,vx:0,vy:0});
const outer=oxygenVortexFlowAt({x:OXYGEN_VORTEX.center.x+OXYGEN_VORTEX.outerRadius,y:OXYGEN_VORTEX.center.y,vx:0,vy:0});
assert.ok(magnitude(cue)>0&&magnitude(cue)<12,'Approach cue must be visible but weak');
assert.ok(magnitude(outer)>110,'Outer orbit must be a materially stronger current');

// At the east side the vortex runs clockwise. Moving with that tangent while
// cutting inward earns extra inward flow; entering against it does not.
const east={x:OXYGEN_VORTEX.center.x+300,y:OXYGEN_VORTEX.center.y};
const withFlow=oxygenVortexFlowAt({...east,vx:-116,vy:-116});
const againstFlow=oxygenVortexFlowAt({...east,vx:-116,vy:116});
assert.ok(withFlow.radial<againstFlow.radial-50,'Flow-aligned entry must pull inward more strongly');
assert.ok(withFlow.tangential>80,'Circular velocity remains readable in the middle orbit');

// The core is not an anchor. It fades toward zero and allows the craft to cross
// it with retained velocity instead of becoming pinned or trapped.
assert.ok(magnitude(oxygenVortexFlowAt({x:OXYGEN_VORTEX.center.x+20,y:OXYGEN_VORTEX.center.y,vx:164,vy:0}))<1);
assert.equal(OXYGEN_VORTEX_REWARD.x,OXYGEN_VORTEX.center.x);assert.equal(OXYGEN_VORTEX_REWARD.y,OXYGEN_VORTEX.center.y);

// Widening the orbit is the efficient escape: outward + same-direction tangent
// receives radial assistance, while brute-force radial thrust still works but
// continues to fight the base inward current.
const directEscape=oxygenVortexFlowAt({...east,vx:164,vy:0});
const spiralEscape=oxygenVortexFlowAt({...east,vx:116,vy:-116});
assert.ok(directEscape.radial<0,'Direct radial escape must still oppose the current');
assert.ok(spiralEscape.radial>20&&spiralEscape.radial>directEscape.radial+45,'A widening spiral must convert tangent speed into escape assistance');

function simulate(approach='direct',speed=164){
  const p={x:170,y:-8090,vx:0,vy:0};let reachedCore=false,coreSeconds=null,exitSeconds=null,angle=null,orbitAngle=0;
  const dt=1/60;
  for(let frame=0;frame<15/dt;frame++){
    const basis=radialBasis(p);let ux,uy;
    if(!reachedCore){
      if(approach==='flow'){ux=-basis.rx*.70+basis.tx*.714;uy=-basis.ry*.70+basis.ty*.714;}
      else {ux=-basis.rx;uy=-basis.ry;}
    }else{ux=basis.rx*.72+basis.tx*.69;uy=basis.ry*.72+basis.ty*.69;}
    const length=Math.hypot(ux,uy)||1;p.vx=ux/length*speed;p.vy=uy/length*speed;
    const flow=oxygenVortexFlowAt(p);p.x+=(p.vx+flow.x)*dt;p.y+=(p.vy+flow.y)*dt;
    const next=radialBasis(p),nextAngle=Math.atan2(p.y-OXYGEN_VORTEX.center.y,p.x-OXYGEN_VORTEX.center.x);
    if(next.r<=OXYGEN_VORTEX.outerRadius&&!reachedCore){if(angle!==null)orbitAngle+=Math.atan2(Math.sin(nextAngle-angle),Math.cos(nextAngle-angle));angle=nextAngle;}
    if(!reachedCore&&next.r<=OXYGEN_VORTEX.coreRadius){reachedCore=true;coreSeconds=(frame+1)*dt;}
    if(reachedCore&&next.r>=OXYGEN_VORTEX.influenceRadius){exitSeconds=(frame+1)*dt;break;}
  }
  return {reachedCore,coreSeconds,exitSeconds,turns:Math.abs(orbitAngle)/(Math.PI*2)};
}
const straight=simulate('direct'),flowLine=simulate('flow');
assert.ok(straight.reachedCore&&straight.exitSeconds<11,'Standard flight must reach the core and escape without BURST');
assert.ok(flowLine.coreSeconds<straight.coreSeconds-.15,'Reading the tangent must beat simply pointing at the centre');
assert.ok(flowLine.turns<1&&straight.turns<1,'The route must not require repetitive orbit grinding');

// Map, physics and moving visual particles share the same authored vortex.
const run={map:createUniverse(81),player:{x:170,y:-8090,boost:0,combustion:false},time:0,config:{suctionRadius:30},events:[]};
const vortexRoute=run.map.routes.find(route=>route.id===OXYGEN_VORTEX.id);assert.ok(vortexRoute&&vortexRoute.optional);
assert.equal(vortexRoute.geometry,OXYGEN_VORTEX_ROUTE,'Map route must reuse Route Kit geometry directly');
assert.equal(vortexRoute.element,null,'Dedicated field rendering must not reuse the strong generic O route stroke');assert.equal(vortexRoute.sourceElement,'O');
assert.equal(vortexRoute.points,OXYGEN_VORTEX_ROUTE.points);assert.equal(vortexRoute.visual.fieldLines,OXYGEN_VORTEX_ROUTE.fieldLines);
const orbiters=run.map.dust.filter(d=>d.vortex),expectedOrbiters=OXYGEN_VORTEX.particleRings.reduce((sum,ring)=>sum+ring.count,0);assert.equal(orbiters.length,expectedOrbiters);
const particle=orbiters[0],before={x:particle.x,y:particle.y};run.time=1;animateUniverse(run);assert.notDeepEqual({x:particle.x,y:particle.y},before);
assert.ok(Math.abs(Math.hypot(particle.x-OXYGEN_VORTEX.center.x,particle.y-OXYGEN_VORTEX.center.y)-particle.vortex.radius)<1e-6);
const env=environmentAt({...east,vx:116,vy:-116},0);assert.ok(env.vortex>.9&&Number.isFinite(env.flowX)&&Number.isFinite(env.pressure));

console.log('Vortex route passed: gradual cue, directional entry, flow-assisted inward line, crossable core, spiral escape, sub-lap standard solution, shared Route Kit geometry, moving visual current and provisional centre reward.');
