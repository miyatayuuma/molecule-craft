import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js';
import {createPolymerFragment3DLayout} from '../src/polymer-fragment-3d-layout.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';
import {connectPolyethyleneReference} from '../src/polyethylene-reference-transition.js';
import {connectPolymerReference} from '../src/polymer-reference-transition.js';
import {advanceReferenceGrowth} from '../src/polymer-reference-renderer.js';
const load=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
async function fixture(id='polyethylene'){
 const authority=await load('../data/polymerization-routes.json'),db=await load('../data/molecules.json'),route=authority.routes.find(r=>r.polymerId===id),records=db.filter(r=>[...route.feedSpecies,'water'].includes(r.id)),instances=Array.from({length:4},(_,i)=>({id:`feed-${i}`,species:route.feedSpecies[0],batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)}).ok,true);
 let result;for(let i=1;i<4;i++){const begun=i>route.interactionCadence.manualSteps?core.beginAutomaticStep(instances[i].id):core.beginManualStep(instances[i].id);assert.equal(begun.ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);}
 const sample=result.sample,src={};for(const item of instances){const record=records.find(r=>r.id===item.species),model=createPreviewModel(THREE,record);for(let i=0;i<190;i++)model.step();src[item.id]={...record,...model.snapshot()};}
 const layout=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:src});assert.equal(layout.diagnostics.accepted,true);
 return {finite:{...sample.fragment,atoms:layout.atoms},reference:createPolymerReferenceModel(THREE,id,100)};
}
test('PE actual graph maps exactly to the first four units and connects the fifth',async()=>{
 const {finite,reference}=await fixture(),before=JSON.stringify({finite,reference});const {plan,matched,bridge}=connectPolyethyleneReference(THREE,finite,reference);
 assert.equal(JSON.stringify({finite,reference}),before);assert.equal(matched.length,24);
 for(const {reference:r,finite:f} of matched)assert.deepEqual([plan.atoms[r].x,plan.atoms[r].y,plan.atoms[r].z],[finite.atoms[f].x,finite.atoms[f].y,finite.atoms[f].z]);
 const key=(a,b)=>[a,b].sort((x,y)=>x-y).join(':');const edge=new Set(plan.bonds.filter(b=>plan.atoms[b.a].unit<4&&plan.atoms[b.b].unit<4).map(b=>key(b.a,b.b))),lookup=new Map(matched.map(m=>[m.finite,m.reference]));
 assert.equal(edge.size,finite.bonds.length);for(const b of finite.bonds)assert.ok(edge.has(key(lookup.get(b.a),lookup.get(b.b))));
 assert.ok(plan.bonds.some(b=>key(b.a,b.b)===key(bridge.a,bridge.b)));const a=plan.atoms[bridge.a],b=plan.atoms[bridge.b];assert.equal(a.unit,3);assert.equal(b.unit,4);assert.ok(Math.abs(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)-1.52*.78)<1e-6);
 const active=plan.atoms.filter(a=>a.unit<5),bonded=new Set(plan.bonds.map(b=>key(b.a,b.b)));let min=Infinity;for(const x of active)for(const y of active)if(x.id<y.id&&(x.unit===4||y.unit===4)&&!bonded.has(key(x.id,y.id)))min=Math.min(min,Math.hypot(x.x-y.x,x.y-y.y,x.z-y.z));assert.ok(min>.7,`fifth unit has no severe overlap with the finite sample: ${min}`);
 const degree=Array(plan.atoms.length).fill(0);for(const b of plan.bonds){degree[b.a]+=b.order;degree[b.b]+=b.order;}assert.ok(plan.atoms.every((a,i)=>degree[i]<=(a.element==='C'?4:1)));
 let growth={units:4,lastRenderedAt:0};for(let n=5;n<=100;n++){assert.equal(advanceReferenceGrowth(growth,n*150,100),true);assert.equal(growth.units,n);growth.lastRenderedAt=n*150;}assert.equal(growth.units,100);
});
test('incompatible PE topology fails closed without changing the sample',async()=>{const {finite,reference}=await fixture();finite.bonds[0].order=2;const before=JSON.stringify(finite);assert.throws(()=>connectPolyethyleneReference(THREE,finite,reference),/graph-mismatch/);assert.equal(JSON.stringify(finite),before);});

test('a new FEED invalidates a pending PE worker while another display is growing',async()=>{
 const {createReferencePreparation}=await import('../src/polymer-reference-preparation.js');const workers=[];
 const owner=createReferencePreparation(()=>{const worker={terminated:false,postMessage(){},terminate(){this.terminated=true;}};workers.push(worker);return worker;});
 const pending=owner.start('polyethylene',100,11),late=workers[0].onmessage,growth={units:5,lastRenderedAt:0};assert.equal(advanceReferenceGrowth(growth,150,100),true);assert.equal(growth.units,6);
 owner.cancel();assert.equal(await pending.promise,null);assert.equal(workers[0].terminated,true);
 const next=owner.start('polyethylene',100,12);late({data:{plan:{generation:11}}});workers[1].onmessage({data:{plan:{generation:12}}});assert.deepEqual(await next.promise,{generation:12});
});

test('common transition verifies the PE embedding and rejects unsupported and invalid graphs',async()=>{
 const {finite,reference}=await fixture();const before=JSON.stringify({finite,reference});
 const connected=connectPolymerReference(THREE,finite,reference,4);assert.equal(connected.matched.length,finite.atoms.length);assert.equal(JSON.stringify({finite,reference}),before);
 assert.throws(()=>connectPolymerReference(THREE,finite,{...reference,polymerId:'unsupported-polymer'},4),/unsupported/);
 const duplicate={...finite,bonds:[...finite.bonds,finite.bonds[0]]};assert.throws(()=>connectPolymerReference(THREE,duplicate,reference,4),/invalid-bond/);
 const broken={...finite,bonds:finite.bonds.slice(1)};assert.throws(()=>connectPolymerReference(THREE,broken,reference,4),/disconnected/);
});

for(const id of ['polypropylene','polyisobutylene'])test(`${id} preserves actual graph and safely attaches unit five`,async()=>{
 const {finite,reference}=await fixture(id),before=JSON.stringify({finite,reference});
 const {plan,matched,bridge}=connectPolymerReference(THREE,finite,reference,4);
 assert.equal(JSON.stringify({finite,reference}),before);assert.equal(matched.length,finite.atoms.length);
 assert.deepEqual(plan.atoms.slice(0,finite.atoms.length).map(({x,y,z})=>[x,y,z]),finite.atoms.map(({x,y,z})=>[x,y,z]));
 assert.equal(plan.atoms[bridge.b].unit,4);assert.ok(Math.abs(new THREE.Vector3(plan.atoms[bridge.a].x,plan.atoms[bridge.a].y,plan.atoms[bridge.a].z).distanceTo(new THREE.Vector3(plan.atoms[bridge.b].x,plan.atoms[bridge.b].y,plan.atoms[bridge.b].z))-1.52*.78)<1e-6);
 const key=(a,b)=>[a,b].sort((a,b)=>a-b).join(':'),edges=new Set(plan.bonds.map(b=>key(b.a,b.b)));let min=Infinity;
 for(let i=0;i<finite.atoms.length;i++)for(const a of plan.atoms.filter(a=>a.unit===4))if(!edges.has(key(i,a.id)))min=Math.min(min,Math.hypot(a.x-plan.atoms[i].x,a.y-plan.atoms[i].y,a.z-plan.atoms[i].z));assert.ok(min>=.7,`clearance ${min}`);
 let growth={units:4,lastRenderedAt:0};for(let n=5;n<=100;n++){assert.ok(advanceReferenceGrowth(growth,n*150,100));assert.equal(growth.units,n);growth.lastRenderedAt=n*150;}
});

for(const id of ['polystyrene','polyvinyl-chloride','polychlorotrifluoroethylene','polyacrylonitrile','polyacrylic-acid','polyvinylidene-fluoride','polytetrafluoroethylene'])test(`${id} connects its actual finite graph to 100 repeat units`,async()=>{
 const {finite,reference}=await fixture(id),before=JSON.stringify({finite,reference});
 const {plan,matched,bridge}=connectPolymerReference(THREE,finite,reference,4);
 assert.equal(JSON.stringify({finite,reference}),before);assert.equal(matched.length,finite.atoms.length);
 assert.deepEqual(plan.atoms.slice(0,finite.atoms.length).map(({x,y,z})=>[x,y,z]),finite.atoms.map(({x,y,z})=>[x,y,z]));
 assert.equal(plan.atoms[bridge.b].unit,4);assert.ok(Math.abs(new THREE.Vector3(plan.atoms[bridge.a].x,plan.atoms[bridge.a].y,plan.atoms[bridge.a].z).distanceTo(new THREE.Vector3(plan.atoms[bridge.b].x,plan.atoms[bridge.b].y,plan.atoms[bridge.b].z))-1.52*.78)<1e-6);
 const actualTail=plan.atoms.filter(a=>a.unit>=4).map(a=>a.element).sort(),referenceTail=reference.atoms.filter(a=>a.unit>=4).map(a=>a.element).sort();assert.deepEqual(actualTail,referenceTail);
 const key=(a,b)=>[a,b].sort((a,b)=>a-b).join(':');const edges=new Set(plan.bonds.map(b=>key(b.a,b.b)));let gap=Infinity;
 for(let i=0;i<finite.atoms.length;i++)for(const atom of plan.atoms.filter(a=>a.unit===4))if(!edges.has(key(i,atom.id)))gap=Math.min(gap,Math.hypot(atom.x-plan.atoms[i].x,atom.y-plan.atoms[i].y,atom.z-plan.atoms[i].z));assert.ok(gap>=.7,`fifth unit clearance ${gap}`);
 const tailOrders=plan.bonds.filter(b=>plan.atoms[b.a].unit>=4&&plan.atoms[b.b].unit>=4).map(b=>b.order).sort(),refOrders=reference.bonds.filter(b=>reference.atoms[b.a].unit>=4&&reference.atoms[b.b].unit>=4).map(b=>b.order).sort();assert.deepEqual(tailOrders,refOrders);
 if(id==='polystyrene')assert.equal(plan.aromaticCycles.length,96);if(id==='polyacrylonitrile')assert.equal(plan.bonds.filter(b=>b.order===3).length,100);if(id==='polyacrylic-acid')assert.equal(plan.bonds.filter(b=>b.order===2).length,100);
 let growth={units:4,lastRenderedAt:0};for(let n=5;n<=100;n++){assert.ok(advanceReferenceGrowth(growth,n*150,100));growth.lastRenderedAt=n*150;}assert.equal(growth.units,100);
});
