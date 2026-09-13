import fs from 'node:fs';

function replaceOnce(text,from,to,label){
  if(!text.includes(from))throw new Error(`Missing patch anchor: ${label}`);
  return text.replace(from,to);
}

let app=fs.readFileSync('src/app.js','utf8');
app=replaceOnce(app,
"import { craftHintElectronKeys, nextCraftBondHint } from './craft-target-hint.js?v=1';\n",
"import { craftHintElectronKeys, nextCraftBondHint } from './craft-target-hint.js?v=1';\nimport { createTearGesture, findTearCandidate, projectedTearPull } from './craft-tearoff.js?v=1';\n",
'import');
app=replaceOnce(app,
"const ELECTRON_SNAP_PX=58;\n",
"const ELECTRON_SNAP_PX=58;\nconst TEAR_WARNING_COLOR=new THREE.Color(0xfb7185);\n",
'warning color');
app=replaceOnce(app,
`function beginAtomDrag(e,atomId){
  selectAtom(atomId);
  const plan=atomEditPlan(atomId),home=pos(atomId)?.clone();showTorsionGuide(plan);
  if(['conformation','torsion','rigid-body'].includes(plan.mode))conformationEngine.beginDrag(atomId,{preparedPlan:plan});
  dragState={...plan,homeWorld:home,targetWorld:home?.clone(),planeNormal:cameraDirection(),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,
    lastPhysicsAt:performance.now(),moved:false,pointerType:e.pointerType};
  if(plan.mode==='atom-locked')vibrateFeedback(22,e.pointerType);
  capture(e);refresh();
}
`,
`function beginAtomDrag(e,atomId){
  selectAtom(atomId);
  const plan=atomEditPlan(atomId),home=pos(atomId)?.clone();showTorsionGuide(plan);
  if(['conformation','torsion','rigid-body'].includes(plan.mode))conformationEngine.beginDrag(atomId,{preparedPlan:plan});
  dragState={...plan,homeWorld:home,targetWorld:home?.clone(),planeNormal:cameraDirection(),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,
    lastPhysicsAt:performance.now(),moved:false,pointerType:e.pointerType,tearGesture:createTearGesture(),tearCandidate:null,tearFeedback:0,tearProgress:0};
  if(plan.mode==='atom-locked')vibrateFeedback(22,e.pointerType);
  capture(e);refresh();
}
`,
'begin atom drag');
app=replaceOnce(app,
`function advanceConformationDrag(now=performance.now()){
  if(!dragState?.moved||!['conformation','rigid-body'].includes(dragState.mode)||!dragState.targetWorld)return;
  const deltaSeconds=Math.max(1/240,Math.min(1/20,(now-dragState.lastPhysicsAt)/1000||1/60));dragState.lastPhysicsAt=now;
  const result=conformationEngine.updateDrag(dragState.targetWorld,{deltaSeconds});dragState.lastResult=result;
  if(result.accepted)workspaceView.geometryChanged();updateMoleculeTransforms();
}
`,
`function advanceConformationDrag(now=performance.now()){
  if(!dragState?.moved||!['conformation','rigid-body'].includes(dragState.mode)||!dragState.targetWorld)return;
  const deltaSeconds=Math.max(1/240,Math.min(1/20,(now-dragState.lastPhysicsAt)/1000||1/60));dragState.lastPhysicsAt=now;
  const result=conformationEngine.updateDrag(dragState.targetWorld,{deltaSeconds});dragState.lastResult=result;
  if(result.accepted)workspaceView.geometryChanged();updateMoleculeTransforms();
}
function advanceTearDrag(now=performance.now()){
  const state=dragState;if(!state?.moved||state.mode==='tear-complete'||state.atomId==null||!state.homeWorld||!state.targetWorld||!state.tearGesture)return false;
  const pullVector=state.targetWorld.clone().sub(state.homeWorld),candidate=findTearCandidate(molecule,state.atomId,{positionFor:pos,pullVector}),tension=projectedTearPull(candidate,pullVector),previous=state.tearFeedback??0;
  const result=state.tearGesture.update({candidate,tension,now});state.tearCandidate=result.candidate;state.tearFeedback=Math.max(result.feedback,result.progress*.85);state.tearProgress=result.progress;
  if(result.armedJustNow)vibrateFeedback(12,state.pointerType);
  if(result.shouldTear)return performTearOff(state,result.candidate);
  if(Math.abs(previous-state.tearFeedback)>.01)updateMoleculeTransforms();return false;
}
function performTearOff(state,candidate){
  if(!candidate||state.mode==='tear-complete')return false;
  try{conformationEngine.release();}catch{}
  const removed=new Set(candidate.grabFragment);craftWorkspace.removeAtoms(removed);
  for(const id of removed){protectedUntil.delete(id);unresolvedAtoms.delete(id);debrisOpacity.delete(id);fadeTargets.delete(id);}
  const nextSelected=removed.has(selectedAtomId)?candidate.bodySideId:selectedAtomId;state.mode='tear-complete';state.tearCandidate=null;state.tearFeedback=0;state.tearProgress=1;
  protectedUntil.set(candidate.bodySideId,performance.now()+DEBRIS_POLICY.protectionMs);topologyChanged();selectAtom(atomById(nextSelected)?nextSelected:candidate.bodySideId);workspaceView.geometryChanged();craftHistory.commit();
  vibrateFeedback(30,state.pointerType);ensureMoleculeMeshes();updateMoleculeTransforms();refreshInfo(true);pulse('小片をBASE STOCKへ戻しました');return true;
}
`,
'tear runtime');
app=replaceOnce(app,
`  if(!dragState.moved)return;
  if(dragState.mode==='atom-locked'||dragState.mode==='axis-select')return;
  if(dragState.mode==='atom-translate'){
    const next=pointerWorldOnPlane(e,dragState.homeWorld,dragState.planeNormal);
    const delta=next.sub(pos(dragState.atomId));
`,
`  if(!dragState.moved)return;
  if(dragState.atomId!=null&&dragState.homeWorld&&dragState.planeNormal){dragState.targetWorld=pointerWorldOnPlane(e,dragState.homeWorld,dragState.planeNormal);advanceTearDrag();if(dragState.mode==='tear-complete')return;}
  if(dragState.mode==='atom-locked'||dragState.mode==='axis-select')return;
  if(dragState.mode==='atom-translate'){
    const next=dragState.targetWorld.clone();
    const delta=next.sub(pos(dragState.atomId));
`,
'pointer tear target');
app=replaceOnce(app,
`  if(state.mode==='bond'){
`,
`  if(state.mode==='tear-complete'){
    craftHistory.cancel();
  }else if(state.mode==='bond'){
`,
'pointer up tear');
app=replaceOnce(app,
`  bondVisuals.set(key,{bond,key,hit,lines,baseColor,transitionScale:1});
`,
`  bondVisuals.set(key,{bond,key,hit,lines,baseColor,baseEmissiveIntensity:order===1?0:order===2?.32:.44,transitionScale:1});
`,
'bond visual state');
app=replaceOnce(app,
`function updateBondVisual(visual){
  const a=pos(visual.bond.a),b=pos(visual.bond.b);if(!a||!b)return;
  const direction=b.clone().sub(a).normalize(),side=perpendicular(direction);
  placeUnitCylinder(visual.hit,a,b,1);
  for(const {mesh,offset} of visual.lines){
    const shift=side.clone().multiplyScalar(offset),left=a.clone().add(shift),right=b.clone().add(shift);
    placeUnitCylinder(mesh,left,right,visual.transitionScale);mesh.material.color.setHex(visual.baseColor);
  }
}
`,
`function updateBondVisual(visual){
  const a=pos(visual.bond.a),b=pos(visual.bond.b);if(!a||!b)return;
  const direction=b.clone().sub(a).normalize(),side=perpendicular(direction),tear=dragState?.tearCandidate?.key===visual.key?THREE.MathUtils.clamp(dragState.tearFeedback??0,0,1):0;
  placeUnitCylinder(visual.hit,a,b,1);
  for(const {mesh,offset} of visual.lines){
    const shift=side.clone().multiplyScalar(offset),left=a.clone().add(shift),right=b.clone().add(shift);
    placeUnitCylinder(mesh,left,right,visual.transitionScale);mesh.material.color.setHex(visual.baseColor).lerp(TEAR_WARNING_COLOR,tear);
    mesh.material.emissive.setHex(tear?0xfb7185:(visual.baseEmissiveIntensity?visual.baseColor:0));mesh.material.emissiveIntensity=visual.baseEmissiveIntensity+tear*1.6;mesh.scale.x=mesh.scale.z=1-.18*tear;
  }
}
`,
'bond warning feedback');
app=replaceOnce(app,
`    if(dragState?.moved&&['conformation','rigid-body'].includes(dragState.mode))advanceConformationDrag(now);
    updateStructureFrame(now);camera.lookAt(cameraTarget);camera.updateMatrixWorld();updateDebris(now);animateUnpairedElectrons(now);animateSelection(now);animateDebris();checkDiscovery(now);animationFault='';
`,
`    if(dragState?.moved&&['conformation','rigid-body'].includes(dragState.mode))advanceConformationDrag(now);
    if(dragState?.moved&&dragState.atomId!=null&&dragState.mode!=='tear-complete')advanceTearDrag(now);
    updateStructureFrame(now);camera.lookAt(cameraTarget);camera.updateMatrixWorld();updateDebris(now);animateUnpairedElectrons(now);animateSelection(now);animateDebris();checkDiscovery(now);animationFault='';
`,
'animation tear hold');
fs.writeFileSync('src/app.js',app);

let docs=fs.readFileSync('docs/architecture.md','utf8');
docs=replaceOnce(docs,
'| 結合操作 | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js` | `bond-state.test.mjs`, `mobile-ui-check.mjs` |',
'| 結合操作・branch tear-off | `src/app.js`, `src/bonding-model.js`, `src/electron-interaction.js`, `src/gesture-arbitration.js`, `src/craft-tearoff.js` | `bond-state.test.mjs`, `craft-tearoff.test.mjs`, `mobile-ui-check.mjs` |',
'architecture task map');
docs=replaceOnce(docs,
'| 電子／原子／結合のポインタ判定 | `src/electron-interaction.js`, `src/gesture-arbitration.js` |',
'| 電子／原子／結合のポインタ判定 | `src/electron-interaction.js`, `src/gesture-arbitration.js` |\n| branch tear-off候補・張力hold/hysteresis | `src/craft-tearoff.js`（純粋graph/gesture logic）、`src/app.js`（3D drag統合とfeedback） |',
'architecture craft map');
fs.writeFileSync('docs/architecture.md',docs);

let test=fs.readFileSync('tests/craft-tearoff.test.mjs','utf8');
test=replaceOnce(test,
`  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:300}).shouldTear,false);
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:450}).shouldTear,false);
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:600}).shouldTear,true,'sustained tension, not a one-frame spike, tears');
`,
`  let result;for(let now=250;now<=650;now+=50)result=gesture.update({candidate,tension:threshold*1.05,now});
  assert.equal(result.shouldTear,true,'sustained tension, not a one-frame spike, tears');
`,
'gesture timing test');
fs.writeFileSync('tests/craft-tearoff.test.mjs',test);
