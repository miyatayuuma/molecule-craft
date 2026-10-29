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
for(const id of ['polyethylene-oxide','polybutadiene','polyisoprene','polylactic-acid','polyglycolic-acid'])test(`${id} connects the finite sample to 100 units`,async()=>{const {finite,reference}=await fixture(id);const before=JSON.stringify({finite,reference});const result=connectPolymerReference(THREE,finite,reference,4);assert.equal(JSON.stringify({finite,reference}),before);assert.equal(result.matched.length+(result.removedFinite?.length??0),finite.atoms.length);assert.equal(result.plan.atoms[result.bridge.b].unit,4);if(id==='polylactic-acid'||id==='polyglycolic-acid'){assert.equal(result.removedFinite.length,2);assert.deepEqual(result.removedFinite.map(i=>finite.atoms[i].element).sort(),['H','O']);assert.equal(result.water.incomingHydrogen,1);}if(id==='polybutadiene'||id==='polyisoprene')assert.equal(result.plan.bonds.filter(b=>b.order===2).length,100);let growth={units:4,lastRenderedAt:0};for(let n=5;n<=100;n++){assert.ok(advanceReferenceGrowth(growth,n*150,100));growth.lastRenderedAt=n*150;}assert.equal(growth.units,100);});
for(const id of ['polyethylene-oxide','polybutadiene','polyisoprene','polylactic-acid','polyglycolic-acid'])test(`${id} validates the prefix, bonds and valences`,async()=>{
 const {finite,reference}=await fixture(id),result=connectPolymerReference(THREE,finite,reference,4),{plan,matched,removedFinite=[],bridge}=result;
 const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,refEdges=new Map(reference.bonds.map(b=>[key(b.a,b.b),b.order])),matchedByFinite=new Map(matched.map(m=>[m.finite,m]));
 for(const m of matched){assert.equal(plan.atoms[m.reference].element,finite.atoms[m.finite].element);assert.deepEqual([plan.atoms[m.reference].x,plan.atoms[m.reference].y,plan.atoms[m.reference].z],[finite.atoms[m.finite].x,finite.atoms[m.finite].y,finite.atoms[m.finite].z]);assert.equal(reference.atoms[m.prefixReference].element,finite.atoms[m.finite].element);}
 for(const b of finite.bonds)if(!removedFinite.includes(b.a)&&!removedFinite.includes(b.b))assert.equal(refEdges.get(key(matchedByFinite.get(b.a).prefixReference,matchedByFinite.get(b.b).prefixReference)),b.order);
 const degree=plan.atoms.map(()=>0),neighbors=plan.atoms.map(()=>[]);for(const b of plan.bonds){degree[b.a]+=b.order;degree[b.b]+=b.order;neighbors[b.a].push(b.b);neighbors[b.b].push(b.a);}assert.ok(plan.atoms.every((a,i)=>degree[i]<=({C:4,O:2,H:1})[a.element]));
 const seen=new Set([0]),queue=[0];for(let k=0;k<queue.length;k++)for(const n of neighbors[queue[k]])if(!seen.has(n)){seen.add(n);queue.push(n);}assert.equal(seen.size,plan.atoms.length);
 assert.equal(plan.bonds.find(b=>key(b.a,b.b)===key(bridge.a,bridge.b)).order,1);
 if(removedFinite.length){const [o]=removedFinite.filter(i=>finite.atoms[i].element==='O'),[h]=removedFinite.filter(i=>finite.atoms[i].element==='H');assert.ok(finite.bonds.some(b=>key(b.a,b.b)===key(o,h)&&b.order===1));assert.ok(finite.bonds.some(b=>key(b.a,b.b)===key(o,matched.find(m=>m.reference===bridge.a).finite)&&b.order===1));assert.equal(plan.atoms[bridge.a].element,'C');assert.equal(plan.atoms[bridge.b].element,'O');}
 const bad=structuredClone(finite);const bond=bad.bonds.find(b=>b.order===2);if(bond){bond.order=1;assert.throws(()=>connectPolymerReference(THREE,bad,reference,4));}
});

test('growth never catches up by multiple units and waits for a rendered frame',()=>{
 const growth={units:4,lastRenderedAt:1000};assert.equal(advanceReferenceGrowth(growth,1149,100),false);assert.equal(growth.units,4);
 assert.equal(advanceReferenceGrowth(growth,2000,100),true);assert.equal(growth.units,5);assert.equal(advanceReferenceGrowth(growth,4000,100),false);
 growth.lastRenderedAt=4000;assert.equal(advanceReferenceGrowth(growth,4149,100),false);assert.equal(advanceReferenceGrowth(growth,4150,100),true);assert.equal(growth.units,6);
});

test('the five continuation graphs retain their characteristic chemistry',async()=>{
 for(const id of ['polyethylene-oxide','polybutadiene','polyisoprene','polylactic-acid','polyglycolic-acid']){
  const {finite,reference}=await fixture(id),{plan}=connectPolymerReference(THREE,finite,reference,4),adj=plan.atoms.map(()=>[]);for(const b of plan.bonds){adj[b.a].push({i:b.b,order:b.order});adj[b.b].push({i:b.a,order:b.order});}
  if(id==='polyethylene-oxide')assert.equal(plan.atoms.filter((a,i)=>a.element==='O'&&adj[i].filter(n=>plan.atoms[n.i].element==='C'&&n.order===1).length===2).length,99);
  if(id==='polybutadiene'||id==='polyisoprene'){
   assert.equal(plan.bonds.filter(b=>b.order===2&&plan.atoms[b.a].element==='C'&&plan.atoms[b.b].element==='C').length,100);
   assert.equal(plan.atoms.filter(a=>a.element==='C').length,id==='polybutadiene'?400:500);
   if(id==='polyisoprene')assert.equal(plan.atoms.filter((a,i)=>a.element==='C'&&adj[i].filter(n=>plan.atoms[n.i].element==='H').length===3&&adj[i].some(n=>plan.atoms[n.i].element==='C'&&!adj[n.i].some(k=>plan.atoms[k.i].element==='H')&&adj[n.i].some(k=>k.order===2&&plan.atoms[k.i].element==='C'))).length,100);
  }
  if(id==='polylactic-acid'||id==='polyglycolic-acid')assert.equal(plan.bonds.filter(b=>b.order===2&&[plan.atoms[b.a].element,plan.atoms[b.b].element].sort().join('')==='CO').length,100);
 }
});

test('PLA and PGA first continuation conserves atoms including water and the terminal cap',async()=>{
 const routes=(await load('../data/polymerization-routes.json')).routes,db=await load('../data/molecules.json');
 const counts=atoms=>atoms.reduce((a,x)=>{const e=typeof x==='string'?x:x.element;a[e]=(a[e]??0)+1;return a;},{C:0,H:0,O:0});
 for(const id of ['polylactic-acid','polyglycolic-acid']){
  const {finite,reference}=await fixture(id),result=connectPolymerReference(THREE,finite,reference,4),route=routes.find(r=>r.polymerId===id),monomer=db.find(m=>m.id===route.feedSpecies[0]);
  const original=counts(finite.atoms),incoming=counts(monomer.atoms),visible=counts(result.plan.atoms.filter(a=>a.unit<5));
  // The reference prefix has an open acyl port for unit six. Temporarily
  // cap it with OH to compare with the neutral five-unit product.
  assert.deepEqual({C:visible.C,H:visible.H+3,O:visible.O+2},{C:original.C+incoming.C,H:original.H+incoming.H,O:original.O+incoming.O});
 }
});
