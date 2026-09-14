import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftTargetMatchTracker,evaluateCraftTargetMatch} from '../src/craft-target-match.js';

const graph=(atoms,bonds=[],ids=atoms.map((_,index)=>100+index))=>({
  atoms:atoms.map((element,index)=>({id:ids[index],element})),
  bonds:bonds.map(([a,b,order])=>({a:ids[a],b:ids[b],order})),
});
const target=(atoms,bonds,id='target')=>({id,atoms,bonds});

test('bond-order units score single, double and triple bonds one step at a time',()=>{
  const co=target(['C','O'],[[0,1,2]],'co');
  assert.equal(evaluateCraftTargetMatch(co,graph(['C','O'])).score,0);
  assert.equal(evaluateCraftTargetMatch(co,graph(['C','O'],[[0,1,1]])).score,1);
  assert.equal(evaluateCraftTargetMatch(co,graph(['C','O'],[[0,1,2]])).score,2);
  const n2=target(['N','N'],[[0,1,3]],'n2');
  assert.deepEqual([1,2,3].map(order=>evaluateCraftTargetMatch(n2,graph(['N','N'],[[0,1,order]])).score),[1,2,3]);
});

test('hydrogen bonds have the same weight and element types cannot cross-match',()=>{
  assert.equal(evaluateCraftTargetMatch(target(['C','H'],[[0,1,1]]),graph(['C','H'],[[0,1,1]])).percent,100);
  assert.equal(evaluateCraftTargetMatch(target(['C','H'],[[0,1,1]]),graph(['C','O'],[[0,1,1]])).percent,0);
});

test('partial order is allowed but an order above the target is a dead end',()=>{
  assert.equal(evaluateCraftTargetMatch(target(['C','O'],[[0,1,2]]),graph(['C','O'],[[0,1,1]])).percent,50);
  assert.equal(evaluateCraftTargetMatch(target(['C','O'],[[0,1,1]]),graph(['C','O'],[[0,1,2]])).percent,0);
});

test('disconnected fragments are not summed and only the best valid component scores',()=>{
  const chain=target(['C','C','C','C','C','C'],[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1]],'chain');
  const split=graph(['C','C','C','C','C'],[[0,1,1],[1,2,1],[3,4,1]]);
  const result=evaluateCraftTargetMatch(chain,split);assert.equal(result.score,2);assert.equal(result.percent,40);
});

test('a smaller fragment does not replace the tracked best until it actually surpasses it',()=>{
  const chain=target(['C','C','C','C','C','C'],[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1]],'chain');
  const tracker=createCraftTargetMatchTracker();
  const first=graph(['C','C','C','C','C'],[[0,1,1],[1,2,1],[3,4,1]],[10,11,12,20,21]);assert.equal(tracker.update(chain,first).score,2);
  const grown=graph(['C','C','C','C','C','C'],[[0,1,1],[1,2,1],[3,4,1],[4,5,1]],[10,11,12,20,21,22]);assert.equal(tracker.update(chain,grown).score,2);
});

test('connecting valid fragments into one target-compatible component causes a score jump',()=>{
  const chain=target(['C','C','C','C','C','C'],[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1]],'chain');
  const tracker=createCraftTargetMatchTracker(),ids=[10,11,12,20,21,22];
  assert.equal(tracker.update(chain,graph(Array(6).fill('C'),[[0,1,1],[1,2,1],[3,4,1],[4,5,1]],ids)).score,2);
  assert.equal(tracker.update(chain,graph(Array(6).fill('C'),[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1]],ids)).score,5);
});

test('breaking the tracked best mapping drops to zero without fallback and undo restores it',()=>{
  const chain=target(['C','C','C','C','C','C'],[[0,1,1],[1,2,1],[2,3,1],[3,4,1],[4,5,1]],'chain');
  const tracker=createCraftTargetMatchTracker(),ids=[10,11,12,20,21];
  const base=graph(Array(5).fill('C'),[[0,1,1],[1,2,1],[3,4,1]],ids);assert.equal(tracker.update(chain,base).score,2);
  const wrong=graph(Array(5).fill('C'),[[0,1,1],[1,2,1],[0,2,1],[3,4,1]],ids),dead=tracker.update(chain,wrong);assert.equal(dead.state,'dead-end');assert.equal(dead.percent,0);
  assert.equal(tracker.update(chain,base).score,2);
});

test('atom IDs are labels only and symmetric mappings remain valid',()=>{
  const co2=target(['C','O','O'],[[0,1,2],[0,2,2]],'co2');
  const left=evaluateCraftTargetMatch(co2,graph(['O','C','O'],[[0,1,2],[1,2,1]],[900,7,300]));
  const right=evaluateCraftTargetMatch(co2,graph(['O','C','O'],[[0,1,2],[1,2,1]],[1,999,2]));
  assert.equal(left.score,3);assert.equal(right.score,3);
});

test('benzene accepts either equivalent alternating Kekule pattern and still counts C-H bonds',()=>{
  const atoms=[...Array(6).fill('C'),...Array(6).fill('H')],ringA=[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1]],ringB=ringA.map(([a,b,order])=>[a,b,3-order]),ch=Array.from({length:6},(_,index)=>[index,6+index,1]),benzene=target(atoms,[...ringA,...ch],'benzene');
  assert.equal(evaluateCraftTargetMatch(benzene,graph(atoms,[...ringA,...ch])).percent,100);
  assert.equal(evaluateCraftTargetMatch(benzene,graph(atoms,[...ringB,...ch])).percent,100);
  const singleRing=ringA.map(([a,b])=>[a,b,1]);const ringOnly=evaluateCraftTargetMatch(benzene,graph(Array(6).fill('C'),singleRing));assert.equal(ringOnly.score,6);assert.equal(ringOnly.percent,40);
  const ringWithHydrogen=evaluateCraftTargetMatch(benzene,graph(atoms,[...singleRing,...ch]));assert.equal(ringWithHydrogen.score,12);assert.equal(ringWithHydrogen.percent,80);
  const oneDouble=evaluateCraftTargetMatch(benzene,graph(atoms,[...singleRing.filter(([a,b])=>!(a===0&&b===1)),[0,1,2],...ch]));assert.equal(oneDouble.score,13);
});

test('target set, change and clear reset tracker state cleanly',()=>{
  const tracker=createCraftTargetMatchTracker(),double=target(['C','O'],[[0,1,2]],'double'),single=target(['C','O'],[[0,1,1]],'single'),workspace=graph(['C','O'],[[0,1,1]]);
  assert.equal(tracker.update(double,workspace).percent,50);assert.equal(tracker.update(single,workspace).percent,100);assert.equal(tracker.update(null,workspace),null);assert.equal(tracker.update(double,workspace).percent,50);
});

test('coordinate-only changes reuse the cached graph result and evaluation is side-effect free',()=>{
  const tracker=createCraftTargetMatchTracker(),co=target(['C','O'],[[0,1,2]],'co'),workspace=graph(['C','O'],[[0,1,1]]),before=JSON.stringify(workspace),first=tracker.update(co,workspace);workspace.atoms[0].position={x:3,y:7,z:-2};const second=tracker.update(co,workspace);
  assert.equal(second,first);delete workspace.atoms[0].position;assert.equal(JSON.stringify(workspace),before);
});
