import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js';
import {createPolymerFragment3DLayout} from '../src/polymer-fragment-3d-layout.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';
import {connectPolymerReference} from '../src/polymer-reference-transition.js';
import {advanceReferenceGrowth} from '../src/polymer-reference-renderer.js';
const load=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
async function fixture(){
 const authority=await load('../data/polymerization-routes.json'),db=await load('../data/molecules.json'),route=authority.routes.find(r=>r.polymerId==='polyethylene-terephthalate'),records=db.filter(r=>[...route.feedSpecies,'water'].includes(r.id));
 const instances=route.representativeSequence.map((species,i)=>({id:`feed-${i}`,species,batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)}).ok,true);
 let result;for(let i=1;i<4;i++){assert.equal(core.beginManualStep(instances[i].id).ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);}
 const source={};for(const item of instances){const record=records.find(r=>r.id===item.species),model=createPreviewModel(THREE,record);for(let i=0;i<190;i++)model.step();source[item.id]={...record,...model.snapshot()};}
 const layout=createPolymerFragment3DLayout(result.sample,{sourceRecordsByInstanceId:source});assert.equal(layout.diagnostics.accepted,true);
 return {finite:{...result.sample.fragment,atoms:layout.atoms},reference:createPolymerReferenceModel(THREE,route.polymerId,100,{extraRepeat:true}),records};
}
const counts=atoms=>atoms.reduce((r,a)=>(r[typeof a==='string'?a:a.element]=(r[typeof a==='string'?a:a.element]??0)+1,r),{C:0,H:0,O:0});
const edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
test('PET retains the finite sample and grows alternating monomers with dehydration',async()=>{
 const {finite,reference,records}=await fixture(),before=JSON.stringify({finite,reference}),{plan,matched,removedFinite,bridge,water}=connectPolymerReference(THREE,finite,reference,4);
 assert.equal(JSON.stringify({finite,reference}),before);assert.equal(matched.length+1,finite.atoms.length);assert.equal(finite.atoms[removedFinite[0]].element,'H');assert.deepEqual(water.incoming,['O','H']);
 const mapping=new Map(matched.map(x=>[x.finite,x.reference]));for(const m of matched)assert.deepEqual([plan.atoms[m.reference].x,plan.atoms[m.reference].y,plan.atoms[m.reference].z],[finite.atoms[m.finite].x,finite.atoms[m.finite].y,finite.atoms[m.finite].z]);
 const bonds=new Map(plan.bonds.map(b=>[edge(b.a,b.b),b.order]));for(const b of finite.bonds)if(mapping.has(b.a)&&mapping.has(b.b))assert.equal(bonds.get(edge(mapping.get(b.a),mapping.get(b.b))),b.order);
 assert.equal(plan.atoms[bridge.a].element,'O');assert.equal(plan.atoms[bridge.b].element,'C');assert.equal(bonds.get(edge(bridge.a,bridge.b)),1);assert.ok(plan.bonds.some(b=>b.order===2&&[b.a,b.b].includes(bridge.b)&&plan.atoms[b.a===bridge.b?b.b:b.a].element==='O'));
 const degrees=plan.atoms.map(()=>0),adj=plan.atoms.map(()=>[]);for(const b of plan.bonds){degrees[b.a]+=b.order;degrees[b.b]+=b.order;adj[b.a].push(b.b);adj[b.b].push(b.a);}assert.ok(plan.atoms.every((a,i)=>degrees[i]===({H:1,C:4,O:2})[a.element]));const seen=new Set([0]),q=[0];for(let i=0;i<q.length;i++)for(const j of adj[q[i]])if(!seen.has(j)){seen.add(j);q.push(j);}assert.equal(seen.size,plan.atoms.length);
 for(let u=4;u<200;u++){const c=counts(plan.atoms.filter(a=>a.unit===u));assert.equal(c.C,u%2===0?8:2,`unit ${u} alternates acid and glycol`);assert.equal(c.O,u%2===0?2:2);}
 assert.equal(plan.bonds.filter(b=>b.order===1&&((plan.atoms[b.a].element==='O'&&plan.atoms[b.b].element==='C'&&adj[b.b].some(i=>plan.atoms[i].element==='O'&&bonds.get(edge(b.b,i))===2))||(plan.atoms[b.b].element==='O'&&plan.atoms[b.a].element==='C'&&adj[b.a].some(i=>plan.atoms[i].element==='O'&&bonds.get(edge(b.a,i))===2)))).length,200); // 199 esters and the terminal acid OH
 assert.equal(plan.aromaticCycles.length,100);assert.equal(plan.aromaticCycles.filter(c=>c.every(i=>plan.atoms[i].unit<4)).length,2);
 const acid=records.find(x=>x.id==='terephthalic-acid'),glycol=records.find(x=>x.id==='ethylene-glycol'),original=counts(finite.atoms),incoming=counts(acid.atoms),five=counts(plan.atoms.filter(a=>a.unit<5));
 // Five-unit display has an open acid end: add OH as terminal cap, plus H2O.
 assert.deepEqual({C:five.C,H:five.H+3,O:five.O+2},{C:original.C+incoming.C,H:original.H+incoming.H,O:original.O+incoming.O});
 const total=counts(plan.atoms),a=counts(acid.atoms),g=counts(glycol.atoms);assert.deepEqual(total,{C:100*(a.C+g.C),H:100*(a.H+g.H)-2*199,O:100*(a.O+g.O)-199});
 let growth={units:4,lastRenderedAt:0};for(let i=5;i<=200;i++){assert.equal(advanceReferenceGrowth(growth,i*150,200),true);growth.lastRenderedAt=i*150;}assert.equal(growth.units,200);
});

test('PET rejects an altered finite graph and supports smaller requested sizes',async()=>{
 const {finite,reference}=await fixture(),bad=structuredClone(finite);bad.bonds.find(b=>b.order===2).order=1;assert.throws(()=>connectPolymerReference(THREE,bad,reference,4));
 for(const units of [10,30]){const ref=createPolymerReferenceModel(THREE,reference.polymerId,units,{extraRepeat:true}),result=connectPolymerReference(THREE,finite,ref,4);assert.equal(result.plan.unitCount,units*2);assert.equal(Math.max(...result.plan.atoms.map(a=>a.unit)),units*2-1);assert.equal(result.plan.aromaticCycles.length,units);}
});

test('PET re-FEED pose finds a non-overlapping continuation without moving the finite graph',async()=>{
 const {sample,sources}=await load('./fixtures/r9d-pet-refeed.json');
 const layout=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:sources});assert.equal(layout.diagnostics.accepted,true);
 const finite={...sample.fragment,atoms:layout.atoms},before=JSON.stringify(finite),reference=createPolymerReferenceModel(THREE,sample.polymerId,100,{extraRepeat:true});
 const {plan,matched,bridge}=connectPolymerReference(THREE,finite,reference,4);
 assert.equal(JSON.stringify(finite),before);assert.equal(plan.unitCount,200);
 for(const {finite:f,reference:r} of matched)assert.deepEqual([plan.atoms[r].x,plan.atoms[r].y,plan.atoms[r].z],[finite.atoms[f].x,finite.atoms[f].y,finite.atoms[f].z]);
 const p=a=>new THREE.Vector3(a.x,a.y,a.z),gap=p(plan.atoms[bridge.a]).distanceTo(p(plan.atoms[bridge.b]));assert.ok(gap>.9&&gap<1.3,'continuation bond retains a realistic rendered length');
});
