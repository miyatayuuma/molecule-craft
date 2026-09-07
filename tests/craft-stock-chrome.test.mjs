import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('craft stock lives on atom buttons and cleanup is icon only',()=>{
  const html=fs.readFileSync('index.html','utf8');
  const shell=fs.readFileSync('src/game-shell.js','utf8');
  const palette=fs.readFileSync('src/element-progression.js','utf8');
  const workspace=fs.readFileSync('src/craft-workspace.js','utf8');
  assert.equal(html.includes('class=\"resource-stock\"'),false);
  for(const symbol of ['H','C','N','O','F','P','S','Cl'])assert.match(html,new RegExp(`data-element-stock=\"${symbol}\"`));
  const clear=html.match(/<button id=\"clear-all\"[\s\S]*?<\/button>/)?.[0]??'';
  const visible=clear.replace(/<svg[\s\S]*?<\/svg>/,'').replace(/<[^>]+>/g,'').trim();
  assert.match(clear,/cleanup-icon/);assert.equal(visible,'');assert.match(clear,/aria-label=\"[^\"]*片付ける[^\"]*\"/);
  assert.equal(shell.includes('.element-button small'),false);
  assert.match(palette,/export function syncElementStocks/);
  assert.match(workspace,/onStockChange/);
});
