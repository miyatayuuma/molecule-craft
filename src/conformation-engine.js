import {createTorsionModel} from './torsion-model.js?v=33';

export const CONFORMATION_POLICY=Object.freeze({
  maxAxes:8,
  ccdPasses:3,
  maxTurnRadians:.16,
  gain:.62,
  projectionStrength:.18,
  attemptScales:[1,.5,.25],
});

// One engine owns the last valid pose for the active drag only. Topology is
// supplied by the cached torsion model and structure solver; neither is rebuilt
// on ordinary pointer moves.
export function createConformationEngine({THREE,molecule,solver,positionFor,modelFor=null,policy=CONFORMATION_POLICY}){
  let active=null;
  const model=()=>modelFor?.()??createTorsionModel(molecule,{aromaticCycles:solver.snapshot().aromaticCycles});
  const plan=(atomId,{activeKey=null}={})=>model().forAtom(atomId,{activeKey,positionFor});
  const copyPose=ids=>solver.captureConformation(ids);
  const restore=pose=>{const changed=solver.restoreConformation(pose);solver.rebuildTopology({resetFrames:true});return changed;};

  function beginDrag(atomId,{activeKey=null,preparedPlan=null}={}){
    const dragPlan=preparedPlan??plan(atomId,{activeKey});
    if(!dragPlan||!['conformation','torsion'].includes(dragPlan.mode)){active=null;return null;}
    const axes=(dragPlan.mode==='torsion'?[dragPlan]:dragPlan.candidates).slice(0,policy.maxAxes);
    const movableIds=new Set(axes.flatMap(axis=>axis.ids));
    const lockedIds=new Set(molecule.atoms.filter(atom=>dragPlan.scope.has(atom.id)&&!movableIds.has(atom.id)).map(atom=>atom.id));
    const rigidReference=solver.captureRigidReference();
    const pose=copyPose(dragPlan.scope),validation=solver.validateConformation({ids:dragPlan.scope,rigidReference,mode:'drag'});
    active={plan:dragPlan,axes,movableIds,lockedIds,rigidReference,lastValid:validation.valid?pose:null,lastPose:pose,
      changedAxes:new Set(),angles:new Map(),updates:0,rollbacks:0,lastValidation:validation};
    return active;
  }

  function applyAxis(axis,angle){
    if(!Number.isFinite(angle)||Math.abs(angle)<1e-7)return false;
    const pivot=positionFor(axis.pivot),root=positionFor(axis.root);if(!pivot||!root)return false;
    const direction=root.clone().sub(pivot);if(direction.lengthSq()<1e-10)return false;direction.normalize();
    const quaternion=new THREE.Quaternion().setFromAxisAngle(direction,angle),affected=new Set([...axis.ids,axis.pivot]);
    solver.rotateReferenceFrames(quaternion,affected);
    for(const id of axis.ids){const point=positionFor(id);if(point)point.sub(pivot).applyQuaternion(quaternion).add(pivot);}
    active.changedAxes.add(axis.key);active.angles.set(axis.key,(active.angles.get(axis.key)??0)+angle);return true;
  }

  function ccdToward(target,scale){
    for(let pass=0;pass<policy.ccdPasses;pass++){
      let changed=false;
      for(let index=0;index<active.axes.length;index++){
        const axis=active.axes[index],pivot=positionFor(axis.pivot),root=positionFor(axis.root),effector=positionFor(active.plan.atomId);
        if(!pivot||!root||!effector)continue;
        const direction=root.clone().sub(pivot);if(direction.lengthSq()<1e-10)continue;direction.normalize();
        const from=effector.clone().sub(pivot),to=target.clone().sub(pivot);
        from.addScaledVector(direction,-from.dot(direction));to.addScaledVector(direction,-to.dot(direction));
        if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)continue;from.normalize();to.normalize();
        const cross=new THREE.Vector3().crossVectors(from,to),signed=Math.atan2(direction.dot(cross),THREE.MathUtils.clamp(from.dot(to),-1,1));
        const distribution=policy.gain/(1+index*.16),limit=policy.maxTurnRadians*scale*(1+index*.08);
        const angle=THREE.MathUtils.clamp(signed*distribution,-limit,limit);
        changed=applyAxis(axis,angle)||changed;
      }
      if(!changed||positionFor(active.plan.atomId).distanceTo(target)<.025)break;
    }
  }

  function updateDrag(target){
    if(!active||!target||![target.x,target.y,target.z].every(Number.isFinite)){
      if(active?.lastValid){restore(active.lastValid);active.rollbacks++;}
      return{accepted:false,rolledBack:!!active,lastValidation:active?.lastValidation??null};
    }
    const before=copyPose(active.plan.scope),beforeDistance=positionFor(active.plan.atomId)?.distanceTo(target)??Infinity;
    const changedBefore=new Set(active.changedAxes),anglesBefore=new Map(active.angles);
    let firstAttempt=true;
    for(const scale of policy.attemptScales){
      if(!firstAttempt)restore(before);
      firstAttempt=false;
      active.changedAxes=new Set(changedBefore);active.angles=new Map(anglesBefore);ccdToward(target,scale);
      // A bounded projection repairs numerical drift; the pointer target never
      // becomes a positional pin and therefore cannot stretch the graph.
      solver.step(policy.projectionStrength,1,{lockedIds:active.lockedIds,activeIds:active.plan.scope});
      const validation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
      if(validation.valid){
        active.lastPose=copyPose(active.plan.scope);active.lastValid=active.lastPose;active.lastValidation=validation;active.updates++;
        return{accepted:true,rolledBack:false,validation,beforeDistance,afterDistance:positionFor(active.plan.atomId)?.distanceTo(target)??Infinity,
          changedAxes:new Set(active.changedAxes),angles:new Map(active.angles)};
      }
      active.lastValidation=validation;
    }
    restore(active.lastValid??before);active.changedAxes=changedBefore;active.angles=anglesBefore;active.rollbacks++;
    active.lastValidation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
    return{accepted:false,rolledBack:true,validation:active.lastValidation,beforeDistance,
      afterDistance:positionFor(active.plan.atomId)?.distanceTo(target)??Infinity,changedAxes:new Set(active.changedAxes),angles:new Map(active.angles)};
  }

  function rotateDrag(angle){
    if(!active||active.plan.mode!=='torsion'||!Number.isFinite(angle))return{accepted:false,rolledBack:false,validation:active?.lastValidation??null};
    const before=copyPose(active.plan.scope),changedBefore=new Set(active.changedAxes),anglesBefore=new Map(active.angles);
    let firstAttempt=true;
    for(const scale of policy.attemptScales){
      if(!firstAttempt)restore(before);
      firstAttempt=false;active.changedAxes=new Set(changedBefore);active.angles=new Map(anglesBefore);
      applyAxis(active.axes[0],angle*scale);solver.step(policy.projectionStrength,1,{lockedIds:active.lockedIds,activeIds:active.plan.scope});
      const validation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
      if(validation.valid){
        active.lastPose=copyPose(active.plan.scope);active.lastValid=active.lastPose;active.lastValidation=validation;active.updates++;
        return{accepted:true,rolledBack:false,validation,changedAxes:new Set(active.changedAxes),angles:new Map(active.angles)};
      }
      active.lastValidation=validation;
    }
    restore(active.lastValid??before);active.changedAxes=changedBefore;active.angles=anglesBefore;active.rollbacks++;
    active.lastValidation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
    return{accepted:false,rolledBack:true,validation:active.lastValidation,changedAxes:new Set(active.changedAxes),angles:new Map(active.angles)};
  }

  function release(){
    if(!active)return null;
    const result={plan:active.plan,ids:active.plan.scope,lockedIds:active.lockedIds,rigidReference:active.rigidReference,
      lastValid:active.lastValid,changedAxes:new Set(active.changedAxes),angles:new Map(active.angles),updates:active.updates,rollbacks:active.rollbacks,
      validation:active.lastValidation};
    active=null;return result;
  }

  function rollback(){
    if(!active)return false;
    const restored=restore(active.lastValid??active.lastPose);active.rollbacks++;
    active.lastValidation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
    return restored;
  }
  function topologyChanged(){active=null;}
  return{plan,beginDrag,updateDrag,rotateDrag,release,rollback,topologyChanged,get active(){return active;}};
}
