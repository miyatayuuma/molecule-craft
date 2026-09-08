import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compactPartNotation} from '../src/craft-panel.js';
const templates=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url)));
const part=id=>templates.find(item=>item.id===id);
assert.equal(compactPartNotation(part('n-butyl')),'–C4H9','Long chain notation compacts while retaining the attachment dash');
assert.equal(compactPartNotation(part('hydroxyl')),'–OH','Short functional-group notation stays structural');
assert.equal(compactPartNotation(part('phenyl')),'–C₆H₅','Already compact notation is preserved');
console.log('Craft target display policy passed.');
