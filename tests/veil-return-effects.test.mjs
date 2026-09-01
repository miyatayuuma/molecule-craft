import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {RETURN_EFFECTS,createReturnEffect,returnEffectFrame} from '../src/veil/renderer.js';

const stable=createReturnEffect('stable'),emergency=createReturnEffect('emergency');
assert.ok(stable.duration>=.6&&stable.duration<=1,'Stable retrieval stays inside the requested presentation window');
assert.ok(emergency.duration<stable.duration,'Emergency retrieval collapses faster than controlled retrieval');
assert.equal(createReturnEffect('unknown'),null);

stable.life=stable.duration*.5;emergency.life=emergency.duration*.5;
const stableFrame=returnEffectFrame(stable),emergencyFrame=returnEffectFrame(emergency);
assert.equal(stableFrame.mode,'stable');assert.equal(stableFrame.warp,0,'Controlled retrieval never distorts the field');
assert.equal(emergencyFrame.mode,'emergency');assert.ok(emergencyFrame.collapse>stableFrame.collapse,'Emergency retrieval is already collapsing more aggressively at the same normalized time');

emergency.life=emergency.duration*.15;assert.ok(returnEffectFrame(emergency).warp>0,'Emergency retrieval begins with a short field distortion');
for(const effect of [stable,emergency]){effect.life=effect.duration;const frame=returnEffectFrame(effect);assert.equal(frame.progress,1);assert.equal(frame.collapse,1);}
assert.equal(RETURN_EFFECTS.stable.duration,EXPEDITION.anchorLockSeconds);assert.deepEqual(RETURN_EFFECTS,{stable:{duration:.8},emergency:{duration:.65}});

console.log('Return effects passed: distinct controlled/emergency timing, collapse profiles and emergency-only distortion.');
