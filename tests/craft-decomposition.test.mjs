import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decomposeTargetIntoAvailableParts as decompose} from '../src/craft-decomposition.js';
const templates=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url)));
const ethanol=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url))).find(r=>r.id==='ethanol');
const part=id=>templates.find(p=>p.id===id);
function check(target,parts,result){
  const ids=result.flatMap(p=>p.atomIndices);assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort((a,b)=>a-b),target.atoms.map((_,i)=>i));
  for(const item of result){
    if(!item.partId){assert.equal(item.element,target.atoms[item.atomIndices[0]]);continue;}
    const p=parts.find(p=>p.id===item.partId);assert.ok(item.atomIndices.length<target.atoms.length);
    p.atoms.forEach((el,i)=>assert.equal(el,target.atoms[item.atomIndices[i]]));
    const edges=g=>new Map(g.bonds.map(([a,b,o])=>[[a,b].sort((x,y)=>x-y).join(':'),o]));const pe=edges(p),te=edges(target);
    for(let i=0;i<p.atoms.length;i++)for(let j=i+1;j<p.atoms.length;j++)assert.equal(pe.get(`${i}:${j}`),te.get([item.atomIndices[i],item.atomIndices[j]].sort((a,b)=>a-b).join(':')));
  }
}
test('no unlocks falls back to all single atoms',()=>{const r=decompose(ethanol,[]);assert.equal(r.length,9);check(ethanol,[],r);});
test('one unlocked hydroxyl covers its atoms once',()=>{const p=[part('hydroxyl')],r=decompose(ethanol,p);assert.equal(r.length,8);assert.equal(r.filter(i=>i.partId).length,1);check(ethanol,p,r);});
test('minimum count, overlapping sizes, larger-part tie break and determinism',()=>{
  const p=['methyl','hydroxyl','ether','carbon-chain'].map(part),r=decompose(ethanol,p);
  assert.equal(r.length,2);assert.deepEqual(r.map(i=>i.partId),['carbon-chain','hydroxyl']);check(ethanol,p,r);
  assert.deepEqual(decompose(ethanol,[...p].reverse()),r);assert.deepEqual(decompose(ethanol,p),r);
});
test('exact cover beats greedily taking the largest occurrence',()=>{
  const target={atoms:Array(6).fill('C'),bonds:[[0,1,1],[1,2,1],[2,3,1],[1,4,1],[2,5,1]]};
  const p=[{id:'large',atoms:Array(4).fill('C'),bonds:[[0,1,1],[1,2,1],[2,3,1]]},{id:'small',atoms:Array(3).fill('C'),bonds:[[0,1,1],[1,2,1]]}];
  const r=decompose(target,p);assert.equal(r.length,2);assert.deepEqual(r.map(i=>i.partId),['small','small']);check(target,p,r);
});
test('whole molecule templates are excluded, even with reordered atoms',()=>{
  const whole={...ethanol,id:'whole'},permutation=ethanol.atoms.map((_,i)=>ethanol.atoms.length-1-i);
  const reordered={id:'reordered',atoms:permutation.map(i=>ethanol.atoms[i]),bonds:ethanol.bonds.map(([a,b,o])=>[permutation.indexOf(a),permutation.indexOf(b),o])};
  const p=[whole,reordered,part('hydroxyl')],r=decompose(ethanol,p);assert.equal(r.length,8);check(ethanol,p,r);
});
test('internal extra bonds and wrong orders cannot match; rings can match',()=>{
  const target={atoms:['C','C','C','H'],bonds:[[0,1,1],[1,2,1],[2,0,1],[0,3,1]]};
  const chain={id:'chain',atoms:['C','C','C'],bonds:[[0,1,1],[1,2,1]]},ring={...chain,id:'ring',bonds:[[0,1,1],[1,2,1],[2,0,1]]};
  assert.equal(decompose(target,[chain]).length,4);check(target,[ring],decompose(target,[ring]));assert.equal(decompose(target,[ring]).length,2);
  assert.equal(decompose(ethanol,[part('carbonyl')]).length,9);
});
