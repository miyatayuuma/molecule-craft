import assert from 'node:assert/strict';
import {createRoute,createVortexFlybyRoute,flybyArc,routeFlowAt,routeSocket,smoothCurve,spiralIn,spiralOut,straight} from '../src/veil/route-kit.js';
import {OXYGEN_JUNCTION,OXYGEN_VORTEX,OXYGEN_VORTEX_ROUTE,oxygenVortexFlowAt} from '../src/veil/oxygen-routes.js';

const route=createVortexFlybyRoute({entry:{x:170,y:-8090,angle:-Math.PI/2},exit:{...OXYGEN_JUNCTION,angle:-Math.PI/2},center:OXYGEN_VORTEX.center});
assert.equal(route.points[0].x,170);assert.equal(route.points[0].y,-8090);
assert.equal(route.points.at(-1).x,OXYGEN_JUNCTION.x);assert.equal(route.points.at(-1).y,OXYGEN_JUNCTION.y);
assert.equal(route.fieldLines.length,5);assert.ok(route.points.length>80);
let maxGap=0,minCore=Infinity;
for(let i=0;i<route.points.length;i++){
  const p=route.points[i];minCore=Math.min(minCore,Math.hypot(p.x-route.center.x,p.y-route.center.y));
  if(i)maxGap=Math.max(maxGap,Math.hypot(p.x-route.points[i-1].x,p.y-route.points[i-1].y));
}
assert.ok(maxGap<=20.01);assert.ok(minCore<6);
assert.ok(Math.hypot(route.entry.position.x-route.exit.position.x,route.entry.position.y-route.exit.position.y)>500);
const guide=routeFlowAt(route,{x:170,y:-8090});assert.ok(guide.intensity>.9);assert.ok(Math.hypot(guide.x,guide.y)>30);
assert.equal(routeFlowAt(route,{x:1000,y:-7000}).intensity,0);
assert.equal(OXYGEN_VORTEX.routeId,OXYGEN_VORTEX_ROUTE.id);assert.notEqual(OXYGEN_VORTEX,OXYGEN_VORTEX_ROUTE);
assert.deepEqual(OXYGEN_VORTEX.sockets.reward,{x:-500,y:-8380,radius:72});
const entryFlow=oxygenVortexFlowAt({x:170,y:-8090,vx:0,vy:-100});assert.ok(entryFlow.guideIntensity>.5);
assert.ok(Number.isFinite(entryFlow.x)&&Number.isFinite(entryFlow.y));

// Generic segments compose by socket pose only. No implicit scale or stage-wide
// coordinates are needed, so the same parts can be reused elsewhere.
const composed=createRoute({id:'kit-smoke',entry:{x:10,y:20,angle:0},width:180,spacing:16,segments:[
  straight({length:140}),
  smoothCurve({length:160,turn:-Math.PI/4}),
  flybyArc({radius:180,sweep:Math.PI/3}),
  spiralIn({outerRadius:220,innerRadius:120,turns:.18,direction:1}),
  spiralOut({innerRadius:120,outerRadius:190,turns:.14,direction:1}),
]});
assert.equal(composed.segments.length,5);assert.equal(composed.fieldLines.length,5);assert.equal(composed.entry.position.x,10);assert.equal(composed.entry.position.y,20);
assert.ok(composed.points.length>50);assert.ok(Number.isFinite(composed.exit.position.x)&&Number.isFinite(composed.exit.angle));
for(let i=1;i<composed.points.length;i++)assert.ok(Math.hypot(composed.points[i].x-composed.points[i-1].x,composed.points[i].y-composed.points[i-1].y)<=16.01);
const middle=routeSocket(composed,.5,'reward');assert.equal(middle.id,'reward');assert.ok(Number.isFinite(middle.position.x)&&Number.isFinite(middle.angle));
assert.ok(Math.abs(composed.segments[0].position.x-150)<1e-6&&Math.abs(composed.segments[0].position.y-20)<1e-6,'Straight socket is translated from the entry pose without scaling');
console.log('Route Kit passed: reusable connected primitives, sockets, vortex geometry and shared guidance flow.');
