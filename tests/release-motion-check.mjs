import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {checkReleaseMotion} from './release-motion-checks.js';
if(!process.argv[2])throw new Error('Pass the absolute path to three/build/three.module.js');
const THREE=await import(pathToFileURL(process.argv[2]));
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
console.log(JSON.stringify(checkReleaseMotion(THREE,records),null,2));
