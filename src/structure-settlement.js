import { createStructureSolver } from './structure-relaxation.js?v=34';

// Numerical limits belong to the release-time optimizer, not pointer physics.
// Changing these values adjusts the work budget, not the molecule constraints.
const SETTLEMENT_WORK_LIMITS = Object.freeze({
  maxStepsPerAdvance: 64,
  maxSteps: 768,
  measureEverySteps: 8,
  maxSolveTimeMs: 480,
  frameBudgetMs: 5,
  stepStrength: .85,
});

// Work on a private pose in small time slices. The field sees one short blend,
// never the solver's trial steps. Rotation is allowed throughout; topology edits
// wait for this bounded transaction. No camera or recognition state is involved.
export function createStructureSettlement({THREE,molecule,placements,ids,lockedIds=new Set(),bondLengthFor,geometryFor,radiusFor,nonbondedDistanceFor,rigidReference=null,now=0,duration=240}) {
  const atoms=molecule.atoms.filter(atom=>ids.has(atom.id));
  const bonds=molecule.bonds.filter(bond=>ids.has(bond.a)&&ids.has(bond.b));
  const adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const {a,b,order}of bonds){adjacency.get(a).push({atomId:b,order});adjacency.get(b).push({atomId:a,order});}
  const graph={atoms,bonds,neighbors:id=>adjacency.get(id)??[]};
  const from=new Map(atoms.map(atom=>[atom.id,placements.get(atom.id).position.clone()]));
  const working=new Map([...from].map(([id,point])=>[id,{position:point.clone()}]));
  const solver=createStructureSolver({THREE,molecule:graph,placements:working,bondLengthFor,geometryFor,radiusFor,nonbondedDistanceFor,enforceAromaticGeometryContract:true,
    atomById:id=>atoms.find(atom=>atom.id===id),bondBetween:(a,b)=>bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a)});
  const copy=()=>new Map([...working].map(([id,item])=>[id,item.position.clone()]));
  const score=e=>e.finite&&!e.topologyLimited?Math.max(e.bondRelative/.025,e.angleRadians/(8*Math.PI/180),e.planeDistance/.035,
    (e.overlapRelative??0)/.15,(e.rigidRelative??0)/.025,(e.fiveMemberConformationRelative??0)/.11,(e.sixMemberConformationRelative??0)/.05,
    (e.aromaticRadiusRelative??0)/.015,(e.aromaticAngleRadians??0)/(2.5*Math.PI/180),(e.aromaticPlaneDistance??0)/.035,
    e.ringPenetrations?20+e.ringPenetrations:0,e.bondIntersections?20+e.bondIntersections:0,e.ringSelfCrossings?20+e.ringSelfCrossings:0):Infinity;
  // Keep a better aromatic pose when an unrelated maximum error is still flat.
  const poseScore=e=>score(e)+Math.max((e.aromaticRadiusRelative??0)/.015,(e.aromaticAngleRadians??0)/(2.5*Math.PI/180),(e.aromaticPlaneDistance??0)/.035)*.25;
  let errors=solver.measureError({rigidReference}),bestErrors=errors,bestScore=score(errors),bestPoseScore=poseScore(errors),best=copy();
  let lastValid=solver.validateConformation({rigidReference}).valid?copy():null,rolledBack=false;
  let previous=now,elapsed=0,steps=0,blendAt=null,done=false;
  // Keep each independent component in place. Unconnected fragments must not
  // influence one another's positions, even after deleting an atom/bond.
  const components=[],seen=new Set();
  for(const atom of atoms){
    if(seen.has(atom.id))continue;
    const component=[atom.id];seen.add(atom.id);
    for(let i=0;i<component.length;i++)for(const n of graph.neighbors(component[i]))if(!seen.has(n.atomId)){seen.add(n.atomId);component.push(n.atomId);}
    components.push(component);
  }
  function centerTarget(){
    for(const component of components){
      if(component.some(id=>lockedIds.has(id)))continue;
      const heavy=component.filter(id=>atoms.find(a=>a.id===id).element!=='H'),anchors=heavy.length?heavy:component;
      const delta=anchors.reduce((sum,id)=>sum.add(from.get(id)).sub(best.get(id)),new THREE.Vector3()).divideScalar(anchors.length);
      for(const id of component)best.get(id).add(delta);
    }
  }
  return {
    pause(time){if(blendAt!==null)blendAt+=time-previous;previous=time;},
    rotate(rotation,q){
      const center=new THREE.Vector3(rotation.center.x,rotation.center.y,rotation.center.z);
      for(const map of [from,best])for(const[id,point]of map)if(rotation.ids.has(id))point.sub(center).applyQuaternion(q).add(center);
      for(const[id,item]of working)if(rotation.ids.has(id))item.position.sub(center).applyQuaternion(q).add(center);
      solver.rotateReferenceFrames(q,rotation.ids);
    },
    advance(time,{clock=()=>performance.now(),budgetMs=SETTLEMENT_WORK_LIMITS.frameBudgetMs}={}){
      if(done)return {done:true,converged:bestScore<=1,errors:bestErrors,steps,rolledBack};
      elapsed+=Math.max(0,time-previous);previous=time;
      if(blendAt===null){
        const started=clock();let count=0;
        while(count<SETTLEMENT_WORK_LIMITS.maxStepsPerAdvance&&steps<SETTLEMENT_WORK_LIMITS.maxSteps&&clock()-started<budgetMs&&bestScore>1&&errors.finite&&!errors.topologyLimited){
          solver.step(SETTLEMENT_WORK_LIMITS.stepStrength,1,{lockedIds});steps++;count++;
          if(count%SETTLEMENT_WORK_LIMITS.measureEverySteps===0){
            errors=solver.measureError({rigidReference});const validation=solver.validateConformation({rigidReference});
            if(!errors.finite||(lastValid&&!validation.valid&&(errors.bondRelative>.16||errors.overlapRelative>.34||errors.rigidRelative>.06||errors.ringPenetrations||errors.bondIntersections||errors.ringSelfCrossings))){
              if(lastValid){solver.restoreConformation(lastValid);solver.rebuildTopology({resetFrames:true});}
              rolledBack=true;errors=solver.measureError({rigidReference});
            }else if(validation.valid)lastValid=copy();
            const next=score(errors),nextPose=poseScore(errors);
            if(nextPose<bestPoseScore){bestPoseScore=nextPose;bestScore=next;best=copy();bestErrors=errors;}
          }
        }
        errors=solver.measureError({rigidReference});const validation=solver.validateConformation({rigidReference});
        if(validation.valid)lastValid=copy();else if(!errors.finite&&lastValid){
          solver.restoreConformation(lastValid);solver.rebuildTopology({resetFrames:true});rolledBack=true;errors=solver.measureError({rigidReference});
        }
        const next=score(errors),nextPose=poseScore(errors);
        if(nextPose<bestPoseScore){bestPoseScore=nextPose;bestScore=next;best=copy();bestErrors=errors;}
        if(bestScore<=1||steps>=SETTLEMENT_WORK_LIMITS.maxSteps||elapsed>=SETTLEMENT_WORK_LIMITS.maxSolveTimeMs||!errors.finite||errors.topologyLimited){centerTarget();blendAt=time;}
      }
      if(blendAt!==null){
        const t=Math.min(1,Math.max(0,(time-blendAt)/Math.max(1,duration))),ease=t*t*(3-2*t);
        for(const[id,point]of best)if(!lockedIds.has(id))placements.get(id)?.position.lerpVectors(from.get(id),point,ease);
        done=t===1;
      }
      return {done,converged:done&&bestScore<=1,errors:bestErrors,steps,rolledBack};
    },
  };
}
