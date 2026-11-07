import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {phaseAppearanceFor,NEUTRAL_LIQUID_COLOR,NEUTRAL_GAS_COLOR} from '../src/molecule-phase-appearance.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const curated=JSON.parse(await readFile(new URL('../data/phase-appearance.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
assert.equal(records.length,142);
assert.equal(byId.size,142);
assert.equal(Object.keys(curated).length,11);
for(const record of records){
  for(const phase of ['liquid','gas']){
    const researched=curated[record.id]?.[phase];
    const expected=researched?{
      kind:researched.kind,
      ...(researched.kind==='colored'?{renderColor:researched.renderColor}:{}),
      sourceUrl:researched.sourceUrl,
    }:{kind:'none'};
    assert.deepEqual(record.phaseAppearance[phase],expected,`${record.id}.${phase}`);
    const appearance=phaseAppearanceFor(record,phase);
    assert.equal(appearance.kind,expected.kind);
    assert.equal(appearance.renderColor,expected.kind==='colored'?expected.renderColor:phase==='liquid'?NEUTRAL_LIQUID_COLOR:NEUTRAL_GAS_COLOR);
    assert.equal(/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/compound\//.test(expected.sourceUrl??''),expected.kind!=='none');
  }
}
assert.equal(phaseAppearanceFor(byId.get('ozone'),'liquid').renderColor,'#2443bb');
assert.equal(phaseAppearanceFor(byId.get('chlorine'),'gas').renderColor,'#c1d864');
assert.equal(phaseAppearanceFor(byId.get('ethanol'),'liquid').kind,'colorless');
assert.equal(phaseAppearanceFor(byId.get('methane'),'liquid').kind,'none');
assert.equal(phaseAppearanceFor(byId.get('methane'),'liquid').renderColor,NEUTRAL_LIQUID_COLOR);
assert.throws(()=>phaseAppearanceFor(byId.get('water'),'solid'),/Unknown phase/);
console.log('Phase appearance: 142 DB records, 11 sourced substances, neutral fallback and phase-specific color PASS.');
