import assert from 'node:assert/strict';
import {simulateOxygenRoute as simulateCurrentRoute} from '../scripts/simulate-oxygen-routes.mjs';
import {OXYGEN_ROUTES,oxygenPressureAt} from '../src/veil/oxygen-routes.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';

// Keep Network regressions isolated at the canonical junction. Oxygen Entry
// traversal is covered separately so its temporary pulse overlap cannot make
// downstream route balance look changed.
const simulateOxygenRoute=options=>simulateCurrentRoute({harvestLayout:{sideSpacing:27,eddyAtoms:0},start:'junction',...options});
const cases=[
  {routeId:'oxygen-shortcut',propellant:'hydrogen'},
  {routeId:'oxygen-side',propellant:'carbon-dioxide'},
  {routeId:'oxygen-main',propellant:null,drive:true,coolant:'water'},
];
for(const seed of [1,71])for(const fps of [30,60]){
  const reports=cases.map(options=>simulateOxygenRoute({...options,seed,fps}));
  for(const report of reports){assert.equal(report.reached,true,JSON.stringify(report));assert.equal(report.returnType,'voluntary');assert.ok(report.netAtoms>0);assert.equal(report.overheatEvents,0);}
  assert.equal(reports[0].burstUses,1);assert.equal(reports[1].burstUses,4);assert.equal(reports[1].currentCrossings.length,4);assert.equal(reports[2].burstUses,0);
  assert.ok(reports[1].grossAtoms>reports[0].grossAtoms&&reports[1].grossAtoms>reports[2].grossAtoms,'The repeated-current route rewards repeated collecting');
  assert.ok(reports[1].duration>reports[0].duration&&reports[1].duration>reports[2].duration);
  assert.ok(reports[0].fuelAtomCost<reports[1].fuelAtomCost&&reports[0].fuelAtomCost<reports[2].fuelAtomCost);
  assert.ok(reports[1].maxEaters>0,'The longer route remains exposed to normal pursuit');
}
const [shortcut,,main]=cases.map(options=>simulateOxygenRoute(options));
assert.ok(shortcut.duration<main.duration,'The shortcut crosses the branch itself fastest');
const rest=simulateOxygenRoute({routeId:'oxygen-main',propellant:null,drive:true,rest:true});
assert.equal(rest.reached,true,'A rest in the quiet eddy is a real uncooled solution');assert.equal(rest.overheatEvents,0);assert.ok(rest.duration>main.duration);
const alternative=simulateOxygenRoute({routeId:'oxygen-main',propellant:null,drive:true,coolant:'carbon-dioxide'});
assert.equal(alternative.reached,true,'Water is not a molecule key');assert.equal(alternative.overheatEvents,0);
const overheat=simulateOxygenRoute({routeId:'oxygen-main',propellant:null,drive:true});
assert.ok(overheat.overheatEvents>0);
const weak=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'carbon-dioxide'});
assert.equal(weak.reached,false);assert.equal(weak.currentCrossings.length,0);assert.ok(weak.stalledBursts>0);
const few=simulateOxygenRoute({routeId:'oxygen-side',propellant:'hydrogen'});
assert.equal(few.reached,true,'H₂ momentum can cross two thin currents per burst: preserve the physical alternative');assert.equal(few.burstUses,2);assert.equal(few.currentCrossings.length,4);
const repeated=simulateOxygenRoute(cases[1]);assert.ok(few.duration<repeated.duration);assert.ok(few.fuelAtomCost>repeated.fuelAtomCost);assert.ok(few.netAtoms<repeated.netAtoms,'The faster alternative costs more material');
const continuous=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:null,drive:true,coolant:'water'});
assert.equal(continuous.currentCrossings.length,0,'Continuous thrust alone cannot cross the strong short current');
for(const route of OXYGEN_ROUTES)for(const gate of route.gates)assert.equal(oxygenPressureAt({x:route.x,y:gate.y}),gate.pressure);
assert.equal(oxygenPressureAt({x:120,y:-9700}),0,'The marked rest pocket is physically quiet');
assert.equal(oxygenPressureAt({x:0,y:-4000}),null,'The first H/C passage is not changed');

// Add a deterministic hint to an existing v6 save without learning or gifting
// the molecule, and keep future saves protected.
const records=[{id:'carbon-dioxide',atoms:['C','O','O']}],data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const old=createResources({storage});old.collect({H:12,C:6,O:12});old.save();
const saved=JSON.parse(data.get(RESOURCE_KEY));saved.hints=saved.hints.filter(id=>id!=='carbon-dioxide');data.set(RESOURCE_KEY,JSON.stringify(saved));
const restored=createResources({storage});restored.setCatalog(records);assert.ok(restored.state.hints.includes('carbon-dioxide'));assert.equal(restored.state.recipes.includes('carbon-dioxide'),false);assert.deepEqual(restored.state.elements,saved.elements);assert.deepEqual(restored.state.tanks,saved.tanks);
assert.ok(JSON.parse(data.get(RESOURCE_KEY)).hints.includes('carbon-dioxide'));
saved.schemaVersion=99;const future=JSON.stringify(saved);data.set(RESOURCE_KEY,future);const protectedState=createResources({storage});protectedState.setCatalog(records);assert.equal(data.get(RESOURCE_KEY),future);
console.log('Oxygen routes passed: physical crossings, distinct finite builds, 30/60fps and seeds, quiet-eddy alternative, return and old-save hints.');
