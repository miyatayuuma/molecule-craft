import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../../vendor/three/three.module.min.js';
import {createPreviewModel} from '../../src/preview-model.js?v=35';
import {createReactionLabPolymerizationCore,POLYMER_COMMIT_DWELL_MS} from '../../src/reaction-lab-polymerization.js?v=1';
export async function polymerTask4Fixtures({prefix='u',generation=1,includeIntermediate=false}={}){
  const read=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));
  const authority=await read('../../data/polymerization-routes.json'),ids=new Set([...authority.routes.flatMap(r=>r.feedSpecies),'water']);
  const records=(await read('../../data/molecules.json')).filter(r=>ids.has(r.id)),source=new Map();
  for(const record of records){const m=createPreviewModel(THREE,record);for(let i=0;i<190;i++)m.step();const snapshot=m.snapshot();source.set(record.id,{...record,atoms:snapshot.atoms,bonds:snapshot.bonds,aromaticCycles:snapshot.aromaticCycles});}
  return authority.routes.map(route=>{
    const instances=route.representativeSequence.map((species,i)=>({id:`${prefix}${i}`,species,batchGeneration:generation})),core=createReactionLabPolymerizationCore({records,routes:authority.routes,sitePatterns:authority.sitePatterns});
    assert.equal(core.beginBatch({activeSlots:route.feedSpecies,batchGeneration:generation,instances,environment:new Set(route.environment.requires)}).ok,true);
    const intermediate=[];if(includeIntermediate)intermediate.push(structuredClone(core.snapshot().fragment));
    let result;for(let i=1;i<instances.length;i++){const begun=i<=route.interactionCadence.manualSteps?core.beginManualStep(instances[i].id):core.beginAutomaticStep(instances[i].id);assert.equal(begun.ok,true);result=core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);if(includeIntermediate)intermediate.push(structuredClone(core.snapshot().fragment));}
    assert.ok(result.sample);return{route,sample:result.sample,comparisonEvidence:core.comparisonEvidence(),sourceRecordsByInstanceId:Object.fromEntries(instances.map(i=>[i.id,source.get(i.species)])),intermediate};
  });
}
