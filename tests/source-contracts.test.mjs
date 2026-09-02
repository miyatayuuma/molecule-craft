import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [index, app, chemistry, solver, conformation, electronInteraction, gestureArbitration, veilCss, craftWorkspace, craftControls, craftConnections, craftPanel] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app.js?v=43', root), 'utf8'),
  readFile(new URL('src/chemistry.js', root), 'utf8'),
  readFile(new URL('src/structure-relaxation.js?v=32', root), 'utf8'),
  readFile(new URL('src/conformation-engine.js?v=2', root), 'utf8'),
  readFile(new URL('src/electron-interaction.js', root), 'utf8'),
  readFile(new URL('src/gesture-arbitration.js', root), 'utf8'),
  readFile(new URL('veil.css', root), 'utf8'),
  readFile(new URL('src/craft-workspace.js', root), 'utf8'),
  readFile(new URL('src/craft-controls.js', root), 'utf8'),
  readFile(new URL('src/craft-connections.js', root), 'utf8'),
  readFile(new URL('src/craft-panel.js', root), 'utf8'),
]);

assert.match(index, /<script type="module" src="\.\/src\/app\.js\?v=43"><\/script>/);
assert.match(app, /from '\.\/structure-relaxation\.js\?v=32'/);
assert.match(app, /from '\.\/structure-motion\.js\?v=30'/);
assert.match(app, /from '\.\/structure-settlement\.js\?v=32'/);
assert.match(app, /from '\.\/torsion-model\.js\?v=34'/);
assert.match(app, /from '\.\/conformation-engine\.js\?v=2'/);
assert.match(app, /from '\.\/workspace-view\.js\?v=23'/);
assert.doesNotMatch(app, /stableFrames|maxDuration/);
assert.doesNotMatch(app, /pendingFrame|followDraggedBranch|function structurePlan|interruptRelaxation|panCamera/);
assert.doesNotMatch(index, /stop-relaxation/);
assert.match(app, /conformationEngine\.updateDrag\(dragState\.targetWorld,\{deltaSeconds\}\)/);
assert.match(app, /conformationEngine\.release\(\)/);
assert.match(app, /function atomEditPlan\(atomId,activeKey=null\)/);
assert.doesNotMatch(index, /rotation-axis-options|rotation-cue/);
assert.doesNotMatch(app, /rotationOptions|rotationCue|candidateTorsionKeys|activeTorsionKey|axisGlow/);
assert.match(app, /\['conformation','rigid-body'\]\.includes\(dragState\.mode\)\)advanceConformationDrag\(now\)/);
assert.match(app, /activePointers.size&&dragState&&\(dragState.moved\|\|dragState.mode!=='molecule-rotate'\)/);
assert.equal((app.match(/if\(!activePointers.has\(e.pointerId\)\)return/g)??[]).length,3,'Foreign pointer move/up/cancel must not steal an edit');
assert.match(index, /id="structure-focus" aria-label="編集する分子"/);
const focusHandler=craftControls.slice(craftControls.indexOf("structureFocus.addEventListener('change'"),craftControls.indexOf("document.querySelector('#frame-structure')"));
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
assert.match(craftConnections, /checkedRevision!==revision/);
assert.match(craftWorkspace, /expandCraftStructure\(molecule,template\)/);
assert.match(craftConnections, /await import\('\.\/collection-ui\.js\?v=37'\)/);
assert.doesNotMatch(app, /resources\.(?:spend|refund)\(/,'BASE STOCK mutations belong to craft-workspace.js');
assert.match(app, /!elementPalette.canUse\(symbol\)/);
assert.equal((app.match(/elementPalette.fallback\(\)/g)??[]).length,2,'Both DB failures restore full static palette access');
assert.match(index, /id="element-unlock-hint"/);
assert.match(index, /id="veil-combustion"/);
assert.match(index, /id="veil-threat"/);
assert.match(index, /id="open-supply" class="collector-access"/);
assert.match(index, /id="shell-propellant"/);
assert.match(index, /id="shell-fuel"/);
assert.match(index, /id="shell-oxidizer"/);
assert.match(index, /id="shell-coolant"/);
assert.match(index, /id="tank-model-host"/);
assert.match(index, /id="craft-tank-actions"/);
assert.doesNotMatch(index, /id="molecule-select"|id="fill-hydrogen"|id="make-h2"/);
assert.match(index, /EXPEDITION CARGO/);
assert.match(index, /COLLECTOR SHELL · ANCHOR FIELD/);
assert.match(index, /id="veil-anchor-meter"/);
assert.match(veilCss, /\.veil-actions #veil-sound\{position:absolute/);
assert.match(veilCss, /@media\(max-width:370px\)\{\.veil-chain-block\{display:none\}/);
assert.doesNotMatch(index, /id="drive-select"|id="auto-cooling"|id="veil-thermal"/);
assert.doesNotMatch(app, /localStorage\.setItem/);
assert.equal((index.match(/data-element=/g) ?? []).length, 8, 'Static element palette must remain in HTML');
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
assert.match(solver, /aromaticPlanarGroup/);
assert.match(solver, /planarSubstituentGroup/);
assert.match(solver, /doubleSubstituentSlots/);
assert.match(solver, /enforceAromaticSubstituentDirections/);
assert.match(solver, /assignAromaticFollowerSigns/);
assert.match(solver, /enforceConjugatedSubstituentGeometry/);
assert.match(solver, /projectRigidConstraints/);
assert.match(solver, /relaxStericIntersections/);
assert.match(solver, /validateConformation/);
assert.match(solver, /ringExclusionVolumes/);
assert.match(conformation, /jacobianToward/);
assert.match(conformation, /forceStiffness|rigidBodyToward|velocities/);
assert.match(conformation, /lastValid/);
assert.match(conformation, /attemptScales/);

const cameraMutationLines = app.split('\n').filter(line => /camera\.position\.(set|copy|add|lerp)|cameraTarget\.(set|copy|add|lerp)/.test(line));
assert.equal(cameraMutationLines.length, 3, `Unexpected camera mutation:\n${cameraMutationLines.join('\n')}`);
assert.ok(cameraMutationLines.every(line => line.includes('const camera=') || line.includes('function zoomCamera') || line.includes('camera.position.lerpVectors(item.fromPosition')));
assert.match(app, /if\(!frameTransition\|\|relaxation\|\|bondTransition\)return/);
assert.doesNotMatch(app, /ensureSpawnVisible|function spawnPosition/);
assert.match(app, /planWorkspaceSpawn\(parts\)/);
assert.match(craftControls, /frame-structure'\)\?\.addEventListener\('click',onFrame\)/);
assert.match(app, /createCraftWorkspace\(\{molecule,placements,resources\}\)/);
assert.match(app, /bindCraftControls\(/);
assert.match(app, /connectExploration\(/);
assert.match(app, /connectCollection\(/);
assert.match(app, /createDiscoveryConnection\(/);
assert.match(app, /craftPanel\.renderInfo\(/);

console.log('Source contract tests passed.');
