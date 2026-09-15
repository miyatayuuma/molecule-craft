import assert from 'node:assert/strict';
import {THERMAL} from '../src/veil/config.js';
import {beginBurst,createRun,setCombustionHeld,stepRun} from '../src/veil/expedition-run.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {flightConfig} from '../src/veil/growth.js';
import {OXYGEN_ROUTES,OXYGEN_THERMAL,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';
import {RESOURCE_KEY,WATER_THERMAL_INTERRUPTION_REQUIREMENT,criticalInsightStarterCount,createResources} from '../src/veil/resources.js';
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
  const strain=[],overheats=[],coolantStarts=[],coolantNeeds=[];
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
      if(event.type==='overheat')overheats.push({time:run.time,x:run.player.x,y:run.player.y,heat:run.heat,driveInterrupted:event.driveInterrupted===true});
      if(event.type==='coolantStart')coolantStarts.push({time:run.time,y:run.player.y,heat:run.heat});
      if(event.type==='coolantNeed')coolantNeeds.push({time:run.time,y:run.player.y,heat:run.heat,exposure:event.exposure});
    }
    if(Math.hypot(run.player.x-target.x,run.player.y-target.y)<65&&waypoint===path.length-1)break;
  }
  assert.ok(frames<60*32,`${routeId} deterministic traversal must terminate`);
  return {run,frames,time:run.time,strain,overheats,coolantStarts,coolantNeeds,coolantSpent,combustionPackets,maxHeat,maxEnvironmentHeat,frontHalfMaxHeat,burstUsed:burstUses>0,burstUses,recoveryCoast};
}

function simulateDriveInterruptions(seconds=22){
  const run=createRun(deterministicMap(),flightConfig(),{fuel:{fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36}},predators:false});
  setCombustionHeld(run,true);
  const overheats=[],recoveries=[];
  for(let frame=0;frame<seconds/DT;frame++){
    for(const event of stepRun(run,{x:0,y:0},DT,{consumeCombustion:()=>true})){
      if(event.type==='overheat')overheats.push({time:run.time,driveInterrupted:event.driveInterrupted===true});
      if(event.type==='heatRecovered')recoveries.push(run.time);
    }
  }
  return {run,overheats,recoveries};
}

// Route C keeps its specialist thermal corridor, while the late shared belt
// crosses A/B/C so normal Oxygen progression can expose the DRIVE heat limit.
const routeC=route('oxygen-side'),routeB=route('oxygen-main'),routeA=route('oxygen-shortcut');
assert.deepEqual(routeC.knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
assert.deepEqual(routeB.knots,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
assert.deepEqual(routeA.knots,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
for(const y of [-9000,-9400,-9800,-10150,-10350]){
  const cx=oxygenRouteCenterAtY(routeC,y),bx=oxygenRouteCenterAtY(routeB,y),ax=oxygenRouteCenterAtY(routeA,y);
  assert.ok(environmentAt({x:cx,y}).heat>=environmentAt({x:bx,y}).heat,`Route C should not be cooler than B at ${y}`);
  assert.ok(environmentAt({x:cx,y}).heat>=environmentAt({x:ax,y}).heat,`Route C should not be cooler than A at ${y}`);
}
assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9000,2],[-9075,12],[-9140,32],[-9200,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);
assert.deepEqual(OXYGEN_THERMAL.sharedBelt.heatStops.map(stop=>[stop.y,stop.value]),[[-9200,0],[-9350,36],[-10380,36],[-10560,0],[-10670,0]]);
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-8950),y:-8950}).heat<5,'Route C entry stays cool/slightly warm');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9050),y:-9050}).heat<12,'Route C gives a short visible ramp before sustained heat');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9150),y:-9150}).heat>=30,'Route C reaches meaningful heat near the start of the side branch');
assert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9250),y:-9250}).heat,48,'Route C reaches the sustained max-heat section early');
assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-10050),y:-10050}).heat>=35,'Route C learning section remains high thermal');
const beltMain=environmentAt({x:oxygenRouteCenterAtY(routeB,-10050),y:-10050});
const beltShortcut=environmentAt({x:oxygenRouteCenterAtY(routeA,-10050),y:-10050});
assert.equal(beltMain.heat,36,'Route B crosses the shared late thermal belt');
assert.equal(beltShortcut.heat,36,'Route A crosses the shared late thermal belt');
assert.ok(beltMain.combustionHeatFactor>=2.7,'shared belt amplifies sustained combustion enough to become player-facing');
assert.equal(beltMain.coolantLearning,true,'Route B belt exposure is a valid coolant-learning site');
assert.ok(environmentAt({x:300,y:-9750}).heat<1,'Route B recovery pocket remains thermally quiet inside the shared belt');

// Scenario A: sustained dry DRIVE on Route C reaches thermal strain and a real
// interruption before the merge. The route remains physically open because the
// held input coasts/cools and resumes after recovery instead of becoming a hard gate.
const cDry=simulateRoute('oxygen-side',{combustion:true});
console.log('Route C dry thermal metric',JSON.stringify({time:cDry.time,maxHeat:cDry.maxHeat,finalHeat:cDry.run.heat,strain:cDry.strain,overheats:cDry.overheats,packets:cDry.combustionPackets},null,2));
assert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');
assert.equal(cDry.strain[0].combustion,true,'thermal strain crossing happens with COMBUSTION active');
assert.ok(cDry.strain[0].heat<THERMAL.hotThreshold+4,'HOT crossing must not jump straight toward overheat');
assert.ok(cDry.overheats.length>=1,'dry continuous DRIVE must be thermally interrupted before the merge');
assert.ok(cDry.overheats.every(event=>event.driveInterrupted),'dry Route C overheat is a DRIVE interruption');
assert.ok(cDry.overheats[0].time-cDry.strain[0].time>.75,'thermal strain must leave reaction time before overheat');
assert.ok(cDry.run.player.y<-10600,'coast/recovery/re-acceleration still reaches the network merge');
assert.ok(cDry.combustionPackets>0,'production methane/oxygen packets are consumed');

// Scenario B: the canonical eight-water starter engages the thermostat, spends
// coolant gradually and keeps held DRIVE continuous through the merge.
const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});
console.log('Route C wet thermal metric',JSON.stringify({time:cWet.time,maxHeat:cWet.maxHeat,finalHeat:cWet.run.heat,coolantSpent:cWet.coolantSpent,coolantLeft:cWet.run.fuel.coolant.amount,overheats:cWet.overheats},null,2));
assert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');
assert.ok(cWet.coolantSpent>0&&cWet.coolantSpent<8,'eight water molecules must help without being exhausted before the merge');
assert.ok(cWet.maxHeat<THERMAL.overheatThreshold,'H2O x8 keeps Route C below overheat');
assert.equal(cWet.overheats.length,0,'H2O x8 should sustain DRIVE through Route C');
assert.ok(cWet.run.player.y<-10600,'cooled continuous DRIVE reaches the network merge');
assert.ok(cWet.run.player.combustion,'COMBUSTION remains active at the merge with coolant');

// Continue the same held DRIVE into the recovery/deep handoff. The dry run has
// already been interrupted on Route C; water must still postpone any later overheat.
const cDryDeep=simulateRoute('oxygen-side',{combustion:true,continueDeep:true});
const cWetDeep=simulateRoute('oxygen-side',{combustion:true,coolant:8,continueDeep:true});
assert.ok(cDryDeep.overheats.length>=1,'dry sustained DRIVE should eventually overheat after Route C');
assert.ok(cDryDeep.overheats.every(event=>event.driveInterrupted),'DRIVE overheat is tagged as a propulsion interruption');
assert.ok(!cWetDeep.overheats.length||cWetDeep.overheats[0].time>cDryDeep.overheats[0].time+1,'H2O x8 should extend sustained DRIVE time by at least one second');

// Scenario C: environmental heat exists, but ordinary propulsion cannot emit
// the combustion-only thermal strain milestone or overheat on Route C.
const cAmbient=simulateRoute('oxygen-side');
assert.ok(cAmbient.maxEnvironmentHeat>10,'Route C has real ambient thermal exposure');
assert.equal(cAmbient.strain.length,0);assert.equal(cAmbient.overheats.length,0);assert.equal(cAmbient.run.heat,0);
assert.ok(cAmbient.run.player.y<-10600,'Route C remains passable without H2O or COMBUSTION');

// Scenario D: Route B stays the sustained-DRIVE route, but its late belt now
// exposes HOT strain and coolant need. Releasing DRIVE at the authored quiet
// pocket lowers peak heat, while H2O keeps continuous DRIVE comfortably below it.
const bDrive=simulateRoute('oxygen-main',{combustion:true});
assert.equal(bDrive.strain.length,1,'Route B continuous DRIVE now teaches thermal strain in the late belt');
assert.equal(bDrive.overheats.length,0,'Route B belt warns before becoming a mandatory interruption in the deterministic line');
assert.ok(bDrive.maxHeat>=THERMAL.hotThreshold,'Route B belt must reach player-facing HOT state');
assert.ok(bDrive.coolantNeeds.length>=1,'Route B belt must emit the existing coolant-learning experience');
const bCoast=simulateRoute('oxygen-main',{combustion:true,recoveryCoastSeconds:1.5});
assert.equal(bCoast.overheats.length,0,'Route B remains passable by releasing DRIVE and coasting');
assert.ok(bCoast.maxHeat<bDrive.maxHeat-8,'using the quiet pocket and normal cruise materially lowers peak heat');
const bWet=simulateRoute('oxygen-main',{combustion:true,coolant:8});
assert.equal(bWet.overheats.length,0,'H2O keeps Route B continuous DRIVE below overheat');
assert.ok(bWet.coolantSpent>0,'Route B shared belt now gives H2O a visible automatic-cooling job');
assert.ok(bWet.maxHeat<bDrive.maxHeat-12,'H2O creates a clear thermal margin on Route B');
assert.ok(environmentAt({x:300,y:-9750}).heat<1,'Route B recovery is still low ambient heat');

// Scenario E: Route A keeps its pressure/BURST identity. BURST itself remains
// thermally independent, while choosing sustained combustion through the same
// late belt carries the common heat constraint instead of replacing Route A's skill obstacle.
const aBurst=simulateRoute('oxygen-shortcut',{burstY:-9400});
assert.equal(aBurst.strain.length,0);assert.equal(aBurst.overheats.length,0);assert.ok(aBurst.burstUsed);
assert.ok(aBurst.burstUses<=2,'Route A traversal stays within the canonical two-burst starter');
assert.ok(aBurst.maxEnvironmentHeat>=32,'Route A physically crosses the shared thermal belt');
assert.equal(aBurst.run.heat,0,'BURST remains thermally independent despite ambient belt heat');
const aDrive=simulateRoute('oxygen-shortcut',{combustion:true});
assert.equal(aDrive.strain.length,1,'sustained DRIVE on Route A also exposes the shared thermal constraint');
assert.ok(aDrive.run.player.y<-10600,'thermal interruption never turns Route A into a hard gate');

// Scenario F: merge recovery is cool, then Deep Oxygen rises again. The
// relocated thermal challenge now reinforces the authored Deep Thermal route;
// Frontier still does not inherit the old broad network band.
const mergeHeat=environmentAt({x:120,y:-10800}).heat,deepWarm=environmentAt({x:180,y:-11200}).heat,challengeHeat=environmentAt({x:760,y:-11300}).heat,frontierHeat=environmentAt({x:140,y:-12020}).heat;
assert.ok(mergeHeat<1,'network merge has a low-heat recovery transition');
assert.ok(deepWarm>mergeHeat+10,'Deep Oxygen heat rises after the merge recovery');
assert.equal(challengeHeat,48,'Deep Thermal challenge supplies heat=48 without additive stacking');
assert.equal(frontierHeat,50,'Frontier approach now carries the shared thermal wall before CHO completion');
const thermalChallenge=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='thermal');
assert.deepEqual(thermalChallenge,{id:'thermal',bottom:-11160,top:-11440,width:260,centerX:760,centerY:-11300,rewards:['ethylene-glycol','n-hexane']});

// Repeated no-coolant DRIVE demonstrates the intended stop -> recover -> reuse
// sequence. A single held input still requires two distinct thermal cycles.
const driveCycles=simulateDriveInterruptions();
assert.equal(WATER_THERMAL_INTERRUPTION_REQUIREMENT,2,'H2O should require two clear DRIVE interruptions');
assert.ok(driveCycles.overheats.length>=WATER_THERMAL_INTERRUPTION_REQUIREMENT,'sustained dry DRIVE should produce repeated interruptions');
assert.ok(driveCycles.overheats.slice(0,WATER_THERMAL_INTERRUPTION_REQUIREMENT).every(event=>event.driveInterrupted),'only active DRIVE overheat cycles are progression-relevant');
assert.ok(driveCycles.recoveries.some(time=>time>driveCycles.overheats[0].time&&time<driveCycles.overheats[1].time),'second interruption requires a completed recovery and DRIVE reuse');

// Production experience -> persistent progression. HOT alone and the first
// actual interruption are insufficient; the second interruption unlocks H2O.
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
assert.ok(!resources.progressionInsightCandidates().includes('water'),'first thermal strain does not reveal H2O');
assert.equal(resources.recordDriveThermalInterruption(),true);
assert.equal(resources.state.progress.driveThermalInterruptions,1);
assert.ok(!resources.progressionInsightCandidates().includes('water'),'first DRIVE interruption is still insufficient');
assert.equal(resources.recordDriveThermalInterruption(),true);
assert.equal(resources.state.progress.driveThermalInterruptions,WATER_THERMAL_INTERRUPTION_REQUIREMENT);
assert.ok(!resources.progressionInsightCandidates().includes('water'),'generic DRIVE interruptions alone must not reveal H2O');
assert.equal(resources.recordCoolantNeedExperience(),true);
assert.ok(resources.progressionInsightCandidates().includes('water'),'sustained COMBUSTION in the authored high-thermal zone makes H2O insight ready');

// Current v8 saves preserve thermal progression exactly. Pre-v8 saves are intentionally
// incompatible with Molecule DB v2 and reset rather than partially migrating fields.
const currentStorage=memory(),currentState=resources.snapshot();currentStorage.setItem(RESOURCE_KEY,JSON.stringify(currentState));
const reloadedCurrent=createResources({storage:currentStorage});assert.equal(reloadedCurrent.blocked,false);assert.equal(reloadedCurrent.state.progress.driveThermalInterruptions,WATER_THERMAL_INTERRUPTION_REQUIREMENT,'current save retains DRIVE interruption telemetry');assert.equal(reloadedCurrent.state.progress.coolantNeedExperienced,true,'current save retains coolant-learning progression');assert.ok(reloadedCurrent.progressionInsightCandidates().includes('water'),'current save retains H2O readiness');
const legacyStorage=memory(),legacyState={...currentState,schemaVersion:7};legacyStorage.setItem(RESOURCE_KEY,JSON.stringify(legacyState));
const legacyResources=createResources({storage:legacyStorage});assert.equal(legacyResources.blocked,false);assert.equal(legacyResources.state.progress.driveThermalInterruptions,0,'pre-v8 save resets thermal progression');assert.equal(legacyResources.state.progress.coolantNeedExperienced,false,'pre-v8 save resets coolant-learning progression');assert.ok(!legacyResources.state.recipes.includes('water'),'pre-v8 recipe progress is intentionally discarded');

console.log('Oxygen thermal progression passed',JSON.stringify({
  routeCDry:{heat:+cDry.run.heat.toFixed(2),strainY:+cDry.strain[0].y.toFixed(1),time:+cDry.time.toFixed(2),overheats:cDry.overheats.length},
  routeCWater8:{heat:+cWet.run.heat.toFixed(2),waterUsed:cWet.coolantSpent,waterLeft:cWet.run.fuel.coolant.amount,time:+cWet.time.toFixed(2),overheats:cWet.overheats.length},
  routeB:{heat:+bDrive.run.heat.toFixed(2),peak:+bDrive.maxHeat.toFixed(2),time:+bDrive.time.toFixed(2),coolantNeeds:bDrive.coolantNeeds.length,overheats:bDrive.overheats.length},
  routeBCoast:{peak:+bCoast.maxHeat.toFixed(2),coast:+bCoast.recoveryCoast.toFixed(2)},
  routeBWater8:{peak:+bWet.maxHeat.toFixed(2),waterUsed:bWet.coolantSpent,overheats:bWet.overheats.length},
  routeADrive:{peak:+aDrive.maxHeat.toFixed(2),overheats:aDrive.overheats.length},
  driveCycles:{overheats:driveCycles.overheats.length,recoveries:driveCycles.recoveries.length,first:driveCycles.overheats[0]?.time,second:driveCycles.overheats[1]?.time},
  deep:{mergeHeat:+mergeHeat.toFixed(2),deepWarm:+deepWarm.toFixed(2),challengeHeat,frontierHeat:+frontierHeat.toFixed(2)},
}));