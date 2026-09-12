import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameShell} from '../src/game-shell.js';

const root=new URL('../',import.meta.url);
const [craftPanel,pubchemReference,supply]=await Promise.all([
  readFile(new URL('src/craft-panel.js',root),'utf8'),
  readFile(new URL('src/pubchem-reference.js',root),'utf8'),
  readFile(new URL('src/veil/supply.js',root),'utf8'),
]);

function node(id=''){
  return{id,className:'',textContent:'',style:{},attributes:new Map(),listeners:new Map(),children:[],
    setAttribute(key,value){this.attributes.set(key,String(value));},removeAttribute(key){this.attributes.delete(key);},getAttribute(key){return this.attributes.get(key)??null;},
    addEventListener(type,handler){this.listeners.set(type,handler);},querySelector(selector){if(selector==='#collector-access-preview'&&this.preview)return this.preview;return null;},
    querySelectorAll(){return[];},replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},
    classList:{add(){},remove(){}},matches(){return false;},closest(){return null;}};
}

test('CRAFT back chrome preserves navigation and separates the PubChem information link',()=>{
  const back=node('open-supply');back.preview={};const originalNavigation=()=>{};back.listeners.set('click',originalNavigation);
  const pubchem=node('pubchem');
  const document={
    defaultView:{},
    getElementById(id){return id==='open-supply'?back:null;},
    querySelector(selector){return selector==='.pubchem-link'?pubchem:null;},
    querySelectorAll(){return[];},
    createElement(){return node();},
  };
  const previous=globalThis.document;globalThis.document=document;
  try{createGameShell();}finally{globalThis.document=previous;}

  assert.equal(back.listeners.get('click'),originalNavigation,'Navigation binding stays on the same button node');
  assert.equal(back.className,'craft-navigation-back');
  assert.deepEqual(back.children.map(child=>child.textContent),['←','戻る']);
  assert.equal(back.children[0].getAttribute('aria-hidden'),'true');
  assert.equal(back.getAttribute('aria-label'),'探索機へ戻る');
  assert.equal(back.style.marginLeft,'0');assert.equal(back.style.marginRight,'auto');
  assert.equal(back.style.minHeight,'44px');
  assert.doesNotMatch(back.children.map(child=>child.textContent).join(''),/削除|片付け|ゴミ|trash/i);
  assert.match(supply,/q\('open-supply'\)\.addEventListener\('click'/,'Existing LOADOUT opening action remains the navigation destination');

  assert.equal(pubchem.getAttribute('aria-label'),'PubChemでこの分子を調べる（外部サイト）');
  assert.equal(pubchem.style.marginLeft,'0');assert.equal(pubchem.style.borderLeft,'0');
});

test('PubChem stays with molecule identity and remains an explicit external link',()=>{
  assert.match(craftPanel,/nodes\.formula\.append\(nodes\.pubchem\)/,'PubChem remains in the formula information group');
  assert.match(craftPanel,/pubchemLink\.target='_blank'/);
  assert.match(craftPanel,/pubchemLink\.rel='noopener noreferrer external'/);
  assert.match(craftPanel,/pubchemReferenceFor\(focus\)/,'Molecule changes keep driving the PubChem mapping');
  assert.match(pubchemReference,/return'PubChem ↗'/,'The external-link affordance never collapses to a bare arrow');
});
