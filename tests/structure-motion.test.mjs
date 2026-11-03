import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import {planBondDocking} from '../src/structure-motion.js?v=30';
import {createWorkspaceView} from '../src/workspace-view.js';

// Docking is the only production responsibility of structure-motion.js.
{
  const neighbors=new Map([[1,[2]],[2,[1]],[3,[4]],[4,[3]]]);
  const molecule={neighbors:id=>(neighbors.get(id)??[]).map(atomId=>({atomId}))};
  const points=new Map([[1,new THREE.Vector3(0,0,0)],[2,new THREE.Vector3(-1,0,0)],
    [3,new THREE.Vector3(8,2,0)],[4,new THREE.Vector3(9,2,0)]]);
  const pos=id=>points.get(id),before=new Map([...points].map(([id,p])=>[id,p.clone()]));
  const docking=planBondDocking({THREE,molecule,positionFor:pos,a:1,b:3,length:1.3,
    preferredIds:new Set([1,2]),directionFor:id=>new THREE.Vector3(id===1?1:-1,0,0)});
  assert.ok(docking);
  assert.deepEqual([...docking.ids].sort(),[3,4]);
  docking.apply(0);
  assert.ok([...points].every(([id,p])=>p.distanceTo(before.get(id))<1e-10),'Docking must not teleport on start');
  docking.apply(.5);
  assert.equal(pos(1).distanceTo(before.get(1)),0,'Anchor must stay fixed');
  assert.ok(Math.abs(pos(3).distanceTo(pos(4))-1)<1e-10,'Moving fragment must stay rigid');
  assert.equal(docking.apply(1),true);
  assert.ok(Math.abs(pos(1).distanceTo(pos(3))-1.3)<1e-10,'Final bond length must match the target');
}

// Background deselection must preserve the focused structure and rotation center.
{
  const a={signature:'a',ids:new Set([1,2]),graph:{atoms:[{id:1,element:'C'},{id:2,element:'C'}]}};
  const b={signature:'b',ids:new Set([3]),graph:{atoms:[{id:3,element:'O'}]}};
  const view=createWorkspaceView(),points=new Map([[1,{x:0,y:0,z:0}],[2,{x:1,y:0,z:0}],[3,{x:40,y:2,z:-20}]]);
  view.select(3);view.frame(b,{x:40,y:2,z:-20});view.select(null);
  assert.equal(view.resolve([a,b],a),b,'Background deselection must preserve focused component');
  assert.deepEqual(view.capture([a,b],a,id=>points.get(id)),{ids:b.ids,center:{x:40,y:2,z:-20}});
  view.select(1);assert.equal(view.resolve([a,b],a),a);
  view.clear();assert.equal(view.resolve([],null),null);
}
console.log('Bond docking and focused-structure view checks passed.');
