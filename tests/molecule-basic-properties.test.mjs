import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ATOMIC_WEIGHTS,moleculeBasicProperties} from '../src/molecule-basic-properties.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
assert.equal(records.length,142);
assert.deepEqual(Object.keys(ATOMIC_WEIGHTS).sort(),['C','Cl','F','H','N','O','P','S']);

for(const record of records){
  const basic=moleculeBasicProperties(record);
  assert.equal(basic.atomCount,record.atoms.length,record.id);
  assert.equal(basic.elementCount,new Set(record.atoms).size,record.id);
  assert.equal(basic.composition.reduce((sum,item)=>sum+item.count,0),basic.atomCount,record.id);
  assert(basic.molarMass>0&&Number.isFinite(basic.molarMass),record.id);
  assert.deepEqual(basic,moleculeBasicProperties(record),`${record.id}: calculation is deterministic`);
}

const water=moleculeBasicProperties(byId.get('water'));
assert.deepEqual(water.composition,[{symbol:'H',count:2},{symbol:'O',count:1}]);
assert.equal(water.atomCount,3);
assert.equal(water.elementCount,2);
assert.equal(water.molarMass.toFixed(2),'18.02');
assert.equal(moleculeBasicProperties(byId.get('methane')).molarMass.toFixed(2),'16.04');
assert.equal(moleculeBasicProperties(byId.get('carbon-dioxide')).molarMass.toFixed(2),'44.01');
assert.equal(moleculeBasicProperties(byId.get('ethanol')).molarMass.toFixed(2),'46.07');
assert.deepEqual(moleculeBasicProperties(byId.get('ethanol')),moleculeBasicProperties(byId.get('dimethyl-ether')),'Structural isomers have identical elemental composition and molar mass');
assert.throws(()=>moleculeBasicProperties({atoms:['H','X']}),/Unknown atomic weight/);
assert.throws(()=>moleculeBasicProperties({atoms:[]}),/nonempty atom list/);

console.log('Molecular basic properties validated for all 142 structures, including masses, composition, and isomer equivalence.');
