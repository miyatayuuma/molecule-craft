import {Molecule, ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom} from '../src/bonding-model.js?v=30';
import {createStructureSolver} from '../src/structure-relaxation.js?v=30';
import {planBondDocking,createRelaxationSession} from '../src/structure-motion.js?v=30';
import {connectedStructures,structureFrame} from '../src/workspace-model.js?v=20';
import {createWorkspaceView,rotateStructure} from '../src/workspace-view.js?v=23';

export function motionFixture(THREE,elements,bonds,coordinates) {
  const molecule=new Molecule(),ids=elements.map(e=>molecule.addAtom(e).id);
  for(const [a,b,order]of bonds)molecule.setBond(ids[a],ids[b],order);
  const placements=new Map(ids.map((id,i)=>[id,{position:new THREE.Vector3(...coordinates[i])}]));
  const pos=id=>placements.get(id).position,atomById=id=>molecule.atoms.find(a=>a.id===id);
  const bondLengthFor=(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order);
  const geometryFor=id=>geometryForAtom(molecule,id);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondLengthFor,geometryFor,
    bondBetween:(a,b)=>molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a),radiusFor:id=>ELEMENTS[atomById(id).element].radius});
  return{molecule,ids,placements,pos,solver,bondLengthFor};
}

export function checkStructureMotion(THREE) {
  let checks=0;const assert=(value,message)=>{if(!value)throw new Error(message);checks++;};
  const runSession=(item,fps=60,ids=null)=>{
    const lockedIds=new Set(item.molecule.atoms.filter(a=>ids&&!ids.has(a.id)).map(a=>a.id));
    const session=createRelaxationSession({solver:item.solver,ids,lockedIds});let result;
    for(let frame=1;frame<fps*12;frame++){result=session.advance(frame*1000/fps,{clock:()=>0});if(result.done)break;}
    return result;
  };
  for(const distance of [20,100]) {
    const item=motionFixture(THREE,['C','H','C','H'],[[0,1,1],[2,3,1]],[[0,0,0],[-.8,0,0],[distance,3,-distance],[distance,.8,-distance]]);
    const [a,h,b,k]=item.ids,target=item.bondLengthFor(a,b,1),initial=new Map(item.ids.map(id=>[id,item.pos(id).clone()]));
    const docking=planBondDocking({THREE,molecule:item.molecule,positionFor:item.pos,a,b,length:target,preferredIds:new Set([a,h]),directionFor:id=>new THREE.Vector3(id===a?1:0,id===a?0:1,0)});
    assert(!!docking,'separate components need docking');docking.apply(0);
    assert(item.ids.every(id=>item.pos(id).distanceTo(initial.get(id))<1e-10),'no pre-animation teleport');
    docking.apply(.5);
    assert(item.pos(b).distanceTo(initial.get(b))>1,'fragment must visibly travel');
    assert(Math.abs(item.pos(b).distanceTo(item.pos(k))-initial.get(b).distanceTo(initial.get(k)))<1e-9,'docking preserves fragment shape');
    assert(item.pos(a).distanceTo(initial.get(a))===0&&item.pos(h).distanceTo(initial.get(h))===0,'anchor fragment moved');
    docking.apply(1);
    assert(Math.abs(item.pos(a).distanceTo(item.pos(b))-target)<1e-9,'new bond target length');
    item.molecule.setBond(a,b,1);
    assert(planBondDocking({THREE,molecule:item.molecule,positionFor:item.pos,a:h,b:k,length:1})===null,'ring closure cannot translate a cut fragment');
  }
  for(const order of [1,2,3])for(const fps of [15,60]){
    const item=motionFixture(THREE,['C','C','H','H','O'],[[0,1,order],[0,2,1],[1,3,1]],[[0,0,0],[40,8,-16],[-.8,.3,0],[41,8.3,-16],[80,0,0]]);
    const scope=new Set(item.ids.slice(0,4)),other=item.pos(item.ids[4]).clone(),result=runSession(item,fps,scope);
    assert(result.converged,`order ${order}, ${fps} FPS did not converge: ${JSON.stringify(result)}`);
    assert(result.errors.bondRelative<.035,'stretched bond survived');
    assert(item.pos(item.ids[4]).distanceTo(other)===0,'unrelated molecule moved during relaxation');
  }
  // The reported combination of ethynyl + vinyl (C4H4), with a stretched C=C.
  for(const fps of [15,60]) {
    const item=motionFixture(THREE,['C','C','C','C','H','H','H','H'],[[0,1,3],[1,2,1],[2,3,2],[0,4,1],[2,5,1],[3,6,1],[3,7,1]],[[0,0,0],[1,0,0],[1.8,.8,0],[15,6,0],[-.8,0,0],[1.8,1.6,0],[15,6.8,0],[15.8,6,0]]);
    const result=runSession(item,fps);
    assert(result.converged,`vinylacetylene ${fps} FPS: ${JSON.stringify(result)}`);
  }
  for(const size of [3,4,5,6]) {
    const item=motionFixture(THREE,Array(size).fill('C'),Array.from({length:size},(_,i)=>[i,(i+1)%size,1]),Array.from({length:size},(_,i)=>[i,Math.sin(i)*.6,Math.cos(i)*.3]));
    const result=runSession(item);
    assert(result.converged,`ring ${size} did not converge: ${JSON.stringify(result)}`);
  }
  {
    const item=motionFixture(THREE,['C','C','O','H','H'],[[0,1,1],[2,3,1],[2,4,1]],[[0,0,0],[1,0,0],[35,3,-12],[36,3,-12],[35,4,-12]]);
    const structures=connectedStructures(item.molecule),main=structures[0],focus=structures[1],view=createWorkspaceView();
    view.select(item.ids[2]);const fit=structureFrame(focus,item.pos,44,.55);view.frame(focus,fit.center);view.select(null);
    const before=new Map(item.ids.map(id=>[id,item.pos(id).clone()]));
    for(let gesture=0;gesture<10;gesture++) {
      const snapshot=view.capture(structures,main,item.pos);
      assert(new THREE.Vector3().copy(snapshot.center).distanceTo(fit.center)<1e-10,'framing and rotation pivot drifted');
      const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.3);
      item.solver.rotateReferenceFrames(q,snapshot.ids);rotateStructure(snapshot,item.pos,q);
    }
    assert(main.graph.atoms.every(a=>item.pos(a.id).distanceTo(before.get(a.id))===0),'rotation moved another molecule');
    for(const id of focus.ids)assert(Math.abs(item.pos(id).distanceTo(fit.center)-before.get(id).distanceTo(fit.center))<1e-9,'focused molecule orbited an unrelated center');
    assert(Math.abs(item.pos(item.ids[2]).distanceTo(item.pos(item.ids[3]))-1)<1e-9,'rotation changed bond length');
  }
  return `${checks} structure motion checks passed`;
}
