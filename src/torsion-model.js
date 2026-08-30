const keyFor=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

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
  const aromatic=new Set(aromaticCycles.flat()),pi=id=>neighbors(id).some(n=>n.order===2);
  const heavy=ids=>[...ids].filter(id=>atoms.get(id).element!=='H').length;
  const bonds=new Map();
  for(const bond of molecule.bonds){
    const key=keyFor(bond.a,bond.b),sides={a:component(bond.a,key),b:component(bond.b,key)};
    let reason=null,kind='free';
    if(sides.a.has(bond.b)){reason='環の中は、この結合だけでは回せません';kind='ring';}
    else if(bond.order!==1){reason=bond.order===2?'二重結合は軸回転できません':'三重結合は軸回転の対象外です';kind='multiple';}
    else if([bond.a,bond.b].some(id=>atoms.get(id).element==='H'||neighbors(id).length<2)){reason='この軸では枝の形が変わりません';kind='terminal';}
    else {
      const donor=(a,b)=>['N','O','S'].includes(atoms.get(a).element)&&atoms.get(b).element==='C'&&pi(b);
      // Match the existing aromatic-planarity constraints for exocyclic pi
      // groups. Biaryl C–C and acyclic C(sp2)–C(sp2) single bonds remain usable.
      const planarFollower=(a,b)=>aromatic.has(a)&&!aromatic.has(b)&&(pi(b)||['N','O'].includes(atoms.get(b).element));
      if(donor(bond.a,bond.b)||donor(bond.b,bond.a)||planarFollower(bond.a,bond.b)||planarFollower(bond.b,bond.a)){
        reason='共鳴する部分は、この模型では平面に保ちます';kind='restricted';
      }
    }
    bonds.set(key,{key,bond,sides,allowed:!reason,kind,reason,heavyA:heavy(sides.a),heavyB:heavy(sides.b)});
  }
  function forAtom(atomId,{activeKey=null,positionFor=null}={}){
    if(!atoms.has(atomId))return null;
    const scope=component(atomId);
    if(scope.size===1)return {mode:'atom-translate',atomId,ids:[atomId],scope,candidates:[]};
    const candidates=[];
    for(const item of bonds.values()){
      if(!item.allowed||!scope.has(item.bond.a))continue;
      const left=item.sides.a.has(atomId),ids=left?item.sides.a:item.sides.b;
      // Keep the larger heavy-atom skeleton as the support, never swing it
      // around a terminal OH/H. Equal-sized sides may each be manipulated.
      if((left?item.heavyA:item.heavyB)>(left?item.heavyB:item.heavyA))continue;
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
    const selected=candidates.find(item=>item.key===activeKey)??(candidates.length===1?candidates[0]:null);
    if(selected)return {...selected,mode:'torsion',atomId,scope,candidates};
    if(candidates.length)return {mode:'axis-select',atomId,ids:[],scope,candidates,reason:'光る結合をタップして軸を選ぼう'};
    const nearby=new Set([atomId,...neighbors(atomId).map(n=>n.atomId)]);
    const restricted=[...bonds.values()].find(item=>['restricted','ring','multiple'].includes(item.kind)&&nearby.has(item.bond.a)&&nearby.has(item.bond.b));
    const hasAxis=[...bonds.values()].some(item=>item.allowed&&scope.has(item.bond.a));
    return {mode:'atom-locked',atomId,ids:[],scope,candidates,reason:restricted?.reason??(hasAxis?'ここは支点です · 回す枝の原子を選ぼう':'この構造には枝を回せる軸がありません')};
  }
  return {bonds,forAtom};
}
