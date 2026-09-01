import assert from 'node:assert/strict';
import {LOST_CARGO_PARTICLE_CAP,createLostCargoParticles,lostCargoParticleCounts} from '../src/veil/renderer.js';

assert.deepEqual(lostCargoParticleCounts({H:3,C:1,O:2}),{H:3,C:1,O:2},'Small losses keep one visual particle per lost dust unit');
const compressed=lostCargoParticleCounts({H:100,C:50,O:25});
assert.deepEqual(compressed,{H:20,C:10,O:6});
assert.equal(Object.values(compressed).reduce((sum,n)=>sum+n,0),LOST_CARGO_PARTICLE_CAP,'Large losses stay inside the mobile rendering cap');

const particles=createLostCargoParticles({H:100,C:50,O:25},{x:12,y:-8},()=>.5),byElement=Object.groupBy(particles,particle=>particle.element);
assert.equal(particles.length,LOST_CARGO_PARTICLE_CAP);
assert.deepEqual(Object.fromEntries(Object.entries(byElement).map(([element,list])=>[element,list.length])),compressed,'Visual mix follows the compressed H/C/O loss ratio');
assert.ok(particles.every(particle=>Number.isFinite(particle.vx)&&Number.isFinite(particle.vy)&&particle.duration<=.62),'Lost cargo particles are finite-lived visual objects');
assert.equal(createLostCargoParticles({H:0,C:0,O:0},{x:0,y:0}).length,0);

console.log('Lost cargo particles passed: H/C/O correspondence, proportional compression, finite lifetime and mobile object cap.');
