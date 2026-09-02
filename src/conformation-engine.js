import {createTorsionModel} from './torsion-model.js?v=34';

export const CONFORMATION_POLICY=Object.freeze({
  maxAxes:8,
  kinematicPasses:3,
  maxTurnRadians:.16,
  maxAccumulatedRadians:.9,
  gain:.62,
  jacobianDamping:.35,
  torsionBalance:3.5,
  forceStiffness:72,
  velocityDamping:6.5,
  maxAngularVelocity:3.2,
  targetResponse:14,
  propagationRate:12,
  rigidForce:18,
  rigidTorque:7,
  flexibleBodyCoupling:.14,
  maxLinearVelocity:2.2,
  maxRigidAngularVelocity:1.8,
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
    if(!dragPlan||!['conformation','torsion','rigid-body'].includes(dragPlan.mode)){active=null;return null;}
    const axes=dragPlan.mode==='rigid-body'?[]:(dragPlan.mode==='torsion'?[dragPlan]:dragPlan.candidates).slice(0,policy.maxAxes);
    const movableIds=new Set(axes.flatMap(axis=>axis.ids));
    const lockedIds=dragPlan.mode==='rigid-body'?new Set():new Set(molecule.atoms.filter(atom=>dragPlan.scope.has(atom.id)&&!movableIds.has(atom.id)).map(atom=>atom.id));
    const rigidReference=solver.captureRigidReference();
    const pose=copyPose(dragPlan.scope),validation=solver.validateConformation({ids:dragPlan.scope,rigidReference,mode:'drag'});
    const grabbed=positionFor(atomId)?.clone()??new THREE.Vector3();
    active={plan:dragPlan,axes,movableIds,lockedIds,rigidReference,lastValid:validation.valid?pose:null,lastPose:pose,
      changedAxes:new Set(),angles:new Map(),velocities:new Map(),linearVelocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),
      smoothedTarget:grabbed.clone(),elapsed:0,updates:0,rollbacks:0,lastValidation:validation};
    return active;
  }

  function applyAxis(axis,angle){
    if(!Number.isFinite(angle)||Math.abs(angle)<1e-7)return false;
    const accumulated=active.angles.get(axis.key)??0;
    angle=THREE.MathUtils.clamp(accumulated+angle,-policy.maxAccumulatedRadians,policy.maxAccumulatedRadians)-accumulated;
    if(Math.abs(angle)<1e-7)return false;
    const pivot=positionFor(axis.pivot),root=positionFor(axis.root);if(!pivot||!root)return false;
    const direction=root.clone().sub(pivot);if(direction.lengthSq()<1e-10)return false;direction.normalize();
    const quaternion=new THREE.Quaternion().setFromAxisAngle(direction,angle),affected=new Set([...axis.ids,axis.pivot]);
    solver.rotateReferenceFrames(quaternion,affected);
    for(const id of axis.ids){const point=positionFor(id);if(point)point.sub(pivot).applyQuaternion(quaternion).add(pivot);}
    active.changedAxes.add(axis.key);active.angles.set(axis.key,accumulated+angle);return true;
  }

  function jacobianToward(target,scale,deltaSeconds){
    const substep=deltaSeconds/policy.kinematicPasses;
    for(let pass=0;pass<policy.kinematicPasses;pass++){
      const effector=positionFor(active.plan.atomId);if(!effector)return;
      const error=target.clone().sub(effector);if(error.lengthSq()<.000625)break;
      const joints=[];let denominator=policy.jacobianDamping;
      for(let index=0;index<active.axes.length;index++){
        const axis=active.axes[index],pivot=positionFor(axis.pivot),root=positionFor(axis.root);
        if(!pivot||!root||!effector)continue;
        const direction=root.clone().sub(pivot);if(direction.lengthSq()<1e-10)continue;direction.normalize();
        const jacobian=new THREE.Vector3().crossVectors(direction,effector.clone().sub(pivot)),leverage=jacobian.lengthSq();
        if(leverage<1e-8)continue;
        // A mild effector-side preference keeps the selected end responsive,
        // while the shared denominator prevents one joint from solving the
        // entire displacement by itself.
        const accumulated=Math.abs(active.angles.get(axis.key)??0),wave=Math.min(1,(1+active.elapsed*policy.propagationRate)/(1+index*.85));
        const weight=wave/((1+index*.08)*(1+accumulated*policy.torsionBalance));
        joints.push({axis,jacobian,weight,index});denominator+=leverage*weight;
      }
      let changed=false;
      for(let index=joints.length-1;index>=0;index--){
        const {axis,jacobian,weight}=joints[index],drive=policy.gain*weight*jacobian.dot(error)/denominator;
        let velocity=(active.velocities.get(axis.key)??0)+drive*policy.forceStiffness*scale*substep;
        velocity*=Math.exp(-policy.velocityDamping*substep);velocity=THREE.MathUtils.clamp(velocity,-policy.maxAngularVelocity,policy.maxAngularVelocity);
        const moved=applyAxis(axis,THREE.MathUtils.clamp(velocity*substep,-policy.maxTurnRadians*scale,policy.maxTurnRadians*scale));
        active.velocities.set(axis.key,moved?velocity:0);changed=moved||changed;
      }
      if(!changed)break;
    }
  }

  function rigidBodyToward(target,scale,deltaSeconds,{mark=true}={}){
    const ids=[...active.plan.scope],grabbed=positionFor(active.plan.atomId);if(!ids.length||!grabbed)return false;
    const center=ids.reduce((sum,id)=>sum.add(positionFor(id)),new THREE.Vector3()).multiplyScalar(1/ids.length),force=target.clone().sub(grabbed);
    const mass=Math.max(1,Math.sqrt(ids.length)),linearAcceleration=force.clone().multiplyScalar(policy.rigidForce*scale/mass);
    active.linearVelocity.addScaledVector(linearAcceleration,deltaSeconds).multiplyScalar(Math.exp(-policy.velocityDamping*deltaSeconds));
    if(active.linearVelocity.length()>policy.maxLinearVelocity)active.linearVelocity.setLength(policy.maxLinearVelocity);
    const lever=grabbed.clone().sub(center),torque=new THREE.Vector3().crossVectors(lever,force).multiplyScalar(policy.rigidTorque*scale/Math.max(.4,lever.lengthSq()*mass));
    active.angularVelocity.addScaledVector(torque,deltaSeconds).multiplyScalar(Math.exp(-policy.velocityDamping*deltaSeconds));
    if(active.angularVelocity.length()>policy.maxRigidAngularVelocity)active.angularVelocity.setLength(policy.maxRigidAngularVelocity);
    const translation=active.linearVelocity.clone().multiplyScalar(deltaSeconds),turn=active.angularVelocity.length()*deltaSeconds;
    const quaternion=turn>1e-7?new THREE.Quaternion().setFromAxisAngle(active.angularVelocity.clone().normalize(),turn):new THREE.Quaternion();
    if(translation.lengthSq()<1e-10&&turn<1e-7)return false;
    solver.rotateReferenceFrames(quaternion,active.plan.scope);
    for(const id of ids)positionFor(id)?.sub(center).applyQuaternion(quaternion).add(center).add(translation);
    if(mark)active.changedAxes.add('rigid-body');return true;
  }

  function updateDrag(target,{deltaSeconds=1/60}={}){
    if(!active||!target||![target.x,target.y,target.z].every(Number.isFinite)){
      if(active?.lastValid){restore(active.lastValid);active.rollbacks++;}
      return{accepted:false,rolledBack:!!active,lastValidation:active?.lastValidation??null};
    }
    deltaSeconds=THREE.MathUtils.clamp(Number.isFinite(deltaSeconds)?deltaSeconds:1/60,1/240,1/20);
    const before=copyPose(active.plan.scope),beforeDistance=positionFor(active.plan.atomId)?.distanceTo(target)??Infinity;
    const changedBefore=new Set(active.changedAxes),anglesBefore=new Map(active.angles),velocitiesBefore=new Map(active.velocities),
      linearBefore=active.linearVelocity.clone(),angularBefore=active.angularVelocity.clone(),targetBefore=active.smoothedTarget.clone(),elapsedBefore=active.elapsed;
    active.elapsed+=deltaSeconds;active.smoothedTarget.lerp(target,1-Math.exp(-policy.targetResponse*deltaSeconds));
    let firstAttempt=true;
    for(const scale of policy.attemptScales){
      if(!firstAttempt)restore(before);
      firstAttempt=false;
      active.changedAxes=new Set(changedBefore);active.angles=new Map(anglesBefore);active.velocities=new Map(velocitiesBefore);
      active.linearVelocity.copy(linearBefore);active.angularVelocity.copy(angularBefore);
      if(active.plan.mode==='rigid-body')rigidBodyToward(active.smoothedTarget,scale,deltaSeconds);
      else {
        // A molecule in the field has no invisible world-space clamp. A small
        // whole-skeleton response lets force reach an atom that lies directly
        // on its nearest torsion axis; the remaining displacement is then
        // distributed over the chemically available torsions.
        rigidBodyToward(active.smoothedTarget,scale*policy.flexibleBodyCoupling,deltaSeconds,{mark:false});
        jacobianToward(active.smoothedTarget,scale,deltaSeconds);
      }
      // A bounded projection repairs numerical drift; the pointer target never
      // becomes a positional pin and therefore cannot stretch the graph.
      if(active.plan.mode!=='rigid-body')solver.step(policy.projectionStrength,1,{lockedIds:active.lockedIds,activeIds:active.plan.scope});
      const validation=solver.validateConformation({ids:active.plan.scope,rigidReference:active.rigidReference,mode:'drag'});
      if(validation.valid){
        active.lastPose=copyPose(active.plan.scope);active.lastValid=active.lastPose;active.lastValidation=validation;active.updates++;
        return{accepted:true,rolledBack:false,validation,beforeDistance,afterDistance:positionFor(active.plan.atomId)?.distanceTo(target)??Infinity,
          changedAxes:new Set(active.changedAxes),angles:new Map(active.angles)};
      }
      active.lastValidation=validation;
    }
    restore(active.lastValid??before);active.changedAxes=changedBefore;active.angles=anglesBefore;active.velocities=velocitiesBefore;
    active.linearVelocity.copy(linearBefore);active.angularVelocity.copy(angularBefore);active.smoothedTarget.copy(targetBefore);active.elapsed=elapsedBefore;active.rollbacks++;
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
      velocities:new Map(active.velocities),linearVelocity:active.linearVelocity.clone(),angularVelocity:active.angularVelocity.clone(),validation:active.lastValidation};
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
