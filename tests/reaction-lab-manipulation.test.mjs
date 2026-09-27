import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContactMatcher, CONTACT_DWELL_MS } from '../src/reaction-lab-core.js';
import {
  chooseDepthTarget, CHAMBER_TIME_MODES, createChamberTimeAuthority,
  DEPTH_DOCKING_TIME_CONSTANT_MS, DEPTH_TARGET_ACQUIRE_PADDING_PX,
  DEPTH_TARGET_RELEASE_PADDING_PX, MANIPULATION_TIME_SCALE, MAX_DOCKING_COMPRESSION_WORLD,
  minimumMoleculeSurfaceGap, projectedSurfaceGap, scaleSimulationElapsed, solveDepthDocking,
} from '../src/reaction-lab-manipulation.js';

const sphere = (center, radius = 0.5, orientation = [0, 0, 0, 1]) => ({
  center, orientation, atoms: [{ position: [0, 0, 0], radius }],
});

test('projected real-atom surface gap measures large edges rather than molecule centers', () => {
  const left = [{ x: 20, y: 10, radiusPx: 8 }, { x: 80, y: 10, radiusPx: 8 }];
  const right = [{ x: 98, y: 10, radiusPx: 8 }];
  assert.equal(projectedSurfaceGap(left, right), 2);
  assert.equal(projectedSurfaceGap([], right), Infinity);
});

test('depth target acquisition is chemistry-independent, order-independent, and hysteretic', () => {
  assert.ok(DEPTH_TARGET_RELEASE_PADDING_PX > DEPTH_TARGET_ACQUIRE_PADDING_PX);
  const choices = [{ id: 'water-2', gapPx: 22 }, { id: 'acetone-1', gapPx: 9 }];
  assert.equal(chooseDepthTarget(null, choices), 'acetone-1');
  assert.equal(chooseDepthTarget(null, choices.reverse()), 'acetone-1');
  assert.equal(chooseDepthTarget('water-2', [{ id: 'water-2', gapPx: 39 }, { id: 'acetone-1', gapPx: 1 }]), 'water-2');
  assert.equal(chooseDepthTarget('water-2', [{ id: 'water-2', gapPx: 41 }, { id: 'acetone-1', gapPx: 25 }]), null);
  assert.equal(chooseDepthTarget('water-2', [{ id: 'water-2', gapPx: 3, busy: true }]), null);
  assert.equal(chooseDepthTarget('gone', [{ id: 'water-2', gapPx: 4, present: false }]), null);
  assert.equal(chooseDepthTarget(null, [{ id: 'same-b', gapPx: 2 }, { id: 'same-a', gapPx: 2 }]), 'same-a');
});

test('depth docking solves same-screen geometry at a different depth and chooses the nearest side', () => {
  const dragged = sphere([0, 0, 0], 0.5), target = sphere([0, 0, 4], 0.5);
  const beforeOrientation = [...dragged.orientation];
  const solution = solveDepthDocking({ dragged, target, cameraNormal: [0, 0, -1], previousCenter: [0, 0, 0] });
  assert.ok(solution);
  assert.ok(Math.abs(solution.center[2] - 3.06) < 1e-8);
  assert.ok(Math.abs(solution.minimumSurfaceGap + MAX_DOCKING_COMPRESSION_WORLD) < 1e-8);
  assert.deepEqual(dragged.orientation, beforeOrientation);
  assert.deepEqual(target.center, [0, 0, 4]);

  const centered = sphere([0, 0, 0], 0.5);
  const nearBack = solveDepthDocking({ dragged: centered, target: sphere([0, 0, 0], 0.5), cameraNormal: [0, 0, -1], previousCenter: [0, 0, 1] });
  assert.ok(nearBack);
  assert.ok(nearBack.center[2] > 0, 'The previous front/back branch is retained');
});

test('depth docking rejects projected geometry that cannot contact and never accepts deep overlap', () => {
  const impossible = solveDepthDocking({ dragged: sphere([0, 0, 0]), target: sphere([2, 0, 0]), cameraNormal: [0, 0, -1] });
  assert.equal(impossible, null);
  const solution = solveDepthDocking({ dragged: sphere([0, 0, 0]), target: sphere([0, 0, 3]), cameraNormal: [0, 0, -1] });
  assert.ok(solution);
  assert.ok(solution.compression <= MAX_DOCKING_COMPRESSION_WORLD + 1e-8);
  assert.ok(minimumMoleculeSurfaceGap({ dragged: { ...sphere(solution.center), center: solution.center }, target: sphere([0, 0, 3]) }) >= -MAX_DOCKING_COMPRESSION_WORLD - 1e-7);
});

test('manipulation scales simulation elapsed time without changing fixed physics step constants', async () => {
  assert.equal(MANIPULATION_TIME_SCALE, 0.15);
  const chamberTime = createChamberTimeAuthority();
  assert.equal(chamberTime.mode, CHAMBER_TIME_MODES.NORMAL);
  assert.equal(chamberTime.scale, 1);
  chamberTime.setMode(CHAMBER_TIME_MODES.MANIPULATING);
  assert.equal(chamberTime.mode, CHAMBER_TIME_MODES.MANIPULATING);
  assert.equal(chamberTime.scale, MANIPULATION_TIME_SCALE);
  chamberTime.setMode(CHAMBER_TIME_MODES.NORMAL);
  assert.equal(scaleSimulationElapsed(2, 1), 2);
  assert.equal(scaleSimulationElapsed(2, MANIPULATION_TIME_SCALE), 0.3);
  assert.equal(DEPTH_DOCKING_TIME_CONSTANT_MS, 45);
  const source = await readFile(new URL('../src/reaction-lab-stage-a.js', import.meta.url), 'utf8');
  assert.match(source, /STAGE_A_GAME_STEP_SECONDS\s*=\s*1\s*\/\s*120/);
  assert.match(source, /STAGE_A_PHYSICAL_PS_PER_GAME_SECOND\s*=\s*0\.10/);
});

test('reaction dwell follows simulation time, so 520 real milliseconds of slow drag is insufficient', () => {
  const matcher = createContactMatcher({ dwellMs: CONTACT_DWELL_MS });
  let simulationMs = 0;
  assert.equal(matcher.update('pair', true, simulationMs), false);
  simulationMs += scaleSimulationElapsed(0.52, MANIPULATION_TIME_SCALE) * 1000;
  assert.equal(matcher.update('pair', true, simulationMs), false);
  simulationMs += scaleSimulationElapsed(CONTACT_DWELL_MS / 1000 / MANIPULATION_TIME_SCALE, MANIPULATION_TIME_SCALE) * 1000;
  assert.equal(matcher.update('pair', true, simulationMs), true);
});
