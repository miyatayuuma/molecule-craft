import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveParticipantInstances } from '../src/reaction-lab-viewer.js?v=13';

test('reaction commit reserves every real role atomically and in stable instance order',()=>{
  const instances=[{id:'z-instance',batchGeneration:4,busy:false},{id:'a-instance',batchGeneration:4,busy:false},{id:'supplement',batchGeneration:4,busy:false}];
  const result=reserveParticipantInstances({left:'z-instance',right:'a-instance',extra:'supplement'},instances,4,['left','right','extra']);
  assert.equal(result.ok,true);assert.deepEqual(result.participants.map(item=>item.id),['a-instance','supplement','z-instance']);assert.ok(instances.every(item=>item.busy));
});

test('missing, duplicate, busy, or stale-generation participants cause no partial reservation',()=>{
  for(const setup of [
    {instances:[{id:'a',batchGeneration:4,busy:false}],bindings:{left:'a',right:'missing'},reason:'participant-missing'},
    {instances:[{id:'a',batchGeneration:4,busy:false}],bindings:{left:'a',right:'a'},reason:'duplicate-reaction-participant'},
    {instances:[{id:'a',batchGeneration:4,busy:false},{id:'b',batchGeneration:4,busy:true}],bindings:{left:'a',right:'b'},reason:'participant-busy'},
    {instances:[{id:'a',batchGeneration:3,busy:false},{id:'b',batchGeneration:4,busy:false}],bindings:{left:'a',right:'b'},reason:'batch-generation-mismatch'},
  ]){
    const result=reserveParticipantInstances(setup.bindings,setup.instances,4,['left','right']);assert.equal(result.reason,setup.reason);assert.equal(setup.instances.find(item=>item.id==='a')?.busy,false,'failure cannot reserve the first role before checking all roles');
  }
});
