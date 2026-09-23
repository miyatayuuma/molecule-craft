import test from 'node:test';
import assert from 'node:assert/strict';
import {matchCraftTarget as match} from '../src/craft-target-satisfaction.js';
import {decomposeTargetIntoAvailableParts as decompose} from '../src/craft-decomposition.js';

const target={atoms:['C','C','O','H','H','H','H','H','H'],bonds:[[0,1,1],[1,2,1],[0,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1],[2,8,1]]};
const oh={id:'hydroxyl',atoms:['O','H'],bonds:[[0,1,1]]},pieces=decompose(target,[oh]);
const graph=(atoms=[],bonds=[],ids=atoms.map((_,i)=>i+20))=>({atoms:atoms.map((element,i)=>({id:ids[i],element})),bonds:bonds.map(([a,b,order])=>({a:ids[a],b:ids[b],order}))});
const missingAtoms=result=>result.unsatisfiedPieces.flatMap(piece=>piece.partId?piece.atomIndices.map(()=>null):[piece.element]).filter(Boolean);
function run(workspace,t=target,p=pieces){
  const before=JSON.stringify([t,p,workspace]),result=match(t,p,workspace);
  assert.equal(JSON.stringify([t,p,workspace]),before,'matcher is pure');
  assert.equal(new Set(result.assignments.map(item=>item.workspaceAtomId)).size,result.assignments.length,'workspace atoms are reserved once');
  assert.equal(new Set(result.assignments.map(item=>item.targetIndex)).size,result.assignments.length,'target atoms are secured once');
  return result;
}

test('empty workspace leaves every decomposed material missing',()=>assert.deepEqual(run(graph()).unsatisfiedPieces,pieces));

test('material reservation ignores current bond topology',()=>{
  const loose=run(graph(['O','H'])),bonded=run(graph(['O','H'],[[0,1,1]])),wrong=run(graph(['O','H'],[[0,1,3]]));
  assert.deepEqual(loose,bonded);assert.deepEqual(loose,wrong);
  assert.ok(loose.satisfiedPieces.some(piece=>piece.partId==='hydroxyl'),'O + H secure the hydroxyl material shortcut even before bonding');
});

test('breaking and rebuilding bonds never makes secured material reappear',()=>{
  const workspace=graph(['O','H'],[[0,1,1]]),before=run(workspace);workspace.bonds=[];const broken=run(workspace);workspace.bonds.push({a:20,b:21,order:1});const rebuilt=run(workspace);
  assert.deepEqual(broken,before);assert.deepEqual(rebuilt,before);
});

test('deleting a secured atom reintroduces only the exact missing atom',()=>{
  const completeOH=run(graph(['O','H']));assert.ok(completeOH.satisfiedPieces.some(piece=>piece.partId==='hydroxyl'));
  const onlyO=run(graph(['O']));assert.equal(onlyO.satisfiedPieces.some(piece=>piece.partId==='hydroxyl'),false);assert.ok(missingAtoms(onlyO).includes('H'));
  assert.equal(onlyO.unsatisfiedPieces.some(piece=>piece.partId==='hydroxyl'),false,'partially secured shortcuts fall back to atomic shortage instead of re-requesting the whole part');
});

test('workspace extras and unrelated elements do not increase target coverage',()=>{
  const base=run(graph(['O','H'])),extra=run(graph(['O','H','O','N','F']));
  assert.equal(extra.assignments.length,base.assignments.length,'only target composition is reserved');
  assert.deepEqual(extra.unsatisfiedPieces,base.unsatisfiedPieces);
});

test('whole target pieces are preferred before atomic remainder',()=>{
  const result=run(graph(['O','H']));
  assert.ok(result.satisfiedPieces.some(piece=>piece.partId==='hydroxyl'));
  assert.equal(result.unsatisfiedPieces.filter(piece=>piece.partId==='hydroxyl').length,0);
  assert.equal(result.unsatisfiedPieces.reduce((sum,piece)=>sum+piece.atomIndices.length,0),target.atoms.length-2);
});

test('partial multi-atom piece reports exact remaining composition',()=>{
  const t={atoms:['C','C','C','H','H'],bonds:[]},p=[{partId:'fragment',atomIndices:[0,1,2,3,4]}],result=run(graph(['C','C','H']),t,p);
  assert.deepEqual(result.satisfiedPieces,[]);assert.deepEqual(missingAtoms(result).sort(),['C','H']);assert.equal(result.assignments.length,3);
});

test('target and decomposition changes derive fresh composition results',()=>{
  const workspace=graph(['O','H']),original=run(workspace);assert.deepEqual(run(JSON.parse(JSON.stringify(workspace))),original);
  const hydrogen={atoms:['H','H'],bonds:[[0,1,1]]},hydrogenPieces=decompose(hydrogen,[]),hydrogenResult=run(workspace,hydrogen,hydrogenPieces);
  assert.equal(hydrogenResult.assignments.length,1);assert.equal(hydrogenResult.unsatisfiedPieces.reduce((sum,piece)=>sum+piece.atomIndices.length,0),1);
  const atomOnly=run(workspace,target,decompose(target,[]));assert.equal(atomOnly.assignments.length,2);
});

test('complete target composition secures every material regardless of intermediate bonds',()=>{
  const shuffled=[...target.atoms].reverse(),result=run(graph(shuffled,[]));assert.equal(result.unsatisfiedPieces.length,0);assert.equal(result.assignments.length,target.atoms.length);
});

test('many interchangeable atoms remain deterministic and bounded',()=>{
  const t={atoms:Array(40).fill('H'),bonds:[]},workspace=graph(Array(20).fill('H')),p=decompose(t,[]),result=run(workspace,t,p);
  assert.equal(result.assignments.length,20);assert.equal(result.unsatisfiedPieces.length,20);assert.deepEqual(run(workspace,t,p),result);
});

test('three piece occurrences stay whole whichever structural component is spawned first',()=>{
  const t={atoms:['C','O','C','O','C','N'],bonds:[[0,1,1],[2,3,2],[4,5,1]]},templates=[
    {id:'part-a',atoms:['C','O'],bonds:[[0,1,1]]},
    {id:'part-b',atoms:['C','O'],bonds:[[0,1,2]]},
    {id:'part-c',atoms:['C','N'],bonds:[[0,1,1]]},
  ],decomposed=decompose(t,templates);
  assert.deepEqual(decomposed.map(piece=>piece.partId),['part-a','part-b','part-c']);
  const spawn=(piece,workspace)=>{
    const atoms=piece.atomIndices.map(index=>t.atoms[index]),ids=atoms.map((_,i)=>1000+workspace.atoms.length+i),bonds=[];
    for(let a=0;a<piece.atomIndices.length;a++)for(let b=a+1;b<piece.atomIndices.length;b++){const order=t.bonds.find(([x,y])=>(x===piece.atomIndices[a]&&y===piece.atomIndices[b])||(x===piece.atomIndices[b]&&y===piece.atomIndices[a]))?.[2];if(order)bonds.push([ids[a],ids[b],order]);}
    return{atoms:[...workspace.atoms,...atoms.map((element,i)=>({id:ids[i],element}))],bonds:[...workspace.bonds,...bonds.map(([a,b,order])=>({a,b,order}))]};
  };
  for(const sequence of [['part-a','part-b','part-c'],['part-b','part-a','part-c'],['part-c','part-b','part-a'],['part-c','part-a','part-b']]){
    let workspace=graph();
    for(let step=0;step<sequence.length;step++){
      const selected=decomposed.find(piece=>piece.partId===sequence[step]),firstNewId=1000+workspace.atoms.length;workspace=spawn(selected,workspace);
      const result=run(workspace,t,decomposed),satisfiedIds=result.satisfiedPieces.map(piece=>piece.partId),pending=result.unsatisfiedPieces.filter(piece=>piece.partId).map(piece=>piece.partId);
      assert.ok(satisfiedIds.includes(sequence[step]),`${sequence.slice(0,step+1)}: spawned occurrence must be structurally satisfied`);
      assert.deepEqual(pending,[...new Set(sequence.slice(step+1).length?decomposed.filter(piece=>!satisfiedIds.includes(piece.partId)).map(piece=>piece.partId):[])],`${sequence.slice(0,step+1)}: other occurrences remain whole hint parts`);
      assert.equal(result.unsatisfiedPieces.some(piece=>piece.partId===null),false,'unrelated occurrences must not collapse into atoms');
      const spawnedIds=new Set(selected.atomIndices.map((_,index)=>firstNewId+index)),connected=workspace.bonds.filter(bond=>spawnedIds.has(bond.a)&&spawnedIds.has(bond.b));
      assert.equal(connected.length,1,'spawned component bond remains present');
    }
  }
});

test('atom shortage still falls back to only the missing atom',()=>{
  const t={atoms:['C','O','H'],bonds:[[0,1,1],[1,2,1]]},piece={partId:'co',atomIndices:[0,1]},result=run(graph(['C']),t,[piece,{partId:null,element:'H',atomIndices:[2]}]);
  assert.deepEqual(result.unsatisfiedPieces,[{partId:null,element:'O',atomIndices:[1]},{partId:null,element:'H',atomIndices:[2]}]);
});

test('repeated equivalent piece occurrences are independently structural matches',()=>{
  const t={atoms:['C','C','C','C'],bonds:[[0,1,1],[2,3,1]]},part={id:'ethane-fragment',atoms:['C','C'],bonds:[[0,1,1]]},repeated=decompose(t,[part]),result=run(graph(t.atoms,[[0,1,1],[2,3,1]]),t,repeated);
  assert.equal(repeated.length,2);assert.deepEqual(result.satisfiedPieces,repeated);assert.deepEqual(result.unsatisfiedPieces,[]);assert.equal(new Set(result.assignments.map(item=>item.targetIndex)).size,4);
});

test('same object repeated twice still tracks target-piece occurrences independently',()=>{
  const t={atoms:['C','O','C','O'],bonds:[[0,1,1],[2,3,1]]},piece={partId:'co',atomIndices:[0,1]},workspace=graph(['C','O'],[[0,1,1]]),result=run(workspace,t,[piece,piece]);
  assert.deepEqual(result.satisfiedPieces,[piece]);assert.deepEqual(result.unsatisfiedPieces,[piece]);
});
