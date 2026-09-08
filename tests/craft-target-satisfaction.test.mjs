import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCraftTarget as match} from '../src/craft-target-satisfaction.js';
import {decomposeTargetIntoAvailableParts as decompose} from '../src/craft-decomposition.js';
const target={atoms:['C','C','O','H','H','H','H','H','H'],bonds:[[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]]};
const oh={id:'hydroxyl',atoms:['O','H'],bonds:[[0,1,1]]},pieces=decompose(target,[oh]);
const graph=(atoms=[],bonds=[])=>({atoms:atoms.map((element,i)=>({id:i+20,element})),bonds:bonds.map(([a,b,order])=>({a:a+20,b:b+20,order}))});
const hydroxyl=()=>graph(['O','H'],[[0,1,1]]);
function run(workspace,t=target,p=pieces){
  const before=JSON.stringify([t,p,workspace]),r=match(t,p,workspace);
  assert.equal(JSON.stringify([t,p,workspace]),before,'Pure inputs');
  assert.equal(new Set(r.assignments.map(a=>a.workspaceAtomId)).size,r.assignments.length,'No shared workspace atom');
  assert.equal(new Set(r.assignments.map(a=>a.targetIndex)).size,r.assignments.length,'No shared target atom');
  assert.equal(r.satisfiedPieces.length+r.unsatisfiedPieces.length,p.length);return r;
}
const hasOH=r=>r.satisfiedPieces.some(p=>p.partId==='hydroxyl');
test('empty workspace leaves every piece missing',()=>assert.deepEqual(run(graph()).unsatisfiedPieces,pieces));
test('target placement, tray placement and manually bonded atoms give identical results',()=>{
  const top=hydroxyl(),tray=hydroxyl(),manual=graph(['O','H']);manual.bonds.push({a:20,b:21,order:1});
  assert.ok(hasOH(run(top)));assert.deepEqual(run(top),run(tray));assert.deepEqual(run(top),run(manual));
});
test('bond removal, rebonding and atom deletion update satisfaction',()=>{
  const w=hydroxyl();w.bonds=[];assert.equal(hasOH(run(w)),false);w.bonds.push({a:20,b:21,order:1});assert.ok(hasOH(run(w)));w.atoms.pop();w.bonds=[];assert.equal(hasOH(run(w)),false);
});
test('valid inter-piece connections preserve OH; unrelated components do not invalidate it',()=>{
  assert.ok(hasOH(run(graph(['O','H','C'],[[0,1,1],[0,2,1]]))));
  const base=run(hydroxyl()),extra=run(graph(['O','H','H','H','N'],[[0,1,1],[2,3,1]]));assert.deepEqual(extra,base);
});
test('wrong order, wrong neighbor, excess bonds and inconsistent single-atom assignments are rejected',()=>{
  for(const w of [graph(['O','H'],[[0,1,2]]),graph(['O','H','N'],[[0,1,1],[0,2,1]]),graph(['O','H','C','C'],[[0,1,1],[0,2,1],[0,3,1]])])assert.equal(hasOH(run(w)),false);
  const water={atoms:['O','H','H'],bonds:[[0,1,1],[0,2,1]]};
  assert.equal(run(graph(['H','H'],[[0,1,1]]),water,decompose(water,[])).satisfiedPieces.length,0,'H₂ cannot stand in for two water H atoms');
});
test('duplicate OH pieces cannot reuse one occurrence',()=>{
  const t={atoms:['O','H','O','H'],bonds:[[0,1,1],[2,3,1],[0,2,1]]},p=decompose(t,[oh]);
  assert.equal(run(hydroxyl(),t,p).satisfiedPieces.length,1);
  assert.equal(run(graph(['O','H','O','H'],[[0,1,1],[2,3,1]]),t,p).satisfiedPieces.length,2);
});
test('global coverage handles overlapping placements instead of consuming the first candidate',()=>{
  // The C-N component can occupy either C. Putting it on the C-H piece blocks
  // the only C-H component; the optimal assignment preserves both pieces.
  const t={atoms:['C','N','C','H','N'],bonds:[[0,1,1],[0,2,1],[2,3,1],[2,4,1]]};
  const p=[{partId:'ch',atomIndices:[2,3]},{partId:'cn',atomIndices:[0,1]},{partId:null,element:'N',atomIndices:[4]}];
  const w=graph(['C','N','C','H'],[[0,1,1],[2,3,1]]),r=run(w,t,p);assert.equal(r.satisfiedPieces.length,2);assert.deepEqual(r.unsatisfiedPieces,[p[2]]);
  assert.deepEqual(run({...w,atoms:[...w.atoms].reverse(),bonds:[...w.bonds].reverse()},t,p),r);
});
test('target changes and unlock changes derive fresh results; serialized workspace is equivalent',()=>{
  const w=hydroxyl(),original=run(w);assert.deepEqual(run(JSON.parse(JSON.stringify(w))),original);
  const hydrogen={atoms:['H','H'],bonds:[[0,1,1]]};assert.equal(run(w,hydrogen,decompose(hydrogen,[])).satisfiedPieces.length,0);
  const locked=run(w,target,decompose(target,[]));assert.equal(locked.satisfiedPieces.length,2);assert.ok(hasOH(run(w)));
});
test('completed target covers all pieces without a separate completion system',()=>assert.equal(run(graph(target.atoms,target.bonds)).unsatisfiedPieces.length,0));
test('many interchangeable loose atoms have deterministic bounded search',()=>{
  const t={atoms:Array(40).fill('H'),bonds:[]},w=graph(Array(20).fill('H')),p=decompose(t,[]);
  const r=run(w,t,p);assert.equal(r.satisfiedPieces.length,20);assert.deepEqual(run(w,t,p),r);
});
