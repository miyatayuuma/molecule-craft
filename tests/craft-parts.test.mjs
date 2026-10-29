import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Molecule} from '../src/chemistry.js?v=20';
import {createCraftWorkspace} from '../src/craft-workspace.js?v=1';
import {createResources} from '../src/veil/resources.js';
const oh=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url))).find(p=>p.id==='hydroxyl');
function setup(stock,unlocked=true,template=oh){
  const molecule=new Molecule(),placements=new Map(),resources=createResources({storage:null});resources.collect(stock);
  const workspace=createCraftWorkspace({molecule,placements,resources,resolveUnlockedPart:id=>unlocked&&id===template.id?template:null});
  const snapshot=()=>JSON.stringify({stock:resources.state.elements,atoms:molecule.atoms,bonds:molecule.bonds,positions:[...placements]});
  return {molecule,placements,resources,workspace,snapshot};
}
const positions=[{x:0,y:0,z:0},{x:1,y:0,z:0}];
test('locked and insufficient parts leave inventory and workspace unchanged',()=>{
  for(const game of [setup({O:1,H:1},false),setup({O:1,H:0})]){const before=game.snapshot();assert.equal(game.workspace.addPart('hydroxyl',positions),null);assert.equal(game.snapshot(),before);}
});
test('free parts use atomic checkout and ordinary graph editing/refunds',()=>{
  const g=setup({O:1,H:2}),before={...g.resources.state.elements};const r=g.workspace.addPart('hydroxyl',positions);
  assert.ok(r);assert.equal(g.resources.state.elements.O,0);assert.equal(g.resources.state.elements.H,1);assert.equal(g.molecule.atoms.length,2);assert.deepEqual(g.molecule.bonds,[{a:r.ids[0],b:r.ids[1],order:1}]);
  g.molecule.removeBond(...r.ids);assert.equal(g.molecule.bonds.length,0);
  const loose=g.workspace.addAtom('H',positions[0]);assert.ok(loose,'Single atom free crafting remains available');g.molecule.setBond(r.ids[0],loose.id,1);
  assert.equal(g.molecule.bonds[0].b,loose.id);g.workspace.removeAtom(r.ids[1]);assert.equal(g.resources.state.elements.H,1);
  g.workspace.clear();assert.deepEqual(g.resources.state.elements,before);assert.equal(g.placements.size,0);assert.equal(g.molecule.bonds.length,0);
});
test('failed expansion and incomplete placement never check out atoms',()=>{
  for(const template of [{...oh,atoms:['O','bad']},{...oh,bonds:[[0,9,1]]},{...oh,attachments:null}]){const g=setup({O:1,H:1},true,template),before=g.snapshot();assert.equal(g.workspace.addPart('hydroxyl',positions),null);assert.equal(g.snapshot(),before);}
  const g=setup({O:1,H:1}),before=g.snapshot();assert.equal(g.workspace.addPart('hydroxyl',positions.slice(0,1)),null);assert.equal(g.snapshot(),before);
});
