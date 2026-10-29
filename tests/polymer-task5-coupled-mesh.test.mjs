import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {evaluateCoupledMesh} from '../scripts/polymer-task5-coupled-mesh-oracle.mjs';
import {initial, inputFor} from '../scripts/analyze-polymer-task5-orientation-feasibility.mjs';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import * as T from '../vendor/three/three.module.min.js';

const base = new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-coupled-6d508e75/', import.meta.url);
const read = name => JSON.parse(gunzipSync(fs.readFileSync(new URL(name + '.json.gz', base))));
const result = read('result'), confirmation = read('confirmation');

test('optimizer numerical success cannot certify an observed coupled visibility failure', () => {
  assert.equal(result.solver.success, true);
  assert.equal(result.evaluations, 25);
  assert.ok(result.evaluations <= result.protocol.maximumObjectiveEvaluations);
  assert.equal(confirmation.disposition, 'UNRESOLVED');
  assert.equal(confirmation.globalProof, false);
  assert.ok(confirmation.rows.every(r => r.minimumMargin < 1 && !r.grade.jointPartialPixelPass));
  for (const r of confirmation.rows) {
    assert.deepEqual(r.grade.bonds.filter(b => !b.pass).map(b => b.index), [33, 34]);
    assert.ok(r.grade.atoms.every(a => a.pass));
    assert.ok(r.grade.bonds.filter(b => [32, 35].includes(b.index)).every(b => b.pass));
    assert.ok(Object.values(r.guards).every(Boolean));
  }
});

test('retained best pose replays full native mesh metrics and unchanged production fit without mutating chemistry', () => {
  const before = JSON.stringify(initial);
  const replay = evaluateCoupledMesh(result.best.rotationDegrees);
  assert.deepEqual(replay, result.best);
  const fit = fitPolymerObservation(T, {...inputFor(30), quaternion: new T.Quaternion(...replay.pose.quaternion)});
  assert.deepEqual(fit.position, replay.pose.position);
  assert.equal(fit.scale, replay.pose.scale);
  assert.equal(fit.qMin, replay.qMin);
  assert.equal(JSON.stringify(initial), before);
  assert.equal(inputFor(30).requiredAtomIndices.length, 11);
  assert.equal(inputFor(30).requiredBondIndices.length, 10);
});

test('retained search minimum accounts for every independent constraint, not only the improving bond', () => {
  const history = gunzipSync(fs.readFileSync(new URL('history.jsonl.gz', base))).toString().trim().split('\n').map(JSON.parse);
  assert.equal(history.length, result.evaluations);
  assert.ok(history.every(r => r.rotationDegrees.every(v => Math.abs(v) <= 6)));
  for (const r of history) {
    assert.equal(r.grade.atoms.length, 11);
    assert.equal(r.grade.bonds.length, 10);
    const independent = [r.qMin / 20,
      ...r.grade.atoms.flatMap(a => [a.visibleFraction / .6, a.diameter / (initial.graph.atoms[a.index].element === 'H' ? 5.5 : 9.5)]),
      ...r.grade.bonds.flatMap(b => [b.visiblePixels / b.requiredPixels, b.continuous / 7.75, b.width / 1.25, b.length / 7.75])];
    assert.equal(r.minimumMargin, Object.values(r.guards).every(Boolean) ? Math.min(...independent) : 0);
  }
  assert.equal(Math.max(...history.map(r => r.minimumMargin)), result.best.minimumMargin);
});
