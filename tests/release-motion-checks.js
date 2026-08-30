import {motionFixture} from './structure-motion-checks.js?v=24';
import {seedCraftCoordinates} from '../src/craft-structures.js?v=21';
import {connectedStructures,structureFrame} from '../src/workspace-model.js?v=20';
import {createRelaxationSession} from '../src/structure-motion.js?v=24';
import {planStructureEdit,editRelaxationOptions} from '../src/structure-edit.js?v=24';

// Actual Three.js camera projection, also runnable without a WebGL context.
// This tests SCREEN displacement independently from camera matrix changes.
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
    const fixed=item.ids.filter(id=>!plan.ids.includes(id)),before=new Map(fixed.map(id=>[id,item.pos(id).clone()]));
    const matrix=[...item.camera.matrixWorld.elements,...item.camera.projectionMatrix.elements];
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),2.3/30);
    // Same graph edit plan as the application; 30 drag updates, no global solver
    // trying to chase a locked fingertip by moving the untouched backbone.
    for(let i=0;i<30;i++) {
      if(plan.mode==='structure') {
        const pivot=item.pos(plan.pivotId);
        item.solver.rotateReferenceFrames(q,new Set([...plan.ids,plan.pivotId]));
        for(const id of plan.ids)item.pos(id).sub(pivot).applyQuaternion(q).add(pivot);
      } else for(const id of plan.ids)item.pos(id).add(new THREE.Vector3(.012,.008,.02));
    }
    assert(fixed.every(id=>item.pos(id).distanceTo(before.get(id))===0),`${name}: drag moved untouched skeleton`);
    const released=item.pos(atom.id).clone(),screens=new Map(fixed.map(id=>[id,item.screen(id)]));
    const options=editRelaxationOptions(item.molecule,{...plan,atomId:atom.id});
    const session=createRelaxationSession({solver:item.solver,...options});
    let result,maxDrift=0,firstFrame=null,at200=null,elapsed=0;
    const initiallyVisible=item.ids.every(id=>{const p=item.screen(id);return p.x>=0&&p.x<=390&&p.y>=0&&p.y<=430;});
    for(let frame=1;frame<fps*9;frame++) {
      elapsed=frame*1000/fps;result=session.advance(elapsed,{clock:()=>0});
      if(!firstFrame)firstFrame=item.pos(atom.id).clone();
      if(elapsed<=200)at200=item.pos(atom.id).clone();
      for(const id of fixed)maxDrift=Math.max(maxDrift,item.screen(id).distanceTo(screens.get(id)));
      assert(fixed.every(id=>item.pos(id).distanceTo(before.get(id))===0),`${name}: release moved untouched skeleton`);
      assert([...item.camera.matrixWorld.elements,...item.camera.projectionMatrix.elements].every((value,i)=>value===matrix[i]),`${name}: camera changed`);
      if(initiallyVisible)assert(item.ids.every(id=>{const p=item.screen(id);return p.x>=0&&p.x<=390&&p.y>=0&&p.y<=430;}),`${name}: release escaped the fixed viewport`);
      if(result.done)break;
    }
    assert(result.converged,`${name} ${element} ${fps}fps: ${JSON.stringify(result)}`);
    assert(maxDrift<.01,`${name}: backbone drifted ${maxDrift}px`);
    const travel=released.distanceTo(item.pos(atom.id));
    if(travel>.1) {
      assert(firstFrame.distanceTo(released)<travel*.25,`${name}: first-frame teleport`);
      assert(at200.distanceTo(item.pos(atom.id))>travel*.05,`${name}: motion ended before 200ms`);
    }
    measurements.push({name,element,fps,backboneDriftPx:maxDrift,durationMs:Math.round(elapsed)});
  }
  // Changing the contents/placement of another component must have NO effect
  // on the focused component's relaxation, even if their spheres overlap.
  {
    const clean=fixture('ethene'),overlap=fixture('ethene');
    const run=item=>{
      const atom=item.molecule.atoms.find(a=>a.element==='H'),plan=planStructureEdit(item.molecule,atom.id);
      item.pos(atom.id).add(new THREE.Vector3(0,0,.8));
      const session=createRelaxationSession({solver:item.solver,...editRelaxationOptions(item.molecule,{...plan,atomId:atom.id})});
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
  return {releaseCases:measurements.length,maxBackboneDriftPx:Math.max(...measurements.map(m=>m.backboneDriftPx)),measurements};
}
