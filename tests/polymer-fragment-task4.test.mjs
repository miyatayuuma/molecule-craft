import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {polymerTask4Fixtures} from './helpers/polymer-task4-fixtures.mjs';
import {createPolymerFragment3DLayout as layout,createSafePolymerFragmentPlan} from '../src/polymer-fragment-3d-layout.js';
import {polymerGeometryModel,polymerGeometryDiagnostics,resolvePolymerFragmentTargets} from '../src/polymer-fragment-3d-layout.js';
const fixtures=await polymerTask4Fixtures({includeIntermediate:true});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const freeze=x=>{if(x&&typeof x==='object'){Object.freeze(x);for(const v of Object.values(x))freeze(v);}return x;};
const task3=JSON.parse(await readFile(new URL('../docs/validation/polymer-local-fragment-task3-evidence/analytical-projections.json',import.meta.url)));
const brief=p=>({reason:p.diagnostics.reason,...Object.fromEntries(Object.entries(p.diagnostics.chemical.violations).map(([k,v])=>[k,v.length]))});
const plans=new Map();
test('Task4 G0-G7 all 25: actual Core graph, new independent local chemistry checks, source/identity and determinism',()=>{
  assert.equal(fixtures.length,25);
  for(const f of fixtures){
    const before=digest(f),p=layout(freeze(f.sample),{sourceRecordsByInstanceId:freeze(f.sourceRecordsByInstanceId)}),m=polymerGeometryModel(f.sample.fragment,f.sourceRecordsByInstanceId),d=polymerGeometryDiagnostics(m,p.atoms);
    assert.equal(p.diagnostics.accepted,true,`${f.route.routeId}: ${JSON.stringify(brief(p))}`);assert.equal(d.accepted,true);assert.equal(digest(f),before);
    assert.deepEqual(p.atomOrigins,f.sample.fragment.atomOrigins);assert.deepEqual(p.bonds,f.sample.fragment.bonds);assert.deepEqual(p.atoms.map(a=>[a.id,a.element,a.formalCharge]),f.sample.fragment.atoms.map(a=>[a.id,a.element,a.formalCharge]));
    assert.equal(digest(f.sample.fragment),task3.rows.find(r=>r.routeId===f.route.routeId).graphDigest,'Task3 identical chemical graph');
    assert.deepEqual(p,layout(structuredClone(f.sample),{sourceRecordsByInstanceId:structuredClone(f.sourceRecordsByInstanceId)}),'full XYZ and diagnostics, not timings, reproduce');
    for(const a of d.angles.filter(a=>a.environment==='sp-linear'))assert.ok(a.degrees>=177&&a.degrees<=180.00001);
    assert.ok(d.bonds.every(b=>b.error<=.08));assert.ok(d.angles.every(a=>a.error<=(a.environment==='sp-linear'?3:15)));assert.ok(d.planes.every(a=>a.deviation<=.08));assert.equal(d.severeOverlapCount,0);assert.ok(p.diagnostics.iterations<=160);
    if(f.route.polymerId==='nylon-6-6')assert.equal(p.atoms.length,79);
    for(const b of m.bondTargets)if([m.atoms[b.a].element,m.atoms[b.b].element].sort().join()==='C,N'&&b.order===1){const acyl=m.carbonylC.has(b.a)||m.carbonylC.has(b.b);assert.equal(b.target, (acyl?1.35:1.47)*.78,'amide N-alkyl is NOT the shortened acyl-N bond');}
    plans.set(f.route.routeId,p);
  }
});
test('initial sources and every intermediate actual commit graph remain accepted, including epoxide before ring opening',()=>{
  for(const f of fixtures)for(const [step,fragment]of f.intermediate.entries()){
    const p=layout({...f.sample,fragment},{sourceRecordsByInstanceId:f.sourceRecordsByInstanceId});assert.equal(p.diagnostics.accepted,true,`${f.route.routeId} step ${step}: ${JSON.stringify(brief(p))}`);
  }
});
test('read-only semantic targets agree with Task3 motifs and real origin tuples; PF transferred-H is not a junction',()=>{
  for(const f of fixtures){const t=resolvePolymerFragmentTargets(f.sample,{...f,route:f.route}),base=task3.rows.find(r=>r.routeId===f.route.routeId).selector,g=f.sample.fragment;
    assert.equal(t.resolved,true,JSON.stringify(t.unresolved));assert.deepEqual(t.carbonyl.bondIndices,base.carbonyl);assert.deepEqual(t.nitrile.bondIndices,base.nitrile);assert.deepEqual(t.ester.bondIndices,base.ester);assert.deepEqual(t.amide.bondIndices,base.amide);
    if(f.route.builder==='chain'){assert.deepEqual(t.backbone.atomIndices,base.backboneAtoms);assert.deepEqual(t.backbone.bondIndices,base.backboneBonds);assert.deepEqual(t.sideAttachment.bondIndices,base.sideAttachment);}
    const groups=Object.values(t).flatMap(v=>Array.isArray(v)?v:v&&typeof v==='object'&&v.atomIndices?[v]:[]).filter(v=>v?.atomIndices);
    for(const target of groups){assert.deepEqual(target.originTuples,target.atomIndices.map(i=>g.atomOrigins[i]));for(const i of target.bondIndices){assert.ok(target.atomIndices.includes(g.bonds[i].a)&&target.atomIndices.includes(g.bonds[i].b));}}
    if(f.route.builder==='network'){assert.equal(t.rings.length,2);assert.equal(t.methyleneBridge.length,1);assert.equal(t.hydroxymethyl.length,1);assert.equal(f.sample.evidence.byproducts.length,1);assert.equal(t.backbone.kind,'actual-PF-heavy-fragment-not-certified-backbone');}
    const missing={...f.sourceRecordsByInstanceId};delete missing[Object.keys(missing)[0]];assert.equal(resolvePolymerFragmentTargets(f.sample,{route:f.route,sourceRecordsByInstanceId:missing}).resolved,false);
  }
});
const minimal=()=>({sample:{routeId:'test',fragment:{atoms:[{id:0,element:'C'},{id:1,element:'C'}],bonds:[{a:0,b:1,order:1}],atomOrigins:[{instanceId:'a',sourceAtomIndex:0},{instanceId:'a',sourceAtomIndex:1}]}},options:{sourceRecordsByInstanceId:{a:{atoms:[{element:'C',point:{x:0,y:0,z:0}},{element:'C',point:{x:1.1856,y:0,z:0}}],bonds:[{a:0,b:1,order:1}]}}}});
test('invalid chemistry and invalid budgets throw before fallback; graph remains unchanged',()=>{
  const cases=[g=>delete g.atomOrigins,g=>g.atomOrigins[1]=g.atomOrigins[0],g=>g.bonds[0].b=2,g=>g.bonds[0].order=0,g=>g.bonds[0].order=4,g=>g.bonds.push({...g.bonds[0]}),g=>g.atoms[0].element='Xe',g=>g.atoms[0].formalCharge=1,g=>g.bonds=[],g=>g.atomOrigins[0].sourceAtomIndex=-1];
  for(const change of cases){const f=minimal();change(f.sample.fragment);const before=digest(f.sample);let fallbackCalls=0;assert.throws(()=>createSafePolymerFragmentPlan(f.sample,f.options,()=>fallbackCalls++),TypeError);assert.equal(fallbackCalls,0);assert.equal(digest(f.sample),before);}
  for(const maxIterations of [NaN,Infinity,0,-1]){const f=minimal();assert.throws(()=>layout(f.sample,{...f.options,maxIterations}),TypeError);}
});
test('absent, nonfinite, malformed and coincident source poses reject explicitly; never certify invented coordinates',()=>{
  for(const change of [f=>delete f.options.sourceRecordsByInstanceId.a,f=>f.options.sourceRecordsByInstanceId.a.atoms[0].point.x=NaN,f=>f.options.sourceRecordsByInstanceId.a.atoms[0].point={},f=>f.options.sourceRecordsByInstanceId.a.atoms[0].point=[0,1],f=>f.options.sourceRecordsByInstanceId.a.atoms[0].element='N',f=>f.options.sourceRecordsByInstanceId.a.atoms[1].point={x:0,y:0,z:0}]){
    const f=minimal();change(f);const p=layout(f.sample,f.options);assert.equal(p.diagnostics.accepted,false);assert.ok(['missing-source-coordinates','degenerate-source-geometry'].includes(p.diagnostics.reason));assert.throws(()=>createSafePolymerFragmentPlan(f.sample,f.options),{code:'POLYMER_GEOMETRY_UNAVAILABLE'});
  }
});
test('nonconvergence rejects bad fallback; only independently validated real-graph fallback can be displayed',()=>{
  const f=fixtures.find(f=>f.route.polymerId==='nylon-6-6'),options={sourceRecordsByInstanceId:f.sourceRecordsByInstanceId,maxIterations:1};assert.equal(layout(f.sample,options).diagnostics.accepted,false);
  assert.throws(()=>createSafePolymerFragmentPlan(f.sample,options,()=>({atoms:f.sample.fragment.atoms.map(()=>({x:0,y:0,z:0})),bonds:f.sample.fragment.bonds})),{code:'POLYMER_GEOMETRY_UNAVAILABLE'});
  const p=createSafePolymerFragmentPlan(f.sample,options,()=>plans.get(f.route.routeId));assert.equal(p.diagnostics.fallback,true);assert.equal(p.diagnostics.accepted,true);
  const corrupted=structuredClone(plans.get(f.route.routeId));for(const a of corrupted.atoms){a.id='wrong';a.element='Xe';a.origin={instanceId:'fake',sourceAtomIndex:999};}corrupted.atomOrigins=[];
  const restored=createSafePolymerFragmentPlan(f.sample,options,()=>corrupted);assert.deepEqual(restored.atoms.map(a=>[a.id,a.element,a.origin]),f.sample.fragment.atoms.map((a,i)=>[a.id,a.element,f.sample.fragment.atomOrigins[i]]));assert.deepEqual(restored.atomOrigins,f.sample.fragment.atomOrigins);
});
test('identities, changed valid source poses and ordered atom/bond remapping have explicit deterministic behavior',()=>{
  const f=fixtures[0],copy=structuredClone(f);for(const o of copy.sample.fragment.atomOrigins)o.instanceId=`new:${o.instanceId}`;copy.sourceRecordsByInstanceId=Object.fromEntries(Object.entries(copy.sourceRecordsByInstanceId).map(([id,r])=>[`new:${id}`,r]));
  const a=layout(copy.sample,{sourceRecordsByInstanceId:copy.sourceRecordsByInstanceId});assert.deepEqual(a,layout(structuredClone(copy.sample),{sourceRecordsByInstanceId:structuredClone(copy.sourceRecordsByInstanceId)}));assert.deepEqual(a.atomOrigins,copy.sample.fragment.atomOrigins);
  const rotated=structuredClone(f);for(const r of Object.values(rotated.sourceRecordsByInstanceId))for(const atom of r.atoms){const {x,y}=atom.point;atom.point.x=-y;atom.point.y=x;}
  const b=layout(rotated.sample,{sourceRecordsByInstanceId:rotated.sourceRecordsByInstanceId});assert.equal(b.diagnostics.accepted,true);assert.deepEqual(b,layout(rotated.sample,{sourceRecordsByInstanceId:rotated.sourceRecordsByInstanceId}));
  const reordered=structuredClone(f),g=reordered.sample.fragment,n=g.atoms.length;g.atoms.reverse();g.atomOrigins.reverse();g.bonds=g.bonds.map(b=>({...b,a:n-1-b.a,b:n-1-b.b})).reverse();
  const c=layout(reordered.sample,{sourceRecordsByInstanceId:reordered.sourceRecordsByInstanceId});assert.deepEqual(c.atoms.map(a=>a.id),g.atoms.map(a=>a.id));assert.deepEqual(c.bonds,g.bonds);assert.deepEqual(c,layout(reordered.sample,{sourceRecordsByInstanceId:reordered.sourceRecordsByInstanceId}));
});
test('connected cyclic/branched inter-origin graph is solved or explicitly rejected without mutating topology',()=>{
  for(const bonds of [[{a:0,b:1,order:1},{a:1,b:2,order:1},{a:2,b:0,order:1}],[{a:0,b:1,order:1},{a:0,b:2,order:1},{a:0,b:3,order:1}]]){
    const n=Math.max(...bonds.flatMap(b=>[b.a,b.b]))+1,fragment={atoms:Array.from({length:n},(_,id)=>({id,element:'C'})),bonds,atomOrigins:Array.from({length:n},(_,i)=>({instanceId:`c${i}`,sourceAtomIndex:0}))},sourceRecordsByInstanceId=Object.fromEntries(fragment.atomOrigins.map(o=>[o.instanceId,{atoms:[{element:'C',point:{x:0,y:0,z:0}}]}])),before=digest(fragment),p=layout({fragment},{sourceRecordsByInstanceId});assert.equal(digest(fragment),before);assert.deepEqual(p.bonds,bonds);assert.ok(p.diagnostics.finite);if(!p.diagnostics.accepted)assert.equal(p.diagnostics.reason,'chemical-geometry-did-not-converge');
  }
});
