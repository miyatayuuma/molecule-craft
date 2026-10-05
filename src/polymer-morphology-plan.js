import {polymerMorphologyProfile} from './polymer-morphology-authority.js';

export const POLYMER_MORPHOLOGY_BUDGET=Object.freeze({
  maxMembers:48,
  maxJunctions:28,
  maxControlPointsPerMember:13,
  samplesPerControlSegment:5,
  maxPlanPoints:3600,
  radialSegments:6,
  maxVertices:21600,
  maxIndices:129600,
  maxRenderObjects:2,
  maxGeometries:2,
  maxMaterials:2,
});

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const add=(a,b)=>a.map((value,index)=>value+b[index]);
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const mul=(a,scale)=>a.map(value=>value*scale);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=point=>Math.hypot(...point);
const normalize=point=>{const n=length(point)||1;return point.map(value=>value/n);};
const lerp=(a,b,t)=>a.map((value,index)=>value+(b[index]-value)*t);
const distance=(a,b)=>length(sub(a,b));
const COIL_SHAPES=Object.freeze({
  soft:Object.freeze({count:27,turns:[.4,.9],radii:[1.3,1.9]}),
  mixed:Object.freeze({count:27,turns:[.46,1.02],radii:[1.38,1.94]}),
  polar:Object.freeze({count:27,turns:[.42,.94],radii:[1.32,1.92]}),
  rubber:Object.freeze({count:27,turns:[.34,.83],radii:[1.22,1.75]}),
  longRubber:Object.freeze({count:27,turns:[.28,.7],radii:[1.32,1.86]}),
  polarRubber:Object.freeze({count:27,turns:[.36,.8],radii:[1.24,1.72]}),
  bulky:Object.freeze({count:25,turns:[.58,1.02],radii:[1.5,2.08]}),
  bulkyRubber:Object.freeze({count:25,turns:[.34,.78],radii:[1.48,2.08]}),
  fluorinated:Object.freeze({count:24,turns:[.46,.94],radii:[1.34,1.86]}),
});

function hashSeed(polymerId,seed){
  let hash=2166136261;
  for(const char of `${polymerId}\u001f${seed}`){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return hash>>>0||0x9e3779b9;
}
function randomSource(seed){
  let state=seed>>>0;
  return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};
}
function unitVector(random){
  for(let attempt=0;attempt<8;attempt++){
    const p=[random()*2-1,random()*2-1,random()*2-1],n=dot(p,p);
    if(n>.05&&n<1)return mul(p,1/Math.sqrt(n));
  }
  return normalize([random()-.5,random()-.5,random()-.5]);
}
function frame(axis){
  const helper=Math.abs(axis[2])<.83?[0,0,1]:[0,1,0],side=normalize(cross(axis,helper));
  return{side,up:normalize(cross(axis,side))};
}
function pointInBox(random,extent){return extent.map(value=>(random()*2-1)*value);}
function clampPoint(point,extent){return point.map((value,index)=>clamp(value,-extent[index],extent[index]));}
function catmullRom(controls,subdivisions=POLYMER_MORPHOLOGY_BUDGET.samplesPerControlSegment){
  if(controls.length<2)throw new Error('Morphology members require at least two control points.');
  const points=[];
  for(let segment=0;segment<controls.length-1;segment++){
    const p0=controls[Math.max(0,segment-1)],p1=controls[segment],p2=controls[segment+1],p3=controls[Math.min(controls.length-1,segment+2)];
    for(let step=0;step<subdivisions;step++){
      const t=step/subdivisions,t2=t*t,t3=t2*t;
      points.push(p1.map((value,index)=>.5*((2*value)+(-p0[index]+p2[index])*t+(2*p0[index]-5*value+4*p2[index]-p3[index])*t2+(-p0[index]+3*value-3*p2[index]+p3[index])*t3)));
    }
  }
  points.push([...controls.at(-1)]);
  return points;
}
function distributedCenters(random,count,extent,minSeparation=1.15){
  const centers=[];
  for(let index=0;index<count;index++){
    let candidate=null;
    for(let attempt=0;attempt<64;attempt++){
      const point=pointInBox(random,extent);
      if(centers.every(center=>distance(center,point)>=minSeparation)){candidate=point;break;}
    }
    centers.push(candidate??pointInBox(random,extent));
  }
  return centers;
}
function coilControls(random,center,{minimumTurns,maximumTurns,minimumRadius,maximumRadius,bulky=false}={}){
  const axis=unitVector(random),axes=frame(axis),turns=minimumTurns+random()*(maximumTurns-minimumTurns),phase=random()*Math.PI*2;
  const radius=minimumRadius+random()*(maximumRadius-minimumRadius),minorRadius=radius*(bulky?.72+random()*.24:.68+random()*.3),depthDrift=(random()-.5)*.65,phaseB=random()*Math.PI*2,controls=[];
  for(let index=0;index<8;index++){
    const t=index/7,angle=phase+turns*Math.PI*2*t,amplitude=radius*(.87+.09*Math.sin(angle*1.65+phaseB)+.045*Math.sin(angle*2.7+phase)),sideOffset=Math.cos(angle)*amplitude,upOffset=Math.sin(angle)*minorRadius*(.88+.1*Math.cos(angle*1.2+phaseB));
    const drift=depthDrift*(t-.5)+.18*Math.sin(angle*.48+phaseB);
    controls.push(add(add(add(center,mul(axes.side,sideOffset)),mul(axes.up,upOffset)),mul(axis,drift)));
  }
  return controls;
}
function makeDomains(random,profile){
  const domains=[];
  const count=profile.visualCue==='substituted-lamellae'?3:4;
  for(let index=0;index<count;index++){
    let center=pointInBox(random,[3.05,2.45,1.82]);
    for(let attempt=0;attempt<10&&domains.some(domain=>distance(domain.center,center)<1.65);attempt++)center=pointInBox(random,[3.05,2.45,1.82]);
    const axis=unitVector(random),axes=frame(axis);
    const compact=profile.visualCue.includes('compact')||profile.visualCue.includes('ester'),fluorinated=profile.visualCue.includes('fluorinated');
    domains.push({id:`ordered-domain-${index+1}`,center,axis,side:axes.side,up:axes.up,halfLength:(compact?.66:.72)+random()*(compact?.42:.58),halfWidth:(fluorinated?.3:.42)+random()*(fluorinated?.22:.37),depth:.3+random()*.34});
  }
  return domains;
}
function domainRun(domain,random){
  const axis=normalize(add(add(domain.axis,mul(domain.side,(random()-.5)*.66)),mul(domain.up,(random()-.5)*.58))),local=frame(axis),offsetA=(random()*2-1)*domain.halfWidth,offsetB=(random()*2-1)*domain.depth;
  const bendA=(random()-.5)*.68,bendB=(random()-.5)*.52,phase=random()*Math.PI*2,lengthScale=.58+random()*.76;
  const ts=[-1,-.28,.37,1].map(value=>value*(domain.halfLength*lengthScale));
  return ts.map((t,index)=>{
    const edge=index===0||index===ts.length-1,spread=edge?.45:1;
    const lateral=offsetA+bendA*Math.sin(index*1.13+phase)+(edge?(random()-.5)*.48:0),depth=offsetB+bendB*Math.cos(index*.91+phase)+(edge?(random()-.5)*.34:0);
    return add(add(add(domain.center,mul(axis,t)),mul(local.side,lateral*spread)),mul(local.up,depth*spread));
  });
}
function orderedPlan(random,profile){
  const extent=[4.5,3.5,2.75],domains=makeDomains(random,profile),strands=[],localPerDomain=4;
  for(const domain of domains)for(let row=0;row<localPerDomain;row++){
    const run=domainRun(domain,random),axis=domain.axis,begin=add(run[0],mul(axis,-(.35+random()*.65))),end=add(run.at(-1),mul(axis,.35+random()*.65));
    const points=catmullRom([begin,...run,end]);strands.push(makeStrand(strands.length,points,profile,random));
  }
  const tieCount=profile.visualCue==='compact-ester-domains'?6:8;
  for(let index=0;index<tieCount;index++){
    const first=index%domains.length,second=(first+1+Math.floor(random()*(domains.length-1)))%domains.length,fromRun=domainRun(domains[first],random),toRun=domainRun(domains[second],random);
    const controls=[add(fromRun[0],mul(domains[first].axis,-.55)),...fromRun,pointInBox(random,[2.8,2.1,1.75]),...toRun,add(toRun.at(-1),mul(domains[second].axis,.55))];
    strands.push(makeStrand(strands.length,catmullRom(controls),profile,random));
  }
  const surrounding=Array.from({length:12},()=>coilControls(random,pointInBox(random,[1.8,1.3,1.05]),{minimumTurns:.16,maximumTurns:.48,minimumRadius:1.05,maximumRadius:1.65}));
  for(const controls of surrounding)strands.push(makeStrand(strands.length,catmullRom(controls),profile,random));
  return{strands,domains,junctions:[],network:null,extent};
}
function amorphousPlan(random,profile){
  const polystyrene=profile.visualCue==='bulky-amorphous',count=polystyrene?21:28,centers=distributedCenters(random,count,polystyrene?[2.5,1.95,1.35]:[2.05,1.52,1.02],polystyrene?2.05:1.5),strands=[];
  for(let index=0;index<count;index++){
    const bulky=polystyrene,controls=coilControls(random,centers[index],{minimumTurns:bulky?.38:.38,maximumTurns:bulky?.9:.76,minimumRadius:bulky?1.7:1.15,maximumRadius:bulky?2.35:1.62,bulky});
    strands.push(makeStrand(index,catmullRom(controls),profile,random));
  }
  return{strands,domains:[],junctions:[],network:null,extent:polystyrene?[5.4,4.3,3.5]:[4.45,3.55,3.05]};
}
function flexiblePlan(random,profile){
  const cue=profile.visualCue,style=cue==='bulky-open-coils'?'bulky':cue==='bulky-rubbery-coils'?'bulkyRubber':cue==='rubbery-long-coils'?'longRubber':cue==='rubbery-open-coils'?'rubber':cue==='polar-rubbery-coils'?'polarRubber':cue.includes('fluorinated')?'fluorinated':cue.includes('mixed')?'mixed':cue.includes('polar')?'polar':'soft',shape=COIL_SHAPES[style],bulky=style==='bulky'||style==='bulkyRubber',count=shape.count,centers=distributedCenters(random,count,bulky?[1.85,1.38,.9]:[2.02,1.48,1],bulky?1.35:1.42),strands=[];
  for(let index=0;index<count;index++){
    const controls=coilControls(random,centers[index],{minimumTurns:shape.turns[0],maximumTurns:shape.turns[1],minimumRadius:shape.radii[0],maximumRadius:shape.radii[1],bulky});
    strands.push(makeStrand(index,catmullRom(controls),profile,random));
  }
  return{strands,domains:[],junctions:[],network:null,extent:[4.35,3.45,3.0]};
}
function rigidPlan(random,profile){
  const pan=profile.visualCue==='polar-persistent',amide=profile.visualCue==='amide-cohesion',extent=[5.35,4.35,3.5],clusterCount=pan?5:4,count=pan?30:28,axes=Array.from({length:clusterCount},()=>unitVector(random)),clusters=distributedCenters(random,clusterCount,[2.45,1.9,1.4],2.1),strands=[];
  for(let index=0;index<count;index++){
    const sampledAxis=unitVector(random),cluster=index%clusterCount,clusterAxis=axes[cluster],axis=dot(sampledAxis,clusterAxis)<0?mul(sampledAxis,-1):sampledAxis,association=pan?.48:amide?.39:.3,aligned=normalize(lerp(axis,clusterAxis,association)),{side,up}=frame(aligned),center=add(clusters[cluster],pointInBox(random,[.52,.44,.34]));
    const half=(pan?1.7:amide?1.85:2.02)+random()*(pan?.88:amide?.8:.86),lateral=(random()-.5)*.72,depth=(random()-.5)*.72,curvature=(random()-.5)*(pan?.85:amide?.66:.52);
    const controls=[
      add(add(center,mul(aligned,-half)),add(mul(side,lateral+(random()-.5)*.35),mul(up,depth+(random()-.5)*.3))),
      add(add(center,mul(aligned,-half*.48)),add(mul(side,lateral+curvature),mul(up,depth+(random()-.5)*.28))),
      add(add(center,mul(aligned,-half*.06)),add(mul(side,lateral+curvature*.5+(random()-.5)*.22),mul(up,depth+(random()-.5)*.36))),
      add(add(center,mul(aligned,half*.46)),add(mul(side,lateral-curvature),mul(up,depth+(random()-.5)*.28))),
      add(add(center,mul(aligned,half)),add(mul(side,lateral+(random()-.5)*.35),mul(up,depth+(random()-.5)*.3))),
    ].map(point=>clampPoint(point,extent));
    strands.push(makeStrand(index,catmullRom(controls),profile,random));
  }
  return{strands,domains:[],junctions:[],network:null,extent};
}
function edgeKey(a,b){return a<b?`${a}:${b}`:`${b}:${a}`;}
function networkPlan(random,profile){
  const extent=[3.6,2.72,2.08],nodeCount=28,junctions=Array.from({length:nodeCount},(_,index)=>({id:`junction-${index+1}`,position:pointInBox(random,[3.35,2.48,1.86])})),edges=[];
  const candidates=[];
  for(let a=0;a<nodeCount;a++)for(let b=a+1;b<nodeCount;b++)candidates.push({a,b,distance:distance(junctions[a].position,junctions[b].position)});
  candidates.sort((a,b)=>a.distance-b.distance||a.a-b.a||a.b-b.b);
  const parent=Array.from({length:nodeCount},(_,index)=>index),find=value=>parent[value]===value?value:(parent[value]=find(parent[value]));
  for(const candidate of candidates){const left=find(candidate.a),right=find(candidate.b);if(left===right)continue;parent[right]=left;edges.push({from:candidate.a,to:candidate.b,tree:true});if(edges.length===nodeCount-1)break;}
  const occupied=new Set(edges.map(edge=>edgeKey(edge.from,edge.to))),extras=[];
  for(const candidate of candidates)if(!occupied.has(edgeKey(candidate.a,candidate.b))&&candidate.distance>1.35&&candidate.distance<4.85)extras.push(candidate);
  const shuffled=extras.map(item=>({item,key:random()})).sort((a,b)=>a.key-b.key);
  for(const {item} of shuffled.slice(0,9)){occupied.add(edgeKey(item.a,item.b));edges.push({from:item.a,to:item.b,tree:false});}
  const strands=edges.map((edge,index)=>{
    const from=junctions[edge.from].position,to=junctions[edge.to].position,chord=sub(to,from),axis=normalize(chord),axes=frame(axis),bend=add(mul(axes.side,(random()-.5)*.95),mul(axes.up,(random()-.5)*.95)),mid=add(lerp(from,to,.5),bend);
    const controls=[from,lerp(from,mid,.65),mid,lerp(mid,to,.42),to],points=catmullRom(controls);
    const strand=makeStrand(index,points,profile,random,.78+random()*.34);
    return{...strand,from:edge.from,to:edge.to,tree:edge.tree};
  });
  return{strands,domains:[],junctions,network:{nodes:junctions.map(node=>[...node.position]),edges:edges.map(edge=>({from:edge.from,to:edge.to,tree:edge.tree}))},extent};
}
function makeStrand(index,points,profile,random,widthScale=1){
  const startTangent=normalize(sub(points[1],points[0])),endTangent=normalize(sub(points.at(-1),points.at(-2)));
  let width=.039;
  if(profile.archetype==='AMORPHOUS_ENTANGLEMENT')width=profile.visualCue==='bulky-amorphous'?.050:.038;
  if(profile.archetype==='FLEXIBLE_COIL_ENSEMBLE')width=profile.visualCue.includes('bulky')?.048:.036;
  if(profile.archetype==='RIGID_COHESIVE_ENSEMBLE')width=profile.visualCue==='polar-persistent'?.039:.037;
  if(profile.archetype==='SEMICRYSTALLINE_DOMAINS')width=.036;
  if(profile.archetype==='CONNECTED_NETWORK')width=.045;
  const radius=width*widthScale*(.88+random()*.24);
  return{id:`member-${String(index+1).padStart(2,'0')}`,kind:'strand',points,start:points[0],end:points.at(-1),startTangent,endTangent,radius};
}
function longestTreeHero(network,strands){
  const adjacency=network.nodes.map(()=>[]),edgeByKey=new Map();
  for(const strand of strands){edgeByKey.set(edgeKey(strand.from,strand.to),strand);if(!strand.tree)continue;adjacency[strand.from].push({to:strand.to,strand});adjacency[strand.to].push({to:strand.from,strand});}
  let best=null;
  for(let start=0;start<adjacency.length;start++){
    const queue=[start],previous=new Map([[start,null]]);
    for(let cursor=0;cursor<queue.length;cursor++)for(const edge of adjacency[queue[cursor]])if(!previous.has(edge.to)){previous.set(edge.to,{from:queue[cursor],strand:edge.strand});queue.push(edge.to);}
    for(const end of queue){
      const path=[];for(let current=end;current!==start;){const row=previous.get(current);path.push({from:row.from,to:current,strand:row.strand});current=row.from;}path.reverse();
      const points=[];for(const row of path){const forward=row.strand.from===row.from;const part=forward?row.strand.points:row.strand.points.slice().reverse();points.push(...(points.length?part.slice(1):part));}
      const pathLength=points.slice(1).reduce((sum,point,index)=>sum+distance(point,points[index]),0);
      if(!best||pathLength>best.pathLength)best={points,memberIds:path.map(row=>row.strand.id),pathLength};
    }
  }
  return best;
}
function boundsFor(strands){
  const values=strands.flatMap(strand=>strand.points),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const point of values)for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis]);}
  const center=lerp(min,max,.5),radius=Math.max(...values.map(point=>distance(point,center)));
  return{min,max,center,radius};
}

/** A DOM- and Three.js-independent, stable mesoscale morphology plan. */
export function createPolymerMorphologyPlan({polymerId,seed='static-preview',profile=polymerMorphologyProfile(polymerId)}={}){
  if(!profile||profile.polymerId!==polymerId)throw new Error(`No morphology profile for ${polymerId??'unknown polymer'}.`);
  const random=randomSource(hashSeed(polymerId,String(seed)));let shape;
  switch(profile.archetype){
    case'SEMICRYSTALLINE_DOMAINS':shape=orderedPlan(random,profile);break;
    case'AMORPHOUS_ENTANGLEMENT':shape=amorphousPlan(random,profile);break;
    case'FLEXIBLE_COIL_ENSEMBLE':shape=flexiblePlan(random,profile);break;
    case'RIGID_COHESIVE_ENSEMBLE':shape=rigidPlan(random,profile);break;
    case'CONNECTED_NETWORK':shape=networkPlan(random,profile);break;
    default:throw new Error(`Unsupported morphology archetype: ${profile.archetype}`);
  }
  const strands=shape.strands,totalPoints=strands.reduce((sum,strand)=>sum+strand.points.length,0);
  if(strands.length>POLYMER_MORPHOLOGY_BUDGET.maxMembers||shape.junctions.length>POLYMER_MORPHOLOGY_BUDGET.maxJunctions||totalPoints>POLYMER_MORPHOLOGY_BUDGET.maxPlanPoints||strands.some(strand=>strand.points.length<2||strand.points.length>POLYMER_MORPHOLOGY_BUDGET.maxControlPointsPerMember*POLYMER_MORPHOLOGY_BUDGET.samplesPerControlSegment))throw new Error(`Morphology plan exceeds its deterministic budget: ${polymerId}`);
  const bounds=boundsFor(strands),networkHero=shape.network?longestTreeHero(shape.network,strands):null,hero=networkHero?{id:'hero-network-path',kind:'network-path',points:networkHero.points,memberIds:networkHero.memberIds}:strands.reduce((best,strand)=>!best||strand.points.length>best.points.length?{id:strand.id,kind:'strand',points:strand.points,memberIds:[strand.id]}:best,null);
  const heroStrand={...hero,start:hero.points[0],end:hero.points.at(-1),startTangent:normalize(sub(hero.points[1],hero.points[0])),endTangent:normalize(sub(hero.points.at(-1),hero.points.at(-2)))};
  const plan={schemaVersion:1,polymerId,seed:String(seed),archetype:profile.archetype,visualCue:profile.visualCue,strands,domains:shape.domains,junctions:shape.junctions,network:shape.network,heroStrand,bounds,stats:{memberCount:strands.length,junctionCount:shape.junctions.length,pointCount:totalPoints,heroMemberCount:heroStrand.memberIds.length,vertexCount:totalPoints*POLYMER_MORPHOLOGY_BUDGET.radialSegments,indexCount:Math.max(0,totalPoints-strands.length)*POLYMER_MORPHOLOGY_BUDGET.radialSegments*6}};
  return plan;
}
