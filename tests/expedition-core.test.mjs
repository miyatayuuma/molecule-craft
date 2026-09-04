import assert from 'node:assert/strict';
import {EXPEDITION,VEIL} from '../src/veil/config.js';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {DRIVES,MOLECULE_USES,flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';
import {completeExpeditionTelemetry,logExpeditionTelemetry} from '../src/veil/telemetry.js';
import {performanceFor} from '../src/veil/molecule-roles.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const emptyMap=()=>({seed:17,dust:[],fields:[],labels:[],routes:[]});
const H2=performanceFor('hydrogen','propellant');
const emptyCoolant={molecule:null,amount:0};
const fullLoadout={propellant:{molecule:'hydrogen',amount:H2.capacity},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:emptyCoolant};

// Expedition tanks are filled directly from BASE STOCK before launch.
const storage=memory(),resources=createResources({storage});
for(const id of ['hydrogen','methane','oxygen'])resources.discover(id);
Object.assign(resources.state.elements,{H:312,C:18,O:72});resources.save();
assert.deepEqual(resources.prepareExpedition(),{propellant:{molecule:null,amount:0},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0},coolant:emptyCoolant});
assert.ok(resources.fillTankFromElements('propellant','hydrogen',120));assert.ok(resources.fillTankFromElements('fuel','methane',18));assert.ok(resources.fillTankFromElements('oxidizer','oxygen',36));
assert.deepEqual(resources.prepareExpedition(),fullLoadout);
assert.deepEqual(resources.state.elements,{H:0,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0},'Direct filling consumes only the required atoms');

const fuelRun=createRun(emptyMap(),VEIL,{fuel:resources.prepareExpedition(),predators:false});
const baseBefore={...resources.state.elements},hydrogenBefore=resources.state.tanks.propellant.amount;
assert.ok(beginBurst(fuelRun,()=>resources.consumeBoost()));assert.equal(fuelRun.fuel.propellant.amount,H2.capacity-H2.moleculesPerBurst);assert.equal(resources.state.tanks.propellant.amount,hydrogenBefore-H2.moleculesPerBurst);
assert.equal(beginBurst(fuelRun,()=>resources.consumeDrive('hydrogen')),false,'A repeated press during BURST/cooldown cannot double-spend');
for(let used=1;used<3;used++){while(fuelRun.player.cooldown>0)stepRun(fuelRun,{x:0,y:-1},1/60);assert.ok(beginBurst(fuelRun,()=>resources.consumeBoost()));}
assert.equal(fuelRun.fuel.propellant.amount,0);assert.equal(beginBurst(fuelRun,()=>resources.consumeBoost()),false);assert.equal(resources.state.tanks.propellant.amount,0);assert.deepEqual(resources.state.elements,baseBefore,'BURST never spends BASE STOCK');

// A combustion packet is bought only when needed. Releasing the control
// preserves its remaining burn time and consumes no additional molecules.
const driveRun=createRun(emptyMap(),VEIL,{fuel:{methane:3,oxygen:6},predators:false}),tankBefore={methane:resources.state.tanks.fuel.amount,oxygen:resources.state.tanks.oxidizer.amount};let packets=0;
setCombustionHeld(driveRun,true);for(let i=0;i<60;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:packet=>{packets++;return resources.consumeCombustion(packet);}});
assert.equal(packets,1);assert.ok(driveRun.driveBuffer>.9&&driveRun.driveBuffer<1.1);const preserved=driveRun.driveBuffer;
setCombustionHeld(driveRun,false);for(let i=0;i<300;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:()=>{packets++;return false;}});assert.equal(packets,1);assert.equal(driveRun.driveBuffer,preserved);
setCombustionHeld(driveRun,true);for(let i=0;i<310;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:packet=>{packets++;return resources.consumeCombustion(packet);}});assert.equal(packets,3);assert.equal(driveRun.fuel.fuel.amount,0);assert.equal(driveRun.fuel.oxidizer.amount,0);assert.equal(resources.state.tanks.fuel.amount,tankBefore.methane-3);assert.equal(resources.state.tanks.oxidizer.amount,tankBefore.oxygen-6);assert.deepEqual(resources.state.elements,baseBefore);

// FLOW/CHAIN changes feedback only. Identical steering produces an identical
// path and pickup result regardless of its displayed count.
const dust={id:0,x:0,y:-100,angle:-Math.PI/2,value:1,kind:'normal',ready:0};
const low=createRun({...emptyMap(),dust:[{...dust}]},VEIL,{predators:false}),high=createRun({...emptyMap(),dust:[{...dust}]},VEIL,{predators:false});high.chain=90;high.chainTime=VEIL.chainSeconds;
for(let i=0;i<60;i++){stepRun(low,{x:0,y:-1},1/60);stepRun(high,{x:0,y:-1},1/60);}
assert.equal(high.player.x,low.player.x);assert.equal(high.player.y,low.player.y);assert.equal(high.player.speed,low.player.speed);assert.equal(high.collected,low.collected);

// Pursuit uses a wide neutral field so the measurements isolate propulsion.
const chaseConfig={...flightConfig(),bounds:{left:-20000,right:40000,top:-20000,bottom:20000},spawn:{x:0,y:0,angle:0},gate:{x:99999,y:99999,width:1,height:1}};
const chase=()=>createRun(emptyMap(),chaseConfig,{fuel:fullLoadout});
const advance=(run,seconds,systems={})=>{for(let i=0;i<seconds*60&&!run.captured;i++)stepRun(run,{x:1,y:0},1/60,systems);};
const safe=chase();advance(safe,EXPEDITION.safeSeconds-.1);assert.equal(safe.eaters.length,0,'The opening of every expedition is safe');advance(safe,11);assert.equal(safe.eaters.length,1);assert.ok(safe.nearestEater>EXPEDITION.eaterWarningRadius);
assert.equal(EXPEDITION.anchorLockSeconds,.8);assert.ok(EXPEDITION.eaterSpeed*EXPEDITION.anchorLockSeconds<EXPEDITION.eaterDangerRadius,'A lock started outside the danger radius is mechanically fair');assert.ok(DRIVES.hydrogen.boostSpeed*DRIVES.hydrogen.boostSeconds>EXPEDITION.eaterSpeed*EXPEDITION.anchorLockSeconds*3,'BURST creates materially more separation than one lock interval consumes');

const normal=chase();advance(normal,240);assert.ok(normal.captured);assert.ok(normal.time>EXPEDITION.safeSeconds+20);assert.ok(normal.eaters.length>=3,'Long stays add pursuers instead of scaling one enemy forever');

const emergency=chase();while(!emergency.eaters.length)advance(emergency,1/60);while(emergency.nearestEater>300&&!emergency.captured)advance(emergency,1/60);const emergencyBefore=emergency.nearestEater;
assert.ok(beginBurst(emergency,()=>true));advance(emergency,.8);assert.ok(emergency.nearestEater>emergencyBefore+250,`BURST should create emergency space: ${emergencyBefore} -> ${emergency.nearestEater}`);assert.equal(emergency.fuel.propellant.amount,H2.capacity-H2.moleculesPerBurst);

const cruising=chase();while(!cruising.eaters.length)advance(cruising,1/60);const cruisingBefore=cruising.nearestEater;let cruisePackets=0;setCombustionHeld(cruising,true);advance(cruising,8,{consumeCombustion:()=>{cruisePackets++;return true;}});
assert.equal(cruising.eaters.length,1);assert.equal(cruisePackets,4);assert.equal(cruising.captured,false);assert.ok(cruising.nearestEater>cruisingBefore+1000,`DRIVE must truly outrun one eater: ${cruisingBefore} -> ${cruising.nearestEater}`);

const finite=chase();let finitePackets=0,started=false;while(!finite.captured&&finite.time<180){if(finite.eaters.length&&!started){started=true;setCombustionHeld(finite,true);}stepRun(finite,{x:1,y:0},1/60,{consumeCombustion:()=>{finitePackets++;return true;}});}
assert.equal(finitePackets,EXPEDITION.methaneCapacity);assert.ok(finite.captured);assert.ok(finite.eaters.length>=2,'Finite cruise fuel cannot erase the eventual return decision');

// Voluntary return keeps all new dust. Capture applies a tunable loss only to
// this run; old atoms, recipes and permanent discovery remain safe.
function settlement(captured){const r=createResources({storage:memory()});r.collect({H:10,C:2,O:3},0);r.discover('hydrogen');r.findElement('O');r.save();const before=r.snapshot(),result=r.settleExpedition({H:20,C:6,O:3},44,captured);return {r,before,result};}
const voluntary=settlement(false);assert.deepEqual(voluntary.result.lost,{H:0,C:0,O:0});assert.deepEqual(voluntary.result.kept,{H:20,C:6,O:3});
const captured=settlement(true);assert.equal(captured.result.rate,EXPEDITION.captureLoss);assert.deepEqual(captured.result.lost,{H:3,C:1,O:0});assert.equal(Object.values(captured.result.lost).reduce((sum,n)=>sum+n,0),Math.floor(29*EXPEDITION.captureLoss));assert.deepEqual(captured.result.atoms,{H:5,C:1,O:1});assert.deepEqual(captured.r.state.recipes,captured.before.recipes);assert.ok(captured.r.state.progress.foundElements.includes('O'));assert.ok(captured.r.state.elements.H>=captured.before.elements.H);
const failingData=new Map();let rejectWrites=false;const failingStorage={getItem:key=>failingData.get(key)??null,setItem:(key,value)=>{if(rejectWrites)throw Error('quota');failingData.set(key,value);},removeItem:key=>failingData.delete(key)},failing=createResources({storage:failingStorage});failing.collect(10,0);failing.save();const beforeFailure=failing.snapshot();rejectWrites=true;assert.equal(failing.settleExpedition({H:30,C:0,O:0},12,true),null);assert.deepEqual(failing.state.elements,beforeFailure.elements,'An interrupted settlement cannot partially bank cargo');assert.deepEqual(failing.state.dust,beforeFailure.dust);

assert.equal(DRIVES.hydrogen.type,'burst');assert.equal(DRIVES.combustion.type,'continuous');assert.ok(DRIVES.hydrogen.boostSeconds<DRIVES.combustion.packetSeconds);assert.equal(MOLECULE_USES.water.role,'coolant');assert.equal(DRIVES.water,undefined);
const report=completeExpeditionTelemetry(cruising,{captured:false,result:{lost:{H:0,C:0,O:0}}});assert.equal(report.returnType,'voluntary');assert.equal(report.fuelUsed.methane,4);assert.equal(report.fuelUsed.oxygen,8);assert.ok(report.combustionSeconds>7.9);assert.equal(report.maxEaters,1);
let debugReport=null;assert.equal(logExpeditionTelemetry(report,{location:{search:''},logger:value=>{debugReport=value;}}),false);assert.equal(debugReport,null);assert.equal(logExpeditionTelemetry(report,{location:{search:'?expeditionDebug=1'},logger:(label,value)=>{debugReport={label,value};}}),true);assert.equal(debugReport.value,report);
console.log('Expedition Core passed: separate capped tanks, short BURST, hold/release combustion, cosmetic FLOW, safe escalation, fixed-speed pursuit, emergency separation, sustained escape, eventual capture and cargo-only loss.');
