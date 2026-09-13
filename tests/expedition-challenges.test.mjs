import assert from 'node:assert/strict';
import {EXPEDITION_CHALLENGES,challengeEnvironment,recordChallengePassage} from '../src/veil/expedition-challenges.js';
import {environmentAt} from '../src/veil/universe.js';
const p={x:120,y:-8500};assert.notEqual(challengeEnvironment(p,0).pressure,challengeEnvironment(p,.6).pressure);assert.equal(challengeEnvironment({x:1000,y:-8500},0),null);
assert.ok(environmentAt({x:120,y:-11400}).heat>environmentAt({x:120,y:-9700}).heat);
for(const z of EXPEDITION_CHALLENGES){const r={map:{universe:true},player:{x:120,y:z.bottom-1},events:[]};recordChallengePassage(r,{x:120,y:z.bottom+1});r.player.y=z.top-1;recordChallengePassage(r,{x:120,y:z.bottom-1});assert.equal(r.challengeProgress[z.id]?.complete,true);assert.deepEqual(r.events,[],'challenge traversal must not bypass the graph frontier with a fixed molecule reward');recordChallengePassage(r,{x:120,y:z.bottom-1});assert.deepEqual(r.events,[]);}
console.log('Optional mixed currents, hot/quiet regions and graph-neutral one-time traversal progress passed.');
