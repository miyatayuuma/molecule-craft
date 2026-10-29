import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=34';
import {canonicalPartView,projectCanonicalPartLayout,PART_SETTLEMENT} from '../src/part-presentation.js?v=2';
import {ELEMENTS,modelAtomRadius} from '../src/chemistry.js?v=20';

const parts=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url),'utf8'));
const parseTag=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(match=>[match[1],match[2]]));
const tags=(svg,tag,attribute)=>[...svg.matchAll(new RegExp(`<${tag}\\b(?=[^>]*\\b${attribute}=)[^>]*>`, 'g'))].map(match=>parseTag(match[0]));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function legacyClearances(layout){
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,.48,-.14)),radius=Math.max(1,...layout.atoms.map(atom=>atom.point.length()+ELEMENTS[atom.element].radius)),scale=52/radius;
  const atoms=layout.atoms.map(atom=>{const point=atom.point.clone().applyQuaternion(rotation);return{x:96+point.x*scale,y:64-point.y*scale,r:modelAtomRadius(atom.element)*scale};});
  return layout.ports.map(port=>{const point=port.point.clone().applyQuaternion(rotation),marker={x:96+point.x*scale,y:64-point.y*scale,r:3};return Math.min(...atoms.map(atom=>distance(marker,atom)-marker.r-atom.r));});
}

for(const part of parts){
  const model=createPreviewModel(THREE,part);let stable=0;for(let step=0;step<PART_SETTLEMENT.maxSteps;step++){const movement=model.step();stable=movement<PART_SETTLEMENT.movementThreshold?stable+1:0;if(stable>=PART_SETTLEMENT.stableSteps)break;}
  const layout=model.snapshot(),view=canonicalPartView(THREE,layout),projected=projectCanonicalPartLayout(THREE,layout,view,{projection:'orthographic'});
  const svg=await readFile(new URL(`../assets/models/part-${part.id}.svg`,import.meta.url),'utf8'),markers=tags(svg,'circle','data-attachment-marker'),rays=tags(svg,'path','data-attachment-ray'),atoms=tags(svg,'circle','data-atom-index');
  const expectedCount=part.attachments.reduce((sum,port)=>sum+port.slots,0);
  assert.equal(layout.ports.length,expectedCount,`${part.id}: settled port count agrees with template slots`);
  assert.equal(markers.length,expectedCount,`${part.id}: every attachment slot has one generated marker`);
  assert.equal(rays.length,expectedCount,`${part.id}: every marker has one generated attachment ray`);
  assert.equal(atoms.length,part.atoms.length,`${part.id}: each generated atom has one projected silhouette`);
  atoms.sort((a,b)=>Number(a['data-atom-index'])-Number(b['data-atom-index']));
  const sortedMarkers=markers.sort((a,b)=>Number(a['data-port-index'])-Number(b['data-port-index']));
  const sortedRays=rays.sort((a,b)=>Number(a['data-port-index'])-Number(b['data-port-index']));
  assert.deepEqual(sortedMarkers.map(marker=>Number(marker['data-port-index'])),Array.from({length:expectedCount},(_,index)=>index),`${part.id}: port marker indices are complete and unique`);
  assert.deepEqual(sortedRays.map(ray=>Number(ray['data-port-index'])),Array.from({length:expectedCount},(_,index)=>index),`${part.id}: port ray indices are complete and unique`);
  const clearances=[];
  for(const [portIndex,marker] of sortedMarkers.entries()){
    const center={x:Number(marker.cx),y:Number(marker.cy)},radius=Number(marker.r);
    assert([center.x,center.y,radius].every(Number.isFinite),`${part.id} port ${portIndex}: marker projection is finite`);
    assert(center.x-radius>=0&&center.x+radius<=192&&center.y-radius>=0&&center.y+radius<=128,`${part.id} port ${portIndex}: marker stays inside generated viewBox`);
    const closest=Math.min(...atoms.map(atom=>distance(center,{x:Number(atom.cx),y:Number(atom.cy)})-radius-Number(atom.r)));
    clearances.push(closest);assert(closest>=0,`${part.id} port ${portIndex}: marker silhouette clears every atom`);
    const expected=projected.ports[portIndex];assert(Math.abs(center.x-expected.x)<.011&&Math.abs(center.y-expected.y)<.011,`${part.id} port ${portIndex}: SVG and shared canonical projection agree`);
    const ray=sortedRays[portIndex].d.match(/^M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)$/);
    assert(ray&&ray.slice(1).every(value=>Number.isFinite(Number(value))),`${part.id} port ${portIndex}: attachment ray is finite`);
  }
  for(const [index,atom]of atoms.entries()){
    const expected=projected.atoms[index];assert(Math.abs(Number(atom.cx)-expected.x)<.011&&Math.abs(Number(atom.cy)-expected.y)<.011,`${part.id} atom ${index}: SVG and shared canonical projection agree`);
  }
  const viewTags=[...svg.matchAll(/<svg\b[^>]*>/g)],root=parseTag(viewTags[0]?.[0]??'');
  assert.equal(root['data-canonical-part-view'],'true',`${part.id}: generated SVG declares the shared canonical part view`);
  for(const key of ['pitch','yaw','roll'])assert(Math.abs(Number(root[`data-part-view-${key}`])-view[key])<.0000006,`${part.id}: SVG ${key} matches the deterministic view authority`);
  if(['methyl','n-butyl','isopropyl'].includes(part.id))assert(Math.min(...clearances)>0,`${part.id}: formerly hidden/overlapping attachment marker now has positive clearance`);
  if(['methyl','n-butyl','isopropyl'].includes(part.id))assert(Math.min(...legacyClearances(layout))<0,`${part.id}: fixed pre-change view remains a failing regression baseline`);
  if(part.id==='ester')assert.equal(clearances.length,2,'Ester two attachment ports are checked individually.');
}
console.log('CRAFT part presentation passed: canonical views and generated marker/ray geometry are finite, in-frame and clear for all 17 templates, including both ester ports.');
