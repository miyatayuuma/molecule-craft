from pathlib import Path


def replace(path, old, new, count=1):
    p = Path(path)
    text = p.read_text()
    actual = text.count(old)
    if actual != count:
        raise SystemExit(f"{path}: expected {count} matches, found {actual}: {old[:80]!r}")
    p.write_text(text.replace(old, new, count))


replace(
    "src/app.js",
    "import { createTearGesture, findTearCandidate, projectedTearPull } from './craft-tearoff.js?v=1';\n",
    "import { createTearGesture, findTearCandidate, projectedTearPull } from './craft-tearoff.js?v=1';\nimport { captureDetachedFragment, createDetachedDrag } from './craft-detached-drag.js?v=1';\n",
)
replace(
    "src/app.js",
    "const interactionOverlay=new THREE.Group();scene.add(interactionOverlay);\n",
    "const interactionOverlay=new THREE.Group();scene.add(interactionOverlay);\nconst detachedOverlay=new THREE.Group();scene.add(detachedOverlay);\n",
)
replace(
    "src/app.js",
    "  const remember=recordHistory&&molecule.atoms.length>0;if(remember)craftHistory.begin();else craftHistory.cancel();\n  craftWorkspace.clear();if(clearTarget)craftTargetId=null;workspaceView.clear();selectAtom(null);dragState=null;electronReturn=null;hoverElectron=null;\n",
    "  const remember=recordHistory&&molecule.atoms.length>0;if(remember)craftHistory.begin();else craftHistory.cancel();\n  cleanupDetachedTear(dragState);craftWorkspace.clear();if(clearTarget)craftTargetId=null;workspaceView.clear();selectAtom(null);dragState=null;electronReturn=null;hoverElectron=null;\n",
)
replace(
    "src/app.js",
    "  const state=dragState;if(!state?.moved||state.mode==='tear-complete'||state.atomId==null||!state.homeWorld||!state.targetWorld||!state.tearGesture)return false;\n",
    "  const state=dragState;if(!state?.moved||state.mode==='tear-detached'||state.atomId==null||!state.homeWorld||!state.targetWorld||!state.tearGesture)return false;\n",
)
old = """function performTearOff(state,candidate){
  if(!candidate||state.mode==='tear-complete')return false;
  try{conformationEngine.release();}catch{}
  const removed=new Set(candidate.grabFragment);craftWorkspace.removeAtoms(removed);
  for(const id of removed){protectedUntil.delete(id);unresolvedAtoms.delete(id);debrisOpacity.delete(id);fadeTargets.delete(id);}
  const nextSelected=removed.has(selectedAtomId)?candidate.bodySideId:selectedAtomId;state.mode='tear-complete';state.tearCandidate=null;state.tearFeedback=0;state.tearProgress=1;
  protectedUntil.set(candidate.bodySideId,performance.now()+DEBRIS_POLICY.protectionMs);topologyChanged();selectAtom(atomById(nextSelected)?nextSelected:candidate.bodySideId);workspaceView.geometryChanged();craftHistory.commit();
  vibrateFeedback(30,state.pointerType);ensureMoleculeMeshes();updateMoleculeTransforms();refreshInfo(true);pulse('小片をBASE STOCKへ戻しました');return true;
}
"""
new = """function createDetachedTearVisual(snapshot){
  const group=new THREE.Group(),offsets=new Map(snapshot.atoms.map(atom=>[atom.id,new THREE.Vector3(atom.offset.x,atom.offset.y,atom.offset.z)]));
  for(const atom of snapshot.atoms){
    const cfg=ELEMENTS[atom.element],mesh=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.04,30,22),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.24,metalness:0}));
    mesh.position.copy(offsets.get(atom.id));group.add(mesh);
  }
  for(const bond of snapshot.bonds){
    const a=offsets.get(bond.a),b=offsets.get(bond.b);if(!a||!b)continue;
    const order=Math.max(1,Math.min(3,bond.order??1)),lineOffsets=order===1?[0]:order===2?[-.09,.09]:[-.16,0,.16],baseColor=order===1?0x94a3b8:order===2?0xfbbf24:0xf472b6,direction=b.clone().sub(a).normalize(),side=perpendicular(direction);
    for(const offset of lineOffsets){
      const mesh=unitCylinder(order===1?.022:order===2?.026:.028,baseColor,1),shift=side.clone().multiplyScalar(offset);
      if(order>1){mesh.material.emissive=new THREE.Color(baseColor);mesh.material.emissiveIntensity=order===2?.32:.44;}
      placeUnitCylinder(mesh,a.clone().add(shift),b.clone().add(shift),1);group.add(mesh);
    }
  }
  group.position.set(snapshot.anchor.x,snapshot.anchor.y,snapshot.anchor.z);detachedOverlay.add(group);return group;
}
function updateDetachedTearVisual(state){
  const detached=state?.detachedTear;if(!detached?.drag?.active||!state.targetWorld)return false;
  const anchor=detached.drag.update(state.targetWorld);if(!anchor)return false;detached.visual.position.set(anchor.x,anchor.y,anchor.z);return true;
}
function cleanupDetachedTear(state=dragState){
  const detached=state?.detachedTear;if(!detached)return false;
  detached.drag?.clear?.();if(detached.visual){detachedOverlay.remove(detached.visual);disposeObject(detached.visual);}state.detachedTear=null;return true;
}
function performTearOff(state,candidate){
  if(!candidate||state.mode==='tear-detached')return false;
  try{conformationEngine.release();}catch{}
  const snapshot=captureDetachedFragment(molecule,candidate,{positionFor:pos,pointerWorld:state.targetWorld});if(!snapshot)return false;
  const removed=new Set(candidate.grabFragment);craftWorkspace.removeAtoms(removed);
  for(const id of removed){protectedUntil.delete(id);unresolvedAtoms.delete(id);debrisOpacity.delete(id);fadeTargets.delete(id);}
  const nextSelected=removed.has(selectedAtomId)?candidate.bodySideId:selectedAtomId;state.mode='tear-detached';state.detachedTear={drag:createDetachedDrag(snapshot),visual:createDetachedTearVisual(snapshot)};state.tearCandidate=null;state.tearFeedback=0;state.tearProgress=1;
  protectedUntil.set(candidate.bodySideId,performance.now()+DEBRIS_POLICY.protectionMs);topologyChanged();selectAtom(atomById(nextSelected)?nextSelected:candidate.bodySideId);workspaceView.geometryChanged();craftHistory.commit();
  vibrateFeedback(30,state.pointerType);ensureMoleculeMeshes();updateMoleculeTransforms();refreshInfo(true);pulse('小片をBASE STOCKへ戻しました');return true;
}
"""
replace("src/app.js", old, new)
replace(
    "src/app.js",
    "  if(dragState.atomId!=null&&dragState.homeWorld&&dragState.planeNormal){dragState.targetWorld=pointerWorldOnPlane(e,dragState.homeWorld,dragState.planeNormal);advanceTearDrag();if(dragState.mode==='tear-complete')return;}\n",
    "  if(dragState.atomId!=null&&dragState.homeWorld&&dragState.planeNormal){dragState.targetWorld=pointerWorldOnPlane(e,dragState.homeWorld,dragState.planeNormal);if(dragState.mode==='tear-detached'){updateDetachedTearVisual(dragState);return;}advanceTearDrag();if(dragState.mode==='tear-detached')return;}\n",
)
replace(
    "src/app.js",
    "  if(state.mode==='tear-complete'){\n    craftHistory.cancel();\n",
    "  if(state.mode==='tear-detached'){\n    cleanupDetachedTear(state);craftHistory.cancel();\n",
)
replace(
    "src/app.js",
    "  lastBackgroundTap=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;\n  try{conformationEngine.release();}catch{}\n  if(craftHistory.pending){\n",
    "  lastBackgroundTap=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;\n  try{conformationEngine.release();}catch{}\n  cleanupDetachedTear(dragState);\n  if(craftHistory.pending){\n",
)
replace(
    "src/app.js",
    "  for(const id of activePointers.keys())try{renderer.domElement.releasePointerCapture(id);}catch{}\n  activePointers.clear();dragState=null;multiGesture=null;electronReturn=null;hoverElectron=null;frameTransition=null;lastBackgroundTap=null;\n  workspaceView.clear();const restored=restoreWorkspace(snapshot.workspace,{THREE,molecule,placements,camera,cameraTarget});\n",
    "  for(const id of activePointers.keys())try{renderer.domElement.releasePointerCapture(id);}catch{}\n  cleanupDetachedTear(dragState);activePointers.clear();dragState=null;multiGesture=null;electronReturn=null;hoverElectron=null;frameTransition=null;lastBackgroundTap=null;\n  workspaceView.clear();const restored=restoreWorkspace(snapshot.workspace,{THREE,molecule,placements,camera,cameraTarget});\n",
)
replace(
    "src/app.js",
    "  try{conformationEngine.release();}catch{}\n  stopRelaxation();frameTransition=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;\n",
    "  try{conformationEngine.release();}catch{}\n  cleanupDetachedTear(dragState);stopRelaxation();frameTransition=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;\n",
)
replace(
    "src/app.js",
    "    if(dragState?.moved&&dragState.atomId!=null&&dragState.mode!=='tear-complete')advanceTearDrag(now);\n",
    "    if(dragState?.moved&&dragState.atomId!=null&&dragState.mode!=='tear-detached')advanceTearDrag(now);\n",
)
replace(
    "docs/architecture.md",
    "| 結合操作・branch tear-off | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js`, `src/craft-tearoff.js` | `bond-state.test.mjs`, `craft-tearoff.test.mjs`, `mobile-ui-check.mjs` |",
    "| 結合操作・branch tear-off | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js`, `src/craft-tearoff.js`, `src/craft-detached-drag.js` | `bond-state.test.mjs`, `craft-tearoff.test.mjs`, `craft-detached-drag.test.mjs`, `mobile-ui-check.mjs` |",
)
replace(
    "docs/architecture.md",
    "| branch tear-off候補・張力hold/hysteresis | `src/craft-tearoff.js`（純粋graph/gesture logic）、`src/app.js`（3D drag統合とfeedback） |",
    "| branch tear-off候補・張力hold/hysteresis・切断後drag | `src/craft-tearoff.js`（純粋graph/gesture logic）、`src/craft-detached-drag.js`（切断時snapshot / pointer offset）、`src/app.js`（model removalとreleaseまでの非interactive presentation） |",
)
replace(
    ".github/workflows/repository-validation.yml",
    "          node tests/craft-history.test.mjs\n          node tests/craft-input-recovery.test.mjs\n",
    "          node tests/craft-history.test.mjs\n          node tests/craft-tearoff.test.mjs\n          node --test tests/craft-detached-drag.test.mjs\n          node tests/craft-input-recovery.test.mjs\n",
)
