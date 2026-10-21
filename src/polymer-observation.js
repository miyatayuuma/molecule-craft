// Presentation only. No graph edits, geometry solves, persistence or fixed-step work.
import {modelAtomRadius} from './chemistry.js?v=20';

export const POLYMER_VIEW_STATES=Object.freeze(['OVERVIEW_NEUTRAL','SELECTED','LOCAL_FOCUS','COMPARE_BEFORE','COMPARE_AFTER','COMPARE_BYPRODUCT','CONCEPT_SEPARATE']);
export function polymerLaneOffsets(order){
  if(order===1)return[0];if(order===2)return[-.080,.080];if(order===3)return[-.160,0,.160];
  throw new TypeError('Unsupported polymer bond order');
}
export const polymerLaneRadius=order=>order===1?.050:.038;
export const POLYMER_ELEMENT_NAMES=Object.freeze({C:'炭素',H:'水素',O:'酸素',N:'窒素',F:'フッ素',Cl:'塩素',P:'リン',S:'硫黄'});

// Largest empty rectangle, measured in canvas CSS pixels. Touching edges is OK.
export function polymerSafeRectangle(width,height,overlays=[]){
  const base={left:12,top:12,right:width-12,bottom:height-12};
  const obstacles=overlays.map(r=>({left:Math.max(base.left,r.left-8),right:Math.min(base.right,r.right+8),top:Math.max(base.top,r.top-8),bottom:Math.min(base.bottom,r.bottom+8)})).filter(r=>r.right>r.left&&r.bottom>r.top);
  const xs=[...new Set([base.left,base.right,...obstacles.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b),ys=[...new Set([base.top,base.bottom,...obstacles.flatMap(r=>[r.top,r.bottom])])].sort((a,b)=>a-b);
  let best=null;
  for(let a=0;a<xs.length;a++)for(let b=a+1;b<xs.length;b++)for(let c=0;c<ys.length;c++)for(let d=c+1;d<ys.length;d++){
    const left=xs[a],right=xs[b],top=ys[c],bottom=ys[d],w=right-left,h=bottom-top;
    if(w<160||h<160||obstacles.some(r=>left<r.right&&right>r.left&&top<r.bottom&&bottom>r.top))continue;
    const area=w*h,centerDistance=((left+right-width)/2)**2+((top+bottom-height)/2)**2;
    if(!best||area>best.area||area===best.area&&(centerDistance<best.centerDistance||centerDistance===best.centerDistance&&(left<best.left||left===best.left&&top<best.top)))best={left,right,top,bottom,width:w,height:h,area,centerDistance};
  }
  return best;
}

// At each bond endpoint, its full cylinder envelope is bounded by a ball with
// radius max(|offset| + laneRadius). The convex hull of the two endpoint balls
// contains the complete cylinder. Include those bounds explicitly in every fit.
export function polymerVisualPrimitives(plan){
  const primitives=plan.atoms.map((a,index)=>({x:a.x,y:a.y,z:a.z,radius:modelAtomRadius(a.element),atomIndex:index}));
  for(const b of plan.bonds){const radius=Math.max(...polymerLaneOffsets(b.order).map(Math.abs))+polymerLaneRadius(b.order);for(const i of [b.a,b.b]){const a=plan.atoms[i];primitives.push({x:a.x,y:a.y,z:a.z,radius,bond:true});}}
  return primitives;
}

export function fitPolymerObservation(THREE,{plan,camera,width,height,safeRegion,atomIndices=null,quaternion=null}){
  if(!safeRegion||!plan?.atoms?.length)throw new Error('POLYMER_SAFE_REGION_UNAVAILABLE');
  camera.updateMatrixWorld(true);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),back=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,2);
  const d=camera.position.length(),f=height/(2*Math.tan(camera.fov*Math.PI/360)),S=safeRegion,cx=(S.left+S.right)/2,cy=(S.top+S.bottom)/2;
  const all=polymerVisualPrimitives(plan),selected=atomIndices?new Set(atomIndices):null,primitives=selected?all.filter(p=>selected.has(p.atomIndex)):all;
  if(!primitives.length)throw new Error('POLYMER_EMPTY_FOCUS');
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of primitives)for(let i=0;i<3;i++){const v=[p.x,p.y,p.z][i];min[i]=Math.min(min[i],v-p.radius);max[i]=Math.max(max[i],v+p.radius);}
  const pivot=new THREE.Vector3(...min.map((v,i)=>(v+max[i])/2));
  const candidates=[];
  if(quaternion)candidates.push(quaternion.clone());
  else for(const r of [0,Math.PI/2])for(let y=0;y<8;y++)for(const p of [-Math.PI/6,0,Math.PI/6])candidates.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(.34+p,-.28+y*Math.PI/4,.035+r,'XYZ')));
  let best=null;
  for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++){
    const q=candidates[candidateIndex],convert=p=>{const v=new THREE.Vector3(p.x,p.y,p.z).sub(pivot).applyQuaternion(q);return{x:v.dot(right),y:v.dot(up),z:v.dot(back),r:p.radius};},points=primitives.map(convert),depthPoints=selected?all.map(convert):points;
    const measure=s=>{
      let tx=(cx-width/2)*d/f,ty=(height/2-cy)*d/f,bounds;
      const project=()=>{let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
        for(const p of points){const z=d-s*p.z,r=s*p.r;for(const dz of [-r,r]){const depth=z+dz;if(depth<=.2||depth>=camera.far)return null;for(const dx of [-r,r])for(const dy of [-r,r]){const x=width/2+f*(s*p.x+tx+dx)/depth,y=height/2-f*(s*p.y+ty+dy)/depth;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}}
        return{left,right,top,bottom,width:right-left,height:bottom-top};};
      for(let i=0;i<8;i++){bounds=project();if(!bounds)return{fits:false};const dx=cx-(bounds.left+bounds.right)/2,dy=cy-(bounds.top+bounds.bottom)/2;if(Math.hypot(dx,dy)<.05)break;tx+=dx*d/f;ty-=dy*d/f;}
      bounds=project();if(!bounds)return{fits:false};
      const depthOK=depthPoints.every(p=>d-s*(p.z+p.r)>.2&&d-s*(p.z-p.r)<camera.far);
      return{fits:depthOK&&bounds.left>=S.left&&bounds.right<=S.right&&bounds.top>=S.top&&bounds.bottom<=S.bottom,bounds,tx,ty,qMin:Math.min(...points.map(p=>f*s/(d-s*p.z))),occupancy:Math.max(bounds.width/S.width,bounds.height/S.height)};
    };
    let low=0,high=8;while(high<64&&measure(high).fits)high*=2;
    for(let j=0;j<32;j++){const mid=(low+high)/2;if(measure(mid).fits)low=mid;else high=mid;}
    const scale=low*.92,result=measure(scale);if(!result.fits)continue;
    if(!best||result.qMin>best.qMin+1e-9){const position=right.clone().multiplyScalar(result.tx).addScaledVector(up,result.ty).sub(pivot.clone().applyQuaternion(q).multiplyScalar(scale));
      const radius=Math.max(...all.map(p=>Math.hypot(p.x-pivot.x,p.y-pivot.y,p.z-pivot.z)+p.radius));
      best={...result,scale,position:position.toArray(),quaternion:q.toArray(),pivot:pivot.toArray(),safeRegion:S,candidateIndex,maxZoomFactor:Math.min(8,(d-.3)/(1.12*scale*radius)),radius};}
  }
  if(!best||!atomIndices&&(best.occupancy<.69||best.occupancy>.95||best.maxZoomFactor<1))throw new Error('POLYMER_FIT_UNAVAILABLE');
  return best;
}

export function resizePolymerCanvas({canvas,renderer,camera,pixelRatio}){
  const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return{changed:false,cssChanged:false};
  const ratio=Math.min(Math.max(pixelRatio||1,1),2),width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);
  const changed=canvas.width!==width||canvas.height!==height||renderer.getPixelRatio()!==ratio,aspect=rect.width/rect.height;
  if(changed)renderer.setDrawingBufferSize(width/ratio,height/ratio,ratio);
  if(camera.aspect!==aspect){camera.aspect=aspect;camera.updateProjectionMatrix();}
  return{changed,width,height,ratio,cssWidth:rect.width,cssHeight:rect.height};
}

// Actual captured input and actual Core byproduct partitions, never inferred
// atom-index continuity. Separate graphs receive separate presentation identity.
export function polymerComparisonGraphs(sample,sources,byproducts){
  const before={atoms:[],bonds:[],atomOrigins:[]};
  for(const source of sources){const offset=before.atoms.length;for(let i=0;i<source.atoms.length;i++){const a=source.atoms[i];before.atoms.push({id:offset+i,element:a.element,x:a.point[0],y:a.point[1],z:a.point[2]});before.atomOrigins.push({instanceId:source.instanceId,sourceAtomIndex:i});}for(const b of source.bonds)before.bonds.push({a:b.a+offset,b:b.b+offset,order:b.order});}
  const used=new Set(),key=o=>JSON.stringify([o.instanceId,o.sourceAtomIndex]);
  for(const g of [sample.fragment,...byproducts.map(b=>b.graph)])for(const o of g.atomOrigins){const k=key(o);if(used.has(k))throw new Error('POLYMER_COMPARISON_DUPLICATE_ORIGIN');used.add(k);}
  if(used.size!==before.atoms.length||before.atomOrigins.some(o=>!used.has(key(o))))throw new Error('POLYMER_COMPARISON_PARTITION_MISMATCH');
  return{before,after:sample.fragment,byproducts};
}
