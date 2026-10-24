import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createPolymerFragment3DLayout,createSafePolymerFragmentPlan,polymerGeometryModel,polymerGeometryDiagnostics} from '../src/polymer-fragment-3d-layout.js';
const bytes=await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pla-refeed-geometry-input.json',import.meta.url));
const captured=JSON.parse(bytes),sample=captured.input.snapshot.sample,options={sourceRecordsByInstanceId:captured.input.sources};
const sha=x=>createHash('sha256').update(x).digest('hex');
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const value of Object.values(x))freeze(value);}return x;};
freeze(sample);freeze(options);
test('frozen actual PLA re-FEED retains a jointly feasible pre-distance checkpoint with every chemical limit intact',()=>{
  assert.equal(sha(bytes),'d66858f2b16e770772842f03eb32eb0174847db142f39ae5d5f0735446b54828');
  assert.equal(sha(JSON.stringify(sample.fragment)),'0e2881feedc95881932ed5f49a8f5a8a899d33afb4d4ef51f0a273078d1a0556');
  const before=JSON.stringify({sample,options}),p=createSafePolymerFragmentPlan(sample,options,()=>{throw Error('Actual PLA must not need fallback');}),d=polymerGeometryDiagnostics(polymerGeometryModel(sample.fragment,options.sourceRecordsByInstanceId),p.atoms);
  assert.equal(p.atoms.length,39);assert.equal(p.bonds.length,38);assert.equal(p.diagnostics.iterations,160);
  assert.equal(p.diagnostics.accepted,true);assert.equal(p.diagnostics.fallback,false);assert.equal(d.accepted,true);
  assert.ok(p.diagnostics.restoredFeasibleIteration!==null);
  for(const violations of Object.values(d.violations))assert.deepEqual(violations,[]);
  assert.ok(d.bonds.every(b=>b.error<=.08));assert.ok(d.angles.every(a=>a.error<=(a.environment==='sp-linear'?3:15)));assert.ok(d.planes.every(p=>p.deviation<=.08));assert.equal(d.severeOverlapCount,0);
  const target=d.angles.find(a=>a.a===13&&a.center===15&&a.b===22);assert.equal(target.target,114.8);assert.ok(target.error<=15);
  assert.deepEqual(p.bonds,sample.fragment.bonds);assert.deepEqual(p.atomOrigins,sample.fragment.atomOrigins);
  assert.deepEqual(p.atoms.map(a=>[a.id,a.element,a.formalCharge]),sample.fragment.atoms.map(a=>[a.id,a.element,a.formalCharge]));
  assert.deepEqual(p,createPolymerFragment3DLayout(structuredClone(sample),structuredClone(options)));
  assert.equal(JSON.stringify({sample,options}),before);
});
test('PLA pre-distance retention does not admit an infeasible short solve or an invalid fallback',()=>{
  const o={...options,maxIterations:8},p=createPolymerFragment3DLayout(sample,o);assert.equal(p.diagnostics.accepted,false);
  assert.throws(()=>createSafePolymerFragmentPlan(sample,o,()=>p),{code:'POLYMER_GEOMETRY_UNAVAILABLE'});
});
