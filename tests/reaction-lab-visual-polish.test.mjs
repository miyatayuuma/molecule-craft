import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const viewer=readFileSync(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');

test('feed heads use a full-head molecular preview with a lower-right formula',()=>{
  assert.match(css,/\.reaction-lab-slot-socket\{position:absolute;inset:3px;min-height:0;margin:0;border:0/);
  assert.match(css,/\.reaction-lab-slot-socket img\{display:block;width:100%;height:100%;object-fit:contain/);
  assert.match(css,/\.reaction-lab-slot-copy\{position:absolute;z-index:2;right:4px;bottom:4px/);
  assert.equal([...html.matchAll(/class="reaction-lab-slot"/g)].length,3);
});

test('retired drag and zoom copy is absent from the chamber',()=>{
  const chamber=html.match(/<div class="reaction-lab-space">[\s\S]*?<div class="reaction-lab-footer">/)?.[0];
  assert.ok(chamber);
  assert.doesNotMatch(chamber,/<p>ドラッグで近づける/);
  assert.doesNotMatch(chamber,/pinch\s*\/\s*wheel/);
});

test('LIGHT, HEAT and pH are reflected in a pointer-transparent chamber overlay',()=>{
  assert.match(viewer,/chamberSpace\.dataset\.light=state\.light\?'on':'off'/);
  assert.match(viewer,/chamberSpace\.dataset\.heat=state\.heat\?'on':'off'/);
  assert.match(viewer,/chamberSpace\.dataset\.medium=state\.medium/);
  assert.match(css,/\.reaction-lab-space::before\{[^}]*pointer-events:none/);
  for(const state of ['data-light="on"','data-heat="on"','data-medium="acidic"','data-medium="basic"'])assert.ok(css.includes(`.reaction-lab-space[${state}]`));
});
