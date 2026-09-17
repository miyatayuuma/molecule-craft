import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources} from '../src/veil/resources.js';
import {createInitialResourcesState,RESOURCE_KEY} from '../src/veil/resources-persistence.js';
import {performanceFor,ROLE_BALANCE_VERSION} from '../src/veil/molecule-roles.js';
import {createRun,beginShock,stepRun} from '../src/veil/engine.js';
import {VEIL} from '../src/veil/config.js';
import {canShock,consumeShockCharge,shockMaterial,shockProfileFor,shockStrength} from '../src/veil/shock.js';
import {stageLaunchSupply} from '../src/veil/launch-transaction.js';

const molecules=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
const graph=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url)));
const rows=(columns,data)=>data.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));
const nodes=rows(graph.nodeColumns,graph.nodes),byId=new Map(nodes.map(node=>[node.id,node]));
const edges=rows(graph.edgeColumns,graph.edges),endpoint=value=>Number.isInteger(value)?nodes[value]?.id:value;
const neighbors=id=>edges.flatMap(edge=>{const a=endpoint(edge.from),b=endpoint(edge.to);return a===id?[b]:b===id?[a]:[];});
assert.equal(byId.get('nitromethane')?.depth,1,'Nitromethane must remain an early Graph branch before Core progression');
assert.ok(neighbors('nitromethane').includes('methane'),'Nitromethane must remain directly reachable from the methane root branch');
assert.ok((byId.get('2-4-6-trinitrotoluene')?.depth??0)>byId.get('nitromethane').depth,'TNT must remain the later optional Graph reward');

assert.equal(ROLE_BALANCE_VERSION,4);
assert.deepEqual(performanceFor('nitromethane','shock'),{capacity:3,radiusScale:1,knockbackScale:1,interruptScale:1});
assert.deepEqual(performanceFor('2-4-6-trinitrotoluene','shock'),{capacity:2,radiusScale:1.45,knockbackScale:1.6,interruptScale:1.45});
for(const id of ['nitrobenzene','hydrogen-peroxide','ozone','ethyne'])assert.equal(performanceFor(id,'shock'),null,`${id} must not become a SHOCK material`);
const nitro=shockProfileFor('nitromethane'),tnt=shockProfileFor('2-4-6-trinitrotoluene');
assert.ok(tnt.radius>nitro.radius&&tnt.knockback>nitro.knockback&&tnt.interruptSeconds>nitro.interruptSeconds,'TNT must be stronger in all impulse dimensions');
assert.equal(tnt.capacity,2);assert.equal(nitro.capacity,3);

function memoryStorage(raw=null){let value=raw;return{getItem:key=>key===RESOURCE_KEY?value:null,setItem:(key,next)=>{if(key===RESOURCE_KEY)value=next;},removeItem:key=>{if(key===RESOURCE_KEY)value=null;},raw:()=>value};}
function readyResources(recipes=['nitromethane']){const storage=memoryStorage(),r=createResources({storage});r.setCatalog(molecules);r.state.progress.choCompleted=true;r.state.progress.foundElements=['H','C','O','N'];r.state.recipes=[...recipes];Object.assign(r.state.elements,{H:500,C:500,N:500,O:500});assert.equal(r.save(),true);return{r,storage};}
{
  const {r}=readyResources(['nitromethane']);assert.deepEqual(r.tankCatalog('shock').map(record=>record.id),['nitromethane'],'undiscovered TNT must not appear');assert.equal(r.setLoadoutTank('shock','nitromethane'),true);const preview=r.launchFillPlan({includeWorkspace:false});const entry=preview.full.entries.find(item=>item.use==='shock');assert.equal(preview.status,'FULL');assert.equal(entry.target,3);assert.deepEqual(entry.cost,{C:3,H:9,N:3,O:6});const staged=stageLaunchSupply(r);assert.ok(staged);assert.equal(r.state.tanks.shock.amount,3);assert.equal(r.prepareExpedition().shock.amount,3);
}
{
  const {r}=readyResources(['nitromethane','2-4-6-trinitrotoluene']);assert.deepEqual(r.tankCatalog('shock').map(record=>record.id).sort(),['2-4-6-trinitrotoluene','nitromethane']);assert.equal(r.setLoadoutTank('shock','2-4-6-trinitrotoluene'),true);assert.equal(r.launchFillPlan({includeWorkspace:false}).full.entries.find(item=>item.use==='shock').target,2);
}

// Legacy schema-v8 saves gain an empty SHOCK slot without resetting progression.
{
  const legacy=createInitialResourcesState();delete legacy.tanks.shock;delete legacy.loadout.tanks.shock;legacy.recipes=['hydrogen'];legacy.progress.runs=7;const storage=memoryStorage(JSON.stringify(legacy)),r=createResources({storage});r.setCatalog(molecules);assert.equal(r.state.progress.runs,7);assert.deepEqual(r.state.tanks.shock,{molecule:null,amount:0});assert.equal(r.selectedLoadout().shock,null);
}
// Persisted unsupported selections fail closed at the application authority.
{
  const state=createInitialResourcesState();state.recipes=['hydrogen'];state.loadout.tanks.shock='hydrogen';const storage=memoryStorage(JSON.stringify(state)),r=createResources({storage});r.setCatalog(molecules);assert.equal(r.selectedLoadout().shock,null);
}

function shockRun(id,amount){return createRun({seed:1},{...VEIL,bounds:{left:-2000,right:2000,top:-2000,bottom:2000}},{fuel:{propellant:{molecule:'hydrogen',amount:120},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:'water',amount:80},shock:{molecule:id,amount}},predators:false});}
{
  const run=shockRun('nitromethane',3);run.eaters=[{id:0,x:run.player.x+100,y:run.player.y,angle:Math.PI,speed:300,vx:-20,vy:0,phase:0,flank:0,lead:1,trail:[]}];const before={propellant:run.fuel.propellant.amount,fuel:run.fuel.fuel.amount,oxidizer:run.fuel.oxidizer.amount,coolant:run.fuel.coolant.amount};assert.equal(canShock(run),true);assert.equal(shockMaterial(run),'nitromethane');assert.equal(shockStrength(run).capacity,3);const first=beginShock(run,()=>true);assert.equal(first.remaining,2);assert.equal(first.affected,1);assert.equal(run.eaters.length,1,'SHOCK must not kill/remove Dust Eater');assert.ok(run.eaters[0].vx>0,'Dust Eater must be repelled outward');assert.ok(run.eaters[0].interrupt>0,'Dust Eater pursuit must be interrupted');assert.deepEqual({propellant:run.fuel.propellant.amount,fuel:run.fuel.fuel.amount,oxidizer:run.fuel.oxidizer.amount,coolant:run.fuel.coolant.amount},before,'SHOCK must not consume PULSE/DRIVE/O2/coolant');assert.equal(beginShock(run,()=>true).remaining,1);assert.equal(beginShock(run,()=>true).remaining,0);assert.equal(beginShock(run,()=>true),false,'zero-charge SHOCK must fail closed');assert.equal(canShock(run),false);assert.equal(run.eaters.length,1,'interrupted Dust Eater remains a live encounter');
}
{
  const nitroRun=shockRun('nitromethane',3),tntRun=shockRun('2-4-6-trinitrotoluene',2);for(const run of [nitroRun,tntRun])run.eaters=[{id:0,x:run.player.x+300,y:run.player.y,angle:Math.PI,speed:300,vx:0,vy:0,phase:0,trail:[]}];const nitroEvent=beginShock(nitroRun,()=>true),tntEvent=beginShock(tntRun,()=>true);assert.equal(nitroEvent.affected,0,'Nitromethane should retain the smaller emergency-clearance radius');assert.equal(tntEvent.affected,1,'TNT should reach farther while carrying fewer charges');
}
// Core-facing contract consumes a run-local charge without any DOM dependency.
{
  const run=shockRun('nitromethane',1);const spent=consumeShockCharge(run,()=>true);assert.equal(spent.remaining,0);assert.equal(shockMaterial(run),'nitromethane');assert.equal(canShock(run),false);
}
// Return/relaunch semantics: used charge remains spent; next launch auto-synthesizes only the missing charge.
{
  const {r}=readyResources(['nitromethane']);r.setLoadoutTank('shock','nitromethane');assert.ok(stageLaunchSupply(r));assert.equal(r.state.tanks.shock.amount,3);assert.equal(r.consumeTank('shock','nitromethane',1),true);assert.equal(r.state.tanks.shock.amount,2);const refill=r.launchFillPlan({includeWorkspace:false});const entry=refill.full.entries.find(item=>item.use==='shock');assert.equal(entry.add,1);assert.ok(stageLaunchSupply(r));assert.equal(r.state.tanks.shock.amount,3);
}
console.log('SHOCK foundation passed: Graph availability, 3/2 charge balance, launch synthesis, save compatibility, independent consumption, Dust Eater repel/interrupt and Core-facing contract.');
