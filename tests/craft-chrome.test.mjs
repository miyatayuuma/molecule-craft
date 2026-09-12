import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const [index,gameShell,craftPanel,craftControls,app]=await Promise.all([readFile(new URL('index.html',root),'utf8'),readFile(new URL('src/game-shell.js',root),'utf8'),readFile(new URL('src/craft-panel.js',root),'utf8'),readFile(new URL('src/craft-controls.js',root),'utf8'),readFile(new URL('src/app.js',root),'utf8')]);
for(const id of ['structure-focus-label','open-info']){assert.match(index,new RegExp(`id="${id}"`));assert.match(gameShell,new RegExp(`#${id}`));}
assert.doesNotMatch(index,/id="frame-structure"/);assert.doesNotMatch(gameShell,/#frame-structure/);assert.match(gameShell,/node\.style\.display='none'/);assert.doesNotMatch(gameShell,/querySelector\(selector\)\?\.remove\(\)/);assert.match(craftPanel,/const focusLabel=document\.querySelector\('#structure-focus-label'\);if\(focusLabel\)focusLabel\.hidden=/);
assert.doesNotMatch(index,/id="delete-selected"/);assert.doesNotMatch(gameShell,/delete-selected|deleteButton/);assert.doesNotMatch(craftControls,/delete-selected|onDelete/);assert.doesNotMatch(app,/onDelete:|削除後の構造を安定化しています/);assert.doesNotMatch(index,/<circle cx="7" cy="6\.5"|<circle cx="12" cy="5"|<circle cx="17" cy="6\.5"/);assert.match(index,/id="clear-all"[^>]*[\s\S]*?<path d="M8 8h8l-\.7 11H8\.7L8 8z"/);
console.log('Craft chrome tests passed.');
