// Optional real-Three.js check; no production build or package installation needed.
// Pass the absolute path to three/build/three.module.js as the first argument.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {checkPreviewModels} from './preview-model-checks.js';
if(!process.argv[2])throw new Error('Pass the path to three.module.js');
const THREE=await import(pathToFileURL(process.argv[2]));
const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url)));
console.log(checkPreviewModels(THREE,await json('../data/molecules.json'),await json('../data/craft-structures.json')));
