import test from 'node:test';
import assert from 'node:assert/strict';
import {VEIL} from '../src/veil/config.js';
import {createRun,setCombustionHeld,stepRun} from '../src/veil/engine.js';
import {DRIVES,GROWTH,MOLECULE_USES,tankCapacity} from '../src/veil/growth.js';
import {HYDROGEN_REVISIT_ROUTE,createMap,inventoryDepletion} from '../src/veil/map.js';
import {CARBON_REVISIT_ROUTE,createUniverse} from '../src/veil/universe.js';
import {OXYGEN_ROUTES} from '../src/veil/oxygen-routes.js';
import {combustionPacketFor,performanceFor} from '../src/veil/molecule-roles.js';
import {WATER_THERMAL_INTERRUPTION_REQUIREMENT,criticalInsightStarterCount} from '../src/veil/resources.js';
import {simulate} from '../scripts/simulate-expedition.mjs';

const SEED=1,BASELINE_REVISIT_VALUE=VEIL.dustValue,DUST_PER_H=GROWTH.dustPerAtom.H;
const atomCount=(id,element)=>MOLECULE_USES[id].atoms.filter(atom=>atom===element).length;
const hCost=(id,count)=>atomCount(id,'H')*count;
const elementCost=(fuelUsed,element)=>Object.entries(fuelUsed??{}).reduce((sum,[id,count])=>sum+(MOLECULE_USES[id]?atomCount(id,element)*count:0),0);
const routeLength=route=>route.points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-route.points[index].x,point.y-route.points[index].y),0);
const routeUnits=(map,id,element='H')=>map.dust.filter(dust=>dust.route===id&&(dust.element??'H')===element).reduce((sum,dust)=>sum+dust.value,0);
const elementUnits=(map,element)=>map.dust.filter(dust=>(dust.element??'H')===element).reduce((sum,dust)=>sum+dust.value,0);
const atomReward=(units,element='H')=>units/(GROWTH.dustPerAtom[element]??DUST_PER_H);
const normalizedAtoms=(units,length)=>atomReward(units)/length*1000;
const rounded=value=>Math.round(value*100)/100;

function burn(seconds,{coolant=null}={}){
  const map={seed:SEED,dust:[],fields:[],labels:[],routes:[]};
  const fuel={
    fuel:{molecule:'methane',amount:performanceFor('methane','fuel').capacity},
    oxidizer:{molecule:'oxygen',amount:performanceFor('oxygen','oxidizer').capacity},
    coolant:{molecule:coolant,amount:coolant?performanceFor(coolant,'coolant').capacity:0},
  };
  const run=createRun(map,VEIL,{fuel,predators:false});setCombustionHeld(run,true);
  for(let frame=0;frame<seconds*60;frame++)stepRun(run,{x:1,y:0},1/60,{consumeCombustion:()=>true,consumeCoolant:()=>true});
  return run;
}

const scenarioNet=report=>({
  H:report.collected.H-elementCost(report.fuelUsed,'H'),
  C:report.collected.C-elementCost(report.fuelUsed,'C'),
  O:report.collected.O-elementCost(report.fuelUsed,'O'),
});

const scenarios=Object.fromEntries([
  ['A-normal',simulate({name:'A-normal',start:'veil',routes:['entry','safe','detour','return'],seconds:30,seed:20260913})],
  ['B-moderate-burst',simulate({name:'B-moderate-burst',start:'carbon',routes:['carbon-loop'],seconds:55,burst:'danger',loop:true,seed:20260913})],
  ['C-drive-heavy',simulate({name:'C-drive-heavy',start:'oxygen',routes:['oxygen-main'],seconds:18,drive:'always',loop:true,seed:20260913})],
  ['D-drive-coolant-heavy',simulate({name:'D-drive-coolant-heavy',start:'oxygen',routes:['oxygen-main'],seconds:18,drive:'always',coolant:'water',loop:true,seed:20260913})],
].map(([name,report])=>[name,{report,net:scenarioNet(report)}]));

test('canonical molecule definitions determine H2, CH4 and H2O H demand',()=>{
  assert.deepEqual(MOLECULE_USES.hydrogen.atoms,['H','H']);
  assert.deepEqual(MOLECULE_USES.methane.atoms,['C','H','H','H','H']);
  assert.deepEqual(MOLECULE_USES.oxygen.atoms,['O','O']);
  assert.deepEqual(MOLECULE_USES.water.atoms,['O','H','H']);

  const burst=performanceFor('hydrogen','propellant'),methane=performanceFor('methane','fuel'),water=performanceFor('water','coolant'),packet=combustionPacketFor('methane',{baseSeconds:DRIVES.combustion.packetSeconds});
  assert.equal(hCost('hydrogen',burst.moleculesPerBurst),80);
  assert.equal(burst.capacity/burst.moleculesPerBurst,3);
  assert.equal(hCost('hydrogen',burst.capacity),240);
  assert.equal(hCost('methane',methane.capacity),72);
  assert.equal(packet.fuelAmount,1);assert.equal(packet.oxygenAmount,2);assert.equal(packet.seconds,2);
  assert.equal(methane.capacity*packet.oxygenAmount,performanceFor('oxygen','oxidizer').capacity);
  assert.equal(hCost('water',water.capacity),160);
  assert.equal(tankCapacity('coolant','water'),80);
});

test('H revisit is a post-DRIVE local recovery pocket rather than fresh-save farm geometry',()=>{
  assert.deepEqual(HYDROGEN_REVISIT_ROUTE.knots,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  const pre=createMap(SEED,{H:0,C:0,O:0});
  assert.equal(pre.routes.some(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),false);
  const capabilities={combustionDrive:true},map=createMap(SEED,{H:0,C:0,O:0},{capabilities}),route=map.routes.find(item=>item.id===HYDROGEN_REVISIT_ROUTE.id),pocket=map.dust.filter(item=>item.route==='hydrogen-revisit-pocket');
  assert.ok(route&&pocket.length>0);
  const hUnits=pocket.filter(item=>item.element==='H').reduce((sum,item)=>sum+item.value,0),cUnits=pocket.filter(item=>item.element==='C').reduce((sum,item)=>sum+item.value,0);
  assert.ok(hUnits>cUnits*3,'localized revisit reward stays H-dominant');
  const ordinary=Math.max(...['safe','detour'].map(id=>{const candidate=map.routes.find(item=>item.id===id);return normalizedAtoms(routeUnits(map,id),routeLength(candidate));}));
  const revisitLine=normalizedAtoms(routeUnits(map,HYDROGEN_REVISIT_ROUTE.id),routeLength(route));
  assert.ok(revisitLine<=ordinary*1.2,'route-wide dust is no longer the high-density reward');
  const highStock=createMap(SEED,{H:800,C:400,O:0},{capabilities});
  assert.ok(highStock.routes.some(item=>item.id===HYDROGEN_REVISIT_ROUTE.id));
  assert.ok(highStock.currents.some(current=>current.id==='hydrogen-revisit-current'));
  assert.equal(highStock.dust.filter(item=>item.route==='hydrogen-revisit-pocket').length,0,'high stock suppresses the optional pocket without relocking terrain');
});

test('phase demand separates progression H from optional propulsion H',()=>{
  const driveOnly=burn(20),cooled=burn(20,{coolant:'water'}),burstH=hCost('hydrogen',performanceFor('hydrogen','propellant').moleculesPerBurst);
  assert.ok(driveOnly.telemetry.overheatEvents>0,'uncoolled sustained DRIVE remains thermally interrupted');
  assert.equal(cooled.telemetry.overheatEvents,0,'water keeps the 20 s reference burn below overheat');
  assert.ok((cooled.telemetry.fuelUsed.water??0)>0,'reference thermal expedition consumes water');

  const phaseDemand=[
    {phase:'1 pre-H2',nextProgressionH:hCost('hydrogen',criticalInsightStarterCount('hydrogen')),ordinaryAbilityH:0},
    {phase:'2 H2 / C',nextProgressionH:hCost('methane',criticalInsightStarterCount('methane')),ordinaryAbilityH:burstH},
    {phase:'3 CH4 / pre-O2',nextProgressionH:0,ordinaryAbilityH:burstH},
    {phase:'4 O2 / DRIVE',nextProgressionH:hCost('water',criticalInsightStarterCount('water')),ordinaryAbilityH:elementCost(driveOnly.telemetry.fuelUsed,'H')},
    {phase:'5 H2O / coolant',nextProgressionH:0,ordinaryAbilityH:elementCost(cooled.telemetry.fuelUsed,'H')},
    {phase:'6 Frontier+',nextProgressionH:0,ordinaryAbilityH:elementCost(cooled.telemetry.fuelUsed,'H')},
  ];
  assert.deepEqual(phaseDemand.map(row=>row.nextProgressionH),[160,16,0,16,0,0]);
  assert.equal(WATER_THERMAL_INTERRUPTION_REQUIREMENT,2,'H2O progression timing is unchanged');
  assert.ok(phaseDemand[4].ordinaryAbilityH>phaseDemand[3].ordinaryAbilityH,'coolant adds H demand only when actually used');
  console.log('H economy phase demand',JSON.stringify({phaseDemand,drive20s:{fuelUsed:driveOnly.telemetry.fuelUsed,hAtoms:elementCost(driveOnly.telemetry.fuelUsed,'H'),oAtoms:elementCost(driveOnly.telemetry.fuelUsed,'O')},driveCoolant20s:{fuelUsed:cooled.telemetry.fuelUsed,hAtoms:elementCost(cooled.telemetry.fuelUsed,'H'),oAtoms:elementCost(cooled.telemetry.fuelUsed,'O')}},null,2));
});

test('normal progression scenarios do not require the H revisit, while heavy use can still spend H',()=>{
  const A=scenarios['A-normal'],B=scenarios['B-moderate-burst'],C=scenarios['C-drive-heavy'],D=scenarios['D-drive-coolant-heavy'],burstH=hCost('hydrogen',performanceFor('hydrogen','propellant').moleculesPerBurst);
  const summary=Object.fromEntries(Object.entries(scenarios).map(([name,{report,net}])=>[name,{duration:report.duration,collected:report.collected,fuelUsed:report.fuelUsed,burstUses:report.burstUses,combustionSeconds:report.combustionSeconds,net}]));
  console.log('H economy scenarios',JSON.stringify(summary,null,2));

  for(const {report} of [A,B,C,D])assert.equal(report.returnType,'voluntary');
  assert.equal(A.report.fuelUsed.hydrogen??0,0);assert.ok(A.net.H>0,'normal navigation should gain H');
  assert.ok(B.report.burstUses>0&&B.report.burstUses<=(performanceFor('hydrogen','propellant').capacity/performanceFor('hydrogen','propellant').moleculesPerBurst));
  assert.ok(B.net.H>=-burstH*.25,`moderate BURST may run slightly H-negative, but not enough to justify an H-only refill (${B.net.H} H)`);
  assert.ok((C.report.fuelUsed.methane??0)>0);assert.equal(C.report.fuelUsed.water??0,0);
  assert.ok((D.report.fuelUsed.water??0)>0);assert.ok(elementCost(D.report.fuelUsed,'H')>elementCost(C.report.fuelUsed,'H'),'DRIVE + coolant deliberately raises H spend');
});

test('C/O economy and route geometry remain outside the H-only balance change',()=>{
  assert.equal(CARBON_REVISIT_ROUTE.value,GROWTH.density.carbon.value);
  assert.deepEqual(OXYGEN_ROUTES.map(({id,lanes,value})=>({id,lanes,value})),[
    {id:'oxygen-shortcut',lanes:1,value:2},
    {id:'oxygen-side',lanes:4,value:3},
    {id:'oxygen-main',lanes:2,value:2},
  ]);
  const universe=createUniverse(SEED,{H:0,C:0,O:0},{capabilities:{combustionDrive:true}}),hRevisit=routeUnits(universe,HYDROGEN_REVISIT_ROUTE.id,'H');
  assert.ok(hRevisit>0);assert.equal(routeUnits(universe,HYDROGEN_REVISIT_ROUTE.id,'C'),0);assert.equal(routeUnits(universe,HYDROGEN_REVISIT_ROUTE.id,'O'),0);

  const auditedRoutes=['entry','safe','risk','detour','hydrogen-revisit','carbon-main','carbon-return','carbon-revisit','oxygen-entry','oxygen-main','oxygen-side','oxygen-deep-safe','oxygen-deep-thermal','horizon'];
  const routeReport=Object.fromEntries(auditedRoutes.map(id=>{const route=universe.routes.find(item=>item.id===id),units=routeUnits(universe,id,'H');return [id,{length:rounded(routeLength(route)),spacing:route.spacing??(route.kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing),lanes:route.authoredLanes??route.lanes??1,value:route.value??VEIL.dustValue,dustUnits:units,hAtoms:rounded(atomReward(units)),hPer1000:rounded(normalizedAtoms(units,routeLength(route)))}];}));
  const clusterH=universe.dust.filter(dust=>dust.cluster!==undefined&&dust.element==='H').reduce((sum,dust)=>sum+dust.value,0),fieldTotals=Object.fromEntries(['H','C','O'].map(element=>[element,rounded(atomReward(elementUnits(universe,element),element))]));
  const depletedTotals=Object.fromEntries([0,300,600,750].map(H=>{const field=createUniverse(SEED,{H,C:0,O:0});return [H,rounded(atomReward(elementUnits(field,'H')))];}));
  console.log('H economy route audit',JSON.stringify({routeReport,otherH:{clusterAtoms:rounded(atomReward(clusterH)),fieldTotals},depletion:{levels:{H0:inventoryDepletion({H:0},'H'),H300:rounded(inventoryDepletion({H:300},'H')),H600:rounded(inventoryDepletion({H:600},'H')),H750:rounded(inventoryDepletion({H:750},'H'))},aggregateHAtoms:depletedTotals}},null,2));
});
