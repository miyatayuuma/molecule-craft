from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing expected source in {path}: {old[:80]!r}")
    p.write_text(text.replace(old, new, 1))


# Interrupted CRAFT gestures need a true rollback, not a commit or pending discard.
replace_once(
    "src/craft-history.js",
    "  function cancel(){const had=pending!==null;pending=null;pendingKey='';return had;}\n  function reset(){past.length=0;cancel();notify();}",
    "  function cancel(){const had=pending!==null;pending=null;pendingKey='';return had;}\n"
    "  function rollback(){\n"
    "    if(restoring||pending===null)return false;\n"
    "    const snapshot=pending,snapshotKey=pendingKey;pending=null;pendingKey='';restoring=true;let restored=false;\n"
    "    try{restored=restore(clone(snapshot))!==false;}\n"
    "    catch(error){pending=snapshot;pendingKey=snapshotKey;throw error;}\n"
    "    finally{restoring=false;}\n"
    "    if(!restored){pending=snapshot;pendingKey=snapshotKey;}\n"
    "    notify();return restored;\n"
    "  }\n"
    "  function reset(){past.length=0;cancel();notify();}",
)
replace_once(
    "src/craft-history.js",
    "  return{begin,commit,cancel,reset,undo,record,get canUndo(){return past.length>0;},get depth(){return past.length;},get pending(){return pending!==null;}};",
    "  return{begin,commit,cancel,rollback,reset,undo,record,get canUndo(){return past.length>0;},get depth(){return past.length;},get pending(){return pending!==null;}};",
)

# DOM event ownership: capture loss and browser interruption terminate transient input.
replace_once(
    "src/craft-controls.js",
    "  onVisibilityChange,onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel,onResize}){",
    "  onVisibilityChange,onInteractionInterrupted=()=>{},onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel,onResize}){",
)
replace_once(
    "src/craft-controls.js",
    "  document.addEventListener('visibilitychange',onVisibilityChange);\n"
    "  bindHoldAction(document.querySelector('#clear-all'),onClear);\n"
    "  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);",
    "  document.addEventListener('visibilitychange',()=>{onVisibilityChange();if(document.hidden)onInteractionInterrupted();});\n"
    "  document.defaultView?.addEventListener?.('blur',onInteractionInterrupted);\n"
    "  bindHoldAction(document.querySelector('#clear-all'),onClear);\n"
    "  canvas.addEventListener('pointerdown',onPointerDown);canvas.addEventListener('pointermove',onPointerMove);canvas.addEventListener('pointerup',onPointerUp);canvas.addEventListener('pointercancel',onPointerCancel);canvas.addEventListener('lostpointercapture',onPointerCancel);",
)

# Integration: rollback unfinished single-pointer gestures and recover broken animation transactions.
replace_once("src/app.js", "import { createCraftHistory } from './craft-history.js?v=1';", "import { createCraftHistory } from './craft-history.js?v=2';")
replace_once("src/app.js", "import { bindCraftControls } from './craft-controls.js?v=2';", "import { bindCraftControls } from './craft-controls.js?v=3';")
replace_once(
    "src/app.js",
    "    onUndo:undoCraft,onClear:clearField,onVisibilityChange:()=>{debrisTracker.reset();fadeTargets.clear();relaxation?.session.pause(performance.now());},\n"
    "    onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel:e=>{e.preventDefault();if(interactionLocked()){pulse('構造変化中は視点を固定しています');return;}zoomCamera(Math.exp(e.deltaY*.001));},onResize:resize});",
    "    onUndo:undoCraft,onClear:clearField,onVisibilityChange:()=>{debrisTracker.reset();fadeTargets.clear();relaxation?.session.pause(performance.now());},\n"
    "    onInteractionInterrupted:abortPointerInteraction,\n"
    "    onPointerDown,onPointerMove,onPointerUp,onPointerCancel,onWheel:e=>{e.preventDefault();if(interactionLocked()){pulse('構造変化中は視点を固定しています');return;}zoomCamera(Math.exp(e.deltaY*.001));},onResize:resize});",
)

old_cancel = """function onPointerCancel(e){
  if(!activePointers.has(e.pointerId))return;
  lastBackgroundTap=null;
  const state=dragState;activePointers.delete(e.pointerId);clearTimeout(bondHoldTimer);
  if(state?.mode==='electron'&&state.moved)startElectronReturn(state);
  if(state?.mode==='torsion'||state?.mode==='conformation'||state?.mode==='rigid-body')finishTorsion(state);
  const keepBond=state?.mode==='bond'&&state.holding&&!!bondTransition;
  if(!keepBond){const changed=state?.moved&&['atom-translate','torsion','conformation','rigid-body','molecule-rotate'].includes(state.mode);changed?craftHistory.commit():craftHistory.cancel();}
  dragState=null;multiGesture=null;hoverElectron=null;release(e);if(!interactionLocked())refresh();else refreshInfo(true);
}
"""
new_cancel = """function abortPointerInteraction(e=null){
  if(e?.pointerId!==undefined&&!activePointers.has(e.pointerId))return false;
  if(!activePointers.size&&!dragState&&!multiGesture&&!hoverElectron&&!craftHistory.pending)return false;
  lastBackgroundTap=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;
  try{conformationEngine.release();}catch{}
  if(craftHistory.pending){
    try{if(craftHistory.rollback())return true;}
    catch(error){console.error('Craft gesture rollback failed; clearing transient input state.',error);}
  }
  for(const id of activePointers.keys())try{renderer.domElement.releasePointerCapture(id);}catch{}
  activePointers.clear();dragState=null;multiGesture=null;hoverElectron=null;electronReturn=null;
  if(!interactionLocked())refresh();else refreshInfo(true);return true;
}
function onPointerCancel(e){abortPointerInteraction(e);}
"""
replace_once("src/app.js", old_cancel, new_cancel)

old_animate = """function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function animate(now=performance.now()){
"""
new_animate = """function resize(){const w=Math.max(1,viewer.clientWidth),h=Math.max(1,viewer.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function recoverCraftAnimationState(){
  if(!relaxation&&!bondTransition&&!frameTransition&&!dragState&&!activePointers.size&&!multiGesture&&!craftHistory.pending)return false;
  if(craftHistory.pending){
    try{if(craftHistory.rollback())return true;}
    catch(error){console.error('Craft animation rollback failed; aborting transient transaction.',error);}
  }
  try{conformationEngine.release();}catch{}
  stopRelaxation();frameTransition=null;clearTimeout(bondHoldTimer);bondHoldTimer=null;
  try{clearBondTransition();}catch{
    bondTransition=null;
    for(const object of[...interactionOverlay.children])try{interactionOverlay.remove(object);disposeObject(object);}catch{}
  }
  for(const id of activePointers.keys())try{renderer.domElement.releasePointerCapture(id);}catch{}
  activePointers.clear();dragState=null;multiGesture=null;hoverElectron=null;electronReturn=null;lastBackgroundTap=null;
  try{refreshInfo(true);}catch{}
  return true;
}
function animate(now=performance.now()){
"""
replace_once("src/app.js", old_animate, new_animate)
replace_once(
    "src/app.js",
    "  }catch(error){const detail=String(error?.stack??error);if(detail!==animationFault){animationFault=detail;console.error('Craft animation update failed; rendering the current scene.',error);}}",
    "  }catch(error){const detail=String(error?.stack??error);if(detail!==animationFault){animationFault=detail;console.error('Craft animation update failed; rendering the current scene.',error);}recoverCraftAnimationState();}",
)

# Direct rollback regression.
history_test = Path("tests/craft-history.test.mjs")
history_test.write_text(history_test.read_text() + """

test('rollback restores an interrupted pending gesture without adding an Undo entry',()=>{
  const fx=fixture(),baseline=copy(fx.state);
  fx.history.begin();fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H',x:12});
  assert.equal(fx.history.pending,true);assert.equal(fx.history.rollback(),true);
  assert.deepEqual(fx.state,baseline);assert.equal(fx.history.pending,false);assert.equal(fx.history.depth,0);assert.equal(fx.history.canUndo,false);
  assert.equal(fx.history.rollback(),false,'repeated interruption is idempotent');
});
""")

# DOM routing regression.
controls_test = Path("tests/craft-controls-ui.test.mjs")
controls_test.write_text(controls_test.read_text() + """

test('bindCraftControls routes capture loss, blur, and hidden visibility to interruption cleanup',()=>{
  globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  const undo=node('undo-cleanup'),clear=node('clear-all'),actions=node('actions'),palette=node('palette'),focus=node('structure-focus'),viewer=node('viewer'),canvas=node('canvas'),windowListeners=new Map(),documentListeners=new Map();
  actions.insertBefore=()=>{};
  const document={hidden:false,defaultView:{addEventListener(type,fn){windowListeners.set(type,fn);}},querySelector(selector){if(selector==='.viewer-actions')return actions;if(selector==='#undo-cleanup')return undo;if(selector==='#clear-all')return clear;return null;},querySelectorAll(){return[];},addEventListener(type,fn){documentListeners.set(type,fn);}};
  for(const item of [undo,clear,actions,palette,focus,viewer,canvas])item.ownerDocument=document;
  class ResizeObserver{constructor(fn){this.fn=fn;}observe(target){this.target=target;}}
  let cancelled=0,interrupted=0,visibility=0;
  bindCraftControls({document,palette,elements:{},structureFocus:focus,viewer,canvas,resizeObserver:ResizeObserver,canChangeStructure:()=>true,refreshStructureList(){},findStructure(){},onStructureChange:{addElement(){},focus(){}},onUndo(){},onClear(){},onVisibilityChange(){visibility++;},onInteractionInterrupted(){interrupted++;},onPointerDown(){},onPointerMove(){},onPointerUp(){},onPointerCancel(){cancelled++;},onWheel(){},onResize(){}});
  assert.ok(canvas.listeners.has('lostpointercapture'));
  canvas.listeners.get('lostpointercapture')({pointerId:9});assert.equal(cancelled,1);
  windowListeners.get('blur')();assert.equal(interrupted,1);
  document.hidden=true;documentListeners.get('visibilitychange')();assert.equal(visibility,1);assert.equal(interrupted,2);
  document.hidden=false;documentListeners.get('visibilitychange')();assert.equal(visibility,2);assert.equal(interrupted,2,'foreground visibility change is not an interruption');
});
""")

Path("tests/craft-input-recovery.test.mjs").write_text(r"""import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [app,controls,history]=await Promise.all([
  readFile(new URL('../src/app.js',import.meta.url),'utf8'),
  readFile(new URL('../src/craft-controls.js',import.meta.url),'utf8'),
  readFile(new URL('../src/craft-history.js',import.meta.url),'utf8'),
]);

test('CRAFT canvas treats lost pointer capture and browser interruption as lifecycle termination',()=>{
  assert.match(controls,/addEventListener\('lostpointercapture',onPointerCancel\)/);
  assert.match(controls,/defaultView\?\.addEventListener\?\.\('blur',onInteractionInterrupted\)/);
  assert.match(controls,/document\.hidden\)onInteractionInterrupted\(\)/);
  assert.match(app,/onInteractionInterrupted:abortPointerInteraction/);
});

test('interrupted pointer cleanup is idempotent and rolls unfinished history back instead of committing it',()=>{
  const start=app.indexOf('function abortPointerInteraction'),end=app.indexOf('function onPointerCancel',start),body=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(body,/!activePointers\.has\(e\.pointerId\)\)return false/,'late lostpointercapture after pointerup is ignored');
  assert.match(body,/craftHistory\.rollback\(\)/);
  assert.doesNotMatch(body,/craftHistory\.commit\(\)/);
  assert.doesNotMatch(body,/craftWorkspace\.clear\(\)|clearField\(/);
  assert.match(history,/function rollback\(\)/);
});

test('animation update faults abort transient locks without clearing the CRAFT workspace',()=>{
  const start=app.indexOf('function recoverCraftAnimationState'),end=app.indexOf('function animate(',start),body=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(body,/craftHistory\.rollback\(\)/);
  assert.match(body,/stopRelaxation\(\)/);
  assert.match(body,/frameTransition=null/);
  assert.match(body,/clearBondTransition\(\)/);
  assert.match(body,/activePointers\.clear\(\)/);
  assert.doesNotMatch(body,/craftWorkspace\.clear\(\)|clearField\(/);
  assert.match(app,/console\.error\('Craft animation update failed; rendering the current scene\.',error\);\}recoverCraftAnimationState\(\);/);
});
""")

# Keep these regressions in normal PR validation.
replace_once(
    ".github/workflows/repository-validation.yml",
    "      - name: Source contracts\n"
    "        run: |\n"
    "          node tests/source-contracts.test.mjs\n"
    "          node tests/persistence-boundary-source-contract.test.mjs\n",
    "      - name: Source contracts\n"
    "        run: |\n"
    "          node tests/source-contracts.test.mjs\n"
    "          node tests/persistence-boundary-source-contract.test.mjs\n"
    "      - name: CRAFT input recovery\n"
    "        run: |\n"
    "          node tests/craft-controls-ui.test.mjs\n"
    "          node tests/craft-history.test.mjs\n"
    "          node tests/craft-input-recovery.test.mjs\n",
)

# One-shot branch executor leaves no tooling residue in the PR.
Path(".github/workflows/apply-craft-input-recovery.yml").unlink(missing_ok=True)
Path("scripts/apply-craft-input-recovery.py").unlink(missing_ok=True)
