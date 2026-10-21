// Read-only chemical environments for the actual finite Sample; never edits it.
// Numerical targets and acceptance scope: docs/validation/polymer-local-fragment-task4-geometry.md.
export const POLYMER_GEOMETRY_VERSION=2;
export const POLYMER_GEOMETRY_SCALE=.78; // Existing structural-geometry world units per angstrom.
const key=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const elements=new Set(['H','C','N','O','F','Cl']);
const limits={H:1,C:4,N:3,O:2,F:1,Cl:1};
const radius={H:1.2,C:1.7,N:1.55,O:1.52,F:1.47,Cl:1.75};
export function polymerGeometryModel(graph,sourceRecords={}){
  if(!graph||!Array.isArray(graph.atoms)||!graph.atoms.length||graph.atoms.length>256||!Array.isArray(graph.bonds)||!Array.isArray(graph.atomOrigins)||graph.atomOrigins.length!==graph.atoms.length)throw new TypeError('A bounded finite polymer fragment with atom origins is required.');
  const atoms=graph.atoms.map((a,i)=>({id:typeof a==='string'?i:a?.id??i,element:typeof a==='string'?a:a?.element,formalCharge:typeof a==='string'?0:a?.formalCharge??0,origin:graph.atomOrigins[i]}));
  const origins=new Map(),adj=atoms.map(()=>[]),edges=new Set();
  atoms.forEach((a,i)=>{const o=a.origin;if(!elements.has(a.element)||a.formalCharge!==0)throw new TypeError('Unsupported polymer element or charge.');if(!o||typeof o.instanceId!=='string'||!o.instanceId||!Number.isInteger(o.sourceAtomIndex)||o.sourceAtomIndex<0)throw new TypeError('Every atom needs a stable source origin.');const k=JSON.stringify([o.instanceId,o.sourceAtomIndex]);if(origins.has(k))throw new TypeError('Duplicate polymer atom origin.');origins.set(k,i);});
  const bonds=graph.bonds.map((b,index)=>{const a=Array.isArray(b)?b[0]:b?.a,c=Array.isArray(b)?b[1]:b?.b,order=Array.isArray(b)?b[2]:b?.order;
    if(!Number.isInteger(a)||!Number.isInteger(c)||a<0||c<0||a>=atoms.length||c>=atoms.length||a===c||![1,1.5,2,3].includes(order)||edges.has(key(a,c)))throw new TypeError('The polymer fragment contains an invalid bond.');
    edges.add(key(a,c));adj[a].push({index:c,order,bondIndex:index});adj[c].push({index:a,order,bondIndex:index});return{a,b:c,order};});
  for(let i=0;i<atoms.length;i++)if(adj[i].reduce((s,n)=>s+n.order,0)>limits[atoms[i].element]+1e-9)throw new TypeError('Invalid polymer valence.');
  const visited=new Set([0]),queue=[0];for(let q=0;q<queue.length;q++)for(const n of adj[queue[q]])if(!visited.has(n.index)){visited.add(n.index);queue.push(n.index);}if(visited.size!==atoms.length)throw new TypeError('Disconnected polymer graph.');
  const el=i=>atoms[i].element,carbonylC=new Set(bonds.flatMap(b=>b.order===2&&[el(b.a),el(b.b)].sort().join()==='C,O'?[el(b.a)==='C'?b.a:b.b]:[]));
  const rings=[];
  for(const [instanceId,record]of Object.entries(sourceRecords))for(const cycle of record?.aromaticCycles??[]){
    const ids=Array.isArray(cycle)?cycle:cycle?.atoms;if(!Array.isArray(ids))continue;
    const indices=ids.map(i=>origins.get(JSON.stringify([instanceId,i])));
    // A source cycle removed by a reaction is not a final ring.
    if(indices.length===6&&new Set(indices).size===6&&indices.every(Number.isInteger)&&indices.every((i,j)=>el(i)==='C'&&edges.has(key(i,indices[(j+1)%6]))))rings.push(indices);
  }
  const aromaticAtoms=new Set(rings.flat()),ringEdges=new Set(rings.flatMap(r=>r.map((a,i)=>key(a,r[(i+1)%r.length]))));
  const amideN=new Set(atoms.flatMap((a,i)=>el(i)==='N'&&adj[i].some(n=>carbonylC.has(n.index))?[i]:[]));
  const environments=atoms.map((a,i)=>{
    if(adj[i].some(n=>n.order===3))return 'sp-linear';
    if(aromaticAtoms.has(i))return 'aromatic';
    if(carbonylC.has(i))return 'carbonyl';
    if(amideN.has(i))return 'amide-N';
    if(adj[i].some(n=>n.order>=1.5))return 'sp2';
    if(el(i)==='O')return adj[i].some(n=>carbonylC.has(n.index))?'acyl-O':adj[i].every(n=>el(n.index)==='C')?'ether-O':'hydroxyl-O';
    if(el(i)==='N')return 'amine-N';
    return 'sp3';
  });
  const centerAngle=i=>({ 'sp-linear':180,aromatic:120,carbonyl:120,'amide-N':120,sp2:120,'acyl-O':114.8,'ether-O':111.2,'hydroxyl-O':108.5,'amine-N':107,sp3:109.47122063449069})[environments[i]];
  const bondTargets=bonds.map(b=>{
    const pair=[el(b.a),el(b.b)].sort().join('-');let a;
    if(ringEdges.has(key(b.a,b.b)))a=1.40;
    else if(b.order===3&&pair==='C-N')a=1.157;
    else if(b.order===2&&pair==='C-O')a=1.21;
    else if(b.order===2&&pair==='C-C')a=1.34;
    else if(b.order!==1)a=NaN;
    else if(pair==='C-C')a=environments[b.a]==='sp-linear'||environments[b.b]==='sp-linear'?1.458:1.52;
    else if(pair==='C-O')a=carbonylC.has(b.a)||carbonylC.has(b.b)?1.334:1.43;
    else if(pair==='C-N')a=(carbonylC.has(b.a)&&amideN.has(b.b))||(carbonylC.has(b.b)&&amideN.has(b.a))?1.35:1.47;
    else a=({'C-H':1.09,'H-N':1.01,'H-O':.97,'C-F':1.35,'C-Cl':1.77})[pair];
    return{...b,target:a*POLYMER_GEOMETRY_SCALE,environment:ringEdges.has(key(b.a,b.b))?'aromatic':`${pair}:${b.order}:${[environments[b.a],environments[b.b]].sort().join('/')}`};
  });
  if(bondTargets.some(b=>!Number.isFinite(b.target)))throw new TypeError('Unsupported polymer bond environment.');
  const angles=[];
  for(let center=0;center<atoms.length;center++)for(let j=0;j<adj[center].length;j++)for(let k=j+1;k<adj[center].length;k++){
    const a=adj[center][j].index,b=adj[center][k].index;
    let target=centerAngle(center),environment=environments[center];
    if(edges.has(key(a,b))){
      const ac=bondTargets[adj[center][j].bondIndex].target,bc=bondTargets[adj[center][k].bondIndex].target,ab=bondTargets[adj[a].find(n=>n.index===b).bondIndex].target;
      target=Math.acos(Math.max(-1,Math.min(1,(ac*ac+bc*bc-ab*ab)/(2*ac*bc))))*180/Math.PI;environment='three-member-ring';
    }
    angles.push({a,center,b,target,environment});
  }
  const nonbonded=[];
  for(let a=0;a<atoms.length;a++)for(let b=a+1;b<atoms.length;b++)if(!edges.has(key(a,b))&&!adj[a].some(n=>edges.has(key(n.index,b))))nonbonded.push({a,b,target:(radius[el(a)]+radius[el(b)])*POLYMER_GEOMETRY_SCALE*.70,severe:(radius[el(a)]+radius[el(b)])*POLYMER_GEOMETRY_SCALE*.55});
  const planar=[];
  for(let i=0;i<atoms.length;i++)if(['aromatic','carbonyl','amide-N','sp2'].includes(environments[i])&&adj[i].length===3)planar.push({indices:[i,...adj[i].map(n=>n.index)],kind:environments[i]});
  for(const b of bonds)if(b.order===2&&!ringEdges.has(key(b.a,b.b))&&el(b.a)==='C'&&el(b.b)==='C'){
    const left=adj[b.a].filter(n=>n.index!==b.b),right=adj[b.b].filter(n=>n.index!==b.a);for(const a of left)for(const c of right)planar.push({indices:[a.index,b.a,b.b,c.index],kind:'diene'});
  }
  for(const b of bonds)if(b.order===1&&((carbonylC.has(b.a)&&['N','O'].includes(el(b.b)))||(carbonylC.has(b.b)&&['N','O'].includes(el(b.a))))){
    const c=carbonylC.has(b.a)?b.a:b.b,hetero=c===b.a?b.b:b.a,o=adj[c].find(n=>n.order===2&&el(n.index)==='O')?.index;
    for(const n of adj[hetero])if(n.index!==c)planar.push({indices:[o,c,hetero,n.index],kind:el(hetero)==='N'?'amide':'ester'});
  }
  return{atoms,bonds,adj,bondTargets,angles,rings,ringEdges,aromaticAtoms,carbonylC,amideN,environments,centerAngle,nonbonded,planar};
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const angle=(a,c,b)=>{const u=[a.x-c.x,a.y-c.y,a.z-c.z],v=[b.x-c.x,b.y-c.y,b.z-c.z],d=Math.hypot(...u)*Math.hypot(...v);return d>1e-12?Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/d)))*180/Math.PI:NaN;};
export function polymerGeometryDiagnostics(model,points){
  const bonds=model.bondTargets.map(b=>({...b,length:distance(points[b.a],points[b.b]),error:Math.abs(distance(points[b.a],points[b.b])-b.target)}));
  const angles=model.angles.map(a=>({...a,degrees:angle(points[a.a],points[a.center],points[a.b])})).map(a=>({...a,error:Math.abs(a.degrees-a.target)}));
  const planes=[...model.rings.map(indices=>({indices,kind:'aromatic-ring'})),...model.planar].map(p=>{
    const [a,b,c,...rest]=p.indices.map(i=>points[i]),u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[c.x-a.x,c.y-a.y,c.z-a.z],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...n);
    return{...p,deviation:d>1e-8?Math.max(...rest.map(x=>Math.abs(n[0]*(x.x-a.x)+n[1]*(x.y-a.y)+n[2]*(x.z-a.z))/d)):Infinity};
  });
  const nonbonded=model.nonbonded.map(p=>({...p,distance:distance(points[p.a],points[p.b])}));
  const finite=points.every(p=>[p.x,p.y,p.z].every(Number.isFinite));
  const violations={bonds:bonds.filter(b=>b.error>.08),angles:angles.filter(a=>!Number.isFinite(a.error)||a.error>(a.environment==='sp-linear'?3:15)),planes:planes.filter(p=>p.deviation>.08),steric:nonbonded.filter(p=>p.distance<p.severe)};
  return{accepted:finite&&Object.values(violations).every(v=>v.length===0),finite,bonds,angles,planes,violations,maxBondError:Math.max(0,...bonds.map(b=>b.error)),maxAngleError:Math.max(0,...angles.map(a=>a.error)),minimumNonbondedDistance:nonbonded.length?Math.min(...nonbonded.map(p=>p.distance)):null,severeOverlapCount:violations.steric.length};
}

// Targets contain ONLY final graph indices/edges with origin tuples. Source sites
// select the backbone; geometry, longest paths and polymer name do not select it.
export function resolvePolymerFragmentTargets(sample,{sourceRecordsByInstanceId={},route}={}){
  const graph=sample?.fragment??sample,m=polymerGeometryModel(graph,sourceRecordsByInstanceId),{atoms,bonds,adj}=m,el=i=>atoms[i].element;
  const originMap=new Map(atoms.map((a,i)=>[JSON.stringify([a.origin.instanceId,a.origin.sourceAtomIndex]),i]));
  const fromSource=(id,index)=>originMap.get(JSON.stringify([id,index]));
  const bondIndices=predicate=>bonds.flatMap((b,i)=>predicate(b)?[i]:[]);
  const target=(kind,indices,edges=[])=>({kind,atomIndices:[...new Set(indices)].sort((a,b)=>a-b),bondIndices:[...new Set(edges)].sort((a,b)=>a-b),originTuples:[...new Set(indices)].sort((a,b)=>a-b).map(i=>({...graph.atomOrigins[i]}))});
  const motif=(kind,edgeIds)=>target(kind,edgeIds.flatMap(i=>[bonds[i].a,bonds[i].b]),edgeIds);
  const carbonyl=bondIndices(b=>b.order===2&&[el(b.a),el(b.b)].sort().join()==='C,O');
  const acylEdge=(b,element)=>(m.carbonylC.has(b.a)&&el(b.b)===element)||(m.carbonylC.has(b.b)&&el(b.a)===element);
  const rings=m.rings.map((r,i)=>target(`aromatic-${i}`,r,bondIndices(b=>r.includes(b.a)&&r.includes(b.b))));
  const backbone=new Set(),unresolved=[];
  if(!route||sample?.routeId&&route.routeId!==sample.routeId)unresolved.push('missing-or-mismatched-route');
  else for(const id of new Set(atoms.map(a=>a.origin.instanceId))){
    const record=sourceRecordsByInstanceId[id];
    if(!Array.isArray(record?.atoms)||!Array.isArray(record?.bonds)){unresolved.push(`missing-source-topology:${id}`);continue;}
    if(atoms.some(a=>a.origin.instanceId===id&&(!record.atoms[a.origin.sourceAtomIndex]||(typeof record.atoms[a.origin.sourceAtomIndex]==='string'?record.atoms[a.origin.sourceAtomIndex]:record.atoms[a.origin.sourceAtomIndex].element)!==a.element)))unresolved.push(`invalid-source-origin:${id}`);
    const se=i=>typeof record.atoms[i]==='string'?record.atoms[i]:record.atoms[i]?.element,sb=record.bonds.map(b=>Array.isArray(b)?{a:b[0],b:b[1],order:b[2]}:b),sa=record.atoms.map(()=>[]);
    for(const b of sb){if(!sa[b.a]||!sa[b.b]){unresolved.push(`invalid-source-topology:${id}`);continue;}sa[b.a].push({index:b.b,order:b.order});sa[b.b].push({index:b.a,order:b.order});}
    const sourceRings=new Set((record.aromaticCycles??[]).flatMap(c=>Array.isArray(c)?c:c.atoms??[]));
    let sourceSites=[];
    if(route.builder==='chain'){
      sourceSites=route.transformFamilies.includes('epoxide')?record.atoms.flatMap((_,i)=>['C','O'].includes(se(i))?[i]:[]):sb.flatMap(b=>b.order===2&&se(b.a)==='C'&&se(b.b)==='C'&&!sourceRings.has(b.a)&&!sourceRings.has(b.b)?[b.a,b.b]:[]);
    }else if(route.builder==='step-growth'){
      // Existing acid carbonyls, alcohol oxygens and primary amines are the
      // source reaction anchors. Union of all shortest source-heavy paths keeps
      // both equal aromatic paths, and excludes side methyl/carbonyl oxygen.
      const cs=new Set(sb.flatMap(b=>b.order===2&&[se(b.a),se(b.b)].sort().join()==='C,O'?[se(b.a)==='C'?b.a:b.b]:[]));
      const anchors=record.atoms.flatMap((_,i)=>cs.has(i)||se(i)==='N'||se(i)==='O'&&sa[i].some(n=>se(n.index)==='H')&&!sa[i].some(n=>cs.has(n.index))?[i]:[]);
      if(anchors.length<2){unresolved.push(`ambiguous-source-sites:${id}`);continue;}
      for(let a=0;a<anchors.length;a++)for(let b=a+1;b<anchors.length;b++){
        const distances=start=>{const d=new Map([[start,0]]),q=[start];for(let k=0;k<q.length;k++)for(const n of sa[q[k]])if(se(n.index)!=='H'&&!d.has(n.index)){d.set(n.index,d.get(q[k])+1);q.push(n.index);}return d;};
        const da=distances(anchors[a]),db=distances(anchors[b]),total=da.get(anchors[b]);if(total===undefined){unresolved.push(`disconnected-source-sites:${id}`);continue;}
        for(const [i,d]of da)if(d+db.get(i)===total)sourceSites.push(i);
      }
    }else if(route.builder==='network')sourceSites=record.atoms.flatMap((_,i)=>se(i)!=='H'?[i]:[]);
    else unresolved.push('unsupported-route-builder');
    if(!sourceSites.length)unresolved.push(`unresolved-source-sites:${id}`);
    for(const i of sourceSites){const final=fromSource(id,i);if(final!==undefined)backbone.add(final);}
  }
  const backboneEdges=bondIndices(b=>backbone.has(b.a)&&backbone.has(b.b));
  const backboneTarget=target(route?.builder==='network'?'actual-PF-heavy-fragment-not-certified-backbone':'backbone',Array.from(backbone),backboneEdges);
  const sideEdges=bondIndices(b=>el(b.a)!=='H'&&el(b.b)!=='H'&&(backbone.has(b.a)!==backbone.has(b.b)));
  const nit=bondIndices(b=>b.order===3&&[el(b.a),el(b.b)].sort().join()==='C,N');
  const ester=bondIndices(b=>b.order===1&&acylEdge(b,'O')&&[b.a,b.b].some(i=>el(i)==='O'&&adj[i].filter(n=>el(n.index)==='C').length===2));
  const amide=bondIndices(b=>b.order===1&&acylEdge(b,'N'));
  const ether=atoms.flatMap((_,i)=>el(i)==='O'&&adj[i].length===2&&adj[i].every(n=>el(n.index)==='C'&&!m.carbonylC.has(n.index))?[i]:[]);
  const localGroup=(kind,indices)=>indices.map(i=>target(kind,[i,...adj[i].map(n=>n.index)],adj[i].map(n=>n.bondIndex)));
  const methylene=atoms.flatMap((_,i)=>el(i)==='C'&&adj[i].filter(n=>m.aromaticAtoms.has(n.index)).length===2&&adj[i].filter(n=>el(n.index)==='H').length===2?[i]:[]);
  const hydroxymethyl=atoms.flatMap((_,i)=>el(i)==='C'&&adj[i].some(n=>m.aromaticAtoms.has(n.index))&&adj[i].filter(n=>el(n.index)==='H').length===2&&adj[i].some(n=>el(n.index)==='O'&&adj[n.index].some(h=>el(h.index)==='H'))?[i]:[]);
  const methyl=atoms.flatMap((_,i)=>el(i)==='C'&&adj[i].filter(n=>el(n.index)==='H').length===3?[i]:[]);
  const acid=atoms.flatMap((_,i)=>el(i)==='O'&&adj[i].some(n=>el(n.index)==='H')&&adj[i].some(n=>m.carbonylC.has(n.index))?[i]:[]);
  const sources=Array.from(new Set(atoms.map(a=>a.origin.instanceId))).map(id=>target(`source:${id}`,atoms.flatMap((a,i)=>a.origin.instanceId===id?[i]:[])));
  const ends=Array.from(backbone).filter(i=>adj[i].filter(n=>backbone.has(n.index)).length===1);
  return{sampleId:sample?.sampleId??null,routeId:sample?.routeId??null,resolved:unresolved.length===0,unresolved,backbone:backboneTarget,ends:target('actual-ends',ends),sideAttachment:motif('side-attachment',sideEdges),rings,carbonyl:motif('carbonyl',carbonyl),nitrile:motif('nitrile',nit),ester:motif('ester',ester),amide:motif('amide',amide),ether:localGroup('ether',ether),acidOH:localGroup('acid-OH',acid),methyl:localGroup('methyl',methyl),methyleneBridge:localGroup('methylene-bridge',methylene),hydroxymethyl:localGroup('hydroxymethyl',hydroxymethyl),diene:motif('nonaromatic-C=C',bondIndices(b=>b.order===2&&el(b.a)==='C'&&el(b.b)==='C'&&!m.ringEdges.has(key(b.a,b.b)))),sources};
}

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

function angleFor(center){return (center.geometryAngle??109.47122063449069)*Math.PI/180;}

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

// Position-based projection uses actual graph environments, not source-origin residues.
// Fixed 160-iteration ceiling; O(iterations*(N² + degree²)) work, O(N²) storage.
function relaxGeometry(model,coordinates,maxIterations){
  const iterations=Math.max(1,Math.min(160,Math.floor(maxIterations))),p=coordinates;
  const projectDistance=(a,b,target,strength)=>{
    let dx=p[b].x-p[a].x,dy=p[b].y-p[a].y,dz=p[b].z-p[a].z,d=Math.hypot(dx,dy,dz);
    if(d<1e-9){const axis=deterministicPerpendicular(vec(0,0,1),`${a}:${b}`);dx=axis.x;dy=axis.y;dz=axis.z;d=1;}
    const correction=(d-target)/d*.5*strength;
    p[a].x+=dx*correction;p[a].y+=dy*correction;p[a].z+=dz*correction;
    p[b].x-=dx*correction;p[b].y-=dy*correction;p[b].z-=dz*correction;
  };
  const projectAngle=constraint=>{
    const {a,center:c,b,target}=constraint,pa=p[a],pc=p[c],pb=p[b];
    let ux=pa.x-pc.x,uy=pa.y-pc.y,uz=pa.z-pc.z,vx=pb.x-pc.x,vy=pb.y-pc.y,vz=pb.z-pc.z;
    const lu=Math.hypot(ux,uy,uz),lv=Math.hypot(vx,vy,vz);if(lu<1e-8||lv<1e-8)return;
    ux/=lu;uy/=lu;uz/=lu;vx/=lv;vy/=lv;vz/=lv;
    const cosine=clamp(ux*vx+uy*vy+uz*vz,-1,1),theta=Math.acos(cosine),sine=Math.sqrt(Math.max(1e-12,1-cosine*cosine));
    if(target===180){
      const terminal=model.adj[a].length===1?a:model.adj[b].length===1?b:null;
      if(terminal!==null){const other=terminal===a?b:a,axis=unit(sub(p[c],p[other])),bond=model.bondTargets[model.adj[terminal][0].bondIndex];p[terminal]=add(p[c],mul(axis,bond.target));return;}
    }
    if(sine<1e-5){const d=deterministicPerpendicular(vec(ux,uy,uz),`${a}:${c}:${b}`);pa.x+=d.x*.02;pa.y+=d.y*.02;pa.z+=d.z*.02;return;}
    const ax=(ux*cosine-vx)/(lu*sine),ay=(uy*cosine-vy)/(lu*sine),az=(uz*cosine-vz)/(lu*sine),bx=(vx*cosine-ux)/(lv*sine),by=(vy*cosine-uy)/(lv*sine),bz=(vz*cosine-uz)/(lv*sine),cx=-ax-bx,cy=-ay-by,cz=-az-bz;
    const denom=ax*ax+ay*ay+az*az+bx*bx+by*by+bz*bz+cx*cx+cy*cy+cz*cz,lambda=clamp((theta-target*Math.PI/180)/denom*.5,-.15,.15);
    pa.x-=ax*lambda;pa.y-=ay*lambda;pa.z-=az*lambda;pb.x-=bx*lambda;pb.y-=by*lambda;pb.z-=bz*lambda;pc.x-=cx*lambda;pc.y-=cy*lambda;pc.z-=cz*lambda;
  };
  const projectPlane=indices=>{
    const [ia,ib,ic,...rest]=indices;
    for(const id of rest){
      const u=sub(p[ib],p[ia]),v=sub(p[ic],p[ia]),w=sub(p[id],p[ia]),gb=cross(v,w),gc=cross(w,u),gd=cross(u,v),ga=mul(add(add(gb,gc),gd),-1);
      const volume=dot(u,gb),denom=dot(ga,ga)+dot(gb,gb)+dot(gc,gc)+dot(gd,gd);if(denom<1e-12)continue;
      const lambda=volume/denom*.95;
      for(const [index,g]of [[ia,ga],[ib,gb],[ic,gc],[id,gd]])p[index]=sub(p[index],mul(g,lambda));
    }
  };
  let performed=0,qualityTargetReached=false,bestFeasible=null,bestScore=Infinity,bestIteration=null,restoredFeasibleIteration=null;
  for(let i=0;i<iterations;i++){
    performed=i+1;

    const activeNonbonded=[];
    for(const pair of model.nonbonded){const a=p[pair.a],b=p[pair.b],dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;if(dx*dx+dy*dy+dz*dz<pair.target*pair.target*1.44)activeNonbonded.push(pair);}
    for(let sweep=0;sweep<8;sweep++){
    for(const pair of activeNonbonded){const a=p[pair.a],b=p[pair.b],dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z;if(dx*dx+dy*dy+dz*dz<pair.target*pair.target)projectDistance(pair.a,pair.b,pair.target,.4);}
    for(const a of model.angles)projectAngle(a);
    for(const indices of model.rings){
      // Shape matching keeps each real six-member aromatic cycle rigid but free
      // to translate/rotate. No whole-chain plane or stereo assignment.
      const center=mul(indices.reduce((sum,id)=>add(sum,p[id]),vec()),1/6);
      let x=vec(),y=vec();for(let j=0;j<6;j++){const d=sub(p[indices[j]],center);x=add(x,mul(d,Math.cos(j*Math.PI/3)));y=add(y,mul(d,Math.sin(j*Math.PI/3)));}
      x=unit(x);y=unit(sub(y,mul(x,dot(x,y))));
      for(let j=0;j<6;j++)p[indices[j]]=add(center,mul(add(mul(x,Math.cos(j*Math.PI/3)),mul(y,Math.sin(j*Math.PI/3))),1.4*POLYMER_GEOMETRY_SCALE));
    }
    for(const plane of model.planar)projectPlane(plane.indices);
    for(const b of model.bondTargets)projectDistance(b.a,b.b,b.target,.9);
    }
    if(performed%8===0){
      const d=polymerGeometryDiagnostics(model,p);
      // Alternating ring/plane/length projections are not monotone: later
      // sweeps can undo a fully valid pose while pursuing the tighter quality
      // target. Retain a jointly validated iterate, never a partial constraint
      // projection. Successful terminal solves keep their original coordinates.
      if(d.accepted){
        const score=Math.max(d.maxBondError/.02,d.maxAngleError/5,...d.planes.map(plane=>plane.deviation/.035));
        if(score<bestScore){bestScore=score;bestFeasible=p.map(point=>({...point}));bestIteration=performed;}
      }
      if(d.accepted&&d.maxBondError<=.02&&d.maxAngleError<=5&&d.planes.every(p=>p.deviation<=.035)) {qualityTargetReached=true;break;}
    }
  }
  // The terminal nitrile projection is exact and cannot move a chain center.
  for(const a of model.angles)if(a.target===180)projectAngle(a);
  if(bestFeasible&&!polymerGeometryDiagnostics(model,p).accepted){
    for(let i=0;i<p.length;i++)p[i]={...bestFeasible[i]};
    for(const a of model.angles)if(a.target===180)projectAngle(a);
    restoredFeasibleIteration=bestIteration;
  }
  // The caller independently validates the returned pose, including the exact
  // nitrile projection; retaining an iterate never bypasses acceptance/fallback.
  return{iterations:performed,qualityTargetReached,restoredFeasibleIteration};
}

export function createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId={},maxIterations=160}={}){
  if(!Number.isFinite(maxIterations)||maxIterations<1)throw new TypeError('A finite positive iteration budget is required.');
  const graph=sample?.fragment??sample,model=polymerGeometryModel(graph,sourceRecordsByInstanceId),{atoms,bonds}=model;
  for(let i=0;i<atoms.length;i++)atoms[i].geometryAngle=model.centerAngle(i);
  const source=[],sourceCoordinateFallbacks=[];
  for(let index=0;index<atoms.length;index++){
    const origin=atoms[index].origin,record=sourceRecordsByInstanceId[origin.instanceId],sourceAtom=record?.atoms?.[origin.sourceAtomIndex],point=sourceAtom?.point;
    const parsed=point&&(Array.isArray(point)?point.length===3&&point.every(Number.isFinite):[point.x,point.y,point.z].every(Number.isFinite))?pointOf(point):null,sourceElement=typeof sourceAtom==='string'?sourceAtom:sourceAtom?.element;
    if(parsed&&[parsed.x,parsed.y,parsed.z].every(Number.isFinite)&&(!sourceElement||sourceElement===atoms[index].element)){source.push(parsed);continue;}
    source.push(vec());sourceCoordinateFallbacks.push(index);
  }
  const degenerateSourceBonds=bonds.flatMap((b,i)=>atoms[b.a].origin.instanceId===atoms[b.b].origin.instanceId&&length(sub(source[b.a],source[b.b]))<1e-8?[i]:[]);
  const geometryScale=POLYMER_GEOMETRY_SCALE;
  const placed=buildUnitTransforms(graph,atoms,bonds,source,geometryScale),coordinates=placed.coordinates.map(point=>({...point})),sourceInitial=coordinates.map(point=>({...point}));
  // Reattach transferred terminal H to its ACTUAL heavy neighbor. Its origin
  // remains phenol provenance; origin quotient is never a network topology.
  for(let i=0;i<atoms.length;i++)if(atoms[i].element==='H'&&model.adj[i].length===1){const n=model.adj[i][0].index;if(atoms[i].origin.instanceId!==atoms[n].origin.instanceId){
    const other=model.adj[n].find(a=>a.index!==i)?.index,axis=other===undefined?vec(1,0,0):unit(sub(coordinates[other],coordinates[n])),side=deterministicPerpendicular(axis,originKey(atoms[i].origin)),theta=model.centerAngle(n)*Math.PI/180;
    coordinates[i]=add(coordinates[n],mul(add(mul(axis,Math.cos(theta)),mul(side,Math.sin(theta))),model.bondTargets[model.adj[i][0].bondIndex].target));
  }}
  const relaxed=relaxGeometry(model,coordinates,maxIterations),mean=mul(coordinates.reduce((sum,p)=>add(sum,p),vec()),1/coordinates.length),centered=coordinates.map(p=>sub(p,mean));
  const atomPlan=atoms.map(({geometryAngle,...atom},i)=>({...atom,x:centered[i].x,y:centered[i].y,z:centered[i].z,initial:sourceInitial[i]}));
  const bounds={minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity,minZ:Infinity,maxZ:-Infinity};
  for(const a of atomPlan)for(const axis of ['X','Y','Z']){const v=a[axis.toLowerCase()];bounds[`min${axis}`]=Math.min(bounds[`min${axis}`],v);bounds[`max${axis}`]=Math.max(bounds[`max${axis}`],v);}
  bounds.width=bounds.maxX-bounds.minX;bounds.height=bounds.maxY-bounds.minY;bounds.depth=bounds.maxZ-bounds.minZ;
  const chemical=polymerGeometryDiagnostics(model,centered),accepted=chemical.accepted&&!sourceCoordinateFallbacks.length&&!degenerateSourceBonds.length;
  const diagnostics={accepted,fallback:false,reason:accepted?null:sourceCoordinateFallbacks.length?'missing-source-coordinates':degenerateSourceBonds.length?'degenerate-source-geometry':'chemical-geometry-did-not-converge',version:POLYMER_GEOMETRY_VERSION,iterations:relaxed.iterations,restoredFeasibleIteration:relaxed.restoredFeasibleIteration,converged:chemical.accepted,qualityTargetReached:relaxed.qualityTargetReached,unitCount:placed.unitCount,unplacedUnits:placed.unplacedUnits,sourceCoordinateFallbacks,degenerateSourceBonds,geometryScale,maxBondError:chemical.maxBondError,meanBondError:chemical.bonds.reduce((s,b)=>s+b.error,0)/Math.max(1,bonds.length),maxAngleError:chemical.maxAngleError,severeOverlapCount:chemical.severeOverlapCount,minimumNonbondedDistance:chemical.minimumNonbondedDistance,protectedRingAtomCount:model.aromaticAtoms.size,protectedRingCount:model.rings.length,depthSpan:bounds.depth,finite:chemical.finite,atomCount:atoms.length,bondCount:bonds.length,chemical};
  const continuations=(sample?.representation?.continuations??[]).map((item,index)=>{const atomIndex=Number.isInteger(item.atomRef)?item.atomRef:Number.parseInt(String(item.atomRef).split(':').at(-1),10),a=atomPlan[atomIndex];return{...item,atomIndex,x:(a?.x??0)+(index%2===0?.7:-.7),y:a?.y??0,z:a?.z??0};});
  return{polymerId:sample?.polymerId??'polymer',routeId:sample?.routeId??'unknown',atoms:atomPlan,bonds,atomOrigins:graph.atomOrigins,continuations,qualifiers:[...(sample?.representation?.qualifiers??[])],bounds,unitCount:placed.unitCount,diagnostics};
}

// A normal graph's failed solve may use the old finite fallback ONLY if it
// independently passes the same chemical checks. Invalid chemistry throws;
// absent/degenerate source evidence never becomes a certified invented pose.
export function createSafePolymerFragmentPlan(sample,options={},fallbackFactory){
  const plan=createPolymerFragment3DLayout(sample,options);
  if(plan.diagnostics.accepted)return plan;
  if(plan.diagnostics.reason==='chemical-geometry-did-not-converge'&&typeof fallbackFactory==='function'){
    const fallback=fallbackFactory(sample,options),graph=sample.fragment??sample,model=polymerGeometryModel(graph,options.sourceRecordsByInstanceId);
    if(fallback?.atoms?.length===graph.atoms.length&&JSON.stringify(fallback.bonds)===JSON.stringify(plan.bonds)){
      const chemical=polymerGeometryDiagnostics(model,fallback.atoms);
      if(chemical.accepted){
        // The fallback supplies XYZ only; metadata always comes from the actual
        // validated graph, including origins absent from the old 2D API.
        const atoms=plan.atoms.map((a,i)=>({...a,x:fallback.atoms[i].x,y:fallback.atoms[i].y,z:fallback.atoms[i].z})),bounds={};
        for(const axis of ['X','Y','Z']){bounds[`min${axis}`]=Math.min(...atoms.map(a=>a[axis.toLowerCase()]));bounds[`max${axis}`]=Math.max(...atoms.map(a=>a[axis.toLowerCase()]));}
        bounds.width=bounds.maxX-bounds.minX;bounds.height=bounds.maxY-bounds.minY;bounds.depth=bounds.maxZ-bounds.minZ;
        return{...plan,atoms,bounds,diagnostics:{...plan.diagnostics,chemical,accepted:true,fallback:true,reason:'validated-finite-fallback',maxBondError:chemical.maxBondError,maxAngleError:chemical.maxAngleError,severeOverlapCount:chemical.severeOverlapCount,minimumNonbondedDistance:chemical.minimumNonbondedDistance,finite:chemical.finite,depthSpan:bounds.depth}};
      }
    }
  }
  const error=new Error(`Polymer geometry unavailable: ${plan.diagnostics.reason}`);error.code='POLYMER_GEOMETRY_UNAVAILABLE';error.diagnostics=plan.diagnostics;throw error;
}
