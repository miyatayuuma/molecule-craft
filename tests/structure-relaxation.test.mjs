import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new Vector3(this.x, this.y, this.z); }
  copy(other) { return this.set(other.x, other.y, other.z); }
  add(other) { this.x += other.x; this.y += other.y; this.z += other.z; return this; }
  sub(other) { this.x -= other.x; this.y -= other.y; this.z -= other.z; return this; }
  addScaledVector(other, scale) { this.x += other.x * scale; this.y += other.y * scale; this.z += other.z * scale; return this; }
  multiplyScalar(scale) { this.x *= scale; this.y *= scale; this.z *= scale; return this; }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  normalize() { const length = this.length(); return length > 0 ? this.multiplyScalar(1 / length) : this; }
  dot(other) { return this.x * other.x + this.y * other.y + this.z * other.z; }
  crossVectors(a, b) { return this.set(a.y*b.z-a.z*b.y, a.z*b.x-a.x*b.z, a.x*b.y-a.y*b.x); }
  distanceTo(other) { return this.clone().sub(other).length(); }
  lerp(other, alpha) { this.x += (other.x-this.x)*alpha; this.y += (other.y-this.y)*alpha; this.z += (other.z-this.z)*alpha; return this; }
  angleTo(other) { const denominator = Math.sqrt(this.lengthSq()*other.lengthSq()); return denominator === 0 ? Math.PI/2 : Math.acos(Math.min(1,Math.max(-1,this.dot(other)/denominator))); }
  applyAxisAngle(axis, angle) {
    const unit = axis.clone().normalize(), cos = Math.cos(angle), sin = Math.sin(angle), dot = this.dot(unit), cross = new Vector3().crossVectors(unit, this);
    return this.multiplyScalar(cos).addScaledVector(cross, sin).addScaledVector(unit, dot*(1-cos));
  }
  applyQuaternion(q) {
    const x=this.x,y=this.y,z=this.z,qx=q.x,qy=q.y,qz=q.z,qw=q.w;
    const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;
    return this.set(ix*qw+iw*-qx+iy*-qz-iz*-qy,iy*qw+iw*-qy+iz*-qx-ix*-qz,iz*qw+iw*-qz+ix*-qy-iy*-qx);
  }
}

const THREE = { Vector3, MathUtils: { clamp: (value,min,max) => Math.min(max,Math.max(min,value)), degToRad: degrees => degrees*Math.PI/180 } };
const importSource = async path => import(`data:text/javascript;base64,${Buffer.from(await readFile(path,'utf8')).toString('base64')}`);
const chemistry = await importSource(new URL('../src/chemistry.js', import.meta.url));
const bonding = await importSource(new URL('../src/bonding-model.js', import.meta.url));
const { createStructureSolver } = await importSource(new URL('../src/structure-relaxation.js', import.meta.url));

function fixture(elements, bonds, coordinates) {
  const molecule = new chemistry.Molecule(), ids = elements.map(element => molecule.addAtom(element).id);
  bonds.forEach(([a,b,order]) => molecule.setBond(ids[a],ids[b],order));
  const placements = new Map(ids.map((id,index) => [id,{position:new Vector3(...coordinates[index])}]));
  const atomById = id => molecule.atoms.find(atom => atom.id === id);
  const bondBetween = (a,b) => molecule.bonds.find(bond => (bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a));
  const bondLengthFor = (a,b,order) => ((bonding.ATOMIC_MODEL[atomById(a).element]?.covalentRadius??.75)+(bonding.ATOMIC_MODEL[atomById(b).element]?.covalentRadius??.75))*.78*bonding.bondLengthScale(order);
  const geometryFor = id => {
    const atom=atomById(id),neighbors=molecule.neighbors(id),orders=neighbors.map(item=>item.order),doubleCount=orders.filter(order=>order===2).length;
    if(orders.some(order=>order===3)||doubleCount>=2)return{kind:'sp',angle:Math.PI};
    if(doubleCount===1)return{kind:'sp2',angle:2*Math.PI/3};
    const degrees=bonding.idealBondAngleDeg(atom.element,molecule.bondOrderForAtom(id),neighbors.length);
    return{kind:degrees>=175?'linear':degrees>=116?'trigonal':'sp3',angle:degrees*Math.PI/180};
  };
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,radiusFor:id=>chemistry.ELEMENTS[atomById(id).element].radius});
  return{molecule,ids,placements,solver,pos:index=>placements.get(ids[index]).position};
}

const angle=(a,center,b)=>a.clone().sub(center).angleTo(b.clone().sub(center))*180/Math.PI;

{
  const item=fixture(['C','C','H','H','H','H'],[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]],[[-.6,0,0],[.6,0,0],[-1,.75,0],[-1,-.75,0],[1,.75,0],[1,-.75,0]]);
  item.solver.rebuildTopology();assert.equal(item.solver.snapshot().doublePlanarGroups[0].length,6);item.pos(2).z=1.1;
  for(let index=0;index<180;index++)item.solver.step(.8,2);
  assert.ok(Math.max(...item.ids.map((_,index)=>Math.abs(item.pos(index).z)))<.025,'Ethene did not return all atoms to plane');
}

{
  const elements=[...Array(6).fill('C'),...Array(6).fill('H')],bonds=[],coordinates=[];
  for(let index=0;index<6;index++){bonds.push([index,(index+1)%6,index%2===0?2:1]);bonds.push([index,index+6,1]);}
  for(const radius of[1,1.65])for(let index=0;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3)*radius,Math.sin(index*Math.PI/3)*radius,0]);
  const item=fixture(elements,bonds,coordinates);item.solver.rebuildTopology();assert.equal(item.solver.snapshot().aromaticPlanarGroups[0].length,12);item.pos(8).z=1.2;
  for(let index=0;index<200;index++)item.solver.step(.8,2);
  assert.ok(Math.max(...item.ids.map((_,index)=>Math.abs(item.pos(index).z)))<.03,'Benzene substituent did not return to ring plane');
}

{
  const item=fixture(['C','C','H','H'],[[0,1,3],[0,2,1],[1,3,1]],[[-.55,0,0],[.55,0,0],[-1.25,.65,0],[1.25,-.55,0]]);
  item.solver.rebuildTopology();for(let index=0;index<180;index++)item.solver.step(.8,2);
  const left=angle(item.pos(2),item.pos(0),item.pos(1)),right=angle(item.pos(0),item.pos(1),item.pos(3));
  assert.ok(Math.abs(left-180)<1.5,`Left ethyne angle ${left}`);
  assert.ok(Math.abs(right-180)<1.5,`Right ethyne angle ${right}`);
}

{
  const tetra=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]].map(values=>new Vector3(...values).normalize().multiplyScalar(1.1));
  const item=fixture(['C','H','H','H','H'],[[0,1,1],[0,2,1],[0,3,1],[0,4,1]],[[0,0,0],...tetra.map(vector=>[vector.x,vector.y,vector.z])]);
  item.pos(1).add(new Vector3(.35,-.25,.2));item.solver.rebuildTopology();for(let index=0;index<160;index++)item.solver.step(.7,2);
  const angles=[];for(let left=1;left<5;left++)for(let right=left+1;right<5;right++)angles.push(angle(item.pos(left),item.pos(0),item.pos(right)));
  assert.ok(angles.every(value=>Math.abs(value-109.47)<3.5),`Methane angles: ${Math.min(...angles)}–${Math.max(...angles)}`);
}

console.log('Structure relaxation tests passed.');
