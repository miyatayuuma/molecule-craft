import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {HAMAJIMA_TERM_REFERENCES,hamajimaTermReference,hamajimaTermSegments} from '../src/hamajima-term-reference.js';

const expected=Object.freeze({
  '極性':'42224001',
  '水素結合':'51112201',
  '官能基':'54112101',
  '構造異性体':'54113101',
  '混成軌道':'54119101',
  'π結合':'54119103',
  'σ結合':'54119102',
  '単結合':'42222201',
  '二重結合':'42222202',
  '三重結合':'42222203',
  '孤立電子対':'42222105',
});

for(const [term,pageId]of Object.entries(expected)){
  const reference=hamajimaTermReference(term);
  assert.equal(reference?.pageId,pageId,`${term}: verified individual page`);
  assert.equal(reference?.term,term,`${term}: link text authority remains the displayed term`);
  assert.equal(reference?.url,`https://www.hamajima.co.jp/rika/chemterm/${pageId}.html`);
}

for(const [term,reference]of Object.entries(HAMAJIMA_TERM_REFERENCES)){
  assert.match(reference.pageId,/^\d{8}$/u,`${term}: page ID is explicit`);
  assert.equal(reference.url,`https://www.hamajima.co.jp/rika/chemterm/${reference.pageId}.html`);
  assert.equal(hamajimaTermReference(term),reference,'Only exact displayed terms resolve.');
}

const longestCases=[
  ['無極性分子',['無極性分子']],
  ['非共有電子対',['非共有電子対']],
  ['極性分子と極性',['極性分子','極性']],
  ['孤立電子対・電子対',['孤立電子対','電子対']],
  ['エステル結合とエステル',['エステル結合','エステル']],
  ['酸化還元反応、酸化剤、酸化',['酸化還元反応','酸化剤','酸化']],
];
for(const [text,terms]of longestCases){
  assert.deepEqual(hamajimaTermSegments(text).filter(segment=>segment.kind==='term').map(segment=>segment.text),terms);
}

for(const term of ['キラリティ','芳香族性','位置異性','位置異性体','共鳴','形式電荷','結合次数','環ひずみ']){
  assert.equal(hamajimaTermReference(term),null,`${term}: no approximate reference mapping`);
  assert.deepEqual(hamajimaTermSegments(term),[{kind:'text',text:term}],`${term}: stays plain text`);
}

const encyclopedia=JSON.parse(await readFile(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
const functionalGroups=JSON.parse(await readFile(new URL('../data/functional-groups.json',import.meta.url),'utf8'));
const allProse=[];
for(const entry of Object.values(encyclopedia.molecules??{})){
  if(typeof entry.description==='string')allProse.push(entry.description);
  for(const detail of entry.details??[])for(const field of ['title','body'])if(typeof detail[field]==='string')allProse.push(detail[field]);
}
for(const entry of Object.values(encyclopedia.parts??{}))if(typeof entry.description==='string')allProse.push(entry.description);
for(const entry of functionalGroups)if(typeof entry.description==='string')allProse.push(entry.description);
const productionProse=allProse.join('\n');
for(const text of allProse){
  assert.equal(hamajimaTermSegments(text).map(segment=>segment.text).join(''),text,'Linked prose keeps its exact original text.');
}
const initialAllowlist=new Set(['共有結合','電子対','不対電子','共有電子対','非共有電子対','孤立電子対','単結合','二重結合','三重結合','配位結合','極性','電気陰性度','無極性分子','極性分子','分子間力','重合','水素結合','官能基','構造異性体','シス-トランス異性体','混成軌道','σ結合','π結合','ベンゼン環']);
for(const term of Object.keys(HAMAJIMA_TERM_REFERENCES).filter(term=>!initialAllowlist.has(term)))assert(productionProse.includes(term),`Additional audited term must occur in current player-facing prose: ${term}`);

const productionCases=[
  ['water',['極性','水素結合']],
  ['oxygen',['二重結合']],
  ['nitrogen',['三重結合']],
  ['ammonia',['孤立電子対','水素結合']],
  ['n-butane',['構造異性体']],
];
for(const [id,terms]of productionCases){
  const entry=encyclopedia.molecules[id];
  assert.ok(entry,`${id}: production encyclopedia entry exists`);
  const prose=[entry.description,...(entry.details??[]).flatMap(detail=>[detail.title,detail.body])].filter(Boolean).join('\n');
  for(const term of terms){
    assert.ok(prose.includes(term),`${id}: current production prose contains ${term}`);
    assert.ok(hamajimaTermSegments(prose).some(segment=>segment.kind==='term'&&segment.text===term),`${id}: ${term} receives its exact reference`);
  }
}

const hydroxylGroup=functionalGroups.find(entry=>entry.id==='hydroxyl');
assert.ok(hydroxylGroup?.description.includes('アルコール'),'Production functional-group prose contains its audited term.');
assert(hamajimaTermSegments(hydroxylGroup.description).some(segment=>segment.kind==='term'&&segment.text==='アルコール'),'Functional-group prose resolves only the exact term entry.');

console.log(`Hamajima term reference tests passed: ${Object.keys(HAMAJIMA_TERM_REFERENCES).length} exact terms, ${allProse.length} production prose fields.`);
