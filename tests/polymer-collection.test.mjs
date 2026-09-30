import test from 'node:test';
import assert from 'node:assert/strict';
import {createPolymerCollectionState} from '../src/polymer-collection-state.js';
import {POLYMER_COLLECTION_STORAGE_KEY} from '../src/polymer-collection-persistence.js';

class MemoryStorage{
  values=new Map();
  getItem(key){return this.values.has(key)?this.values.get(key):null;}
  setItem(key,value){this.values.set(key,String(value));}
  removeItem(key){this.values.delete(key);}
}
const records=[{id:'polyethylene',number:1},{id:'nylon-6-6',number:25}];

test('polymer discoveries are independent, ordered, persistent, and idempotent',()=>{
  const storage=new MemoryStorage(),state=createPolymerCollectionState({records,storage,now:()=>123});
  assert.deepEqual(state.registerDiscoveredPolymer('nylon-6-6').event.entry,{id:'nylon-6-6',at:123,order:1});
  assert.equal(state.registerDiscoveredPolymer('polyethylene',{at:456}).event.entry.order,2);
  assert.equal(state.registerDiscoveredPolymer('nylon-6-6',{at:789}).changed,false);
  assert.equal(state.discoveredCount,2);
  assert.equal(JSON.parse(storage.getItem(POLYMER_COLLECTION_STORAGE_KEY)).discoveredPolymers[0].id,'nylon-6-6');
  const restored=createPolymerCollectionState({records,storage});
  assert.deepEqual(restored.entries(),state.entries());
  assert.throws(()=>state.registerDiscoveredPolymer('not-a-polymer'),/Unknown polymer/);
});
