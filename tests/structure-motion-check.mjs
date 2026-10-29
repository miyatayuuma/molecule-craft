import {pathToFileURL} from 'node:url';
import {checkStructureMotion} from './structure-motion-checks.js';
if(!process.argv[2])throw new Error('Pass the absolute path to three/build/three.module.js');
console.log(checkStructureMotion(await import(pathToFileURL(process.argv[2]))));
