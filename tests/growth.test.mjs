import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js?v=20';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {GROWTH,MOLECULE_USES,flightConfig,driveAvailable,growthGoal,combustionPackets,propulsionGauge} from '../src/veil/growth.js';
import {EXPEDITION} from '../src/veil/config.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
setMoleculeDatabase(database);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};
const state=recipes=>({recipes});

// HUD fuel is derived from the same packet ratio and expedition capacities as
// propulsion. The limiting reagent wins and display ratios are always clamped.
assert.equal(combustionPackets({methane:12,oxygen:20}),10);
assert.deepEqual(propulsionGauge('hydrogen',{hydrogen:120}),{remaining:3,capacity:3,seconds:0,ratio:1,state:'enough'});
assert.equal(propulsionGauge('hydrogen',{hydrogen:40}).state,'low');assert.equal(propulsionGauge('hydrogen',{hydrogen:-4}).ratio,0);
const fullCombustion=propulsionGauge('combustion',{methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity});assert.equal(fullCombustion.ratio,1);assert.equal(fullCombustion.remaining,EXPEDITION.methaneCapacity);
const oxygenLimited=propulsionGauge('combustion',{methane:18,oxygen:20});assert.equal(oxygenLimited.remaining,10);assert.equal(oxygenLimited.seconds,20);
const activeLastPacket=propulsionGauge('combustion',{methane:0,oxygen:0},1.25);assert.equal(activeLastPacket.remaining,1);assert.equal(activeLastPacket.seconds,1.25);
assert.equal(propulsionGauge('combustion',{methane:999,oxygen:999},99).ratio,1);assert.equal(propulsionGauge('combustion',{methane:4,oxygen:1}).ratio,0);

// Authored topology is stable while cluster centres, signals and small dust
// offsets vary by seed. Carbon is gathered from bursts; Oxygen dust moves.
const u1=createUniverse(901),u2=createUniverse(901),u3=createUniverse(902);
assert.deepEqual(u1,u2);assert.deepEqual(u1.routes,u3.routes);
assert.notDeepEqual(u1.clusters.map(c=>[c.x,c.y]),u3.clusters.map(c=>[c.x,c.y]));
assert.ok(u1.clusters.length>=10&&u1.clusters.every(c=>c.particles.length===GROWTH.clusterParticles));
assert.ok(u1.dust.some(d=>d.element==='C'&&d.cluster!==undefined));
assert.ok(u1.dust.some(d=>d.element==='O'&&d.flow));
assert.deepEqual(u1.routes.filter(r=>r.element==='C').map(r=>r.id),['carbon-entry','carbon-main','carbon-sweep']);
assert.ok(u1.routes.filter(r=>r.element==='O').length>=4);

// Owning H₂ no longer grants a hidden permanent movement or suction upgrade.
const starter=flightConfig(state([])),hydrogen=flightConfig(state(['hydrogen']));
assert.equal(hydrogen.speed,starter.speed);assert.equal(hydrogen.driftSpeed,starter.driftSpeed);assert.equal(hydrogen.suctionRadius,starter.suctionRadius);
function entrySweep(recipes){const run=createRun(createUniverse(45),flightConfig(state(recipes)),{predators:false});for(let i=0;i<12*60;i++)stepRun(run,{x:0,y:-1},1/60);return run;}
const slow=entrySweep([]),upgraded=entrySweep(['hydrogen']);
assert.equal(upgraded.collected,slow.collected);assert.equal(upgraded.player.y,slow.player.y);

// The H/C boundary is an opposing current in world coordinates. Owning a
// recipe does not open it; spending one H₂ boost supplies enough thrust.
function outer({boost=false}={}){const run=createRun(createUniverse(9),hydrogen,{fuel:{hydrogen:40},predators:false});Object.assign(run.player,{x:530,y:-3620,angle:-Math.PI/2,vx:0,vy:0});if(boost)assert.ok(beginBurst(run,()=>true));for(let i=0;i<15*60;i++)stepRun(run,{x:0,y:-1},1/60);return run;}
assert.equal(outer().region,'veil');assert.equal(outer({boost:true}).region,'carbon');

// Entering a carbon mass produces a radial burst in the same simulation frame.
const clusterRun=createRun(createUniverse(33),hydrogen,{predators:false}),cluster=clusterRun.map.clusters[0];Object.assign(clusterRun.player,{x:cluster.x,y:cluster.y,vx:0,vy:0});
const burst=stepRun(clusterRun,{x:0,y:0},1/60);assert.ok(burst.some(event=>event.type==='cluster'));
const carbonPickup=burst.find(event=>event.type==='pickup');assert.ok(carbonPickup?.units.C>=GROWTH.clusterParticles/2,'A cluster must release a meaningful C burst');
const moving=clusterRun.map.dust.find(d=>d.element==='O'&&d.flow),before=[moving.x,moving.y];for(let i=0;i<20;i++)stepRun(clusterRun,{x:0,y:0},1/60);assert.notDeepEqual([moving.x,moving.y],before);

// The hot opposing flow is crossed by sustained propulsion. H₂O remains a
// normal catalogue molecule and is neither checked nor consumed here.
function hotBand(combustion=false){const run=createRun(createUniverse(10),hydrogen,{fuel:{methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity},predators:false});Object.assign(run.player,{x:100,y:-8700,angle:-Math.PI/2,vx:0,vy:0});let packets=0;if(combustion)setCombustionHeld(run,true);
  for(let i=0;i<60*60&&run.region!=='frontier';i++)stepRun(run,{x:0,y:-1},1/60,{consumeCombustion:()=>{packets++;return true;}});
  return {run,packets};
}
assert.notEqual(hotBand(false).run.region,'frontier');const sustained=hotBand(true);assert.equal(sustained.run.region,'frontier');assert.ok(sustained.packets>=2&&sustained.packets<=EXPEDITION.methaneCapacity);

// All four key structures are still recognized by the ordinary chemistry
// graph. A knowledgeable player can complete them before reading a hint.
for(const id of ['hydrogen','methane','oxygen','water']){
  const record=database.find(item=>item.id===id),molecule=new Molecule(),ids=record.atoms.map(element=>molecule.addAtom(element).id);
  for(const [a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);
  const item=connectedStructures(molecule)[0];assert.ok(item.complete,id);assert.equal(item.record.id,id);
}

const storage=memory(),resources=createResources({storage});resources.setCatalog(database);
assert.deepEqual(resources.state.progress.foundElements,['H']);assert.equal(resources.canUseElement('C'),false);assert.equal(resources.spend({C:1}),false);
resources.collect(24,0);assert.ok(resources.state.hints.includes('hydrogen'));assert.equal(resources.state.recipes.includes('hydrogen'),false,'A hint is not a completed recipe');
assert.equal(growthGoal(resources.state).id,'hydrogen');
assert.ok(resources.discover('hydrogen'));assert.equal(Object.hasOwn(resources.state,'molecules'),false);assert.ok(hydrogen.suctionRadius===flightConfig(resources.state).suctionRadius);

resources.collectDust({C:3},0);assert.equal(resources.canUseElement('C'),true);assert.ok(resources.state.hints.includes('methane'));assert.equal(growthGoal(resources.state).id,'methane');
resources.collect({H:20,C:5},0);assert.ok(resources.discover('methane'));
assert.equal(driveAvailable(resources.state,'combustion'),false,'CH₄ is fuel, not a standalone ability');

resources.collectDust({O:3},0);assert.ok(resources.state.hints.includes('oxygen')&&resources.state.hints.includes('water'));
resources.collect({H:10,O:20},0);
assert.ok(resources.discover('oxygen'));assert.ok(resources.discover('water'));assert.ok(driveAvailable(resources.state,'combustion'));assert.equal(typeof resources.consumeCoolant,'undefined');
const capacity=createResources({storage:memory()});capacity.setCatalog(database);for(const id of ['hydrogen','methane','oxygen'])capacity.discover(id);Object.assign(capacity.state.elements,{H:312,C:18,O:72});assert.deepEqual(capacity.prepareExpedition(),{propellant:{molecule:null,amount:0},fuel:{molecule:null,amount:0},oxidizer:{molecule:null,amount:0}});assert.ok(capacity.fillTankFromElements('propellant','hydrogen',120));assert.ok(capacity.fillTankFromElements('fuel','methane',18));assert.ok(capacity.fillTankFromElements('oxidizer','oxygen',36));assert.deepEqual(capacity.prepareExpedition(),{propellant:{molecule:'hydrogen',amount:120},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36}});
const sessionOnly=createResources({storage:null});sessionOnly.collect(240,0);sessionOnly.discover('hydrogen');assert.ok(sessionOnly.fillTankFromElements('propellant','hydrogen',120));assert.ok(sessionOnly.consumeDrive('hydrogen'),'Session-only mode must remain playable when persistent storage is unavailable');

// Ordinary DB molecules can be discovered but gain no persistent finished
// inventory merely by being present in the catalogue.
assert.equal(MOLECULE_USES['carbon-dioxide'],undefined);assert.ok(resources.discover('carbon-dioxide'));
const co2Cost=resources.costFor('carbon-dioxide');assert.deepEqual(co2Cost,{C:1,O:2});assert.equal(Object.hasOwn(resources.state,'molecules'),false);

// Random signals change side-discovery order. Three misses guarantee a hint,
// and the key loop already has deterministic hints from element discovery.
const luck=createResources({storage:memory()});luck.setCatalog(database);luck.collect({H:10,C:3,O:3},0);
for(let attempt=1;attempt<=3;attempt++){
  const result=luck.signal('oxygen',.999,.4);if(attempt<3)assert.ok(result.bonus);else assert.ok(result.recipe,'Third eligible miss must trigger pity');luck.collect(45,0);
}
assert.ok(luck.state.hints.includes('hydrogen')&&luck.state.hints.includes('methane')&&luck.state.hints.includes('oxygen')&&luck.state.hints.includes('water'));

// Fractional dust and tanks survive a reload. Pre-tank finished inventory is discarded.
const partialStorage=memory(),partial=createResources({storage:partialStorage});partial.collectDust({H:1,C:0,O:0},0);partial.save();const partialReload=createResources({storage:partialStorage});assert.equal(partialReload.state.dust.H,1);partialReload.collectDust({H:2,C:0,O:0},0);assert.equal(partialReload.state.elements.H,1);
const legacyStorage=memory();legacyStorage.setItem(RESOURCE_KEY,JSON.stringify({schemaVersion:1,elements:{H:7},molecules:{hydrogen:2},recipes:['hydrogen'],progress:{bestChain:8,runs:2,cleared:true,craftPrompt:false,sound:true},workspace:null}));
const migrated=createResources({storage:legacyStorage});assert.equal(migrated.state.schemaVersion,6);assert.deepEqual(migrated.state.elements,{H:7,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0});assert.equal(Object.hasOwn(migrated.state,'molecules'),false);assert.deepEqual(migrated.state.tanks.propellant,{molecule:null,amount:0});assert.deepEqual(migrated.state.progress.foundElements,['H']);

console.log('H → C → O growth loop passed: authored continuity with variation, unchanged normal flight, physical H₂ BURST crossing, carbon bursts, moving Oxygen flows, sustained CH₄/O₂ travel without H₂O gating, four handmade key structures, explicit expedition tanks, optional DB production, signal pity and save migration.');
