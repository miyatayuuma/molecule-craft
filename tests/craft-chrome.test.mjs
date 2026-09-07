import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [index,gameShell]=await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('src/game-shell.js',root),'utf8'),
]);

for(const id of ['structure-focus-label','frame-structure','open-info']){
  assert.match(index,new RegExp(`id="${id}"`),`${id} remains source-compatible before runtime pruning`);
  assert.match(gameShell,new RegExp(`#${id}`),`${id} must be pruned from the live craft chrome`);
}

assert.match(gameShell,/deleteButton\.textContent=''/,'Delete control must not retain a text label');
assert.match(gameShell,/deleteButton\.classList\.add\('icon-button'\)/,'Delete control must use compact icon-button chrome');
assert.match(gameShell,/viewBox="0 0 24 24"/,'Delete control must receive a trash-can SVG');
assert.match(index,/id="delete-selected"[^>]*aria-label="選択した原子を削除"/,'Delete control must keep its accessible label');

console.log('Craft chrome tests passed.');
