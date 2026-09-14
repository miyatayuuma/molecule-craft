import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Molecule} from '../src/chemistry.js?v=20';
import {createCraftWorkspace} from '../src/craft-workspace.js?v=1';
import {findTearCandidate} from '../src/craft-tearoff.js';
import {captureDetachedFragment,createDetachedDrag,detachedAtomPositions} from '../src/craft-detached-drag.js';
import {matchCraftTarget} from '../src/craft-target-satisfaction.js';

function graph(elements,bonds){
  const molecule=new Molecule(),ids=elements.map(element=>molecule.addAtom(element).id);for(const[a,b,order=1]of bonds)molecule.setBond(ids[a],ids[b],order);return{molecule,ids};
}
function positions(ids,points){const map=new Map(ids.map((id,index)=>[id,{...points[index]}]));return{id:id=>map.get(id),map};}

test('single atom stays at the break pose, follows the pointer with its grab offset, then clears',()=>{
  const{molecule,ids}=graph(['C','H'],[[0,1]]),p=positions(ids,[{x:0,y:0,z:0},{x:1,y:.2,z:0}]),candidate=findTearCandidate(molecule,ids[1],{positionFor:p.id,pullVector:{x:1,y:0,z:0}});
  const snapshot=captureDetachedFragment(molecule,candidate,{positionFor:p.id,pointerWorld:{x:1.2,y:.3,z:0}}),drag=createDetachedDrag(snapshot);
  assert.equal(snapshot.atoms.length,1);assert.deepEqual(drag.anchor,{x:1,y:.2,z:0});
  assert.deepEqual(drag.update({x:1.2,y:.3,z:0}),{x:1,y:.2,z:0},'break frame does not warp the grabbed atom to pointer center');
  assert.deepEqual(drag.update({x:2.2,y:1.3,z:0}),{x:2,y:1.2,z:0},'detached atom follows later pointer movement with the same grab offset');
  drag.clear();assert.equal(drag.active,false);assert.equal(drag.update({x:3,y:3,z:0}),null,'release cleanup makes the transient drag inert');
});

test('multi-atom fragment preserves full relative geometry and internal bonds while detached',()=>{
  const{molecule,ids}=graph(['C','C','O','H'],[[0,1],[1,2],[2,3]]),p=positions(ids,[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:2,y:.1,z:0},{x:2.65,y:.55,z:.2}]),candidate=findTearCandidate(molecule,ids[2],{positionFor:p.id,pullVector:{x:1,y:0,z:0}});
  const snapshot=captureDetachedFragment(molecule,candidate,{positionFor:p.id,pointerWorld:{x:2.15,y:.2,z:0}}),before=detachedAtomPositions(snapshot),drag=createDetachedDrag(snapshot),after=detachedAtomPositions(snapshot,drag.update({x:3.15,y:1.2,z:.5}));
  assert.deepEqual(new Set(snapshot.atoms.map(atom=>atom.id)),new Set([ids[2],ids[3]]));assert.deepEqual(snapshot.bonds,[{a:ids[2],b:ids[3],order:1}]);
  const rel=list=>{const a=list.find(item=>item.id===ids[2]).position,b=list.find(item=>item.id===ids[3]).position;return{x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};};
  assert.deepEqual(rel(after),rel(before),'OH relative geometry is rigidly preserved during detached drag');
});

test('model removal happens at tear time, so detached atoms cannot affect target matching or bond candidates',()=>{
  const{molecule,ids}=graph(['C','O','H'],[[0,1],[1,2]]),p=positions(ids,[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:1.7,y:.4,z:0}]),candidate=findTearCandidate(molecule,ids[1],{positionFor:p.id,pullVector:{x:1,y:0,z:0}}),snapshot=captureDetachedFragment(molecule,candidate,{positionFor:p.id,pointerWorld:p.id(ids[1])});
  const placements=new Map(ids.map(id=>[id,{position:{clone(){return this;}}}])),resources={spend(){return true;},refund(){}};createCraftWorkspace({molecule,placements,resources}).removeAtoms(candidate.grabFragment);
  assert.deepEqual(molecule.atoms.map(atom=>atom.id),[ids[0]]);assert.equal(findTearCandidate(molecule,ids[1]),null,'removed atom is no longer a CRAFT bond/tear candidate');
  const result=matchCraftTarget({atoms:['C'],bonds:[]},[],molecule);assert.equal(result.unsatisfiedPieces.length,0,'detached presentation is not passed to structural target matching');
  assert.deepEqual(new Set(snapshot.atoms.map(atom=>atom.id)),new Set([ids[1],ids[2]]),'presentation snapshot can outlive model removal without rejoining it');
});

test('application keeps detached presentation until release and clears it on all interruption paths',()=>{
  const app=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8'),controls=fs.readFileSync(new URL('../src/craft-controls.js',import.meta.url),'utf8');
  assert.match(app,/captureDetachedFragment\(molecule,candidate/);assert.match(app,/state\.mode='tear-detached'/);assert.match(app,/updateDetachedTearVisual\(state\)/);
  assert.match(app,/if\(state\.mode==='tear-detached'\)\{\s*cleanupDetachedTear\(state\);\s*craftHistory\.cancel\(\);/s,'normal pointer release removes only the detached presentation');
  assert.match(app,/function abortPointerInteraction[\s\S]*cleanupDetachedTear\(dragState\)[\s\S]*dragState=null/,'pointer cancel / blur cleanup cannot leave a ghost');
  assert.match(app,/function recoverCraftAnimationState[\s\S]*cleanupDetachedTear\(dragState\)[\s\S]*dragState=null/,'animation recovery clears detached presentation');
  assert.match(controls,/lostpointercapture', 'lost pointer capture is routed through the cancellation path');
  assert.doesNotMatch(app,/detached[^\n]*userData\.(?:atomId|electronAtomId|bondKey)/i,'detached visuals expose no gameplay pick metadata');
});

console.log('Craft detached drag passed: single/multi fragment follow, gameplay exclusion, release and cancellation cleanup.');
