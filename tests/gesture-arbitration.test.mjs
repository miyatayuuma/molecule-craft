import assert from 'node:assert/strict';
import { POINTER_ARBITRATION, chooseAtomOrElectron, hasCompatibleElectronPair, pickAtomAtPointer, pickBondAtPointer } from '../src/gesture-arbitration.js';

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

const filled = { atomId: 1, screenX: 100, screenY: 100, unpaired: 0 };
const reactive = { atomId: 2, screenX: 200, screenY: 100, unpaired: 1 };
assert.equal(chooseAtomOrElectron(130,100,[filled,reactive],{atomId:2,distance:45,assisted:true}).atomId,1,'A distant electron assist must not steal a filled atom.');
assert.equal(chooseAtomOrElectron(110,100,[filled],{atomId:2,distance:0,assisted:false}).kind,'electron','A directly hit electron must stay draggable even over an atom center.');
assert.equal(chooseAtomOrElectron(130,100,[filled],{atomId:2,distance:3,assisted:false}).kind,'electron','A precise electron grab remains available near a filled atom.');
assert.equal(chooseAtomOrElectron(225,100,[reactive],{atomId:2,distance:8,assisted:false}).kind,'electron');
assert.equal(chooseAtomOrElectron(230,100,[reactive],null),null,'Reactive atoms leave their periphery for electrons.');
assert.equal(chooseAtomOrElectron(230,100,[{...reactive,unpaired:0}],null).kind,'atom','Filling an atom immediately enlarges its target.');
assert.equal(chooseAtomOrElectron(130,100,[{...filled,unpaired:1}],{atomId:1,distance:12,assisted:false}).kind,'electron','Breaking a bond restores electron priority for that atom.');
