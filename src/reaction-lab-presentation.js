const finitePoint=point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const scale=(a,k)=>a.map(value=>value*k);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);

export const REACTION_PRESENTATION_NORMAL_PHASES=Object.freeze({prepare:120,transform:850,settle:230});
export const REACTION_PRESENTATION_REDUCED_PHASES=Object.freeze({prepare:30,transform:140,settle:50});

export function smoothPresentationProgress(progress){const t=Math.max(0,Math.min(1,progress));return t*t*(3-2*t);}

export function planBondLaneTransition(oldOrder,newOrder){
  if(!Number.isInteger(oldOrder)||oldOrder<0||!Number.isInteger(newOrder)||newOrder<0)throw new Error('Bond orders must be non-negative integers.');
  const persistent=Math.min(oldOrder,newOrder);
  return{oldOrder,newOrder,persistent,lanes:Array.from({length:Math.max(oldOrder,newOrder)},(_,index)=>({index,kind:index<persistent?'persistent':index<oldOrder?'broken':'formed'}))};
}

export function formalChargeVisualTransition(graphDiff,atomId,{oldVisualCharge=0,newVisualCharge=0,oldSuppressed=false,newSuppressed=false}={}){
  const change=(graphDiff?.formalChargeChanges??[]).find(row=>row.atom===atomId);
  return{
    oldCharge:oldSuppressed?0:change&&change.from===oldVisualCharge?change.from:oldVisualCharge,
    newCharge:newSuppressed?0:change?.to??newVisualCharge,
  };
}

export function resolveStaticFormalCharge(inferredCharge,explicitCharge=null,suppressed=false){
  if(suppressed)return 0;
  return explicitCharge??inferredCharge??0;
}

export function staticBondLaneOffsets(order){
  if(!Number.isInteger(order)||order<1||order>3)throw new Error('Static bond order must be between one and three.');
  return order===1?[0]:order===2?[-.09,.09]:[-.16,0,.16];
}

export function transportBondLaneSide(side,previousAxis,nextAxis){
  const unit=vector=>{const length=norm(vector);return length>1e-9?scale(vector,1/length):null;},from=unit(previousAxis),to=unit(nextAxis),oldSide=unit(side);
  if(!from||!to||!oldSide)return oldSide??[0,0,1];
  let quaternion;
  const cosine=Math.max(-1,Math.min(1,dot(from,to)));
  if(cosine<-.999999)quaternion=[0,...oldSide];
  else{const axis=cross(from,to),raw=[1+cosine,...axis],length=norm(raw);quaternion=length>1e-12?scale(raw,1/length):[1,0,0,0];}
  let transported=rotateByQuaternion(oldSide,quaternion);transported=sub(transported,scale(to,dot(transported,to)));
  if(norm(transported)<1e-8){transported=cross(to,Math.abs(to[1])<.8?[0,1,0]:[1,0,0]);}
  if(dot(transported,oldSide)<0)transported=scale(transported,-1);
  return unit(transported)??oldSide;
}

export function bondLaneSegments(kind,progress){
  const t=Math.max(0,Math.min(1,progress));
  if(kind==='persistent')return[{from:0,to:1,opacity:1}];
  if(kind==='broken'){
    const halfGap=.25*smoothPresentationProgress(t);
    return[{from:0,to:.5-halfGap,opacity:1-t},{from:.5+halfGap,to:1,opacity:1-t}].filter(segment=>segment.to-segment.from>1e-4);
  }
  if(kind==='formed'){
    const extent=.5*smoothPresentationProgress(t);
    return[{from:0,to:extent,opacity:1},{from:1-extent,to:1,opacity:1}].filter(segment=>segment.to-segment.from>1e-4);
  }
  throw new Error(`Unknown bond lane transition: ${kind}`);
}

function jacobiLargestEigenvector(input){
  const matrix=input.map(row=>[...row]),vectors=Array.from({length:4},(_,row)=>Array.from({length:4},(_,column)=>row===column?1:0));
  for(let iteration=0;iteration<64;iteration++){
    let p=0,q=1,largest=0;
    for(let row=0;row<4;row++)for(let column=row+1;column<4;column++)if(Math.abs(matrix[row][column])>largest){largest=Math.abs(matrix[row][column]);p=row;q=column;}
    if(largest<1e-13)break;
    const angle=.5*Math.atan2(2*matrix[p][q],matrix[q][q]-matrix[p][p]),c=Math.cos(angle),s=Math.sin(angle);
    const app=c*c*matrix[p][p]-2*s*c*matrix[p][q]+s*s*matrix[q][q],aqq=s*s*matrix[p][p]+2*s*c*matrix[p][q]+c*c*matrix[q][q];
    for(let k=0;k<4;k++)if(k!==p&&k!==q){const akp=matrix[k][p],akq=matrix[k][q];matrix[k][p]=matrix[p][k]=c*akp-s*akq;matrix[k][q]=matrix[q][k]=s*akp+c*akq;}
    matrix[p][p]=app;matrix[q][q]=aqq;matrix[p][q]=matrix[q][p]=0;
    for(let k=0;k<4;k++){const vkp=vectors[k][p],vkq=vectors[k][q];vectors[k][p]=c*vkp-s*vkq;vectors[k][q]=s*vkp+c*vkq;}
  }
  let column=0;for(let index=1;index<4;index++)if(matrix[index][index]>matrix[column][column])column=index;
  const result=Array.from({length:4},(_,row)=>vectors[row][column]),length=Math.hypot(...result);
  return length>1e-14?result.map(value=>value/length):[1,0,0,0];
}

function rotateByQuaternion(point,q){const [w,x,y,z]=q,vector=[x,y,z],twice=cross(vector,point).map(value=>2*value);return add(point,add(twice.map(value=>value*w),cross(vector,twice)));}

/** Proper rotation + translation fit. Reflection and scaling are never considered. */
export function fitRigidPose(moving,fixed,elements=[]){
  if(!Array.isArray(moving)||moving.length!==fixed?.length||!moving.length||moving.some(point=>!finitePoint(point))||fixed.some(point=>!finitePoint(point)))return{ok:false,reason:'invalid-points'};
  const heavy=moving.map((_,index)=>index).filter(index=>elements[index]!=='H'),indices=heavy.length?heavy:moving.map((_,index)=>index),
    center=rows=>indices.reduce((sum,index)=>add(sum,rows[index]),[0,0,0]).map(value=>value/indices.length),movingCenter=center(moving),fixedCenter=center(fixed),covariance=Array.from({length:3},()=>[0,0,0]);
  for(const index of indices){const a=sub(moving[index],movingCenter),b=sub(fixed[index],fixedCenter);for(let row=0;row<3;row++)for(let column=0;column<3;column++)covariance[row][column]+=a[row]*b[column];}
  const [[sxx,sxy,sxz],[syx,syy,syz],[szx,szy,szz]]=covariance,trace=sxx+syy+szz;
  const q=jacobiLargestEigenvector([
    [trace,syz-szy,szx-sxz,sxy-syx],
    [syz-szy,sxx-syy-szz,sxy+syx,szx+sxz],
    [szx-sxz,sxy+syx,-sxx+syy-szz,syz+szy],
    [sxy-syx,szx+sxz,syz+szy,-sxx-syy+szz],
  ]),quaternion=[q[0],q[1],q[2],q[3]],translation=sub(fixedCenter,rotateByQuaternion(movingCenter,quaternion)),points=moving.map(point=>add(rotateByQuaternion(point,quaternion),translation));
  if(points.some(point=>!finitePoint(point)))return{ok:false,reason:'non-finite-fit'};
  const rms=Math.sqrt(indices.reduce((sum,index)=>sum+dot(sub(points[index],fixed[index]),sub(points[index],fixed[index])),0)/indices.length);
  return{ok:true,quaternion,translation,points,rms,anchors:indices};
}

export function resolveProductTargetGeometry({seededPoints,seedConverged,canonicalPoints,sourcePoints,elements=[]}){
  const valid=(points,expected)=>Array.isArray(points)&&points.length===expected&&points.every(finitePoint),count=sourcePoints?.length??0;
  if(!valid(sourcePoints,count))return{ok:false,reason:'invalid-source-points',geometry:null,points:[]};
  if(seedConverged&&valid(seededPoints,count))return{ok:true,geometry:'source-seeded',points:seededPoints.map(point=>[...point])};
  if(valid(canonicalPoints,count)){
    const fit=fitRigidPose(canonicalPoints,sourcePoints,elements);
    if(fit.ok)return{ok:true,geometry:'canonical-rigid-fallback',points:fit.points};
  }
  return{ok:true,geometry:'source-continuity-fallback',points:sourcePoints.map(point=>[...point])};
}

/** Map Core's immutable sourceAtom -> productAtom records onto frozen source positions. */
export function mapProductAtomOrigins(execution,sourcePositions,sourceElements=null){
  if(!execution?.atomOrigins?.length||execution.atomOrigins.length!==execution.products?.length)return{ok:false,reason:'origin-product-count-mismatch'};
  const allSources=execution.atomOrigins.flatMap(product=>product.origins??[]).map(origin=>origin.sourceAtom);
  if(new Set(allSources).size!==allSources.length)return{ok:false,reason:'source-atom-reused'};
  const products=[];
  for(let productIndex=0;productIndex<execution.products.length;productIndex++){
    const record=execution.products[productIndex],origins=execution.atomOrigins[productIndex].origins??[],byIndex=new Map();
    for(const origin of origins){const index=Number(origin.productAtom),point=sourcePositions.get(origin.sourceAtom),productAtom=record.atoms[index],element=typeof productAtom==='string'?productAtom:productAtom?.element;if(!Number.isInteger(index)||index<0||index>=record.atoms.length||byIndex.has(index)||!point||!finitePoint(point))return{ok:false,reason:'invalid-atom-origin'};if(sourceElements&&sourceElements.get(origin.sourceAtom)!==element)return{ok:false,reason:'element-continuity-mismatch'};byIndex.set(index,{sourceAtom:origin.sourceAtom,position:[...point]});}
    if(byIndex.size!==record.atoms.length||Array.from({length:record.atoms.length},(_,index)=>index).some(index=>!byIndex.has(index)))return{ok:false,reason:'incomplete-atom-origin'};
    products.push({productIndex,record,origins:Array.from({length:record.atoms.length},(_,index)=>byIndex.get(index))});
  }
  if(allSources.length!==sourcePositions.size)return{ok:false,reason:'source-atom-count-mismatch'};
  return{ok:true,products};
}

export function fitRigidBodyVelocity(atomPositions,atomVelocities,masses){
  if(!Array.isArray(atomPositions)||!atomPositions.length||atomPositions.length!==atomVelocities?.length||atomPositions.length!==masses?.length||atomPositions.some(point=>!finitePoint(point))||atomVelocities.some(point=>!finitePoint(point))||masses.some(mass=>!(mass>0&&Number.isFinite(mass))))return{linear:[0,0,0],angular:[0,0,0],finite:false};
  const total=masses.reduce((sum,mass)=>sum+mass,0),linear=atomVelocities.reduce((sum,velocity,index)=>add(sum,scale(velocity,masses[index])),[0,0,0]).map(value=>value/total),positions=atomPositions.map(point=>sub(point,atomPositions.reduce((sum,item,index)=>add(sum,scale(item,masses[index])),[0,0,0]).map(value=>value/total))),inertia=Array.from({length:3},()=>[0,0,0]),angularMomentum=[0,0,0];
  positions.forEach((r,index)=>{const mass=masses[index],r2=dot(r,r),relative=sub(atomVelocities[index],linear),moment=cross(r,relative);for(let axis=0;axis<3;axis++){angularMomentum[axis]+=mass*moment[axis];for(let column=0;column<3;column++)inertia[axis][column]+=mass*((axis===column?r2:0)-r[axis]*r[column]);}});
  const matrix=inertia.map((row,index)=>[...row,angularMomentum[index]]);
  for(let pivot=0;pivot<3;pivot++){
    let best=pivot;for(let row=pivot+1;row<3;row++)if(Math.abs(matrix[row][pivot])>Math.abs(matrix[best][pivot]))best=row;
    if(Math.abs(matrix[best][pivot])<1e-10)return{linear,angular:[0,0,0],finite:linear.every(Number.isFinite)};
    [matrix[pivot],matrix[best]]=[matrix[best],matrix[pivot]];const divisor=matrix[pivot][pivot];for(let column=pivot;column<4;column++)matrix[pivot][column]/=divisor;
    for(let row=0;row<3;row++)if(row!==pivot){const factor=matrix[row][pivot];for(let column=pivot;column<4;column++)matrix[row][column]-=factor*matrix[pivot][column];}
  }
  const angular=matrix.map(row=>row[3]);return{linear,angular,finite:[...linear,...angular].every(Number.isFinite)};
}
