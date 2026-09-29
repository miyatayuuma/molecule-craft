// Build-time projections; the list never starts a renderer or solver.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {createPreviewModel} from '../src/preview-model.js?v=35';
import {ELEMENTS,modelAtomRadius} from '../src/chemistry.js';
import {AROMATIC_STYLE,aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints} from '../src/aromatic-rendering.js?v=27';
import {RESONANCE_STYLE,SULFUR_OXO_STYLE,specialEdgeKeys,sharedBondCurves,sulfurOxoBondAxes} from '../src/special-bonds.js?v=34';
import {attachmentProjection} from '../src/attachment-rendering.js?v=31';
import {canonicalPartView,PART_SETTLEMENT} from '../src/part-presentation.js?v=2';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8').then(JSON.parse);
const records=await read('data/molecules.json'),parts=await read('data/craft-structures.json');
await mkdir(new URL('assets/models/',root),{recursive:true});
const n=value=>Number(value.toFixed(2));
const shade=(hex,factor)=>`#${hex.slice(1).match(/../g).map(channel=>Math.round(parseInt(channel,16)*factor).toString(16).padStart(2,'0')).join('')}`;
for(const [kind,items]of [['molecule',records],['part',parts]])for(const record of items){
  const model=createPreviewModel(THREE,record);let stable=0;for(let i=0;i<PART_SETTLEMENT.maxSteps;i++){const movement=model.step();if(kind==='part'){stable=movement<PART_SETTLEMENT.movementThreshold?stable+1:0;if(stable>=PART_SETTLEMENT.stableSteps)break;}}const layout=model.snapshot();
  const partView=kind==='part'?canonicalPartView(THREE,layout):null;
  const rotation=new THREE.Quaternion().setFromEuler(partView?new THREE.Euler(partView.pitch,partView.yaw,partView.roll,'YXZ'):new THREE.Euler(.32,.48,-.14));
  const atoms=layout.atoms.map(atom=>({...atom,point:atom.point.clone().applyQuaternion(rotation)}));
  const radius=partView?.fitRadius??Math.max(1,...atoms.map(a=>a.point.length()+ELEMENTS[a.element].radius));const scale=52/radius,bondStrokeWidth=n(Math.max(1.6,scale*.09));
  const project=p=>({x:96+p.x*scale,y:64-p.y*scale,z:p.z});
  const radii=atoms.map(atom=>Math.max(2,modelAtomRadius(atom.element)*scale));
  const projected=atoms.map(a=>project(a.point)),edges=new Set([...aromaticBondKeys(layout.aromaticCycles),...specialEdgeKeys(layout.sharedGroups??[])]),shapes=[];
  for(const bond of layout.bonds){
    const a=projected[bond.a],b=projected[bond.b],order=displayedBondOrder(bond,edges),len=Math.hypot(b.x-a.x,b.y-a.y)||1,dx=-(b.y-a.y)/len,dy=(b.x-a.x)/len;
    for(let i=0;i<order;i++){
      const offset=(i-(order-1)/2)*3,start=Math.sqrt(Math.max(0,radii[bond.a]**2-offset**2)),end=Math.sqrt(Math.max(0,radii[bond.b]**2-offset**2));
      if(start+end>=len)continue;
      const ux=(b.x-a.x)/len,uy=(b.y-a.y)/len;
      shapes.push({z:(a.z+b.z)/2-.03,svg:`<path d="M${n(a.x+ux*start+dx*offset)} ${n(a.y+uy*start+dy*offset)}L${n(b.x-ux*end+dx*offset)} ${n(b.y-uy*end+dy*offset)}" stroke="#90acbc" stroke-width="${bondStrokeWidth}" stroke-linecap="round"/>`});
    }
  }
  for(const cycle of layout.aromaticCycles){const frame=aromaticRingFrame(THREE,cycle.map(i=>layout.atoms[i].point));if(!frame)continue;const points=aromaticRingPoints(frame).map(p=>project(p.clone().applyQuaternion(rotation)));shapes.push({z:points.reduce((s,p)=>s+p.z,0)/points.length,svg:`<path data-aromatic-ring="true" d="${points.map((p,i)=>`${i?'L':'M'}${n(p.x)} ${n(p.y)}`).join('')}Z" fill="none" stroke="${AROMATIC_STYLE.assetCssColor}" stroke-width="1.7"/>`});}
  for(const shared of layout.sharedGroups??[]){
    if(shared.kind==='sulfur-oxo'){
      sulfurOxoBondAxes(THREE,shared,id=>layout.atoms[id].point).forEach(({start,end,branch})=>{
        const points=[start,end].map(point=>project(point.applyQuaternion(rotation))),marker=` data-sulfur-oxo-halo="true" data-sulfur-oxo-style="bond-axis-halo" data-sulfur-oxo-branch="${branch}" data-sulfur-bond-role="terminal"`;
        shapes.push({z:points.reduce((sum,p)=>sum+p.z,0)/points.length-.04,svg:`<path${marker} d="M${n(points[0].x)} ${n(points[0].y)}L${n(points[1].x)} ${n(points[1].y)}" fill="none" filter="url(#sulfur-oxo-halo-blur)" stroke="${SULFUR_OXO_STYLE.cssColor}" stroke-opacity=".68" stroke-width="${n(bondStrokeWidth*2.8)}" stroke-linecap="round"/>`});
      });
      continue;
    }
    const curves=sharedBondCurves(THREE,shared,id=>layout.atoms[id].point,{mode:'encyclopedia'}),resonance=['nitro','ozone'].includes(shared.kind);
    curves.forEach((curve,index)=>{
      const points=curve.map(p=>project(p.applyQuaternion(rotation))),marker=resonance?` data-resonance-distributed-bond="true" data-resonance-style="distributed-dashed" data-resonance-branch="${index}"`:'',opacity=String(RESONANCE_STYLE.opacity),width=bondStrokeWidth,cap=' stroke-linecap="round"',stroke=RESONANCE_STYLE.assetCssColor,dash=` stroke-dasharray="${n(bondStrokeWidth*3.2)} ${n(bondStrokeWidth*2.2)}"`;
      shapes.push({z:points.reduce((sum,p)=>sum+p.z,0)/points.length,svg:`<path${marker} d="${points.map((p,i)=>`${i?'L':'M'}${n(p.x)} ${n(p.y)}`).join('')}" fill="none" stroke="${stroke}" stroke-opacity="${opacity}" stroke-width="${width}"${dash}${cap}/>`});
    });
  }
  const defs=new Set(),hasSulfurOxo=(layout.sharedGroups??[]).some(shared=>shared.kind==='sulfur-oxo');
  atoms.forEach((atom,i)=>{const {x,y,z}=projected[i],r=radii[i],atomIndex=kind==='part'?` data-atom-index="${i}"`:'';defs.add(atom.element);shapes.push({z,svg:`<circle${atomIndex} cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${atom.element})"/>`});});
  for(const [portIndex,port]of layout.ports.entries()){
    const a=projected[port.atom],p=project(port.point.clone().applyQuaternion(rotation)),segment=attachmentProjection(a,p,radii[port.atom]+.5);if(!segment)continue;
    shapes.push({z:(a.z+p.z)/2,svg:`<path${kind==='part'?` data-attachment-ray="true" data-port-index="${portIndex}"`:''} d="M${n(segment.start.x)} ${n(segment.start.y)}L${n(p.x)} ${n(p.y)}" stroke="#e9bb69" stroke-dasharray="3 3"/>`});
    shapes.push({z:p.z,svg:`<circle${kind==='part'?` data-attachment-marker="true" data-port-index="${portIndex}"`:''} cx="${n(p.x)}" cy="${n(p.y)}" r="3" fill="none" stroke="#e9bb69"/>`});
  }
  atoms.forEach((atom,i)=>{if(atom.charge){const p=projected[i];shapes.push({z:Infinity,svg:`<text x="${n(p.x+radii[i])}" y="${n(p.y-radii[i])}" fill="#e5f8ff" font-size="12" font-family="sans-serif">${atom.charge>0?'+':'−'}</text>`});}});
  const viewAttributes=partView?` data-canonical-part-view="true" data-part-view-pitch="${partView.pitch.toFixed(6)}" data-part-view-yaw="${partView.yaw.toFixed(6)}" data-part-view-roll="${partView.roll.toFixed(6)}"`:'';
  const sulfurFilter=hasSulfurOxo?'<filter id="sulfur-oxo-halo-blur" filterUnits="userSpaceOnUse" x="0" y="0" width="192" height="128"><feGaussianBlur stdDeviation="2.4"/></filter>':'';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg"${viewAttributes} viewBox="0 0 192 128"><defs>${sulfurFilter}${[...defs].map(symbol=>`<radialGradient id="${symbol}" cx="30%" cy="25%" r="75%"><stop stop-color="#e6f0f5"/><stop offset=".3" stop-color="${ELEMENTS[symbol].color}"/><stop offset="1" stop-color="${shade(ELEMENTS[symbol].color,.64)}"/></radialGradient>`).join('')}</defs>${shapes.sort((a,b)=>a.z-b.z).map(item=>item.svg).join('')}</svg>\n`;
  await writeFile(new URL(`assets/models/${kind}-${record.id}.svg`,root),svg);
}
console.log(`Generated ${records.length} molecule + ${parts.length} part thumbnails`);
