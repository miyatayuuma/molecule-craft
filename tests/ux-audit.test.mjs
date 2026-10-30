import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createElementPalette,syncElementStocks,ELEMENT_PRESENTATION} from '../src/element-progression.js';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const shell=await readFile(new URL('../src/game-shell.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');

test('First-time exploration has a visible path and the retired reset/help UI is absent',()=>{
  assert.match(html,/id="first-step-tip"/);
  assert.match(html,/id="first-step-explore"/);
  assert.match(html,/class="collector-access-label">探索<\/span>/);
  assert.match(html,/id="supply-launch"/);
  assert.match(html,/id="supply-region-choices"/);
  for(const retired of ['reset-selected','reset-status','help-dialog','help-done','show-extra-elements','game-loop-hint']){
    assert.doesNotMatch(html,new RegExp(`id="${retired}"`),`${retired} should not survive as dead production markup`);
    assert.doesNotMatch(shell,new RegExp(`['"]#${retired}['"]`),`${retired} should not be hidden at runtime`);
  }
});

test('Every element is visible, but stock and canonical access still guard placement',()=>{
  const allowed=new Set(['H','C','O']);
  const buttons=ELEMENT_PRESENTATION.map(item=>({dataset:{element:item.symbol,stockCount:'2'},style:{order:0,setProperty(){}},hidden:false,disabled:false,title:'',setAttribute(key,value){this[key]=value;},querySelector(){return this.stock??(this.stock={textContent:''});}}));
  const root={querySelectorAll:()=>buttons};
  const palette=createElementPalette(root,{canUse:symbol=>allowed.has(symbol)});
  syncElementStocks(root,{H:3,C:2,O:0,N:5});
  assert.equal(buttons.filter(item=>!item.hidden).length,ELEMENT_PRESENTATION.length);
  assert.equal(buttons.find(item=>item.dataset.element==='N').disabled,true,'Holding a locked element must not enable it');
  assert.equal(buttons.find(item=>item.dataset.element==='O').disabled,true,'Zero stock must not enable an unlocked element');
  assert.equal(buttons.find(item=>item.dataset.element==='H').disabled,false);
  assert.equal(palette.canUse('N'),false);
});

test('Reaction catalog authority initializes independently of WebGL viewer availability',()=>{
  const authority=app.indexOf('const reactionAuthority=createReactionCatalogAuthority');
  const viewer=app.indexOf('reactionLabViewer=createReactionLabViewer');
  assert.ok(authority>0&&viewer>authority);
  assert.match(app,/if\(!reactionLabViewer\)\{/);
});
