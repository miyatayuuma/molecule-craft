// Build-time projections; the list never starts a renderer or solver.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=30';
import {ELEMENTS} from '../src/chemistry.js';
import {aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints} from '../src/aromatic-rendering.js';
import {specialEdgeKeys,sharedBondCurves} from '../src/special-bonds.js?v=30';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const records=await read('data/molecules.json'),parts=await read('data/craft-structures.json');
await mkdir(new URL('assets/models/',root),{recursive:true});
const n=value=>Number(value.toFixed(2));
const shade=(hex,factor)=>`#${hex.slice(1).match(/../g).map(channel=>Math.round(parseInt(channel,16)*factor).toString(16).padStart(2,'0')).join('')}`;
for(const [kind,items]of [['molecule',records],['part',parts]])for(const record of items){
  const model=createPreviewModel(THREE,record);for(let i=0;i<220;i++)model.step();const layout=model.snapshot();
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.32,.48,-.14));
  const atoms=layout.atoms.map(atom=>({...atom,point:atom.point.clone().applyQuaternion(rotation)}));
  const radius=Math.max(1,...atoms.map(a=>a.point.length()+ELEMENTS[a.element].radius));const scale=52/radius;
  const project=p=>({x:96+p.x*scale,y:64-p.y*scale,z:p.z});
  const radii=atoms.map(atom=>Math.max(2,ELEMENTS[atom.element].radius*scale*.72));
  const projected=atoms.map(a=>project(a.point)),edges=new Set([...aromaticBondKeys(layout.aromaticCycles),...specialEdgeKeys(layout.sharedGroups??[])]),shapes=[];
  for(const bond of layout.bonds){
    const a=projected[bond.a],b=projected[bond.b],order=displayedBondOrder(bond,edges),len=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=-(b.y-a.y)/len,dy=(b.x-a.x)/len;
    for(let i=0;i<order;i++){
      const offset=(i-(order-1)/2)*3,start=Math.sqrt(Math.max(0,radii[bond.a]**2-offset**2)),end=Math.sqrt(Math.max(0,radii[bond.b]**2-offset**2));
      if(start+end>=len)continue;
      const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;
      shapes.push({z:(a.z+b.z)/2-.03,svg:`<path d="M${n(a.x+ux*start+dx*offset)} ${n(a.y+uy*start+dy*offset)}L${n(b.x-ux*end+dx*offset)} ${n(b.y-uy*end+dy*offset)}" stroke="#90acbc" stroke-width="${n(Math.max(1.6,scale*.09))}" stroke-linecap="round"/>`});
    }
  }
  for(const cycle of layout.aromaticCycles){const frame=aromaticRingFrame(THREE,cycle.map(i=>layout.atoms[i].point));if(!frame)continue;const points=aromaticRingPoints(frame).map(p=>project(p.clone().applyQuaternion(rotation)));shapes.push({z:points.reduce((s,p)=>s+p.z,0)/points.length,svg:`<path d="${points.map((p,i)=>`${i?'L':'M'}${n(p.x)} ${n(p.y)}`).join('')}Z" fill="none" stroke="#66d8dc" stroke-width="1.7"/>`});}
  for(const shared of layout.sharedGroups??[])for(const curve of sharedBondCurves(THREE,shared,id=>layout.atoms[id].point)){
    const points=curve.map(p=>project(p.applyQuaternion(rotation)));
    shapes.push({z:points.reduce((sum,p)=>sum+p.z,0)/points.length,svg:`<path d="${points.map((p,i)=>`${i?'L':'M'}${n(p.x)} ${n(p.y)}`).join('')}" fill="none" stroke="#8ce7ee" stroke-opacity=".65" stroke-width="1.2"/>`});
  }
  const defs=new Set();
  atoms.forEach((atom,i)=>{const {x,y,z}=projected[i],r=radii[i];defs.add(atom.element);shapes.push({z,svg:`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${atom.element})"/>`});});
  for(const port of layout.ports){const a=projected[port.atom],p=project(port.point.clone().applyQuaternion(rotation)),length=Math.hypot(p.x-a.x,p.y-a.y)||1,trim=Math.min(radii[port.atom],length);shapes.push({z:Infinity,svg:`<path d="M${n(a.x+(p.x-a.x)*trim/length)} ${n(a.y+(p.y-a.y)*trim/length)}L${n(p.x)} ${n(p.y)}" stroke="#e9bb69" stroke-dasharray="3 3"/><circle cx="${n(p.x)}" cy="${n(p.y)}" r="3" fill="none" stroke="#e9bb69"/>`});}
  atoms.forEach((atom,i)=>{if(atom.charge){const p=projected[i];shapes.push({z:Infinity,svg:`<text x="${n(p.x+radii[i])}" y="${n(p.y-radii[i])}" fill="#e5f8ff" font-size="12" font-family="sans-serif">${atom.charge>0?'+':'−'}</text>`});}});
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128"><defs>${[...defs].map(symbol=>`<radialGradient id="${symbol}" cx="30%" cy="25%" r="75%"><stop stop-color="#e6f0f5"/><stop offset=".3" stop-color="${ELEMENTS[symbol].color}"/><stop offset="1" stop-color="${shade(ELEMENTS[symbol].color,.64)}"/></radialGradient>`).join('')}</defs>${shapes.sort((a,b)=>a.z-b.z).map(item=>item.svg).join('')}</svg>\n`;
  await writeFile(new URL(`assets/models/${kind}-${record.id}.svg`,root),svg);
}
console.log(`Generated ${records.length} molecule + ${parts.length} part thumbnails`);
