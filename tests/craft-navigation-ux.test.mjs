import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGameShell} from '../src/game-shell.js';

const root=new URL('../',import.meta.url);
const [craftPanel,pubchemReference,supply,craftControls]=await Promise.all([
  readFile(new URL('src/craft-panel.js',root),'utf8'),
  readFile(new URL('src/pubchem-reference.js',root),'utf8'),
  readFile(new URL('src/veil/supply.js',root),'utf8'),
  readFile(new URL('src/craft-controls.js',root),'utf8'),
]);

function node(id=''){
  return{id,className:'',textContent:'',style:{},attributes:new Map(),listeners:new Map(),children:[],
    setAttribute(key,value){this.attributes.set(key,String(value));},removeAttribute(key){this.attributes.delete(key);},getAttribute(key){return this.attributes.get(key)??null;},
    addEventListener(type,handler){this.listeners.set(type,handler);},querySelector(){return null;},querySelectorAll(){return[];},replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);},
    classList:{add(){},remove(){}},matches(){return false;},closest(){return null;}};
}

test('CRAFT collector access remains the exploration-machine control',()=>{
  const access=node('open-supply');access.className='collector-access';access.textContent='';const originalNavigation=()=>{};access.listeners.set('click',originalNavigation);
  const document={
    getElementById(id){return id==='open-supply'?access:null;},
    querySelector(){return null;},
    querySelectorAll(){return[];},
  };
  const previous=globalThis.document;globalThis.document=document;
  try{createGameShell();}finally{globalThis.document=previous;}

  assert.equal(access.listeners.get('click'),originalNavigation,'Existing exploration binding stays on the collector-access node');
  assert.equal(access.className,'collector-access','Game-shell chrome must not repurpose the exploration-machine button');
  assert.equal(access.textContent,'');
  assert.match(supply,/accessCanvas\.id='collector-access-preview'/,'The exploration-machine preview remains owned by supply UI');
  assert.match(supply,/access\.append\(accessCanvas\)/,'The machine icon remains mounted in the access button');
  assert.match(supply,/access\.setAttribute\('aria-label','探索機を開く'\)/,'The control keeps exploration semantics');
});

test('CRAFT history undo is visibly distinct from destructive cleanup',()=>{
  assert.match(craftControls,/undo\.textContent='← 戻す'/,'Undo uses a clear leftward affordance plus a short label');
  assert.match(craftControls,/直前のCRAFT操作を元に戻す/,'Accessible semantics remain undo rather than navigation');
  assert.match(craftControls,/marginRight:'12px'/,'Undo is spatially separated from the destructive clear control');
  assert.match(craftControls,/clear\.className='hold-clear icon-button'/,'Clear remains the destructive cleanup control');
  assert.match(craftControls,/document\.querySelector\('#undo-cleanup'\)\?\.addEventListener\('click',onUndo\)/,'Undo behavior is unchanged');
  assert.doesNotMatch(craftControls,/undo\.textContent='↶'/,'The old ambiguous curved-arrow presentation is removed');
});

test('PubChem stays with molecule identity and remains an explicit external link',()=>{
  assert.match(craftPanel,/nodes\.formula\.append\(nodes\.pubchem\)/,'PubChem remains in the formula information group');
  assert.match(craftPanel,/pubchemLink\.target='_blank'/);
  assert.match(craftPanel,/pubchemLink\.rel='noopener noreferrer external'/);
  assert.match(craftPanel,/PubChemでこの分子を調べる（外部サイト）/);
  assert.match(craftPanel,/marginLeft:'0'/);
  assert.match(craftPanel,/borderLeft:'0'/);
  assert.match(craftPanel,/pubchemReferenceFor\(focus\)/,'Molecule changes keep driving the PubChem mapping');
  assert.match(pubchemReference,/return'PubChem ↗'/,'The external-link affordance never collapses to a bare arrow');
});
