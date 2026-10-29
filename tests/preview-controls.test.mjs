import assert from 'node:assert/strict';
import {createPreviewControls} from '../src/preview-controls.js';

let calls=0;const controls=createPreviewControls(()=>calls++),initial=controls.snapshot();
controls.down(1,10,10);controls.move(1,30,25);
assert.notEqual(controls.snapshot().yaw,initial.yaw);assert.notEqual(controls.snapshot().pitch,initial.pitch);
controls.down(2,40,25);const before=controls.snapshot();controls.move(2,80,40);
assert.notEqual(controls.snapshot().zoom,before.zoom);assert.notEqual(controls.snapshot().roll,before.roll);
controls.up(1);controls.up(2);controls.zoom(999);assert.equal(controls.snapshot().zoom,2.8);
controls.zoom(.0001);assert.equal(controls.snapshot().zoom,.45);
controls.reset();assert.deepEqual(controls.snapshot(),initial);assert.ok(calls>=5);
console.log('Collection preview controls tests passed.');
