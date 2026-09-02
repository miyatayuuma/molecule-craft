import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {createPreviewModel} from '../src/preview-model.js?v=31';
import {createStructureSettlement} from '../src/structure-settlement.js?v=32';
import {attachmentProjection,createAttachmentMarker} from '../src/attachment-rendering.js?v=31';

export function checkStructureSettlement(THREE,records,parts){
  let checks=0,maxDuration=0;
  const assert=(value,message)=>{if(!value)throw new Error(message);checks++;};
  const fixture=()=>{
    const record=records.find(r=>r.id==='phosphoric-acid'),model=createPreviewModel(THREE,record);
    for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
    const molecule=new Molecule(),ids=record.atoms.map(e=>molecule.addAtom(e).id),scope=new Set(ids);
    for(const[a,b,order]of record.bonds)molecule.setBond(ids[a],ids[b],order);
    const placements=new Map(ids.map((id,i)=>[id,{position:layout.atoms[i].point.clone()}]));
    const pos=id=>placements.get(id).position,atom=id=>molecule.atoms.find(a=>a.id===id);
    // Reproduce an old save with the central P pulled out of its tetrahedron.
    pos(ids[0]).add(new THREE.Vector3(-1.8,.4,.9));
    const extra=molecule.addAtom('O');placements.set(extra.id,{position:pos(ids[0]).clone()});
    const heavy=ids.filter(id=>atom(id).element!=='H');
    const center=()=>heavy.reduce((sum,id)=>sum.add(pos(id)),new THREE.Vector3()).divideScalar(heavy.length);
    const session=createStructureSettlement({THREE,molecule,placements,ids:scope,
      bondLengthFor:(a,b,order)=>(ATOMIC_MODEL[atom(a).element].covalentRadius+ATOMIC_MODEL[atom(b).element].covalentRadius)*.78*bondLengthScale(order),
      geometryFor:id=>geometryForAtom(molecule,id),radiusFor:id=>ELEMENTS[atom(id).element].radius,
      nonbondedDistanceFor:(a,b)=>nonbondedDistance(atom(a).element,atom(b).element)});
    return {session,molecule,ids,scope,pos,center,extra};
  };
  for(const fps of [15,60]){
    const item=fixture(),initial=new Map(item.ids.map(id=>[id,item.pos(id).clone()])),center=item.center(),other=item.pos(item.extra.id).clone();
    item.session.advance(0,{clock:()=>0});
    assert(item.ids.every(id=>item.pos(id).distanceTo(initial.get(id))===0),'Solver trials leaked into the displayed pose');
    let result,elapsed;
    for(let i=1;i<=fps;i++){elapsed=i*1000/fps;result=item.session.advance(elapsed,{clock:()=>0});if(result.done)break;}
    assert(result.done&&result.converged,`P repair ${fps}fps: ${JSON.stringify(result)}`);
    assert(elapsed<=800,`Repair too slow: ${elapsed}ms`);maxDuration=Math.max(maxDuration,elapsed);
    assert(item.center().distanceTo(center)<1e-9,'Correction translated the heavy-atom center');
    assert(item.pos(item.extra.id).distanceTo(other)===0,'Correction moved an independent overlapping atom');
    for(const b of item.molecule.bonds.filter(b=>b.a===item.ids[0]||b.b===item.ids[0])){
      const target=1.3494*bondLengthScale(b.order);
      assert(Math.abs(item.pos(b.a).distanceTo(item.pos(b.b))/target-1)<.025,'P–O distance remains stretched');
    }
  }
  // Rotate during the blend, then finish: target and source must follow exactly
  // the same rigid transform as visible atoms, without cancelling the work.
  {
    const fixed=fixture(),rotating=fixture(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,2,3).normalize(),.8),center=rotating.center();
    for(let t=0;t<=800;t+=16){
      if(t===80){
        for(const id of rotating.ids)rotating.pos(id).sub(center).applyQuaternion(q).add(center);
        rotating.session.rotate({ids:rotating.scope,center},q);
      }
      fixed.session.advance(t,{clock:()=>0});rotating.session.advance(t,{clock:()=>0});
    }
    assert(fixed.ids.every((id,i)=>fixed.pos(id).clone().sub(center).applyQuaternion(q).add(center).distanceTo(rotating.pos(rotating.ids[i]))<1e-8),'Rotating correction jumps to an unrotated target');
  }
  // Hidden time is not animation time; returning to the tab does not jump.
  {
    const item=fixture();item.session.advance(0,{clock:()=>0});item.session.advance(16,{clock:()=>0});
    const before=item.ids.map(id=>item.pos(id).clone());item.session.pause(10016);item.session.advance(10016,{clock:()=>0});
    assert(item.ids.every((id,i)=>item.pos(id).distanceTo(before[i])<1e-12),'Hidden tab jumped to the target');
  }
  for(const part of parts){
    const model=createPreviewModel(THREE,part);for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
    for(const port of layout.ports){
      const atom=layout.atoms[port.atom],radius=ELEMENTS[atom.element].radius*.72;
      assert(port.start.distanceTo(atom.point)>radius,`${part.id}: attachment starts inside atom`);
      const resources=[],marker=createAttachmentMarker(THREE,port,value=>{resources.push(value);return value;});
      assert(marker.children.every(child=>child.material.depthTest),`${part.id}: attachment ignores depth`);
      const lineStart=new THREE.Vector3().fromBufferAttribute(marker.children[0].geometry.attributes.position,0);
      assert(lineStart.distanceTo(port.start)<1e-6,'WebGL uses a center-to-center line');
      for(let angle=0;angle<6.3;angle+=.4){
        const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),angle),a=atom.point.clone().applyQuaternion(q).multiplyScalar(100),b=port.point.clone().applyQuaternion(q).multiplyScalar(100);
        const segment=attachmentProjection(a,b,radius*100);
        if(segment)assert(Math.hypot(segment.start.x-a.x,segment.start.y-a.y)>=radius*100-1e-8,'Projected dashes cross their atom');
      }
      resources.forEach(resource=>resource.dispose());
    }
  }
  assert(attachmentProjection({x:0,y:0},{x:1,y:1},10)===null,'Foreshortened port overlays its atom');
  return {checks,maxRepairMs:maxDuration};
}
