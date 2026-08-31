import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [index, app, chemistry, solver, electronInteraction, gestureArbitration, database] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app-v14.js?v=36', root), 'utf8'),
  readFile(new URL('src/chemistry.js', root), 'utf8'),
  readFile(new URL('src/structure-relaxation.js?v=31', root), 'utf8'),
  readFile(new URL('src/electron-interaction.js', root), 'utf8'),
  readFile(new URL('src/gesture-arbitration.js', root), 'utf8'),
  readFile(new URL('data/molecules.json', root), 'utf8').then(JSON.parse),
]);

assert.match(index, /<script type="module" src="\.\/src\/app-v14\.js\?v=36"><\/script>/);
assert.match(app, /from '\.\/structure-relaxation\.js\?v=31'/);
assert.match(app, /from '\.\/structure-motion\.js\?v=30'/);
assert.match(app, /from '\.\/structure-edit\.js\?v=32'/);
assert.match(app, /from '\.\/workspace-view\.js\?v=23'/);
assert.doesNotMatch(app, /stableFrames|maxDuration/);
assert.doesNotMatch(app, /pendingFrame|followDraggedBranch|function structurePlan|interruptRelaxation|panCamera/);
assert.doesNotMatch(index, /stop-relaxation/);
assert.match(app, /editRelaxationOptions\(molecule,state\)/);
assert.match(app, /activePointers.size&&dragState&&\(dragState.moved\|\|dragState.mode!=='molecule-rotate'\)/);
assert.equal((app.match(/if\(!activePointers.has\(e.pointerId\)\)return/g)??[]).length,3,'Foreign pointer move/up/cancel must not steal an edit');
assert.match(index, /id="structure-focus" aria-label="編集する分子"/);
const focusHandler=app.slice(app.indexOf("structureFocus.addEventListener('change'"),app.indexOf("document.querySelector('#frame-structure')"));
assert.doesNotMatch(focusHandler,/requestStructureFrame|camera\./,'Focus change must not reframe');
assert.match(app, /workspaceView.frame\(focusedStructure\(\),fit.center\)/);
assert.match(app, /solver.rotateReferenceFrames\(q,rotation.ids\);rotateStructure\(rotation,pos,q\)/);
assert.match(app, /from '\.\/electron-interaction\.js\?v=16'/);
assert.match(app, /from '\.\/gesture-arbitration\.js\?v=20'/);
assert.match(app, /from '\.\/workspace-model\.js\?v=20'/);
assert.match(app, /from '\.\/chemistry\.js\?v=20'/);
assert.doesNotMatch(app, /hasCompatibleElectronPair|lastCelebrated/);
assert.match(app, /chooseAtomOrElectron\(e.clientX,e.clientY,screenAtomCandidates\(\)/);
assert.match(app, /connectedStructures\(molecule\)/);
assert.match(index, /id="frame-structure"/);
assert.match(index, /id="undo-cleanup"/);
assert.match(index, /id="collection-dialog"/);
assert.match(index, /id="craft-panel"[^>]*hidden/);
assert.match(app, /collectionCheckedRevision!==collectionRevision/);
assert.match(app, /expandCraftStructure\(molecule,template\)/);
assert.match(app, /await import\('\.\/collection-ui\.js\?v=36'\)/);
assert.match(app, /!elementPalette.canUse\(symbol\)/);
assert.equal((app.match(/elementPalette.fallback\(\)/g)??[]).length,2,'Both DB failures restore full static palette access');
assert.match(index, /id="element-unlock-hint"/);
assert.doesNotMatch(app, /localStorage\.setItem/);
assert.equal((index.match(/data-element=/g) ?? []).length, 8, 'Static element palette must remain in HTML');
assert.ok(database.length >= 100, `Expected at least 100 molecule records, got ${database.length}`);
assert.doesNotMatch(chemistry, /const KNOWN_MOLECULES/);
assert.doesNotMatch(app, /completeBenzeneCycle|renderMolecule\(|relaxGeometryStep/);
assert.match(app, /depthTest:false/);
assert.match(app, /ELECTRON_SNAP_PX=58/);
assert.doesNotMatch(app, /electronHit=hits\.find/);
assert.match(electronInteraction, /coreRadiusPx: 36/);
assert.match(electronInteraction, /assistRadiusPx: 52/);
assert.match(gestureArbitration, /atomCoreRadiusPx: 20/);
assert.match(gestureArbitration, /atomStructureRadiusPx: 34/);
assert.match(gestureArbitration, /bondEndpointExclusionPx: 24/);
assert.doesNotMatch(app, /const bondHit=hits\.find/);
assert.ok(database.every(record => typeof record.iupacNameEn === 'string' && record.iupacNameEn), 'Every molecule record must have an IUPAC name');
assert.match(solver, /aromaticPlanarGroup/);
assert.match(solver, /planarSubstituentGroup/);
assert.match(solver, /doubleSubstituentSlots/);
assert.match(solver, /enforceAromaticSubstituentDirections/);
assert.match(solver, /assignAromaticFollowerSigns/);
assert.match(solver, /enforceConjugatedSubstituentGeometry/);

const cameraMutationLines = app.split('\n').filter(line => /camera\.position\.(set|copy|add|lerp)|cameraTarget\.(set|copy|add|lerp)/.test(line));
assert.equal(cameraMutationLines.length, 3, `Unexpected camera mutation:\n${cameraMutationLines.join('\n')}`);
assert.ok(cameraMutationLines.every(line => line.includes('const camera=') || line.includes('function zoomCamera') || line.includes('camera.position.lerpVectors(item.fromPosition')));
assert.match(app, /if\(!frameTransition\|\|relaxation\|\|bondTransition\)return/);
assert.doesNotMatch(app, /ensureSpawnVisible|function spawnPosition/);
assert.match(app, /planWorkspaceSpawn\(parts\)/);
assert.match(app, /frame-structure'\)\?\.addEventListener\('click',requestStructureFrame\)/);

console.log('Source contract tests passed.');
