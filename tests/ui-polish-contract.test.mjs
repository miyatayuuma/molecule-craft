import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('exploration machine stays icon-only in the header, without a second toolbar',async()=>{
  const html=await read('index.html');
  const topbar=html.match(/<div class="topbar-actions">([^\n]*)<\/div>/)?.[1];
  assert.ok(topbar?.includes('id="open-supply"'));
  assert.ok(topbar.indexOf('id="open-supply"')<topbar.indexOf('id="open-reaction-lab"'));
  assert.match(topbar,/<button id="open-supply"[^>]*><\/button>/);
  assert.doesNotMatch(html,/class="resource-bar"/);
});

test('retired instructions, reset controls and hidden copy are absent',async()=>{
  const [html,gameShell,connections,collection]=await Promise.all([
    read('index.html'),read('src/game-shell.js'),read('src/craft-connections.js'),read('src/collection-ui.js'),
  ]);
  for(const id of ['help-dialog','reset-selected','reset-status','game-loop-hint','craft-last-run']){
    assert.doesNotMatch(html,new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(gameShell,/open-help|help-dialog|reset-status/);
  assert.doesNotMatch(connections,/createProgressResetUI/);
  assert.doesNotMatch(collection,/show-extra-elements|game-loop-hint/);
});

test('loadout suppresses empty detail space and compacts header without new copy',async()=>{
  const workstation=await read('src/veil/loadout-workstation.js');
  assert.match(workstation,/#supply-dialog \.tank-inspector:has\(> #tank-model\[hidden\]\)\{display:none\}/);
  assert.match(workstation,/#supply-dialog \.sheet-header\{padding:10px 16px\}/);
  assert.match(workstation,/#supply-dialog \.sheet-body\{padding:8px 14px 14px;gap:10px\}/);
});
