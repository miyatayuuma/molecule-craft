// v8.8: repair v8.7 loader regression and make geometry hybridization-aware.
// This extends the known-working v8.6 patch at the final-engine level.
const previousUrl = new URL('./app-v8-6.js', import.meta.url);
const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url).href;
const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;
const appUrl = new URL('./app-v8.js', import.meta.url).href;
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(previousUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8.6: ${response.status}`);
let loader = await response.text();

// v8.6 is evaluated from a Blob, so resolve nested URLs before importing it.
loader = loader
  .replace("const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url);", `const safeUrl = new URL('${safeUrl}');`)
  .replace("const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;", `const wrapperUrl = '${wrapperUrl}';`)
  .replace("const appUrl = new URL('./app-v8.js', import.meta.url).href;", `const appUrl = '${appUrl}';`)
  .replace("const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;", `const chemistryUrl = '${chemistryUrl}';`)
  .replace("const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;", `const bondingUrl = '${bondingUrl}';`);

// Extend v8.6's final-engine patch instead of executing engine code in this loader.
const patchDecl = 'const patch = `';
if (!loader.includes(patchDecl)) throw new Error('v8.6 patch declaration not found');
loader = loader.replace(patchDecl, 'let patch = `');

const extraPatch = String.raw`

// v8.8 structure-first interaction and geometry model.

// No arbitrary floating atoms. Only the first atom can be seeded freely;
// every later palette press must attach to a selected atom with capacity.
code = code.replace(
  /function addElement\(symbol\) \{[\s\S]*?\n\}\n\nfunction addFreeAtom/,
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
  if(!selected){pulse('結合先の原子を先に選択してください');return;}
  if(freeCapacity(selected.id)<=0){pulse(selected.element+' には追加できる結合余地がありません');return;}
  attachToSelected(symbol,selected.id);
}

function addFreeAtom\`
);

code = code.replace(
  /function addFreeAtom\(symbol\) \{[\s\S]*?\n\}\n\nfunction attachToSelected/,
  \`function addFreeAtom(symbol) {
  if(molecule.atoms.length===0){
    const atom=molecule.addAtom(symbol);
    placements.set(atom.id,{position:controls.target.clone()});
    selectedAtomId=atom.id;
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

// Geometry helpers. Carbon uses explicit sp / sp2 / sp3 constraints inferred
// from its current bond orders. Other atoms retain the VSEPR heuristic.
const geometryHelpers = \`
function centerGeometry(centerId){
  const atom=atomById(centerId);if(!atom)return{angle:Math.PI*2/3,targetCos:-.5,kind:'generic'};
  const ns=molecule.neighbors(centerId);
  const orders=ns.map(n=>bondBetween(centerId,n.atomId)?.order??1);
  const maxOrder=orders.length?Math.max(...orders):0;
  const doubleCount=orders.filter(o=>o===2).length;
  if(atom.element==='C'){
    if(maxOrder>=3||doubleCount>=2)return{angle:Math.PI,targetCos:-1,kind:'sp'};
    if(maxOrder===2)return{angle:Math.PI*2/3,targetCos:-.5,kind:'sp2'};
    return{angle:THREE.MathUtils.degToRad(109.47),targetCos:-1/3,kind:'sp3'};
  }
  const used=molecule.bondOrderForAtom(centerId);
  const deg=idealBondAngleDeg(atom.element,used,ns.length);
  const angle=THREE.MathUtils.degToRad(deg);
  return{angle,targetCos:Math.cos(angle),kind:'vsepr'};
}

function relaxCenterGeometry(centerId,strength=.12){
  const center=placements.get(centerId)?.position;if(!center)return;
  const ids=molecule.neighbors(centerId).map(n=>n.atomId);
  if(ids.length<2)return;
  const g=centerGeometry(centerId);
  if(ids.length===2){enforceTwoNeighborAngle(center,ids[0],ids[1],g.angle);return;}
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
    const pi=placements.get(ids[i])?.position,pj=placements.get(ids[j])?.position;if(!pi||!pj)continue;
    const vi=pi.clone().sub(center),vj=pj.clone().sub(center);const li=vi.length(),lj=vj.length();if(li<.001||lj<.001)continue;
    vi.normalize();vj.normalize();const dot=THREE.MathUtils.clamp(vi.dot(vj),-1,1);const err=dot-g.targetCos;if(Math.abs(err)<.003)continue;
    const ti=vj.clone().sub(vi.clone().multiplyScalar(dot));
    const tj=vi.clone().sub(vj.clone().multiplyScalar(dot));
    if(ti.lengthSq()>1e-8){const next=vi.clone().add(ti.normalize().multiplyScalar(-err*strength)).normalize();pi.lerp(center.clone().add(next.multiplyScalar(li)),.48);}
    if(tj.lengthSq()>1e-8){const next=vj.clone().add(tj.normalize().multiplyScalar(-err*strength)).normalize();pj.lerp(center.clone().add(next.multiplyScalar(lj)),.48);}
  }
}

function rotateIdsAroundAxis(ids,origin,axis,angle){
  if(!Number.isFinite(angle)||Math.abs(angle)<1e-6)return;
  const q=new THREE.Quaternion().setFromAxisAngle(axis,angle);
  for(const id of ids){const p=placements.get(id)?.position;if(p)p.sub(origin).applyQuaternion(q).add(origin);}
}

function enforceMultipleBondPlanarity(bond,strength=.42){
  if(bond.order!==2)return;
  const aAtom=atomById(bond.a),bAtom=atomById(bond.b);
  // Strong planar locking is applied to the common organic sp2 case.
  if(aAtom?.element!=='C'&&bAtom?.element!=='C')return;
  const pa=placements.get(bond.a)?.position,pb=placements.get(bond.b)?.position;if(!pa||!pb)return;
  const aSubs=molecule.neighbors(bond.a).map(n=>n.atomId).filter(id=>id!==bond.b);
  const bSubs=molecule.neighbors(bond.b).map(n=>n.atomId).filter(id=>id!==bond.a);
  if(!aSubs.length||!bSubs.length)return;
  const axis=pb.clone().sub(pa).normalize();
  let va=placements.get(aSubs[0])?.position.clone().sub(pa);let vb=placements.get(bSubs[0])?.position.clone().sub(pb);if(!va||!vb)return;
  va.addScaledVector(axis,-va.dot(axis));vb.addScaledVector(axis,-vb.dot(axis));if(va.lengthSq()<1e-8||vb.lengthSq()<1e-8)return;va.normalize();vb.normalize();
  const signed=(from,to)=>Math.atan2(axis.dot(new THREE.Vector3().crossVectors(from,to)),THREE.MathUtils.clamp(from.dot(to),-1,1));
  const a1=signed(vb,va),a2=signed(vb,va.clone().negate());
  const correction=Math.abs(a1)<=Math.abs(a2)?a1:a2;
  const sides=cutSides(bond.a,bond.b);if(!sides)return;
  const moving=[...sides.bSide];
  rotateIdsAroundAxis(moving,pb,axis,correction*strength);
}

function structureDragPlan(atomId){
  const neighbors=molecule.neighbors(atomId).map(n=>n.atomId);if(!neighbors.length)return null;
  let best=null;
  for(const pivotId of neighbors){
    const bond=bondBetween(atomId,pivotId);if(!bond)continue;
    const sides=cutSides(atomId,pivotId);if(!sides)continue;
    const side=sides.aSide.has(atomId)?sides.aSide:sides.bSide;
    if(!best||side.size<best.movingIds.length)best={pivotId,movingIds:[...side],bondOrder:bond.order};
  }
  return best;
}

function rotateStructureBranch(state,dx,dy){
  const pivot=placements.get(state.pivotId)?.position,anchor=placements.get(state.atomId)?.position;if(!pivot||!anchor)return;
  const oldDir=anchor.clone().sub(pivot);if(oldDir.lengthSq()<1e-8)return;
  const right=cameraRight().normalize(),up=cameraUp().normalize();
  const qYaw=new THREE.Quaternion().setFromAxisAngle(up,-dx*.0095),qPitch=new THREE.Quaternion().setFromAxisAngle(right,-dy*.0095);
  const newDir=oldDir.clone().applyQuaternion(qYaw).applyQuaternion(qPitch).normalize();
  const q=new THREE.Quaternion().setFromUnitVectors(oldDir.clone().normalize(),newDir);
  for(const id of state.movingIds){const p=placements.get(id)?.position;if(p)p.sub(pivot).applyQuaternion(q).add(pivot);}
}
\`;
code = code.replace('function beginTwoFingerGesture() {', geometryHelpers+'\\nfunction beginTwoFingerGesture() {');

// Replace the weak angle-only relaxation with bond length + hybridization
// constraints + explicit C=C planarity. This is still a pedagogical classical
// geometry solver, not a quantum/force-field calculation.
code = code.replace(
  /function settleMolecule\(iterations=60\)\{[\s\S]*?\}\nfunction enforceTwoNeighborAngle/,
  \`function settleMolecule(iterations=60){
  const passes=Math.max(iterations,36);
  for(let step=0;step<passes;step++){
    for(const bond of molecule.bonds){
      const pa=placements.get(bond.a)?.position,pb=placements.get(bond.b)?.position;if(!pa||!pb)continue;
      const delta=pb.clone().sub(pa),dist=Math.max(.001,delta.length()),target=bondLengthFor(bond.a,bond.b,bond.order),corr=delta.normalize().multiplyScalar((dist-target)*.24);
      pa.add(corr.clone().multiplyScalar(.5));pb.sub(corr.clone().multiplyScalar(.5));
    }
    for(const center of molecule.atoms)relaxCenterGeometry(center.id,step<passes*.65?.16:.09);
    for(const bond of molecule.bonds)if(bond.order===2)enforceMultipleBondPlanarity(bond,step<passes*.7?.48:.28);
  }
}
function enforceTwoNeighborAngle\`
);

// Atom drag edits local structure, never translates the whole molecule.
code = code.replace(
  /function onPointerDown\(e\) \{[\s\S]*?\n\}\n\nfunction beginTwoFingerGesture/,
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
    bondHoldTimer=setTimeout(()=>{if(!dragState||dragState.mode!=='bond-hold'||dragState.key!==key||dragState.moved)return;dragState.holding=true;damageBond(key);bondHoldInterval=setInterval(()=>damageBond(key),300);pulse('長押し中 · 結合がほどけています');},520);
    controls.enabled=false;capture(e);return;
  }
  const electronHit=hits.find(h=>h.object.userData.electronAtomId!==undefined);
  if(electronHit){electronDrag={atomId:electronHit.object.userData.electronAtomId,current:electronHit.point.clone()};selectedAtomId=electronDrag.atomId;controls.enabled=false;capture(e);refresh();return;}
  const atomHit=hits.find(h=>h.object.userData.atomCore);
  if(!atomHit){selectedAtomId=null;activeTorsionKey=null;controls.enabled=true;refresh();return;}
  const atomId=atomHit.object.userData.atomId;selectedAtomId=atomId;
  if(activeTorsionKey){
    const[a,b]=activeTorsionKey.split(':').map(Number),bond=bondBetween(a,b),sides=bond&&isRotatableBond(bond)?cutSides(a,b):null;
    if(sides){const inA=sides.aSide.has(atomId),inB=sides.bSide.has(atomId);if(inA||inB){dragState={mode:'torsion-axis',atomId,a,b,movingIds:[...(inA?sides.aSide:sides.bSide)],startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()};controls.enabled=false;capture(e);refresh();return;}}else activeTorsionKey=null;
  }
  const plan=structureDragPlan(atomId);
  dragState=plan?{mode:'structure',atomId,pivotId:plan.pivotId,movingIds:plan.movingIds,bondOrder:plan.bondOrder,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,downAt:performance.now()}:{mode:'select-only',atomId,startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
  controls.enabled=false;capture(e);refresh();
}

function beginTwoFingerGesture\`
);

code = code.replace(
  /function onPointerMove\(e\) \{[\s\S]*?\n\}\n\nfunction onPointerUp/,
  \`function onPointerMove(e) {
  const ps=activePointers.get(e.pointerId);if(ps){ps.x=e.clientX;ps.y=e.clientY;}
  markInteraction();if(activePointers.size===2){updateTwoFingerGesture();return;}if(activePointers.size>1)return;
  if(electronDrag){const p=rayToPlaneThrough(e,placements.get(electronDrag.atomId)?.position??new THREE.Vector3());if(p)electronDrag.current.copy(p);hoveredSnap=findElectronTarget(electronDrag.atomId,electronDrag.current);renderInteraction();return;}
  if(!dragState)return;dragState.moved ||= Math.hypot(e.clientX-dragState.startX,e.clientY-dragState.startY)>7;
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
  /function onPointerUp\(e\) \{[\s\S]*?\n\}\nfunction onPointerCancel/,
  \`function onPointerUp(e) {
  markInteraction();const before=activePointers.size,ps=activePointers.get(e.pointerId);activePointers.delete(e.pointerId);
  if(before>=2){if(activePointers.size<2)gestureState=null;controls.enabled=true;return;}
  if(electronDrag){const target=hoveredSnap??findElectronTarget(electronDrag.atomId,electronDrag.current);if(target)formBond(electronDrag.atomId,target.atomId,true);electronDrag=null;hoveredSnap=null;controls.enabled=true;release(e);settleMolecule(70);refresh();return;}
  if(!dragState){controls.enabled=true;return;}
  const state=dragState,isTap=!state.moved&&ps&&performance.now()-ps.downAt<360;
  if(state.mode==='bond-hold'){
    clearTimeout(bondHoldTimer);clearInterval(bondHoldInterval);bondHoldTimer=null;bondHoldInterval=null;
    if(isTap&&!state.holding){const now=performance.now(),prev=bondTapState.get(state.key);const[a,b]=state.key.split(':').map(Number),bond=bondBetween(a,b);if(prev&&now-prev<420&&bond&&isRotatableBond(bond)){activeTorsionKey=activeTorsionKey===state.key?null:state.key;bondTapState.clear();pulse(activeTorsionKey?'回転軸を固定 · 片側の原子をドラッグ':'回転軸を解除');if(navigator.vibrate)navigator.vibrate(activeTorsionKey?[10,16,18]:10);}else bondTapState.set(state.key,now);}
  }else if(state.mode==='torsion-axis'){
    if(isTap)handleAtomTap(state.atomId);else settleMolecule(42);
  }else if(state.mode==='structure'){
    if(isTap)handleAtomTap(state.atomId);else{settleMolecule(80);pulse('立体構造を安定形へ整えました');}
  }else if(state.mode==='select-only')handleAtomTap(state.atomId);
  dragState=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();
}
function onPointerCancel\`
);

// Any normal attachment should immediately relax into the new hybridization-
// aware geometry, while preserving the user's explicitly chosen bond order.
code = code.replace('molecule.setBond(centerId, atom.id, 1);\\n  settleMolecule(78);','molecule.setBond(centerId, atom.id, 1);\\n  settleMolecule(110);');
`;

const insertionMarker = 'const insertionPoint = "const blob = new Blob([code], { type: \'text/javascript\' });";';
if (!loader.includes(insertionMarker)) throw new Error('v8.6 insertion marker not found');
loader = loader.replace(insertionMarker, `patch += ${JSON.stringify(extraPatch)};\n\n${insertionMarker}`);

const blob = new Blob([loader], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
