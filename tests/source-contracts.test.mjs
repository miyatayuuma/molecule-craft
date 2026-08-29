import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [index, app, chemistry, solver, database] = await Promise.all([
  readFile(new URL('index.html', root), 'utf8'),
  readFile(new URL('src/app-v14.js', root), 'utf8'),
  readFile(new URL('src/chemistry.js', root), 'utf8'),
  readFile(new URL('src/structure-relaxation.js', root), 'utf8'),
  readFile(new URL('data/molecules.json', root), 'utf8').then(JSON.parse),
]);

assert.match(index, /<script type="module" src="\.\/src\/app-v14\.js"><\/script>/);
assert.equal((index.match(/data-element=/g) ?? []).length, 8, 'Static element palette must remain in HTML');
assert.ok(database.length >= 100, `Expected at least 100 molecule records, got ${database.length}`);
assert.doesNotMatch(chemistry, /const KNOWN_MOLECULES/);
assert.doesNotMatch(app, /completeBenzeneCycle|renderMolecule\(|relaxGeometryStep/);
assert.match(app, /depthTest:false/);
assert.match(app, /ELECTRON_SNAP_PX=58/);
assert.match(solver, /aromaticPlanarGroup/);
assert.match(solver, /planarSubstituentGroup/);

const cameraMutationLines = app.split('\n').filter(line => /camera\.position\.(set|copy|add)|cameraTarget\.(set|copy|add)/.test(line));
assert.equal(cameraMutationLines.length, 3, `Unexpected camera mutation:\n${cameraMutationLines.join('\n')}`);
assert.ok(cameraMutationLines.every(line => line.includes('const camera=') || line.includes('function panCamera') || line.includes('function zoomCamera')));

console.log('Source contract tests passed.');
