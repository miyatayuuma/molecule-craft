import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moleculeSummaryGlossarySegments} from '../src/encyclopedia-glossary.js';

const summary=(segments)=>segments.map(segment=>segment.text).join('');
const terms=(segments)=>segments.filter(segment=>segment.kind==='term');

test('molecule descriptions keep their original text and show at most three curated terms',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../data/encyclopedia.json',import.meta.url),'utf8'));
  for(const [id,entry] of Object.entries(catalog.molecules)){
    const segments=moleculeSummaryGlossarySegments(entry.description);
    assert.equal(summary(segments),entry.description,id);
    assert.ok(terms(segments).length<=3,id);
    for(const segment of terms(segments))assert.ok(segment.meaning.length>0,id);
  }
});

test('everyday words as well as science vocabulary get brief meanings',()=>{
  const segments=moleculeSummaryGlossarySegments('空気の約2割を占める気体。燃焼を支える。');
  assert.deepEqual(terms(segments).map(item=>item.text),['占める','燃焼']);
});

test('longer technical terms are not split into misleading shorter explanations',()=>{
  assert.deepEqual(terms(moleculeSummaryGlossarySegments('不完全燃焼で二酸化炭素が生じる。')).map(item=>item.text),['不完全燃焼']);
  assert.deepEqual(terms(moleculeSummaryGlossarySegments('芳香族化合物をつくる。')).map(item=>item.text),['芳香族化合物']);
});

test('no targets or a disabled limit leave plain text unchanged',()=>{
  assert.deepEqual(moleculeSummaryGlossarySegments('水です。'),[{kind:'text',text:'水です。'}]);
  assert.deepEqual(moleculeSummaryGlossarySegments('燃焼', {limit:0}),[{kind:'text',text:'燃焼'}]);
});
