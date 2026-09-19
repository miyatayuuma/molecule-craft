// Read-only stereochemical observation for the deliberately narrow alkene scope
// used by Task 6D-2. This does not assign E/Z, does not participate in molecule
// identity, and does not mutate or constrain geometry.
const DEFAULT_EPSILON=1e-6;
const DEFAULT_MIN_ALIGNMENT_COSINE=.75;

const compareIds=(a,b)=>typeof a==='number'&&typeof b==='number'?a-b:String(a)<String(b)?-1:String(a)>String(b)?1:0;
const bondRecord=bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond&&{a:bond.a,b:bond.b,order:bond.order};
const samePair=(bond,a,b)=>bond&&(bond.a===a&&bond.b===b||bond.a===b&&bond.b===a);

function topologyFor(molecule){
  if(!molecule||!Array.isArray(molecule.atoms)||!Array.isArray(molecule.bonds))return null;
  const atoms=molecule.atoms.map((atom,index)=>({id:atom?.id??index,element:atom?.element??atom}));
  if(atoms.some(atom=>atom.id==null||typeof atom.element!=='string')||new Set(atoms.map(atom=>atom.id)).size!==atoms.length)return null;
  const atomById=new Map(atoms.map(atom=>[atom.id,atom])),bonds=[];
  for(const source of molecule.bonds){
    const bond=bondRecord(source);
    if(!bond||!atomById.has(bond.a)||!atomById.has(bond.b)||bond.a===bond.b||![1,2,3].includes(bond.order))return null;
    bonds.push(bond);
  }
  const adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const bond of bonds){
    adjacency.get(bond.a).push({atomId:bond.b,order:bond.order});
    adjacency.get(bond.b).push({atomId:bond.a,order:bond.order});
  }
  return{atoms,bonds,atomById,adjacency};
}

function targetBond(topology,bond){
  const requested=bondRecord(bond);
  if(!requested)return null;
  return topology.bonds.find(candidate=>samePair(candidate,requested.a,requested.b))??null;
}

function bondIsInCycle(topology,a,b){
  const visited=new Set([a]),queue=[a];
  for(let index=0;index<queue.length;index++){
    const current=queue[index];
    for(const neighbor of topology.adjacency.get(current)??[]){
      if(current===a&&neighbor.atomId===b||current===b&&neighbor.atomId===a)continue;
      if(neighbor.atomId===b)return true;
      if(visited.has(neighbor.atomId))continue;
      visited.add(neighbor.atomId);queue.push(neighbor.atomId);
    }
  }
  return false;
}

function referenceSubstituent(topology,centerId,partnerId){
  const neighbors=topology.adjacency.get(centerId)??[];
  if(neighbors.length!==3)return null;
  const partner=neighbors.filter(neighbor=>neighbor.atomId===partnerId);
  if(partner.length!==1||partner[0].order!==2)return null;
  const substituents=neighbors.filter(neighbor=>neighbor.atomId!==partnerId);
  if(substituents.length!==2||substituents.some(neighbor=>neighbor.order!==1))return null;
  const hydrogens=substituents.filter(neighbor=>topology.atomById.get(neighbor.atomId)?.element==='H');
  const nonHydrogens=substituents.filter(neighbor=>topology.atomById.get(neighbor.atomId)?.element!=='H');
  return hydrogens.length===1&&nonHydrogens.length===1?nonHydrogens[0].atomId:null;
}

function positionFor(source,id){
  let value;
  if(typeof source==='function')value=source(id);
  else if(source instanceof Map)value=source.get(id);
  else if(source&&typeof source==='object')value=source[id];
  value=value?.position??value;
  if(Array.isArray(value))value={x:value[0],y:value[1],z:value[2]};
  return value&&[value.x,value.y,value.z].every(Number.isFinite)?value:null;
}

const vector=(from,to)=>[to.x-from.x,to.y-from.y,to.z-from.z];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const projectedPerpendicular=(value,axis,axisSq)=>{
  const scale=dot(value,axis)/axisSq;
  return[value[0]-axis[0]*scale,value[1]-axis[1]*scale,value[2]-axis[2]*scale];
};

// Supported topology is intentionally narrow: an acyclic C=C whose two carbon
// endpoints each carry exactly one H and one non-H single-bond substituent.
// The selected non-H atoms are geometric references only; no priority rule is
// inferred from them.
export function describeAlkeneRelativeSide(molecule,positions,bond,{epsilon=DEFAULT_EPSILON,minAlignmentCosine=DEFAULT_MIN_ALIGNMENT_COSINE}={}){
  const topology=topologyFor(molecule);
  if(!topology||!Number.isFinite(epsilon)||epsilon<=0||!Number.isFinite(minAlignmentCosine)||minAlignmentCosine<=0||minAlignmentCosine>=1)return null;
  const actual=targetBond(topology,bond);
  if(!actual||actual.order!==2)return null;
  const leftAtom=topology.atomById.get(actual.a),rightAtom=topology.atomById.get(actual.b);
  if(leftAtom?.element!=='C'||rightAtom?.element!=='C'||bondIsInCycle(topology,actual.a,actual.b))return null;

  let a=actual.a,b=actual.b;
  if(compareIds(a,b)>0)[a,b]=[b,a];
  const referenceA=referenceSubstituent(topology,a,b),referenceB=referenceSubstituent(topology,b,a);
  if(referenceA==null||referenceB==null)return null;

  const pointA=positionFor(positions,a),pointB=positionFor(positions,b),pointReferenceA=positionFor(positions,referenceA),pointReferenceB=positionFor(positions,referenceB);
  if(!pointA||!pointB||!pointReferenceA||!pointReferenceB)return null;
  const axis=vector(pointA,pointB),axisSq=dot(axis,axis),epsilonSq=epsilon*epsilon;
  if(axisSq<=epsilonSq)return null;
  const sideA=projectedPerpendicular(vector(pointA,pointReferenceA),axis,axisSq);
  const sideB=projectedPerpendicular(vector(pointB,pointReferenceB),axis,axisSq);
  const lengthSqA=dot(sideA,sideA),lengthSqB=dot(sideB,sideB);
  if(lengthSqA<=epsilonSq||lengthSqB<=epsilonSq)return null;
  const cosine=Math.max(-1,Math.min(1,dot(sideA,sideB)/Math.sqrt(lengthSqA*lengthSqB)));
  const relation=cosine>=minAlignmentCosine?'same-side':cosine<=-minAlignmentCosine?'opposite-side':null;
  if(!relation)return null;
  return Object.freeze({
    kind:'alkene-relative-side',
    relation,
    bondAtomIds:Object.freeze([a,b]),
    referenceSubstituentIds:Object.freeze([referenceA,referenceB]),
  });
}
