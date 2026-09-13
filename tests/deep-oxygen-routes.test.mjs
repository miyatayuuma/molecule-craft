import assert from 'node:assert/strict';
import {THERMAL} from '../src/veil/config.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {GROWTH,flightConfig} from '../src/veil/growth.js';
import {sampleLine} from '../src/veil/map.js';
import {
  DEEP_OXYGEN_FRONTIER_RECOVERY,DEEP_OXYGEN_ROUTES,deepOxygenFrontierRecoveryAt,
  deepOxygenPressureAt,deepOxygenRouteAt,oxygenRouteCenterAtY,oxygenThermalAt,
} from '../src/veil/oxygen-routes.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';

const DT=1/60;
const route=id=>DEEP_OXYGEN_ROUTES.find(candidate=>candidate.id===id);
const normalized=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
const geometryLength=authored=>authored.knots.slice(1).reduce((sum,[x,y],index)=>sum+Math.hypot(x-authored.knots[index][0],y-authored.knots[index][1]),0);
const deterministicMap=()=>{const map=createUniverse(83,{H:0,C:0,O:0});map.dust=[];map.fields=[];map.clusters=[];map.signals=[];return map;};

function traverse(path,{combustion=false,coolant=0,bursts=false,maxSeconds=28}={}){
  const fuel={};
  if(combustion){fuel.fuel={molecule:'methane',amount:18};fuel.oxidizer={molecule:'oxygen',amount:36};}
  if(coolant)fuel.coolant={molecule:'water',amount:coolant};
  if(bursts)fuel.propellant={molecule:'hydrogen',amount:120};
  const run=createRun(deterministicMap(),flightConfig(),{fuel,predators:false});
  Object.assign(run.player,{x:path[0].x,y:path[0].y,angle:-Math.PI/2,speed:29,vx:0,vy:0});
  if(combustion)setCombustionHeld(run,true);
  let waypoint=1,frames=0,coolantSpent=0,burstUses=0,maxHeat=run.heat,maxEnvironmentHeat=0,firstOverheat=null;
  while(frames++<maxSeconds/DT){
    const target=path[waypoint],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy);
    if(distance<55){if(waypoint===path.length-1)break;waypoint++;continue;}
    if(bursts&&run.player.y<=-10820&&run.player.y>-11620&&run.player.boost<=0&&run.player.cooldown<=0&&run.fuel.propellant.amount>=40){if(beginBurst(run,()=>true))burstUses++;}
    maxEnvironmentHeat=Math.max(maxEnvironmentHeat,environmentAt(run.player,run.time).heat);
    const events=stepRun(run,normalized(target.x-run.player.x,target.y-run.player.y),DT,{
      consumeCombustion:()=>true,
      consumeCoolant:(amount,molecule)=>{assert.equal(amount,1);assert.equal(molecule,'water');coolantSpent+=amount;return true;},
    });
    maxHeat=Math.max(maxHeat,run.heat);
    if(!firstOverheat&&events.some(event=>event.type==='overheat'))firstOverheat={time:run.time,x:run.player.x,y:run.player.y};
  }
  return {run,time:run.time,reached:waypoint===path.length-1,coolantSpent,burstUses,maxHeat,maxEnvironmentHeat,firstOverheat};
}

const safe=route('oxygen-deep-safe'),skill=route('oxygen-deep-skill'),thermal=route('oxygen-deep-thermal');
assert.deepEqual(safe.knots,[[120,-10800],[-650,-11000],[-720,-11450],[100,-11830]]);
assert.deepEqual(skill.knots,[[120,-10800],[100,-11200],[100,-11830]]);
assert.deepEqual(thermal.knots,[[120,-10800],[760,-11050],[760,-11500],[100,-11830]]);
for(const authored of DEEP_OXYGEN_ROUTES){assert.deepEqual(authored.knots[0],[120,-10800]);assert.deepEqual(authored.knots.at(-1),[100,-11830]);assert.equal(authored.requiredCapability,undefined);assert.equal(authored.requires,undefined);}
assert.ok(geometryLength(safe)>geometryLength(thermal)&&geometryLength(thermal)>geometryLength(skill),'Safe must be longest and Skill shortest');
assert.deepEqual([safe.width,skill.width,thermal.width],[260,180,260]);
assert.deepEqual([safe.pressure,skill.pressure,thermal.pressure],[18,34,16]);

for(const [authored,y] of [[safe,-11200],[skill,-11200],[thermal,-11200]]){
  const x=oxygenRouteCenterAtY(authored,y);assert.equal(deepOxygenRouteAt({x,y})?.id,authored.id,`${authored.id} follows interpolated centerline`);
}
assert.equal(deepOxygenRouteAt({x:-1030,y:-11200}),null,'off-route point must not be assigned by fixed x');
assert.equal(deepOxygenPressureAt({x:oxygenRouteCenterAtY(safe,-11200),y:-11200}),18);
assert.equal(deepOxygenPressureAt({x:oxygenRouteCenterAtY(skill,-11200),y:-11200}),34);
assert.equal(deepOxygenPressureAt({x:oxygenRouteCenterAtY(thermal,-11200),y:-11200}),16);
assert.equal(deepOxygenPressureAt({x:-1030,y:-11200}),120,'off-route Deep space retains moderate environmental pressure');

const safeHeat=oxygenThermalAt({x:oxygenRouteCenterAtY(safe,-11450),y:-11450}).heat;
const skillHeat=oxygenThermalAt({x:oxygenRouteCenterAtY(skill,-11450),y:-11450}).heat;
const thermalHeat=oxygenThermalAt({x:oxygenRouteCenterAtY(thermal,-11450),y:-11450}).heat;
assert.ok(safeHeat<skillHeat&&skillHeat<thermalHeat,`route-local heat must order Safe < Skill < Thermal (${safeHeat}, ${skillHeat}, ${thermalHeat})`);
assert.ok(safeHeat<10,'Safe route stays low thermal');
assert.ok(thermalHeat>=40,'Thermal route owns the high-thermal field');

const safeRun=traverse(safe.knots.map(([x,y])=>({x,y})));
assert.ok(safeRun.reached,'normal propulsion reaches Frontier approach on Safe');
assert.equal(safeRun.run.overheated,false);assert.equal(safeRun.run.heat,0);
// The three Deep routes converge before Frontier recovery, so steering can skim
// the Skill field near the merge. Safe must still avoid high Thermal exposure.
assert.ok(safeRun.maxEnvironmentHeat<20,'Safe traversal stays below the high-thermal band through route convergence');

// Normal thrust can line-take around the aligned Deep Skill challenge; BURST
// can cut through the authored centerline and remains materially faster.
const skillNormal=traverse([{x:120,y:-10800},{x:420,y:-10920},{x:420,y:-11620},{x:100,y:-11830}],{maxSeconds:24});
const skillBurst=traverse(skill.knots.map(([x,y])=>({x,y})),{bursts:true,maxSeconds:18});
assert.ok(skillNormal.reached,'Skill route remains a G2 skill bypass with normal propulsion');
assert.ok(skillBurst.reached&&skillBurst.burstUses>=2,'BURST can cut through the difficult central section');
assert.ok(skillBurst.time<skillNormal.time*.8,`BURST should materially improve traversal (${skillBurst.time.toFixed(2)}s vs ${skillNormal.time.toFixed(2)}s)`);
const curve=EXPEDITION_CHALLENGES.find(candidate=>candidate.id==='curve');assert.deepEqual(curve,{id:'curve',bottom:-11200,top:-11700,width:240,centerX:100,centerY:-11450,rewards:['propane','phenol','formaldehyde']});

const thermalPath=thermal.knots.map(([x,y])=>({x,y}));
const thermalDry=traverse(thermalPath,{combustion:true,maxSeconds:20});
const thermalWet=traverse(thermalPath,{combustion:true,coolant:8,maxSeconds:20});
assert.ok(thermalDry.reached,'Deep Thermal is never a hard coolant gate');
assert.ok(thermalDry.maxHeat>=THERMAL.hotThreshold,'dry sustained DRIVE reaches meaningful thermal strain');
if(thermalDry.firstOverheat)assert.ok(thermalDry.firstOverheat.y<-11100,'dry overheat must not occur immediately at route entrance');
assert.ok(thermalWet.reached,'H2O x8 reaches Frontier approach');
assert.ok(thermalWet.coolantSpent>0&&thermalWet.coolantSpent<=8,'H2O thermostat must actually consume coolant');
assert.ok(thermalWet.maxHeat<thermalDry.maxHeat-12,`H2O must create a clear heat margin (${thermalDry.maxHeat.toFixed(2)} vs ${thermalWet.maxHeat.toFixed(2)})`);
assert.equal(thermalWet.run.overheated,false,'H2O x8 keeps the intended Deep Thermal traversal stable at exit');

assert.deepEqual(DEEP_OXYGEN_FRONTIER_RECOVERY,{x:100,y:-11700,rx:250,ry:130});
const frontierRecovery={x:100,y:-11700};
assert.equal(deepOxygenFrontierRecoveryAt(frontierRecovery),true);
assert.equal(deepOxygenPressureAt(frontierRecovery),0);
assert.ok(environmentAt(frontierRecovery).heat<1,'Frontier recovery has low ambient heat');
const recoveryRun=createRun(deterministicMap(),flightConfig(),{predators:false});Object.assign(recoveryRun.player,{...frontierRecovery,angle:-Math.PI/2,vx:0,vy:0});recoveryRun.heat=80;stepRun(recoveryRun,{x:0,y:0},DT);assert.ok(recoveryRun.heat>79&&recoveryRun.heat<80,'recovery uses natural cooling instead of scripted heat reset');

// Former oxygen-depth used GROWTH.density.oxygenDeep (spacing 20, lanes 4, value 2).
// Task 6 differentiates all three routes while keeping aggregate value within
// the explicit 1.75x economy sanity ceiling.
const legacyPoints=sampleLine([[120,-10670],[250,-11200],[100,-11830]],GROWTH.density.oxygenDeep.spacing);
const legacy={H:0,C:0,O:0,total:0,value:0};
for(const [i] of legacyPoints.entries()){const element=i%5===0?'H':i%17===0?'C':'O';legacy[element]+=GROWTH.density.oxygenDeep.lanes;legacy.total+=GROWTH.density.oxygenDeep.lanes;legacy.value+=GROWTH.density.oxygenDeep.lanes*GROWTH.density.oxygenDeep.value;}
const deepIds=new Set(DEEP_OXYGEN_ROUTES.map(candidate=>candidate.id)),deepDust=createUniverse(1,{H:0,C:0,O:0}).dust.filter(dust=>deepIds.has(dust.route));
const current={H:0,C:0,O:0,total:deepDust.length,value:0};for(const dust of deepDust){current[dust.element]++;current.value+=dust.value;assert.ok(dust.flow,'Deep route dust keeps flowing field behavior');}
assert.ok(current.total<=legacy.total*1.75&&current.value<=legacy.value*1.75,'three differentiated routes stay within the Deep economy ceiling');
for(const element of ['H','C','O']){assert.ok(current[element]>0,`${element} remains present in Deep mixed generation`);assert.ok(current[element]<=legacy[element]*1.75,`${element} dust stays within the aggregate economy envelope`);}
assert.equal(createUniverse(1,{H:0,C:0,O:0}).routes.some(candidate=>candidate.id==='oxygen-depth'),false,'legacy oxygen-depth is not registered as a fourth dust route');

console.log('Deep Oxygen routes passed',JSON.stringify({
  geometry:{safe:+geometryLength(safe).toFixed(1),skill:+geometryLength(skill).toFixed(1),thermal:+geometryLength(thermal).toFixed(1)},
  traversal:{safe:+safeRun.time.toFixed(2),skillNormal:+skillNormal.time.toFixed(2),skillBurst:+skillBurst.time.toFixed(2),burstUses:skillBurst.burstUses},
  thermal:{dryMax:+thermalDry.maxHeat.toFixed(2),dryOverheatY:thermalDry.firstOverheat?+thermalDry.firstOverheat.y.toFixed(1):null,wetMax:+thermalWet.maxHeat.toFixed(2),waterUsed:thermalWet.coolantSpent},
  economy:{legacy,current,ratio:+(current.value/legacy.value).toFixed(3)},
}));