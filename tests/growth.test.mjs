import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule,setMoleculeDatabase} from '../src/chemistry.js?v=20';
import {connectedStructures} from '../src/workspace-model.js?v=20';
import {createRun,stepRun,beginBoost} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {DRIVES,GROWTH,MOLECULE_USES,flightConfig,driveAvailable,growthGoal} from '../src/veil/growth.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
setMoleculeDatabase(database);
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),data};};
const state=recipes=>({recipes});

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

// H₂ permanently changes ordinary collection feel before fuel is spent.
const starter=flightConfig(state([])),hydrogen=flightConfig(state(['hydrogen']));
assert.ok(hydrogen.speed>starter.speed*1.4);assert.ok(hydrogen.suctionRadius>starter.suctionRadius*3);
function entrySweep(recipes){const run=createRun(createUniverse(45),flightConfig(state(recipes)));for(let i=0;i<12*60;i++)stepRun(run,{x:0,y:-1},1/60);return run;}
const slow=entrySweep([]),upgraded=entrySweep(['hydrogen']);
assert.ok(upgraded.collected>=slow.collected*1.8,`Expected H₂ collection jump, got ${slow.collected} -> ${upgraded.collected}`);

// The H/C boundary is an opposing current in world coordinates. Owning a
// recipe does not open it; spending one H₂ boost supplies enough thrust.
function outer({boost=false}={}){const run=createRun(createUniverse(9),flightConfig(state(['hydrogen'])));Object.assign(run.player,{x:530,y:-3620,angle:-Math.PI/2,vx:0,vy:0});if(boost)assert.ok(beginBoost(run.player,()=>true,DRIVES.hydrogen));for(let i=0;i<15*60;i++)stepRun(run,{x:0,y:-1},1/60);return run;}
assert.equal(outer().region,'veil');assert.equal(outer({boost:true}).region,'carbon');

// Entering a carbon mass produces a radial burst in the same simulation frame.
const clusterRun=createRun(createUniverse(33),hydrogen),cluster=clusterRun.map.clusters[0];Object.assign(clusterRun.player,{x:cluster.x,y:cluster.y,vx:0,vy:0});
const burst=stepRun(clusterRun,{x:0,y:0},1/60);assert.ok(burst.some(event=>event.type==='cluster'));
const carbonPickup=burst.find(event=>event.type==='pickup');assert.ok(carbonPickup?.units.C>=GROWTH.clusterParticles/2,'A cluster must release a meaningful C burst');
const moving=clusterRun.map.dust.find(d=>d.element==='O'&&d.flow),before=[moving.x,moving.y];for(let i=0;i<20;i++)stepRun(clusterRun,{x:0,y:0},1/60);assert.notDeepEqual([moving.x,moving.y],before);

// Heat and pressure form the frontier gate. Neither inventory nor a boolean
// key opens it: only enough thrust while heat is actively removed succeeds.
function hotBand(drive,cooling){const run=createRun(createUniverse(10),hydrogen);Object.assign(run.player,{x:100,y:-8700,angle:-Math.PI/2,vx:0,vy:0});let fuel=0,water=0,maxHeat=0;
  for(let i=0;i<60*60&&run.region!=='frontier';i++){
    if(run.player.boost<=0&&run.player.cooldown<=0)beginBoost(run.player,()=>{fuel++;return true;},DRIVES[drive]);
    stepRun(run,{x:0,y:-1},1/60,{consumeCoolant:()=>{if(!cooling)return false;water++;return true;}});maxHeat=Math.max(maxHeat,run.heat);
  }return {run,fuel,water,maxHeat};
}
for(const [drive,cooling]of [['hydrogen',false],['hydrogen',true],['combustion',false]])assert.notEqual(hotBand(drive,cooling).run.region,'frontier',`${drive}/${cooling} bypassed the physical adaptation`);
const adapted=hotBand('combustion',true);assert.equal(adapted.run.region,'frontier');assert.ok(adapted.fuel>=1&&adapted.water>=1&&adapted.maxHeat>GROWTH.cooling.threshold);

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
assert.ok(resources.spend({H:2}));assert.ok(resources.storeMolecule('hydrogen'));assert.equal(resources.state.molecules.hydrogen,1);assert.ok(hydrogen.suctionRadius===flightConfig(resources.state).suctionRadius);

resources.collectDust({C:3},0);assert.equal(resources.canUseElement('C'),true);assert.ok(resources.state.hints.includes('methane'));assert.equal(growthGoal(resources.state).id,'methane');
resources.collect({H:20,C:5},0);assert.ok(resources.spend({C:1,H:4}));assert.ok(resources.storeMolecule('methane'));assert.equal(resources.state.molecules.methane,1);
assert.equal(driveAvailable(resources.state,'combustion'),false,'CH₄ is fuel, not a standalone ability');

resources.collectDust({O:3},0);assert.ok(resources.state.hints.includes('oxygen')&&resources.state.hints.includes('water'));
resources.collect({H:10,O:20},0);
assert.ok(resources.spend({O:2}));assert.ok(resources.storeMolecule('oxygen'));
assert.ok(resources.spend({O:1,H:2}));assert.ok(resources.storeMolecule('water'));
assert.ok(resources.makeMolecule('oxygen',2));assert.ok(resources.makeMolecule('methane',1));assert.ok(driveAvailable(resources.state,'combustion'));
const beforeFuel={methane:resources.state.molecules.methane,oxygen:resources.state.molecules.oxygen};assert.ok(resources.consumeDrive('combustion'));
assert.equal(resources.state.molecules.methane,beforeFuel.methane-1);assert.equal(resources.state.molecules.oxygen,beforeFuel.oxygen-2);
const beforeWater=resources.state.molecules.water;assert.ok(resources.consumeCoolant());assert.equal(resources.state.molecules.water,beforeWater-1);
const sessionOnly=createResources({storage:null});sessionOnly.collect(4,0);sessionOnly.discover('hydrogen');assert.ok(sessionOnly.makeMolecule('hydrogen'));assert.ok(sessionOnly.consumeDrive('hydrogen'),'Session-only mode must remain playable when persistent storage is unavailable');

// Ordinary DB molecules can be discovered and mass-produced but gain no
// expedition action merely by being present in the catalogue.
assert.equal(MOLECULE_USES['carbon-dioxide'],undefined);assert.ok(resources.discover('carbon-dioxide'));
const co2Cost=resources.costFor('carbon-dioxide');assert.deepEqual(co2Cost,{C:1,O:2});assert.ok(resources.makeMolecule('carbon-dioxide'));assert.equal(resources.state.molecules['carbon-dioxide'],1);

// Random signals change side-discovery order. Three misses guarantee a hint,
// and the key loop already has deterministic hints from element discovery.
const luck=createResources({storage:memory()});luck.setCatalog(database);luck.collect({H:10,C:3,O:3},0);
for(let attempt=1;attempt<=3;attempt++){
  const result=luck.signal('oxygen',.999,.4);if(attempt<3)assert.ok(result.bonus);else assert.ok(result.recipe,'Third eligible miss must trigger pity');luck.collect(45,0);
}
assert.ok(luck.state.hints.includes('hydrogen')&&luck.state.hints.includes('methane')&&luck.state.hints.includes('oxygen')&&luck.state.hints.includes('water'));

// Fractional dust, inventories and loadout survive a reload. Old v35 saves
// migrate without granting new atoms or fuel.
const partialStorage=memory(),partial=createResources({storage:partialStorage});partial.collectDust({H:1,C:0,O:0},0);partial.save();const partialReload=createResources({storage:partialStorage});assert.equal(partialReload.state.dust.H,1);partialReload.collectDust({H:2,C:0,O:0},0);assert.equal(partialReload.state.elements.H,1);
const legacyStorage=memory();legacyStorage.setItem(RESOURCE_KEY,JSON.stringify({schemaVersion:1,elements:{H:7},molecules:{hydrogen:2},recipes:['hydrogen'],progress:{bestChain:8,runs:2,cleared:true,craftPrompt:false,sound:true},workspace:null}));
const migrated=createResources({storage:legacyStorage});assert.equal(migrated.state.schemaVersion,2);assert.deepEqual(migrated.state.elements,{H:7,C:0,O:0});assert.equal(migrated.state.molecules.hydrogen,2);assert.deepEqual(migrated.state.progress.foundElements,['H']);

console.log('H → C → O growth loop passed: authored continuity with variation, H₂ collection jump and current crossing, carbon bursts, moving Oxygen flows, physical heat/cooling gate, four handmade key structures, exact molecule economy, CH₄/O₂ combustion, H₂O cooling, optional DB production, signal pity and save migration.');
