import {readFile,writeFile,unlink} from 'node:fs/promises';

const path='src/veil/universe.js';
const source=await readFile(path,'utf8');
const hLine="  Object.freeze({id:'h-boundary-shear',x:530,y:-3800,radius:110,phase:1.75,angle:0,force:2600,cleanHalfWidth:50,route:'h-boundary',kind:'burst-advantage'}),\n";
if(!source.includes(hLine))throw new Error('H boundary shear patch anchor missing');
let next=source.replace(hLine,'');
const before='force:2600,cleanHalfWidth:50';
const matches=next.split(before).length-1;
if(matches!==2)throw new Error(`Expected two optional BURST shear widths, found ${matches}`);
next=next.replaceAll(before,'force:2600,cleanHalfWidth:40');
await writeFile(path,next);
await unlink('scripts/adjust-propulsion-finalizer.mjs');
