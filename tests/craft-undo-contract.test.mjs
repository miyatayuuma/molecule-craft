import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [app,controls,panel,index]=await Promise.all([
  readFile(new URL('src/app.js',root),'utf8'),
  readFile(new URL('src/craft-controls.js',root),'utf8'),
  readFile(new URL('src/craft-panel.js',root),'utf8'),
  readFile(new URL('index.html',root),'utf8'),
]);

const between=(source,start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));

test('CRAFT action bar turns the legacy controls into distinct accessible Undo and full-cleanup actions',()=>{
  assert.match(index,/id="undo-cleanup"/,'The existing DOM anchor remains available before JS enhancement');
  assert.match(controls,/undo\.className='icon-button';undo\.hidden=false;undo\.disabled=true;undo\.textContent='↶'/);
  assert.match(controls,/undo\.setAttribute\('aria-label','元に戻す'\)/);
  assert.match(controls,/actions\.insertBefore\(undo,clear\)/,'Undo belongs beside the other viewer actions');
  assert.match(controls,/clear\.setAttribute\('aria-label','1秒長押しで全片付け。クラフト中の全要素をBASE STOCKへ戻して片付ける'\)/);
  assert.match(controls,/clear\.setAttribute\('title','全片付け'\)/);
  assert.match(controls,/M8 8h8l-\.7 11H8\.7L8 8z/,'Full cleanup uses a trash-can silhouette');
  assert.match(controls,/bindHoldAction\(document\.querySelector\('#clear-all'\),onClear\)/,'Existing long-press safety remains intact');
  assert.doesNotMatch(panel,/cleanupAvailable|undo-cleanup/,'Craft panel rendering no longer owns Undo visibility');
});

test('history snapshots couple saved workspace geometry/topology with BASE STOCK',()=>{
  const capture=between(app,'function captureCraftHistoryState()','function restoreCraftHistoryState');
  const restore=between(app,'function restoreCraftHistoryState','function undoCraft');
  assert.match(capture,/captureWorkspace\(\{molecule,positionFor:pos,camera,cameraTarget,selectedAtomId/);
  assert.match(capture,/elements:\{\.\.\.resources\.state\.elements\}/);
  assert.match(restore,/restoreWorkspace\(snapshot\.workspace/);
  assert.match(restore,/Object\.assign\(resources\.state\.elements,snapshot\.elements\)/);
  assert.match(restore,/topologyChanged\(\)/,'Recognition and derived graph state are recalculated after Undo');
  assert.match(restore,/syncCraftStock\(\)/,'BASE STOCK controls refresh after Undo');
  assert.match(restore,/refresh\(\)/,'Target missing pieces, completion state and model render are recalculated after Undo');
  assert.match(restore,/saveWorkspace\(true\)/,'Restored state is persisted');
  assert.doesNotMatch(app,/resources\.(?:spend|refund)\(/,'Undo must not bypass the craft-workspace stock boundary with inverse bookkeeping');
});

test('semantic mutations create one history entry while pointermove never creates history',()=>{
  const addAtom=between(app,'function addElement','function addCraftPart');
  const addPart=between(app,'function addCraftPart','function onPointerDown');
  const move=between(app,'function onPointerMove','function onPointerUp');
  const transition=between(app,'function updateBondTransition','function clearBondTransition');
  assert.match(addAtom,/craftHistory\.begin\(\)/);assert.match(addAtom,/craftHistory\.commit\(\)/);assert.match(addAtom,/craftHistory\.cancel\(\)/);
  assert.match(addPart,/craftHistory\.begin\(\)/);assert.match(addPart,/craftHistory\.commit\(\)/);assert.match(addPart,/craftHistory\.cancel\(\)/);
  assert.doesNotMatch(move,/craftHistory\./,'Continuous pointer positions must not become Undo steps');
  assert.match(transition,/topologyChanged\(\);craftHistory\.commit\(\)/,'Bond formation/order mutation commits the pending gesture exactly at topology change');
  assert.match(app,/const ids=connectedComponent\(selectedAtomId\);craftHistory\.begin\(\)/,'Atom deletion records a reversible state');
  assert.match(app,/const remember=recordHistory&&molecule\.atoms\.length>0;if\(remember\)craftHistory\.begin\(\)/,'Full cleanup is one reversible mutation');
});

test('history stops at session boundaries and no-history Undo is disabled/no-op',()=>{
  assert.match(app,/beginCraftTarget[\s\S]*?craftHistory\.reset\(\)/,'Starting a new CRAFT target defines a new history baseline');
  assert.match(app,/onBeforeLaunch:\(\)=>clearField\(\{clearTarget:true,silent:true,recordHistory:false\}\)/,'Leaving CRAFT does not create an artificial cleanup Undo step');
  assert.match(app,/if\(clearTarget\)craftHistory\.reset\(\)/,'A session-ending clear cannot expose prior-session history');
  assert.match(app,/button\.disabled=!canUndo/);
  assert.match(app,/if\(interactionLocked\(\)\|\|dragState\|\|activePointers\.size\|\|!craftHistory\.canUndo\)return/);
  assert.doesNotMatch(app,/cleanupUndo/,'The old one-purpose cleanup stack is fully replaced by semantic history');
});
