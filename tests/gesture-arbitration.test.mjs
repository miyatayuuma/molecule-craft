import assert from 'node:assert/strict';
import { POINTER_ARBITRATION, hasCompatibleElectronPair, pickAtomAtPointer, pickBondAtPointer } from '../src/gesture-arbitration.js';

const atoms = [
  { atomId: 1, screenX: 100, screenY: 100, depth: .2 },
  { atomId: 2, screenX: 128, screenY: 100, depth: .1 },
];

assert.equal(pickAtomAtPointer(119, 100, atoms, POINTER_ARBITRATION.atomCoreRadiusPx)?.atomId, 2, 'The nearest atom center must win the core target.');
assert.equal(pickAtomAtPointer(66, 100, atoms.slice(0, 1), POINTER_ARBITRATION.atomStructureRadiusPx)?.atomId, 1, 'Structure mode must expose the enlarged atom target.');
assert.equal(pickAtomAtPointer(66, 100, atoms.slice(0, 1), POINTER_ARBITRATION.atomReactiveRadiusPx), null, 'Reactive mode must leave space around atoms for electron gestures.');

const bond = [{ key: '1:2', startX: 100, startY: 100, endX: 180, endY: 100, depth: .2 }];
assert.equal(pickBondAtPointer(140, 108, bond)?.key, '1:2', 'The exposed middle of a bond must be interactive.');
assert.equal(pickBondAtPointer(112, 100, bond), null, 'A bond must not steal input near its first atom.');
assert.equal(pickBondAtPointer(171, 100, bond), null, 'A bond must not steal input near its second atom.');

const electrons = [{ atomId: 1 }, { atomId: 1 }, { atomId: 2 }];
assert.equal(hasCompatibleElectronPair(electrons, (a, b) => a === 1 && b === 2), true);
assert.equal(hasCompatibleElectronPair(electrons, () => false), false);
assert.equal(hasCompatibleElectronPair([{ atomId: 1 }, { atomId: 1 }], () => true), false, 'Electrons on one atom alone must not force reactive mode.');

console.log('Gesture arbitration tests passed.');
