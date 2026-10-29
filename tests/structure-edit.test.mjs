import {readFile} from 'node:fs/promises';
import {checkTorsionModel} from './torsion-checks.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
console.log('Torsion constraints, branch selection, fixed supports and isolated atoms:',checkTorsionModel(records));
