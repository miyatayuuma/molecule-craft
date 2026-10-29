import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactionLabBatch, deterministicFeedVariation, planFeedSchedule, REACTION_LAB_BATCH_PHASES as PHASE } from '../src/reaction-lab-batch.js';

const records=['water','ethanol','acetic-anhydride','hexamethylenediamine'].map(id=>({id}));

test('draft edits stay separate from the committed active batch',()=>{
  const batch=createReactionLabBatch(records);batch.setDraftSlot(0,'water');let first=batch.beginFeed();assert.equal(first.ok,true);assert.equal(batch.completeFeed(first.generation).phase,PHASE.ACTIVE);
  const before=batch.activeSlots;assert.equal(batch.setDraftSlot(1,'ethanol').ok,true);assert.deepEqual(batch.activeSlots,before);assert.deepEqual(batch.draftSlots,['water','ethanol','']);
});

test('FEED commits slots atomically and a same-configuration restart increments generation',()=>{
  const batch=createReactionLabBatch(records);batch.setDraftSlot(0,'acetic-anhydride');batch.setDraftSlot(1,'water');const first=batch.beginFeed();assert.deepEqual(first.activeSlots,['acetic-anhydride','water','']);assert.equal(first.phase,PHASE.FEEDING);assert.equal(batch.completeFeed(first.generation).phase,PHASE.ACTIVE);
  const restart=batch.beginFeed({hasCurrentBatch:true});assert.equal(restart.phase,PHASE.FLUSHING);assert.equal(restart.generation,first.generation+1);assert.deepEqual(restart.activeSlots,['acetic-anhydride','water','']);assert.equal(batch.completeFlush(restart.generation).phase,PHASE.FEEDING);assert.equal(batch.completeFeed(restart.generation).phase,PHASE.ACTIVE);
});

test('all-empty FEED purges a current batch and leaves an idle empty chamber',()=>{
  const batch=createReactionLabBatch(records);batch.setDraftSlot(0,'water');const first=batch.beginFeed();batch.completeFeed(first.generation);batch.setDraftSlot(0,'');const purge=batch.beginFeed({hasCurrentBatch:true});assert.equal(purge.phase,PHASE.FLUSHING);assert.deepEqual(purge.activeSlots,['','','']);assert.equal(batch.completeFlush(purge.generation).phase,PHASE.IDLE);assert.deepEqual(batch.activeSlots,['','','']);
  assert.equal(batch.beginFeed().reason,'empty-batch');
});

test('duplicate draft species are rejected without mutation',()=>{
  const batch=createReactionLabBatch(records);assert.equal(batch.setDraftSlot(0,'water').ok,true);assert.deepEqual(batch.setDraftSlot(2,'water'),{ok:false,reason:'duplicate-species',slots:['water','','water']});assert.deepEqual(batch.draftSlots,['water','','']);
});

test('transition phases lock edits and stale completion tokens cannot advance a newer generation',()=>{
  const batch=createReactionLabBatch(records);batch.setDraftSlot(0,'water');const first=batch.beginFeed();assert.equal(batch.setDraftSlot(1,'ethanol').reason,'transition-locked');assert.equal(batch.beginFeed().reason,'transition-locked');assert.equal(batch.completeFeed(first.generation-1).reason,'stale-generation');assert.equal(batch.completeFeed(first.generation).phase,PHASE.ACTIVE);
  const restart=batch.beginFeed({hasCurrentBatch:true});assert.equal(batch.completeFlush(first.generation).reason,'stale-generation');assert.equal(batch.completeFlush(restart.generation).phase,PHASE.FEEDING);
});

test('feed schedules preserve 4 / 2+2 / 2+2+2 waves with deterministic micro-stagger',()=>{
  assert.equal(planFeedSchedule(['water','','']).length,4);
  assert.deepEqual(planFeedSchedule(['acetic-anhydride','water','']).map(row=>[row.slotIndex,row.waveIndex]),[[0,0],[0,1],[1,0],[1,1]]);
  assert.deepEqual(planFeedSchedule(['water','ethanol','acetic-anhydride']).map(row=>[row.slotIndex,row.waveIndex]),[[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]]);
  const wave=planFeedSchedule(['water','ethanol','acetic-anhydride']).filter(row=>row.waveIndex===0);assert.deepEqual(wave.map(row=>row.startDelayMs),[0,38,76]);
});

test('feed pose and ejection variation is deterministic and differs between copies',()=>{
  const one=deterministicFeedVariation(1,0,0),repeat=deterministicFeedVariation(1,0,0),two=deterministicFeedVariation(1,1,1);assert.deepEqual(one,repeat);assert.notDeepEqual(one,two);
});
