import assert from 'node:assert/strict';
import {Molecule} from '../src/chemistry.js?v=20';
import {createCraftWorkspace} from '../src/craft-workspace.js?v=1';

const stock={H:2,C:1,N:0,O:0,F:0,P:0,S:0,Cl:0};
const resources={
  spend(cost){if(Object.entries(cost).some(([symbol,count])=>stock[symbol]<count))return false;for(const [symbol,count] of Object.entries(cost))stock[symbol]-=count;return true;},
  refund(cost){for(const [symbol,count] of Object.entries(cost))stock[symbol]+=count;},
};
const point=value=>({value,clone(){return point(this.value);}}),molecule=new Molecule(),placements=new Map(),workspace=createCraftWorkspace({molecule,placements,resources});

assert.equal(workspace.addAtom('O',point(0)),null,'An unavailable BASE STOCK atom cannot enter the workspace');
const loose=workspace.addAtom('H',point(1));assert.ok(loose);assert.equal(stock.H,1);assert.equal(placements.get(loose.id).position.value,1);
assert.equal(workspace.removeAtom(loose.id),true);assert.equal(stock.H,2);assert.equal(molecule.atoms.length,0);

const template={atoms:['C','H'],bonds:[[0,1,1]],attachments:[{atom:0,order:1,slots:3}]};
const structure=workspace.addStructure(template,[point(2),point(3)]);assert.ok(structure);assert.deepEqual({...stock},{H:1,C:0,N:0,O:0,F:0,P:0,S:0,Cl:0});
assert.equal(workspace.addStructure(template,[point(4),point(5)]),null,'A rejected structure does not partially spend BASE STOCK');

const saved=workspace.removeAtoms(new Set(structure.ids));assert.equal(molecule.atoms.length,0);assert.deepEqual({H:stock.H,C:stock.C},{H:2,C:1});
assert.equal(workspace.restore([saved]),true);assert.equal(molecule.atoms.length,2);assert.deepEqual({H:stock.H,C:stock.C},{H:1,C:0});
workspace.clear();assert.equal(molecule.atoms.length,0);assert.equal(placements.size,0);assert.deepEqual({H:stock.H,C:stock.C},{H:2,C:1});

console.log('Craft workspace passed: checkout, rejection, individual return, cleanup restore and put-away preserve BASE STOCK.');
