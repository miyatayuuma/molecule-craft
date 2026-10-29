import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReactionLabEnvironment, createDefaultReactionLabEnvironmentState,
  environmentTokensFromSnapshot, enumerateCanonicalReactionLabEnvironments,
  reactionLabEnvironmentStateFromTokens, snapshotReactionLabEnvironment,
  validateNormalizedEnvironmentTokens, validateReactionLabEnvironmentState,
} from '../src/reaction-lab-environment.js';

test('default Chamber activation state is LIGHT OFF, HEAT OFF, and neutral',()=>{
  assert.deepEqual(createDefaultReactionLabEnvironmentState(),{light:false,heat:false,medium:'neutral'});
  assert.deepEqual(createReactionLabEnvironment().snapshot(),{light:false,heat:false,medium:'neutral'});
});

test('LIGHT and HEAT setters and toggles preserve the other independent state',()=>{
  const environment=createReactionLabEnvironment();
  assert.deepEqual(environment.toggleLight(),{light:true,heat:false,medium:'neutral'});
  assert.deepEqual(environment.toggleHeat(),{light:true,heat:true,medium:'neutral'});
  assert.deepEqual(environment.setLight(false),{light:false,heat:true,medium:'neutral'});
  assert.deepEqual(environment.setHeat(false),{light:false,heat:false,medium:'neutral'});
  assert.throws(()=>environment.setLight(1),/light-state-must-be-boolean/);
  assert.throws(()=>environment.setHeat(null),/heat-state-must-be-boolean/);
});

test('medium changes are atomic and acidic/basic can never coexist',()=>{
  const environment=createReactionLabEnvironment();
  assert.deepEqual(environment.setMedium('acidic'),{light:false,heat:false,medium:'acidic'});
  assert.deepEqual(environment.setMedium('basic'),{light:false,heat:false,medium:'basic'});
  assert.deepEqual(environment.setMedium('neutral'),{light:false,heat:false,medium:'neutral'});
  assert.throws(()=>environment.setMedium('pH 2'),/invalid-reaction-lab-medium/);
  assert.deepEqual(reactionLabEnvironmentStateFromTokens(['light','heat','acidic']),{light:true,heat:true,medium:'acidic'});
  assert.deepEqual(reactionLabEnvironmentStateFromTokens(['basic']),{light:false,heat:false,medium:'basic'});
  assert.throws(()=>reactionLabEnvironmentStateFromTokens(['acidic','basic']),/mutually-exclusive-ph/);
});

test('snapshots are immutable values and the canonical state domain has exactly twelve members',()=>{
  const environment=createReactionLabEnvironment(),first=environment.snapshot();
  assert.equal(Object.isFrozen(first),true);assert.throws(()=>{first.light=true;},TypeError);
  environment.setLight(true);environment.setMedium('acidic');
  assert.deepEqual(first,{light:false,heat:false,medium:'neutral'});
  assert.equal(Object.isFrozen(environment.snapshot()),true);
  const states=enumerateCanonicalReactionLabEnvironments();assert.equal(states.length,12);assert.equal(new Set(states.map(item=>`${item.snapshot.light}|${item.snapshot.heat}|${item.snapshot.medium}`)).size,12);
  assert.ok(states.every(item=>Object.isFrozen(item)&&Object.isFrozen(item.snapshot)&&Object.isFrozen(item.tokens)));
});

test('normalization emits only light, heat, acidic, and basic; neutral has no token',()=>{
  assert.deepEqual([...environmentTokensFromSnapshot({light:true,heat:false,medium:'neutral'})],['light']);
  assert.deepEqual([...environmentTokensFromSnapshot({light:false,heat:true,medium:'acidic'})],['heat','acidic']);
  assert.deepEqual([...environmentTokensFromSnapshot({light:true,heat:true,medium:'basic'})],['light','heat','basic']);
  assert.deepEqual([...environmentTokensFromSnapshot({light:false,heat:false,medium:'neutral'})],[]);
  assert.equal(validateNormalizedEnvironmentTokens(['light','heat','acidic']),true);
  assert.throws(()=>validateNormalizedEnvironmentTokens(['light','ultraviolet']),/unknown-environment-token/);
  assert.throws(()=>validateNormalizedEnvironmentTokens(['neutral']),/unknown-environment-token/,'Neutral is a medium state, never a normalized token');
  assert.throws(()=>validateNormalizedEnvironmentTokens(['heat','heat']),/duplicate-environment-token/);
  assert.throws(()=>validateNormalizedEnvironmentTokens(['acidic','basic']),/mutually-exclusive-ph/);
});

test('state validation rejects noncanonical shapes and a new page authority starts at defaults',()=>{
  assert.equal(validateReactionLabEnvironmentState({light:false,heat:false,medium:'neutral'}),true);
  for(const invalid of [null,[],{light:0,heat:false,medium:'neutral'},{light:false,heat:false,medium:'unknown'},{light:false,heat:false,medium:'neutral',temperature:300}])assert.throws(()=>validateReactionLabEnvironmentState(invalid),/invalid-reaction-lab-environment-state/);
  const prior=createReactionLabEnvironment();prior.setLight(true);prior.setHeat(true);prior.setMedium('basic');
  assert.deepEqual(createReactionLabEnvironment().snapshot(),{light:false,heat:false,medium:'neutral'});
  assert.equal(Object.isFrozen(snapshotReactionLabEnvironment({light:true,heat:false,medium:'acidic'})),true);
});
