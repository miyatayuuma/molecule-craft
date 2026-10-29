import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPolymerCollectionSave,createPolymerCollectionPersistence,
  POLYMER_COLLECTION_STORAGE_KEY,validatePolymerCollectionSave,
} from '../src/polymer-collection-persistence.js';

class MemoryStorage{
  values=new Map();
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
const ids=['polyethylene','nylon-6-6'];
const saved=discoveredPolymers=>({schemaVersion:1,discoveredPolymers});

test('polymer collection uses its own canonical schema and validates stable discovery order',()=>{
  const storage=new MemoryStorage(),persistence=createPolymerCollectionPersistence({storage,polymerIds:ids});
  const value=saved([{id:ids[0],at:0,order:1},{id:ids[1],at:42,order:2}]);
  assert.equal(persistence.save(value),true);
  assert.equal(storage.getItem(POLYMER_COLLECTION_STORAGE_KEY),JSON.stringify(value));
  assert.deepEqual(persistence.load(),value);
  assert.throws(()=>validatePolymerCollectionSave(saved([{id:'no-such-polymer',at:0,order:1}]),{polymerIds:ids}),/Invalid/);
  assert.throws(()=>validatePolymerCollectionSave(saved([{id:ids[0],at:-1,order:1}]),{polymerIds:ids}),/Invalid/);
});

test('a reset epoch change prevents a stale tab from restoring old polymer discoveries',()=>{
  const storage=new MemoryStorage();storage.setItem('molecule-craft.resources.v1',JSON.stringify({resetEpoch:4}));
  const staleTab=createPolymerCollectionPersistence({storage,polymerIds:ids});
  assert.equal(staleTab.save(saved([{id:ids[0],at:10,order:1}])),true);
  storage.setItem('molecule-craft.resources.v1',JSON.stringify({resetEpoch:5}));
  storage.removeItem(POLYMER_COLLECTION_STORAGE_KEY);
  assert.equal(staleTab.save(saved([{id:ids[0],at:10,order:1}])),false);
  assert.equal(storage.getItem(POLYMER_COLLECTION_STORAGE_KEY),null);
});

test('current runtime preserves future polymer schemas during save and reset',()=>{
  const storage=new MemoryStorage(),future=JSON.stringify({schemaVersion:2,discoveredPolymers:[{id:'future-entry'}],futureField:{keep:true}});
  storage.setItem(POLYMER_COLLECTION_STORAGE_KEY,future);
  const persistence=createPolymerCollectionPersistence({storage,polymerIds:ids});
  assert.equal(persistence.load(),null);
  assert.equal(persistence.save(saved([{id:ids[0],at:1,order:1}])),false);
  assert.equal(clearPolymerCollectionSave(storage),false);
  assert.equal(storage.getItem(POLYMER_COLLECTION_STORAGE_KEY),future);
});
