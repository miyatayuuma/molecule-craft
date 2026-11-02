import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {partNameFuriganaParts} from '../src/part-name-furigana.js';

const groups=JSON.parse(readFileSync(new URL('../data/functional-groups.json',import.meta.url),'utf8'))
  .filter(group=>group.learningRole==='part');

test('all 17 part names preserve their text and show readings on kanji suffixes',()=>{
  assert.equal(groups.length,17);
  for(const group of groups){
    const parts=partNameFuriganaParts(group.nameJa);
    assert.equal(parts.map(part=>part.text).join(''),group.nameJa,group.id);
    const ruby=parts.filter(part=>part.kind==='ruby');
    assert.equal(ruby.length,1,group.id);
    assert.equal(ruby[0].reading,ruby[0].text==='基'?'き':'けつごう',group.id);
  }
});

test('undiscovered entries remain hidden and unknown names stay unchanged',()=>{
  assert.deepEqual(partNameFuriganaParts('???'),[{kind:'text',text:'???'}]);
  assert.deepEqual(partNameFuriganaParts('未登録'),[{kind:'text',text:'未登録'}]);
  assert.deepEqual(partNameFuriganaParts('エステル結合'),[
    {kind:'text',text:'エステル'},
    {kind:'ruby',text:'結合',reading:'けつごう'},
  ]);
});
