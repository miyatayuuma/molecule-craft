import assert from 'node:assert/strict';
import {THERMAL} from '../src/veil/config.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {flightConfig} from '../src/veil/growth.js';
import {OXYGEN_ROUTES,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';
import {criticalInsightStarterCount,createResources} from '../src/veil/resources.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';

const DT=1/60;
const route=id=>OXYGEN_ROUTES.find(candidate=>candidate.id===id);
const normalized=(x,y)=>{const length=Math.hypot(x,y)||1;return {x:x/length,y:y/length};};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};

function deterministicMap(){
  const map=createUniverse(71,{H:0,C:0,O:0});
  // Keep production universe/environment/route physics while removing pickup
  // steering noise. The authored pressure and thermal fields remain untouched.
  map.dust=[];map.fields=[];map.clusters=[];map.signals=[];
  return map;
}

function simulateRoute(routeId,{combustion=false,coolant=0,burstY=null,continueDeep=false,recoveryCoastSeconds=0}={}){
  const authored=route(routeId);assert.ok(authored,`Missing ${routeId}`);
  const fuel={};
  if(combustion){fuel.fuel={molecule:'methane',amount:18};fuel.oxidizer={molecule:'oxygen',amount:36};}
  if(coolant)fuel.coolant={molecule:'water',amount:coolant};
  if(burstY!==null)fuel.propellant={molecule:'hydrogen',amount:80};
  const run=createRun(deterministicMap(),flightConfig(),{fuel,predators:false});
  Object.assign(run.player,{x:authored.knots[0][0],y:authored.knots[0][1],angle:-Math.PI/2,speed:29,vx:0,vy:0});
  if(combustion)setCombustionHeld(run,true);
  const path=authored.knots.map(([x,y])=>({x,y}));
  if(continueDeep)path.push({x:250,y:-11200});
  let waypoint=1,burstUses=0,frames=0,coolantSpent=0,combustionPackets=0,maxHeat=run.heat,maxEnvironmentHeat=0,frontHalfMaxHeat=0,recoveryCoast=0,recoveryCoastStarted=false;
  const strain=[],overheats=[],coolantStarts=[];
  while(frames++<60*32){
    const target=path[waypoint],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy);
    if(distance<65&&waypoint<path.length-1){waypoint++;continue;}
    if(burstY!==null&&burstUses<2&&run.player.y<=burstY&&run.player.boost<=0&&run.player.cooldown<=0&&run.fuel.propellant.amount>=40){if(beginBurst(run,()=>true))burstUses++;}
    if(combustion&&recoveryCoastSeconds>0){
      if(!recoveryCoastStarted&&run.player.y<=-9660){recoveryCoastStarted=true;setCombustionHeld(run,false);}
      if(recoveryCoastStarted&&recoveryCoast<recoveryCoastSeconds){
        recoveryCoast+=DT;
        if(recoveryCoast>=recoveryCoastSeconds)setCombustionHeld(run,true);
      }
    }
    const input=normalized(target.x-run.player.x,target.y-run.player.y);
    const envBefore=environmentAt(run.player,run.time);maxEnvironmentHeat=Math.max(maxEnvironmentHeat,envBefore.heat);
    const events=stepRun(run,input,DT,{
      consumeCombustion:()=>{combustionPackets++;return true;},
      consumeCoolant:(amount,molecule)=>{assert.equal(amount,1);assert.equal(molecule,'water');coolantSpent+=amount;return true;},
    });
    maxHeat=Math.max(maxHeat,run.heat);if(run.player.y>-9700)frontHalfMaxHeat=Math.max(frontHalfMaxHeat,run.heat);
    for(const event of events){
      if(event.type==='thermalStrain')strain.push({time:run.time,x:run.player.x,y:run.player.y,heat:run.heat,combustion:run.player.combustion});
      if(event.type==='overheat')overheats.push({time:run.time,x:run.player.x,y:run.player.y,heat:run.heat});
      if(event.type==='coolantStart')coolantStarts.push({time:run.time,y:run.player.y,heat:run.heat});
    }
    if(Math.hypot(run.player.x-target.x,run.player.y-target.y)<65&&waypoint===path.length-1)break;
  }
  assert.ok(frames<60*32,`${routeId} deterministic traversal must terminate`);
  return {run,frames,time:run.time,strain,overheats,coolantStarts,coolantSpent,combustionPackets,maxHeat,maxEnvironmentHeat,frontHalfMaxHeat,burstUsed:burstUses>0,burstUses,recoveryCoast};
}

// Thermal geometry is narrow and follows the production Route C centerline.
const routeC=route('oxygen-side'),routeB=route('oxygen-main'),routeA=route('oxygen-shortcut');
assert.deepEqual(routeC.knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
assert.deepEqual(routeB.knots,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
assert.deepEqual(routeA.knots,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
for(const y of [-9000,-9400,-9800,-10150,-10350]){
  const cx=oxygenRouteCenterAtY(routeC,y),bx=oxygenRouteCenterAtY(routeB,y),ax=oxygenRouteCenterAtY(routeA,y);
  assert.ok(environmentAt({x:cx,y}).heat>=environmentAt({x:bx,y}).heat,`Route C should not be cooler than B at ${y}`);
  assert.ok(environmentAt({x:cx,y}).heat>=environmentAt({x:ax,y}).heat,`Route C should not be cooler than A at ${y}`);
}
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9500),y:-9500}).heat<20,'Route C warm section rises gradually');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-10050),y:-10050}).heat>=35,'Route C learning section is high thermal');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeB,-10050),y:-10050}).heat<5,'Route B remains mostly cool beside Route C');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeB,-10050),y:-10050}).combustionHeatFactor===1,'Route B keeps neutral combustion thermal load');

// Scenario A: fastest clean centerline DRIVE learns HOT late in Route C, once,
// with meaningful reaction time before any overheat. Keep a modest spatial
// tolerance because the event is emitted by integrated ship motion, not a gate.
const cDry=simulateRoute('oxygen-side',{combustion:true});
assert.ok(cDry.frontHalfMaxHeat<THERMAL.hotThreshold,'Route C front half must remain below HOT');
assert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');
assert.equal(cDry.strain[0].combustion,true,'thermal strain crossing happens with COMBUSTION active');
assert.ok(cDry.strain[0].y<=-10180&&cDry.strain[0].y>=-10480,`thermal strain should occur near the HOT-learning/deep boundary, got y=${cDry.strain[0].y}`);
assert.ok(cDry.strain[0].heat<THERMAL.hotThreshold+4,'HOT crossing must not jump straight toward overheat');
assert.ok(!cDry.overheats.length||cDry.overheats[0].time-cDry.strain[0].time>.75,'thermal strain must leave reaction time before overheat');
assert.ok(cDry.run.player.y<-10600,'no-coolant Route C can still reach the network merge');
assert.ok(cDry.combustionPackets>0,'production methane/oxygen packets are consumed');

// Scenario B: the canonical eight-water starter engages the thermostat, spends
// coolant gradually and reaches the merge with a large, perceptible heat margin.
const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});
assert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');
assert.ok(cWet.coolantSpent>0&&cWet.coolantSpent<8,'eight water molecules must help without being exhausted before the merge');
assert.ok(cWet.run.heat<cDry.run.heat-25,`H2O should create a clear heat gap: dry=${cDry.run.heat}, wet=${cWet.run.heat}`);
assert.ok(cWet.run.heat<THERMAL.hotThreshold,'H2O x8 should keep the intended Route C traversal stable');
assert.equal(cWet.overheats.length,0,'H2O x8 should sustain DRIVE through Route C');
assert.ok(cWet.run.player.combustion,'COMBUSTION remains active at the merge with coolant');

// Continue the same held DRIVE into the recovery/deep handoff. The dry run must
// lose sustained combustion first; the water starter buys materially more time.
const cDryDeep=simulateRoute('oxygen-side',{combustion:true,continueDeep:true});
const cWetDeep=simulateRoute('oxygen-side',{combustion:true,coolant:8,continueDeep:true});
assert.ok(cDryDeep.overheats.length>=1,'dry sustained DRIVE should eventually overheat after Route C');
assert.ok(!cWetDeep.overheats.length||cWetDeep.overheats[0].time>cDryDeep.overheats[0].time+1,'H2O x8 should extend sustained DRIVE time by at least one second');

// Scenario C: environmental heat exists, but ordinary propulsion cannot emit
// the combustion-only thermal strain milestone or overheat on Route C.
const cAmbient=simulateRoute('oxygen-side');
assert.ok(cAmbient.maxEnvironmentHeat>10,'Route C has real ambient thermal exposure');
assert.equal(cAmbient.strain.length,0);assert.equal(cAmbient.overheats.length,0);assert.equal(cAmbient.run.heat,0);
assert.ok(cAmbient.run.player.y<-10600,'Route C remains passable without H2O or COMBUSTION');

// Scenario D: Route B remains a sustained DRIVE route. Its authored recovery
// is thermally quiet, but intended traversal does not require a cooling stop.
const bDrive=simulateRoute('oxygen-main',{combustion:true});
assert.equal(bDrive.strain.length,0,'Route B intended DRIVE must not teach thermal strain');
assert.equal(bDrive.overheats.length,0);assert.ok(bDrive.run.heat<THERMAL.hotThreshold);
assert.ok(bDrive.run.heat<cDry.run.heat-20,'Route B heat buildup must be clearly lower than Route C');
assert.ok(environmentAt({x:300,y:-9750}).heat<1,'Route B recovery is low ambient heat');

// Scenario E: Route A keeps its pressure/BURST identity rather than becoming a
// thermal route. Task 6 aligns pulse with this corridor, so use the canonical
// two-burst H2 starter if the first burst cannot clear the whole dynamic field.
const aBurst=simulateRoute('oxygen-shortcut',{burstY:-9400});
assert.equal(aBurst.strain.length,0);assert.equal(aBurst.overheats.length,0);assert.ok(aBurst.burstUsed);
assert.ok(aBurst.burstUses<=2,'Route A traversal stays within the canonical two-burst starter');
assert.ok(aBurst.maxEnvironmentHeat<5,'Route A has no high route-local thermal exposure');

// Scenario F: merge recovery is cool, then Deep Oxygen rises again. The
// relocated thermal challenge now reinforces the authored Deep Thermal route;
// Frontier still does not inherit the old broad network band.
const mergeHeat=environmentAt({x:120,y:-10800}).heat,deepWarm=environmentAt({x:180,y:-11200}).heat,challengeHeat=environmentAt({x:760,y:-11300}).heat,frontierHeat=environmentAt({x:100,y:-11920}).heat;
assert.ok(mergeHeat<1,'network merge has a low-heat recovery transition');
assert.ok(deepWarm>mergeHeat+10,'Deep Oxygen heat rises after the merge recovery');
assert.equal(challengeHeat,48,'Deep Thermal challenge supplies heat=48 without additive stacking');
assert.ok(frontierHeat<5,'Deep thermal handoff fades before Frontier');
const thermalChallenge=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='thermal');
assert.deepEqual(thermalChallenge,{id:'thermal',bottom:-11160,top:-11440,width:260,centerX:760,centerY:-11300,rewards:['ethylene-glycol','n-hexane']});

// Production event -> persistent thermal record -> unchanged H2O readiness.
assert.equal(criticalInsightStarterCount('water'),8,'canonical water starter remains eight molecules');
const resources=createResources({storage:memory()});
resources.setCatalog([
  {id:'methane',formula:'CH4',atoms:['C','H','H','H','H']},
  {id:'oxygen',formula:'O2',atoms:['O','O']},
  {id:'water',formula:'H2O',atoms:['H','H','O']},
]);
resources.discover('methane');resources.discover('oxygen');resources.findElementForExpedition('O');
resources.state.elements.H=16;resources.state.elements.O=8;
assert.ok(!resources.progressionInsightCandidates().includes('water'),'materials alone do not reveal H2O');
assert.equal(cDry.strain.length,1);assert.equal(resources.recordThermalStrain(),true);
assert.ok(resources.progressionInsightCandidates().includes('water'),'Route C thermal strain makes unchanged H2O prerequisites ready');

console.log('Oxygen thermal progression passed',JSON.stringify({
  routeCDry:{heat:+cDry.run.heat.toFixed(2),strainY:+cDry.strain[0].y.toFixed(1),time:+cDry.time.toFixed(2),overheats:cDry.overheats.length},
  routeCWater8:{heat:+cWet.run.heat.toFixed(2),waterUsed:cWet.coolantSpent,waterLeft:cWet.run.fuel.coolant.amount,time:+cWet.time.toFixed(2),overheats:cWet.overheats.length},
  routeB:{heat:+bDrive.run.heat.toFixed(2),time:+bDrive.time.toFixed(2),recoveryCoast:+bDrive.recoveryCoast.toFixed(2),overheats:bDrive.overheats.length},
  deep:{mergeHeat:+mergeHeat.toFixed(2),deepWarm:+deepWarm.toFixed(2),challengeHeat,frontierHeat:+frontierHeat.toFixed(2)},
}));
