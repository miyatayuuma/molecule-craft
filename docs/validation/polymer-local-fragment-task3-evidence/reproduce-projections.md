# Analytical projection reproduction

Owner: [Task③ evidence](../polymer-local-fragment-task3-visual-evidence.md).

This is documentation tooling, not a viewer, chemistry oracle, screenshot generator or physical calibration. On the pinned source SHA, save only the following JavaScript block as `task3-projection.mjs` in the repository root, run `node task3-projection.mjs`, compare `/tmp/molecule-craft-task3-projections.json` with `analytical-projections.json`, then remove the temporary script. Node v24.19.0. It executes the production Core/preview/layout without changing inputs. For geometry revisions compare graph digests/target sets unchanged and rerun screen criteria; coordinate equality with this baseline is not required.

Canvas sizes are explicit **target layout budgets**, not measured future DOM rectangles. Radii/FOV are measured source constants. The search checks sphere-enclosing projection boxes; it does not measure raster occlusion, touch, material or performance.

```js
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from './vendor/three/three.module.min.js';
import {createPreviewModel} from './src/preview-model.js?v=35';
import {createPolymerFragment3DLayout} from './src/polymer-fragment-3d-layout.js';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from './src/reaction-lab-polymerization.js?v=1';
import {modelAtomRadius} from './src/chemistry.js?v=20';
const base=new URL('./',import.meta.url), read=async p=>JSON.parse(await readFile(new URL(p,base),'utf8'));
const authority=await read('data/polymerization-routes.json'), ids=new Set([...authority.routes.flatMap(r=>r.feedSpecies),'water']);
const records=(await read('data/molecules.json')).filter(r=>ids.has(r.id));
const source=Object.fromEntries(records.map(r=>{const m=createPreviewModel(THREE,r);for(let i=0;i<190;i++)m.step();const s=m.snapshot();return[r.id,{...r,atoms:s.atoms,bonds:s.bonds,aromaticCycles:s.aromaticCycles}]}));
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),rows=[];
for(const route of authority.routes){
 const instances=route.representativeSequence.map((species,i)=>({id:`u${i}`,species,batchGeneration:1}));
 const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});
 const begin=core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:1,instances,environment:new Set(route.environment.requires)});if(!begin.ok)throw Error(JSON.stringify(begin));
 let result;for(let i=1;i<instances.length;i++){const b=i<=route.interactionCadence.manualSteps?core.beginManualStep(instances[i].id):core.beginAutomaticStep(instances[i].id);if(!b.ok)throw Error(JSON.stringify(b));result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS)}
 const sample=result.sample,graph=sample.fragment,src=Object.fromEntries(instances.map(i=>[i.id,source[i.species]]));
 const layout=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:src}),el=i=>graph.atoms[i].element;
 const bs=graph.bonds.map((b,i)=>({...b,index:i})),adj=graph.atoms.map((a,i)=>bs.filter(b=>b.a===i||b.b===i).map(b=>({i:b.a===i?b.b:b.a,b})));
 const carbonyl=bs.filter(b=>b.order===2&&[el(b.a),el(b.b)].sort().join()==='C,O');
 const ringSets=[];for(const inst of instances)for(const cycle of source[inst.species].aromaticCycles??[]){const indices=(cycle.atoms??cycle.atomIds??cycle).map(si=>graph.atomOrigins.findIndex(o=>o.instanceId===inst.id&&o.sourceAtomIndex===si));if(indices.every(i=>i>=0))ringSets.push(indices)}
 const selector={orders:Object.fromEntries([1,2,3].map(o=>[o,bs.filter(b=>b.order===o).map(b=>b.index)])),carbonyl:carbonyl.map(b=>b.index),nitrile:bs.filter(b=>b.order===3&&[el(b.a),el(b.b)].sort().join()==='C,N').map(b=>b.index),interSourceHeavy:bs.filter(b=>el(b.a)!=='H'&&el(b.b)!=='H'&&graph.atomOrigins[b.a].instanceId!==graph.atomOrigins[b.b].instanceId).map(b=>b.index),sourceAtoms:Object.fromEntries(instances.map(inst=>[inst.id,graph.atomOrigins.flatMap((o,i)=>o.instanceId===inst.id?[i]:[])])),rings:ringSets,methyl:graph.atoms.flatMap((a,i)=>el(i)==='C'&&adj[i].filter(n=>el(n.i)==='H').length===3?[i]:[])};
 const aromaticAtoms=new Set(selector.rings.flat()),carbonylC=new Set(carbonyl.map(b=>el(b.a)==='C'?b.a:b.b));
 selector.ringBonds=selector.rings.map(c=>bs.filter(b=>c.includes(b.a)&&c.includes(b.b)).map(b=>b.index));
 selector.ester=bs.filter(b=>b.order===1&&((carbonylC.has(b.a)&&el(b.b)==='O'&&adj[b.b].filter(n=>el(n.i)==='C').length===2)||(carbonylC.has(b.b)&&el(b.a)==='O'&&adj[b.a].filter(n=>el(n.i)==='C').length===2))).map(b=>b.index);
 selector.amide=bs.filter(b=>b.order===1&&((carbonylC.has(b.a)&&el(b.b)==='N')||(carbonylC.has(b.b)&&el(b.a)==='N'))).map(b=>b.index);
 selector.etherO=graph.atoms.flatMap((a,i)=>el(i)==='O'&&adj[i].filter(n=>el(n.i)==='C'&&!carbonylC.has(n.i)).length===2?[i]:[]);
 selector.acidOH=graph.atoms.flatMap((a,i)=>el(i)==='O'&&adj[i].some(n=>el(n.i)==='H')&&adj[i].some(n=>carbonylC.has(n.i))?[i]:[]);
 selector.methyleneBridge=graph.atoms.flatMap((a,i)=>el(i)==='C'&&adj[i].filter(n=>aromaticAtoms.has(n.i)).length===2&&adj[i].filter(n=>el(n.i)==='H').length===2?[i]:[]);
 selector.hydroxymethyl=graph.atoms.flatMap((a,i)=>el(i)==='C'&&adj[i].some(n=>aromaticAtoms.has(n.i))&&adj[i].some(n=>el(n.i)==='O'&&adj[n.i].some(t=>el(t.i)==='H'))&&adj[i].filter(n=>el(n.i)==='H').length===2?[i]:[]);
 // Chain backbone is a source-site mapping, never a longest geometric path.
 if(route.builder==='chain'){
  const keys=new Set();for(const inst of instances){const sr=source[inst.species],rings=new Set((sr.aromaticCycles??[]).flatMap(c=>c.atoms??c.atomIds??c)),getE=i=>typeof sr.atoms[i]==='string'?sr.atoms[i]:sr.atoms[i].element;
   if(route.transformFamilies.includes('epoxide'))sr.atoms.forEach((a,i)=>{if(getE(i)==='C'||getE(i)==='O')keys.add(inst.id+':'+i)});
   else for(const bond of sr.bonds){const a=Array.isArray(bond)?bond[0]:bond.a,b=Array.isArray(bond)?bond[1]:bond.b,o=Array.isArray(bond)?bond[2]:bond.order;if(o===2&&getE(a)==='C'&&getE(b)==='C'&&!rings.has(a)&&!rings.has(b)){keys.add(inst.id+':'+a);keys.add(inst.id+':'+b)}}
  }
  selector.backboneAtoms=graph.atomOrigins.flatMap((o,i)=>keys.has(o.instanceId+':'+o.sourceAtomIndex)?[i]:[]);
  selector.backboneBonds=bs.filter(b=>selector.backboneAtoms.includes(b.a)&&selector.backboneAtoms.includes(b.b)).map(b=>b.index);
  selector.sideAttachment=bs.filter(b=>el(b.a)!=='H'&&el(b.b)!=='H'&&(selector.backboneAtoms.includes(b.a)!==selector.backboneAtoms.includes(b.b))).map(b=>b.index);
 }
 const viewports=[{w:360,h:780,cw:338,ch:430},{w:390,h:844,cw:368,ch:494},{w:1280,h:800,cw:856,ch:420}];
 const measurements=[];
 for(const vp of viewports){
  const W=vp.cw,H=vp.ch, safe={l:12,t:74,r:W-78,b:H-82}; // conservative whole-width reserves actual equipment plus 12px margin
  const sw=safe.r-safe.l,sh=safe.b-safe.t,cx=(safe.l+safe.r)/2,cy=(safe.t+safe.b)/2,f=H/(2*Math.tan(21*Math.PI/180)),d=15;
  const measure=(q,s)=>{const pts=layout.atoms.map(a=>new THREE.Vector3(a.x,a.y,a.z).applyQuaternion(q).multiplyScalar(s));let tx=(cx-W/2)*d/f,ty=(H/2-cy)*d/f;
   const project=()=>{const p=pts.map((p,i)=>{const radius=modelAtomRadius(el(i))*s,z=d-p.z;return{x:W/2+f*(p.x+tx)/z,y:H/2-f*(p.y+ty)/z,diam:2*f*radius/z,z,rs:radius,px:p.x+tx,py:p.y+ty}});
    const all=p.flatMap(a=>[-1,1].flatMap(ix=>[-1,1].flatMap(iy=>[-1,1].map(iz=>({x:W/2+f*(a.px+ix*a.rs)/(a.z+iz*a.rs),y:H/2-f*(a.py+iy*a.rs)/(a.z+iz*a.rs)})))));
    const bounds=[Math.min(...all.map(a=>a.x)),Math.min(...all.map(a=>a.y)),Math.max(...all.map(a=>a.x)),Math.max(...all.map(a=>a.y))];return{p,bounds};};
   let result;for(let k=0;k<8;k++){result=project();const dx=cx-(result.bounds[0]+result.bounds[2])/2,dy=cy-(result.bounds[1]+result.bounds[3])/2;if(Math.hypot(dx,dy)<=.1)break;tx+=dx*d/f;ty-=dy*d/f}result=project();const {p,bounds}=result;
   const fits=bounds[0]>=safe.l&&bounds[1]>=safe.t&&bounds[2]<=safe.r&&bounds[3]<=safe.b&&p.every(a=>a.z-a.rs>.2&&a.z+a.rs<500);
   return{fits,bounds,translation:[tx,ty,0],centerError:Math.hypot(cx-(bounds[0]+bounds[2])/2,cy-(bounds[1]+bounds[3])/2),occupancy:Math.max((bounds[2]-bounds[0])/sw,(bounds[3]-bounds[1])/sh),minH:Math.min(...p.filter((a,i)=>el(i)==='H').map(a=>a.diam)),minHeavy:Math.min(...p.filter((a,i)=>el(i)!=='H').map(a=>a.diam)),qMin:Math.min(...p.map(a=>f*s/a.z))};};
  let best=null;
  for(const roll of [0,Math.PI/2])for(const yaw of Array.from({length:8},(_,i)=>i*Math.PI/4))for(const pitch of [-Math.PI/6,0,Math.PI/6]){
   const euler=[.34+pitch,-.28+yaw,.035+roll],q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...euler,'XYZ'));
   let lo=0,hi=8;for(let j=0;j<32;j++){const s=(lo+hi)/2;if(measure(q,s).fits)lo=s;else hi=s}const s=lo*.92,m=measure(q,s);
   if(!best||m.qMin>best.qMin+1e-9)best={...m,s,euler};
  }
  measurements.push({viewport:[vp.w,vp.h],assumedCanvas:[W,H],safe,best});
 }
 rows.push({polymerId:route.polymerId,routeId:route.routeId,sourceSequence:route.representativeSequence,sampleId:sample.sampleId,graphDigest:sha(graph),graph,selector,evidence:sample.evidence,representation:sample.representation,layout:{atoms:layout.atoms.map(a=>({id:a.id,x:a.x,y:a.y,z:a.z})),diagnostics:layout.diagnostics},measurements});
}
await writeFile('/tmp/molecule-craft-task3-projections.json',JSON.stringify({sourceSha:'905ba4f1fb4a0e6d63e658a9f178ac29ad8beb49',kind:'ANALYTICAL_PROJECTION_NOT_SCREENSHOT',sourcePolicy:'u0..uN; 190 preview steps; Core exact representative sequence; layout default 96; d15 FOV42',rows},null,2)+'\n');
console.log(JSON.stringify(rows.map(r=>({id:r.polymerId,A:r.graph.atoms.length,rings:r.selector.rings.length,views:r.measurements.map(m=>({v:m.viewport,h:m.best.minH,c:m.best.minHeavy,q:m.best.qMin,occupancy:m.best.occupancy}))})),null,2));

```
