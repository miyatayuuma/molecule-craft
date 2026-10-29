import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { REACTION_CATALOG } from '../src/reaction-lab-catalog.js';
import snapshot from './fixtures/reaction-lab-catalog-migration-snapshot.json' with { type: 'json' };

function chemicalProjection(rows) {
  return rows.map(({ id, familyId, reactants, products, requires, forbids }) => ({
    id,
    familyId,
    reactants: reactants.map(({ role, species }) => ({ role, species })),
    products: [...products],
    requires: [...requires],
    forbids: [...forbids],
  }));
}

function digest(projection) {
  return `sha256:${createHash('sha256').update(JSON.stringify(projection)).digest('hex')}`;
}

test('production catalog matches the digest and manifest captured from the pre-migration fixture', async () => {
  const projection = chemicalProjection(REACTION_CATALOG);
  assert.equal(projection.length, snapshot.count);
  assert.equal(digest(projection), snapshot.digest, 'Digest pins the old fixture literals after those literals are removed');
  assert.deepEqual(projection.map(row => row.id), snapshot.ids);
  assert.equal(REACTION_CATALOG.length, 29);
  const core = await readFile(new URL('../src/reaction-lab-core.js', import.meta.url), 'utf8');
  assert.match(core, /reaction-lab-catalog\.js/);
  assert.doesNotMatch(core, /id:'anhydride-hydrolysis'/, 'The old inline two-rule production catalog is removed');
  await assert.rejects(readFile(new URL('./fixtures/reaction-lab-complete-catalog.mjs', import.meta.url)), { code: 'ENOENT' }, 'The duplicate reaction literals are removed after parity passed');
});
