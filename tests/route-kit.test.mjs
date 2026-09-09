import assert from 'node:assert/strict';
import {createVortexFlybyRoute,routeFlowAt} from '../src/veil/route-kit.js';
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
console.log('Route Kit vortex geometry, sockets and shared guidance flow passed.');
