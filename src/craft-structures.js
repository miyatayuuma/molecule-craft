import { ELEMENTS } from './chemistry.js?v=20';
import { ATOMIC_MODEL, preferredValence, bondLengthScale } from './bonding-model.js?v=30';

export function validateCraftStructures(templates, groups) {
  if(!Array.isArray(templates))throw new Error('Invalid structure templates');
  const groupIds=new Set(groups.map(group=>group.id)),ids=new Set();
  for(const item of templates){
    if(!item.id||ids.has(item.id)||!item.nameJa||!item.nameEn||!item.notation||!item.label||!groupIds.has(item.unlock?.groupId)||![1,2].includes(item.unlock.distinctMolecules))throw new Error('Invalid structure unlock');
    ids.add(item.id);
    if(!Array.isArray(item.atoms)||!item.atoms.length||item.atoms.some(element=>!ELEMENTS[element])||!Array.isArray(item.bonds)||!item.attachments?.length)throw new Error(`Invalid structure: ${item.id}`);
    const used=item.atoms.map(()=>0),pairs=new Set(),adjacency=item.atoms.map(()=>[]);
    for(const [a,b,order] of item.bonds){
      const key=[a,b].sort((x,y)=>x-y).join(':');
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=used.length||b>=used.length||a===b||![1,2,3].includes(order)||pairs.has(key))throw new Error(`Invalid structure bond: ${item.id}`);
      pairs.add(key);used[a]+=order;used[b]+=order;adjacency[a].push(b);adjacency[b].push(a);
    }
    const visited=new Set([0]),queue=[0];for(let i=0;i<queue.length;i++)for(const n of adjacency[queue[i]])if(!visited.has(n)){visited.add(n);queue.push(n);}
    if(visited.size!==item.atoms.length)throw new Error(`Disconnected structure: ${item.id}`);
    const capacity=item.atoms.map(()=>0),ports=new Set();
    for(const port of item.attachments){
      if(!Number.isInteger(port.atom)||port.atom<0||port.atom>=used.length||port.order!==1||!Number.isInteger(port.slots)||port.slots<1||ports.has(port.atom))throw new Error(`Invalid attachment: ${item.id}`);
      ports.add(port.atom);capacity[port.atom]=port.slots*port.order;
    }
    item.atoms.forEach((element,index)=>{
      if(used[index]+capacity[index]!==preferredValence(element,used[index]))throw new Error(`Attachment valence mismatch: ${item.id} atom ${index}`);
    });
  }
  return templates;
}

// No persistent "part" object: after this call the graph contains ordinary atoms.
// All connections to the existing field still require the normal electron gesture.
export function expandCraftStructure(molecule, template) {
  const ids=template.atoms.map(element=>molecule.addAtom(element).id);
  for(const [a,b,order] of template.bonds)molecule.setBond(ids[a],ids[b],order);
  return {ids,attachments:template.attachments.map(port=>({...port,atomId:ids[port.atom]}))};
}

// Non-coincident seeds only. The usual constraint solver owns the final geometry.
export function seedCraftCoordinates(template) {
  const adjacency=template.atoms.map(()=>[]);
  template.bonds.forEach(([a,b,order])=>{adjacency[a].push({id:b,order});adjacency[b].push({id:a,order});});
  const length=(a,b,order)=>((ATOMIC_MODEL[template.atoms[a]].covalentRadius+ATOMIC_MODEL[template.atoms[b]].covalentRadius)*.78*bondLengthScale(order));
  const points=new Map(),queue=[];
  // A substituent carbon must not hide its parent ring (e.g. toluene).
  let ringOrder=[];
  function findRing(path){
    if(path.length===6){if(adjacency[path.at(-1)].some(n=>n.id===path[0]))ringOrder=path;return;}
    for(const n of adjacency[path.at(-1)])if(!ringOrder.length&&template.atoms[n.id]==='C'&&!path.includes(n.id))findRing([...path,n.id]);
  }
  for(let id=0;id<template.atoms.length&&!ringOrder.length;id++)if(template.atoms[id]==='C')findRing([id]);
  if(ringOrder.length){
    const radius=ringOrder.reduce((sum,id,i)=>sum+length(id,ringOrder[(i+1)%6],adjacency[id].find(n=>n.id===ringOrder[(i+1)%6]).order),0)/6;
    ringOrder.forEach((id,i)=>{points.set(id,{x:radius*(1-Math.cos(i*Math.PI/3)),y:radius*Math.sin(i*Math.PI/3),z:0});queue.push(id);});
  }else{const root=template.attachments[0].atom;points.set(root,{x:0,y:0,z:0});queue.push(root);}
  for(let i=0;i<queue.length;i++){
    const id=queue[i],origin=points.get(id),neighbors=adjacency[id];
    for(let slot=0;slot<neighbors.length;slot++){
      const n=neighbors[slot];if(points.has(n.id))continue;
      let direction;
      if(ringOrder.includes(id)){
        const center=ringOrder.reduce((sum,atomId)=>({x:sum.x+points.get(atomId).x/6,y:sum.y+points.get(atomId).y/6,z:0}),{x:0,y:0,z:0});
        direction={x:origin.x-center.x,y:origin.y-center.y,z:0};
      }else{
        const angle=(slot+.35)*2*Math.PI/Math.max(3,neighbors.length)+i*.7;
        direction={x:Math.cos(angle),y:Math.sin(angle),z:neighbors.length>=4?(slot%2?.65:-.65):.15*Math.sin(i+slot)};
      }
      const scale=length(id,n.id,n.order)/Math.hypot(direction.x,direction.y,direction.z);
      points.set(n.id,{x:origin.x+direction.x*scale,y:origin.y+direction.y*scale,z:origin.z+direction.z*scale});queue.push(n.id);
    }
  }
  const root=points.get(template.attachments[0].atom);
  return template.atoms.map((_,id)=>{const p=points.get(id);return {x:p.x-root.x,y:p.y-root.y,z:p.z-root.z};});
}
