import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import {ELEMENTS} from '../src/chemistry.js';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js';
import {createPreviewModel} from '../src/preview-model.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const record=id=>{const found=records.find(item=>item.id===id);assert.ok(found,`Missing ${id}`);return found;};
const pair=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

function graph(source){
  const atoms=source.atoms.map((element,id)=>({id,element})),bonds=source.bonds.map(([a,b,order])=>({a,b,order})),adj=atoms.map(()=>[]);
  for(const b of bonds){adj[b.a].push({atomId:b.b,order:b.order});adj[b.b].push({atomId:b.a,order:b.order});}
  return {atoms,bonds,neighbors:id=>adj[id],bondOrderForAtom:id=>adj[id].reduce((s,n)=>s+n.order,0),adj};
}
function findCycle(source,size){
  const g=graph(source),found=[];
  const dfs=(start,current,path,seen)=>{
    if(path.length===size){
      if(g.adj[current].some(n=>n.atomId===start))found.push([...path]);
      return;
    }
    for(const n of g.adj[current]){
      if(seen.has(n.atomId)||n.atomId<start)continue;
      seen.add(n.atomId);path.push(n.atomId);dfs(start,n.atomId,path,seen);path.pop();seen.delete(n.atomId);
    }
  };
  for(const atom of g.atoms)dfs(atom.id,atom.id,[atom.id],new Set([atom.id]));
  assert.ok(found.length,`${source.id}: no ${size}-member cycle`);
  const canonical=cycle=>{const variants=[];for(const seq of [cycle,[...cycle].reverse()])for(let i=0;i<seq.length;i++)variants.push([...seq.slice(i),...seq.slice(0,i)].join('-'));return variants.sort()[0];};
  const unique=new Map(found.map(c=>[canonical(c),c]));return [...unique.values()][0];
}
function preview(id,steps=420){
  const source=record(id),model=createPreviewModel(THREE,source);for(let i=0;i<steps;i++)model.step();return {source,g:graph(source),view:model.snapshot()};
}
function planeDistances(points){
  const center=points.reduce((s,p)=>s.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
  let bestNormal=null,best=0;
  for(let a=0;a<points.length;a++)for(let b=a+1;b<points.length;b++)for(let c=b+1;c<points.length;c++){
    const n=new THREE.Vector3().crossVectors(points[b].clone().sub(points[a]),points[c].clone().sub(points[a])),q=n.lengthSq();
    if(q>best){best=q;bestNormal=n;}
  }
  if(!bestNormal||best<1e-12)return points.map(()=>0);
  bestNormal.normalize();return points.map(p=>p.clone().sub(center).dot(bestNormal));
}
function dihedral(a,b,c,d){
  const b0=b.clone().sub(a),b1=c.clone().sub(b),b2=d.clone().sub(c),n0=new THREE.Vector3().crossVectors(b0,b1),n1=new THREE.Vector3().crossVectors(b1,b2);
  if(n0.lengthSq()<1e-12||n1.lengthSq()<1e-12)return 0;
  n0.normalize();n1.normalize();const m1=new THREE.Vector3().crossVectors(n0,b1.clone().normalize());
  return Math.atan2(m1.dot(n1),n0.dot(n1))*180/Math.PI;
}
function metrics(id,size){
  const item=preview(id),cycle=findCycle(item.source,size),p=i=>item.view.atoms[i].point,pts=cycle.map(p),distances=planeDistances(pts);
  const bonds=cycle.map((a,i)=>{const b=cycle[(i+1)%size],bond=item.g.bonds.find(x=>pair(x.a,x.b)===pair(a,b)),target=(ATOMIC_MODEL[item.g.atoms[a].element].covalentRadius+ATOMIC_MODEL[item.g.atoms[b].element].covalentRadius)*.78*bondLengthScale(bond.order);return {actual:p(a).distanceTo(p(b)),target};});
  const angles=cycle.map((center,i)=>p(cycle[(i-1+size)%size]).clone().sub(p(center)).angleTo(p(cycle[(i+1)%size]).clone().sub(p(center))*180/Math.PI);
  const local=cycle.map(id=>geometryForAtom(item.g,id).angle*180/Math.PI);
  const torsions=cycle.map((_,i)=>dihedral(p(cycle[i]),p(cycle[(i+1)%size]),p(cycle[(i+2)%size]),p(cycle[(i+3)%size])));
  const graphDistance=(start,target)=>{const q=[[start,0]],seen=new Set([start]);for(let i=0;i<q.length;i++){const [id,d]=q[i];if(id===target)return d;if(d>=4)continue;for(const n of item.g.adj[id])if(!seen.has(n.atomId)){seen.add(n.atomId);q.push([n.atomId,d+1]);}}return Infinity;};
  let overlap=0,worst=null;
  for(let a=0;a<item.g.atoms.length;a++)for(let b=a+1;b<item.g.atoms.length;b++){
    const d=graphDistance(a,b);if(d<=2)continue;const minimum=nonbondedDistance(item.g.atoms[a].element,item.g.atoms[b].element)*(d===3?.84:1),actual=p(a).distanceTo(p(b)),relative=1-actual/minimum;
    if(relative>overlap){overlap=relative;worst={a,b,d,actual,minimum};}
  }
  const again=preview(id);let regen=0;for(let i=0;i<item.view.atoms.length;i++)regen=Math.max(regen,p(i).distanceTo(again.view.atoms[i].point));
  return {
    id,cycle,
    planeMax:Math.max(...distances.map(Math.abs)),
    planeSigned:distances.map(v=>Number(v.toFixed(4))),
    bondRelative:Math.max(...bonds.map(b=>Math.abs(b.actual/b.target-1))),
    angles:angles.map(v=>Number(v.toFixed(2))),
    local:local.map(v=>Number(v.toFixed(2))),
    torsions:torsions.map(v=>Number(v.toFixed(2))),
    overlap:Number(overlap.toFixed(4)),worst,
    deterministic:regen,
  };
}
const report=[
  metrics('cyclopentane',5),
  metrics('tetrahydrofuran',5),
  metrics('cyclobutane',4),
  metrics('cyclohexane',6),
  metrics('benzene',6),
  metrics('furan',5),
];
for(const row of report){
  assert.ok(row.bondRelative<.12,`${row.id}: bond error ${row.bondRelative}`);
  assert.ok(row.overlap<.34,`${row.id}: severe overlap ${row.overlap}`);
  assert.ok(row.deterministic<1e-9,`${row.id}: nondeterministic regeneration`);
}
console.log(JSON.stringify(report,null,2));
