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
async function fixture(polymerId){
 const authority=await load('../data/polymerization-routes.json'),db=await load('../data/molecules.json'),route=authority.routes.find(r=>r.polymerId===polymerId),records=db.filter(r=>[...route.feedSpecies,'water'].includes(r.id));
 const instances=route.representativeSequence.map((species,i)=>({id:`feed-${i}`,species,batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)}).ok,true);
 let result;for(let i=1;i<4;i++){assert.equal(core.beginManualStep(instances[i].id).ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);}
 const source={};for(const item of instances){const record=records.find(r=>r.id===item.species),model=createPreviewModel(THREE,record);for(let i=0;i<190;i++)model.step();source[item.id]={...record,...model.snapshot()};}
 const layout=createPolymerFragment3DLayout(result.sample,{sourceRecordsByInstanceId:source});assert.equal(layout.diagnostics.accepted,true);
 return {finite:{...result.sample.fragment,atoms:layout.atoms},reference:createPolymerReferenceModel(THREE,route.polymerId,100,{extraRepeat:true}),records};
}
const counts=atoms=>atoms.reduce((r,a)=>(r[typeof a==='string'?a:a.element]=(r[typeof a==='string'?a:a.element]??0)+1,r),{C:0,H:0,O:0,N:0});
const edge=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

for(const [id,donor,donorSpecies,donorCarbon] of [
 ['polyethylene-adipate','O','ethylene-glycol',2],
 ['polyethylene-adipamide','N','ethylenediamine',2],
 ['nylon-6-6','N','hexamethylenediamine',6],
]) test(`${id}: alternating condensation preserves the finite graph and grows to 100`,async()=>{
 const {finite,reference,records}=await fixture(id),before=JSON.stringify({finite,reference});
 const {plan,matched,removedFinite,bridge,water}=connectPolymerReference(THREE,finite,reference,4);
 assert.equal(JSON.stringify({finite,reference}),before);
 assert.equal(matched.length,finite.atoms.length-1);assert.equal(finite.atoms[removedFinite[0]].element,'H');assert.deepEqual(water.incoming,['O','H']);
 const map=new Map(matched.map(x=>[x.finite,x.reference])),edges=new Map(plan.bonds.map(b=>[edge(b.a,b.b),b.order]));
 for(const [f,r] of map)assert.deepEqual([plan.atoms[r].x,plan.atoms[r].y,plan.atoms[r].z],[finite.atoms[f].x,finite.atoms[f].y,finite.atoms[f].z]);
 for(const b of finite.bonds)if(map.has(b.a)&&map.has(b.b))assert.equal(edges.get(edge(map.get(b.a),map.get(b.b))),b.order);
 assert.equal(plan.atoms[bridge.a].element,donor);assert.equal(plan.atoms[bridge.b].element,'C');assert.equal(edges.get(edge(bridge.a,bridge.b)),1);
 const degrees=plan.atoms.map(()=>0),adj=plan.atoms.map(()=>[]);for(const b of plan.bonds){degrees[b.a]+=b.order;degrees[b.b]+=b.order;adj[b.a].push(b.b);adj[b.b].push(b.a);}
 assert.ok(adj[bridge.b].some(i=>plan.atoms[i].element==='O'&&edges.get(edge(bridge.b,i))===2));
 const carbonyl=i=>plan.atoms[i].element==='C'&&adj[i].some(j=>plan.atoms[j].element==='O'&&edges.get(edge(i,j))===2);
 const links=plan.bonds.filter(b=>b.order===1&&((carbonyl(b.a)&&plan.atoms[b.b].element===donor)||(carbonyl(b.b)&&plan.atoms[b.a].element===donor)));
 // Ester case includes the acid OH; amide case contains only links.
 assert.equal(links.length,donor==='O'?200:199);
 const acidEnds=plan.atoms.filter((a,i)=>a.element==='O'&&adj[i].some(carbonyl)&&adj[i].some(j=>plan.atoms[j].element==='H'));
 const donorEnds=plan.atoms.filter((a,i)=>a.element===donor&&adj[i].filter(j=>plan.atoms[j].element==='H').length===(donor==='O'?1:2)&&adj[i].some(j=>plan.atoms[j].element==='C'&&!carbonyl(j)));
 assert.equal(acidEnds.length,1);assert.equal(donorEnds.length,1);
 assert.equal(plan.unitCount,200);
 assert.ok(plan.atoms.every((a,i)=>degrees[i]===({H:1,C:4,O:2,N:3})[a.element]));
 const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adj[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}assert.equal(seen.size,plan.atoms.length);
 for(let u=4;u<200;u++){const c=counts(plan.atoms.filter(a=>a.unit===u));assert.equal(c.C,u%2===0?6:donorCarbon);assert.equal(c.N,donor==='N'&&u%2===1?2:0);}
 const acid=counts(records.find(x=>x.id==='adipic-acid').atoms),other=counts(records.find(x=>x.id===donorSpecies).atoms),total=counts(plan.atoms);
 assert.deepEqual(total,{C:100*(acid.C+other.C),H:100*(acid.H+other.H)-398,O:100*(acid.O+other.O)-199,N:100*(acid.N+other.N)});
 let growth={units:4,lastRenderedAt:0};for(let i=5;i<=200;i++){assert.equal(advanceReferenceGrowth(growth,i*150,200),true);growth.lastRenderedAt=i*150;}assert.equal(growth.units,200);
 const bad=structuredClone(finite);bad.bonds.find(b=>b.order===2).order=1;assert.throws(()=>connectPolymerReference(THREE,bad,reference,4));
 const disconnected=structuredClone(finite);disconnected.bonds.pop();assert.throws(()=>connectPolymerReference(THREE,disconnected,reference,4));
 for(const n of [10,30]){const ref=createPolymerReferenceModel(THREE,id,n,{extraRepeat:true}),smaller=connectPolymerReference(THREE,finite,ref,4);assert.equal(smaller.plan.unitCount,2*n);assert.equal(Math.max(...smaller.plan.atoms.map(a=>a.unit)),2*n-1);}
});
