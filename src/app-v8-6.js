// v8.6: preserve v8.5 visuals and refine electron placement / bond interactions.
const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url);
const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;
const appUrl = new URL('./app-v8.js', import.meta.url).href;
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(safeUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8.4-safe: ${response.status}`);
let loader = await response.text();

loader = loader
  .replace("const wrapperUrl = new URL('./app-v8-4.js', import.meta.url);", `const wrapperUrl = new URL('${wrapperUrl}');`)
  .replace("const appUrl = new URL('./app-v8.js', import.meta.url).href;", `const appUrl = '${appUrl}';`)
  .replace("const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;", `const chemistryUrl = '${chemistryUrl}';`)
  .replace("const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;", `const bondingUrl = '${bondingUrl}';`);

const patch = `
// v8.6 final-engine patch.
code = code
  // Keep selected-atom attachment local: one new single bond only. Do not let
  // the global bond-order optimiser consume other unpaired electrons.
  .replace(
    "molecule.setBond(centerId, atom.id, 1);\\n  optimizeBondOrders(molecule, [...connectedComponent(centerId)]);\\n  settleMolecule(78);",
    "molecule.setBond(centerId, atom.id, 1);\\n  settleMolecule(78);"
  )
  // Smaller electron glyphs.
  .replace("new THREE.SphereGeometry(selected?.115:.09,18,14)", "new THREE.SphereGeometry(selected?.064:.050,16,12)")
  .replace("new THREE.SphereGeometry(.047,10,8)", "new THREE.SphereGeometry(.033,10,8)")
  .replace(/new THREE\\.SphereGeometry\\(\\.046,12,10\\)/g, "new THREE.SphereGeometry(.032,10,8)")
  .replace("multiplyScalar(.055)", "multiplyScalar(.040)")
  .replace("multiplyScalar(.038)", "multiplyScalar(.030)")
  // Long-press state lives alongside the existing double-tap state.
  .replace("const bondTapState = new Map();", "const bondTapState = new Map();\\nlet bondHoldTimer = null;\\nlet bondHoldInterval = null;");

// Unpaired electrons sit exactly on the candidate attachment directions used
// when the next atom is added. Lone pairs keep their own visual directions.
code = code.replace(
  /function renderAtom\\(atom,flash\\)\\{[\\s\\S]*?\\nfunction addAtomCracks/,
  \`function renderAtom(atom,flash){
  const p=placements.get(atom.id);if(!p)return;
  const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId,damage=atomDamage.get(atom.id)?.damage??0;
  const selectedColor=selected?0x22d3ee:cfg.color;
  const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.06*(1-damage*.10),32,24),new THREE.MeshStandardMaterial({color:selectedColor,roughness:.22,metalness:.03,transparent:damage>0,opacity:1-damage*.58,emissive:damage>.05?0x7f1d1d:flash?0x38bdf8:selected?0x0891b2:0,emissiveIntensity:damage>.05?.25+damage*.85:flash?.72:selected?1.05:0}));
  core.position.copy(p.position);core.userData={atomCore:true,atomId:atom.id};moleculeGroup.add(core);
  if(damage>.04)addAtomCracks(p.position,cfg.radius*1.08,damage);
  const used=molecule.bondOrderForAtom(atom.id),singles=unpairedElectronCount(atom.element,used),lps=lonePairCount(atom.element,used),shellR=valenceShellRadius(atom.element,cfg.radius*1.02);
  const openDirs=attachmentDirections(atom.id,Math.max(1,singles));
  for(let i=0;i<singles;i++)addElectron(atom.id,p.position,openDirs[i%openDirs.length],shellR,selected);
  const loneDirs=electronDirections(Math.max(1,lps+molecule.neighbors(atom.id).length+singles));
  for(let i=0;i<lps;i++)addLonePair(p.position,loneDirs[(singles+i)%loneDirs.length],shellR);
}
function addAtomCracks\`
);

// Bond interaction: quick tap does not damage. Double tap selects torsion axis.
// Holding for 520 ms starts progressive bond weakening until release.
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
  const component=[...connectedComponent(atomId)];
  dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()).normalize(),placements.get(atomId).position);
  const world=rayToPlane(e);if(!world)return;
  dragState={mode:'translate',atomId,component,startWorld:world.clone(),starts:new Map(component.map(id=>[id,placements.get(id).position.clone()])),startX:e.clientX,startY:e.clientY,moved:false,downAt:performance.now()};
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
    rotateBranchAroundBond(dragState.a,dragState.b,dragState.movingIds,THREE.MathUtils.clamp((dx-dy*.35)*.012,-.12,.12));hoveredSnap=findAutoBondCandidate(dragState.movingIds,true);renderMolecule();return;
  }
  if(!dragState.moved)return;const world=rayToPlane(e);if(!world)return;const delta=world.clone().sub(dragState.startWorld);
  for(const id of dragState.component)placements.get(id).position.copy(dragState.starts.get(id)).add(delta);
  hoveredSnap=findAutoBondCandidate(dragState.component,false);renderMolecule();
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
    if(!isTap){const candidate=hoveredSnap??findAutoBondCandidate(state.movingIds,true);if(candidate)formBond(candidate.a,candidate.b,false);settleMolecule(24);}else handleAtomTap(state.atomId);
  }else if(isTap)handleAtomTap(state.atomId);else{const candidate=hoveredSnap??findAutoBondCandidate(state.component,false);if(candidate)formBond(candidate.a,candidate.b,false);}
  dragState=null;hoveredSnap=null;controls.enabled=true;release(e);refresh();
}
function onPointerCancel\`
);

// v8.5 multiple-bond readability retained.
code = code
  .replace("const offsets=bond.order===1?[0]:bond.order===2?[-.06,.06]:[-.10,0,.10];", "const offsets=bond.order===1?[0]:bond.order===2?[-.09,.09]:[-.16,0,.16];")
  .replace("const baseColor=bond.order===1?0x94a3b8:bond.order===2?0xf59e0b:0xa78bfa;", "const baseColor=bond.order===1?0x94a3b8:bond.order===2?0xfbbf24:0xf472b6;")
  .replace("const shift=side.clone().multiplyScalar(offset),radius=(active?.036:.028)*(1-damage*.62),opacity=1-damage*.52;", "const shift=side.clone().multiplyScalar(offset),baseRadius=active?.034:(bond.order===1?.021:bond.order===2?.025:.027),radius=baseRadius*(1-damage*.62),opacity=1-damage*.52;")
  .replace("if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.009,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}", "if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.009,radius),color,opacity);mesh.userData={bondKey:key};if(bond.order>1&&!active){mesh.material.emissive=new THREE.Color(color);mesh.material.emissiveIntensity=bond.order===2?.34:.46;}moleculeGroup.add(mesh);}")
  .replace("const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*.095)", "const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const pairSpacing=bond.order===1?.095:bond.order===2?.14:.16;const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*pairSpacing)");
`;

const insertionPoint = "const blob = new Blob([code], { type: 'text/javascript' });";
if (!loader.includes(insertionPoint)) throw new Error('v8.4-safe loader signature not found');
loader = loader.replace(insertionPoint, `${patch}\n${insertionPoint}`);

const blob = new Blob([loader], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
