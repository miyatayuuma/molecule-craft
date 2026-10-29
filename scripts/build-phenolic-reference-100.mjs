// Generate the deterministic display-only 100-ring phenolic model at build
// time, so a phone never has to perform the expensive branch-placement search.
import {writeFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel} from '../src/polymer-reference-model.js';

const model=createPolymerReferenceModel(THREE,'phenol-formaldehyde-resin',100);
if(model.ringCount!==100||model.aromaticCycles.length!==100||model.bridges.length!==99)throw new Error('Incomplete phenolic reference model');
await writeFile(new URL('../data/phenolic-reference-100.json',import.meta.url),JSON.stringify(model)+'\n');
console.log(`Generated phenolic reference: ${model.atoms.length} atoms, ${model.bonds.length} bonds, ${model.ringCount} rings`);
