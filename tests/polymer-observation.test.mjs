import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerFragment3DLayout,resolvePolymerFragmentTargets} from '../src/polymer-fragment-3d-layout.js';
import {polymerTask4Fixtures} from './helpers/polymer-task4-fixtures.mjs';
import {fitPolymerObservation,polymerSafeRectangle,polymerLaneOffsets,polymerLaneRadius,resizePolymerCanvas,polymerComparisonGraphs,updatePolymerComparisonLanes} from '../src/reaction-lab-polymer-presentation.js';
import {modelAtomRadius} from '../src/chemistry.js';
const fixtures=await polymerTask4Fixtures();
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
