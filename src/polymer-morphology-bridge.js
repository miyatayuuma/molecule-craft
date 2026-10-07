import {polymerMorphologyProfile} from './polymer-morphology-authority.js';
import {createPolymerMorphologyPlan} from './polymer-morphology-plan.js';

const finitePoint=point=>Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const mul=(a,scale)=>a.map(value=>value*scale);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const length=point=>Math.hypot(...point);
const normalize=point=>{const magnitude=length(point);if(magnitude<1e-12)throw new Error('A non-zero direction is required.');return mul(point,1/magnitude);};
const distance=(a,b)=>length(sub(a,b));
const lerp=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t);
const mean=points=>points.reduce((sum,point)=>add(sum,point),[0,0,0]).map(value=>value/points.length);

/** Resample a 3D polyline at equal arc-length intervals without mutating it. */
export function resamplePolylineByArcLength(points,count){
  if(!Array.isArray(points)||points.length<2||points.some(point=>!finitePoint(point)))throw new TypeError('At least two finite 3D points are required.');
  if(!Number.isInteger(count)||count<2)throw new RangeError('Arc-length resampling requires at least two output points.');
  const lengths=new Float64Array(points.length),cumulative=new Float64Array(points.length);
  for(let index=1;index<points.length;index++){lengths[index]=distance(points[index-1],points[index]);cumulative[index]=cumulative[index-1]+lengths[index];}
  const totalLength=cumulative.at(-1);if(totalLength<1e-9)throw new Error('Cannot resample a zero-length polyline.');
  const result=[];let segment=1;
  for(let output=0;output<count;output++){
    const target=totalLength*output/(count-1);
    while(segment<cumulative.length-1&&cumulative[segment]<target)segment++;
    const span=lengths[segment],mix=span>1e-12?(target-cumulative[segment-1])/span:0;
    result.push(lerp(points[segment-1],points[segment],Math.max(0,Math.min(1,mix))));
  }
  return result;
}

function rotate(point,quaternion){
  const[x,y,z,w]=quaternion,[px,py,pz]=point,tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);
  return[px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*tz),pz+w*tz+(x*ty-y*tx)];
}

function largestEigenvector(matrix){
  const a=matrix.map(row=>row.slice()),vectors=Array.from({length:4},(_,row)=>Array.from({length:4},(_,column)=>row===column?1:0));
  for(let iteration=0;iteration<64;iteration++){
    let p=0,q=1,largest=Math.abs(a[p][q]);
    for(let row=0;row<4;row++)for(let column=row+1;column<4;column++)if(Math.abs(a[row][column])>largest){p=row;q=column;largest=Math.abs(a[row][column]);}
    if(largest<1e-13)break;
    const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),cos=Math.cos(angle),sin=Math.sin(angle);
    for(let index=0;index<4;index++)if(index!==p&&index!==q){const ap=a[index][p],aq=a[index][q];a[index][p]=a[p][index]=cos*ap-sin*aq;a[index][q]=a[q][index]=sin*ap+cos*aq;}
    const app=a[p][p],aqq=a[q][q],apq=a[p][q];
    a[p][p]=cos*cos*app-2*sin*cos*apq+sin*sin*aqq;
    a[q][q]=sin*sin*app+2*sin*cos*apq+cos*cos*aqq;
    a[p][q]=a[q][p]=0;
    for(let row=0;row<4;row++){const vp=vectors[row][p],vq=vectors[row][q];vectors[row][p]=cos*vp-sin*vq;vectors[row][q]=sin*vp+cos*vq;}
  }
  let best=0;for(let index=1;index<4;index++)if(a[index][index]>a[best][best])best=index;
  const q=[0,1,2,3].map(row=>vectors[row][best]),magnitude=Math.hypot(...q)||1,normalized=q.map(value=>value/magnitude);
  if(normalized[0]<0)return normalized.map(value=>-value);
  return normalized;
}

function fitSimilarity(source,target){
  const sourceCenter=mean(source),targetCenter=mean(target),sourceCentered=source.map(point=>sub(point,sourceCenter)),targetCentered=target.map(point=>sub(point,targetCenter));
  const s=Array.from({length:3},()=>[0,0,0]);
  for(let index=0;index<source.length;index++)for(let row=0;row<3;row++)for(let column=0;column<3;column++)s[row][column]+=targetCentered[index][row]*sourceCentered[index][column];
  const[sxx,sxy,sxz]=s[0],[syx,syy,syz]=s[1],[szx,szy,szz]=s[2],trace=sxx+syy+szz;
  const horn=[
    [trace,syz-szy,szx-sxz,sxy-syx],
    [syz-szy,sxx-syy-szz,sxy+syx,szx+sxz],
    [szx-sxz,sxy+syx,-sxx+syy-szz,syz+szy],
    [sxy-syx,szx+sxz,syz+szy,-sxx-syy+szz],
  ];
  const eigenQuaternion=largestEigenvector(horn),quaternion=[eigenQuaternion[1],eigenQuaternion[2],eigenQuaternion[3],eigenQuaternion[0]],rotated=targetCentered.map(point=>rotate(point,quaternion)),denominator=targetCentered.reduce((sum,point)=>sum+dot(point,point),0);
  let numerator=0;for(let index=0;index<source.length;index++)numerator+=dot(sourceCentered[index],rotated[index]);
  const scale=denominator>1e-12?Math.max(1e-9,numerator/denominator):1,translation=sub(sourceCenter,mul(rotate(targetCenter,quaternion),scale));
  const transformPoint=point=>add(mul(rotate(point,quaternion),scale),translation),registered=target.map(transformPoint),errors=registered.map((point,index)=>distance(point,source[index]));
  const rms=Math.sqrt(errors.reduce((sum,error)=>sum+error*error,0)/errors.length),startError=errors[0],endError=errors.at(-1);
  const sourceStartTangent=normalize(sub(source[1],source[0])),sourceEndTangent=normalize(sub(source.at(-1),source.at(-2))),registeredStartTangent=normalize(sub(registered[1],registered[0])),registeredEndTangent=normalize(sub(registered.at(-1),registered.at(-2)));
  const tangentPenalty=(2-dot(sourceStartTangent,registeredStartTangent)-dot(sourceEndTangent,registeredEndTangent))*.5*scale;
  return{transform:{translation,rotation:quaternion,scale},registered,rms,startError,endError,maxError:Math.max(...errors),orientationTangentPenalty:tangentPenalty,score:rms+.12*(startError+endError)*.5+.025*tangentPenalty};
}

/**
 * Deterministically register the completed static PE model to Task 1's final
 * centerline. Only a proper rotation, translation and uniform scale are used.
 */
export function createPolymerMorphologyBridgePlan({polymerId='polyethylene',sampleId='sample',sourceCenterline,resampleCount=72,morphologyPlan=null}={}){
  if(polymerId!=='polyethylene')throw new Error('Production chain-to-morphology handoff is limited to polyethylene.');
  if(!Array.isArray(sourceCenterline)||sourceCenterline.length<2||sourceCenterline.some(point=>!finitePoint(point)))throw new TypeError('A finite Task 1 centerline is required.');
  const profile=polymerMorphologyProfile(polymerId);if(!profile)throw new Error(`No morphology profile for ${polymerId}.`);
  const seed=String(sampleId??'sample'),plan=morphologyPlan??createPolymerMorphologyPlan({polymerId,seed,profile});
  if(plan.polymerId!==polymerId||!plan.heroStrand?.points||plan.heroStrand.points.length<2)throw new TypeError('A matching static morphology plan with a continuous hero strand is required.');
  const sourcePoints=sourceCenterline.length===resampleCount?sourceCenterline.map(point=>[...point]):resamplePolylineByArcLength(sourceCenterline,resampleCount),forward=resamplePolylineByArcLength(plan.heroStrand.points,resampleCount),reverse=resamplePolylineByArcLength([...plan.heroStrand.points].reverse(),resampleCount);
  const candidates=[{orientation:'forward',points:forward,...fitSimilarity(sourcePoints,forward)},{orientation:'reverse',points:reverse,...fitSimilarity(sourcePoints,reverse)}].sort((left,right)=>left.score-right.score||left.orientation.localeCompare(right.orientation));
  const selected=candidates[0],registeredHeroPoints=selected.registered;
  return{schemaVersion:1,polymerId,sampleId:seed,seed,orientation:selected.orientation,resampleCount,sourcePoints,targetPoints:registeredHeroPoints,transform:selected.transform,morphologyPlan:plan,registration:{rmsError:selected.rms,startError:selected.startError,endError:selected.endError,maxError:selected.maxError,forwardScore:candidates.find(row=>row.orientation==='forward').score,reverseScore:candidates.find(row=>row.orientation==='reverse').score}};
}

/** Fill a reusable output array with an eased, equal-sample bridge centerline. */
export function interpolatePolymerBridgeCenterline(plan,progress,result=plan.sourcePoints.map(()=>[0,0,0])){
  if(!plan?.sourcePoints?.length||plan.sourcePoints.length!==plan.targetPoints?.length)throw new TypeError('A resolved bridge plan is required.');
  if(!Array.isArray(result)||result.length!==plan.sourcePoints.length)throw new RangeError('Bridge output must match the resolved sample count.');
  const t=Math.max(0,Math.min(1,progress)),eased=t*t*(3-2*t);
  for(let index=0;index<result.length;index++)for(let axis=0;axis<3;axis++)result[index][axis]=plan.sourcePoints[index][axis]+(plan.targetPoints[index][axis]-plan.sourcePoints[index][axis])*eased;
  return result;
}
