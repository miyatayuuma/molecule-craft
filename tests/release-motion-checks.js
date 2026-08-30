import {motionFixture} from './structure-motion-checks.js?v=31';
import {seedCraftCoordinates} from '../src/craft-structures.js?v=31';
import {connectedStructures,structureFrame} from '../src/workspace-model.js?v=20';
import {createRelaxationSession} from '../src/structure-motion.js?v=30';
import {rotateStructure} from '../src/workspace-view.js?v=23';
import {planStructureEdit,editRelaxationOptions} from '../src/structure-edit.js?v=32';

// Actual Three.js camera projection, also runnable without a WebGL context.
// Background drag geometry and camera invariance; real pointer release/no-rebound
// behaviour is exercised by mobile-ui-check.mjs against the production app.
export function checkReleaseMotion(THREE,records) {
  const assert=(ok,message)=>{if(!ok)throw new Error(message);};
  const fixture=name=>{
    const record=records.find(r=>r.id===name);
    const seed=seedCraftCoordinates({...record,attachments:[{atom:0}]}).map(p=>[p.x,p.y,p.z]);
    const item=motionFixture(THREE,record.atoms,record.bonds,seed);
    for(let i=0;i<480;i++)item.solver.step(.65,1);
    const scope=connectedStructures(item.molecule)[0];
    const fit=structureFrame(scope,item.pos,44,390/430),camera=new THREE.PerspectiveCamera(44,390/430,.1,100);
    camera.position.copy(fit.center).addScaledVector(new THREE.Vector3(5.2,4,7.6).normalize(),fit.distance);
    camera.lookAt(fit.center.x,fit.center.y,fit.center.z);camera.updateMatrixWorld();
    const screen=id=>{const point=item.pos(id).clone().project(camera);return new THREE.Vector2((point.x+1)*195,(1-point.y)*215);};
    return {...item,scope,camera,screen};
  };
  const cases=[['methane','H'],['methane','C'],['ethene','H'],['ethene','C'],['ethyne','H'],['benzene','H'],['benzene','C'],['anisole','H'],['anisole','C'],['anisole','O'],['phenol','O']];
  const measurements=[];
  for(const [name,element]of cases)for(const fps of [15,60]) {
    const item=fixture(name),atom=item.molecule.atoms.find(a=>a.element===element),plan=planStructureEdit(item.molecule,atom.id);
    const matrix=[...item.camera.matrixWorld.elements,...item.camera.projectionMatrix.elements];
    const center=structureFrame(item.scope,item.pos,44,390/430).center;
    const rotation={ids:plan.scope,center};
    const pairs=item.ids.flatMap((id,i)=>item.ids.slice(i+1).map(other=>[id,other,item.pos(id).distanceTo(item.pos(other))]));
    const radii=new Map(item.ids.map(id=>[id,item.pos(id).distanceTo(center)]));
    // Use the actual rigid rotation primitive at different pointer update rates.
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),2.3/fps);
    let maxDistanceError=0;
    for(let frame=0;frame<fps;frame++){
      item.solver.rotateReferenceFrames(q,plan.scope);rotateStructure(rotation,item.pos,q);
      maxDistanceError=Math.max(maxDistanceError,...pairs.map(([a,b,d])=>Math.abs(item.pos(a).distanceTo(item.pos(b))-d)));
      assert(maxDistanceError<1e-9,`${name}: a drag deformed the molecule`);
      assert(item.ids.every(id=>Math.abs(item.pos(id).distanceTo(center)-radii.get(id))<1e-9),`${name}: drag pivot drifted`);
    }
    assert([...item.camera.matrixWorld.elements,...item.camera.projectionMatrix.elements].every((value,i)=>value===matrix[i]),`${name}: camera changed`);
    measurements.push({name,element,fps,maxDistanceError});
  }

  // Changing the contents/placement of another component must have NO effect
  // on the focused component's relaxation, even if their spheres overlap.
  {
    const clean=fixture('ethene'),overlap=fixture('ethene');
    const run=item=>{
      const atom=item.molecule.atoms.find(a=>a.element==='H'),plan=planStructureEdit(item.molecule,atom.id);
      item.pos(atom.id).add(new THREE.Vector3(0,0,.8));
      const session=createRelaxationSession({solver:item.solver,...editRelaxationOptions(item.molecule,{...plan,ids:[atom.id],atomId:atom.id})});
      for(let frame=1;frame<400;frame++)if(session.advance(frame*1000/60,{clock:()=>0}).done)break;
    };
    const extra=overlap.molecule.addAtom('O'),point=overlap.pos(overlap.ids[2]).clone().add(new THREE.Vector3(.15,.1,.2));
    overlap.placements.set(extra.id,{position:point.clone()});overlap.solver.markTopologyDirty();
    run(clean);run(overlap);
    assert(clean.ids.every((id,i)=>clean.pos(id).distanceTo(overlap.pos(overlap.ids[i]))<1e-9),'other component repelled the active molecule');
    assert(overlap.pos(extra.id).distanceTo(point)===0,'nonfocused component moved');
  }
  // Torsion is user intent, not a displacement to undo. Carbonyl planes sharing
  // the fixed axis endpoint carry their normal around that endpoint as well.
  {
    const item=motionFixture(THREE,['C','C'],[],[[0,0,0],[.1,0,0]]);
    for(let i=0;i<100;i++)item.solver.step(.65,1,{activeIds:new Set(item.ids)});
    assert(item.pos(item.ids[0]).x===0&&item.pos(item.ids[1]).x===.1,'disconnected fragments in one release scope repelled each other');
  }
  {
    const item=fixture('acetaldehyde'),carbonyl=item.molecule.bonds.find(b=>b.order===2),carbon=item.molecule.atoms.find(a=>a.id===carbonyl.a)?.element==='C'?carbonyl.a:carbonyl.b;
    const other=item.molecule.neighbors(carbon).find(n=>n.order===1&&item.molecule.atoms.find(a=>a.id===n.atomId).element==='C').atomId;
    const ids=new Set([carbon]),queue=[carbon];
    for(let i=0;i<queue.length;i++)for(const n of item.molecule.neighbors(queue[i]))if(n.atomId!==other&&!ids.has(n.atomId)){ids.add(n.atomId);queue.push(n.atomId);}
    const pivot=item.pos(other),axis=item.pos(carbon).clone().sub(pivot).normalize(),q=new THREE.Quaternion().setFromAxisAngle(axis,1.1);
    item.solver.rotateReferenceFrames(q,new Set([...ids,other]));
    for(const id of ids)item.pos(id).sub(pivot).applyQuaternion(q).add(pivot);
    const oxygen=item.molecule.atoms.find(a=>ids.has(a.id)&&a.element==='O').id;
    const direction=()=>{const v=item.pos(oxygen).clone().sub(item.pos(carbon));return v.addScaledVector(axis,-v.dot(axis)).normalize();};
    const rotated=direction(),session=createRelaxationSession({solver:item.solver,...editRelaxationOptions(item.molecule,{ids:[...ids],scope:item.scope.ids,atomId:carbon})});
    let result;for(let frame=1;frame<400;frame++){result=session.advance(frame*1000/60,{clock:()=>0});if(result.done)break;}
    assert(result.converged&&direction().dot(rotated)>.98,'torsion of carbonyl group was undone');
  }
  return {releaseCases:measurements.length,maxDistanceError:Math.max(...measurements.map(m=>m.maxDistanceError)),measurements};
}
