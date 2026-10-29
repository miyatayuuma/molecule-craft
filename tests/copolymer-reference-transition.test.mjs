import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../src/reaction-lab-polymerization.js';
import {createPolymerFragment3DLayout} from '../src/polymer-fragment-3d-layout.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';
import {connectPolymerReference} from '../src/polymer-reference-transition.js';
import {advanceReferenceGrowth} from '../src/polymer-reference-renderer.js';
const load=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
const components={'ethene':'polyethylene','propene':'polypropylene','styrene':'polystyrene','1-3-butadiene':'polybutadiene','acrylonitrile':'polyacrylonitrile','isobutene':'polyisobutylene','isoprene':'polyisoprene','vinylidene-fluoride':'polyvinylidene-fluoride','hexafluoropropylene':'hfp-display-unit'};
const ids=['ethylene-propylene-copolymer','styrene-butadiene-copolymer','nitrile-butadiene-rubber','butyl-rubber','vinylidene-fluoride-hexafluoropropylene-copolymer'];
for(const id of ids)test(`${id} retains real finite prefix and extends the example sequence`,async()=>{
 const auth=await load('../data/polymerization-routes.json'),db=await load('../data/molecules.json'),route=auth.routes.find(r=>r.polymerId===id),records=db.filter(r=>route.feedSpecies.includes(r.id)),instances=route.representativeSequence.map((species,i)=>({id:`feed-${i}`,species,batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:auth.routes,sitePatterns:auth.sitePatterns});assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)}).ok,true);
 let result;for(let i=1;i<instances.length;i++){const begun=i<=route.interactionCadence.manualSteps?core.beginManualStep(instances[i].id):core.beginAutomaticStep(instances[i].id);assert.equal(begun.ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);}
 const sample=result.sample,source={};for(const item of instances){const rec=records.find(r=>r.id===item.species),model=createPreviewModel(THREE,rec);for(let i=0;i<190;i++)model.step();source[item.id]={...rec,...model.snapshot()};}
 const layout=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:source});assert.equal(layout.diagnostics.accepted,true);
 const finite={...sample.fragment,atoms:layout.atoms,activeEndAtom:core.snapshot().fragment.activeEndAtom,actualSequence:instances.map(x=>components[x.species]),aromaticCycles:[]};
 for(const item of instances){const rec=source[item.id];for(const cycle of rec.aromaticCycles??[])finite.aromaticCycles.push(cycle.map(j=>finite.atomOrigins.findIndex(o=>o.instanceId===item.id&&o.sourceAtomIndex===j)));}
 const ref=createPolymerReferenceModel(THREE,id,100),before=JSON.stringify({finite,ref}),result2=connectPolymerReference(THREE,finite,ref,3),{plan,matched,bridge}=result2;assert.equal(JSON.stringify({finite,ref}),before);assert.deepEqual(plan.sequence.slice(0,3),finite.actualSequence);assert.deepEqual(plan.sequence.slice(3),ref.sequence.slice(3));assert.equal(plan.unitCount,100);assert.equal(matched.length,finite.atoms.length);assert.equal(bridge.a,finite.activeEndAtom);assert.equal(plan.atoms[bridge.b].unit,3);
 const degrees=plan.atoms.map(()=>0),adj=plan.atoms.map(()=>[]);for(const b of plan.bonds){degrees[b.a]+=b.order;degrees[b.b]+=b.order;adj[b.a].push(b.b);adj[b.b].push(b.a);}assert.ok(plan.atoms.every((a,i)=>degrees[i]<=({C:4,H:1,N:3,F:1})[a.element]));const seen=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adj[queue[i]])if(!seen.has(n)){seen.add(n);queue.push(n);}assert.equal(seen.size,plan.atoms.length);
 if(id==='styrene-butadiene-copolymer')assert.ok(plan.aromaticCycles.length>0&&finite.aromaticCycles.every(c=>plan.aromaticCycles.some(x=>JSON.stringify(x)===JSON.stringify(c))));
 if(id==='nitrile-butadiene-rubber')assert.ok(plan.bonds.some(b=>b.order===3&&[plan.atoms[b.a].element,plan.atoms[b.b].element].sort().join('')==='CN'));
 if(['styrene-butadiene-copolymer','nitrile-butadiene-rubber','butyl-rubber'].includes(id))assert.ok(plan.bonds.some(b=>b.order===2&&plan.atoms[b.a].element==='C'&&plan.atoms[b.b].element==='C'));
 if(id==='vinylidene-fluoride-hexafluoropropylene-copolymer')assert.ok(plan.atoms.some(a=>a.element==='F'));
 let growth={units:3,lastRenderedAt:0};for(let i=4;i<=100;i++){assert.equal(advanceReferenceGrowth(growth,i*150,100),true);growth.lastRenderedAt=i*150;}assert.equal(growth.units,100);
});
