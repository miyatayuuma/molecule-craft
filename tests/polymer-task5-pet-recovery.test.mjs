import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPolymerFragment3DLayout,createSafePolymerFragmentPlan,polymerGeometryModel,polymerGeometryDiagnostics} from '../src/polymer-fragment-3d-layout.js';
const bytes=await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/hosted-pet-failure.json',import.meta.url));
const captured=JSON.parse(bytes),{sample}=captured.input.snapshot,options={sourceRecordsByInstanceId:captured.input.sources};
const digest=value=>createHash('sha256').update(value).digest('hex');
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
freeze(sample);freeze(options);
test('captured production PET: all chemical constraints jointly pass without changing graph, source, order or identity',()=>{
  assert.equal(digest(bytes),'82d84eb5181e9f758caf896b1978175e17a9b70ea454179a64bfce3cf15bf4ba');
  assert.equal(digest(JSON.stringify(sample.fragment)),'ac71c980c5105222e7d2b217da840d403c89349a278f8d18716862ba293d5d1e');
  const before=JSON.stringify({sample,options}),plan=createSafePolymerFragmentPlan(sample,options,()=>{throw Error('Captured PET must not use fallback');});
  const chemical=polymerGeometryDiagnostics(polymerGeometryModel(sample.fragment,options.sourceRecordsByInstanceId),plan.atoms);
  assert.equal(chemical.accepted,true);assert.equal(plan.diagnostics.fallback,false);
  assert.ok(plan.diagnostics.iterations<=160);assert.equal(plan.atoms.length,47);assert.equal(plan.bonds.length,48);
  assert.deepEqual(plan.bonds,sample.fragment.bonds);assert.deepEqual(plan.atomOrigins,sample.fragment.atomOrigins);
  assert.deepEqual(plan.atoms.map(a=>[a.id,a.element,a.formalCharge]),sample.fragment.atoms.map(a=>[a.id,a.element,a.formalCharge]));
  for(const violations of Object.values(chemical.violations))assert.deepEqual(violations,[]);
  assert.deepEqual(plan,createPolymerFragment3DLayout(structuredClone(sample),structuredClone(options)));
  assert.equal(JSON.stringify({sample,options}),before);
});
test('captured production PET still rejects a budget with no jointly feasible iterate and rejects an invalid fallback',()=>{
  const plan=createPolymerFragment3DLayout(sample,{...options,maxIterations:8});assert.equal(plan.diagnostics.accepted,false);
  let calls=0;assert.throws(()=>createSafePolymerFragmentPlan(sample,{...options,maxIterations:8},()=>{calls++;return plan;}),{code:'POLYMER_GEOMETRY_UNAVAILABLE'});assert.equal(calls,1);
});
