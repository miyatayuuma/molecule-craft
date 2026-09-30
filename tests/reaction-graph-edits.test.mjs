import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGuardedGraphEdits,graphConnectedComponents,validateGraphAtomConservation} from '../src/reaction-graph-edits.js';

test('shared guarded graph edits preserve atom identity and report exact bond and charge deltas',()=>{
  const source={bindings:{a:{left:0,right:1},b:{oxygen:0}},atoms:[
    {id:'a:0',element:'C',formalCharge:0},{id:'a:1',element:'C',formalCharge:0},{id:'b:0',element:'O',formalCharge:0},
  ],bonds:[{a:'a:0',b:'a:1',order:2},{a:'a:1',b:'b:0',order:1}]};
  const result=applyGuardedGraphEdits(source,[
    {op:'changeBondOrder',a:'a.left',b:'a.right',from:2,to:1},
    {op:'breakBond',a:'a.right',b:'b.oxygen',from:1},
    {op:'formBond',a:'a.left',b:'b.oxygen',from:'absent',order:1},
    {op:'changeFormalCharge',a:'a.left',from:0,to:1},
    {op:'changeFormalCharge',a:'b.oxygen',from:0,to:-1},
  ]);
  assert.deepEqual(result.bondOrderChanges,[{a:'a:0',b:'a:1',from:2,to:1}]);
  assert.deepEqual(result.brokenBonds,[{a:'a:1',b:'b:0',from:1}]);
  assert.deepEqual(result.formedBonds,[{a:'a:0',b:'b:0',order:1}]);
  assert.deepEqual(result.formalChargeChanges,[{atom:'a:0',from:0,to:1},{atom:'b:0',from:0,to:-1}]);
  assert.equal(validateGraphAtomConservation(source,result.transformedGraph),true);
  assert.equal(graphConnectedComponents(result.transformedGraph.atoms,result.transformedGraph.bonds).length,1);
  assert.equal(source.atoms[0].formalCharge,0,'source graph remains immutable');
});

test('guard failures and atom, element, and charge loss are rejected',()=>{
  const source={bindings:{r:{a:0,b:1}},atoms:[{id:'r:0',element:'C',formalCharge:0},{id:'r:1',element:'O',formalCharge:0}],bonds:[{a:'r:0',b:'r:1',order:1}]};
  assert.throws(()=>applyGuardedGraphEdits(source,[{op:'breakBond',a:'r.a',b:'r.b',from:2}]),/source-state-guard-failed/);
  assert.throws(()=>validateGraphAtomConservation(source,{atoms:[source.atoms[0]],bonds:[]}),/atom-conservation-failed/);
  assert.throws(()=>validateGraphAtomConservation(source,{atoms:[{...source.atoms[0],element:'N'},source.atoms[1]],bonds:[]}),/element-conservation-failed/);
  assert.throws(()=>validateGraphAtomConservation(source,{atoms:[source.atoms[0],{...source.atoms[1],formalCharge:1}],bonds:[]}),/formal-charge-conservation-failed/);
});
