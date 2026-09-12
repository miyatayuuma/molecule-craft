import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const [app,index,craftControls,craftPanel,pubchemReference,collectionViewer]=await Promise.all([
  read('src/app.js'),read('index.html'),read('src/craft-controls.js'),read('src/craft-panel.js'),read('src/pubchem-reference.js'),read('src/collection-viewer.js'),
]);

assert.doesNotMatch(index,/id="delete-selected"|id="remove-selected"|id="frame-structure"|id="stop-relaxation"/);
assert.doesNotMatch(craftControls,/delete-selected|remove-selected|frame-structure|stop-relaxation/);
assert.doesNotMatch(craftPanel,/delete-selected|remove-selected|frame-structure|stop-relaxation/);
assert.match(craftControls,/undo\.className='icon-button craft-history-undo'/);
assert.match(craftControls,/clear\.className='hold-clear icon-button'/);
assert.match(craftControls,/bindHoldAction\(document\.querySelector\('#clear-all'\),onClear\)/);
assert.match(app,/function undoCraft\(\)/);
assert.match(app,/function captureCraftHistoryState\(\)/);
assert.match(app,/function restoreCraftHistoryState\(snapshot\)/);
assert.match(craftPanel,/className='pubchem-link'/);
assert.match(craftPanel,/createPubchemIntroState/);
assert.doesNotMatch(craftPanel,/nodes\.pubchem\.title|PubChemで構造検索|PubChemで分子式検索/,'PubChem has no hover-only explanation');
assert.match(pubchemReference,/molecule-craft\.pubchem-intro\.v1/);
assert.match(pubchemReference,/PubChem ↗/);

assert.match(pubchemReference,/pubchem\.ncbi\.nlm\.nih\.gov\/\#query=/);
assert.match(collectionViewer,/createPreviewControls\(/,'Collection viewer gesture controls remain enabled');
assert.match(collectionViewer,/controls\.zoom\(/,'Pinch or wheel zoom remains available');

assert.match(index, /<script type="module" src="\.\/src\/app\.js\?v=52"><\/script>/);
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
console.log('Source contract tests passed.');
