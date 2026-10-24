// Owner: Task5 coupled feasibility ledger. CPU oracle, never production/RAF.
import fs from 'node:fs';
import readline from 'node:readline';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {gunzipSync} from 'node:zlib';
import * as T from '../vendor/three/three.module.min.js';
import {fitPolymerObservation} from '../src/reaction-lab-polymer-presentation.js';
import {initial, inputFor, measure, normalized} from './analyze-polymer-task5-orientation-feasibility.mjs';

const root = new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/', import.meta.url);
const refs = JSON.parse(gunzipSync(fs.readFileSync(new URL('pib-orientation-6a2f056a/decomposition.json.gz', root)))).rows;
const ref = refs.find(r => r.anchor === 30);
export function evaluateCoupledMesh(rotationDegrees, precision = 'legacy4') {
    assert.ok(Array.isArray(rotationDegrees) && rotationDegrees.length === 3 && rotationDegrees.every(v => Number.isFinite(v) && Math.abs(v) <= 6));
    const v = new T.Vector3(...rotationDegrees).multiplyScalar(Math.PI / 180);
    const q = new T.Quaternion();
    if (v.length()) q.setFromAxisAngle(v.clone().normalize(), v.length());
    q.multiply(new T.Quaternion(...ref.pose.quaternion));
    // Explicit q bypasses orientation enumeration. Empty required arrays avoid
    // the legacy smooth scorer; selected shell and fit geometry remain identical.
    const input = inputFor(30);
    const fit = fitPolymerObservation(T, {...input, quaternion: q, requiredAtomIndices: [], requiredBondIndices: []});
    const pose = {quaternion: q.toArray(), position: fit.position, scale: fit.scale};
    const m = measure(pose, 30, null, precision), margins = normalized(m.grade, fit.qMin);
    const f = initial.canvas.height / (2 * Math.tan(initial.camera.fov * Math.PI / 360));
    const depths = m.snapshot.visual.atoms.flatMap(a => [a.center.depth - a.radius * a.center.depth / f, a.center.depth + a.radius * a.center.depth / f]);
    const guards = {fit: fit.fits, near: Math.min(...depths) > .2, far: Math.max(...depths) < initial.camera.far};
    return {rotationDegrees, pose, minimumMargin: Object.values(guards).every(Boolean) ? margins[0].value : 0, margins, grade: m.grade, guards, qMin: fit.qMin, bounds: fit.bounds};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
let evaluations = 0;
for await (const line of readline.createInterface({input: process.stdin})) {
  try {
    assert.ok(evaluations++ < 240, 'fixed oracle budget exhausted');
    const {rotationDegrees} = JSON.parse(line);
    process.stdout.write(JSON.stringify(evaluateCoupledMesh(rotationDegrees)) + '\n');
  } catch (e) {
    process.stdout.write(JSON.stringify({error: String(e.stack)}) + '\n');
  }
}
}
