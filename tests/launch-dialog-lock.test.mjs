import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const shell=await readFile(new URL('../src/game-shell.js',import.meta.url),'utf8');
assert.ok(shell.includes("isOpen:()=>dialogs.some(dialog=>dialog.open)"),'Game shell treats the supply dialog itself as an open dialog');
assert.ok(app.includes("canLeave:()=>!resources.blocked&&!veilUI?.active&&!relaxation&&!bondTransition&&!frameTransition&&!dragState&&!activePointers.size&&!collectionOpen&&(document.querySelector('#supply-dialog').open||!gameShell.isOpen())&&(saveWorkspace(true)||!resources.blocked)"),'Expedition launch must remain allowed while the supply dialog itself is open');
assert.ok(!app.includes("canLeave:()=>!resources.blocked&&!interactionLocked()"),'Launch must not reuse the craft interaction lock that includes the supply dialog');
console.log('Explorer launch dialog lock passed.');
