import test from 'node:test';
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
