// Build-time projections; the list never starts a renderer or solver.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js';
import {ELEMENTS} from '../src/chemistry.js';
import {aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints} from '../src/aromatic-rendering.js';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const records=await read('data/molecules.json'),parts=await read('data/craft-structures.json');
await mkdir(new URL('assets/models/',root),{recursive:true});
const n=value=>Number(value.toFixed(2));
for(const [kind,items]of [['molecule',records],['part',parts]])for(const record of items){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,.48,-.14));
  const atoms=layout.atoms.map(atom=>({...atom,point:atom.point.clone().applyQuaternion(rotation)}));
  const radius=Math.max(1,...atoms.map(a=>a.point.length()+ELEMENTS[a.element].radius));const scale=52/radius;
  const project=p=>({x:96+p.x*scale,y:64-p.y*scale,z:p.z});
  const projected=atoms.map(a=>project(a.point)),edges=aromaticBondKeys(layout.aromaticCycles),shapes=[];
  for(const bond of layout.bonds){
    const a=projected[bond.a],b=projected[bond.b],order=displayedBondOrder(bond,edges),len=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=-(b.y-a.y)/len,dy=(b.x-a.x)/len;
    for(let i=0;i<order;i++){const offset=(i-(order-1)/2)*3;shapes.push({z:(a.z+b.z)/2-.03,svg:`<path d="M${n(a.x+dx*offset)} ${n(a.y+dy*offset)}L${n(b.x+dx*offset)} ${n(b.y+dy*offset)}" stroke="#90acbc" stroke-width="${n(Math.max(1.6,scale*.09))}" stroke-linecap="round"/>`});}
  }
  for(const cycle of layout.aromaticCycles){const frame=aromaticRingFrame(THREE,cycle.map(i=>layout.atoms[i].point));if(!frame)continue;const points=aromaticRingPoints(frame).map(p=>project(p.clone().applyQuaternion(rotation)));shapes.push({z:points.reduce((s,p)=>s+p.z,0)/points.length,svg:`<path d="${points.map((p,i)=>`${i?'L':'M'}${n(p.x)} ${n(p.y)}`).join('')}Z" fill="none" stroke="#66d8dc" stroke-width="1.7"/>`});}
  const defs=new Set();
  atoms.forEach((atom,i)=>{const {x,y,z}=projected[i],r=Math.max(2,ELEMENTS[atom.element].radius*scale*.72);defs.add(atom.element);shapes.push({z,svg:`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${atom.element})"/>`});});
  for(const port of layout.ports){const a=projected[port.atom],p=project(port.point.clone().applyQuaternion(rotation));shapes.push({z:Infinity,svg:`<path d="M${n(a.x)} ${n(a.y)}L${n(p.x)} ${n(p.y)}" stroke="#e9bb69" stroke-dasharray="3 3"/><circle cx="${n(p.x)}" cy="${n(p.y)}" r="3" fill="none" stroke="#e9bb69"/>`});}
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128"><defs>${[...defs].map(symbol=>`<radialGradient id="${symbol}" cx="30%" cy="25%" r="75%"><stop stop-color="#fff" stop-opacity=".9"/><stop offset=".3" stop-color="${ELEMENTS[symbol].color}"/><stop offset="1" stop-color="${ELEMENTS[symbol].color}" stop-opacity=".65"/></radialGradient>`).join('')}</defs>${shapes.sort((a,b)=>a.z-b.z).map(item=>item.svg).join('')}</svg>\n`;
  await writeFile(new URL(`assets/models/${kind}-${record.id}.svg`,root),svg);
}
console.log(`Generated ${records.length} molecule + ${parts.length} part thumbnails`);
