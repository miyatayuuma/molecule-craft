import assert from 'node:assert/strict';
import {EXPEDITION} from '../src/veil/config.js';
import {RETURN_EFFECTS,createReturnEffect,returnEffectFrame} from '../src/veil/renderer.js';

const stable=createReturnEffect('stable'),emergency=createReturnEffect('emergency'),stableWarp=createReturnEffect('stable-warp'),emergencyWarp=createReturnEffect('emergency-warp');
assert.ok(stable.duration>=.6&&stable.duration<=1,'Stable retrieval stays inside the requested presentation window');
assert.ok(emergency.duration>=1.2,'Loss presentation remains visible before the terminal transition');
assert.equal(createReturnEffect('unknown'),null);

stable.life=stable.duration*.5;emergency.life=emergency.duration*.5;
const stableFrame=returnEffectFrame(stable),emergencyFrame=returnEffectFrame(emergency);
assert.equal(stableFrame.mode,'stable');assert.equal(stableFrame.warp,0,'Normal extraction wait does not start its warp early');
assert.equal(emergencyFrame.mode,'emergency');assert.equal(emergencyFrame.collapse,0,'Forced loss particles remain unobscured throughout the loss phase');assert.equal(emergencyFrame.warp,0,'Forced warp starts after loss presentation');

stableWarp.life=stableWarp.duration*.5;emergencyWarp.life=emergencyWarp.duration*.5;
assert.ok(returnEffectFrame(stableWarp).warp>0,'Normal extraction has a distinct terminal warp phase');assert.ok(returnEffectFrame(emergencyWarp).warp>0,'Forced return gets a terminal warp only after loss');
for(const effect of [stable,emergency,stableWarp,emergencyWarp]){effect.life=effect.duration;const frame=returnEffectFrame(effect);assert.equal(frame.progress,1);if(frame.mode.endsWith('-warp'))assert.equal(frame.collapse,1);}
assert.equal(RETURN_EFFECTS.stable.duration,EXPEDITION.normalExtractionSeconds);assert.equal(RETURN_EFFECTS.emergency.duration,1.35);assert.equal(RETURN_EFFECTS['stable-warp'].duration,.48);assert.equal(RETURN_EFFECTS['emergency-warp'].duration,.56);

console.log('Return effects passed: preserved normal pending, extended visible forced loss, separate post-presentation warp and fixed reduced-motion timing.');
