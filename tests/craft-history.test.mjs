import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory,isDestructiveCraftChange} from '../src/craft-history.js';

const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){
  let state={workspace:{atoms:[],bonds:[]},elements:{H:4,C:2,O:1}},changes=[];
  const history=createCraftHistory({capture:()=>copy(state),restore:snapshot=>{state=copy(snapshot);return true;},onChange:value=>changes.push(value)});
  return{history,get state(){return state;},set state(value){state=value;},changes};
}

test('records semantic operations and undoes them one step at a time to the session baseline',()=>{
  const fx=fixture();
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  assert.equal(fx.history.depth,2);assert.equal(fx.state.workspace.atoms.length,2);assert.equal(fx.state.elements.H,2);
  assert.equal(fx.history.undo(),true);assert.equal(fx.state.workspace.atoms.length,1);assert.equal(fx.state.elements.H,3);
  assert.equal(fx.history.undo(),true);assert.deepEqual(fx.state.workspace,{atoms:[],bonds:[]});assert.equal(fx.state.elements.H,4);
  assert.equal(fx.history.undo(),false);assert.equal(fx.history.canUndo,false);
});

test('bond creation and bond-order changes restore the previous graph without duplicating stock',()=>{
  const fx=fixture();
  fx.history.record(()=>{fx.state.elements.H-=2;fx.state.workspace.atoms.push({element:'H'},{element:'H'});return true;});
  const stockAfterAtoms=copy(fx.state.elements);
  fx.history.record(()=>{fx.state.workspace.bonds.push([0,1,1]);return true;});
  fx.history.record(()=>{fx.state.workspace.bonds[0][2]=2;return true;});
  fx.history.undo();assert.deepEqual(fx.state.workspace.bonds,[[0,1,1]]);assert.deepEqual(fx.state.elements,stockAfterAtoms);
  fx.history.undo();assert.deepEqual(fx.state.workspace.bonds,[]);assert.deepEqual(fx.state.elements,stockAfterAtoms);
});

test('atom deletion and full cleanup are destructive boundaries that cut earlier Undo history',()=>{
  const fx=fixture();
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  fx.history.record(()=>{fx.state.elements.C--;fx.state.workspace.atoms.push({element:'C'});return true;});
  assert.equal(fx.history.depth,2);
  fx.history.record(()=>{fx.state.workspace.atoms.pop();fx.state.elements.C++;return true;});
  assert.equal(fx.history.depth,0);assert.equal(fx.history.undo(),false,'deletion cannot cross the destructive boundary');

  fx.history.record(()=>{fx.state.elements.O--;fx.state.workspace.atoms.push({element:'O'});return true;});
  assert.equal(fx.history.depth,1);
  fx.history.record(()=>{for(const atom of fx.state.workspace.atoms)fx.state.elements[atom.element]++;fx.state.workspace={atoms:[],bonds:[]};return true;});
  assert.equal(fx.history.depth,0);assert.equal(fx.history.undo(),false,'full cleanup is irreversible');
});

test('ordinary edits after a destructive boundary remain Undoable only back to the post-destruction baseline',()=>{
  const fx=fixture();
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  fx.history.record(()=>{fx.state.elements.C--;fx.state.workspace.atoms.push({element:'C'});return true;});
  fx.history.record(()=>{fx.state.workspace.atoms.pop();fx.state.elements.C++;return true;});
  const baseline=copy(fx.state);
  fx.history.record(()=>{fx.state.elements.O--;fx.state.workspace.atoms.push({element:'O'});return true;});
  fx.history.record(()=>{fx.state.workspace.bonds.push([0,1,1]);return true;});
  assert.equal(fx.history.undo(),true);assert.deepEqual(fx.state.workspace.bonds,[]);
  assert.equal(fx.history.undo(),true);assert.deepEqual(fx.state,baseline);
  assert.equal(fx.history.undo(),false);
});

test('destructive classification is centralized on workspace atom removal, not a specific button',()=>{
  const before={workspace:{atoms:[{element:'H'},{element:'C'}]},elements:{H:1,C:1}};
  assert.equal(isDestructiveCraftChange(before,{...before,workspace:{atoms:[{element:'H'}]}}),true);
  assert.equal(isDestructiveCraftChange(before,{...before,workspace:{atoms:[...before.workspace.atoms,{element:'O'}]}}),false);
  assert.equal(isDestructiveCraftChange(before,{...before,workspace:{atoms:before.workspace.atoms},elements:{H:0,C:1}}),false);
});

test('Undo restores workspace/stock snapshots without rolling back external completion progression',()=>{
  let state={workspace:{atoms:[],bonds:[]},elements:{H:2}},progress={completed:new Set(),crafted:new Set(),discovery:new Set()};
  const history=createCraftHistory({
    capture:()=>copy({workspace:state.workspace,elements:state.elements}),
    restore:snapshot=>{state={workspace:copy(snapshot.workspace),elements:copy(snapshot.elements)};return true;},
  });
  history.record(()=>{state.elements.H--;state.workspace.atoms.push({element:'H'});return true;});
  progress.completed.add('hydrogen');progress.crafted.add('hydrogen');progress.discovery.add('hydrogen');
  history.record(()=>{state.workspace.bonds.push([0,0,1]);return true;});
  history.undo();
  assert.deepEqual([...progress.completed],['hydrogen']);assert.deepEqual([...progress.crafted],['hydrogen']);assert.deepEqual([...progress.discovery],['hydrogen']);
});

test('failed/no-op mutations do not create history and a new mutation after undo does not reuse future state',()=>{
  const fx=fixture();
  assert.equal(fx.history.record(()=>false),false);assert.equal(fx.history.depth,0);
  fx.history.begin();fx.history.commit();assert.equal(fx.history.depth,0);
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  fx.history.record(()=>{fx.state.elements.C--;fx.state.workspace.atoms.push({element:'C'});return true;});
  fx.history.undo();assert.deepEqual(fx.state.workspace.atoms,[{element:'H'}]);
  fx.history.record(()=>{fx.state.elements.O--;fx.state.workspace.atoms.push({element:'O'});return true;});
  assert.equal(fx.history.depth,2);fx.history.undo();assert.deepEqual(fx.state.workspace.atoms,[{element:'H'}]);
});

test('reset defines a new session baseline and pending gestures collapse to one history entry',()=>{
  const fx=fixture();
  fx.history.record(()=>{fx.state.elements.H--;fx.state.workspace.atoms.push({element:'H'});return true;});
  fx.history.reset();assert.equal(fx.history.canUndo,false);
  fx.history.begin();for(let i=0;i<25;i++)fx.state.workspace.atoms[0].x=i;fx.history.commit();
  assert.equal(fx.history.depth,1);fx.history.undo();assert.equal('x' in fx.state.workspace.atoms[0],false);
});
