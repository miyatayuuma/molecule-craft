import {readFile,writeFile} from 'node:fs/promises';

async function text(path){return readFile(new URL(`../${path}`,import.meta.url),'utf8');}
async function write(path,content){await writeFile(new URL(`../${path}`,import.meta.url),content);}
function replaceOnce(source,oldText,newText,label){
  if(source.includes(newText))return source;
  if(!source.includes(oldText))throw new Error(`Missing patch anchor: ${label}`);
  return source.replace(oldText,newText);
}
async function patch(path,changes){
  let source=await text(path);
  for(const [oldText,newText,label] of changes)source=replaceOnce(source,oldText,newText,label);
  await write(path,source);
}

await write('src/element-progression.js',`// Presentation order and labels only. Gameplay access is owned by resources.canUseElement().
export const ELEMENT_PRESENTATION = Object.freeze([
  {symbol:'H', name:'水素'},
  {symbol:'C', name:'炭素'},
  {symbol:'O', name:'酸素'},
  {symbol:'N', name:'窒素'},
  {symbol:'Cl', name:'塩素'},
  {symbol:'S', name:'硫黄'},
  {symbol:'P', name:'リン'},
  {symbol:'F', name:'フッ素'},
].map(Object.freeze));

// Compatibility alias for presentation consumers. There are no discovery-count gates.
export const ELEMENT_UNLOCKS = ELEMENT_PRESENTATION;
const ELEMENT_SYMBOLS=Object.freeze(ELEMENT_PRESENTATION.map(item=>item.symbol));
export function availableElements(){return [...ELEMENT_SYMBOLS];}
export function nextElementUnlock(){return null;}

export function syncElementStocks(root = document, elements = {}) {
  for (const button of root.querySelectorAll('#element-palette [data-element]')) {
    const symbol=button.dataset.element,stock=button.querySelector('[data-element-stock]');
    if(!stock)continue;
    const count=Math.max(0,Number(elements[symbol]??0));
    stock.textContent=String(count);button.dataset.stockCount=String(count);
    button.disabled=button.hidden||count<=0;
    const item=ELEMENT_PRESENTATION.find(item=>item.symbol===symbol);
    if(item)button.setAttribute('aria-label',\`${'${item.name}'}（${'${symbol}'}） 在庫 ${'${count}'}\`);
  }
}

// Visibility scope is presentation-only. The injected access function is the
// sole gameplay authority; collection counts and fallback mode cannot unlock atoms.
export function createElementPalette(root = document, {canUse=()=>true} = {}) {
  const buttons=[...root.querySelectorAll('#element-palette [data-element]')];
  const extra=root.querySelector('#show-extra-elements'),visible=symbol=>['H','C','O'].includes(symbol)||!!extra?.checked;
  function render(){
    for(const button of buttons){
      const item=ELEMENT_PRESENTATION.find(item=>item.symbol===button.dataset.element);
      if(!item)continue;
      button.hidden=!visible(item.symbol)||!canUse(item.symbol);button.disabled=button.hidden||Number(button.dataset.stockCount??0)<=0;
      button.style.order=ELEMENT_PRESENTATION.indexOf(item);
      button.title=\`${'${item.name}'}（${'${item.symbol}'}）を追加\`;
    }
  }
  extra?.addEventListener('change',render);
  render();
  return {
    canUse:symbol=>ELEMENT_SYMBOLS.includes(symbol)&&visible(symbol)&&canUse(symbol),
    update(){render();},
    fallback(){render();},
  };
}
`);

await patch('src/collection-state.js',[
  ["import { availableElements } from './element-progression.js?v=36';","import { ELEMENT_PRESENTATION } from './element-progression.js?v=38';",'collection presentation import'],
  ['  let elements=new Set(availableElements(0));','  const elements=new Set(ELEMENT_PRESENTATION.map(item=>item.symbol));','collection element set'],
  ['  function updateUnlocks(){\n    elements=new Set(availableElements(molecules.size,legacyElements));\n    for(const template of templates)if(template.atoms.every(element=>elements.has(element)&&elementAccess(element))&&(sources.get(template.unlock.groupId)?.size??0)>=template.unlock.distinctMolecules)unlocked.add(template.id);\n  }',"  function updateUnlocks(){\n    for(const template of templates)if(template.atoms.every(element=>elements.has(element)&&elementAccess(element))&&(sources.get(template.unlock.groupId)?.size??0)>=template.unlock.distinctMolecules)unlocked.add(template.id);\n  }",'collection update unlocks'],
  ["          const previousGroups=new Set(sources.keys()),previousUnlocks=new Set(unlocked),previousElements=new Set(elements);","          const previousGroups=new Set(sources.keys()),previousUnlocks=new Set(unlocked);",'collection previous elements'],
  ["          event.unlockedElements=[...elements].filter(id=>!previousElements.has(id));","          event.unlockedElements=[];",'collection discovery element event'],
]);

await patch('src/veil/resources-persistence.js',[
  ["export const MANAGED_ELEMENTS=['H','C','O'];\nexport const STOCKED_ELEMENTS", "export const MANAGED_ELEMENTS=['H','C','N','O'];\nexport const DUST_ELEMENTS=['H','C','O'];\nexport const STOCKED_ELEMENTS", 'resource element classes'],
  ["const MANAGED=MANAGED_ELEMENTS,integer=isResourceInteger,validId=isValidResourceId;","const MANAGED=MANAGED_ELEMENTS,DUST=DUST_ELEMENTS,integer=isResourceInteger,validId=isValidResourceId;",'persistence aliases'],
  ["for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');","for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');",'atom balance validation'],
]);

await patch('src/veil/resources.js',[
  ["import { availableElements } from '../element-progression.js?v=37';\n",'', 'remove discovery availability import'],
  ["MANAGED_ELEMENTS,STOCKED_ELEMENTS,createInitialProgress", "MANAGED_ELEMENTS,DUST_ELEMENTS,STOCKED_ELEMENTS,createInitialProgress", 'dust element import'],
  ["const COLLECTION_KEY='molecule-craft.collection.v1',MANAGED=MANAGED_ELEMENTS,STOCKED=STOCKED_ELEMENTS,MAX=MAX_RESOURCE_VALUE;", "const COLLECTION_KEY='molecule-craft.collection.v1',MANAGED=MANAGED_ELEMENTS,DUST=DUST_ELEMENTS,STOCKED=STOCKED_ELEMENTS,MAX=MAX_RESOURCE_VALUE;\nconst PLAYER_ACCESS_ELEMENTS=Object.freeze(['H','C','O']),PLAYER_ACCESS=new Set(PLAYER_ACCESS_ELEMENTS);\nexport function progressionElementAccessible(progress,element){return STOCKED.includes(element)&&PLAYER_ACCESS.has(element)&&Array.isArray(progress?.foundElements)&&progress.foundElements.includes(element);}\nconst expeditionElements=units=>MANAGED.filter(el=>DUST.includes(el)||Object.hasOwn(units??{},el));", 'canonical access policy'],
  ["function expeditionLoss(units,rate){\n  const exact=MANAGED.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));\n  let remaining=Math.floor(MANAGED.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-MANAGED.reduce((sum,el)=>sum+lost[el],0);", "function expeditionLoss(units,rate){\n  const elements=expeditionElements(units),exact=elements.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));\n  let remaining=Math.floor(elements.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-elements.reduce((sum,el)=>sum+lost[el],0);", 'expedition active resource elements'],
  ["const discoveredIds=[...state.recipes],knownRecipeIds=[...new Set([...state.hints,...FRONTIER_RESERVED_IDS])],graphCandidates=getFrontierCandidates(frontierGraph,{discoveredIds,knownRecipeIds}),unlockedElements=new Set(availableElements(state.recipes.length)),candidates=graphCandidates.filter(candidate=>{const record=records.get(candidate.id);return !!record&&Array.isArray(record.atoms)&&record.atoms.length>0&&record.atoms.every(el=>unlockedElements.has(el)&&(!MANAGED.includes(el)||state.progress.foundElements.includes(el)));});", "const discoveredIds=[...state.recipes],knownRecipeIds=[...new Set([...state.hints,...FRONTIER_RESERVED_IDS])],graphCandidates=getFrontierCandidates(frontierGraph,{discoveredIds,knownRecipeIds}),candidates=graphCandidates.filter(candidate=>{const record=records.get(candidate.id);return !!record&&Array.isArray(record.atoms)&&record.atoms.length>0&&record.atoms.every(el=>api.canUseElement(el));});", 'frontier canonical access'],
  ["canUseElement:el=>!MANAGED.includes(el)||state.progress.foundElements.includes(el),", "canUseElement:el=>progressionElementAccessible(state.progress,el),", 'resource canUse authority'],
  ["collectDust(units,best){if(blocked||!Object.entries(units).every(([el,n])=>MANAGED.includes(el)&&integer(n)))return [];", "collectDust(units,best){if(blocked||!Object.entries(units).every(([el,n])=>DUST.includes(el)&&integer(n)))return [];", 'dust-only accumulator'],
  ["      const snapshot=copy(state),kept={},before={...state.elements},rate=captured?EXPEDITION.captureLoss:0,lost=expeditionLoss(units,rate);\n      for(const el of MANAGED)kept[el]=(units[el]??0)-lost[el];", "      const snapshot=copy(state),kept={},before={...state.elements},rate=captured?EXPEDITION.captureLoss:0,lost=expeditionLoss(units,rate),elements=expeditionElements(units);\n      for(const el of elements)kept[el]=(units[el]??0)-lost[el];", 'settlement active elements'],
  ["      const persistentHints=[...state.hints],found=api.collectDust(kept,best);state.hints.length=0;state.hints.push(...persistentHints);", "      const persistentHints=[...state.hints],dustKept=Object.fromEntries(Object.entries(kept).filter(([el])=>DUST.includes(el))),directKept=Object.fromEntries(Object.entries(kept).filter(([el])=>!DUST.includes(el))),found=api.collectDust(dustKept,best);for(const el of api.collect(directKept,0))if(!found.includes(el))found.push(el);state.hints.length=0;state.hints.push(...persistentHints);", 'N direct settlement foundation'],
  ["const frontierInsight=finalizeFrontierRun(captured,insights,committedInsights),atoms={};for(const el of MANAGED)atoms[el]=state.elements[el]-before[el];", "const frontierInsight=finalizeFrontierRun(captured,insights,committedInsights),atoms={};for(const el of elements)atoms[el]=state.elements[el]-before[el];", 'settlement result shape'],
]);

await patch('src/veil/map.js',[
  ["const DEPLETION_LIMITS=Object.freeze({H:{start:120,full:700},C:{start:40,full:400},O:{start:60,full:320}});", "// N limits are a foundation default only; no current CHO route consumes N depletion.\nconst DEPLETION_LIMITS=Object.freeze({H:{start:120,full:700},C:{start:40,full:400},N:{start:120,full:425},O:{start:60,full:320}});", 'nitrogen depletion foundation'],
]);

await patch('src/app.js',[
  ["./element-progression.js?v=37", "./element-progression.js?v=38", 'app element progression cache'],
  ["./craft-connections.js?v=4", "./craft-connections.js?v=5", 'app craft connections cache'],
]);
await patch('src/collection-ui.js',[
  ["./collection-state.js?v=36", "./collection-state.js?v=37", 'collection state cache'],
  ["./element-progression.js?v=36", "./element-progression.js?v=38", 'collection element progression cache'],
]);
await patch('src/craft-connections.js',[
  ["./collection-ui.js?v=38", "./collection-ui.js?v=39", 'collection UI cache'],
]);

await patch('tests/collection-expansion.test.mjs',[
  ["const newGame=storage=>createCollectionState({records,groups,templates,storage});", "const CHO_ACCESS=symbol=>['H','C','O'].includes(symbol);\nconst newGame=(storage,elementAccess=CHO_ACCESS)=>createCollectionState({records,groups,templates,storage,elementAccess});", 'collection test access injection'],
  ["assert.deepEqual(availableElements(0),['H','C','O']);\nconst game=newGame(null);\nfor(const item of ELEMENT_UNLOCKS)assert.equal(game.canUseElement(item.symbol),item.discoveries===0);\nassert.equal(nextElementUnlock(0,game.unlockedElements()).remaining,3);\n// The entire gate ladder is achievable using initially available elements.\nconst initial=records.filter(entry=>game.canBuild(entry));assert.ok(initial.length>=15);\nfor(let i=0;i<15;i++){\n  const result=game.observeStructures([fixture(initial[i].id)]);\n  for(const item of ELEMENT_UNLOCKS)assert.equal(game.canUseElement(item.symbol),item.discoveries<=i+1,`${i+1}: ${item.symbol}`);\n  assert.deepEqual(result.events[0].unlockedElements,ELEMENT_UNLOCKS.filter(item=>item.discoveries===i+1).map(item=>item.symbol));\n  assert.deepEqual(game.observeStructures([fixture(initial[i].id)]).events[0].unlockedElements,[],'Repeats must not reaward gates');\n}\nassert.equal(nextElementUnlock(15,game.unlockedElements()),null);", "assert.deepEqual(availableElements(0),ELEMENT_UNLOCKS.map(item=>item.symbol));\nassert.equal(nextElementUnlock(0,[]),null,'Collection discovery counts no longer own element access');\nconst game=newGame(null);\nfor(const item of ELEMENT_UNLOCKS)assert.equal(game.canUseElement(item.symbol),CHO_ACCESS(item.symbol));\nconst initial=records.filter(entry=>game.canBuild(entry));assert.ok(initial.length>=15);\nfor(let i=0;i<15;i++){\n  const result=game.observeStructures([fixture(initial[i].id)]);\n  for(const symbol of ['N','Cl','S','P','F'])assert.equal(game.canUseElement(symbol),false,`${i+1}: ${symbol} must stay externally locked`);\n  assert.deepEqual(result.events[0].unlockedElements,[],'Molecule discoveries must not award element gates');\n}\nassert.equal(nextElementUnlock(15,game.unlockedElements()),null);", 'remove discovery gate ladder'],
  ["assert.ok(loop.isUnlocked('methyl')&&loop.isUnlocked('carboxyl')&&loop.canUseElement('N'));", "assert.ok(loop.isUnlocked('methyl')&&loop.isUnlocked('carboxyl')&&!loop.canUseElement('N'));", 'loop N remains locked'],
  ["const buttons=ELEMENT_UNLOCKS.map(item=>({dataset:{element:item.symbol,stockCount:'1'},style:{},hidden:false,disabled:false}));\nconst extra={checked:false,addEventListener(type,fn){this.change=fn;}},root={querySelectorAll:()=>buttons,querySelector:selector=>selector==='#show-extra-elements'?extra:null},palette=createElementPalette(root);", "const buttons=ELEMENT_UNLOCKS.map(item=>({dataset:{element:item.symbol,stockCount:'1'},style:{},hidden:false,disabled:false}));\nconst extra={checked:false,addEventListener(type,fn){this.change=fn;}},root={querySelectorAll:()=>buttons,querySelector:selector=>selector==='#show-extra-elements'?extra:null},palette=createElementPalette(root,{canUse:CHO_ACCESS});", 'palette authority injection'],
  ["extra.checked=true;extra.change();palette.update(loop);assert.ok(palette.canUse('N'));\npalette.fallback();assert.ok(buttons.every(button=>!button.hidden&&!button.disabled));assert.ok(palette.canUse('P'));", "extra.checked=true;extra.change();palette.update(loop);assert.equal(palette.canUse('N'),false);\npalette.fallback();assert.equal(palette.canUse('P'),false,'Data fallback cannot bypass canonical element access');", 'palette fallback lock'],
  ["console.log(`Expansion passed: 20 PubChem topologies, atom gates/migration, 3 named parts, recipe loop and palette failure fallback.`);", "console.log(`Expansion passed: 20 PubChem topologies, external atom authority/migration, 3 named parts, recipe loop and locked palette fallback.`);", 'collection test log'],
]);

await write('tests/element-authority-n-foundation.test.mjs',`import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createCollectionState} from '../src/collection-state.js';
import {inventoryDepletion} from '../src/veil/map.js';
import {createUniverse} from '../src/veil/universe.js';

const memory=(entries=[])=>{const data=new Map(entries);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));

test('resources.canUseElement is the gameplay authority and fails closed outside current CHO progression',()=>{
  const resources=createResources({storage:memory()});
  assert.equal(resources.canUseElement('H'),true);
  assert.equal(resources.canUseElement('C'),false);assert.equal(resources.canUseElement('O'),false);
  assert.equal(resources.findElement('C'),true);assert.equal(resources.findElement('O'),true);
  assert.equal(resources.canUseElement('C'),true);assert.equal(resources.canUseElement('O'),true);
  assert.equal(resources.findElement('N'),true,'N is a managed internal resource');
  for(const symbol of ['N','F','P','S','Cl','Xe',''])assert.equal(resources.canUseElement(symbol),false,`${symbol||'empty'} must not be gameplay-accessible`);
});

test('collection discovery count cannot unlock N or rare elements',async()=>{
  const [records,groups,templates]=await Promise.all([json('../data/molecules.json'),json('../data/functional-groups.json'),json('../data/craft-structures.json')]);
  const resources=createResources({storage:memory()});resources.findElement('C');resources.findElement('O');
  const collection=createCollectionState({records,groups,templates,storage:null,elementAccess:symbol=>resources.canUseElement(symbol)});
  const cho=records.filter(record=>record.atoms.every(symbol=>['H','C','O'].includes(symbol))).slice(0,30);
  const structures=cho.map(record=>({complete:true,record,graph:record,signature:record.id}));collection.observeStructures(structures);
  assert.ok(collection.discoveredCount>=15);
  for(const symbol of ['N','Cl','S','P','F'])assert.equal(collection.canUseElement(symbol),false,`${symbol} cannot unlock from discoveries`);
});

test('N collection, expedition settlement and schema-v8 reload preserve BASE STOCK while N stays locked',()=>{
  const storage=memory(),resources=createResources({storage});
  resources.collect({N:7});assert.equal(resources.state.elements.N,7);assert.equal(resources.canUseElement('N'),false);assert.equal(resources.save(),true);
  const reloaded=createResources({storage});assert.equal(reloaded.state.elements.N,7);assert.equal(reloaded.canUseElement('N'),false);
  const settled=reloaded.settleExpedition({H:0,C:0,O:0,N:11},0,false);
  assert.equal(settled.atoms.N,11);assert.equal(reloaded.state.elements.N,18);assert.equal(reloaded.canUseElement('N'),false);assert.equal(reloaded.save(),true);
  const again=createResources({storage});assert.equal(again.state.elements.N,18);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,8);
});

test('N depletion is computable without spawning N in the current CHO FIELD',()=>{
  assert.equal(inventoryDepletion({N:120},'N'),0);assert.ok(inventoryDepletion({N:300},'N')>0);assert.equal(inventoryDepletion({N:450},'N'),1);
  const seed=0x4e17,base=createUniverse(seed,{H:0,C:0,O:0}),nRich=createUniverse(seed,{H:0,C:0,N:100000,O:0});
  const signature=map=>map.dust.map(({route,element,x,y,kind,value})=>[route,element,x,y,kind,value]);
  assert.deepEqual(signature(nRich),signature(base),'N stock must not change existing CHO particle generation');
  assert.equal(nRich.dust.some(d=>d.element==='N'),false,'Nitrogen FIELD dust is explicitly out of scope');
});
`);

console.log('Applied Element Progression Authority / Nitrogen Resource Foundation patch.');
