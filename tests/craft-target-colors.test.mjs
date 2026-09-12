import test from 'node:test';
import assert from 'node:assert/strict';
import {ELEMENTS} from '../src/chemistry.js?v=20';
import {renderCraftTargetAtoms,renderCraftTargetParts} from '../src/craft-panel.js';

function createNode(tagName,ownerDocument){
  return{
    tagName:tagName.toUpperCase(),ownerDocument,className:'',dataset:{},style:{cssText:'',minHeight:'',padding:''},attributes:new Map(),children:[],textContent:'',hidden:false,
    setAttribute(name,value){this.attributes.set(name,String(value));},
    getAttribute(name){return this.attributes.get(name)??null;},
    addEventListener(){},
    append(...nodes){this.children.push(...nodes);},
    appendChild(node){this.children.push(node);return node;},
  };
}
function createContainer(){
  const document={createElement(tagName){return createNode(tagName,document);}},container=createNode('div',document);
  container.replaceChildren=function(...nodes){this.children=[...nodes];};
  return container;
}
function assertCanonicalAtom({slot,node}){
  const color=ELEMENTS[slot.symbol].color;
  assert.ok(node.style.cssText.includes(color),`${slot.symbol} should use canonical ${color}`);
  assert.doesNotMatch(node.style.cssText,/saturate\(|brightness\(|#344451|#60717d/,'Legacy unfilled gray treatment must be absent');
}

test('craft target atoms keep canonical element color regardless of filled state',()=>{
  const record={atoms:[{element:'H'},{element:'H'},{element:'C'},{element:'O'}]};
  const initial=renderCraftTargetAtoms(createContainer(),record,[]);
  initial.forEach(assertCanonicalAtom);
  assert.equal(new Set(initial.map(({slot})=>ELEMENTS[slot.symbol].color)).size,3,'H, C and O must retain distinct canonical colors');

  const mixed=renderCraftTargetAtoms(createContainer(),record,[{element:'H'}]);
  mixed.forEach(assertCanonicalAtom);
  const filledH=mixed.find(({slot})=>slot.symbol==='H'&&slot.filled),remainingH=mixed.find(({slot})=>slot.symbol==='H'&&!slot.filled);
  assert.ok(filledH&&remainingH,'Filled state must remain available for placement bookkeeping');
  assert.equal(filledH.node.style.cssText,remainingH.node.style.cssText,'Filled state must not alter atom color styling');
  assert.equal(filledH.node.dataset.filled,'true');
  assert.equal(remainingH.node.dataset.filled,'false');
  assert.equal(filledH.node.getAttribute('aria-label'),'水素 配置済み');
  assert.equal(remainingH.node.getAttribute('aria-label'),'水素 未配置');
});

test('target part element items use canonical color without changing part presentation',()=>{
  const parts=[
    {element:'H'},
    {element:'O'},
    {partId:'hydroxyl',template:{id:'hydroxyl',nameJa:'ヒドロキシ基',notation:'–OH',atoms:['O','H'],attachments:[{atom:0}] }},
  ];
  const rendered=renderCraftTargetParts(createContainer(),parts,[],{onPlace:()=>{}}),atoms=rendered.filter(({slot})=>slot),part=rendered.find(({item})=>item.partId==='hydroxyl');
  atoms.forEach(assertCanonicalAtom);
  assert.equal(atoms[0].node.getAttribute('aria-label'),'水素をクラフト台へ出す');
  assert.equal(atoms[1].node.getAttribute('aria-label'),'酸素をクラフト台へ出す');
  assert.equal(part.node.className,'craft-target-part');
  assert.equal(part.node.children[1].className,'craft-target-part-formula');
  assert.equal(part.node.children[1].textContent,'–OH');
});
