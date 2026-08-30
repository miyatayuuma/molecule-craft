import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {checkStructureSettlement} from './structure-settlement-checks.js';
const read=path=>readFile(new URL(path,import.meta.url)).then(JSON.parse);
console.log(checkStructureSettlement(THREE,await read('../data/molecules.json'),await read('../data/craft-structures.json')));
