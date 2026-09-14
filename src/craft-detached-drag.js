const point=value=>value&&Number.isFinite(value.x)&&Number.isFinite(value.y)&&Number.isFinite(value.z)?{x:value.x,y:value.y,z:value.z}:null;
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});

export function captureDetachedFragment(molecule,candidate,{positionFor,pointerWorld}={}){
  if(!molecule||!candidate?.grabFragment||typeof positionFor!=='function')return null;
  const ids=new Set(candidate.grabFragment),grabbedAtomId=candidate.grabbedAtomId,anchor=point(positionFor(grabbedAtomId));
  if(!ids.has(grabbedAtomId)||!anchor)return null;
  const atoms=[];
  for(const atom of molecule.atoms??[]){
    if(!ids.has(atom.id))continue;
    const position=point(positionFor(atom.id));if(!position)return null;
    atoms.push({id:atom.id,element:atom.element,offset:subtract(position,anchor)});
  }
  if(atoms.length!==ids.size)return null;
  const bonds=(molecule.bonds??[]).filter(bond=>ids.has(bond.a)&&ids.has(bond.b)).map(bond=>({a:bond.a,b:bond.b,order:bond.order??1}));
  const pointer=point(pointerWorld)??anchor;
  return{grabbedAtomId,atoms,bonds,anchor:{...anchor},pointerOffset:subtract(anchor,pointer)};
}

export function createDetachedDrag(snapshot){
  if(!snapshot?.anchor||!snapshot?.pointerOffset)return null;
  let active=true,anchor={...snapshot.anchor};
  return{
    snapshot,
    update(pointerWorld){
      if(!active)return null;const pointer=point(pointerWorld);if(!pointer)return{...anchor};anchor=add(pointer,snapshot.pointerOffset);return{...anchor};
    },
    clear(){active=false;},
    get active(){return active;},
    get anchor(){return{...anchor};},
  };
}

export function detachedAtomPositions(snapshot,anchor=snapshot?.anchor){
  const base=point(anchor);if(!snapshot?.atoms||!base)return[];
  return snapshot.atoms.map(atom=>({id:atom.id,element:atom.element,position:add(base,atom.offset)}));
}
