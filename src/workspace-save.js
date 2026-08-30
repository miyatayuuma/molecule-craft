// A separate key keeps existing collection saves and future formats untouched.
export const WORKSPACE_STORAGE_KEY='molecule-craft.workspace.v1';
const ELEMENTS=new Set(['H','C','N','O','F','P','S','Cl']);
const point=value=>Array.isArray(value)&&value.length===3&&value.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000);
export function validateWorkspace(value){
  if(!value||value.schemaVersion!==1)throw new Error('Unsupported workspace');
  const {atoms,bonds,camera,selected,focus,pivot}=value;
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
  return value;
}
export function captureWorkspace({molecule,positionFor,camera,cameraTarget,selectedAtomId,focusId,pivot=null}){
  const ids=new Map(molecule.atoms.map((atom,index)=>[atom.id,index])),toArray=p=>[p.x,p.y,p.z].map(n=>n===0?0:n);
  return validateWorkspace({schemaVersion:1,atoms:molecule.atoms.map(atom=>({element:atom.element,position:toArray(positionFor(atom.id))})),bonds:molecule.bonds.map(bond=>[ids.get(bond.a),ids.get(bond.b),bond.order]),selected:ids.get(selectedAtomId)??null,focus:ids.get(focusId)??null,pivot:pivot?toArray(pivot):null,camera:{position:toArray(camera.position),target:toArray(cameraTarget),up:toArray(camera.up)}});
}
export function restoreWorkspace(saved,{THREE,molecule,placements,camera,cameraTarget}){
  validateWorkspace(saved);molecule.clear();placements.clear();
  const ids=saved.atoms.map(atom=>{const item=molecule.addAtom(atom.element);placements.set(item.id,{position:new THREE.Vector3(...atom.position)});return item.id;});
  for(const [a,b,order]of saved.bonds)molecule.setBond(ids[a],ids[b],order);
  camera.position.fromArray(saved.camera.position);cameraTarget.fromArray(saved.camera.target);camera.up.fromArray(saved.camera.up).normalize();camera.far=Math.max(camera.far,camera.position.distanceTo(cameraTarget)+30);camera.lookAt(cameraTarget);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  return {selected:ids[saved.selected]??null,focus:ids[saved.focus]??null,pivot:saved.pivot?new THREE.Vector3(...saved.pivot):null};
}
export function createWorkspaceStorage({storage,onStatus=()=>{}}={}){
  if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
  let previous=null,blocked='',snapshot=null,message='';
  const status=text=>{if(text===message)return;message=text;onStatus(text);};
  function read(){
    try{
      previous=storage?.getItem(WORKSPACE_STORAGE_KEY)??null;if(!storage){status('制作途中の保存を利用できません。');return null;}
      if(previous===null)return null;
      if(previous.length>2000000)throw new Error('Save too large');
      const value=JSON.parse(previous);
      if(Number(value?.schemaVersion)>1){blocked='future';status('新しい版の制作データを保護しています。アプリを更新してください。');return null;}
      snapshot=validateWorkspace(value);return snapshot;
    }catch{blocked='invalid';status('制作データを復元できませんでした。保存を保護しています。新しく始める場合はメニューからフィールドを空にしてください。');return null;}
  }
  function write(value){
    if(blocked)return false;
    try{
      validateWorkspace(value);const raw=JSON.stringify(value);snapshot=value;
      if(!storage){status('制作途中の保存を利用できません。');return false;}
      const current=storage.getItem(WORKSPACE_STORAGE_KEY);
      if(current!==previous){blocked='conflict';status('別の画面で制作データが更新されました。この画面では上書きせず、保存を停止しています。');return false;}
      if(raw===previous)return true;
      storage.setItem(WORKSPACE_STORAGE_KEY,raw);previous=raw;status('');return true;
    }catch{status('制作途中を保存できません。端末の空き容量やブラウザの設定を確認してください。');return false;}
  }
  return {read,write,get protected(){return !!blocked;},get message(){return message;},get snapshot(){return snapshot;},allowReset(){if(blocked==='invalid'){blocked='';status('');return true;}return !blocked;}};
}
