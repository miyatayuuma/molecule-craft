import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veilSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');

const closeAt=source.indexOf("if(dialog.open)dialog.close();");
const launchAt=source.indexOf("started=onLaunchReady()!==false");
assert.ok(closeAt>=0&&launchAt>closeAt,'LOADOUT modal must close before expedition runtime initialization begins');
assert.match(source,/if\(!resources\.blocked&&canOpen\(\)&&!dialog\.open\)dialog\.showModal\(\)/,'Legacy LOADOUT fallback remains safe when launch does not restore the dialog itself');
assert.match(source,/finally\{\s*launchBusy=false;/,'Launch busy lock must always be released');
assert.match(source,/partialPanel\.scrollIntoView\?\./,'Partial-fill confirmation must be brought into view when a drag cannot launch immediately');
assert.match(source,/shellMap\.classList\.toggle\('launch-selecting',show\)/,'Launch-selection state must be explicit rather than inferred from overlapping UI');
assert.match(source,/querySelectorAll\('\.loadout-slot-path'\)/,'Tank hit paths must yield pointer input while destination selection is active');

assert.match(veilSource,/runLaunchTransaction\(/,'Expedition launch must use the shared transaction executor');
assert.match(veilSource,/name:'initialDraw',run:\(\)=>renderer\.draw\(run,0,reduced\)/,'Initial render must be validated synchronously before EXPLORE commit');
assert.match(veilSource,/name:'saveLaunch'/,'Launch persistence must be part of the pre-commit transaction');
assert.ok(veilSource.indexOf("name:'initialDraw'")<veilSource.indexOf('uiState.transition(UI_MODE.EXPLORE)'),'EXPLORE mode must not commit before the initial draw succeeds');
assert.ok(veilSource.indexOf("name:'saveLaunch'")<veilSource.indexOf('uiState.transition(UI_MODE.EXPLORE)'),'EXPLORE mode must not commit before launch state is saved');
assert.match(veilSource,/function rollbackLaunch\(\{previousAnchor,previousRuns,error,phase\}\)/,'Expedition view must provide a phase-aware launch rollback path');
assert.match(veilSource,/resources\.state\.progress\.runs=previousRuns/,'Failed launch must not consume a run count');
assert.match(veilSource,/active=false;paused=false;run=null;anchorLock=null;returnState=null/,'Failed launch must clear active expedition state');
assert.match(veilSource,/uiState\.transition\(UI_MODE\.LOADOUT\)/,'Failed launch must restore LOADOUT through the UI coordinator');
assert.match(veilSource,/uiState\.transition\(UI_MODE\.CRAFT\)/,'Successful return must restore CRAFT through the UI coordinator');
assert.doesNotMatch(veilSource,/root\.hidden=true;document\.body\.dataset\.mode='craft';appShell\.inert=false/,'Exploration runtime must not independently own global UI rollback state');

assert.match(connections,/getUIStateCoordinator/,'Exploration connection must use the central UI state coordinator');
assert.match(connections,/getUIStateCoordinator\(\)\.transition\(UI_MODE\.CRAFT\)/,'Exploration startup recovery must normalize through the coordinator');
assert.ok(connections.indexOf('getUIStateCoordinator().transition(UI_MODE.CRAFT);')<connections.indexOf('createVeilUI({resources'),'Mode recovery must happen before exploration UI listeners are connected');

console.log('Launch transition regression passed.');
