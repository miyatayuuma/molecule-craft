import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veilSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');

const closeAt=source.indexOf("if(dialog.open)dialog.close();");
const launchAt=source.indexOf("started=onLaunchReady()!==false");
assert.ok(closeAt>=0&&launchAt>closeAt,'LOADOUT modal must close before expedition view initialization begins');
assert.match(source,/if\(!resources\.blocked&&canOpen\(\)&&!dialog\.open\)dialog\.showModal\(\)/,'Failed launch must restore LOADOUT instead of leaving a half-transitioned UI');
assert.match(source,/finally\{\s*launchBusy=false;/,'Launch busy lock must always be released');
assert.match(source,/partialPanel\.scrollIntoView\?\./,'Partial-fill confirmation must be brought into view when a drag cannot launch immediately');
assert.match(source,/shellMap\.classList\.toggle\('launch-selecting',show\)/,'Launch-selection state must be explicit rather than inferred from overlapping UI');
assert.match(source,/querySelectorAll\('\.loadout-slot-path'\)/,'Tank hit paths must yield pointer input while destination selection is active');

assert.match(veilSource,/function rollbackLaunch\(\{previousAnchor,previousRuns,error\}\)/,'Expedition view must provide a launch rollback path');
assert.match(veilSource,/resources\.state\.progress\.runs=previousRuns/,'Failed launch must not consume a run count');
assert.match(veilSource,/active=false;paused=false;run=null;anchorLock=null;returnState=null/,'Failed launch must clear active expedition state');
assert.match(veilSource,/root\.hidden=true;document\.body\.dataset\.mode='craft';appShell\.inert=false/,'Failed launch must restore craft visibility and input');
assert.match(veilSource,/catch\(error\)\{return rollbackLaunch\(\{previousAnchor,previousRuns,error\}\);\}/,'Every synchronous launch initialization failure must use the rollback path');
assert.ok(veilSource.indexOf('resources.state.progress.runs=nextRun')<veilSource.indexOf('if(!resources.save())throw Error(\'Expedition launch state could not be saved.\')'),'Run count must only be committed after view initialization succeeds');

assert.match(connections,/from '\.\/veil\/ui\.js\?v=3'/,'Exploration UI changes must use a fresh module URL instead of reusing the stale v2 module');
assert.match(connections,/function normalizeExplorationMode\(\)/,'Exploration connection must normalize any orphaned mode state on startup');
assert.match(connections,/if\(veil\)veil\.hidden=true/,'Startup recovery hides any orphaned exploration view');
assert.match(connections,/if\(appShell\)appShell\.inert=false/,'Startup recovery restores craft pointer input');
assert.match(connections,/document\.body\.dataset\.mode='craft'/,'Startup recovery restores craft mode');

// #119 defers createVeilUI until molecule DB readiness. Verify execution order
// inside connectExploration instead of comparing helper declaration positions.
const connectStart=connections.indexOf('export function connectExploration(options)');
const connectEnd=connections.indexOf('\nexport async function connectCollection',connectStart);
const connectSource=connections.slice(connectStart,connectEnd);
const normalizeAt=connectSource.indexOf('normalizeExplorationMode();');
const prepareAt=connectSource.indexOf('prepareExplorationCatalog(options.resources)');
const createAt=connectSource.indexOf('veilUI=createReadyExploration(options)');
assert.ok(connectStart>=0&&connectEnd>connectStart,'connectExploration source must be present');
assert.ok(normalizeAt>=0&&prepareAt>normalizeAt,'Mode recovery must happen before DB readiness work starts');
assert.ok(createAt>prepareAt,'Exploration UI listeners must only be created after the DB readiness promise resolves');

console.log('Launch transition regression passed.');
