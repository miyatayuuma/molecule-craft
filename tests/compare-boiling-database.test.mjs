import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {boilingValueFor,boilingSourceFor,KNOWN_BOILING_POINT_COUNT} from '../src/compare-boiling-data.js';
import {buildComparisonRows} from '../src/encyclopedia-compare.js';

test('normal-pressure boiling-point database retains sources and excludes decomposition or sublimation',async()=>{
  const molecules=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
  const database=JSON.parse(await readFile(new URL('../data/boiling-points.json',import.meta.url)));
  const ids=new Set(molecules.map(entry=>entry.id));
  const entries=Object.entries(database.compounds);
  assert.equal(entries.length,107);
  assert.equal(KNOWN_BOILING_POINT_COUNT,entries.length);
  for(const [id,entry] of entries){
    assert.ok(ids.has(id),`unknown molecule: ${id}`);
    assert.ok(Number.isFinite(entry.celsius));
    assert.ok(entry.sourceNames.length>=1,`missing source: ${id}`);
    assert.equal(boilingValueFor(id),entry.celsius);
    assert.match(boilingSourceFor(id),new RegExp(`/compound/${entry.pubchemCid}/`));
  }
  assert.equal(boilingValueFor('water'),100);
  assert.equal(boilingValueFor('ethanol'),78.4);
  assert.equal(boilingValueFor('n-butane'),-.5);
  assert.equal(boilingValueFor('hydrogen'),-252.8,'hydrogen melting point must not be mistaken for boiling');
  for(const id of ['carbon-dioxide','phosphorus-pentachloride','ethyne','glycerol','2-butene','2-4-6-trinitrotoluene']){
    assert.equal(boilingValueFor(id),null,`${id} has no applicable unambiguous boiling point`);
  }
  const discoveredIds=new Set(['water']);
  const {rows,missing}=buildComparisonRows(molecules,{axis:'boilingPoint',discoveredIds});
  assert.equal(rows.length,107);
  assert.equal(missing.length,35);
  assert.equal(rows.filter(row=>row.discovered).length,1);
  assert.ok(rows.every((row,index)=>index===0||rows[index-1].value<=row.value));
});
