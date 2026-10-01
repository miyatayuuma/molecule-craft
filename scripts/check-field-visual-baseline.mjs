// Frozen P1 visual authority; never regenerate it to admit an optimization.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(process.argv[2]??join(root,'test-results/field-particle-p1'));
const manifest=JSON.parse(await readFile(join(root,'tests/fixtures/field-particle-p1/manifest.json')));
const rows=[];
for(const {file}of manifest.visuals){
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  const baseline=hash(await readFile(join(root,'tests/fixtures/field-particle-p1',file))),actual=hash(await readFile(join(output,file)));
  rows.push({file,baseline,actual,equal:baseline===actual});
}
await writeFile(join(output,'visual-comparison.json'),JSON.stringify(rows,null,2)+'\n');
assert.equal(rows.length,18);assert.ok(rows.every(r=>r.equal),'Frozen P1 visual bytes changed');
console.log('P1 visual authority: 18/18 byte identical.');
