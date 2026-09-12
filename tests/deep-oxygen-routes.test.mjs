import assert from 'node:assert/strict';
import {THERMAL} from '../src/veil/config.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {GROWTH,flightConfig} from '../src/veil/growth.js';
import {sampleLine} from '../src/veil/map.js';
import {
  DEEP_OXYGEN_FRONTIER_RECOVERY,DEEP_OXYGEN_OFF_ROUTE_PRESSURE,DEEP_OXYGEN_ROUTES,
  OXYGEN_ROUTES,OXYGEN_THERMAL,deepOxygenPressureAt,deepOxygenRouteAt,oxygenPressureAt,
  oxygenRouteCenterAtY,oxygenThermalAt,
} from '../src/veil/oxygen-routes.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';

const DT=1/60;
const deepRoute=id=>DEEP_OXYGEN_ROUTES.find(candidate=>candidate.id===id);
const normalized=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
const distance=knots=>knots.slice(1).reduce((sum,[x,y],index)=>sum+Math.hypot(x-knots[index][0],y-knots[index][1]),0);

function deterministicMap(){
  const map=createUniverse(91,{H:0,C:0,O:0});
  map.dust=[];map.fields=[];map.clusters=[];map.signals=[];
  return map;
}

function simulate({routeId,path=null,combustion=false,coolant=0,burstY=null,maxSeconds=30}){
  const route=deepRoute(routeId);assert.ok(route,`Missing ${routeId}`);
  const fuel={};
  if(combustion){fuel.fuel={molecule:'methane',amount:18};fuel.oxidizer={molecule:'oxygen',amount:36};}
  if(coolant)fuel.coolant={molecule:'water',amount:coolant};
  if(burstY!==null)fuel.propellant={molecule:'hydrogen',amount:80};
  const run=createRun(deterministicMap(),flightConfig(),{fuel,predators:false});
  const waypoints=(path??route.knots).map(([x,y])=>({x,y}));
  Object.assign(run.player,{x:waypoints[0].x,y:waypoints[0].y,angle:-Math.PI/2,speed:29,vx:0,vy:0});
  if(combustion)setCombustionHeld(run,true);
  let waypoint=1,frames=0,burstUsed=false,coolantSpent=0,maxHeat=run.heat,entryMaxHeat=0;
  const overheats=[],strain=[];
  while(frames++<maxSeconds/DT){
    const target=waypoints[waypoint],dx=target.x-run.player.x,dy=target.y-run.player.y,d=Math.hypot(dx,dy);
    if(d<55&&waypoint<waypoints.length-1){waypoint++;continue;}
    if(burstY!==null&&!burstUsed&&run.player.y<=burstY){assert.ok(beginBurst(run,()=>true),'BURST should start');burstUsed=true;}
    const input=normalized(target.x-run.player.x,target.y-run.player.y);
    const events=stepRun(run,input,DT,{
      consumeCombustion:()=>true,
      consumeCoolant:(amount,molecule)=>{assert.equal(amount,1);assert.equal(molecule,'water');coolantSpent+=amount;return true;},
    });
    maxHeat=Math.max(maxHeat,run.heat);if(run.player.y>-11050)entryMaxHeat=Math.max(entryMaxHeat,run.heat);
    for(const event of events){if(event.type==='overheat')overheats.push({time:run.time,y:run.player.y});if(event.type==='thermalStrain')strain.push({time:run.time,y:run.player.y});}
    if(Math.hypot(run.player.x-target.x,run.player.y-target.y)<55&&waypoint===waypoints.length-1)break;
  }
  assert.ok(frames<maxSeconds/DT,`${routeId} traversal must terminate`);
  return {run,time:run.time,maxHeat,entryMaxHeat,overheats,strain,burstUsed,coolantSpent};
}

const routes=Object.fromEntries(DEEP_OXYGEN_ROUTES.map(route=>[route.id,route]));
assert.deepEqual(routes['oxygen-deep-safe'].knots,[[120,-10800],[-650,-11000],[-720,-11450],[100,-11830]]);
assert.deepEqual(routes['oxygen-deep-skill'].knots,[[120,-10800],[100,-11200],[100,-11830]]);
assert.deepEqual(routes['oxygen-deep-thermal'].knots,[[120,-10800],[760,-11050],[760,-11500],[100,-11830]]);
for(const route of Object.values(routes)){
  assert.deepEqual(route.knots[0],[120,-10800],`${route.id} shared start`);
  assert.deepEqual(route.knots.at(-1),[100,-11830],`${route.id} shared exit`);
  assert.equal(route.requiredCapability,undefined);
  assert.equal(route.requires,undefined);
}
assert.equal(DEEP_OXYGEN_ROUTES.length,3);
assert.ok(distance(routes['oxygen-deep-skill'].knots)<distance(routes['oxygen-deep-safe'].knots));
assert.ok(distance(routes['oxygen-deep-skill'].knots)<distance(routes['oxygen-deep-thermal'].knots));

// Membership follows the interpolated centerline instead of a fixed authored x.
const membershipSamples=[
  ['oxygen-deep-safe',-11200,-681.1111111111111],
  ['oxygen-deep-skill',-11450,100],
  ['oxygen-deep-thermal',-11200,760],
  ['oxygen-deep-safe',-11600,-396.3157894736842],
  ['oxygen-deep-thermal',-11600,560],
];
for(const [id,y,x] of membershipSamples){
  const route=routes[id],center=oxygenRouteCenterAtY(route,y);
  assert.ok(Math.abs(center-x)<1e-9,`${id} center at ${y}`);
  assert.equal(deepOxygenRouteAt({x,y})?.id,id,`${id} membership at ${x},${y}`);
}
assert.equal(deepOxygenRouteAt({x:1100,y:-11200}),null,'off-route point must not be claimed');

// Route-local pressure replaces the old generic Deep band while remaining traversable.
assert.deepEqual([routes['oxygen-deep-safe'].width,routes['oxygen-deep-skill'].width,routes['oxygen-deep-thermal'].width],[280,180,260]);
assert.deepEqual([routes['oxygen-deep-safe'].pressure,routes['oxygen-deep-skill'].pressure,routes['oxygen-deep-thermal'].pressure],[24,60,20]);
for(const [id,y] of [['oxygen-deep-safe',-11200],['oxygen-deep-thermal',-11200]]){
  const route=routes[id],x=oxygenRouteCenterAtY(route,y);
  assert.equal(deepOxygenPressureAt({x,y}),route.pressure,`${id} local pressure`);
  assert.equal(oxygenPressureAt({x,y}),route.pressure,`${id} integrated pressure`);
  assert.equal(environmentAt({x,y}).traversableRoutePressure,route.pressure,`${id} pressure uses traversable-route safety`);
}
const skillPressureY=-11450,skillPressureX=oxygenRouteCenterAtY(routes['oxygen-deep-skill'],skillPressureY);
assert.equal(deepOxygenPressureAt({x:skillPressureX,y:skillPressureY}),routes['oxygen-deep-skill'].pressure,'Skill route owns moderate base pressure under the temporary challenge overlap');
assert.equal(oxygenPressureAt({x:skillPressureX,y:skillPressureY}),routes['oxygen-deep-skill'].pressure,'Skill pressure helper remains route-local');
assert.equal(environmentAt({x:skillPressureX,y:skillPressureY}).traversableRoutePressure,null,'existing challenge pressure keeps priority over Skill route pressure');
assert.equal(deepOxygenPressureAt({x:1100,y:-11200}),DEEP_OXYGEN_OFF_ROUTE_PRESSURE,'off-route Deep space keeps moderate environmental pressure');

// Safe Route is the low-thermal baseline and needs neither coolant nor a capability.
const safe=simulate({routeId:'oxygen-deep-safe',maxSeconds:28});
assert.ok(safe.run.player.y<-11770,'Safe Route normal propulsion reaches Frontier approach');
assert.equal(safe.overheats.length,0);assert.equal(safe.strain.length,0);assert.equal(safe.run.fuel.coolant.molecule,null);
const safeHeat=environmentAt({x:oxygenRouteCenterAtY(routes['oxygen-deep-safe'],-11450),y:-11450}).heat;
assert.ok(safeHeat<10,'Safe Route stays low thermal');

// Skill Route remains a G2 skill bypass. Normal propulsion skirts the unchanged
// curve challenge; one BURST can take the shorter central line materially faster.
const skillNormalPath=[[120,-10800],[410,-10920],[410,-11620],[100,-11830]];
const skillBurstPath=[[120,-10800],[300,-10920],[300,-11620],[100,-11830]];
const skillNormal=simulate({routeId:'oxygen-deep-skill',path:skillNormalPath,maxSeconds:20});
const skillBurst=simulate({routeId:'oxygen-deep-skill',path:skillBurstPath,burstY:-11100,maxSeconds:20});
assert.ok(skillNormal.run.player.y<-11770,'normal propulsion can bypass the existing curve challenge');
assert.ok(skillBurst.burstUsed&&skillBurst.run.player.y<-11770,'BURST can traverse the short route');
assert.ok(skillBurst.time<skillNormal.time*.9,`BURST should materially improve Skill route (${skillBurst.time.toFixed(2)}s vs ${skillNormal.time.toFixed(2)}s)`);
const curve=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='curve');
assert.deepEqual(curve,{id:'curve',bottom:-10820,top:-11320,width:240,rewards:['propane','phenol','formaldehyde']},'curve challenge source contract stays unchanged');

// Route-owned Deep thermal is ordered Safe < Skill < Thermal away from the
// existing central thermal challenge.
for(const y of [-11050,-11200]){
  const safeX=oxygenRouteCenterAtY(routes['oxygen-deep-safe'],y),skillX=oxygenRouteCenterAtY(routes['oxygen-deep-skill'],y),thermalX=oxygenRouteCenterAtY(routes['oxygen-deep-thermal'],y);
  const safeLocal=oxygenThermalAt({x:safeX,y}).deepHeat,skillLocal=oxygenThermalAt({x:skillX,y}).deepHeat,thermalLocal=oxygenThermalAt({x:thermalX,y}).deepHeat;
  assert.ok(safeLocal<skillLocal,`Safe < Skill thermal at ${y}`);
  assert.ok(skillLocal<thermalLocal,`Skill < Thermal thermal at ${y}`);
}
assert.equal(oxygenPressureAt({x:760,y:-11350}),20,'Deep Thermal stays low pressure');

const thermalDry=simulate({routeId:'oxygen-deep-thermal',combustion:true,maxSeconds:16});
assert.ok(thermalDry.entryMaxHeat<THERMAL.hotThreshold,'Deep Thermal must not overheat immediately at entrance');
assert.ok(thermalDry.maxHeat>=THERMAL.hotThreshold,`dry sustained DRIVE must encounter meaningful thermal strain (maxHeat=${thermalDry.maxHeat.toFixed(2)})`);
assert.ok(thermalDry.strain.length>=1,'dry sustained DRIVE should cross HOT');
assert.ok(thermalDry.run.player.y<-11770,'overheat, if any, must not hard-lock the route');
if(thermalDry.overheats.length)assert.ok(thermalDry.overheats[0].y<-11200,'dry overheat must not happen at route entrance');

const thermalWet=simulate({routeId:'oxygen-deep-thermal',combustion:true,coolant:8,maxSeconds:16});
assert.ok(thermalWet.coolantSpent>0&&thermalWet.coolantSpent<=8,'H2O x8 must actively cool Deep Thermal');
assert.ok(thermalWet.maxHeat<thermalDry.maxHeat-15,`H2O should create a clear heat gap (${thermalWet.maxHeat.toFixed(1)} vs ${thermalDry.maxHeat.toFixed(1)})`);
assert.equal(thermalWet.overheats.length,0,'H2O x8 should reach Frontier approach without overheat');
assert.ok(thermalWet.run.player.y<-11770,'H2O x8 reaches Frontier approach');
assert.ok(thermalWet.run.telemetry.combustionSeconds>thermalDry.run.telemetry.combustionSeconds+.5,'H2O extends sustained COMBUSTION time');

// Frontier recovery is environmental only: low heat/pressure and ordinary
// natural cooling, with no scripted reset or predator immunity flags.
assert.deepEqual(DEEP_OXYGEN_FRONTIER_RECOVERY,{x:100,y:-11700,rx:320,ry:130});
for(const id of ['oxygen-deep-safe','oxygen-deep-skill','oxygen-deep-thermal']){
  const x=oxygenRouteCenterAtY(routes[id],-11700);
  assert.equal(deepOxygenPressureAt({x,y:-11700}),0,`${id} naturally crosses Frontier recovery`);
}
const recoveryEnv=environmentAt({x:100,y:-11700});
assert.ok(recoveryEnv.heat<5);assert.equal(recoveryEnv.traversableRoutePressure,0);assert.ok(Math.abs(recoveryEnv.pressure)<1);
assert.equal(DEEP_OXYGEN_FRONTIER_RECOVERY.invulnerable,undefined);assert.equal(DEEP_OXYGEN_FRONTIER_RECOVERY.eaterSuppression,undefined);
const recoveryRun=createRun(deterministicMap(),flightConfig(),{predators:false});
Object.assign(recoveryRun.player,{x:100,y:-11700,angle:-Math.PI/2,vx:0,vy:0,speed:29});recoveryRun.heat=80;
stepRun(recoveryRun,{x:0,y:0},DT,{});
assert.ok(recoveryRun.heat<80&&recoveryRun.heat>79.5,'recovery uses gradual natural cooling rather than an instant reset');

// Single-route Deep dust is replaced, not duplicated. Provisional one-lane
// allocation keeps the total economy close to the old four-lane baseline.
const universe=createUniverse(1,{H:0,C:0,O:0});
assert.equal(universe.routes.some(route=>route.id==='oxygen-depth'),false,'legacy oxygen-depth dust route is removed');
for(const id of Object.keys(routes))assert.ok(universe.routes.some(route=>route.id===id),`${id} generated from production route data`);
const deepIds=new Set(DEEP_OXYGEN_ROUTES.map(route=>route.id)),deepDust=universe.dust.filter(dust=>deepIds.has(dust.route));
const legacyPoints=sampleLine([[120,-10670],[250,-11200],[100,-11830]],GROWTH.density.oxygenDeep.spacing),legacyCount=legacyPoints.length*GROWTH.density.oxygenDeep.lanes;
const legacyValue=legacyCount*GROWTH.density.oxygenDeep.value,newValue=deepDust.reduce((sum,dust)=>sum+dust.value,0);
assert.ok(deepDust.length>=legacyCount*.9&&deepDust.length<=legacyCount*1.5,`Deep dust count ${deepDust.length} must stay near legacy ${legacyCount}`);
assert.ok(newValue<=legacyValue*1.5,`Deep dust value ${newValue} must not inflate beyond legacy ${legacyValue}`);
const counts=Object.fromEntries(['H','C','O'].map(element=>[element,deepDust.filter(dust=>dust.element===element).length]));
assert.ok(Object.values(counts).every(count=>count>0),'all legacy Deep elements remain present');
assert.ok(deepDust.every(dust=>dust.flow),'all three Deep routes retain flowing dust');

// Network Task 4 and global thermal contracts remain untouched here.
assert.deepEqual(OXYGEN_ROUTES.find(route=>route.id==='oxygen-side').knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
assert.deepEqual(THERMAL,{heatPerSecond:10,naturalCoolingPerSecond:14,coolantCoolingPerSecond:12,coolantSecondsPerMolecule:1,coolantStart:35,hotThreshold:70,overheatThreshold:100,recoveryThreshold:55});
assert.equal(OXYGEN_THERMAL.routeId,'oxygen-side');

console.log('Deep Oxygen routes passed',JSON.stringify({
  widths:Object.fromEntries(DEEP_OXYGEN_ROUTES.map(route=>[route.id,route.width])),
  pressure:Object.fromEntries(DEEP_OXYGEN_ROUTES.map(route=>[route.id,route.pressure])),
  safe:{time:+safe.time.toFixed(2),heat:+safe.maxHeat.toFixed(2)},
  skill:{normal:+skillNormal.time.toFixed(2),burst:+skillBurst.time.toFixed(2)},
  thermalDry:{time:+thermalDry.time.toFixed(2),heat:+thermalDry.maxHeat.toFixed(2),overheats:thermalDry.overheats.length,combustion:+thermalDry.run.telemetry.combustionSeconds.toFixed(2)},
  thermalWater8:{time:+thermalWet.time.toFixed(2),heat:+thermalWet.maxHeat.toFixed(2),waterUsed:thermalWet.coolantSpent,combustion:+thermalWet.run.telemetry.combustionSeconds.toFixed(2)},
  recovery:{heat:+recoveryEnv.heat.toFixed(2),pressure:+recoveryEnv.pressure.toFixed(2)},
  dust:{legacyCount,newCount:deepDust.length,legacyValue,newValue,counts},
}));
