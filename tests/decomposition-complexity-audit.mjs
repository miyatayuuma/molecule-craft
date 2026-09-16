import {performance} from 'node:perf_hooks';
import {readFile} from 'node:fs/promises';
import {decomposeTargetIntoAvailableParts} from '../src/craft-decomposition.js';
import {detectFunctionalGroups,validateFunctionalGroups} from '../src/functional-groups.js';

const parts=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url),'utf8'));
const groups=validateFunctionalGroups(JSON.parse(await readFile(new URL('../data/functional-groups.json',import.meta.url),'utf8')));
const molecules=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const alkane=n=>{const atoms=Array(n).fill('C'),bonds=[];for(let i=0;i<n-1;i++)bonds.push([i,i+1,1]);let h=n;for(let i=0;i<n;i++){const count=i===0||i===n-1?3:2;for(let j=0;j<count;j++){atoms.push('H');bonds.push([i,h++,1]);}}return{atoms,bonds};};
const chain=n=>({atoms:Array(n).fill('C'),bonds:Array.from({length:n-1},(_,i)=>[i,i+1,1])});
const bench=(name,fn)=>{const start=performance.now(),result=fn(),elapsed=performance.now()-start;console.log(JSON.stringify({name,elapsed:+elapsed.toFixed(3),resultSize:Array.isArray(result)?result.length:undefined}));return result;};
for(const n of [4,6,8,10,12])bench(`decompose:C${n}H${2*n+2}`,()=>decomposeTargetIntoAvailableParts(alkane(n),parts));
for(const n of [20,40,80,160])bench(`functional:carbon-chain-${n}`,()=>detectFunctionalGroups(chain(n),groups));
const largest=[...molecules].sort((a,b)=>b.atoms.length-a.atoms.length).slice(0,10);
for(const record of largest)bench(`decompose:db:${record.id}:${record.atoms.length}`,()=>decomposeTargetIntoAvailableParts(record,parts));
