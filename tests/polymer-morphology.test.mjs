import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import {POLYMER_VISUAL_PROFILES,MORPHOLOGY_ARCHETYPES,MORPHOLOGY_BUDGET,validateMorphologyAuthority,createMorphologyPlan,cinematicFrame} from '../src/polymer-morphology.js';
import {createPolymerCinematic} from '../src/reaction-lab-polymer-cinematic.js';
const polymers=JSON.parse(await readFile(new URL('../data/polymers.json',import.meta.url))),routes=JSON.parse(await readFile(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
test('25 exact profiles, routes and deterministic bounded plans; invalid authorities fail closed',()=>{
  assert.equal(validateMorphologyAuthority(polymers,routes),25);
  assert.equal(new Set(POLYMER_VISUAL_PROFILES.map(p=>p.archetype)).size,MORPHOLOGY_ARCHETYPES.length);
  for(const p of polymers){const a=createMorphologyPlan(p.id);assert.deepEqual(a,createMorphologyPlan(p.id));assert.ok(a.strands.length<=(p.topology==='network'?MORPHOLOGY_BUDGET.networkMembers:MORPHOLOGY_BUDGET.chains));assert.ok(a.strands.flat(2).every(Number.isFinite));}
  for(const profiles of [POLYMER_VISUAL_PROFILES.slice(1),[...POLYMER_VISUAL_PROFILES,POLYMER_VISUAL_PROFILES[0]],POLYMER_VISUAL_PROFILES.map((p,i)=>i? p:{...p,archetype:'invalid'}),POLYMER_VISUAL_PROFILES.map((p,i)=>i?p:{...p,bulk:3}),POLYMER_VISUAL_PROFILES.map(p=>p.polymerId==='phenol-formaldehyde-resin'?{...p,archetype:'flexible-coils'}:p)])assert.throws(()=>validateMorphologyAuthority(polymers,routes,profiles));
  assert.throws(()=>validateMorphologyAuthority(polymers,[...routes,{polymerId:'unknown'}]));assert.throws(()=>createMorphologyPlan('unknown'));
});
function census(root){const objects=[],geometries=new Set(),materials=new Set();root.traverse(o=>{objects.push(o);if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});return{objects:objects.length,geometries:geometries.size,materials:materials.size,vertices:[...geometries].reduce((n,g)=>n+(g.attributes.position?.count??0),0),indices:[...geometries].reduce((n,g)=>n+(g.index?.count??0),0)};}
test('real Three resources are bounded for all 25, stable throughout hold and long elapsed time; dispose releases once',()=>{
  for(const p of polymers){const c=createPolymerCinematic({THREE,polymerId:p.id}),initial=census(c.root),matrices=c.root.children.filter(o=>o.isInstancedMesh).map(o=>o.instanceMatrix.array);
    assert.ok(initial.objects<=MORPHOLOGY_BUDGET.objects);assert.ok(initial.vertices<=MORPHOLOGY_BUDGET.vertices);assert.ok(initial.geometries<=MORPHOLOGY_BUDGET.geometries);assert.ok(initial.materials<=MORPHOLOGY_BUDGET.materials);
    for(let i=0;i<1000;i++){c.update(16);assert.deepEqual(census(c.root),initial);}
    assert.deepEqual(c.root.children.filter(o=>o.isInstancedMesh).map(o=>o.instanceMatrix.array),matrices);
    assert.equal(c.stats.feedVisualCapacity,24);const disposed=new Map();c.root.traverse(o=>{for(const resource of [o.geometry,o.material])if(resource&&!disposed.has(resource)){disposed.set(resource,0);resource.addEventListener('dispose',()=>disposed.set(resource,disposed.get(resource)+1));}});
    c.dispose();c.dispose();assert.equal(c.root.children.length,0);assert.ok([...disposed.values()].every(n=>n===1));assert.equal(c.stats.objectCount,0);
  }
});
test('structure distinguishes ordered, bulky, coils, cohesive and connected network without colors',()=>{
  const ids=['polyethylene','polystyrene','polybutadiene','nylon-6-6','phenol-formaldehyde-resin'];const plans=ids.map(createMorphologyPlan);assert.equal(new Set(plans.map(p=>JSON.stringify(p.strands))).size,5);
  const network=plans[4],ends=network.strands.flatMap(s=>[s[0],s.at(-1)]),degree=new Map();for(const p of ends){const key=JSON.stringify(p);degree.set(key,(degree.get(key)??0)+1);}assert.ok(Math.max(...degree.values())>=6);assert.equal(degree.size,64);
});
test('normal and reduced both include morphology hold; clock rejects large/negative gaps',()=>{
  for(const reduced of [false,true]){const phases=new Set();for(let t=0;t<=6000;t+=25)phases.add(cinematicFrame(t,reduced).phase);assert.ok(phases.has('morphology-hold'));assert.ok(phases.has('collapse'));}
  const c=createPolymerCinematic({THREE,polymerId:'polyethylene'});c.update(100000);assert.equal(c.stats.phase,'bulk-feed');assert.ok(c.stats.progress<.1);c.dispose();
});
