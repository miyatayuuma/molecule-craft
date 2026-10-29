import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferencePreparation} from '../src/polymer-reference-preparation.js';

function fixture(){
  const workers=[];
  const owner=createReferencePreparation(()=>{
    const worker={terminated:0,postMessage(message){this.message=message;},terminate(){this.terminated++;}};
    workers.push(worker);return worker;
  });
  return {owner,workers};
}

test('replacement FEED cancels the old worker and ignores its queued result',async()=>{
  const {owner,workers}=fixture();
  const old=owner.start('polyethylene',100,1),stale=workers[0].onmessage;
  const next=owner.start('polyisobutylene',100,2);
  assert.equal(await old.promise,null);assert.equal(workers[0].terminated,1);
  stale({data:{plan:{id:'old'}}});
  workers[1].onmessage({data:{plan:{id:'new'}}});
  assert.deepEqual(await next.promise,{id:'new'});assert.equal(workers[1].terminated,1);
});

test('close or restore cancels once and late completion cannot settle a later job',async()=>{
  const {owner,workers}=fixture();const first=owner.start('polyethylene',100,1),late=workers[0].onmessage;
  owner.cancel();owner.cancel();assert.equal(await first.promise,null);assert.equal(workers[0].terminated,1);
  const second=owner.start('polyethylene',100,1);late({data:{plan:{id:'stale'}}});
  workers[1].onmessage({data:{plan:{id:'fresh'}}});assert.deepEqual(await second.promise,{id:'fresh'});
});

test('worker construction, posting and worker errors settle without retained work',async()=>{
  const broken=createReferencePreparation(()=>{throw Error('unavailable');});assert.equal(await broken.start('x',100,1).promise,null);
  const post=createReferencePreparation(()=>({postMessage(){throw Error('failed');},terminate(){}}));assert.equal(await post.start('x',100,1).promise,null);
  const {owner,workers}=fixture();const job=owner.start('x',100,1);workers[0].onerror({message:'failed'});assert.equal(await job.promise,null);assert.equal(workers[0].terminated,1);
});
