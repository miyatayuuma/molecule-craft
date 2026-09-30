import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS,POLYMERIZATION_STATES} from '../src/reaction-lab-polymerization.js';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const authority=await readJson('../data/polymerization-routes.json');
const db=await readJson('../data/molecules.json');
const polymerIds=new Set(authority.routes.map(route=>route.polymerId));
const records=db.filter(record=>new Set([...authority.routes.flatMap(route=>route.feedSpecies),'water']).has(record.id));
const core=()=>createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});
const instances=(species,generation,countBySpecies={})=>species.flatMap(id=>Array.from({length:countBySpecies[id]??(species.length===1?4:2)},(_,index)=>({id:`${id}-${index+1}`,species:id,batchGeneration:generation})));
const commit=engine=>engine.advanceFixedStep(POLYMER_COMMIT_DWELL_MS,{visible:true,labOpen:true,normal:true,conditionsValid:true,geometryValid:true});

test('Polymer route owns exact Feed before generic execution and reserves only its representative sequence',()=>{
  const route=authority.routes.find(item=>item.polymerId==='ethylene-propylene-copolymer'),feed=instances(route.feedSpecies,11),engine=core();
  assert.equal(engine.routeFor([...route.feedSpecies,'water']),null);
  const started=engine.beginBatch({activeSlots:route.feedSpecies,batchGeneration:11,instances:feed,environment:new Set()});
  assert.equal(started.owned,true);assert.equal(started.ok,true);assert.equal(started.routeId,route.routeId);
  assert.equal(started.reservedInstanceIds.length,3,'the fourth copolymer Feed molecule is not included in the finite sample');
  assert.equal(engine.beginBatch({activeSlots:route.feedSpecies,batchGeneration:12,instances:feed,environment:new Set()}).reason,'polymer-transaction-active');
});

test('manual pointer commits use fixed-step dwell, then permit a player fallback after failed auto setup',()=>{
  const route=authority.routes.find(item=>item.polymerId==='polyethylene'),engine=core(),feed=instances(route.feedSpecies,2);
  const started=engine.beginBatch({activeSlots:route.feedSpecies,batchGeneration:2,instances:feed,environment:new Set()});
  const [first,second,third]=started.reservedInstanceIds;
  const before=engine.snapshot().fragment;
  assert.equal(engine.beginManualStep(second,{geometryValid:false}).reason,'geometry-invalid');
  assert.deepEqual(engine.snapshot().fragment,before,'unsafe manual geometry leaves source chemistry unchanged');
  assert.equal(engine.beginManualStep(second).ok,true);
  assert.equal(engine.advanceFixedStep(POLYMER_COMMIT_DWELL_MS,{visible:false}).reason,'paused');
  assert.equal(engine.snapshot().fragment.atoms.length,before.atoms.length);
  assert.equal(engine.setEnvironment(new Set()).reason,'environment-locked');
  assert.equal(commit(engine).committed,true);
  assert.equal(engine.snapshot().state,POLYMERIZATION_STATES.WAITING);
  assert.equal(engine.beginManualStep(third).ok,true);assert.equal(commit(engine).automaticPending,true);
  assert.equal(engine.snapshot().state,POLYMERIZATION_STATES.AUTO_PENDING);
  assert.equal(engine.autoFallback(),true);assert.equal(engine.snapshot().waitReason,'auto-fallback');
  assert.equal(engine.beginManualStep(feed[3].id).ok,true,'a visibly failed automatic route may be completed by the player');
  const done=commit(engine);assert.equal(done.finished,true);assert.equal(done.sample.polymerId,'polyethylene');
  assert.equal(done.sample.batchGeneration,2);assert.equal(done.sample.fragment.atomOrigins.length,done.sample.fragment.atoms.length);
  assert.equal(engine.snapshot().state,POLYMERIZATION_STATES.SAMPLE);
  assert.equal(engine.sampleDismiss(),done.sample.sampleId);assert.equal(engine.snapshot(),null);
  assert.ok(!polymerIds.has('water'),'molecular byproduct identity remains outside the polymer catalog');
});

test('condition loss during a pending transform rolls back only that step',()=>{
  const route=authority.routes.find(item=>item.polymerId==='polyethylene-terephthalate'),engine=core(),feed=instances(route.feedSpecies,8),started=engine.beginBatch({activeSlots:route.feedSpecies,batchGeneration:8,instances:feed,environment:new Set(['heat'])});
  const next=started.reservedInstanceIds[1];assert.equal(engine.beginManualStep(next).ok,true);
  const before=engine.snapshot().fragment;
  const result=engine.advanceFixedStep(POLYMER_COMMIT_DWELL_MS,{conditionsValid:false});
  assert.equal(result.reason,'conditions');assert.equal(engine.snapshot().state,POLYMERIZATION_STATES.WAITING);assert.equal(engine.snapshot().waitReason,'conditions');
  assert.deepEqual(engine.snapshot().fragment,before,'a failed condition never rewrites an already committed fragment');
  assert.equal(engine.setEnvironment(new Set(['heat'])).valid,true);
});
