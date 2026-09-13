import assert from 'node:assert/strict';
import {Molecule} from '../src/chemistry.js?v=20';
import {createCraftWorkspace} from '../src/craft-workspace.js?v=1';
import {TEAR_POLICY,createTearGesture,findTearCandidate,projectedTearPull,tearCandidates} from '../src/craft-tearoff.js';

function graph(elements,bonds){
  const molecule=new Molecule(),ids=elements.map(element=>molecule.addAtom(element).id);for(const[a,b,order=1]of bonds)molecule.setBond(ids[a],ids[b],order);return{molecule,ids};
}
const positionsFor=(ids,points)=>{const map=new Map(ids.map((id,index)=>[id,points[index]]));return id=>map.get(id);};

{
  // Ethanol O grab: C-O detaches OH; grabbing the hydroxyl H detaches only H.
  const{molecule,ids}=graph(['C','C','O','H','H','H','H','H','H'],[[0,1],[1,2],[2,3],[0,4],[0,5],[0,6],[1,7],[1,8]]),positionFor=positionsFor(ids,[[0,0,0],[1,0,0],[2,0,0],[3,0,0],[0,1,0],[0,-1,0],[-1,0,0],[1,1,0],[1,-1,0]].map(([x,y,z])=>({x,y,z})));
  const oxygen=findTearCandidate(molecule,ids[2],{positionFor,pullVector:{x:1,y:0,z:0}});assert.ok(oxygen);assert.equal(oxygen.key,`${Math.min(ids[1],ids[2])}:${Math.max(ids[1],ids[2])}`);assert.deepEqual(new Set(oxygen.grabFragment),new Set([ids[2],ids[3]]));
  const hydrogen=findTearCandidate(molecule,ids[3],{positionFor,pullVector:{x:1,y:0,z:0}});assert.ok(hydrogen);assert.deepEqual(new Set(hydrogen.grabFragment),new Set([ids[3]]));
}

{
  // Terminal carbon selects CH3 rather than a larger chain split.
  const{molecule,ids}=graph(['C','C','C','H','H','H'],[[0,1],[1,2],[0,3],[0,4],[0,5]]),positionFor=positionsFor(ids,[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:2,y:0,z:0},{x:-.4,y:.5,z:0},{x:-.4,y:-.5,z:0},{x:-.5,y:0,z:.4}]);
  const candidate=findTearCandidate(molecule,ids[0],{positionFor,pullVector:{x:-1,y:0,z:0}});assert.ok(candidate);assert.deepEqual(new Set(candidate.grabFragment),new Set([ids[0],ids[3],ids[4],ids[5]]));
}

{
  // A ring edge is not a bridge, but an OH substituent attachment is.
  const{molecule,ids}=graph(['C','C','C','C','C','C','O','H'],[[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[0,6],[6,7]]),positionFor=positionsFor(ids,[{x:1,y:0,z:0},{x:.5,y:.86,z:0},{x:-.5,y:.86,z:0},{x:-1,y:0,z:0},{x:-.5,y:-.86,z:0},{x:.5,y:-.86,z:0},{x:2,y:0,z:0},{x:3,y:0,z:0}]);
  const ring=tearCandidates(molecule,ids[1],{positionFor,pullVector:{x:0,y:1,z:0}});assert.equal(ring.length,0,'benzene ring atom has no detachable small bridge-side fragment');
  const oxygen=findTearCandidate(molecule,ids[6],{positionFor,pullVector:{x:1,y:0,z:0}});assert.ok(oxygen);assert.deepEqual(new Set(oxygen.grabFragment),new Set([ids[6],ids[7]]));
}

{
  // Middle atom in A-B-C cannot remove the larger grab side.
  const{molecule,ids}=graph(['C','C','C'],[[0,1],[1,2]]);assert.equal(findTearCandidate(molecule,ids[1]),null);
}

{
  // Equal-sized choices use pull direction only after fragment-size ranking.
  const{molecule,ids}=graph(['C','C','C','C'],[[0,1],[1,2],[2,3]]),positionFor=positionsFor(ids,[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:2,y:0,z:0},{x:3,y:0,z:0}]);
  const candidate=findTearCandidate(molecule,ids[1],{positionFor,pullVector:{x:-1,y:0,z:0}});assert.ok(candidate);assert.equal(candidate.bodySideId,ids[2]);
}

{
  const candidate={key:'1:2',bond:{order:1},direction:{x:1,y:0,z:0}},gesture=createTearGesture(),threshold=TEAR_POLICY.armDistance;
  assert.equal(projectedTearPull(candidate,{x:-2,y:0,z:0}),0,'pulling toward the body does not create tear tension');
  assert.equal(gesture.update({candidate,tension:threshold*.5,now:0}).armed,false,'ordinary drag remains below arming threshold');
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:100}).armed,true);
  assert.equal(gesture.update({candidate,tension:threshold*.85,now:200}).armed,true,'hysteresis preserves arming through a small dip');
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:300}).shouldTear,false);
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:450}).shouldTear,false);
  assert.equal(gesture.update({candidate,tension:threshold*1.05,now:600}).shouldTear,true,'sustained tension, not a one-frame spike, tears');
}

{
  // Canonical workspace removal refunds the detached fragment and removes the crossing bond.
  const{molecule,ids}=graph(['C','O','H'],[[0,1],[1,2]]),placements=new Map(ids.map((id,index)=>[id,{position:{clone(){return this;},index}}])),stock={C:0,O:0,H:0};
  const resources={spend(){return true;},refund(cost){for(const[symbol,count]of Object.entries(cost))stock[symbol]=(stock[symbol]??0)+count;}};
  const workspace=createCraftWorkspace({molecule,placements,resources}),candidate=findTearCandidate(molecule,ids[1]);assert.ok(candidate);workspace.removeAtoms(candidate.grabFragment);
  assert.deepEqual(stock,{C:0,O:1,H:1});assert.deepEqual(molecule.atoms.map(atom=>atom.id),[ids[0]]);assert.equal(molecule.bonds.length,0);assert.equal(molecule.bondOrderForAtom(ids[0]),0);
}

console.log('Craft tear-off passed: bridge fragments, size priority, ring safety, sustained gesture and BASE STOCK return.');
