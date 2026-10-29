import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS,POLYMERIZATION_STATES} from '../src/reaction-lab-polymerization.js';

const readJson=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const authority=await readJson('../data/polymerization-routes.json');
const db=await readJson('../data/molecules.json');
const ids=new Set([...authority.routes.flatMap(route=>route.feedSpecies),'water']);
const records=db.filter(record=>ids.has(record.id));

function fixtureFor(route){
  const species=route.feedSpecies,perSpecies=species.length===1?4:2,instances=species.flatMap(id=>Array.from({length:perSpecies},(_,index)=>({id:`feed-${id}-${index+1}`,species:id,batchGeneration:3})));
  return createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns}).beginBatch({activeSlots:species,batchGeneration:3,instances,environment:new Set(route.environment.requires)});
}
function instanceFor(route,species,used){const next=(used.get(species)??0)+1;used.set(species,next);return`feed-${species}-${next}`;}

for(const route of authority.routes)test(`${route.routeId} produces a conserved representative PolymerSample`,()=>{
  const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});
  const species=route.feedSpecies,perSpecies=species.length===1?4:2,instances=species.flatMap(id=>Array.from({length:perSpecies},(_,index)=>({id:`feed-${id}-${index+1}`,species:id,batchGeneration:3})));
  const started=core.beginBatch({activeSlots:species,batchGeneration:3,instances,environment:new Set(route.environment.requires)});
  assert.equal(started.owned,true);assert.equal(started.ok,true);assert.equal(core.snapshot().state,POLYMERIZATION_STATES.WAITING);
  const used=new Map();instanceFor(route,route.representativeSequence[0],used);
  let result=null;
  for(let index=1;index<route.representativeSequence.length;index++){
    const incoming=instanceFor(route,route.representativeSequence[index],used),automatic=index>route.interactionCadence.manualSteps;
    const begun=automatic?core.beginAutomaticStep(incoming):core.beginManualStep(incoming);
    assert.equal(begun.ok,true,`${route.routeId} step ${index}: ${begun.reason}`);
    const before=core.snapshot().fragment.atoms.length;
    assert.equal(core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS,{visible:false}).reason,'paused');
    assert.equal(core.snapshot().fragment.atoms.length,before,'hidden Lab time does not commit chemistry');
    assert.equal(core.setEnvironment(new Set()).ok,false,'environment is locked during transformation');
    assert.equal(core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS/2).committed,false);
    result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS/2);
    assert.equal(result.committed,true,`${route.routeId} step ${index} did not commit`);
  }
  assert.equal(result.finished,true);assert.equal(core.snapshot().state,POLYMERIZATION_STATES.SAMPLE);
  const sample=result.sample;
  assert.equal(sample.polymerId,route.polymerId);assert.equal(sample.routeId,route.routeId);assert.equal(sample.batchGeneration,3);
  assert.equal(sample.evidence.unitCount,route.completionEvidence.unitCount);
  assert.equal(sample.evidence.ringOpenings,route.completionEvidence.ringOpenings);
  assert.equal(sample.evidence.byproducts.filter(item=>item.species==='water').length,route.completionEvidence.byproducts.water);
  assert.equal(sample.evidence.interUnitLinks,route.completionEvidence.interUnitLinks);
  assert.deepEqual(sample.representation.qualifiers,route.presentation.qualifiers);
  assert.equal(sample.fragment.atoms.length,new Set(sample.fragment.atomOrigins.map(origin=>`${origin.instanceId}:${origin.sourceAtomIndex}`)).size);
  for(const forbidden of ['moleculeId','q','sigma','epsilon','rigidBody','reactionParticipant','feedSpecies'])assert.equal(Object.hasOwn(sample,forbidden),false,`${forbidden} is not PolymerSample identity`);
});

test('an exact route owns the batch when conditions fail and resumes without revealing which control is missing',()=>{
  const route=authority.routes.find(item=>item.routeId==='polyethylene-terephthalate-direct-polycondensation'),species=route.feedSpecies,instances=species.flatMap(id=>Array.from({length:2},(_,index)=>({id:`${id}-${index}`,species:id,batchGeneration:9})));
  const core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns}),start=core.beginBatch({activeSlots:species,batchGeneration:9,instances,environment:new Set()});
  assert.equal(start.owned,true);assert.equal(start.ok,true);assert.equal(core.snapshot().waitReason,'conditions');
  assert.equal(core.beginManualStep('ethylene-glycol-0').reason,'conditions');
  assert.equal(core.setEnvironment(new Set(['heat'])).valid,true);assert.equal(core.snapshot().waitReason,'player');
});

test('an extra Feed species never selects a polymer route',()=>{
  const route=authority.routes[0],core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});
  assert.equal(core.routeFor([...route.feedSpecies,'water']),null);
});
