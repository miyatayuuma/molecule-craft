import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pngPixels,maskColor} from './helpers/polymer-task5-visual.mjs';
const root=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
const read=p=>JSON.parse(fs.readFileSync(new URL(p,root)));
const zip=p=>JSON.parse(gunzipSync(fs.readFileSync(new URL(p,root))));
const audit=read('pib-model-consistency-8227174d/seed-consistency.json');
const active=zip('pib-active-constraints-8227174d/active-model.json.gz');

test('known seed is represented with only the two specified diagnostic conditions disabled',()=>{
  assert.equal(audit.knownStateRepresentable,true);
  assert.deepEqual(audit.disabledOnly,['bond33 area','bond34 continuity']);
  assert.ok(Object.values(audit.guards).every(Boolean));
  assert.ok(audit.actualGrade.atoms.every(a=>a.pass));
  assert.deepEqual(audit.actualGrade.bonds.filter(b=>!b.pass).map(b=>b.index),[33,34]);
  for(const row of audit.rows){
    if(row.id!==1057)assert.equal(row.areaPass,true);
    if(row.continuity&&row.index!==34)assert.ok(row.continuity.model>=7.75);
  }
  const c=audit.rows.find(r=>r.id===31);
  assert.equal(c.rawPixels,827);assert.equal(c.modelPixels,823);assert.ok(c.modelPixels>c.requiredArea);
  assert.equal(c.falseNegatives.filter(p=>p.rejectingConditions.every(f=>f.value>=0)).length,1);
  assert.equal(c.falseNegatives.filter(p=>p.rejectingConditions.some(f=>f.value<0)).length,3);
  assert.ok(c.falseNegatives.every(p=>p.inPool&&!p.annotationBoundary));
  for(const r of audit.rows)assert.ok(r.falseNegatives.every(p=>p.inPool),'no seed-owned pixel missing from the finite pool');
  const solver=read('pib-model-consistency-8227174d/zero-delta-solver.json');
  assert.equal(solver.status,0);assert.deepEqual(solver.deltaDegrees,[0,0,0]);
});

test('corrected native-quantized seed membership equals the entire saved pixel set for all5 active objects',()=>{
  const mask=pngPixels(fs.readFileSync(new URL('pib-boundary-92da7771/baseline-CPU-id.png',root)));
  assert.deepEqual(active.objects.map(o=>o.id),[31,1056,1057,1058,1059]);
  for(const o of active.objects){
    const actual=[];for(let i=0;i<mask.width*mask.height;i++){const k=i*mask.channels,key=(mask.pixels[k]<<16)|(mask.pixels[k+1]<<8)|mask.pixels[k+2];if(key===maskColor(o.id))actual.push(i);}
    const predicted=o.cells.filter(c=>!c.annotationBoundary&&c.conditions.every(f=>f.value>=0)&&c.disjunctions.every(d=>d.some(f=>f.value>=0))).map(c=>c.y*mask.width+c.x).sort((a,b)=>a-b);
    assert.deepEqual(predicted,actual,'compare set identity rather than just counts');
  }
  const corrected=read('pib-active-constraints-8227174d/active-zero-delta-solver.json');
  assert.equal(corrected.status,0);assert.deepEqual(corrected.deltaDegrees,[0,0,0]);
  const corrected35=active.objects.find(o=>o.id===1059).cells.find(c=>c.x===199&&c.y===184);
  assert.ok(corrected35.disjunctions.some(d=>d.some(f=>f.key.startsWith('depth:34:1059:'))),'overlapping native front facet must be considered even if old midpoint depth omitted it');
});

test('Big-M implications, depth OR, ceil arithmetic and independent fixed-seed primals verify without any solver calls',()=>{
  const result=spawnSync('python',['scripts/verify-polymer-task5-model-logic.py',new URL('.',root).pathname],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);const v=JSON.parse(result.stdout);
  assert.equal(v.implicationTruthCases,972);assert.equal(v.depthOrCases.length,5);
  assert.deepEqual(v.ceilCases.map(c=>c.requiredHits),[17,17,18,17,17]);
  assert.equal(v.oldSeedWitness.maxViolation,0);assert.equal(v.activeSeedWitness.maxViolation,0);
  assert.equal(v.solverCalls,0);assert.equal(v.rasters,0);
  assert.deepEqual(v,read('pib-model-consistency-8227174d/logic-and-primal.json'));
});

test('fixed2 new active slots are not native failures or an impossibility proof; old12 remain frozen',()=>{
  const results=zip('pib-active-constraints-8227174d/results.json.gz');
  assert.equal(results.rows.length,2);assert.equal(results.CPURasters,0);assert.equal(results.CPUJointWitness,false);
  assert.equal(results.certifiedExcludedRegions,0);
  assert.deepEqual(results.rows.map(r=>r.steps34),[26,27]);
  assert.ok(results.rows.every(r=>r.solver.status===2&&!r.hasIncumbent&&r.observations.length===0));
  assert.equal(zip('pib-pixel-exchange-a664c1da/results.json.gz').rows.length,12);
  const manifest=read('pib-model-consistency-8227174d/manifest.json');
  assert.equal(manifest.disposition,'UNRESOLVED');assert.equal(manifest.modelConsistency,'PASS_AT_FIXED_SEED');
  for(const item of manifest.files){const bytes=fs.readFileSync(new URL(item.path,root));assert.equal(bytes.length,item.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);}
});
