import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moleculeDisplayName} from '../src/collection-catalog.js';
import {moleculeNameFuriganaParts} from '../src/molecule-name-furigana.js';

const database=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url),'utf8'));
const records=Array.isArray(database)?database:database.molecules;

test('all 48 kanji-containing molecule names have a reading without changing their visible spelling',()=>{
  let covered=0;
  for(const record of records){
    const name=moleculeDisplayName(record),parts=moleculeNameFuriganaParts(name);
    assert.equal(parts.map(part=>part.text).join(''),name,record.id);
    const ruby=parts.filter(part=>part.kind==='ruby');
    if(/[一-龯々]/u.test(name)){
      assert.equal(ruby.length,1,`${record.id}: missing name reading`);
      assert.match(ruby[0].reading,/^[ぁ-ゖー]+$/u,record.id);
      assert.match(ruby[0].text,/^[一-龯々]+$/u,record.id);
      covered++;
    }else assert.equal(ruby.length,0,`${record.id}: kana name needs no ruby`);
  }
  assert.equal(covered,48);
});

test('mixed kana/kanji names annotate only the kanji part',()=>{
  assert.deepEqual(moleculeNameFuriganaParts('フッ化水素'),[
    {kind:'text',text:'フッ'},
    {kind:'ruby',text:'化水素',reading:'かすいそ'},
  ]);
  assert.deepEqual(moleculeNameFuriganaParts('酢酸エチル'),[
    {kind:'ruby',text:'酢酸',reading:'さくさん'},
    {kind:'text',text:'エチル'},
  ]);
  assert.deepEqual(moleculeNameFuriganaParts('二酸化炭素'),[
    {kind:'ruby',text:'二酸化炭素',reading:'にさんかたんそ'},
  ]);
});

test('unknown and undiscovered names remain plain text',()=>{
  assert.deepEqual(moleculeNameFuriganaParts('???'),[{kind:'text',text:'???'}]);
  assert.deepEqual(moleculeNameFuriganaParts('未登録化合物'),[{kind:'text',text:'未登録化合物'}]);
});
