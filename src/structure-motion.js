// Bond docking is independent of the camera, electron-pointer input and rendering.
// Plan it before a bond merges two disconnected components.
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
