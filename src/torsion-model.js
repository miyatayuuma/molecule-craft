import {createConjugationModel,conjugatedBondKey as keyFor} from './conjugation-model.js?v=1';

// A topology-only index, rebuilt on graph changes, not on each pointer move.
// 'restricted' means this teaching model keeps the conjugated part planar; it
// does not assert an infinite physical rotation barrier or chemical stability.
export function createTorsionModel(molecule,{aromaticCycles=[]}={}) {
  const atoms=new Map(molecule.atoms.map(a=>[a.id,a])),adjacency=new Map(molecule.atoms.map(a=>[a.id,[]]));
  for(const bond of molecule.bonds){adjacency.get(bond.a).push({atomId:bond.b,order:bond.order});adjacency.get(bond.b).push({atomId:bond.a,order:bond.order});}
  const neighbors=id=>adjacency.get(id)??[];
  function component(start,skip=null){
    const ids=new Set([start]),queue=[start];
    for(let i=0;i<queue.length;i++)for(const n of neighbors(queue[i]))if(!ids.has(n.atomId)&&keyFor(queue[i],n.atomId)!==skip){ids.add(n.atomId);queue.push(n.atomId);}
    return ids;
  }
  const conjugation=createConjugationModel(molecule,{aromaticCycles});
  const heavy=ids=>[...ids].filter(id=>atoms.get(id).element!=='H').length;
  const bonds=new Map();
  for(const bond of molecule.bonds){
    const key=keyFor(bond.a,bond.b),sides={a:component(bond.a,key),b:component(bond.b,key)};
    let reason=null,kind='free';
    if(sides.a.has(bond.b)){reason='環の中は、この結合だけでは回せません';kind='ring';}
    else if(bond.order!==1){reason=bond.order===2?'二重結合は軸回転できません':'三重結合は軸回転の対象外です';kind='multiple';}
    else if([bond.a,bond.b].some(id=>atoms.get(id).element==='H'||neighbors(id).length<2)){reason='この軸では枝の形が変わりません';kind='terminal';}
    else if(conjugation.isRestrictedConjugatedBond(bond.a,bond.b)){
      reason='共鳴する部分は、この模型では平面に保ちます';kind='restricted';
    }
    const allowed=!reason;
    const classification=allowed?'ROTATABLE':kind==='restricted'?'RESTRICTED':'LOCKED';
    bonds.set(key,{key,bond,sides,allowed,kind,classification,reason,heavyA:heavy(sides.a),heavyB:heavy(sides.b)});
  }
  function pathToAnchor(start,scope){
    const distance=new Map([[start,0]]),parent=new Map(),queue=[start];
    for(let index=0;index<queue.length;index++)for(const next of neighbors(queue[index])){
      if(!scope.has(next.atomId)||distance.has(next.atomId))continue;
      distance.set(next.atomId,distance.get(queue[index])+1);parent.set(next.atomId,queue[index]);queue.push(next.atomId);
    }
    const heavyAtoms=[...scope].filter(id=>id!==start&&atoms.get(id).element!=='H');
    if(!heavyAtoms.length)return new Set();
    // Force travels away from the grabbed fragment toward the farthest heavy
    // support. Locked edges on the route remain rigid, while every rotatable
    // edge on that same route participates in the deformation.
    heavyAtoms.sort((a,b)=>distance.get(b)-distance.get(a)||a-b);
    const keys=new Set();let cursor=heavyAtoms[0];
    while(cursor!==start&&parent.has(cursor)){const previous=parent.get(cursor);keys.add(keyFor(previous,cursor));cursor=previous;}
    return keys;
  }
  function forAtom(atomId,{activeKey=null,positionFor=null}={}){
    if(!atoms.has(atomId))return null;
    const scope=component(atomId);
    if(scope.size===1)return {mode:'atom-translate',atomId,ids:[atomId],scope,candidates:[]};
    const candidates=[],pathKeys=pathToAnchor(atomId,scope);
    for(const item of bonds.values()){
      if(!item.allowed||!scope.has(item.bond.a)||!pathKeys.has(item.key))continue;
      const left=item.sides.a.has(atomId),ids=left?item.sides.a:item.sides.b;
      const root=left?item.bond.a:item.bond.b,pivot=left?item.bond.b:item.bond.a;
      if(positionFor){
        const origin=positionFor(pivot),anchor=positionFor(root);
        if(!origin||!anchor)continue;const axis=anchor.clone().sub(origin);
        if(axis.lengthSq()<1e-10)continue;axis.normalize();
        if(![...ids].some(id=>{const offset=positionFor(id)?.clone().sub(origin);return offset&&offset.addScaledVector(axis,-offset.dot(axis)).lengthSq()>.0025;}))continue;
      }
      candidates.push({...item,ids:[...ids],root,pivot});
    }
    candidates.sort((a,b)=>a.ids.length-b.ids.length||a.bond.a-b.bond.a||a.bond.b-b.bond.b);
    const selected=activeKey==null?null:candidates.find(item=>item.key===activeKey);
    if(selected)return {...selected,mode:'torsion',atomId,scope,candidates};
    // Normal atom dragging always uses the conformation path. A molecule with
    // one usable degree of freedom naturally has one axis, but it still follows
    // the same soft-target solver instead of the legacy screen-delta torsion UI.
    if(candidates.length)return {mode:'conformation',atomId,ids:[...new Set(candidates.flatMap(item=>item.ids))],scope,candidates};
    return {mode:'rigid-body',atomId,ids:[...scope],scope,candidates,reason:'固定構造を保ったまま分子全体が動きます'};
  }
  return {bonds,forAtom};
}
