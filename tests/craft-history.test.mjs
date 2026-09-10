import test from 'node:test';
import assert from 'node:assert/strict';
import {createCraftHistory} from '../src/craft-history.js';

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

test('full cleanup is one reversible operation that restores workspace and BASE STOCK exactly',()=>{
  const fx=fixture();
  fx.state={workspace:{atoms:[{element:'H'},{element:'C'}],bonds:[[0,1,1]]},elements:{H:3,C:1,O:1}};
  const before=copy(fx.state);
  fx.history.record(()=>{fx.state.workspace={atoms:[],bonds:[]};fx.state.elements.H++;fx.state.elements.C++;return true;});
  assert.deepEqual(fx.state.workspace,{atoms:[],bonds:[]});
  fx.history.undo();assert.deepEqual(fx.state,before);
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
