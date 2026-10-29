import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  loadMoleculeDatabase,
  moleculeCatalog,
  moleculeDatabaseStatus,
  moleculeRecord,
  normalizeMoleculeId,
  setMoleculeDatabase,
} from '../src/chemistry.js?v=20';
import {prepareExplorationCatalog} from '../src/craft-connections.js?v=3';
import {createResources} from '../src/veil/resources.js';

const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const responseFor=records=>new Response(JSON.stringify(records),{status:200,headers:{'content-type':'application/json'}});
const malformedResponse=()=>new Response('{not-json',{status:200,headers:{'content-type':'application/json'}});
const memory=(entries=[])=>{
  const data=new Map(entries);
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),dump:()=>new Map(data)};
};
const originalFetch=globalThis.fetch,originalCaches=globalThis.caches;

try{
  assert.equal(moleculeDatabaseStatus().status,'idle');
  assert.throws(()=>moleculeCatalog(),/not ready \(idle\)/,'idle DB must not masquerade as an empty ready catalog');

  setMoleculeDatabase([]);
  assert.deepEqual(moleculeDatabaseStatus(),{status:'ready',loaded:true,count:0,error:null,source:'direct'},'an intentional empty DB remains distinguishable as ready');
  assert.deepEqual(moleculeCatalog(),[]);

  let releaseFetch;
  globalThis.fetch=()=>new Promise(resolve=>{releaseFetch=resolve;});
  delete globalThis.caches;
  const delayed=loadMoleculeDatabase(new URL('https://example.test/data/molecules.json'));
  assert.equal(moleculeDatabaseStatus().status,'loading');
  assert.throws(()=>moleculeCatalog(),/not ready \(loading\)/,'loading DB must not publish [] to collection/LOADOUT consumers');
  releaseFetch(responseFor(database));
  const loaded=await delayed;
  assert.equal(loaded.ok,true);assert.equal(loaded.source,'network');assert.equal(loaded.count,database.length);
  assert.equal(moleculeDatabaseStatus().status,'ready');
  assert.equal(moleculeCatalog().length,database.length);
  for(const record of database)assert.equal(moleculeRecord(record.id)?.id,record.id,`ready id index must resolve ${record.id}`);

  const normalizedSource={...database[0],id:`  ${database[0].id}-normalized  `};
  setMoleculeDatabase([normalizedSource]);
  const normalizedId=normalizeMoleculeId(normalizedSource.id);
  assert.equal(moleculeCatalog()[0].id,normalizedId);
  assert.equal(moleculeRecord(normalizedId)?.id,normalizedId,'normalized catalog id and lookup id must be identical');
  setMoleculeDatabase(database);

  const invalidNetwork=structuredClone(database);invalidNetwork[0].atoms=['Xx'];
  let fetchCalls=0;
  globalThis.fetch=async()=>{fetchCalls++;return responseFor(invalidNetwork);};
  globalThis.caches={match:async()=>responseFor(database)};
  const cacheRecovered=await loadMoleculeDatabase(new URL('https://example.test/data/molecules.json'));
  assert.equal(cacheRecovered.ok,true);assert.equal(cacheRecovered.source,'precache');assert.equal(fetchCalls,1);
  assert.equal(moleculeCatalog().length,database.length,'one invalid network record must reject that source atomically, not publish a partial catalog');

  const storage=memory(),seed=createResources({storage});seed.setCatalog(database);
  for(const id of ['hydrogen','methane','oxygen','water'])assert.equal(seed.discover(id),true,id);
  assert.equal(seed.setLoadoutTank('propellant','hydrogen'),true);
  assert.equal(seed.setLoadoutTank('fuel','methane'),true);
  assert.equal(seed.setLoadoutTank('oxidizer','oxygen'),true);
  assert.equal(seed.setLoadoutTank('coolant','water'),true);
  assert.equal(seed.save(),true);
  const savedRecipes=[...seed.state.recipes],savedLoadout={...seed.selectedLoadout()},savedRaw=[...storage.dump()];
  const reloaded=createResources({storage});

  globalThis.fetch=async()=>malformedResponse();
  globalThis.caches={match:async()=>malformedResponse()};
  const failed=await prepareExplorationCatalog(reloaded);
  assert.equal(failed.ok,false);assert.equal(moleculeDatabaseStatus().status,'error');
  assert.throws(()=>moleculeCatalog(),/not ready \(error\)/,'parse/schema failure must not become a normal empty catalog');
  assert.deepEqual(reloaded.state.recipes,savedRecipes,'DB failure must not clear discovered/crafted recipe state');
  assert.deepEqual(reloaded.selectedLoadout(),savedLoadout,'DB failure must not clear saved LOADOUT ids');
  assert.deepEqual([...storage.dump()],savedRaw,'DB failure must not rewrite saved progress');

  globalThis.fetch=async()=>responseFor(database);
  delete globalThis.caches;
  const recovered=await prepareExplorationCatalog(reloaded);
  assert.equal(recovered.ok,true);assert.equal(moleculeDatabaseStatus().status,'ready');
  for(const [use,id] of Object.entries(savedLoadout)){
    assert.equal(reloaded.selectedLoadout()[use],id,`${use} LOADOUT id must survive recovery`);
    const record=reloaded.record(id);assert.equal(record?.id,id);assert.ok(Array.isArray(record.bonds),`${id} must recover its full DB model lookup`);
    assert.ok(reloaded.tankCatalog(use).some(candidate=>candidate.id===id),`${id} must return to ${use} candidates after DB recovery`);
  }

  globalThis.fetch=async()=>{throw new Error('offline');};
  globalThis.caches={match:async()=>responseFor(database)};
  const offline=await loadMoleculeDatabase(new URL('https://example.test/data/molecules.json?reload=1'));
  assert.equal(offline.ok,true);assert.equal(offline.source,'precache');assert.equal(moleculeDatabaseStatus().status,'ready');
}finally{
  globalThis.fetch=originalFetch;
  if(originalCaches===undefined)delete globalThis.caches;else globalThis.caches=originalCaches;
  setMoleculeDatabase(database);
}

console.log('Issue #119 regression passed: explicit idle/loading/error/ready DB states, atomic invalid-source rejection, cache recovery, saved discovery/LOADOUT preservation, normalized ID lookup, and post-recovery candidate/model resync.');
