export const WORKSPACE_SCHEMA=2;
const ELEMENTS=new Set(['H','C','N','O','F','P','S','Cl']);
const point=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000);

// Runtime code accepts only the canonical current workspace. Persisted legacy
// schemas are normalized before they cross the persistence ingress boundary.
export function validateWorkspace(value){
  if(!value||value.schemaVersion!==WORKSPACE_SCHEMA||!Object.hasOwn(value,'targetMoleculeId'))throw new Error('Invalid current workspace');
  const {atoms,bonds,camera,selected,focus,pivot,targetMoleculeId}=value;
  if(!Array.isArray(atoms)||atoms.length>1000||!Array.isArray(bonds)||bonds.length>3000)throw new Error('Invalid graph size');
  if(!atoms.every(a=>a&&ELEMENTS.has(a.element)&&point(a.position)))throw new Error('Invalid atoms');
  const index=id=>Number.isInteger(id)&&id>=0&&id<atoms.length;
  const edges=new Set();
  for(const b of bonds){if(!Array.isArray(b)||b.length!==3||!index(b[0])||!index(b[1])||b[0]===b[1]||![1,2,3].includes(b[2]))throw new Error('Invalid bond');const key=[b[0],b[1]].sort((a,b)=>a-b).join(':');if(edges.has(key))throw new Error('Duplicate bond');edges.add(key);}
  if(!camera||!point(camera.position)||!point(camera.target)||!point(camera.up))throw new Error('Invalid camera');
  const direction=camera.position.map((x,i)=>x-camera.target[i]),distance=Math.hypot(...direction),up=Math.hypot(...camera.up);
  if(distance<.1||distance>1000||up<.5||up>2)throw new Error('Invalid camera direction');
  const cross=[direction[1]*camera.up[2]-direction[2]*camera.up[1],direction[2]*camera.up[0]-direction[0]*camera.up[2],direction[0]*camera.up[1]-direction[1]*camera.up[0]];
  if(Math.hypot(...cross)<distance*.001)throw new Error('Invalid camera up');
  if((selected!==null&&!index(selected))||(focus!==null&&!index(focus))||(pivot!==null&&!point(pivot)))throw new Error('Invalid focus');
  if(targetMoleculeId!==null&&(typeof targetMoleculeId!=='string'||!/^[A-Za-z][A-Za-z0-9-]*$/.test(targetMoleculeId)))throw new Error('Invalid target');
  return value;
}

export function captureWorkspace({molecule,positionFor,camera,cameraTarget,selectedAtomId,focusId,pivot=null,targetMoleculeId=null}){
  const ids=new Map(molecule.atoms.map((atom,index)=>[atom.id,index])),toArray=p=>[p.x,p.y,p.z].map(n=>n===0?0:n);
  return validateWorkspace({schemaVersion:WORKSPACE_SCHEMA,atoms:molecule.atoms.map(atom=>({element:atom.element,position:toArray(positionFor(atom.id))})),bonds:molecule.bonds.map(bond=>[ids.get(bond.a),ids.get(bond.b),bond.order]),selected:ids.get(selectedAtomId)??null,focus:ids.get(focusId)??null,pivot:pivot?toArray(pivot):null,targetMoleculeId,camera:{position:toArray(camera.position),target:toArray(cameraTarget),up:toArray(camera.up)}});
}

export function restoreWorkspace(saved,{THREE,molecule,placements,camera,cameraTarget}){
  validateWorkspace(saved);molecule.clear();placements.clear();
  const ids=saved.atoms.map(atom=>{const item=molecule.addAtom(atom.element);placements.set(item.id,{position:new THREE.Vector3(...atom.position)});return item.id;});
  for(const [a,b,order]of saved.bonds)molecule.setBond(ids[a],ids[b],order);
  camera.position.fromArray(saved.camera.position);cameraTarget.fromArray(saved.camera.target);camera.up.fromArray(saved.camera.up).normalize();camera.far=Math.max(camera.far,camera.position.distanceTo(cameraTarget)+30);camera.lookAt(cameraTarget);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return {selected:ids[saved.selected]??null,focus:ids[saved.focus]??null,pivot:saved.pivot?new THREE.Vector3(...saved.pivot):null,targetMoleculeId:saved.targetMoleculeId};
}
