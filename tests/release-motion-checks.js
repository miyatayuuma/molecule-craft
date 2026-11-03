import {motionFixture} from './structure-motion-checks.js?v=31';
import {seedCraftCoordinates} from '../src/craft-structures.js?v=31';
import {connectedStructures,structureFrame} from '../src/workspace-model.js?v=20';
import {rotateStructure} from '../src/workspace-view.js?v=23';
import {planStructureEdit} from '../src/structure-edit.js?v=33';

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

  // Independent fragments remain untouched by a local solver step.
  {
    const item=motionFixture(THREE,['C','C'],[],[[0,0,0],[.1,0,0]]);
    for(let i=0;i<100;i++)item.solver.step(.65,1,{activeIds:new Set(item.ids)});
    assert(item.pos(item.ids[0]).x===0&&item.pos(item.ids[1]).x===.1,'disconnected fragments in one release scope repelled each other');
  }
  return {releaseCases:measurements.length,maxDistanceError:Math.max(...measurements.map(m=>m.maxDistanceError)),measurements};
}
