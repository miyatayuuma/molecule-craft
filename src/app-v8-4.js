// v8.4: chemistry-naive interaction polish.
// Preserve the v8 engine/palette, keep v8.3 attachment/deletion policy,
// then add color highlighting, thinner bond-order colors, and explicit torsion-axis mode.
const sourceUrl = new URL('./app-v8.js', import.meta.url);
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8 engine: ${response.status}`);
let source = await response.text();

source = source
  .replace("from './chemistry.js'", `from '${chemistryUrl}'`)
  .replace("from './bonding-model.js'", `from '${bondingUrl}'`)
  .replace('let gestureState = null;', `let gestureState = null;
let activeTorsionKey = null;
const bondTapState = new Map();`);

// One palette tap = one atom. If selected atom is full, spawn a free atom.
const attachReplacement = `function attachToSelected(symbol, centerId) {
  const center = atomById(centerId);
  if (!center) return addFreeAtom(symbol);
  if (freeCapacity(centerId) <= 0) {
    pulse(\`${'${center.element}'} は満タン — ${'${symbol}'} を自由原子として追加\`);
    return addFreeAtom(symbol);
  }
  const centerPos = placements.get(centerId)?.position;
  if (!centerPos) return addFreeAtom(symbol);
  const direction = attachmentDirections(centerId, 1)[0] ?? new THREE.Vector3(1, 0, 0);
  const atom = molecule.addAtom(symbol);
  const dist = bondLengthByElements(center.element, symbol, 1) * 1.08;
  placements.set(atom.id, { position: centerPos.clone().add(direction.clone().multiplyScalar(dist)) });
  molecule.setBond(centerId, atom.id, 1);
  optimizeBondOrders(molecule, [...connectedComponent(centerId)]);
  settleMolecule(78);
  selectedAtomId = centerId;
  pulse(\`${'${symbol}'} を選択原子へ追加・結合\`);
  if (navigator.vibrate) navigator.vibrate(12);
  refresh();
}

function attachmentDirections`;
source = source.replace(/function attachToSelected\(symbol, centerId\) \{[\s\S]*?\n\}\n\nfunction attachmentDirections/, attachReplacement);

// Atom taps only select; repeated taps never damage atoms.
const atomTapReplacement = `function handleAtomTap(id){
  selectedAtomId=id;
  atomTapState.clear();
  atomTapState.set(id,{count:1,time:performance.now()});
  pulse(\`${'${atomById(id)?.element??\'\'}'} を選択 · 元素ボタンでここへ追加\`);
}

function chooseTorsionForAtom`;
source = source.replace(/function handleAtomTap\(id\)\{[\s\S]*?\n\}\n\nfunction chooseTorsionForAtom/, atomTapReplacement);

// Delete button is the only atom-deletion path.
const deletePattern = /document\.querySelector\('#delete-selected'\)\?\.addEventListener\('click', \(\) => \{[\s\S]*?\n  \}\);/;
const deleteReplacement = `document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    const id = selectedAtomId;
    const atom = atomById(id);
    if (!atom) return;
    molecule.removeAtom(id);
    placements.delete(id);
    atomDamage.delete(id);
    atomTapState.delete(id);
    selectedAtomId = null;
    activeTorsionKey = null;
    lastCelebrated = '';
    settleMolecule(30);
    pulse(\`${'${atom.element}'} を削除しました\`);
    if (navigator.vibrate) navigator.vibrate(12);
    refresh();
  });`;
source = source.replace(deletePattern, deleteReplacement);

// Explicit gesture arbitration: bonds are tapped to damage or double-tapped to choose a torsion axis.
// Atoms always start as whole-molecule drag, unless a torsion axis is already locked.
const pointerDownReplacement = `function onPointerDown(e) {
  markInteraction();
  activePointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,downAt:performance.now()});
  if (activePointers.size===2) { beginTwoFingerGesture(); dragState=null; electronDrag=null; hoveredSnap=null; controls.enabled=false; return; }
  if (activePointers.size>1) return;

  setPointer(e); raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(moleculeGroup.children,true);
  const bondHit=hits.find(h=>h.object.userData.bondKey);
  if (bondHit) {
    const key=bondHit.object.userData.bondKey;
    dragState={mode:'bond-tap',key,startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
    controls.enabled=false; capture(e); return;
  }
  const electronHit=hits.find(h=>h.object.userData.electronAtomId!==undefined);
  if (electronHit) {
    electronDrag={atomId:electronHit.object.userData.electronAtomId,current:electronHit.point.clone()};selectedAtomId=electronDrag.atomId;controls.enabled=false;capture(e);refresh();return;
  }
  const atomHit=hits.find(h=>h.object.userData.atomCore);
  if (!atomHit) {
    selectedAtomId=null;
    activeTorsionKey=null;
    controls.enabled=true;
    pulse('回転軸を解除');
    refresh();
    return;
  }

  const atomId=atomHit.object.userData.atomId;
  selectedAtomId=atomId;

  if (activeTorsionKey) {
    const [a,b]=activeTorsionKey.split(':').map(Number);
    const bond=bondBetween(a,b);
    const sides=bond&&isRotatableBond(bond)?cutSides(a,b):null;
    if (sides) {
      const inA=sides.aSide.has(atomId),inB=sides.bSide.has(atomId);
      if (inA||inB) {
        const movingIds=[...(inA?sides.aSide:sides.bSide)];
        dragState={mode:'torsion-axis',atomId,a,b,movingIds,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()};
        controls.enabled=false;capture(e);refresh();return;
      }
    } else activeTorsionKey=null;
  }

  const component=[...connectedComponent(atomId)];
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),placements.get(atomId).position);
  const world=rayToPlane(e); if(!world)return;
  dragState={mode:'translate',atomId,component,startWorld:world.clone(),starts:new Map(component.map(id=>[id,placements.get(id).position.clone()])),startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
  controls.enabled=false; capture(e); refresh();
}

function beginTwoFingerGesture`;
source = source.replace(/function onPointerDown\(e\) \{[\s\S]*?\n\}\n\nfunction beginTwoFingerGesture/, pointerDownReplacement);

const pointerMoveReplacement = `function onPointerMove(e) {
  const ps=activePointers.get(e.pointerId);
  if(ps){ps.x=e.clientX;ps.y=e.clientY;}
  markInteraction();
  if(activePointers.size===2){updateTwoFingerGesture();return;}
  if(activePointers.size>1)return;
  if(electronDrag){const p=rayToPlaneThrough(e,placements.get(electronDrag.atomId)?.position??new THREE.Vector3());if(p)electronDrag.current.copy(p);hoveredSnap=findElectronTarget(electronDrag.atomId,electronDrag.current);renderInteraction();return;}
  if(!dragState)return;
  dragState.moved ||= Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>7;

  if(dragState.mode==='bond-tap') return;

  if(dragState.mode==='torsion-axis'){
    if(!dragState.moved)return;
    const dx=e.clientX-dragState.lastX,dy=e.clientY-dragState.lastY;
    dragState.lastX=e.clientX;dragState.lastY=e.clientY;
    rotateBranchAroundBond(dragState.a,dragState.b,dragState.movingIds,THREE.MathUtils.clamp((dx-dy*.35)*.012,-.12,.12));
    hoveredSnap=findAutoBondCandidate(dragState.movingIds,true);
    renderMolecule();return;
  }

  if(!dragState.moved)return;
  const world=rayToPlane(e);if(!world)return;const delta=world.clone().sub(dragState.startWorld);
  for(const id of dragState.component)placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap=findAutoBondCandidate(dragState.component,false);renderMolecule();
}

function onPointerUp`;
source = source.replace(/function onPointerMove\(e\) \{[\s\S]*?\n\}\n\nfunction onPointerUp/, pointerMoveReplacement);

const pointerUpReplacement = `function onPointerUp(e) {
  markInteraction();
  const before=activePointers.size,ps=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);
  if(before>=2){if(activePointers.size<2)gestureState=null;controls.enabled=true;return;}
  if(electronDrag){const target=hoveredSnap??findElectronTarget(electronDrag.atomId,electronDrag.current);if(target)formBond(electronDrag.atomId,target.atomId,true);electronDrag=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();return;}
  if(!dragState){controls.enabled=true;return;}
  const state=dragState,isTap=!state.moved&&ps&&performance.now()-ps.downAt<360;

  if(state.mode==='bond-tap'){
    if(isTap){
      const now=performance.now(),prev=bondTapState.get(state.key);
      const [a,b]=state.key.split(':').map(Number),bond=bondBetween(a,b);
      if(prev&&now-prev<420&&bond&&isRotatableBond(bond)){
        activeTorsionKey=activeTorsionKey===state.key?null:state.key;
        bondTapState.clear();
        pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');
        if(navigator.vibrate)navigator.vibrate(activeTorsionKey?[10,16,18]:10);
      }else{
        bondTapState.set(state.key,now);
        damageBond(state.key);
      }
    }
  } else if(state.mode==='torsion-axis'){
    if(!isTap){
      const candidate=hoveredSnap??findAutoBondCandidate(state.movingIds,true);
      if(candidate)formBond(candidate.a,candidate.b,false);
      settleMolecule(24);
    } else handleAtomTap(state.atomId);
  } else if(isTap) {
    handleAtomTap(state.atomId);
  } else {
    const candidate=hoveredSnap??findAutoBondCandidate(state.component,false);if(candidate)formBond(candidate.a,candidate.b,false);
  }
  dragState=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();
}
function onPointerCancel`;
source = source.replace(/function onPointerUp\(e\) \{[\s\S]*?\n\}\nfunction onPointerCancel/, pointerUpReplacement);

// Selected atom uses color/emission only; no ring overlay.
const renderAtomReplacement = `function renderAtom(atom,flash){
  const p=placements.get(atom.id);if(!p)return;
  const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId,damage=atomDamage.get(atom.id)?.damage??0;
  const selectedColor = selected ? 0x22d3ee : cfg.color;
  const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.06*(1-damage*.10),32,24),new THREE.MeshStandardMaterial({
    color:selectedColor,roughness:.22,metalness:.03,transparent:damage>0,opacity:1-damage*.58,
    emissive:damage>.05?0x7f1d1d:flash?0x38bdf8:selected?0x0891b2:0,
    emissiveIntensity:damage>.05?.25+damage*.85:flash?.72:selected?1.05:0
  }));
  core.position.copy(p.position);core.userData={atomCore:true,atomId:atom.id};moleculeGroup.add(core);
  if(damage>.04)addAtomCracks(p.position,cfg.radius*1.08,damage);
  const used=molecule.bondOrderForAtom(atom.id),singles=unpairedElectronCount(atom.element,used),lps=lonePairCount(atom.element,used),total=Math.max(1,singles+lps+molecule.neighbors(atom.id).length),dirs=electronDirections(total),shellR=valenceShellRadius(atom.element,cfg.radius*1.02);
  for(let i=0;i<singles;i++)addElectron(atom.id,p.position,dirs[i%dirs.length],shellR,selected);
  for(let i=0;i<lps;i++)addLonePair(p.position,dirs[(singles+i)%dirs.length],shellR);
}
function addAtomCracks`;
source = source.replace(/function renderAtom\(atom,flash\)\{[\s\S]*?\nfunction addAtomCracks/, renderAtomReplacement);

// Bond order is encoded by both count and color. Lines are intentionally thin.
const addBondReplacement = `function addBondMeshes(bond,flash){
  const start=placements.get(bond.a)?.position,end=placements.get(bond.b)?.position;if(!start||!end)return;
  const axis=end.clone().sub(start).normalize(),side=perpendicular(axis),key=bondKey(bond.a,bond.b),damage=bondDamage.get(key)?.damage??0;
  const rotatable=isRotatableBond(bond),active=activeTorsionKey===key;
  const offsets=bond.order===1?[0]:bond.order===2?[-.06,.06]:[-.10,0,.10];
  const baseColor=bond.order===1?0x94a3b8:bond.order===2?0xf59e0b:0xa78bfa;
  const color=damage>.02?0xfca5a5:active?0x22d3ee:flash?0x7dd3fc:baseColor;
  for(const offset of offsets){
    const shift=side.clone().multiplyScalar(offset),radius=(active?.036:.028)*(1-damage*.62),opacity=1-damage*.52;
    const shadow=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.014,radius+.010),0x0f172a,.72);shadow.userData={bondKey:key};moleculeGroup.add(shadow);
    if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.009,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}else{const mid=start.clone().lerp(end,.5),leftEnd=start.clone().lerp(mid,.72),rightEnd=end.clone().lerp(mid,.72);for(const seg of[[start,leftEnd],[end,rightEnd]]){const mesh=cylinderBetween(seg[0].clone().add(shift),seg[1].clone().add(shift),Math.max(.008,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}}
  }
  const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*.095),pairAxis=perpendicular(axis).multiplyScalar(.038);for(const sign of[-1,1]){const dot=new THREE.Mesh(new THREE.SphereGeometry(.046,12,10),new THREE.MeshStandardMaterial({color:damage>.02?0xfecaca:0xe0f2fe,transparent:damage>0,opacity:1-damage*.5,emissive:active?0x0891b2:damage>.02?0x7f1d1d:flash?0x38bdf8:0x1e3a8a,emissiveIntensity:active?1.15:damage>.02?.35+damage*.7:flash?1:.35}));const retreat=(sign<0?start:end).clone().lerp(center,1-damage*.55);dot.position.copy(retreat).add(lateral).add(pairAxis.clone().multiplyScalar(sign));dot.userData={bondKey:key};moleculeGroup.add(dot);}}}
function renderInteraction`;
source = source.replace(/function addBondMeshes\(bond,flash\)\{[\s\S]*?\nfunction renderInteraction/, addBondReplacement);

// Make status copy explain the interaction without chemistry jargon.
source = source.replace("selectionChip.textContent=`${selected.element} 選択中 · 元素ボタンで結合追加 · 原子ドラッグで分子移動`;", "selectionChip.textContent=activeTorsionKey?'回転モード · 強調された結合を軸に原子をドラッグ':`${selected.element} 選択中 · 元素ボタンで追加 · ドラッグで分子移動`;" );

if (!source.includes('activeTorsionKey')) throw new Error('v8.4 torsion patch failed');

const blob = new Blob([source], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
