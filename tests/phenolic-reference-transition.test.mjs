import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js';
import {createPreviewModel} from '../src/preview-model.js';import {createPolymerFragment3DLayout} from '../src/polymer-fragment-3d-layout.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';import {connectPolymerReference} from '../src/polymer-reference-transition.js';
import {advanceReferenceGrowth} from '../src/polymer-reference-renderer.js';
const load=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
test('phenolic finite sample forms 100-ring branched display through dehydration',async()=>{
 const authority=await load('../data/polymerization-routes.json'),route=authority.routes.find(r=>r.routeId==='phenol-formaldehyde-resole'),db=await load('../data/molecules.json'),records=db.filter(r=>[...route.feedSpecies,'water'].includes(r.id)),instances=route.representativeSequence.map((species,i)=>({id:`feed-${i}`,species,batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)}).ok,true);let result;for(let i=1;i<4;i++){assert.equal(core.beginManualStep(instances[i].id).ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);}const sample=result.sample,source={};for(const item of instances){const record=records.find(r=>r.id===item.species),model=createPreviewModel(THREE,record);for(let i=0;i<190;i++)model.step();source[item.id]={...record,...model.snapshot()};}
 const layout=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:source});assert.equal(layout.diagnostics.accepted,true);const finite={...sample.fragment,atoms:layout.atoms,aromaticCycles:[],formaldehydeOrigins:instances.filter(x=>x.species==='formaldehyde').map(x=>x.id)};for(const item of instances)for(const cycle of source[item.id].aromaticCycles??[])finite.aromaticCycles.push(cycle.map(i=>finite.atomOrigins.findIndex(o=>o.instanceId===item.id&&o.sourceAtomIndex===i)));
 const reference=await load('../data/phenolic-reference-100.json');assert.deepEqual(reference,createPolymerReferenceModel(THREE,sample.polymerId,100),'prebuilt reference must preserve the canonical 100-ring chemistry and XYZ');const before=JSON.stringify({sample,finite,reference}),out=connectPolymerReference(THREE,finite,reference,2),{plan,matched,removedFinite,bridge,water}=out;assert.equal(JSON.stringify({sample,finite,reference}),before);assert.equal(finite.aromaticCycles.length,2);assert.equal(plan.aromaticCycles.length,100);assert.equal(plan.bridges.length,99);assert.equal(plan.initialFiniteUnits,2);assert.equal(plan.atoms[bridge.b].unit,2);assert.equal(matched.length+removedFinite.length,finite.atoms.length);
 assert.deepEqual(removedFinite.map(i=>finite.atoms[i].element).sort(),['H','O']);assert.deepEqual(water.finite,removedFinite);assert.equal(water.incoming.length,1);assert.equal(reference.atoms[water.incoming[0]].element,'H');assert.equal(finite.atoms[removedFinite[0]].element,'O');assert.ok(finite.bonds.some(b=>(b.a===removedFinite[0]&&b.b===removedFinite[1])||(b.b===removedFinite[0]&&b.a===removedFinite[1])));
 const degree=plan.atoms.map(()=>0),adj=plan.atoms.map(()=>[]);for(const b of plan.bonds){degree[b.a]+=b.order;degree[b.b]+=b.order;adj[b.a].push(b.b);adj[b.b].push(b.a);}assert.ok(plan.atoms.every((a,i)=>degree[i]===({C:4,H:1,O:2})[a.element]));const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adj[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}assert.equal(seen.size,plan.atoms.length);assert.equal(new Set(plan.bridges.flatMap(b=>b.sites)).size,198);assert.ok(plan.bridges.some(b=>b.atom===bridge.a));
 for(const pair of matched)assert.deepEqual([plan.atoms[pair.reference].x,plan.atoms[pair.reference].y,plan.atoms[pair.reference].z],[finite.atoms[pair.finite].x,finite.atoms[pair.finite].y,finite.atoms[pair.finite].z]);
 const tally=atoms=>atoms.reduce((o,a)=>(o[typeof a==='string'?a:a.element]=(o[typeof a==='string'?a:a.element]??0)+1,o),{}),f=tally(finite.atoms),phenol=tally(records.find(r=>r.id==='phenol').atoms),formal=tally(records.find(r=>r.id==='formaldehyde').atoms),actual=tally(plan.atoms);for(const element of ['C','H','O'])assert.equal(actual[element]??0,(f[element]??0)+98*(phenol[element]??0)+97*(formal[element]??0)-98*({C:0,H:2,O:1})[element],`elemental balance ${element}`);
 const beforeElements=finite.atoms.reduce((o,a)=>(o[a.element]=(o[a.element]??0)+1,o),{}),retained=matched.reduce((o,m)=>(o[finite.atoms[m.finite].element]=(o[finite.atoms[m.finite].element]??0)+1,o),{});assert.equal(beforeElements.O-retained.O,1);assert.equal(beforeElements.H-retained.H,1);assert.equal(beforeElements.C-retained.C,0);
 let growth={units:2,lastRenderedAt:0};for(let n=3;n<=100;n++){assert.ok(advanceReferenceGrowth(growth,n*150,100));growth.lastRenderedAt=n*150;}assert.equal(growth.units,100);
 const bad=structuredClone(finite);bad.bonds.pop();assert.throws(()=>connectPolymerReference(THREE,bad,reference,2));const noMethylol=structuredClone(finite);noMethylol.formaldehydeOrigins=[];assert.throws(()=>connectPolymerReference(THREE,noMethylol,reference,2));

 // Rotating the distal phenol about its real bridge bond preserves all
 // finite bonds and bond angles but changes the available 3D collision space.
 const ringTwo=new Set(finite.aromaticCycles[1]),ringOne=new Set(finite.aromaticCycles[0]);
 const bridgeCarbon=finite.atoms.findIndex((atom,i)=>atom.element==='C'&&!ringOne.has(i)&&!ringTwo.has(i)&&finite.bonds.filter(b=>b.a===i||b.b===i).some(b=>ringOne.has(b.a===i?b.b:b.a))&&finite.bonds.filter(b=>b.a===i||b.b===i).some(b=>ringTwo.has(b.a===i?b.b:b.a)));
 assert.ok(bridgeCarbon>=0);
 const secondPort=finite.bonds.flatMap(b=>b.a===bridgeCarbon&&ringTwo.has(b.b)?[b.b]:b.b===bridgeCarbon&&ringTwo.has(b.a)?[b.a]:[])[0];
 const position=i=>new THREE.Vector3(finite.atoms[i].x,finite.atoms[i].y,finite.atoms[i].z);
 const center=position(bridgeCarbon),axis=position(secondPort).sub(center).normalize();
 const rotated=new Set([bridgeCarbon]),rotationQueue=[secondPort];
 for(let j=0;j<rotationQueue.length;j++){const i=rotationQueue[j];if(rotated.has(i))continue;rotated.add(i);for(const bond of finite.bonds){const neighbor=bond.a===i?bond.b:bond.b===i?bond.a:null;if(neighbor!==null&&!rotated.has(neighbor))rotationQueue.push(neighbor);}}
 rotated.delete(bridgeCarbon);
 for(const angle of [Math.PI/5,2*Math.PI/5,4*Math.PI/5]){
  const variant=structuredClone(finite),q=new THREE.Quaternion().setFromAxisAngle(axis,angle);
  for(const i of rotated){const p=position(i).sub(center).applyQuaternion(q).add(center);Object.assign(variant.atoms[i],{x:p.x,y:p.y,z:p.z});}
  const connected=connectPolymerReference(THREE,variant,reference,2);
  assert.equal(connected.plan.aromaticCycles.length,100);
  for(const pair of connected.matched)assert.deepEqual([connected.plan.atoms[pair.reference].x,connected.plan.atoms[pair.reference].y,connected.plan.atoms[pair.reference].z],[variant.atoms[pair.finite].x,variant.atoms[pair.finite].y,variant.atoms[pair.finite].z]);
 }

});
