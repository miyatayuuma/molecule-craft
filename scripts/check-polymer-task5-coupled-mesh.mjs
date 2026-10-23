// Owner: Task5 coupled feasibility ledger. Fixed three-mode confirmation only.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {evaluateCoupledMesh} from './polymer-task5-coupled-mesh-oracle.mjs';
const dir = 'test-results/pib-coupled-mesh';
const result = JSON.parse(fs.readFileSync(dir + '/result.json'));
assert.ok(!fs.existsSync(dir + '/confirmation.json'), 'do not repeat a saved confirmation');
const rows = ['legacy4', 'shader32', 'float64'].map(precision => ({precision, ...evaluateCoupledMesh(result.best.rotationDegrees, precision)}));
assert.deepEqual(rows[0].pose, result.best.pose);
assert.equal(rows[0].minimumMargin, result.best.minimumMargin);
const summary = {
  kind: 'FIXED_CPU_SENSITIVITY_NOT_GPU_ACCEPTANCE',
  rasters: rows.length,
  remainingControlRastersNotRun: 6,
  reason: 'selected anchor30 fails; no additional 0/17 confirmation or GPU campaign justified',
  disposition: rows.every(r => r.minimumMargin >= 1 && Object.values(r.guards).every(Boolean)) ? 'CPU_WITNESS_ONLY' : 'UNRESOLVED',
  globalProof: false,
  rows,
};
fs.writeFileSync(dir + '/confirmation.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({disposition: summary.disposition, rows: rows.map(r => ({precision: r.precision, minimumMargin: r.minimumMargin, failures: r.grade.bonds.filter(b => !b.pass)}))}, null, 2));
