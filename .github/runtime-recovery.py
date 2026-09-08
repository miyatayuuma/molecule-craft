from pathlib import Path

p=Path('index.html'); h=p.read_text()
if '<html lang="ja">' not in h: raise SystemExit('html root not found')
h=h.replace('<html lang="ja">','<html lang="ja" data-molecule-craft-shell="2">',1)
if './src/app.js?v=48' not in h or './src/pwa.js?v=33' not in h: raise SystemExit('expected runtime revisions not found')
h=h.replace('./src/app.js?v=48','./src/app.js?v=49',1).replace('./src/pwa.js?v=33','./src/pwa.js?v=34',1)
p.write_text(h)

p=Path('src/pwa.js'); s=p.read_text()
prefix="""const SHELL_API='2',shellApi=document.documentElement.dataset.moleculeCraftShell??'',shellRecoveryKey=`molecule-craft.shell-recovery.${SHELL_API}`;
let recoverShell=false;
if(shellApi!==SHELL_API){
  let attempted=false;try{attempted=sessionStorage.getItem(shellRecoveryKey)==='1';if(!attempted)sessionStorage.setItem(shellRecoveryKey,'1');}catch{}
  if(!attempted){recoverShell=true;location.replace(new URL('../',import.meta.url).href);}else console.error('Molecule Craft shell recovery stopped after one attempt.');
}else try{sessionStorage.removeItem(shellRecoveryKey);}catch{}
if(!recoverShell&&shellApi===SHELL_API){
"""
if "const SHELL_API='2'" in s: raise SystemExit('shell recovery already present')
s=prefix+s.rstrip()+"\n}\n"
p.write_text(s)

p=Path('src/app.js'); s=p.read_text()
global_anchor="const targetDeployments=new Map();let targetDeploymentTargetId=null;"
if global_anchor not in s: raise SystemExit('runtime globals anchor not found')
s=s.replace(global_anchor,global_anchor+"\nlet refreshInfoFault='',animationFault='';",1)
old_info="""function refreshInfo(keep=false){
  const targetAvailable={...resources.state.elements};for(const atom of molecule.atoms)targetAvailable[atom.element]=(targetAvailable[atom.element]??0)+1;
  const target=resources.record(craftTargetId);
  craftPanel.renderInfo({keep,veilUI,focus:focusedStructure(),structures,selected:atomById(selectedAtomId),molecule,target,targetParts:targetPartsFor(target),onPlaceTargetPart:placeTargetPart,targetDiscovered:resources.state.recipes.includes(craftTargetId),targetAvailable,onClearTarget:clearCraftTarget,unresolvedAtoms,stateFor,structureListDisabled:interactionLocked()||!!dragState||activePointers.size>0,cleanupAvailable:cleanupUndo.length>0,onSelectStructure:item=>{if(relaxation||bondTransition||frameTransition||dragState||activePointers.size)return;selectAtom(item.graph.atoms[0].id);lastBackgroundTap=null;gameShell.close();refresh();repairSavedGeometry();}});
}"""
new_info="""function refreshInfo(keep=false){
  try{
    const targetAvailable={...resources.state.elements};for(const atom of molecule.atoms)targetAvailable[atom.element]=(targetAvailable[atom.element]??0)+1;
    const target=resources.record(craftTargetId);
    craftPanel.renderInfo({keep,veilUI,focus:focusedStructure(),structures,selected:atomById(selectedAtomId),molecule,target,targetParts:targetPartsFor(target),onPlaceTargetPart:placeTargetPart,targetDiscovered:resources.state.recipes.includes(craftTargetId),targetAvailable,onClearTarget:clearCraftTarget,unresolvedAtoms,stateFor,structureListDisabled:interactionLocked()||!!dragState||activePointers.size>0,cleanupAvailable:cleanupUndo.length>0,onSelectStructure:item=>{if(relaxation||bondTransition||frameTransition||dragState||activePointers.size)return;selectAtom(item.graph.atoms[0].id);lastBackgroundTap=null;gameShell.close();refresh();repairSavedGeometry();}});
    refreshInfoFault='';return true;
  }catch(error){const detail=String(error?.stack??error);if(detail!==refreshInfoFault){refreshInfoFault=detail;console.error('Craft information refresh failed; 3D workspace remains active.',error);}return false;}
}"""
if old_info not in s: raise SystemExit('refreshInfo block not found')
s=s.replace(old_info,new_info,1)
old_start="  bindUI();refresh();resize();if(savedWorkspace)repairSavedGeometry();animate();"
new_start="""  bindUI();
  try{refresh();}catch(error){console.error('Initial craft refresh failed; continuing runtime startup.',error);}
  resize();if(savedWorkspace)try{repairSavedGeometry();}catch(error){console.error('Saved geometry repair failed; continuing with restored positions.',error);}animate();"""
if old_start not in s: raise SystemExit('startup chain not found')
s=s.replace(old_start,new_start,1)
old_anim="""function animate(now=performance.now()){
  requestAnimationFrame(animate);if(veilUI?.active||document.hidden||gameShell.isOpen()||collectionOpen)return;if(bondTransition)updateBondTransition(now);if(relaxation)updateRelaxation(now);
  if(dragState?.moved&&['conformation','rigid-body'].includes(dragState.mode))advanceConformationDrag(now);
  updateStructureFrame(now);
  camera.lookAt(cameraTarget);camera.updateMatrixWorld();updateDebris(now);animateUnpairedElectrons(now);animateSelection(now);animateDebris();checkDiscovery(now);renderer.render(scene,camera);if(now-lastSaveCheck>1000){lastSaveCheck=now;saveWorkspace();}
}"""
new_anim="""function animate(now=performance.now()){
  requestAnimationFrame(animate);if(veilUI?.active||document.hidden||gameShell.isOpen()||collectionOpen)return;
  try{
    if(bondTransition)updateBondTransition(now);if(relaxation)updateRelaxation(now);
    if(dragState?.moved&&['conformation','rigid-body'].includes(dragState.mode))advanceConformationDrag(now);
    updateStructureFrame(now);camera.lookAt(cameraTarget);camera.updateMatrixWorld();updateDebris(now);animateUnpairedElectrons(now);animateSelection(now);animateDebris();checkDiscovery(now);animationFault='';
  }catch(error){const detail=String(error?.stack??error);if(detail!==animationFault){animationFault=detail;console.error('Craft animation update failed; rendering the current scene.',error);}}
  try{renderer.render(scene,camera);}catch(error){const detail=String(error?.stack??error);if(detail!==animationFault){animationFault=detail;console.error('3D render failed.',error);}}
  if(now-lastSaveCheck>1000){lastSaveCheck=now;saveWorkspace();}
}"""
if old_anim not in s: raise SystemExit('animate block not found')
s=s.replace(old_anim,new_anim,1)
p.write_text(s)

p=Path('tests/source-contracts.test.mjs'); t=p.read_text()
t=t.replace('src/app.js?v=48','src/app.js?v=49').replace('src/pwa.js?v=33','src/pwa.js?v=34')
t=t.replace(r'app\.js\?v=48',r'app\.js\?v=49').replace(r'pwa\.js\?v=33',r'pwa\.js\?v=34')
marker='assert.match(craftPanel, /compactPartNotation/);'
if marker not in t: raise SystemExit('source contract marker not found')
t=t.replace(marker,marker+'\nassert.match(index, /data-molecule-craft-shell="2"/);\nassert.match(app, /Craft information refresh failed; 3D workspace remains active/);\nassert.match(app, /Initial craft refresh failed; continuing runtime startup/);',1)
p.write_text(t)

p=Path('tests/pwa.test.mjs'); t=p.read_text()
anchor="assert.match(pwaSource,/function activateWaitingUpdate/,'Waiting updates should have one guarded activation path');"
if anchor not in t: raise SystemExit('PWA test anchor not found')
addition=("\nassert.match(pwaSource,/SHELL_API='2'/,'PWA must declare the compatible HTML shell API');"
          "\nassert.match(pwaSource,/dataset\\.moleculeCraftShell/,'PWA must validate the DOM shell instead of module URL query identity');"
          "\nassert.match(pwaSource,/sessionStorage\\.getItem\\(shellRecoveryKey\\)/,'Shell recovery must be one-shot to prevent reload loops');"
          "\nassert.match(pwaSource,/location\\.replace\\(new URL\\('\\.\\.\\/',import\\.meta\\.url\\)\\.href\\)/,'A mixed shell must navigate to the current app root');\n")
t=t.replace(anchor,anchor+addition,1)
p.write_text(t)
