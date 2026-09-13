import assert from 'node:assert/strict';
import {CHALLENGE_INSIGHT_IDS,EXPEDITION_CHALLENGES,challengeCenter,challengeEnvironment,recordChallengePassage} from '../src/veil/expedition-challenges.js';
import {environmentAt} from '../src/veil/universe.js';

assert.deepEqual(CHALLENGE_INSIGHT_IDS,[],'optional traversal challenges must not own fixed molecule insights outside the Graph frontier');
for(const challenge of EXPEDITION_CHALLENGES)assert.deepEqual(challenge.rewards,[],`${challenge.id}: normal molecule knowledge must come from the one-hop Graph frontier`);
const pulse=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='pulse'),pulseY=(pulse.bottom+pulse.top)/2,p={x:challengeCenter(pulse,pulseY),y:pulseY};
assert.notEqual(challengeEnvironment(p,0).pressure,challengeEnvironment(p,.6).pressure);assert.equal(challengeEnvironment({x:p.x+1000,y:p.y},0),null);
assert.ok(environmentAt({x:120,y:-11400}).heat>environmentAt({x:120,y:-9700}).heat);
for(const z of EXPEDITION_CHALLENGES){
  const enter={x:challengeCenter(z,z.bottom-1),y:z.bottom-1},beforeEnter={x:challengeCenter(z,z.bottom+1),y:z.bottom+1},exit={x:challengeCenter(z,z.top-1),y:z.top-1},beforeExit={x:challengeCenter(z,z.bottom-1),y:z.bottom-1};
  const r={map:{universe:true},player:enter,events:[]};recordChallengePassage(r,beforeEnter);r.player=exit;recordChallengePassage(r,beforeExit);assert.deepEqual(r.events[0]?.rewards,z.rewards);recordChallengePassage(r,beforeExit);assert.equal(r.events.length,1);
}
console.log('Optional mixed currents and traversal completion passed without bypassing Graph-frontier insight ownership.');
