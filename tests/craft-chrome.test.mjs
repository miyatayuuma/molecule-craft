import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [index,gameShell,craftPanel]=await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('src/game-shell.js',root),'utf8'),
  readFile(new URL('src/craft-panel.js',root),'utf8'),
]);

for(const id of ['structure-focus-label','open-info']){
  assert.match(index,new RegExp(`id="${id}"`),`${id} remains available to startup code`);
  assert.match(gameShell,new RegExp(`#${id}`),`${id} must be hidden from the live craft chrome`);
}
assert.doesNotMatch(index,/id="frame-structure"/,'Legacy CRAFT frame button stays removed');
assert.doesNotMatch(gameShell,/#frame-structure/,'Legacy frame button no longer needs startup hiding');
assert.match(gameShell,/node\.style\.display='none'/,'Remaining redundant craft chrome stays visually hidden without removing startup DOM dependencies');
assert.doesNotMatch(gameShell,/querySelector\(selector\)\?\.remove\(\)/,'Craft chrome pruning must not remove nodes still referenced by render/bind code');
assert.match(craftPanel,/const focusLabel=document\.querySelector\('#structure-focus-label'\);if\(focusLabel\)focusLabel\.hidden=/,'Craft panel must tolerate the focus label being unavailable');

assert.match(gameShell,/deleteButton\.textContent=''/,'Delete control must not retain a text label');
assert.match(gameShell,/deleteButton\.classList\.add\('icon-button'\)/,'Delete control must use compact icon-button chrome');
assert.match(gameShell,/viewBox="0 0 24 24"/,'Delete control must receive a trash-can SVG');
assert.match(index,/id="delete-selected"[^>]*aria-label="選択した原子を削除"/,'Delete control must keep its accessible label');

console.log('Craft chrome tests passed.');
