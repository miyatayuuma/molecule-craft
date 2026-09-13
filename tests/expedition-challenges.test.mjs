import assert from 'node:assert/strict';
import {CHALLENGE_INSIGHT_IDS,EXPEDITION_CHALLENGES,challengeEnvironment,recordChallengePassage} from '../src/veil/expedition-challenges.js';
import {environmentAt} from '../src/veil/universe.js';

assert.deepEqual(CHALLENGE_INSIGHT_IDS,[],'optional traversal challenges must not own fixed molecule insights outside the Graph frontier');
for(const challenge of EXPEDITION_CHALLENGES)assert.deepEqual(challenge.rewards,[],`${challenge.id}: normal molecule knowledge must come from the one-hop Graph frontier`);
const p={x:120,y:-8500};assert.notEqual(challengeEnvironment(p,0).pressure,challengeEnvironment(p,.6).pressure);assert.equal(challengeEnvironment({x:1000,y:-8500},0),null);
assert.ok(environmentAt({x:120,y:-11400}).heat>environmentAt({x:120,y:-9700}).heat);
for(const z of EXPEDITION_CHALLENGES){const r={map:{universe:true},player:{x:120,y:z.bottom-1},events:[]};recordChallengePassage(r,{x:120,y:z.bottom+1});r.player.y=z.top-1;recordChallengePassage(r,{x:120,y:z.bottom-1});assert.deepEqual(r.events[0]?.rewards,z.rewards);recordChallengePassage(r,{x:120,y:z.bottom-1});assert.equal(r.events.length,1);}
console.log('Optional mixed currents and traversal completion passed without bypassing Graph-frontier insight ownership.');
