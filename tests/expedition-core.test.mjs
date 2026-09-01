import assert from 'node:assert/strict';
import {EXPEDITION,VEIL} from '../src/veil/config.js';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {DRIVES,MOLECULE_USES,flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const emptyMap=()=>({seed:17,dust:[],fields:[],labels:[],routes:[]});

// Expedition capacities describe usable packets, not a cap on base inventory.
const storage=memory(),resources=createResources({storage});
for(const id of ['hydrogen','methane','oxygen'])resources.discover(id);
Object.assign(resources.state.molecules,{hydrogen:20,methane:20,oxygen:40});resources.save();
assert.deepEqual(resources.prepareExpedition(),{hydrogen:EXPEDITION.hydrogenCapacity,combustion:EXPEDITION.combustionCapacity});
assert.equal(resources.state.molecules.hydrogen,20,'Loading a sortie must not discard unused base fuel');

const fuelRun=createRun(emptyMap(),VEIL,{fuel:resources.prepareExpedition(),predators:false});
const hydrogenBefore=resources.state.molecules.hydrogen;
assert.ok(beginBurst(fuelRun,()=>resources.consumeDrive('hydrogen')));assert.equal(fuelRun.fuel.hydrogen,EXPEDITION.hydrogenCapacity-1);assert.equal(resources.state.molecules.hydrogen,hydrogenBefore-1);
assert.equal(beginBurst(fuelRun,()=>resources.consumeDrive('hydrogen')),false,'A repeated press during BURST/cooldown cannot double-spend');
for(let used=1;used<EXPEDITION.hydrogenCapacity;used++){for(let i=0;i<70;i++)stepRun(fuelRun,{x:0,y:-1},1/60);assert.ok(beginBurst(fuelRun,()=>resources.consumeDrive('hydrogen')));}
assert.equal(fuelRun.fuel.hydrogen,0);assert.equal(beginBurst(fuelRun,()=>resources.consumeDrive('hydrogen')),false);assert.equal(resources.state.molecules.hydrogen,hydrogenBefore-EXPEDITION.hydrogenCapacity);

// A combustion packet is bought only when needed. Releasing the control
// preserves its remaining burn time and consumes no additional molecules.
const driveRun=createRun(emptyMap(),VEIL,{fuel:{combustion:3},predators:false});let packets=0;
setCombustionHeld(driveRun,true);for(let i=0;i<120;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:()=>{packets++;return resources.consumeDrive('combustion');}});
assert.equal(packets,1);assert.ok(driveRun.driveBuffer>1.9&&driveRun.driveBuffer<2.1);const preserved=driveRun.driveBuffer;
setCombustionHeld(driveRun,false);for(let i=0;i<300;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:()=>{packets++;return false;}});assert.equal(packets,1);assert.equal(driveRun.driveBuffer,preserved);
setCombustionHeld(driveRun,true);for(let i=0;i<370;i++)stepRun(driveRun,{x:1,y:0},1/60,{consumeCombustion:()=>{packets++;return resources.consumeDrive('combustion');}});assert.equal(packets,3);assert.equal(driveRun.fuel.combustion,0);

// FLOW/CHAIN changes feedback only. Identical steering produces an identical
// path and pickup result regardless of its displayed count.
const dust={id:0,x:0,y:-100,angle:-Math.PI/2,value:1,kind:'normal',ready:0};
const low=createRun({...emptyMap(),dust:[{...dust}]},VEIL,{predators:false}),high=createRun({...emptyMap(),dust:[{...dust}]},VEIL,{predators:false});high.chain=90;high.chainTime=VEIL.chainSeconds;
for(let i=0;i<60;i++){stepRun(low,{x:0,y:-1},1/60);stepRun(high,{x:0,y:-1},1/60);}
assert.equal(high.player.x,low.player.x);assert.equal(high.player.y,low.player.y);assert.equal(high.player.speed,low.player.speed);assert.equal(high.collected,low.collected);

// Pursuit uses a wide neutral field so the measurements isolate propulsion.
const chaseConfig={...flightConfig(),bounds:{left:-20000,right:40000,top:-20000,bottom:20000},spawn:{x:0,y:0,angle:0},gate:{x:99999,y:99999,width:1,height:1}};
const chase=()=>createRun(emptyMap(),chaseConfig,{fuel:{hydrogen:EXPEDITION.hydrogenCapacity,combustion:EXPEDITION.combustionCapacity}});
const advance=(run,seconds,systems={})=>{for(let i=0;i<seconds*60&&!run.captured;i++)stepRun(run,{x:1,y:0},1/60,systems);};
const safe=chase();advance(safe,EXPEDITION.safeSeconds-.1);assert.equal(safe.eaters.length,0,'The opening of every expedition is safe');advance(safe,11);assert.equal(safe.eaters.length,1);assert.ok(safe.nearestEater>EXPEDITION.eaterWarningRadius);

const normal=chase();advance(normal,120);assert.ok(normal.captured);assert.ok(normal.time>EXPEDITION.safeSeconds+20);assert.ok(normal.eaters.length>=2,'Long stays add pursuers instead of scaling one enemy forever');

const emergency=chase();while(!emergency.eaters.length)advance(emergency,1/60);while(emergency.nearestEater>300&&!emergency.captured)advance(emergency,1/60);const emergencyBefore=emergency.nearestEater;
assert.ok(beginBurst(emergency,()=>true));advance(emergency,.8);assert.ok(emergency.nearestEater>emergencyBefore+250,`BURST should create emergency space: ${emergencyBefore} -> ${emergency.nearestEater}`);assert.equal(emergency.fuel.hydrogen,EXPEDITION.hydrogenCapacity-1);

const cruising=chase();while(!cruising.eaters.length)advance(cruising,1/60);const cruisingBefore=cruising.nearestEater;let cruisePackets=0;setCombustionHeld(cruising,true);advance(cruising,8,{consumeCombustion:()=>{cruisePackets++;return true;}});
assert.equal(cruising.eaters.length,1);assert.equal(cruisePackets,2);assert.equal(cruising.captured,false);assert.ok(cruising.nearestEater>cruisingBefore+1000,`DRIVE must truly outrun one eater: ${cruisingBefore} -> ${cruising.nearestEater}`);

const finite=chase();let finitePackets=0,started=false;while(!finite.captured&&finite.time<180){if(finite.eaters.length&&!started){started=true;setCombustionHeld(finite,true);}stepRun(finite,{x:1,y:0},1/60,{consumeCombustion:()=>{finitePackets++;return true;}});}
assert.equal(finitePackets,EXPEDITION.combustionCapacity);assert.ok(finite.captured);assert.ok(finite.eaters.length>=2,'Finite cruise fuel cannot erase the eventual return decision');

// Voluntary return keeps all new dust. Capture applies a tunable loss only to
// this run; old atoms, molecules, recipes and permanent discovery remain safe.
function settlement(captured){const r=createResources({storage:memory()});r.collect({H:10,C:2,O:3},0);r.discover('hydrogen');r.storeMolecule('hydrogen',2);r.findElement('O');r.save();const before=r.snapshot(),result=r.settleExpedition({H:20,C:6,O:3},44,captured);return {r,before,result};}
const voluntary=settlement(false);assert.deepEqual(voluntary.result.lost,{H:0,C:0,O:0});assert.deepEqual(voluntary.result.kept,{H:20,C:6,O:3});
const captured=settlement(true);assert.equal(captured.result.rate,EXPEDITION.captureLoss);assert.deepEqual(captured.result.lost,{H:3,C:0,O:0});assert.deepEqual(captured.result.atoms,{H:5,C:2,O:1});assert.deepEqual(captured.r.state.molecules,captured.before.molecules);assert.deepEqual(captured.r.state.recipes,captured.before.recipes);assert.ok(captured.r.state.progress.foundElements.includes('O'));assert.ok(captured.r.state.elements.H>=captured.before.elements.H);
const previewResources=createResources({storage:memory()}),beforePreview=previewResources.snapshot(),preview=previewResources.previewExpedition({H:20,C:14,O:7},true);assert.deepEqual(preview.lost,{H:3,C:2,O:1});assert.deepEqual(previewResources.snapshot(),beforePreview,'Loss preview is cosmetic input and cannot mutate inventory');assert.deepEqual(previewResources.settleExpedition({H:20,C:14,O:7},0,true).lost,preview.lost,'Preview and settlement share the exact loss calculation');
const failingData=new Map();let rejectWrites=false;const failingStorage={getItem:key=>failingData.get(key)??null,setItem:(key,value)=>{if(rejectWrites)throw Error('quota');failingData.set(key,value);},removeItem:key=>failingData.delete(key)},failing=createResources({storage:failingStorage});failing.collect(10,0);failing.save();const beforeFailure=failing.snapshot();rejectWrites=true;assert.equal(failing.settleExpedition({H:30,C:0,O:0},12,true),null);assert.deepEqual(failing.state.elements,beforeFailure.elements,'An interrupted settlement cannot partially bank cargo');assert.deepEqual(failing.state.dust,beforeFailure.dust);

assert.equal(DRIVES.hydrogen.type,'burst');assert.equal(DRIVES.combustion.type,'continuous');assert.ok(DRIVES.hydrogen.boostSeconds<DRIVES.combustion.packetSeconds);assert.equal(MOLECULE_USES.water.role,'catalog');assert.equal(DRIVES.water,undefined);
console.log('Expedition Core passed: capped on-demand fuel, short BURST, hold/release combustion, cosmetic FLOW, safe escalation, fixed-speed pursuit, emergency separation, sustained escape, eventual capture and cargo-only loss.');
