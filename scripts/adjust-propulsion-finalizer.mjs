import {readFile,writeFile,unlink} from 'node:fs/promises';

const path='src/veil/universe.js';
const source=await readFile(path,'utf8');
const line="  Object.freeze({id:'h-boundary-shear',x:530,y:-3800,radius:110,phase:1.75,angle:0,force:2600,cleanHalfWidth:50,route:'h-boundary',kind:'burst-advantage'}),\n";
if(!source.includes(line))throw new Error('H boundary shear patch anchor missing');
await writeFile(path,source.replace(line,''));
await unlink('scripts/adjust-propulsion-finalizer.mjs');
