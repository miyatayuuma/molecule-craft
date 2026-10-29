import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('committed Stage B calibration audit passes its pure-data integrity check',()=>{
  const result=spawnSync(process.execPath,['scripts/audit-reaction-lab-stage-b.mjs','--check'],{encoding:'utf8'});
  assert.equal(result.status,0,`${result.stdout}${result.stderr}`);
});
