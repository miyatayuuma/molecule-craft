import test from 'node:test';
import assert from 'node:assert/strict';
import {craftHintElectronKeys,nextCraftBondHint as hint} from '../src/craft-target-hint.js';
const graph=(atoms,bonds=[],ids=atoms.map((_,i)=>100+i))=>({atoms:atoms.map((element,i)=>({id:ids[i],element})),bonds:bonds.map(([a,b,order])=>({a:ids[a],b:ids[b],order}))});
const run=(target,workspace)=>{const before=JSON.stringify([target,workspace]),result=hint(target,workspace);assert.equal(JSON.stringify([target,workspace]),before);return result;};

test('H2 highlights its only available electron pair',()=>{
 const target={atoms:['H','H'],bonds:[[0,1,1]]},r=run(target,graph(['H','H']));assert.deepEqual(r.atomIds,[100,101]);assert.equal(r.nextOrder,1);
});
test('O2 recomputes one bond-order increment at a time on the same atoms',()=>{
 const target={atoms:['O','O'],bonds:[[0,1,2]]};
 assert.equal(run(target,graph(['O','O'])).nextOrder,1);
 const r=run(target,graph(['O','O'],[[0,1,1]]));assert.deepEqual(r.atomIds,[100,101]);assert.equal(r.currentOrder,1);assert.equal(r.nextOrder,2);
 assert.equal(run(target,graph(['O','O'],[[0,1,2]])),null);
});
test('N2 exposes 0→1→2→3 as the same pure mechanism',()=>{
 const target={atoms:['N','N'],bonds:[[0,1,3]]};
 for(let order=0;order<3;order++){const r=run(target,graph(['N','N'],order?[[0,1,order]]:[]));assert.equal(r.currentOrder,order);assert.equal(r.nextOrder,order+1);}
 assert.equal(run(target,graph(['N','N'],[[0,1,3]])),null);
});
test('CO2 accepts symmetric equivalent oxygens and applies a stable workspace-order tie-break',()=>{
 const target={atoms:['C','O','O'],bonds:[[0,1,2],[0,2,2]]},workspace=graph(['O','C','O'],[],[900,7,300]);
 const r=run(target,workspace);assert.equal(r.equivalentCandidates.length,2);assert.deepEqual(r.atomIds,[900,7]);
 const after=graph(['O','C','O'],[[0,1,1]],[900,7,300]),r2=run(target,after);assert.deepEqual(r2.atomIds,[900,7]);assert.equal(r2.nextOrder,2);
});
test('atom IDs are labels only: renaming them does not change the chosen structural step',()=>{
 const target={atoms:['C','O','O'],bonds:[[0,1,2],[0,2,2]]};
 const a=run(target,graph(['O','C','O'],[],[900,7,300])),b=run(target,graph(['O','C','O'],[],[1,999,2]));
 assert.deepEqual(a.workspaceIndices,b.workspaceIndices);assert.equal(a.currentOrder,b.currentOrder);assert.equal(a.nextOrder,b.nextOrder);
});
test('wrong bond, overbond, excess composition, insufficient endpoints, and completion hide the hint',()=>{
 const co2={atoms:['C','O','O'],bonds:[[0,1,2],[0,2,2]]};
 assert.equal(run(co2,graph(['O','O'],[[0,1,1]])),null);
 assert.equal(run({atoms:['O','O'],bonds:[[0,1,2]]},graph(['O','O'],[[0,1,3]])),null);
 assert.equal(run(co2,graph(['C','O','O','O'])),null);
 assert.equal(run(co2,graph(['C'])),null);
 assert.equal(run(co2,graph(['C','O','O'],[[0,1,2],[0,2,2]])),null);
});
test('recomputation uses only the supplied current workspace and never retains stale atom references',()=>{
 const target={atoms:['H','H'],bonds:[[0,1,1]]};
 const first=run(target,graph(['H','H'],[],[11,12]));assert.deepEqual(first.atomIds,[11,12]);
 const restored=run(target,graph(['H','H'],[],[41,42]));assert.deepEqual(restored.atomIds,[41,42]);
});
test('electron highlight derives exactly one current unpaired visual per endpoint',()=>{
 const visuals=[{atomId:11,index:2,kind:'electron'},{atomId:11,index:0,kind:'electron'},{atomId:12,index:1,kind:'extension'},{atomId:12,index:3,kind:'electron'}];
 assert.deepEqual([...craftHintElectronKeys({atomIds:[11,12]},visuals)].sort(),['11:0','12:3']);
 assert.equal(craftHintElectronKeys({atomIds:[11,99]},visuals).size,0,'missing/currently non-unpaired endpoint suppresses the whole pair');
});
test('large interchangeable loose-atom workspaces stay deterministic without enumerating isomorphisms',()=>{
 const target={atoms:Array(40).fill('H'),bonds:[]},workspace=graph(Array(20).fill('H'));
 assert.equal(run(target,workspace),null);
});
