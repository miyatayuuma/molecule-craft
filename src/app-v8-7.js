// v8.7: structure-first interaction model.
// Builds on v8.6, removes molecule translation/free-atom spawning, and turns
// one-finger atom drag into branch-angle manipulation with gentle VSEPR settling.
const previousUrl = new URL('./app-v8-6.js', import.meta.url);
const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url).href;
const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;
const appUrl = new URL('./app-v8.js', import.meta.url).href;
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(previousUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8.6: ${response.status}`);
let loader = await response.text();

// v8.6 is itself evaluated from a Blob. Resolve all nested module URLs first.
loader = loader
  .replace("const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url);", `const safeUrl = new URL('${safeUrl}');`)
  .replace("const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;", `const wrapperUrl = '${wrapperUrl}';`)
  .replace("const appUrl = new URL('./app-v8.js', import.meta.url).href;", `const appUrl = '${appUrl}';`)
  .replace("const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;", `const chemistryUrl = '${chemistryUrl}';`)
  .replace("const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;", `const bondingUrl = '${bondingUrl}';`);

const patch = `
// v8.7 structure-first patch.

// Element palette no longer creates arbitrary floating atoms. The very first
// atom is the seed at the work origin; every later addition requires a selected
// atom with free valence capacity.
code = code.replace(
  /function addElement\\(symbol\\) \\{[\\s\\S]*?\\n\\}\\n\\nfunction addFreeAtom/,
  \`function addElement(symbol) {
  markInteraction();
  const selected=atomById(selectedAtomId);
  if(molecule.atoms.length===0){
    const atom=molecule.addAtom(symbol);
    placements.set(atom.id,{position:controls.target.clone()});
    selectedAtomId=atom.id;
    pulse(symbol+' を中心原子として追加');
    if(navigator.vibrate)navigator.vibrate(10);
    refresh();
    return;
  }
  if(!selected){
    pulse('結合先の原子を先に選択してください');
    return;
  }
  if(freeCapacity(selected.id)<=0){
    pulse(selected.element+' には追加できる結合余地がありません');
    return;
  }
  attachToSelected(symbol,selected.id);
}

function addFreeAtom\`
);

// Even if an older internal path calls addFreeAtom, do not create a disconnected
// atom. This keeps the workspace free of arbitrary floating atoms.
code = code.replace(
  /function addFreeAtom\\(symbol\\) \\{[\\s\\S]*?\\n\\}\\n\\nfunction attachToSelected/,
  \`function addFreeAtom(symbol) {
  if(molecule.atoms.length===0){
    const atom=molecule.addAtom(symbol);
    placements.set(atom.id,{position:controls.target.clone()});
    selectedAtomId=atom.id;
    pulse(symbol+' を中心原子として追加');
    refresh();
    return atom;
  }
  const selected=atomById(selectedAtomId);
  if(selected&&freeCapacity(selected.id)>0)return attachToSelected(symbol,selected.id);
  pulse(selected?'この原子にはもう追加できません':'結合先の原子を先に選択してください');
  return null;
}

function attachToSelected\`
);

// Helpers for structure drag. The dragged atom chooses the adjacent bond whose
// cut leaves the smallest branch containing that atom. The whole branch moves
// rigidly while that bond direction is steered in screen space.
const structureHelpers = \`
function structureDragPlan(atomId){
  const neighbors=molecule.neighbors(atomId).map(n=>n.atomId);
  if(!neighbors.length)return null;
  let best=null;
  for(const pivotId of neighbors){
    const sides=cutSides(atomId,pivotId);
    if(!sides)continue;
    const side=sides.aSide.has(atomId)?sides.aSide:sides.bSide;
    if(!best||side.size<best.movingIds.length)best={pivotId,movingIds:[...side]};
  }
  return best;
}
function rotateStructureBranch(state,dx,dy){
  const pivot=placements.get(state.pivotId)?.position;
  const anchor=placements.get(state.atomId)?.position;
  if(!pivot||!anchor)return;
  const oldDir=anchor.clone().sub(pivot);
  if(oldDir.lengthSq()<1e-8)return;
  const right=cameraRight().normalize(),up=cameraUp().normalize();
  const qYaw=new THREE.Quaternion().setFromAxisAngle(up,-dx*.0105);
  const qPitch=new THREE.Quaternion().setFromAxisAngle(right,-dy*.0105);
  const newDir=oldDir.clone().applyQuaternion(qYaw).applyQuaternion(qPitch).normalize();
  const from=oldDir.clone().normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(from,newDir);
  for(const id of state.movingIds){
    const p=placements.get(id)?.position;if(!p)continue;
    p.sub(pivot).applyQuaternion(q).add(pivot);
  }
}
\`;
code = code.replace('function beginTwoFingerGesture() {', structureHelpers+'\\nfunction beginTwoFingerGesture() {');

// Atom touch now starts structure manipulation rather than whole-molecule
// translation. Locked torsion mode still takes priority.
code = code.replace(
  /function onPointerDown\\(e\\) \\{[\\s\\S]*?\\n\\}\\n\\nfunction beginTwoFingerGesture/,
  \`function onPointerDown(e) {
  markInteraction();
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,downAt:performance.now()});
  if(activePointers.size===2){beginTwoFingerGesture();dragState=null;electronDrag=null;hoveredSnap=null;controls.enabled=false;return;}
  if(activePointers.size>1)return;
  setPointer(e);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(moleculeGroup.children,true);
  const bondHit=hits.find(h=>h.object.userData.bondKey);
  if(bondHit){
    const key=bondHit.object.userData.bondKey;
    dragState={mode:'bond-hold',key,startX:e.clientX,startY:e.clientY,moved:false,holding:false,downAt:performance.now()};
    clearTimeout(bondHoldTimer);clearInterval(bondHoldInterval);
    bondHoldTimer=setTimeout(()=>{
      if(!dragState||dragState.mode!=='bond-hold'||dragState.key!==key||dragState.moved)return;
      dragState.holding=true;damageBond(key);
      bondHoldInterval=setInterval(()=>damageBond(key),300);
      pulse('長押し中 · 結合がほどけています');
    },520);
    controls.enabled=false;capture(e);return;
  }
  const electronHit=hits.find(h=>h.object.userData.electronAtomId!==undefined);
  if(electronHit){electronDrag={atomId:electronHit.object.userData.electronAtomId,current:electronHit.point.clone()};selectedAtomId=electronDrag.atomId;controls.enabled=false;capture(e);refresh();return;}
  const atomHit=hits.find(h=>h.object.userData.atomCore);
  if(!atomHit){selectedAtomId=null;activeTorsionKey=null;controls.enabled=true;pulse('回転軸を解除');refresh();return;}
  const atomId=atomHit.object.userData.atomId;selectedAtomId=atomId;
  if(activeTorsionKey){
    const[a,b]=activeTorsionKey.split(':').map(Number),bond=bondBetween(a,b),sides=bond&&isRotatableBond(bond)?cutSides(a,b):null;
    if(sides){const inA=sides.aSide.has(atomId),inB=sides.bSide.has(atomId);if(inA||inB){const movingIds=[...(inA?sides.aSide:sides.bSide)];dragState={mode:'torsion-axis',atomId,a,b,movingIds,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()};controls.enabled=false;capture(e);refresh();return;}}else activeTorsionKey=null;
  }
  const plan=structureDragPlan(atomId);
  if(plan){
    dragState={mode:'structure',atomId,pivotId:plan.pivotId,movingIds:plan.movingIds,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()};
  }else{
    dragState={mode:'select-only',atomId,startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
  }
  controls.enabled=false;capture(e);refresh();
}

function beginTwoFingerGesture\`
);

code = code.replace(
  /function onPointerMove\\(e\\) \\{[\\s\\S]*?\\n\\}\\n\\nfunction onPointerUp/,
  \`function onPointerMove(e) {
  const ps=activePointers.get(e.pointerId);if(ps){ps.x=e.clientX;ps.y=e.clientY;}
  markInteraction();if(activePointers.size===2){updateTwoFingerGesture();return;}if(activePointers.size>1)return;
  if(electronDrag){const p=rayToPlaneThrough(e,placements.get(electronDrag.atomId)?.position??new THREE.Vector3());if(p)electronDrag.current.copy(p);hoveredSnap=findElectronTarget(electronDrag.atomId,electronDrag.current);renderInteraction();return;}
  if(!dragState)return;
  dragState.moved ||= Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>7;
  if(dragState.mode==='bond-hold'){if(dragState.moved&&!dragState.holding){clearTimeout(bondHoldTimer);clearInterval(bondHoldInterval);}return;}
  if(dragState.mode==='torsion-axis'){
    if(!dragState.moved)return;const dx=e.clientX-dragState.lastX,dy=e.clientY-dragState.lastY;dragState.lastX=e.clientX;dragState.lastY=e.clientY;
    rotateBranchAroundBond(dragState.a,dragState.b,dragState.movingIds,THREE.MathUtils.clamp((dx-dy*.35)*.012,-.12,.12));renderMolecule();return;
  }
  if(dragState.mode==='structure'){
    if(!dragState.moved)return;const dx=e.clientX-dragState.lastX,dy=e.clientY-dragState.lastY;dragState.lastX=e.clientX;dragState.lastY=e.clientY;
    rotateStructureBranch(dragState,dx,dy);renderMolecule();return;
  }
}

function onPointerUp\`
);

code = code.replace(
  /function onPointerUp\\(e\\) \\{[\\s\\S]*?\\n\\}\\nfunction onPointerCancel/,
  \`function onPointerUp(e) {
  markInteraction();const before=activePointers.size,ps=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);
  if(before>=2){if(activePointers.size<2)gestureState=null;controls.enabled=true;return;}
  if(electronDrag){const target=hoveredSnap??findElectronTarget(electronDrag.atomId,electronDrag.current);if(target)formBond(electronDrag.atomId,target.atomId,true);electronDrag=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();return;}
  if(!dragState){controls.enabled=true;return;}
  const state=dragState,isTap=!state.moved&&ps&&performance.now()-ps.downAt<360;
  if(state.mode==='bond-hold'){
    clearTimeout(bondHoldTimer);clearInterval(bondHoldInterval);bondHoldTimer=null;bondHoldInterval=null;
    if(isTap&&!state.holding){
      const now=performance.now(),prev=bondTapState.get(state.key);const[a,b]=state.key.split(':').map(Number),bond=bondBetween(a,b);
      if(prev&&now-prev<420&&bond&&isRotatableBond(bond)){
        activeTorsionKey=activeTorsionKey===state.key?null:state.key;bondTapState.clear();
        pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');
        if(navigator.vibrate)navigator.vibrate(activeTorsionKey?[10,16,18]:10);
      }else bondTapState.set(state.key,now);
    }
  }else if(state.mode==='torsion-axis'){
    if(isTap)handleAtomTap(state.atomId);else settleMolecule(14);
  }else if(state.mode==='structure'){
    if(isTap)handleAtomTap(state.atomId);else{settleMolecule(16);pulse('結合角を自然な形へ軽く整えました');}
  }else if(state.mode==='select-only')handleAtomTap(state.atomId);
  dragState=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();
}
function onPointerCancel\`
);

// Copy reflects the new mental model: one finger edits structure, two fingers
// edit the view. There is no whole-molecule translation gesture.
code = code.replace(
  "selectionChip.textContent=activeTorsionKey?'回転モード · 強調された結合を軸に原子をドラッグ':`${selected.element} 選択中 · 元素ボタンで追加 · ドラッグで分子移動`;",
  "selectionChip.textContent=activeTorsionKey?'回転モード · 強調された結合を軸に原子をドラッグ':`${selected.element} 選択中 · ドラッグで立体構造を調整`;"
);
`;

const insertionPoint = "const blob = new Blob([loader], { type: 'text/javascript' });";
if (!loader.includes(insertionPoint)) throw new Error('v8.6 loader signature not found');
loader = loader.replace(insertionPoint, `${patch}\n${insertionPoint}`);

const blob = new Blob([loader], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
