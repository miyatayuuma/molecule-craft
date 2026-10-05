import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {POLYMER_MORPHOLOGY_ARCHETYPES,POLYMER_MORPHOLOGY_PROFILES,polymerMorphologyProfile,validatePolymerMorphologyAuthority} from '../src/polymer-morphology-authority.js';
import {createPolymerMorphologyPlan,POLYMER_MORPHOLOGY_BUDGET} from '../src/polymer-morphology-plan.js';
import {createPolymerMorphologyRenderer} from '../src/polymer-morphology-renderer.js';

const json=async path=>JSON.parse(await readFile(new URL(path,import.meta.url),'utf8'));
const polymers=await json('../data/polymers.json'),routes=(await json('../data/polymerization-routes.json')).routes,documentation=await readFile(new URL('../docs/static-polymer-morphology.md',import.meta.url),'utf8');
const norm=vector=>Math.hypot(...vector),sub=(a,b)=>a.map((value,index)=>value-b[index]);
const documentationArchetypes={SEMICRYSTALLINE_DOMAINS:'Semicrystalline domains',AMORPHOUS_ENTANGLEMENT:'Amorphous entanglement',FLEXIBLE_COIL_ENSEMBLE:'Flexible coil ensemble',RIGID_COHESIVE_ENSEMBLE:'Rigid/cohesive ensemble',CONNECTED_NETWORK:'Connected network'};

test('morphology profile authority is a bijection over the current polymer and route authorities',()=>{
  const result=validatePolymerMorphologyAuthority({polymers,routes});
  assert.equal(result.polymerCount,25);assert.equal(result.routeCount,25);assert.equal(result.profileCount,25);assert.equal(result.archetypeCount,5);
  assert.deepEqual(new Set(result.archetypes),new Set(POLYMER_MORPHOLOGY_ARCHETYPES));
  assert.deepEqual(POLYMER_MORPHOLOGY_PROFILES.map(profile=>profile.polymerId).sort(),polymers.map(polymer=>polymer.id).sort());
  assert.equal(new Set(POLYMER_MORPHOLOGY_PROFILES.map(profile=>profile.polymerId)).size,25);
  assert.equal(POLYMER_MORPHOLOGY_PROFILES.find(profile=>profile.polymerId==='phenol-formaldehyde-resin').archetype,'CONNECTED_NETWORK');
  for(const profile of POLYMER_MORPHOLOGY_PROFILES){
    assert.ok(POLYMER_MORPHOLOGY_ARCHETYPES.includes(profile.archetype));
    assert.equal(polymerMorphologyProfile(profile.polymerId),profile);
  }
  for(const profile of POLYMER_MORPHOLOGY_PROFILES){
    assert.match(documentation,new RegExp('^\\| `'+profile.polymerId+'` \\| '+documentationArchetypes[profile.archetype]+' \\|','m'),`documentation maps ${profile.polymerId} to the authority archetype`);
  }
});

test('authority rejects missing, duplicate, unknown, invalid and route-incompatible morphology records',()=>{
  const valid=POLYMER_MORPHOLOGY_PROFILES;
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:valid.slice(1)}),/exactly 25/);
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:[...valid.slice(0,-1),valid[0]]}),/duplicate morphology profile/);
  const unknown=valid.map(profile=>({...profile}));unknown[0].polymerId='not-a-polymer';
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:unknown}),/Unknown morphology polymer id/);
  const invalid=valid.map(profile=>({...profile}));invalid[0].archetype='SEMICRYSTALINE_DOMAINS';
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:invalid}),/Invalid morphology archetype/);
  const wrongNetwork=valid.map(profile=>profile.polymerId==='phenol-formaldehyde-resin'?{...profile,archetype:'AMORPHOUS_ENTANGLEMENT'}:profile);
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:wrongNetwork}),/Network route requires connected morphology/);
  const wrongLinear=valid.map(profile=>profile.polymerId==='polyethylene'?{...profile,archetype:'CONNECTED_NETWORK'}:profile);
  assert.throws(()=>validatePolymerMorphologyAuthority({polymers,routes,profiles:wrongLinear}),/Connected morphology requires a network route/);
});

test('all 25 plans are seeded, bounded and expose a continuous hero member',()=>{
  for(const polymer of polymers){
    const plan=createPolymerMorphologyPlan({polymerId:polymer.id,seed:'qa-seed'}),again=createPolymerMorphologyPlan({polymerId:polymer.id,seed:'qa-seed'}),otherSeed=createPolymerMorphologyPlan({polymerId:polymer.id,seed:'other-seed'});
    assert.deepEqual(plan,again,`${polymer.id}: stable seed preserves topology and coordinates`);
    assert.notDeepEqual(plan.strands.map(row=>row.points),otherSeed.strands.map(row=>row.points),`${polymer.id}: seed changes the deterministic plan`);
    assert.ok(plan.stats.memberCount>0&&plan.stats.memberCount<=POLYMER_MORPHOLOGY_BUDGET.maxMembers);
    assert.ok(plan.stats.pointCount<=POLYMER_MORPHOLOGY_BUDGET.maxPlanPoints);
    assert.ok(plan.stats.vertexCount<=POLYMER_MORPHOLOGY_BUDGET.maxVertices);
    assert.ok(plan.stats.indexCount<=POLYMER_MORPHOLOGY_BUDGET.maxIndices);
    assert.equal(plan.heroStrand.points.length>=2,true,`${polymer.id}: hero candidate has a continuous point sequence`);
    assert.ok(plan.heroStrand.startTangent.every(Number.isFinite)&&plan.heroStrand.endTangent.every(Number.isFinite));
    for(const id of plan.heroStrand.memberIds)assert.ok(plan.strands.some(strand=>strand.id===id),`${polymer.id}: hero candidate belongs to the rendered model`);
    assert.ok(plan.bounds.radius>2&&plan.bounds.max[2]-plan.bounds.min[2]>1.5,`${polymer.id}: representative material occupies real depth`);
    assert.ok(plan.strands.every(strand=>strand.points.every(point=>point.length===3&&point.every(Number.isFinite))));
  }
});

test('ordered domains create local direction while the whole PE ensemble stays multi-directional',()=>{
  const plan=createPolymerMorphologyPlan({polymerId:'polyethylene'});
  assert.ok(plan.domains.length>=4);
  const domainReadability=plan.domains.map(domain=>{
    let nearby=0,aligned=0;
    for(const strand of plan.strands)for(let index=1;index<strand.points.length;index++){
      const from=strand.points[index-1],to=strand.points[index],middle=from.map((value,axis)=>(value+to[axis])*.5),direction=sub(to,from),distance=norm(sub(middle,domain.center));
      if(distance<.95){nearby++;if(Math.abs(direction.reduce((sum,value,axis)=>sum+value*domain.axis[axis],0)/norm(direction))>.72)aligned++;}
    }
    return{nearby,ratio:nearby?aligned/nearby:0};
  });
  assert.ok(domainReadability.filter(domain=>domain.nearby>30&&domain.ratio>.62).length>=3,JSON.stringify(domainReadability));
  for(let left=0;left<plan.domains.length;left++)for(let right=left+1;right<plan.domains.length;right++)assert.ok(Math.abs(plan.domains[left].axis.reduce((sum,value,index)=>sum+value*plan.domains[right].axis[index],0))<.97,'ordered domains do not share one global orientation');
});

test('the phenolic network is a connected three-dimensional graph with an existing continuous member path',()=>{
  const plan=createPolymerMorphologyPlan({polymerId:'phenol-formaldehyde-resin'}),graph=plan.network;
  assert.ok(graph);assert.equal(graph.nodes.length,28);assert.ok(graph.edges.length>graph.nodes.length-1);
  const adjacency=graph.nodes.map(()=>new Set());
  for(const edge of graph.edges){adjacency[edge.from].add(edge.to);adjacency[edge.to].add(edge.from);const strand=plan.strands.find(row=>row.from===edge.from&&row.to===edge.to);assert.ok(strand);assert.deepEqual(strand.points[0],graph.nodes[edge.from]);assert.deepEqual(strand.points.at(-1),graph.nodes[edge.to]);}
  const seen=new Set([0]),queue=[0];for(let index=0;index<queue.length;index++)for(const next of adjacency[queue[index]])if(!seen.has(next)){seen.add(next);queue.push(next);}
  assert.equal(seen.size,graph.nodes.length,'every junction is reachable through actual shared members');
  assert.ok(adjacency.some(neighbors=>neighbors.size>=3),'network has branch junctions');
  assert.equal(plan.heroStrand.kind,'network-path');assert.ok(plan.heroStrand.memberIds.length>=2);
  for(const memberId of plan.heroStrand.memberIds)assert.ok(plan.strands.some(strand=>strand.id===memberId));
  assert.ok(plan.heroStrand.points.length>graph.nodes.length);
});

test('the five review archetypes have different structural signatures without using color as identity',()=>{
  const ids=['polyethylene','polystyrene','polybutadiene','polyacrylonitrile','phenol-formaldehyde-resin'],plans=ids.map(polymerId=>createPolymerMorphologyPlan({polymerId,seed:'same-color-review'}));
  assert.equal(new Set(plans.map(plan=>plan.archetype)).size,5);
  const signatures=plans.map(plan=>`${plan.archetype}|${plan.stats.memberCount}|${plan.stats.junctionCount}|${Math.round((plan.bounds.max[0]-plan.bounds.min[0])*10)}|${Math.round((plan.bounds.max[1]-plan.bounds.min[1])*10)}|${Math.round((plan.bounds.max[2]-plan.bounds.min[2])*10)}`);
  assert.equal(new Set(signatures).size,5,signatures.join('\n'));
  assert.equal(plans[0].domains.length,4);assert.equal(plans[1].domains.length,0);assert.equal(plans[2].stats.memberCount,27);assert.equal(plans[3].stats.memberCount,30);assert.ok(plans[4].junctions.length>0);
});

test('production renderer stays static, within budget and disposes all geometry and material resources',()=>{
  for(const polymerId of ['polyethylene','polystyrene','polybutadiene','polyacrylonitrile','phenol-formaldehyde-resin']){
    const plan=createPolymerMorphologyPlan({polymerId}),rendered=createPolymerMorphologyRenderer(THREE,plan),stats=rendered.stats(),geometryDisposals=[],materialDisposals=[];
    assert.ok(stats.objectCount<=POLYMER_MORPHOLOGY_BUDGET.maxRenderObjects);assert.ok(stats.geometryCount<=POLYMER_MORPHOLOGY_BUDGET.maxGeometries);assert.ok(stats.materialCount<=POLYMER_MORPHOLOGY_BUDGET.maxMaterials);
    assert.ok(stats.vertexCount<=POLYMER_MORPHOLOGY_BUDGET.maxVertices);assert.ok(stats.indexCount<=POLYMER_MORPHOLOGY_BUDGET.maxIndices);
    const tube=rendered.root.children.find(child=>child.name==='mesoscale-polymer-strands');
    const largestReferencedVertex=Math.max(...tube.geometry.index.array);
    assert.ok(largestReferencedVertex>stats.vertexCount*.7,`${polymerId}: indexed mesh reaches its later strand batches`);
    for(const child of rendered.root.children){child.geometry?.addEventListener('dispose',()=>geometryDisposals.push(true));child.material?.addEventListener('dispose',()=>materialDisposals.push(true));}
    const first=rendered.stats();for(let frame=0;frame<30;frame++)assert.deepEqual(rendered.stats(),first,`${polymerId}: static hold keeps resource counts fixed`);
    rendered.dispose();rendered.dispose();assert.equal(rendered.root.children.length,0);assert.equal(rendered.stats().objectCount,0);assert.equal(rendered.stats().geometryCount,0);assert.equal(rendered.stats().materialCount,0);
    assert.equal(geometryDisposals.length,stats.geometryCount);assert.equal(materialDisposals.length,stats.materialCount);
  }
});
