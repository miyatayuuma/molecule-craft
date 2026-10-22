import {ELEMENTS,modelAtomRadius} from './chemistry.js?v=20';
import {resolvePolymerFragmentTargets} from './polymer-fragment-3d-layout.js?v=1';

const round=value=>Number(value.toFixed(3));
const pointOf=value=>Array.isArray(value)?value:{x:value?.x??0,y:value?.y??0,z:value?.z??0};
const elementOf=atom=>typeof atom==='string'?atom:atom.element;
const bondKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const bondLength=(left,right)=>left==='H'||right==='H'?1.08:left==='O'||right==='N'?1.36:1.48;

// This one topology-derived layout is shared by live samples and generated SVGs.
// Coordinates are presentation-only and never become chemistry or Stage B data.
export function createPolymerPresentationPlan(sample,{sourceRecordsByInstanceId={}}={}){
  if(!sample?.fragment||!Array.isArray(sample.fragment.atoms)||!Array.isArray(sample.fragment.bonds)||!Array.isArray(sample.fragment.atomOrigins))throw new TypeError('A finite PolymerSample graph is required.');
  const graph=sample.fragment,units=[];
  for(const origin of graph.atomOrigins){if(!units.includes(origin.instanceId))units.push(origin.instanceId);}
  const unitIndex=new Map(units.map((id,index)=>[id,index]));
  const raw=graph.atoms.map((atom,index)=>{
    const origin=graph.atomOrigins[index],record=sourceRecordsByInstanceId[origin?.instanceId],sourceAtom=record?.atoms?.[origin?.sourceAtomIndex];
    const sourcePoint=pointOf(sourceAtom?.point),indexOffset=origin?.sourceAtomIndex??index,angle=indexOffset*2.399963229728653;
    return{x:sourceAtom?.point?sourcePoint.x:Math.cos(angle)*.8,y:sourceAtom?.point?sourcePoint.y:Math.sin(angle)*.8,z:sourceAtom?.point?sourcePoint.z:0,unit:unitIndex.get(origin?.instanceId)??0,element:atom.element??elementOf(sourceAtom??'C'),formalCharge:atom.formalCharge??0,initial:null,id:index};
  });
  const groupBounds=new Map();
  for(const atom of raw){const bounds=groupBounds.get(atom.unit)??{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};bounds.minX=Math.min(bounds.minX,atom.x);bounds.maxX=Math.max(bounds.maxX,atom.x);bounds.minY=Math.min(bounds.minY,atom.y);bounds.maxY=Math.max(bounds.maxY,atom.y);groupBounds.set(atom.unit,bounds);}
  let cursor=0;
  for(const unit of units.map((_,index)=>index)){
    const bounds=groupBounds.get(unit)??{minX:0,maxX:0,minY:0,maxY:0},width=bounds.maxX-bounds.minX;
    if(unit>0)cursor+=Math.max(1.65,width*.42+1.15);
    const center=(bounds.minX+bounds.maxX)*.5;
    for(const atom of raw.filter(item=>item.unit===unit)){atom.x=atom.x-center+cursor;atom.initial={x:atom.x,y:atom.y,z:atom.z};}
  }
  const bonds=graph.bonds.map(bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond),bondSet=new Set(bonds.map(bond=>bondKey(bond.a,bond.b)));
  const links=bonds.filter(bond=>graph.atomOrigins[bond.a]?.instanceId!==graph.atomOrigins[bond.b]?.instanceId);
  // Tether each monomer to its canonical conformation while resolving authored
  // inter-unit bonds and severe screen-plane overlap deterministically.
  for(let step=0;step<180;step++){
    const fx=raw.map(()=>0),fy=raw.map(()=>0);
    for(const bond of bonds){const a=raw[bond.a],b=raw[bond.b],dx=b.x-a.x,dy=b.y-a.y,distance=Math.max(.001,Math.hypot(dx,dy)),target=bondLength(a.element,b.element),strength=links.includes(bond)?.16:.075,force=(distance-target)*strength*(bond.order===1?1:.85),x=dx/distance*force,y=dy/distance*force;fx[bond.a]+=x;fy[bond.a]+=y;fx[bond.b]-=x;fy[bond.b]-=y;}
    for(let a=0;a<raw.length;a++)for(let b=a+1;b<raw.length;b++){
      if(bondSet.has(bondKey(a,b)))continue;const dx=raw[b].x-raw[a].x,dy=raw[b].y-raw[a].y,distance=Math.max(.001,Math.hypot(dx,dy)),cutoff=(modelAtomRadius(raw[a].element)+modelAtomRadius(raw[b].element))*.82;
      if(distance>=cutoff)continue;const force=(cutoff-distance)*.035,x=dx/distance*force,y=dy/distance*force;fx[a]-=x;fy[a]-=y;fx[b]+=x;fy[b]+=y;
    }
    const damping=.22;
    for(let index=0;index<raw.length;index++){const atom=raw[index];atom.x+=(fx[index]+(atom.initial.x-atom.x)*.018)*damping;atom.y+=(fy[index]+(atom.initial.y-atom.y)*.018)*damping;}
  }
  const minX=Math.min(...raw.map(atom=>atom.x)),maxX=Math.max(...raw.map(atom=>atom.x)),minY=Math.min(...raw.map(atom=>atom.y)),maxY=Math.max(...raw.map(atom=>atom.y)),centerX=(minX+maxX)*.5,centerY=(minY+maxY)*.5;
  const atoms=raw.map(atom=>({...atom,x:atom.x-centerX,y:atom.y-centerY}));
  const continuations=(sample.representation?.continuations??[]).map((item,index)=>{
    const atomIndex=Number.isInteger(item.atomRef)?item.atomRef:Number.parseInt(String(item.atomRef).split(':').at(-1),10),atom=atoms[atomIndex];
    const direction=index%2===0?1:-1;return{...item,atomIndex,x:atom?.x??0,y:(atom?.y??0)+direction*.95};
  });
  return{polymerId:sample.polymerId,routeId:sample.routeId,atoms,bonds,continuations,qualifiers:[...(sample.representation?.qualifiers??[])],bounds:{minX:minX-centerX,maxX:maxX-centerX,minY:minY-centerY,maxY:maxY-centerY,width:maxX-minX,height:maxY-minY},unitCount:units.length};
}

export function polymerPresentationSvg(sample,{sourceRecordsByInstanceId={},title='Representative polymer segment'}={}){
  const plan=createPolymerPresentationPlan(sample,{sourceRecordsByInstanceId}),padding=1.25,width=plan.bounds.width+padding*2,height=plan.bounds.height+padding*2+Math.min(1.25,plan.qualifiers.length*.3),scale=Math.min(140/Math.max(width,1),82/Math.max(height,1)),cx=96,cy=55;
  const project=atom=>({x:cx+atom.x*scale,y:cy-atom.y*scale}),shapes=[];
  for(const bond of plan.bonds){const a=project(plan.atoms[bond.a]),b=project(plan.atoms[bond.b]);shapes.push(`<path d="M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}" stroke="#91aebd" stroke-width="${Math.max(1.2,round(scale*.085))}" stroke-linecap="round"/>`);}
  for(const continuation of plan.continuations){const at=plan.atoms[continuation.atomIndex];if(!at)continue;const a=project(at),b={x:cx+continuation.x*scale,y:cy-continuation.y*scale};shapes.push(`<path data-polymer-continuation="true" d="M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}" stroke="#83d7cd" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="${round(b.x)}" cy="${round(b.y)}" r="2.2" fill="none" stroke="#83d7cd"/>`);}
  for(const atom of plan.atoms){const {x,y}=project(atom),radius=Math.max(2,modelAtomRadius(atom.element)*scale*.68),color=ELEMENTS[atom.element]?.color??'#cbd5e1';shapes.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}" fill="${color}" stroke="#102433" stroke-opacity=".55" stroke-width=".55"/>`);}
  const qualifier=plan.qualifiers.length?`<text x="96" y="118" text-anchor="middle" fill="#a9c3cf" font-size="5.1" font-family="sans-serif">${escapeXml(plan.qualifiers.join(' · '))}</text>`:'';
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128" role="img" aria-label="${escapeXml(title)}" data-polymer-id="${escapeXml(plan.polymerId)}"><rect width="192" height="128" fill="#0b1924"/><g>${shapes.join('')}</g>${qualifier}</svg>\n`;
}
function escapeXml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));}

// Task⑤ finite observation presentation. Kept in this existing module to
// preserve the strict baseline+one module-fetch/resource contract.
// Presentation only. No graph edits, geometry solves, persistence or fixed-step work.

export const POLYMER_VIEW_STATES=Object.freeze(['OVERVIEW_NEUTRAL','SELECTED','LOCAL_FOCUS','COMPARE_BEFORE','COMPARE_AFTER','COMPARE_BYPRODUCT','CONCEPT_SEPARATE']);
export function polymerLaneOffsets(order){
  if(order===1)return[0];if(order===2)return[-.080,.080];if(order===3)return[-.160,0,.160];
  throw new TypeError('Unsupported polymer bond order');
}
export const polymerLaneRadius=order=>order===1?.050:.038;

// Comparison groups own these meshes. Refit updates transforms, never geometry.
export function updatePolymerComparisonLanes(THREE,group,plan,camera){
  group.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const view=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,2).applyQuaternion(group.getWorldQuaternion(new THREE.Quaternion()).invert()),up=new THREE.Vector3(0,1,0);
  for(const mesh of group.userData.bondLanes??[]){const {bondIndex,offset}=mesh.userData,b=plan.bonds[bondIndex],a=plan.atoms[b.a],z=plan.atoms[b.b],A=new THREE.Vector3(a.x,a.y,a.z),axis=new THREE.Vector3(z.x,z.y,z.z).sub(A),length=axis.length(),direction=axis.clone().normalize(),side=new THREE.Vector3().crossVectors(direction,view),previous=mesh.userData.side;
    if(side.lengthSq()<1e-8&&previous)side.copy(previous).addScaledVector(direction,-previous.dot(direction));
    if(side.lengthSq()<1e-8){const fallback=[new THREE.Vector3(1,0,0),up,new THREE.Vector3(0,0,1)].sort((a,b)=>Math.abs(a.dot(direction))-Math.abs(b.dot(direction)))[0];side.crossVectors(direction,fallback);}
    side.normalize();if(previous&&side.dot(previous)<0)side.negate();mesh.userData.side=side;
    const trim=element=>Math.max(0,Math.sqrt(Math.max(0,modelAtomRadius(element)**2-offset**2))-.01),start=trim(a.element),end=trim(z.element),exposed=length-start-end,radius=polymerLaneRadius(b.order);
    mesh.visible=exposed>0;mesh.scale.set(radius,Math.max(0,exposed),radius);mesh.position.copy(A).addScaledVector(direction,start+exposed/2).addScaledVector(side,offset);mesh.quaternion.setFromUnitVectors(up,direction);
  }
}
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

export function fitPolymerObservation(THREE,{plan,camera,width,height,safeRegion,atomIndices=null,quaternion=null,requiredAtomIndices=[],occludingAtoms=[]}){
  if(!safeRegion||!plan?.atoms?.length)throw new Error('POLYMER_SAFE_REGION_UNAVAILABLE');
  camera.updateMatrixWorld(true);
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),back=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,2);
  const d=camera.position.length(),f=height/(2*Math.tan(camera.fov*Math.PI/360)),S=safeRegion,cx=(S.left+S.right)/2,cy=(S.top+S.bottom)/2;
  const all=polymerVisualPrimitives(plan),selected=atomIndices?new Set(atomIndices):null,primitives=selected?all.filter(p=>selected.has(p.atomIndex)):all;
  if(!primitives.length)throw new Error('POLYMER_EMPTY_FOCUS');
  let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of primitives)for(let i=0;i<3;i++){const v=[p.x,p.y,p.z][i];min[i]=Math.min(min[i],v-p.radius);max[i]=Math.max(max[i],v+p.radius);}
  const pivot=new THREE.Vector3(...min.map((v,i)=>(v+max[i])/2));
  const radius=Math.max(...all.map(p=>Math.hypot(p.x-pivot.x,p.y-pivot.y,p.z-pivot.z)+p.radius));
  // A local crop still owns the whole graph. Reserve the existing spherical
  // near/far budget at focus time so orbit does not silently change its scale.
  const focusScaleLimit=selected?Math.min((d-.3)/(1.12*radius),(camera.far-d-.01)/(1.12*radius)):Infinity;
  const candidates=[];
  if(quaternion)candidates.push(quaternion.clone());
  else for(const pitches of [[-Math.PI/6,0,Math.PI/6],[-Math.PI/3,Math.PI/3]])for(const r of [0,Math.PI/2])for(let y=0;y<8;y++)for(const p of pitches)candidates.push(new THREE.Quaternion().setFromEuler(new THREE.Euler(.34+p,-.28+y*Math.PI/4,.035+r,'XYZ')));
  // Snapshot input is fixed for this fit. Reset reuses the selected transform;
  // moving ordinary molecules never trigger another orientation search in RAF.
  const occluders=occludingAtoms.map(a=>({point:new THREE.Vector3(...a.point).applyMatrix4(camera.matrixWorldInverse),radius:a.radius}));
  let best=null;
  for(let candidateIndex=0;candidateIndex<candidates.length;candidateIndex++){
    if(candidateIndex===48&&best)break;
    const q=candidates[candidateIndex],convert=p=>{const v=new THREE.Vector3(p.x,p.y,p.z).sub(pivot).applyQuaternion(q);return{x:v.dot(right),y:v.dot(up),z:v.dot(back),r:p.radius};},points=primitives.map(convert),atomPoints=plan.atoms.map(a=>({...convert(a),r:modelAtomRadius(a.element)})),depthPoints=selected?all.map(convert):points;
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
    const scale=Math.min(low*.92,focusScaleLimit),result=measure(scale);if(!result.fits||!atomIndices&&(result.occupancy<.69||result.occupancy>.95))continue;
    const visibility=[];
    for(const index of requiredAtomIndices){const atom=plan.atoms[index];if(!atom)throw new Error('POLYMER_UNKNOWN_INITIAL_TARGET');const center=atomPoints[index],x=scale*center.x+result.tx,y=scale*center.y+result.ty,z=-d+scale*center.z,r=scale*modelAtomRadius(atom.element),px=width/2+f*x/(-z),py=height/2-f*y/(-z),rp=f*r/(-z);let visible=0;
      for(let k=0;k<64;k++){const radius=Math.sqrt((k+.5)/64)*rp,angle=k*2.3999632297,ray=new THREE.Vector3((px+radius*Math.cos(angle)-width/2)/f,(height/2-py-radius*Math.sin(angle))/f,-1).normalize();let nearest=Infinity,hit=-1;
        for(let i=0;i<plan.atoms.length;i++){const a=atomPoints[i],cx=scale*a.x+result.tx,cy=scale*a.y+result.ty,cz=-d+scale*a.z,rr=scale*a.r,b=ray.x*cx+ray.y*cy+ray.z*cz,disc=b*b-(cx*cx+cy*cy+cz*cz-rr*rr);if(disc<0)continue;const t=b-Math.sqrt(disc);if(t>0&&t<nearest){nearest=t;hit=i;}}
        for(const a of occluders){const b=ray.dot(a.point),disc=b*b-a.point.lengthSq()+a.radius*a.radius;if(disc<0)continue;const t=b-Math.sqrt(disc);if(t>0&&t<nearest){nearest=t;hit=-1;}}
        if(hit===index)visible++;
      }visibility.push({index,visibleFraction:visible/64});
    }
    if(visibility.some(v=>v.visibleFraction<.70))continue;

    if(!best||result.qMin>best.qMin+1e-9){const position=right.clone().multiplyScalar(result.tx).addScaledVector(up,result.ty).sub(pivot.clone().applyQuaternion(q).multiplyScalar(scale));
      best={...result,scale,position:position.toArray(),quaternion:q.toArray(),pivot:pivot.toArray(),safeRegion:S,candidateIndex,initialTargetVisibility:visibility,visibilityOccluders:occludingAtoms.map(a=>({...a,point:[...a.point]})),maxZoomFactor:Math.min(8,(d-.3)/(1.12*scale*radius)),radius};}
  }
  if(!best||!atomIndices&&(best.occupancy<.69||best.occupancy>.95||best.maxZoomFactor<1)){const error=new Error('POLYMER_FIT_UNAVAILABLE');error.fitDiagnostic={width,height,safeRegion,best};throw error;}
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
  const edges=g=>new Map(g.bonds.map(b=>{const a=key(g.atomOrigins[b.a]),z=key(g.atomOrigins[b.b]);return[[a,z].sort().join('|'),b.order];})),old=edges(before),after=new Map([sample.fragment,...byproducts.map(b=>b.graph)].flatMap(g=>[...edges(g)]));
  const transition={broken:[...old].filter(([k])=>!after.has(k)),formed:[...after].filter(([k])=>!old.has(k)),orderChanged:[...old].filter(([k,v])=>after.has(k)&&after.get(k)!==v).map(([k,v])=>({originEdge:k,before:v,after:after.get(k)}))};
  return{before,after:sample.fragment,byproducts,transition};
}


// Local UI targets supplement the Task④ aggregate resolver. Each target owns
// actual graph edges at one junction/site, including every attached methyl H.
export function polymerLocalObservationTargets(graph,semantics){
  const targets=[],backbone=new Set(semantics.backbone.atomIndices),attachments=semantics.sideAttachment.bondIndices;
  const add=(label,kind,anchor,edges)=>{const bondIndices=[...new Set(edges)].sort((a,b)=>a-b),atomIndices=[...new Set(bondIndices.flatMap(i=>[graph.bonds[i].a,graph.bonds[i].b]))].sort((a,b)=>a-b);if(atomIndices.length)targets.push({label,target:{kind:`local:${kind}`,anchor,atomIndices,bondIndices,originTuples:atomIndices.map(i=>({...graph.atomOrigins[i]}))}});};
  for(const center of [...new Set(attachments.flatMap(i=>[graph.bonds[i].a,graph.bonds[i].b]).filter(i=>backbone.has(i)))]){
    add(`側基のつなぎ目 ${targets.length+1}`,'side/junction/adjacent-backbone',center,[...attachments.filter(i=>{const b=graph.bonds[i];return b.a===center||b.b===center;}),...semantics.methyl.filter(t=>t.atomIndices.includes(center)).flatMap(t=>t.bondIndices),...graph.bonds.flatMap((b,i)=>(b.a===center||b.b===center)&&backbone.has(b.a)&&backbone.has(b.b)?[i]:[])]);
  }
  for(const [key,label]of [['ester','エステル'],['amide','アミド'],['nitrile','三重結合 C≡N'],['diene','鎖の二重結合']]){
    const sites=new Map();for(const edge of semantics[key].bondIndices){const b=graph.bonds[edge],base=new Set([b.a,b.b]),indices=new Set(base);for(const e of graph.bonds)if((base.has(e.a)||base.has(e.b))&&((graph.atoms[e.a].element!=='H'&&graph.atoms[e.b].element!=='H')||[e.a,e.b].some(i=>base.has(i)&&graph.atoms[i].element==='N'))){indices.add(e.a);indices.add(e.b);}const edges=graph.bonds.flatMap((e,i)=>indices.has(e.a)&&indices.has(e.b)?[i]:[]);sites.set(b.a,[...(sites.get(b.a)??[]),...edges]);}
    let n=0;for(const [anchor,edges]of sites)add(`${label}の部分 ${++n}`,semantics[key].kind,anchor,edges);
  }
  return targets;
}

export function createPolymerObservationUi({THREE,root,canvas,camera,world,signal,getVisual,getPresentation,getEvidence,onReset,onPoseChange}){
  const host=document.createElement('div');host.className='polymer-observation';host.hidden=true;
  host.innerHTML='<div class="polymer-observation-line"><span data-observation-copy></span><button type="button" data-observation-menu aria-expanded="false">観察する</button></div><div data-observation-panel hidden><div class="polymer-observation-toolbar"><button type="button" data-observation-close>戻る</button><button type="button" data-observation-before>原料</button><button type="button" data-observation-after>できた模型</button><button type="button" data-observation-water>別にできた水</button><button type="button" data-observation-concept hidden>網目のしくみ</button></div><div data-observation-legend></div><label>調べる部分<select data-observation-target><option value="">選んでください</option></select></label><div data-observation-detail role="status" aria-live="polite"></div><div data-observation-candidates></div><button type="button" data-observation-focus disabled>くわしく見る</button></div>';
  const persistentLegend=host.querySelector('[data-observation-legend]');host.append(persistentLegend);
  root.querySelector('[data-polymer-completion]').append(host);
  const $=s=>host.querySelector(s),copy=$('[data-observation-copy]'),panel=$('[data-observation-panel]'),target=$('[data-observation-target]'),detail=$('[data-observation-detail]'),focus=$('[data-observation-focus]'),candidates=$('[data-observation-candidates]');
  const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.classList.add('polymer-observation-outline');overlay.setAttribute('aria-hidden','true');canvas.parentElement.append(overlay);
  const concept=document.createElement('section');concept.className='polymer-observation-concept';concept.hidden=true;concept.innerHTML='<h3>網目のしくみを説明する模式図</h3><img src="assets/models/polymer-phenol-formaldehyde-resin.svg" alt="図鑑の独立した四つの環と三つの橋の模式図"><p>今回つないだ模型とは別の説明です。</p>';canvas.parentElement.append(concept);
  let overviewEnds=[],state='OVERVIEW_NEUTRAL',selection=null,targets=[],comparison=null,comparisonGroup=null,comparisonPlan=null,evidence=null,visibility=[],contextLost=false;
  const visibleGroup=()=>comparisonGroup??getVisual()?.group;
  function safeRegion(){const r=canvas.getBoundingClientRect(),rects=[];for(const el of root.querySelectorAll('.reaction-lab-equipment,.reaction-lab-medium-selector,.reaction-lab-space>p,.reaction-lab-purge-outlet')){if(el.hidden||!el.getClientRects().length)continue;const b=el.getBoundingClientRect();rects.push({left:b.left-r.left,right:b.right-r.left,top:b.top-r.top,bottom:b.bottom-r.top});}return polymerSafeRectangle(r.width,r.height,rects);}
  function setCopy(){copy.textContent=state==='SELECTED'?detail.textContent:state==='LOCAL_FOCUS'?'一部を拡大中 · リセットで全体へ':state==='COMPARE_BEFORE'?'原料 · 同じ投入分の反応前の構造':state==='COMPARE_BYPRODUCT'?'別にできた水 · 模型とは別の原子':state==='CONCEPT_SEPARATE'?'しくみの説明 · 今回の模型とは別': 'ゲームでつないだ短い部分。形は一例';host.dataset.state=state;}
  function disposeComparison(){if(comparisonGroup){const gs=new Set(),ms=new Set();comparisonGroup.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());comparisonGroup.removeFromParent();comparisonGroup=null;comparisonPlan=null;}concept.hidden=true;for(const [o,v]of visibility)o.visible=v;visibility=[];}
  function hideWorld(){for(const o of world.children){visibility.push([o,o.visible]);o.visible=false;}}
  function reset(){disposeComparison();state='OVERVIEW_NEUTRAL';selection=null;target.value='';detail.textContent='原子を短くタップすると、名前と由来を調べられます。';focus.disabled=true;candidates.replaceChildren();overlay.replaceChildren();onReset();setCopy();}
  function updateOutline(){overlay.replaceChildren();if(!selection||comparisonGroup||concept.hidden===false||contextLost)return;const visual=getVisual();if(!visual||visual.suspended)return;const r=canvas.getBoundingClientRect(),f=r.height/(2*Math.tan(camera.fov*Math.PI/360));visual.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);overlay.setAttribute('viewBox',`0 0 ${r.width} ${r.height}`);
    const svg=(name,attributes)=>{const e=document.createElementNS(overlay.namespaceURI,name);for(const [key,value]of Object.entries(attributes))e.setAttribute(key,value);return e;},project=p=>{const depth=-p.clone().applyMatrix4(camera.matrixWorldInverse).z;if(depth<=.2)return null;const s=p.clone().project(camera);return{x:(s.x+1)*r.width/2,y:(1-s.y)*r.height/2,depth};};
    // Keep annotations behind the opaque model's projected primitives. The
    // two-pixel solid contours must not paint across a real atom or bond lane.
    const id=`${root.id}-polymer-model-occlusion`,defs=svg('defs',{}),mask=svg('mask',{id,maskUnits:'userSpaceOnUse',x:0,y:0,width:r.width,height:r.height,'data-polymer-model-occluders':''});mask.append(svg('rect',{width:r.width,height:r.height,fill:'white'}));
    const atomDisks=new Map();
    for(const [index,mesh]of visual.atomByGraphIndex){const p=project(mesh.getWorldPosition(new THREE.Vector3()));if(!p)continue;const radius=f*modelAtomRadius(visual.graph.atoms[index].element)*visual.group.scale.x/p.depth;atomDisks.set(index,{...p,radius});mask.append(svg('circle',{cx:p.x,cy:p.y,r:radius,fill:'black','data-polymer-model-atom':index}));}
    for(const mesh of visual.bondMeshes){if(!mesh.visible)continue;const a=project(new THREE.Vector3(0,-.5,0).applyMatrix4(mesh.matrixWorld)),b=project(new THREE.Vector3(0,.5,0).applyMatrix4(mesh.matrixWorld)),center=project(mesh.getWorldPosition(new THREE.Vector3()));if(!a||!b||!center)continue;const width=2*f*mesh.getWorldScale(new THREE.Vector3()).x/center.depth;mask.append(svg('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'black','stroke-width':width,'stroke-linecap':'round','data-polymer-model-lane':''}));}
    defs.append(mask);overlay.append(defs);const contours=svg('g',{mask:`url(#${id})`});overlay.append(contours);
    for(const i of selection.atomIndices){const p=atomDisks.get(i);if(!p)continue;const circle=svg('circle',{cx:p.x,cy:p.y,r:p.radius+2,fill:'none',stroke:'#fff4b8','stroke-width':2,'data-polymer-selected-atom':i});if(selection.kind?.startsWith('source:'))circle.setAttribute('stroke-dasharray','5 3');contours.append(circle);}}
  function select(item,label){if(!getPresentation()?.ready||comparisonGroup||!concept.hidden)return;selection=item;state='SELECTED';detail.textContent=label;focus.disabled=false;candidates.replaceChildren();setCopy();updateOutline();}
  function selectAtom(index){const g=getVisual()?.graph,a=g?.atoms[index],o=g?.atomOrigins[index];if(!a||!o)return;const source=evidence.sources.find(s=>s.instanceId===o.instanceId),ordinal=evidence.sources.indexOf(source)+1;
    select({kind:'atom',atomIndices:[index],bondIndices:[],originTuples:[o]},`${a.element}・${POLYMER_ELEMENT_NAMES[a.element]??a.element} / atom ${index} · 原料${ordinal} ${source?.name??source?.species??o.instanceId} / atom ${o.sourceAtomIndex}`);}
  function hitCandidates(event){const v=getVisual();if(!v||v.suspended||comparisonGroup||!concept.hidden)return[];const rect=canvas.getBoundingClientRect(),ray=new THREE.Raycaster(),point=new THREE.Vector2(),meshes=[...v.atomByGraphIndex.values()].filter(m=>m.visible);v.group.updateMatrixWorld(true);
    const cast=(x,y)=>{point.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);ray.setFromCamera(point,camera);return ray.intersectObjects(meshes,false)[0]?.object;},hits=new Set(),direct=cast(event.clientX,event.clientY);if(direct)hits.add(direct);
    if(event.pointerType==='touch'||!direct)for(const radius of [11,22])for(let n=0;n<12;n++){const a=n*Math.PI/6,m=cast(event.clientX+radius*Math.cos(a),event.clientY+radius*Math.sin(a));if(m)hits.add(m);}
    return[...hits].map(m=>m.userData.polymerGraphIndex).filter(Number.isInteger).sort((a,b)=>a-b);
  }
  function tap(event){const hits=hitCandidates(event);if(hits.length===1){selectAtom(hits[0]);return;}if(!hits.length)return;
    panel.hidden=false;$('[data-observation-menu]').setAttribute('aria-expanded','true');candidates.replaceChildren();detail.textContent='近くの原子を選んでください';for(const i of hits){const b=document.createElement('button');b.type='button';b.textContent=`${getVisual().graph.atoms[i].element} · atom ${i}`;b.addEventListener('click',()=>selectAtom(i),{signal});candidates.append(b);}}
  function prepare(sample,sourceRecords,route,coreEvidence,sources){
    reset();evidence={sample,sources,sourceRecords,route,coreEvidence};host.hidden=false;
    const semantics=resolvePolymerFragmentTargets(sample,{sourceRecordsByInstanceId:sourceRecords,route});targets=[];
    const add=(label,t)=>{if(t?.atomIndices?.length)targets.push({label,target:t});};
    overviewEnds=route.builder==='network'?[]:semantics.ends.atomIndices;
    if(semantics.resolved){if(route.builder!=='network')add('主鎖',semantics.backbone);add('側基とのつなぎ目',semantics.sideAttachment);semantics.rings.forEach((t,i)=>add(`輪 ${i+1}`,t));for(const [name,key]of [['エステル','ester'],['アミド','amide'],['三重結合 C≡N','nitrile'],['鎖の二重結合','diene'],['今の鎖の端','ends']])add(name,semantics[key]);for(const [name,key]of [['エーテル','ether'],['酸のOH','acidOH'],['メチル','methyl'],['環をつなぐCH₂','methyleneBridge'],['CH₂OH','hydroxymethyl']])semantics[key].forEach((t,i)=>add(`${name} ${i+1}`,t));semantics.sources.forEach((t,i)=>add(`原料 ${i+1} ${sources.find(s=>s.instanceId===t.originTuples[0]?.instanceId)?.name??''}`,t));}
    if(semantics.resolved)targets.push(...polymerLocalObservationTargets(sample.fragment,semantics));
    sample.fragment.atoms.forEach((a,i)=>add(`原子 ${a.element} · atom ${i}`,{kind:'atom',atomIndices:[i],bondIndices:[],originTuples:[sample.fragment.atomOrigins[i]]}));
    target.replaceChildren(new Option('選んでください',''));targets.forEach((t,i)=>target.add(new Option(t.label,String(i))));
    const legend=$('[data-observation-legend]');legend.replaceChildren();for(const el of new Set(sample.fragment.atoms.map(a=>a.element))){const item=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=ELEMENTS[el]?.color??'#cbd5e1';item.append(swatch,`${el} ${POLYMER_ELEMENT_NAMES[el]??el} `);legend.append(item);}legend.append(document.createTextNode('結合：1本 — / 2本 ═ / 3本 ≡'));
    comparison=polymerComparisonGraphs(sample,sources,coreEvidence.byproducts);$('[data-observation-water]').disabled=!comparison.byproducts.length;$('[data-observation-concept]').hidden=route.builder!=='network';
    if(route.builder==='network')detail.textContent='今回ゲームでつないだ部分は二つの環。保護者向け：結合位置の化学的評価は未完了（L2）。';
    host.dataset.sampleId=sample.sampleId;setCopy();
  }
  function compare(kind){if(!getPresentation()?.ready||!comparison)return;panel.hidden=true;disposeComparison();selection=null;overlay.replaceChildren();focus.disabled=true;
    if(kind==='after'){onReset();state='COMPARE_AFTER';setCopy();return;}hideWorld();
    if(kind==='concept'){concept.hidden=false;state='CONCEPT_SEPARATE';setCopy();return;}
    const rows=kind==='before'?[{graph:comparison.before,atoms:comparison.before.atoms}]:comparison.byproducts.map((b,n)=>{const pose=coreWaterPose(b);return{graph:b.graph,atoms:pose.map((p,i)=>({...b.graph.atoms[i],x:p[0]+n*3,y:p[1],z:p[2]}))};});
    const plan={atoms:[],bonds:[],atomOrigins:[]};for(const row of rows){const offset=plan.atoms.length;plan.atoms.push(...row.atoms);plan.atomOrigins.push(...row.graph.atomOrigins);plan.bonds.push(...row.graph.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})));}
    comparisonGroup=new THREE.Group();comparisonGroup.userData.presentationIdentity=kind==='before'?'source-snapshot':'actual-byproducts';world.add(comparisonGroup);
    for(const a of plan.atoms){const mesh=new THREE.Mesh(new THREE.SphereGeometry(modelAtomRadius(a.element),24,16),new THREE.MeshStandardMaterial({color:ELEMENTS[a.element].color,roughness:.32,metalness:.08}));mesh.position.set(a.x,a.y,a.z);comparisonGroup.add(mesh);}
    comparisonGroup.userData.bondLanes=[];
    for(const [bondIndex,b]of plan.bonds.entries())for(const offset of polymerLaneOffsets(b.order)){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,12),new THREE.MeshStandardMaterial({color:'#b8d1de',roughness:.5,metalness:0}));mesh.userData={bondIndex,offset};comparisonGroup.add(mesh);comparisonGroup.userData.bondLanes.push(mesh);}
    comparisonPlan=plan;refitComparison();state=kind==='before'?'COMPARE_BEFORE':'COMPARE_BYPRODUCT';setCopy();
  }
  function refitComparison(){if(!comparisonGroup||!comparisonPlan)return;const r=canvas.getBoundingClientRect(),fit=fitPolymerObservation(THREE,{plan:comparisonPlan,camera,width:r.width,height:r.height,safeRegion:safeRegion()});comparisonGroup.position.fromArray(fit.position);comparisonGroup.quaternion.fromArray(fit.quaternion);comparisonGroup.scale.setScalar(fit.scale);updatePolymerComparisonLanes(THREE,comparisonGroup,comparisonPlan,camera);comparisonGroup.userData.fit=fit;}
  function coreWaterPose(b){const canonical=evidence.coreEvidence.byproductPoses?.[b.instanceId];if(!canonical)throw new Error('POLYMER_WATER_POSE_UNAVAILABLE');return canonical;}
  target.addEventListener('change',()=>{const row=targets[Number(target.value)];if(target.value!==''&&row){if(row.target.kind==='atom')selectAtom(row.target.atomIndices[0]);else select(row.target,row.label);}},{signal});
  function focusSelection({preserveOrientation=false}={}){if(!selection)return;panel.hidden=true;const visual=getVisual(),g=visual.graph,indices=new Set(selection.atomIndices);for(const b of g.bonds)if(selection.atomIndices.includes(b.a)||selection.atomIndices.includes(b.b)){indices.add(b.a);indices.add(b.b);}const r=canvas.getBoundingClientRect(),fit=fitPolymerObservation(THREE,{plan:visual.layoutPlan,camera,width:r.width,height:r.height,safeRegion:safeRegion(),atomIndices:[...indices],quaternion:preserveOrientation?visual.group.quaternion:null});visual.group.position.fromArray(fit.position);visual.group.quaternion.fromArray(fit.quaternion);visual.group.scale.setScalar(fit.scale);getPresentation().focusFit=fit;getPresentation().zoomFactor=1;state='LOCAL_FOCUS';setCopy();onPoseChange();updateOutline();}
  focus.addEventListener('click',()=>focusSelection(),{signal});
  $('[data-observation-close]').addEventListener('click',()=>{panel.hidden=true;$('[data-observation-menu]').setAttribute('aria-expanded','false');},{signal});
  $('[data-observation-menu]').addEventListener('click',()=>{panel.hidden=!panel.hidden;$('[data-observation-menu]').setAttribute('aria-expanded',String(!panel.hidden));},{signal});
  for(const [name,kind]of [['before','before'],['after','after'],['water','water'],['concept','concept']])$(`[data-observation-${name}]`).addEventListener('click',()=>compare(kind),{signal});
  return{prepare,reset,tap,refitComparison,get initialEnds(){return overviewEnds;},get resourceGroup(){return comparisonGroup;},safeRegion,updateOutline,get state(){return state;},get selection(){return selection;},get comparisonActive(){return !!comparisonGroup||!concept.hidden;},refitLocal:()=>focusSelection({preserveOrientation:true}),resume(){if(state==='COMPARE_BEFORE')compare('before');else if(state==='COMPARE_BYPRODUCT')compare('water');else if(state==='CONCEPT_SEPARATE')compare('concept');else updateOutline();},snapshot:()=>({state,selection,targets,comparisonIdentity:comparisonGroup?.userData.presentationIdentity??(!concept.hidden?'independent-network-concept':null),sampleId:getPresentation()?.sampleId??null,comparisonGraph:comparisonPlan,transition:comparison?.transition??null,comparisonFit:comparisonGroup?.userData.fit??null,safeRegion:safeRegion()}),suspend(){disposeComparison();overlay.replaceChildren();},hide(){disposeComparison();host.hidden=true;panel.hidden=true;overlay.replaceChildren();evidence=null;comparison=null;overviewEnds=[];},contextLost(value){contextLost=value;overlay.replaceChildren();},dispose(){disposeComparison();host.remove();overlay.remove();concept.remove();}};
}
