import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildComparisonRows,comparisonDistance,comparisonValueLabel,layoutComparisonRows,nearestComparisonIndex} from '../src/encyclopedia-compare.js';
import {moleculeBasicProperties} from '../src/molecule-basic-properties.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const discoveredIds=new Set(['water','ethanol','methanol']);
const {rows,missing}=buildComparisonRows(records,{discoveredIds});
assert.equal(records.length,142);
assert.equal(rows.length,142,'All records, including undiscovered molecules, are positioned');
assert.deepEqual(missing,[],'Every molecule has existing atomic composition');
assert.equal(rows.filter(row=>row.discovered).length,3);
assert(rows.every(row=>row.discovered===discoveredIds.has(row.id)),'Discovery is the sole disclosure authority');
assert(rows.every((row,index)=>index===0||row.value>=rows[index-1].value));
assert.equal(rows.find(row=>row.id==='water').value,moleculeBasicProperties(records.find(record=>record.id==='water')).molarMass);

const {positions,spacings}=layoutComparisonRows(rows);
assert.equal(positions.length,142);
assert(positions.every((position,index)=>index===0||position>positions[index-1]));
assert(spacings.every(spacing=>spacing>=76),'No equal-valued pair overlaps');
assert.equal(comparisonDistance(0),76);
assert(comparisonDistance(100)>comparisonDistance(10));
assert(comparisonDistance(1000)<comparisonDistance(100)*2,'Large gaps are compressed');
assert.equal(nearestComparisonIndex(positions,positions[0]-500),0);
assert.equal(nearestComparisonIndex(positions,positions.at(-1)+500),rows.length-1);
assert.equal(nearestComparisonIndex(positions,(positions[0]+positions[1])/2),0,'Midpoint snap is deterministic');
assert.equal(comparisonValueLabel(rows.find(row=>row.id==='water').value),'18.02 g/mol');

for(let i=1;i<rows.length;i++)if(rows[i].value===rows[i-1].value){
  assert.equal(spacings[i-1],76,'Ties have minimum safe separation');
  assert(rows[i-1].id.localeCompare(rows[i].id,'en')<=0,'Ties have a stable secondary order');
}
const reordered=buildComparisonRows([...records].reverse(),{discoveredIds});
assert.deepEqual(reordered.rows.map(row=>row.id),rows.map(row=>row.id),'Order cannot depend on catalog traversal');
const newlyDiscovered=buildComparisonRows(records,{discoveredIds:new Set([...discoveredIds,rows[20].id])});
assert.deepEqual(newlyDiscovered.rows.map(row=>row.id),rows.map(row=>row.id),'Discovery must not move beads');
assert.deepEqual(layoutComparisonRows(newlyDiscovered.rows).positions,positions,'Discovery must not change string lengths');

const atomRows=buildComparisonRows(records,{axis:'atomCount',discoveredIds});
assert(atomRows.rows.every((row,index)=>index===0||row.value>=atomRows.rows[index-1].value));
assert(layoutComparisonRows(atomRows.rows,'atomCount').spacings.every(spacing=>spacing>=76));
assert.equal(comparisonValueLabel(3,'atomCount'),'3 個');
const absent=buildComparisonRows([...records,{id:'missing-science',atoms:[]}],{discoveredIds});
assert.deepEqual(absent.missing,['missing-science'],'Missing chemistry values are excluded, not guessed');
assert.equal(absent.rows.length,142);
console.log('MC-COMPARE-01 data checks passed: 142 beads, discovery privacy, stable ties, spacing, snapping, missing-data boundary, axis switching.');
