import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerFragment3DLayout,resolvePolymerFragmentTargets} from '../src/polymer-fragment-3d-layout.js';
import {polymerTask4Fixtures} from './helpers/polymer-task4-fixtures.mjs';
import {fitPolymerObservation,polymerSafeRectangle,polymerLaneOffsets,polymerLaneRadius,resizePolymerCanvas,polymerComparisonGraphs,updatePolymerComparisonLanes,polymerLocalObservationTargets,polymerLocalOrientationCandidates} from '../src/reaction-lab-polymer-presentation.js';
import {modelAtomRadius} from '../src/chemistry.js';
const fixtures=await polymerTask4Fixtures();
test('graph-derived local frames are finite, deterministic and preserve tilted planar and linear geometry',()=>{
  const camera=new THREE.PerspectiveCamera(42,1,.1,500);camera.position.set(0,0,15);camera.lookAt(0,0,0);
  const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.71),ring={atoms:Array.from({length:6},(_,i)=>{const p=new THREE.Vector3(Math.cos(i*Math.PI/3),Math.sin(i*Math.PI/3),0).applyQuaternion(tilt);return{element:'C',x:p.x,y:p.y,z:p.z};}),bonds:Array.from({length:6},(_,i)=>({a:i,b:(i+1)%6,order:1}))},linear={atoms:[{element:'C',x:0,y:0,z:0},{element:'N',x:0,y:3.4,z:0}],bonds:[{a:0,b:1,order:3}]};
  for(const plan of [ring,linear]){const before=JSON.stringify(plan),input={plan,bondIndices:plan.bonds.map((_,i)=>i),camera},frames=polymerLocalOrientationCandidates(THREE,input);assert.equal(frames.length,4);assert.deepEqual(polymerLocalOrientationCandidates(THREE,input),frames);for(const frame of frames){assert.ok(frame.quaternion.toArray().every(Number.isFinite));assert.ok(Math.abs(frame.quaternion.length()-1)<1e-12);const z=plan.atoms.map(a=>new THREE.Vector3(a.x,a.y,a.z).applyQuaternion(frame.quaternion).z);assert.ok(Math.max(...z)-Math.min(...z)<1e-12);}assert.equal(JSON.stringify(plan),before);}
  for(const x of [0,NaN,Infinity])assert.throws(()=>polymerLocalOrientationCandidates(THREE,{plan:{atoms:[{element:'C',x:0,y:0,z:0},{element:'C',x,y:0,z:0}],bonds:[{a:0,b:1,order:1}]},bondIndices:[0],camera}),/POLYMER_DEGENERATE_LOCAL_EDGE/);
});
test('local junction/site selection preserves the real graph and all geminal methyl hydrogens',()=>{
  for(const row of fixtures){const before=JSON.stringify(row.sample),s=resolvePolymerFragmentTargets(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId,route:row.route}),resolved=JSON.stringify(s),targets=polymerLocalObservationTargets(row.sample.fragment,s),g=row.sample.fragment;
    for(const {target:t}of targets){assert.ok(t.atomIndices.includes(t.anchor));assert.deepEqual(t.originTuples,t.atomIndices.map(i=>g.atomOrigins[i]));for(const index of t.bondIndices){const b=g.bonds[index];assert.ok(t.atomIndices.includes(b.a)&&t.atomIndices.includes(b.b));}}
    if(row.sample.polymerId==='polyisobutylene'){const junctions=targets.filter(t=>t.target.kind==='local:side/junction/adjacent-backbone');assert.equal(junctions.length,4);for(const {target:t}of junctions){const methyls=s.methyl.filter(m=>m.atomIndices.includes(t.anchor));assert.equal(methyls.length,2);assert.equal(new Set(methyls.flatMap(m=>m.atomIndices).filter(i=>g.atoms[i].element==='H')).size,6);assert.ok(methyls.flatMap(m=>m.atomIndices).every(i=>t.atomIndices.includes(i)));}}
    if(row.sample.polymerId==='nylon-6-6'){const amides=targets.filter(t=>t.target.kind==='local:amide');assert.equal(amides.length,3);assert.equal(new Set(amides.map(t=>JSON.stringify(t.target.atomIndices))).size,3);assert.ok(amides.every(t=>t.target.atomIndices.length<g.atoms.length));}
    assert.equal(JSON.stringify(row.sample),before);assert.equal(JSON.stringify(s),resolved);
  }
});
test('all 25 real graphs fit full visual envelopes in DOM-shaped safe rectangles at three canvas sizes; reset is deterministic',()=>{
  const camera=new THREE.PerspectiveCamera(42,1,.1,500);camera.position.set(0,0,15);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  for(const row of fixtures){const plan=createPolymerFragment3DLayout(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId});
    for(const [width,height]of [[338,430],[368,494],[856,420]]){camera.aspect=width/height;camera.updateProjectionMatrix();const safeRegion=polymerSafeRectangle(width,height,[{left:width/2-36,right:width/2+36,top:5,bottom:60},{left:width-64,right:width-6,top:height/2-30,bottom:height/2+30},{left:7,right:71,top:height-70,bottom:height-22},{left:82,right:width-74,top:height-48,bottom:height-8}]);assert.ok(safeRegion);const requiredAtomIndices=row.route.builder==='network'?[]:resolvePolymerFragmentTargets(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId,route:row.route}).ends.atomIndices,input={plan,camera,width,height,safeRegion,requiredAtomIndices},fit=fitPolymerObservation(THREE,input);assert.ok(fit.fits,row.route.routeId);assert.ok(fit.occupancy>=.69&&fit.occupancy<=.95);assert.ok(fit.qMin>0);assert.ok(fit.initialTargetVisibility.every(x=>x.visibleFraction>=.70));assert.deepEqual(fitPolymerObservation(THREE,input),fit);}
  }
});
test('triple lanes preserve actual PAN four and NBR one bonds; offsets and widths are distinct',()=>{
  assert.deepEqual(polymerLaneOffsets(1),[0]);assert.deepEqual(polymerLaneOffsets(2),[-.08,.08]);assert.deepEqual(polymerLaneOffsets(3),[-.16,0,.16]);assert.equal(polymerLaneRadius(1),.05);assert.equal(polymerLaneRadius(3),.038);assert.throws(()=>polymerLaneOffsets(4));
  for(const [id,count]of [['polyacrylonitrile',4],['nitrile-butadiene-rubber',1]])assert.equal(fixtures.find(r=>r.sample.polymerId===id).sample.fragment.bonds.filter(b=>b.order===3).length,count);
});
test('initial fit rejects an endpoint hidden by a frozen ordinary atom and deterministically reuses the same input',()=>{
  const row=fixtures.find(r=>r.sample.polymerId==='polyethylene'),plan=createPolymerFragment3DLayout(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId}),camera=new THREE.PerspectiveCamera(42,338/430,.1,500);camera.position.set(0,0,15);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const requiredAtomIndices=resolvePolymerFragmentTargets(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId,route:row.route}).ends.atomIndices,input={plan,camera,width:338,height:430,safeRegion:polymerSafeRectangle(338,430,[]),requiredAtomIndices},clear=fitPolymerObservation(THREE,input),a=plan.atoms[requiredAtomIndices[0]],point=new THREE.Vector3(a.x,a.y,a.z).applyQuaternion(new THREE.Quaternion(...clear.quaternion)).multiplyScalar(clear.scale).add(new THREE.Vector3(...clear.position)).lerp(camera.position,.5),occludingAtoms=[{instanceId:'frozen-ordinary-atom',atomIndex:0,point:point.toArray(),radius:modelAtomRadius(a.element)*clear.scale*.65}],frozen=JSON.stringify(occludingAtoms);
  assert.throws(()=>fitPolymerObservation(THREE,{...input,quaternion:new THREE.Quaternion(...clear.quaternion),occludingAtoms}),/POLYMER_FIT_UNAVAILABLE/);
  const repaired=fitPolymerObservation(THREE,{...input,occludingAtoms});assert.notDeepEqual(repaired.quaternion,clear.quaternion);assert.ok(repaired.initialTargetVisibility.every(v=>v.visibleFraction>=.70));assert.deepEqual(fitPolymerObservation(THREE,{...input,occludingAtoms}),repaired);assert.deepEqual(repaired.visibilityOccluders,occludingAtoms);assert.notEqual(repaired.visibilityOccluders[0].point,occludingAtoms[0].point);assert.equal(JSON.stringify(occludingAtoms),frozen);
});
test('comparison multiple lanes retain the real bond length and face the camera after refit, including end-on fallback',()=>{
  const plan={atoms:[{element:'C',x:0,y:0,z:0},{element:'N',x:0,y:3.4,z:0}],bonds:[{a:0,b:1,order:3}]},camera=new THREE.PerspectiveCamera(42,1,.1,500);camera.position.set(0,0,15);camera.lookAt(0,0,0);
  const group=new THREE.Group();group.userData.bondLanes=polymerLaneOffsets(3).map(offset=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,12),new THREE.MeshStandardMaterial());mesh.userData={bondIndex:0,offset};group.add(mesh);return mesh;});const geometries=group.children.map(m=>m.geometry);
  for(const q of [new THREE.Quaternion(),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.7)]){group.quaternion.copy(q);updatePolymerComparisonLanes(THREE,group,plan,camera);for(const [i,m]of group.children.entries()){const offset=m.userData.offset,trim=e=>Math.sqrt(modelAtomRadius(e)**2-offset**2)-.01;assert.ok(Math.abs(m.scale.y-(3.4-trim('C')-trim('N')))<1e-10);assert.ok(Math.abs(m.position.x**2+m.position.z**2-offset**2)<1e-10);assert.equal(m.geometry,geometries[i]);assert.ok(m.position.toArray().every(Number.isFinite));}}
  group.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});
});
test('safe region rejects impossible UI and tie breaks deterministically',()=>{
  assert.equal(polymerSafeRectangle(200,200,[{left:0,right:200,top:0,bottom:200}]),null);assert.deepEqual(polymerSafeRectangle(400,400,[]),{left:12,right:388,top:12,bottom:388,width:376,height:376,area:376**2,centerDistance:0});
});
test('canvas buffer updates only on actual CSS or capped DPR changes',()=>{
  const canvas={width:338,height:430,getBoundingClientRect:()=>({width:338,height:430})},camera={aspect:338/430,updateProjectionMatrix(){}},calls=[];let ratio=1;
  const renderer={getPixelRatio:()=>ratio,setDrawingBufferSize(w,h,r){calls.push([w,h,r]);ratio=r;canvas.width=Math.floor(w*r);canvas.height=Math.floor(h*r);}};
  assert.equal(resizePolymerCanvas({canvas,renderer,camera,pixelRatio:1}).changed,false);assert.equal(calls.length,0);
  assert.equal(resizePolymerCanvas({canvas,renderer,camera,pixelRatio:3}).changed,true);assert.deepEqual(calls,[[338,430,2]]);assert.equal(resizePolymerCanvas({canvas,renderer,camera,pixelRatio:4}).changed,false);
});
test('comparison rejects tuple duplication or omission rather than inventing water/source evidence',()=>{
  const graph={atoms:[{element:'C'}],bonds:[],atomOrigins:[{instanceId:'a',sourceAtomIndex:0}]},sample={fragment:graph},sources=[{instanceId:'a',atoms:[{element:'C',point:[0,0,0]}],bonds:[]}];assert.equal(polymerComparisonGraphs(sample,sources,[]).after,graph);assert.throws(()=>polymerComparisonGraphs(sample,sources,[{graph}]),/DUPLICATE/);assert.throws(()=>polymerComparisonGraphs({fragment:{...graph,atomOrigins:[]}},sources,[]),/MISMATCH/);
});


test('all25 comparison source/after/water partitions use actual Core tuples and read-only transitions',()=>{
  for(const row of fixtures){const source=Object.entries(row.sourceRecordsByInstanceId).map(([instanceId,r])=>({instanceId,atoms:r.atoms.map(a=>({element:a.element,point:a.point.toArray()})),bonds:r.bonds})),before=JSON.stringify(row.sample),comparison=polymerComparisonGraphs(row.sample,source,row.comparisonEvidence.byproducts);assert.equal(comparison.byproducts.length,row.route.completionEvidence.byproducts.water);assert.equal(JSON.stringify(row.sample),before);assert.ok(comparison.transition.formed.length>0);if(row.route.polymerId==='polyethylene-oxide'){assert.equal(comparison.before.bonds.length-comparison.before.atoms.length+source.length,4);assert.equal(comparison.after.bonds.length-comparison.after.atoms.length+1,0);}}
});

test('local focus reserves full-graph clipping depth for all forty real orbit directions without reducing zoom',()=>{
  const camera=new THREE.PerspectiveCamera(42,338/430,.1,500);camera.position.set(0,0,15);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);const safeRegion=polymerSafeRectangle(338,430,[]),up=new THREE.Vector3(0,1,0),right=new THREE.Vector3(1,0,0);
  for(const row of fixtures){const plan=createPolymerFragment3DLayout(row.sample,{sourceRecordsByInstanceId:row.sourceRecordsByInstanceId});
    for(const index of new Set([0,1,Math.floor(plan.atoms.length/2),plan.atoms.length-1])){const selected=new Set([index]);for(const b of plan.bonds)if(b.a===index||b.b===index){selected.add(b.a);selected.add(b.b);}const fit=fitPolymerObservation(THREE,{plan,camera,width:338,height:430,safeRegion,atomIndices:[...selected]});assert.ok(fit.maxZoomFactor>=1-1e-12,row.route.routeId+': focus starts inside its rotation-invariant zoom budget');const pivot=new THREE.Vector3(...fit.pivot),base=new THREE.Quaternion(...fit.quaternion);
      for(const pitch of [-60,-30,0,30,60])for(let yaw=0;yaw<360;yaw+=45){const q=new THREE.Quaternion().setFromAxisAngle(right,pitch*Math.PI/180).multiply(new THREE.Quaternion().setFromAxisAngle(up,yaw*Math.PI/180)).multiply(base);for(const atom of plan.atoms){const z=new THREE.Vector3(atom.x,atom.y,atom.z).sub(pivot).applyQuaternion(q).z,r=modelAtomRadius(atom.element);assert.ok(15-fit.scale*(z+r)>.2&&15-fit.scale*(z-r)<500,row.route.routeId+': whole graph remains in clipping range at unchanged local scale');}}
    }
  }
});
