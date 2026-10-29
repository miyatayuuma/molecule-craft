// Motion scheduling is independent of the camera, screen-space electron input,
// and rendering. Docking is planned BEFORE a bond merges two components.
export function planBondDocking({THREE,molecule,positionFor,a,b,length,directionFor,preferredIds=new Set()}) {
  const component=start=>{const ids=new Set([start]),queue=[start];for(let i=0;i<queue.length;i++)for(const n of molecule.neighbors(queue[i]))if(!ids.has(n.atomId)){ids.add(n.atomId);queue.push(n.atomId);}return ids;};
  const left=component(a),right=component(b);if(left.has(b))return null;
  const leftAnchored=left.size>right.size||(left.size===right.size&&[...left].some(id=>preferredIds.has(id)));
  const anchorId=leftAnchored?a:b,movingId=leftAnchored?b:a,ids=leftAnchored?right:left;
  const anchor=positionFor(anchorId)?.clone(),origin=positionFor(movingId)?.clone();if(!anchor||!origin)return null;
  const direction=directionFor?.(anchorId)?.clone()??origin.clone().sub(anchor);
  if(direction.lengthSq()<1e-8)direction.set(1,0,0);direction.normalize();
  const target=anchor.clone().addScaledVector(direction,length),incoming=directionFor?.(movingId)?.clone();
  const rotation=incoming&&incoming.lengthSq()>1e-8?new THREE.Quaternion().setFromUnitVectors(incoming.normalize(),direction.clone().multiplyScalar(-1)):new THREE.Quaternion();
  const initial=new Map([...ids].map(id=>[id,positionFor(id).clone()]));
  const distance=origin.distanceTo(target),duration=Math.min(900,Math.max(300,300+distance*35));
  return {ids,anchorId,movingId,duration,
    apply(fraction){
      const t=Math.min(1,Math.max(0,fraction)),ease=t*t*(3-2*t),q=new THREE.Quaternion().slerp(rotation,ease),center=origin.clone().lerp(target,ease);
      for(const [id,point]of initial)positionFor(id)?.copy(point).sub(origin).applyQuaternion(q).add(center);
      return t===1;
    },
  };
}

export const RELAXATION_POLICY=Object.freeze({stepsPerSecond:240,maxStepsPerFrame:24,maxSteps:1440,maxDuration:2400,stallDuration:700,stallAfter:1300,bondRelative:.035,angleRadians:12*Math.PI/180,planeDistance:.045});
export function createRelaxationSession({solver,ids=null,lockedIds=new Set(),strength=.65,rampMs=0,minDuration=600,now=0,policy=RELAXATION_POLICY}) {
  let previous=now,debt=0,elapsed=0,steps=0,stableSteps=0,finished=false,converged=false,reason=null,best=Infinity,lastImprovement=0;
  let errors=solver.measureError({ids});
  const acceptable=()=>errors.finite&&!errors.topologyLimited&&errors.bondRelative<=policy.bondRelative&&errors.angleRadians<=policy.angleRadians&&errors.planeDistance<=policy.planeDistance;
  return {
    pause(time){previous=time;debt=0;},
    advance(time,{clock=()=>performance.now(),budgetMs=5}={}){
      if(finished)return {done:true,converged,errors,steps,reason};
      if(!errors.finite||errors.topologyLimited){finished=true;reason=errors.finite?'complexity':'nonfinite';return {done:true,converged:false,errors,steps,reason};}
      const dt=Math.min(100,Math.max(0,time-previous));elapsed+=Math.max(0,time-previous);previous=time;
      debt=Math.min(policy.maxStepsPerFrame*3,debt+dt*policy.stepsPerSecond/1000);
      const started=clock();let count=0;
      while(debt>=1&&count<policy.maxStepsPerFrame&&steps<policy.maxSteps&&clock()-started<budgetMs){
        const progress=rampMs?Math.min(1,(steps+1)*1000/policy.stepsPerSecond/rampMs):1;
        const ramp=progress*progress*(3-2*progress);
        solver.step(strength*(.08+.92*ramp),1,{lockedIds,activeIds:ids});steps++;count++;debt--;
      }
      if(count){errors=solver.measureError({ids});stableSteps=acceptable()?stableSteps+count:0;}
      // Time alone, or a small displacement at a bad equilibrium, is never
      // success. An incompatible geometry returns an explicit unresolved result.
      converged=acceptable()&&stableSteps>=12;
      const score=Math.max(errors.bondRelative/policy.bondRelative,errors.angleRadians/policy.angleRadians,errors.planeDistance/policy.planeDistance);
      if(score<best*.99){best=score;lastImprovement=elapsed;}
      reason=!errors.finite?'nonfinite':errors.topologyLimited?'complexity':converged&&elapsed>=minDuration?'converged':elapsed>=policy.maxDuration?'timeout':elapsed>=policy.stallAfter&&elapsed-lastImprovement>=policy.stallDuration?'stalled':steps>=policy.maxSteps?'limit':null;
      finished=!!reason;
      return {done:finished,converged:finished&&reason==='converged',errors,steps,reason};
    },
  };
}
