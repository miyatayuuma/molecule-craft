/** Collision-aware route planner for LAB polymer fragment auto-docking. Scene state stays in the viewer. */
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export function planPolymerAutomaticPath({THREE,start,end,normal,right,up,fragmentPoints,incomingRadius,geometrySafe,gridFallback=true}){
    const directions=[normal,normal.clone().negate(),right,right.clone().negate(),up,up.clone().negate()];
    const center=fragmentPoints.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).multiplyScalar(1/Math.max(1,fragmentPoints.length)),fragmentRadius=Math.max(0,...fragmentPoints.map(point=>point.distanceTo(center))),clearance=fragmentRadius+incomingRadius+.45;
    const offsets=[...new Set([.8,1.2,1.8,2.6,clearance,clearance*1.35].map(value=>Math.round(value*1000)/1000))],paths=[[start,end]];
    for(const distance of offsets)for(const direction of directions){const offset=direction.clone().multiplyScalar(distance);paths.push([start,start.clone().add(offset),end.clone().add(offset),end]);}
    const pathIsSafe=path=>{
      for(let segment=1;segment<path.length;segment++){
        const from=path[segment-1],to=path[segment],steps=Math.max(1,Math.ceil(from.distanceTo(to)/.16));
        for(let step=1;step<=steps;step++){const finalDock=segment===path.length-1&&step===steps;if(!geometrySafe(from.clone().lerp(to,step/steps),{allowFormingBond:finalDock,requireBondDistance:false}))return false;}
      }
      return true;
    };
    const pathLength=path=>path.slice(1).reduce((sum,point,index)=>sum+point.distanceTo(path[index]),0),firstSafe=candidates=>{
      candidates.sort((a,b)=>pathLength(a)-pathLength(b));
      for(const path of candidates)if(pathIsSafe(path))return path;
      return null;
    };
    const direct=firstSafe(paths);if(direct)return direct;
    const expandedDirections=[];
    for(const [first,second]of [[right,up],[right,normal],[up,normal]])for(const a of [-1,1])for(const b of [-1,1])expandedDirections.push(first.clone().multiplyScalar(a).addScaledVector(second,b).normalize());
    for(const a of [-1,1])for(const b of [-1,1])for(const c of [-1,1])expandedDirections.push(right.clone().multiplyScalar(a).addScaledVector(up,b).addScaledVector(normal,c).normalize());
    for(const point of [start,end]){const radial=point.clone().sub(center);if(radial.lengthSq()>1e-9){radial.normalize();expandedDirections.push(radial,radial.clone().negate());}}
    const expanded=[];for(const distance of [clearance,clearance*1.35])for(const direction of expandedDirections){const offset=direction.clone().multiplyScalar(distance);expanded.push([start,start.clone().add(offset),end.clone().add(offset),end]);}
    const detour=firstSafe(expanded);if(detour)return detour;
    if(!gridFallback)return null;
    const margin=Math.max(.8,clearance*1.2),boundsPoints=[...fragmentPoints,start,end],minimum=new THREE.Vector3(...['x','y','z'].map(axis=>Math.min(...boundsPoints.map(point=>point[axis]))-margin)),maximum=new THREE.Vector3(...['x','y','z'].map(axis=>Math.max(...boundsPoints.map(point=>point[axis]))+margin)),maxSpan=Math.max(maximum.x-minimum.x,maximum.y-minimum.y,maximum.z-minimum.z),spacing=Math.max(.4,maxSpan/22),dimensions=[0,1,2].map(axis=>Math.ceil((maximum.getComponent(axis)-minimum.getComponent(axis))/spacing)+1);
    if(dimensions.reduce((product,size)=>product*size,1)>15000)return null;
    const gridPointCache=new Map(),nodeSafetyCache=new Map(),edgeSafetyCache=new Map(),keyFor=coords=>coords.join(','),coordsFor=key=>key.split(',').map(Number),inside=coords=>coords.every((value,axis)=>value>=0&&value<dimensions[axis]),pointFor=coords=>{const key=keyFor(coords);if(!gridPointCache.has(key))gridPointCache.set(key,new THREE.Vector3(minimum.x+coords[0]*spacing,minimum.y+coords[1]*spacing,minimum.z+coords[2]*spacing));return gridPointCache.get(key);};
    const nodeSafe=key=>{if(!nodeSafetyCache.has(key))nodeSafetyCache.set(key,geometrySafe(pointFor(coordsFor(key)),{requireBondDistance:false}));return nodeSafetyCache.get(key);};
    const edgeSafe=(from,to,finalDock=false)=>{const key=`${from.join(',')}>${to.join(',')}:${finalDock}`;if(edgeSafetyCache.has(key))return edgeSafetyCache.get(key);const a=pointFor(from),b=pointFor(to),steps=Math.max(1,Math.ceil(a.distanceTo(b)/.16));let valid=true;for(let step=1;step<=steps;step++){const last=finalDock&&step===steps;if(!geometrySafe(a.clone().lerp(b,step/steps),{allowFormingBond:last,requireBondDistance:false})){valid=false;break;}}edgeSafetyCache.set(key,valid);return valid;};
    const nearbyConnectors=(point,goal=false)=>{const rounded=[0,1,2].map(axis=>Math.round((point.getComponent(axis)-minimum.getComponent(axis))/spacing)),rows=new Map();for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){const coords=rounded.map((value,axis)=>clamp(value+[x,y,z][axis],0,dimensions[axis]-1)),key=keyFor(coords),target=pointFor(coords);if(!nodeSafe(key))continue;const from=goal?target:point,to=goal?point:target,steps=Math.max(1,Math.ceil(from.distanceTo(to)/.16));let valid=true;for(let step=1;step<=steps;step++){const last=goal&&step===steps;if(!geometrySafe(from.clone().lerp(to,step/steps),{allowFormingBond:last,requireBondDistance:false})){valid=false;break;}}if(!valid)continue;const distance=target.distanceTo(point),existing=rows.get(key);if(!existing||distance<existing.distance)rows.set(key,{key,coords,distance});}return[...rows.values()].sort((a,b)=>a.distance-b.distance||a.key.localeCompare(b.key));};
    const starts=nearbyConnectors(start),goals=nearbyConnectors(end,true);if(!starts.length||!goals.length)return null;
    const goalIds=new Set(goals.map(row=>row.key)),best=new Map(),previous=new Map(),heap=[];
    const heapPush=row=>{let index=heap.length;heap.push(row);while(index){const parent=(index-1)>>1;if(heap[parent].f<row.f||heap[parent].f===row.f&&heap[parent].id<=row.id)break;heap[index]=heap[parent];index=parent;}heap[index]=row;};
    const heapPop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let index=0;while(true){const left=index*2+1,right=left+1;if(left>=heap.length)break;const child=right<heap.length&&(heap[right].f<heap[left].f||heap[right].f===heap[left].f&&heap[right].id<heap[left].id)?right:left;if(heap[child].f>last.f||heap[child].f===last.f&&heap[child].id>=last.id)break;heap[index]=heap[child];index=child;}heap[index]=last;}return first;};
    for(const row of starts){best.set(row.key,row.distance);previous.set(row.key,null);heapPush({id:row.key,g:row.distance,f:row.distance+pointFor(row.coords).distanceTo(end)});}
    const neighbors=[];for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++)if(x||y||z)neighbors.push([x,y,z]);let visits=0;
    while(heap.length&&visits<15000){const current=heapPop();if(current.g!==best.get(current.id))continue;visits++;if(goalIds.has(current.id)){const route=[];let cursor=current.id;while(cursor!==null){route.push(pointFor(coordsFor(cursor)));cursor=previous.get(cursor);}route.reverse();const candidate=[start,...route,end];if(pathIsSafe(candidate))return candidate;goalIds.delete(current.id);}
      const from=coordsFor(current.id);for(const delta of neighbors){const to=from.map((value,axis)=>value+delta[axis]);if(!inside(to))continue;const next=keyFor(to);if(!nodeSafe(next)||!edgeSafe(from,to))continue;const g=current.g+pointFor(from).distanceTo(pointFor(to));if(g>=(best.get(next)??Infinity))continue;best.set(next,g);previous.set(next,current.id);heapPush({id:next,g,f:g+pointFor(to).distanceTo(end)});}
    }
    return null;
}
