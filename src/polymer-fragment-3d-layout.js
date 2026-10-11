const COVALENT_RADIUS={H:.31,C:.76,N:.71,O:.66,F:.57,Si:1.11,P:1.07,S:1.05,Cl:1.02,Br:1.20,I:1.39};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const vec=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const mul=(a,s)=>vec(a.x*s,a.y*s,a.z*s);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const length=a=>Math.hypot(a.x,a.y,a.z);
const unit=a=>{const n=length(a);return n>1e-9?mul(a,1/n):vec(1,0,0);};
const pointOf=value=>Array.isArray(value)?vec(Number(value[0]),Number(value[1]),Number(value[2]??0)):vec(Number(value?.x??0),Number(value?.y??0),Number(value?.z??0));
const originKey=origin=>`${origin?.instanceId??''}:${origin?.sourceAtomIndex??''}`;
const bondKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const elementOf=atom=>typeof atom==='string'?atom:atom?.element??'C';
const bondOf=bond=>Array.isArray(bond)?{a:Number(bond[0]),b:Number(bond[1]),order:Number(bond[2]??1)}:{a:Number(bond.a),b:Number(bond.b),order:Number(bond.order??1)};
const hash32=value=>{let h=2166136261;for(const char of String(value)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const covalentRadius=element=>COVALENT_RADIUS[element]??.82;
const orderScale=order=>order>=2.7?.78:order>=1.8?.88:order>=1.35?.94:1;
const targetBondLength=(left,right,order,scale)=>(covalentRadius(left)+covalentRadius(right))*scale*orderScale(order);

function angleFor(center,neighbors){
  const multiple=neighbors.some(item=>item.order>=1.35);
  if(multiple)return 120*Math.PI/180;
  if(center.element==='C')return neighbors.length>=4||neighbors.length===3&&center.formalCharge===0?109.47*Math.PI/180:120*Math.PI/180;
  if(center.element==='N')return neighbors.length>=4?109.47*Math.PI/180:107*Math.PI/180;
  if(center.element==='O')return 104.5*Math.PI/180;
  return neighbors.length>=4?109.47*Math.PI/180:120*Math.PI/180;
}

function deterministicPerpendicular(axis,key){
  const direction=unit(axis),axes=[vec(1,0,0),vec(0,1,0),vec(0,0,1)].sort((a,b)=>Math.abs(dot(a,direction))-Math.abs(dot(b,direction)));
  let tangent=unit(cross(direction,axes[0]));if(length(tangent)<.1)tangent=unit(cross(direction,axes[1]));
  const bitangent=unit(cross(direction,tangent)),phase=(hash32(key)%628319)/100000,angle=phase;
  return add(mul(tangent,Math.cos(angle)),mul(bitangent,Math.sin(angle)));
}

function rotationBetween(from,to){
  const a=unit(from),b=unit(to),d=clamp(dot(a,b),-1,1);
  if(d>1-1e-10)return[0,0,0,1];
  if(d<-1+1e-10){const axis=deterministicPerpendicular(a,'antiparallel');return[axis.x,axis.y,axis.z,0];}
  const axis=cross(a,b),s=Math.sqrt((1+d)*2),inverse=1/s;
  return[axis.x*inverse,axis.y*inverse,axis.z*inverse,s*.5];
}

function rotate(point,q){
  const v=vec(q[0],q[1],q[2]),t=mul(cross(v,point),2);
  return add(point,add(mul(t,q[3]),cross(v,t)));
}

function buildUnitTransforms(graph,atoms,bonds,source,scale){
  const unitOrder=[];for(const origin of graph.atomOrigins)if(!unitOrder.includes(origin.instanceId))unitOrder.push(origin.instanceId);
  const unitOf=graph.atomOrigins.map(origin=>origin.instanceId),unitAtoms=new Map(unitOrder.map(id=>[id,[]]));
  for(let index=0;index<unitOf.length;index++)unitAtoms.get(unitOf[index])?.push(index);
  const intraAdj=atoms.map(()=>[]),allAdj=atoms.map(()=>[]),unitEdges=[];
  for(const bond of bonds){allAdj[bond.a].push({index:bond.b,order:bond.order});allAdj[bond.b].push({index:bond.a,order:bond.order});const a=unitOf[bond.a],b=unitOf[bond.b];if(a===b){intraAdj[bond.a].push({index:bond.b,order:bond.order});intraAdj[bond.b].push({index:bond.a,order:bond.order});}else unitEdges.push({aUnit:a,bUnit:b,a:bond.a,b:bond.b,order:bond.order});}
  for(const row of intraAdj)row.sort((a,b)=>a.index-b.index);
  const byUnit=new Map(unitOrder.map(id=>[id,[]]));
  for(const edge of unitEdges){byUnit.get(edge.aUnit)?.push(edge);byUnit.get(edge.bUnit)?.push(edge);}
  const placed=new Set(),coordinates=source.map(()=>vec()),unitDistance=new Map();
  if(!unitOrder.length)return{coordinates,unitCount:0,unplacedUnits:[]};
  const root=unitOrder[0],rootAtoms=unitAtoms.get(root),center=rootAtoms.reduce((sum,index)=>add(sum,source[index]),vec());
  const rootCenter=mul(center,1/Math.max(1,rootAtoms.length));
  for(const index of rootAtoms)coordinates[index]=sub(source[index],rootCenter);
  placed.add(root);unitDistance.set(root,0);const queue=[root];
  while(queue.length){
    const parent=queue.shift(),edges=(byUnit.get(parent)??[]).slice().sort((left,right)=>`${left.aUnit}:${left.a}:${left.bUnit}:${left.b}`.localeCompare(`${right.aUnit}:${right.a}:${right.bUnit}:${right.b}`));
    for(const edge of edges){const child=edge.aUnit===parent?edge.bUnit:edge.aUnit;if(placed.has(child))continue;
      const parentIndex=edge.aUnit===parent?edge.a:edge.b,childIndex=edge.aUnit===parent?edge.b:edge.a;
      const parentNeighbors=intraAdj[parentIndex].map(row=>row.index),parentRef=parentNeighbors[0];
      const parentAt=coordinates[parentIndex],parentAxis=parentRef===undefined?deterministicPerpendicular(vec(0,0,1),`${parent}:${parentIndex}`):unit(sub(coordinates[parentRef],parentAt));
      const parentAngle=angleFor(atoms[parentIndex],allAdj[parentIndex]);
      const azimuth=deterministicPerpendicular(parentAxis,`${atoms[parentIndex].element}:${parent}:${child}:${edge.order}`);
      const linkDirection=unit(add(mul(parentAxis,Math.cos(parentAngle)),mul(azimuth,Math.sin(parentAngle))));
      const childAtoms=unitAtoms.get(child),childCenter=mul(childAtoms.reduce((sum,index)=>add(sum,source[index]),vec()),1/Math.max(1,childAtoms.length));
      const childLocal=source.map((point,index)=>childAtoms.includes(index)?sub(point,childCenter):null);
      const childRef=intraAdj[childIndex].map(row=>row.index)[0];
      const childLocalAxis=childRef===undefined?deterministicPerpendicular(vec(0,0,1),`${child}:${childIndex}`):unit(sub(childLocal[childRef],childLocal[childIndex]));
      const childAngle=angleFor(atoms[childIndex],allAdj[childIndex]);
      const childAzimuth=deterministicPerpendicular(linkDirection,`${child}:${childIndex}:${parentIndex}:torsion`);
      const targetChildAxis=unit(add(mul(mul(linkDirection,-1),Math.cos(childAngle)),mul(childAzimuth,Math.sin(childAngle))));
      const quaternion=rotationBetween(childLocalAxis,targetChildAxis),targetLength=targetBondLength(atoms[parentIndex].element,atoms[childIndex].element,edge.order,scale);
      const childWorldAt=add(parentAt,mul(linkDirection,targetLength));
      const rotatedAt=rotate(childLocal[childIndex],quaternion),translation=sub(childWorldAt,rotatedAt);
      for(const index of childAtoms)coordinates[index]=add(rotate(childLocal[index],quaternion),translation);
      placed.add(child);unitDistance.set(child,(unitDistance.get(parent)??0)+1);queue.push(child);
    }
  }
  const unplacedUnits=unitOrder.filter(id=>!placed.has(id));
  for(const id of unplacedUnits){const indices=unitAtoms.get(id),center=mul(indices.reduce((sum,index)=>add(sum,source[index]),vec()),1/Math.max(1,indices.length)),offset=vec((unitOrder.indexOf(id)+1)*2.8,0,0);for(const index of indices)coordinates[index]=add(sub(source[index],center),offset);}
  return{coordinates,unitCount:unitOrder.length,unplacedUnits,unitEdges};
}

function relaxGeometry(atoms,bonds,unitOf,coordinates,source,sourceInitial,sourceRecordsByInstanceId,scale,maxIterations){
  const n=atoms.length,adjacency=atoms.map(()=>[]),bondPairs=new Set(),constraints=[];
  for(const bond of bonds){adjacency[bond.a].push({index:bond.b,order:bond.order});adjacency[bond.b].push({index:bond.a,order:bond.order});bondPairs.add(bondKey(bond.a,bond.b));
    const preferred=unitOf[bond.a]===unitOf[bond.b]?length(sub(source[bond.b],source[bond.a])):targetBondLength(atoms[bond.a].element,atoms[bond.b].element,bond.order,scale);
    constraints.push({a:bond.a,b:bond.b,target:Math.max(.25,preferred),strength:unitOf[bond.a]===unitOf[bond.b]?.30:.95,kind:'bond'});
  }
  for(let center=0;center<n;center++){
    const neighbors=adjacency[center];if(neighbors.length<2)continue;
    const angle=angleFor(atoms[center],neighbors);
    for(let i=0;i<neighbors.length;i++)for(let j=i+1;j<neighbors.length;j++){
      const left=neighbors[i],right=neighbors[j],a=left.index,b=right.index;
      const leftLength=unitOf[center]===unitOf[a]?length(sub(source[center],source[a])):targetBondLength(atoms[center].element,atoms[a].element,left.order,scale);
      const rightLength=unitOf[center]===unitOf[b]?length(sub(source[center],source[b])):targetBondLength(atoms[center].element,atoms[b].element,right.order,scale);
      constraints.push({a,b,target:Math.max(.2,Math.sqrt(Math.max(.04,leftLength*leftLength+rightLength*rightLength-2*leftLength*rightLength*Math.cos(angle)))),strength:.105,kind:'angle'});
    }
  }
  const protectedAtoms=new Set(),atomIndexByOrigin=new Map(unitOf.map((instanceId,index)=>[`${instanceId}:${atoms[index].origin.sourceAtomIndex}`,index]));
  const aromaticRings=[];
  for(let index=0;index<atoms.length;index++){
    const origin=atoms[index].origin,record=sourceRecordsByInstanceId[origin.instanceId];
    for(const cycle of record?.aromaticCycles??[]){
      const ids=Array.isArray(cycle)?cycle:(cycle?.atoms??[]);
      if(ids.includes(origin.sourceAtomIndex))protectedAtoms.add(index);
    }
  }
  for(const[instanceId,record]of Object.entries(sourceRecordsByInstanceId))for(const cycle of record.aromaticCycles??[]){
    const sourceIds=Array.isArray(cycle)?cycle:(cycle?.atoms??[]),indices=sourceIds.map(sourceAtomIndex=>atomIndexByOrigin.get(`${instanceId}:${sourceAtomIndex}`)).filter(Number.isInteger);
    if(indices.length<3)continue;
    const origin=sourceInitial[indices[0]];let normal=null;
    for(let a=1;a<indices.length-1&&!normal;a++)for(let b=a+1;b<indices.length&&!normal;b++){
      const candidate=cross(sub(sourceInitial[indices[a]],origin),sub(sourceInitial[indices[b]],origin));if(length(candidate)>1e-8)normal=unit(candidate);
    }
    if(normal)aromaticRings.push({indices,origin,normal});
  }
  const graphDistanceTwo=new Set(bondPairs);
  for(let center=0;center<n;center++)for(const first of adjacency[center])for(const second of adjacency[first.index])if(second.index!==center)graphDistanceTwo.add(bondKey(center,second.index));
  const maxPairs=n*(n-1)/2,nonbonded=[];
  if(maxPairs<=50000)for(let a=0;a<n;a++)for(let b=a+1;b<n;b++)if(!graphDistanceTwo.has(bondKey(a,b)))nonbonded.push({a,b,target:(covalentRadius(atoms[a].element)+covalentRadius(atoms[b].element))*scale*.72});
  const iterations=Math.max(1,Math.min(160,Math.floor(maxIterations))),step=.12;
  for(let iteration=0;iteration<iterations;iteration++){
    const forces=atoms.map(()=>vec());
    for(const constraint of constraints){const delta=sub(coordinates[constraint.b],coordinates[constraint.a]),distance=Math.max(1e-5,length(delta)),force=mul(delta,(distance-constraint.target)*constraint.strength/distance);forces[constraint.a]=add(forces[constraint.a],force);forces[constraint.b]=sub(forces[constraint.b],force);}
    for(const pair of nonbonded){const delta=sub(coordinates[pair.b],coordinates[pair.a]),distance=Math.max(1e-5,length(delta));if(distance>=pair.target)continue;const force=mul(delta,(distance-pair.target)*.28/distance);forces[pair.a]=add(forces[pair.a],force);forces[pair.b]=sub(forces[pair.b],force);}
    for(const ring of aromaticRings)for(const index of ring.indices){const deviation=dot(sub(coordinates[index],ring.origin),ring.normal);forces[index]=sub(forces[index],mul(ring.normal,deviation*.8));}
    for(let index=0;index<n;index++){
      const tether=protectedAtoms.has(index)?.16:.045,restoring=mul(sub(sourceInitial[index],coordinates[index]),tether);
      forces[index]=add(forces[index],restoring);
      const magnitude=length(forces[index]);if(magnitude>.65)forces[index]=mul(forces[index],.65/magnitude);
      coordinates[index]=add(coordinates[index],mul(forces[index],step));
    }
  }
  return{adjacency,iterations,protectedAtomCount:protectedAtoms.size,protectedRingCount:aromaticRings.length,nonbonded,sourceInitial:sourceInitial.map(point=>({...point}))};
}

export function createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId={},maxIterations=96}={}){
  const graph=sample?.fragment??sample;
  if(!graph||!Array.isArray(graph.atoms)||!Array.isArray(graph.bonds)||!Array.isArray(graph.atomOrigins)||graph.atoms.length!==graph.atomOrigins.length)throw new TypeError('A finite polymer fragment with atom origins is required.');
  const atoms=graph.atoms.map((atom,index)=>({id:index,element:elementOf(atom),formalCharge:Number(atom.formalCharge??0),origin:graph.atomOrigins[index]}));
  const bonds=graph.bonds.map(bondOf);
  if(graph.atomOrigins.some(origin=>!origin||typeof origin.instanceId!=='string'||!Number.isInteger(origin.sourceAtomIndex)))throw new TypeError('Every atom needs a stable source origin.');
  const seenOrigins=new Set();for(const origin of graph.atomOrigins){const key=originKey(origin);if(seenOrigins.has(key))throw new TypeError(`Duplicate polymer atom origin: ${key}`);seenOrigins.add(key);}
  for(const bond of bonds)if(!Number.isInteger(bond.a)||!Number.isInteger(bond.b)||bond.a<0||bond.b<0||bond.a>=atoms.length||bond.b>=atoms.length||bond.a===bond.b||!Number.isFinite(bond.order)||bond.order<=0)throw new TypeError('The polymer fragment contains an invalid bond.');
  const source=[],sourceCoordinateFallbacks=[];
  for(let index=0;index<atoms.length;index++){
    const origin=atoms[index].origin,record=sourceRecordsByInstanceId[origin.instanceId],point=record?.atoms?.[origin.sourceAtomIndex]?.point;
    if(point){const parsed=pointOf(point);if([parsed.x,parsed.y,parsed.z].every(Number.isFinite)){source.push(parsed);continue;}}
    const phase=hash32(originKey(origin))/4294967296*Math.PI*2,band=1+origin.sourceAtomIndex*.17;
    source.push(vec(Math.cos(phase)*band,Math.sin(phase)*band,Math.sin(phase*1.7)*band*.62));sourceCoordinateFallbacks.push(index);
  }
  const unitOf=graph.atomOrigins.map(origin=>origin.instanceId);
  const ratios=bonds.filter(bond=>unitOf[bond.a]===unitOf[bond.b]).map(bond=>length(sub(source[bond.b],source[bond.a]))/(covalentRadius(atoms[bond.a].element)+covalentRadius(atoms[bond.b].element))).filter(value=>Number.isFinite(value)&&value>.1&&value<2);
  ratios.sort((a,b)=>a-b);const geometryScale=ratios.length?clamp(ratios[Math.floor(ratios.length/2)],.55,1.15):.78;
  const placed=buildUnitTransforms(graph,atoms,bonds,source,geometryScale),coordinates=placed.coordinates.map(point=>({...point})),sourceInitial=coordinates.map(point=>({...point}));
  const relaxed=relaxGeometry(atoms,bonds,unitOf,coordinates,source,sourceInitial,sourceRecordsByInstanceId,geometryScale,maxIterations);
  const center=coordinates.reduce((sum,point)=>add(sum,point),vec()),mean=mul(center,1/Math.max(1,coordinates.length));
  const centered=coordinates.map(point=>sub(point,mean));
  const atomPlan=atoms.map((atom,index)=>({...atom,x:centered[index].x,y:centered[index].y,z:centered[index].z,initial:sourceInitial[index]}));
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const atom of atomPlan){bounds.minX=Math.min(bounds.minX,atom.x);bounds.maxX=Math.max(bounds.maxX,atom.x);bounds.minY=Math.min(bounds.minY,atom.y);bounds.maxY=Math.max(bounds.maxY,atom.y);bounds.minZ=Math.min(bounds.minZ,atom.z);bounds.maxZ=Math.max(bounds.maxZ,atom.z);}
  bounds.width=bounds.maxX-bounds.minX;bounds.height=bounds.maxY-bounds.minY;bounds.depth=bounds.maxZ-bounds.minZ;
  const bondErrors=bonds.map(bond=>Math.abs(length(sub(centered[bond.a],centered[bond.b]))-(unitOf[bond.a]===unitOf[bond.b]?length(sub(source[bond.a],source[bond.b])):targetBondLength(atoms[bond.a].element,atoms[bond.b].element,bond.order,geometryScale))));
  let severeOverlapCount=0,minimumNonbondedDistance=Infinity;
  for(const pair of relaxed.nonbonded){const distance=length(sub(centered[pair.a],centered[pair.b]));minimumNonbondedDistance=Math.min(minimumNonbondedDistance,distance);if(distance<pair.target*.56)severeOverlapCount++;}
  const diagnostics={accepted:true,fallback:false,reason:null,iterations:relaxed.iterations,unitCount:placed.unitCount,unplacedUnits:placed.unplacedUnits,sourceCoordinateFallbacks,geometryScale,maxBondError:bondErrors.length?Math.max(...bondErrors):0,meanBondError:bondErrors.length?bondErrors.reduce((sum,value)=>sum+value,0)/bondErrors.length:0,severeOverlapCount,minimumNonbondedDistance:Number.isFinite(minimumNonbondedDistance)?minimumNonbondedDistance:null,protectedRingAtomCount:relaxed.protectedAtomCount,protectedRingCount:relaxed.protectedRingCount,depthSpan:bounds.depth,finite:atomPlan.every(atom=>[atom.x,atom.y,atom.z].every(Number.isFinite)),atomCount:atoms.length,bondCount:bonds.length};
  diagnostics.accepted=diagnostics.finite&&placed.unplacedUnits.length===0&&sourceCoordinateFallbacks.length===0&&diagnostics.maxBondError<=.62&&severeOverlapCount===0;
  if(!diagnostics.accepted)diagnostics.reason=!diagnostics.finite?'non-finite-coordinate':placed.unplacedUnits.length?'disconnected-unit-graph':sourceCoordinateFallbacks.length?'missing-source-coordinates':diagnostics.maxBondError>.62?'bond-geometry-did-not-converge':'severe-steric-overlap';
  const continuations=(sample?.representation?.continuations??[]).map((item,index)=>{
    const atomIndex=Number.isInteger(item.atomRef)?item.atomRef:Number.parseInt(String(item.atomRef).split(':').at(-1),10),atom=atomPlan[atomIndex],direction=index%2===0?1:-1;
    return{...item,atomIndex,x:(atom?.x??0)+direction*.7,y:atom?.y??0,z:atom?.z??0};
  });
  return{polymerId:sample?.polymerId??'polymer',routeId:sample?.routeId??'unknown',atoms:atomPlan,bonds,atomOrigins:graph.atomOrigins,continuations,qualifiers:[...(sample?.representation?.qualifiers??[])],bounds,unitCount:placed.unitCount,diagnostics};
}
