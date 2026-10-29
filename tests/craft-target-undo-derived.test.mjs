import test from 'node:test';
import assert from 'node:assert/strict';
import {Molecule} from '../src/chemistry.js?v=20';
import {craftTargetSlots} from '../src/craft-panel.js';
import {createCraftHistory} from '../src/craft-history.js';

const target={atoms:['H','H','O']};
const clone=value=>JSON.parse(JSON.stringify(value));

test('Undo restores the graph source of truth so target atom completion recalculates from actual atoms',()=>{
  const molecule=new Molecule();let stock={H:2,O:1};
  const capture=()=>({atoms:molecule.atoms.map(a=>a.element),bonds:molecule.bonds.map(b=>[b.a,b.b,b.order]),stock:{...stock}});
  const restore=snapshot=>{molecule.clear();const ids=snapshot.atoms.map(element=>molecule.addAtom(element).id);for(const [a,b,order] of snapshot.bonds)molecule.setBond(ids[a],ids[b],order);stock=clone(snapshot.stock);return true;};
  const history=createCraftHistory({capture,restore});
  history.record(()=>{stock.H--;molecule.addAtom('H');return true;});
  history.record(()=>{stock.H--;molecule.addAtom('H');return true;});
  history.record(()=>{stock.O--;molecule.addAtom('O');return true;});
  assert.deepEqual(craftTargetSlots(target,molecule.atoms).map(x=>x.filled),[true,true,true]);
  history.undo();assert.deepEqual(craftTargetSlots(target,molecule.atoms).map(x=>x.filled),[true,true,false]);assert.deepEqual(stock,{H:0,O:1});
  history.undo();assert.deepEqual(craftTargetSlots(target,molecule.atoms).map(x=>x.filled),[true,false,false]);assert.deepEqual(stock,{H:1,O:1});
});

test('Undo removes a just-completed bond and molecule recognition follows the restored graph',()=>{
  const molecule=new Molecule();const a=molecule.addAtom('H').id,b=molecule.addAtom('H').id;
  const capture=()=>({order:molecule.bonds[0]?.order??0});
  const restore=snapshot=>{molecule.removeBond(a,b);if(snapshot.order)molecule.setBond(a,b,snapshot.order);return true;};
  const history=createCraftHistory({capture,restore});
  history.record(()=>{molecule.setBond(a,b,1);return true;});
  assert.equal(molecule.formula(),'H2');assert.equal(molecule.bonds.length,1);
  history.undo();assert.equal(molecule.bonds.length,0);assert.equal(molecule.validation().level,'warn');
});
