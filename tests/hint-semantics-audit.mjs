import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {nextCraftBondHint as optimizedHint} from '../src/craft-target-hint.js';

const BASE='ad17cf9b0758d953d0834e0a63f70b8864a6cb45';
const baselineSource=execFileSync('git',['show',`${BASE}:src/craft-target-hint.js`],{encoding:'utf8'});
const baselineUrl=`data:text/javascript;base64,${Buffer.from(baselineSource).toString('base64')}`;
const {nextCraftBondHint:baselineHint}=await import(baselineUrl);
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const workspace=(record,bondCount)=>({atoms:record.atoms.map((element,index)=>({id:1000+index,element})),bonds:record.bonds.slice(0,bondCount).map(([a,b,order])=>({a:1000+a,b:1000+b,order}))});
const normalize=result=>result&&({atomIds:result.atomIds,workspaceIndices:result.workspaceIndices,currentOrder:result.currentOrder,nextOrder:result.nextOrder,targetOrder:result.targetOrder,targetAtomIndices:result.targetAtomIndices,equivalentCandidates:result.equivalentCandidates});
let cases=0;
for(const record of records){
  const m=record.bonds.length,counts=[0,Math.floor(m/3),Math.floor(m*2/3),Math.max(0,m-1),m];
  for(const count of [...new Set(counts)]){
    const current=workspace(record,count),before=JSON.stringify(current),expected=normalize(baselineHint(record,current)),actual=normalize(optimizedHint(record,current));
    assert.equal(JSON.stringify(current),before,`${record.id} stage ${count} mutated workspace`);
    assert.deepEqual(actual,expected,`${record.id} stage ${count}/${m} changed hint semantics`);cases++;
  }
}
console.log(`CRAFT hint semantic equivalence passed: ${cases} staged workspaces across ${records.length} molecules.`);
