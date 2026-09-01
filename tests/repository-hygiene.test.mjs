import assert from 'node:assert/strict';
import {inspectRepository} from '../scripts/check-repository-hygiene.mjs';

const result=await inspectRepository(new URL('../',import.meta.url));
assert.deepEqual(result.errors,[]);
for(const warning of result.warnings)console.warn(`Repository hygiene warning: ${warning}`);
console.log(`Repository hygiene passed: ${result.fileCount} files, ${result.warnings.length} warning(s).`);
