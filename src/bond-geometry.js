import {ATOMIC_MODEL,bondLengthScale} from './bonding-model.js?v=33';
import {structuralOxoGroups} from './structural-groups.js?v=1';

export const STRUCTURAL_GEOMETRY_WORLD_UNITS_PER_ANGSTROM=.78;

function elementsById(source){
  return new Map((source?.atoms??[]).map((atom,index)=>[typeof atom==='string'?index:(atom?.id??index),typeof atom==='string'?atom:atom?.element]));
}

export function genericBondLengthAngstrom(elementA,elementB,order){
  const radiusA=ATOMIC_MODEL[elementA]?.covalentRadius??.75,radiusB=ATOMIC_MODEL[elementB]?.covalentRadius??.75;
  return(radiusA+radiusB)*bondLengthScale(order);
}

function connects(group,a,b){return(group.center===a&&group.ends.includes(b))||(group.center===b&&group.ends.includes(a));}

function resolverFor(molecule){
  const elements=elementsById(molecule),groups=structuralOxoGroups(molecule);
  return(a,b,order)=>{
    const elementA=elements.get(a),elementB=elements.get(b);
    for(const group of groups){
      if(group.kind==='nitro'&&connects(group,a,b))return 1.23;
      if(group.kind==='ozone'&&connects(group,a,b))return 1.28;
    }
    for(const group of groups){
      if(group.kind!=='sulfur-oxo')continue;
      if(connects(group,a,b))return 1.43;
      if(order===1&&group.hydroxyls.some(id=>connects({center:group.center,ends:[id]},a,b)))return 1.57;
    }
    const pair=[elementA,elementB].sort().join('-');
    if(order===1&&pair==='H-H')return .74;
    if(order===1&&pair==='O-O')return 1.47;
    return genericBondLengthAngstrom(elementA,elementB,order);
  };
}

// One chemistry-space authority used by CRAFT, previews, generated assets and
// the preview-derived structures passed to Reaction Lab. Never mutates source.
export function structuralBondLengthAngstrom(molecule,a,b,order){
  return resolverFor(molecule)(a,b,order);
}

export function createStructuralBondLengthResolver(molecule){
  let resolve=null;
  const resolver=(a,b,order)=>(resolve??=resolverFor(molecule))(a,b,order);
  resolver.invalidate=()=>{resolve=null;};
  return resolver;
}
