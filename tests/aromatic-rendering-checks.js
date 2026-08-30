import {createPreviewModel} from '../src/preview-model.js?v=30';
import {aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints,createAromaticRing,updateAromaticRing,setAromaticOpacity} from '../src/aromatic-rendering.js?v=26';

export function checkAromaticRendering(THREE,records,parts){
  let checks=0;
  const assert=(condition,message)=>{checks++;if(!condition)throw new Error(message);};
  const layout=record=>{const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();return model.snapshot();};
  const record=id=>{const found=[...records,...parts].find(item=>item.id===id);assert(!!found,`Missing fixture ${id}`);return found;};
  let aromaticCount=0;
  for(const id of ['benzene','toluene','phenol','anisole','benzaldehyde','phenyl','cyclohexane','ethene','ethyne']){
    const source=record(id),before=JSON.stringify(source),view=layout(source),edges=aromaticBondKeys(view.aromaticCycles);
    const expected=!['cyclohexane','ethene','ethyne'].includes(id);
    assert(view.aromaticCycles.length===(expected?1:0),`${id}: wrong aromatic ring count`);
    if(expected){
      aromaticCount++;
      const ringBonds=view.bonds.filter(b=>edges.has(`${Math.min(b.a,b.b)}:${Math.max(b.a,b.b)}`));
      assert(ringBonds.length===6,`${id}: missing ring edges`);
      assert(ringBonds.every(b=>displayedBondOrder(b,edges)===1),`${id}: duplicate double sticks`);
      assert(ringBonds.filter(b=>b.order===2).length===3,`${id}: changed chemical orders`);
      const frame=aromaticRingFrame(THREE,view.aromaticCycles[0].map(id=>view.atoms[id].point));
      assert(!!frame,`${id}: no ring frame`);
      const samples=aromaticRingPoints(frame);
      assert(samples.every(p=>Math.abs(p.distanceTo(frame.center)-frame.radius)<1e-8),`${id}: not a circle`);
      assert(samples.every(p=>Math.abs(p.clone().sub(frame.center).dot(frame.normal))<1e-8),`${id}: not in ring plane`);
      if(id==='phenyl')assert(view.ports.length===1,'Phenyl attachment port lost');
      if(id==='benzaldehyde')assert(view.bonds.some(b=>b.order===2&&displayedBondOrder(b,edges)===2),'Carbonyl double bond hidden');
    }else assert(view.bonds.every(b=>displayedBondOrder(b,edges)===b.order),`${id}: ordinary bonds changed`);
    assert(JSON.stringify(source)===before,`${id}: mutated source graph`);
  }
  const benzene=record('benzene'),broken=structuredClone(benzene),cycle=layout(benzene).aromaticCycles[0];
  const index=broken.bonds.findIndex(([a,b])=>(a===cycle[0]&&b===cycle[1])||(b===cycle[0]&&a===cycle[1]));
  const removed=broken.bonds.splice(index,1)[0],opened=layout(broken);
  assert(opened.aromaticCycles.length===0,'Opening the ring left an aromatic marker');
  assert(opened.bonds.every(b=>displayedBondOrder(b,aromaticBondKeys(opened.aromaticCycles))===b.order),'Opening ring did not restore ordinary bond sticks');
  broken.bonds.splice(index,0,removed);
  assert(layout(broken).aromaticCycles.length===1,'Closing the ring did not restore aromatic display');
  const reduced=structuredClone(benzene);reduced.bonds.find(b=>b[2]===2)[2]=1;
  assert(layout(reduced).aromaticCycles.length===0,'Non-conjugated ring incorrectly shown as aromatic');

  const points=Array.from({length:6},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/3),Math.sin(i*Math.PI/3),0));
  const before=points.map(p=>p.toArray()),frame=aromaticRingFrame(THREE,points);
  const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),1.1),shift=new THREE.Vector3(5,-3,2);
  const moved=aromaticRingFrame(THREE,points.map(p=>p.clone().applyQuaternion(q).add(shift)));
  assert(Math.abs(frame.radius-moved.radius)<1e-8,'Rotation changed circle radius');
  assert(moved.center.distanceTo(shift)<1e-8&&moved.normal.dot(frame.normal.clone().applyQuaternion(q))>1-1e-8,'Ring did not follow molecule');
  assert(JSON.stringify(points.map(p=>p.toArray()))===JSON.stringify(before),'Rendering moved atoms');
  const resources=[],ring=createAromaticRing(THREE,r=>{resources.push(r);return r;});
  updateAromaticRing(THREE,ring,moved);
  assert(ring.visible&&ring.position.distanceTo(moved.center)<1e-8,'WebGL ring placement failed');
  assert(new THREE.Vector3(0,0,1).applyQuaternion(ring.quaternion).dot(moved.normal)>1-1e-8,'WebGL ring orientation failed');
  assert(ring.children.every(mesh=>mesh.material.depthTest&&!mesh.material.depthWrite&&!mesh.userData.bondKey),'Ring must respect depth and not be a bond target');
  setAromaticOpacity(ring,.25);
  assert(ring.children.every(mesh=>Math.abs(mesh.material.opacity-mesh.userData.baseOpacity*.25)<1e-8),'Debris fade did not include ring');
  for(const invalid of [points.map(()=>new THREE.Vector3()),points.map((_,i)=>new THREE.Vector3(i,0,0)),[undefined,...points.slice(1)]]){
    const badFrame=aromaticRingFrame(THREE,invalid);updateAromaticRing(THREE,ring,badFrame);
    assert(badFrame===null&&!ring.visible,'Degenerate ring left a stale marker');
  }
  updateAromaticRing(THREE,ring,frame);assert(ring.visible,'Ring did not recover from collapse');
  let disposed=0;for(const resource of resources){resource.addEventListener('dispose',()=>disposed++);resource.dispose();}
  assert(disposed===4,'Ring resources not owned/disposable');
  return `${checks} aromatic display checks passed (${aromaticCount} benzene/derivative/part fixtures; break, restore, rotation, depth, disposal)`;
}
