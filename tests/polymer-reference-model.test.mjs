import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel,polymerReferenceDefinition} from '../src/polymer-reference-model.js';
const routes=JSON.parse(await readFile(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
const valence={C:4,H:1,N:3,O:2,F:1,Cl:1};
// Independent elemental accounting: repeat composition and explicit display caps.
const repeats={
  polyethylene:{C:2,H:4},polypropylene:{C:3,H:6},'polyvinyl-chloride':{C:2,H:3,Cl:1},
  polychlorotrifluoroethylene:{C:2,F:3,Cl:1},'polyvinylidene-fluoride':{C:2,H:2,F:2},polytetrafluoroethylene:{C:2,F:4},
  polystyrene:{C:8,H:8},polyacrylonitrile:{C:3,H:3,N:1},'polyacrylic-acid':{C:3,H:4,O:2},polyisobutylene:{C:4,H:8},
  'polyethylene-oxide':{C:2,H:4,O:1},'polylactic-acid':{C:3,H:4,O:2},'polyglycolic-acid':{C:2,H:2,O:2},
  'polyethylene-terephthalate':{C:10,H:8,O:4},'polyethylene-adipate':{C:8,H:12,O:4},
  'polyethylene-adipamide':{C:8,H:14,N:2,O:2},'nylon-6-6':{C:12,H:22,N:2,O:2},
  polybutadiene:{C:4,H:6},polyisoprene:{C:5,H:8},'hfp-display-unit':{C:3,F:6}
};
for(const {polymerId} of routes)for(const n of [10,30,100])test(`${polymerId} ${n}: valence, connectivity, finite coordinates, composition and determinism`,()=>{
  const d=polymerReferenceDefinition(polymerId);assert.ok(d);
  const plan=createPolymerReferenceModel(THREE,polymerId,n);
  assert.deepEqual(plan,createPolymerReferenceModel(THREE,polymerId,n));
  const neighbors=plan.atoms.map(()=>[]),sums=plan.atoms.map(()=>0),counts={},edges=new Set();
  plan.atoms.forEach((a,i)=>{assert.equal(a.id,i);assert.ok([a.x,a.y,a.z].every(Number.isFinite));assert.ok(a.element in valence);counts[a.element]=(counts[a.element]??0)+1;});
  for(const b of plan.bonds){assert.ok(Number.isInteger(b.a)&&Number.isInteger(b.b)&&neighbors[b.a]&&neighbors[b.b]);assert.notEqual(b.a,b.b);assert.ok([1,2,3].includes(b.order));const key=[b.a,b.b].sort((a,b)=>a-b).join(':');assert.ok(!edges.has(key));edges.add(key);sums[b.a]+=b.order;sums[b.b]+=b.order;neighbors[b.a].push(b.b);neighbors[b.b].push(b.a);}
  plan.atoms.forEach((a,i)=>assert.equal(sums[i],valence[a.element],`atom ${i} ${a.element}`));
  const visited=new Set([0]),pending=[0];while(pending.length)for(const j of neighbors[pending.pop()])if(!visited.has(j)){visited.add(j);pending.push(j);}assert.equal(visited.size,plan.atoms.length);
  const expected={H:2};
  const add=(id,num)=>{for(const [e,v] of Object.entries(repeats[id]))expected[e]=(expected[e]??0)+v*num;};
  if(d.network){assert.deepEqual(counts,{C:7*n-1,H:6*n,O:n});assert.equal(plan.aromaticCycles.length,n);assert.equal(plan.bonds.length-plan.atoms.length+1,n);return;}
  if(d.components){for(let i=0;i<n;i++)add(d.components[d.minorEvery?(i%d.minorEvery===d.minorEvery-1?1:0):[0,0,1,0,1,1][i%6]],1);}
  else add(polymerId,n);
  if(d.backboneRepeat&&polymerId!=='polyethylene-oxide')expected.O=(expected.O??0)+1;
  assert.deepEqual(counts,expected);
});
test('unsupported identities and invalid sizes reject',()=>{
  assert.throws(()=>createPolymerReferenceModel(THREE,'unknown',10),RangeError);
  for(const {polymerId}of routes)for(const n of [0,9,11,NaN,Infinity,'10'])assert.throws(()=>createPolymerReferenceModel(THREE,polymerId,n),RangeError);
});
