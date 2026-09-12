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

function build(elements, bonds) {
  const molecule = new chemistry.Molecule(), ids = elements.map(element => molecule.addAtom(element).id);
  for (const [a,b,order] of bonds) molecule.setBond(ids[a],ids[b],order);
  return { molecule, ids };
}

const degrees = geometry => geometry.angle * 180 / Math.PI;
const expectGeometry = (geometry, kind, angle, label) => {
  assert.equal(geometry.kind, kind, `${label} kind`);
  assert.ok(Math.abs(degrees(geometry)-angle) < 0.01, `${label} angle ${degrees(geometry)}`);
};

{
  const {molecule,ids}=build(['C','C','C'],[[0,1,1],[1,2,1]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[1]),'sp3',109.47,'two-single-bond carbon');
}
{
  const {molecule,ids}=build(['C','H','H','H'],[[0,1,1],[0,2,1],[0,3,1]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[0]),'sp3',109.47,'three-single-bond carbon');
}
{
  const {molecule,ids}=build(['C','H','H','H','H'],[[0,1,1],[0,2,1],[0,3,1],[0,4,1]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[0]),'sp3',109.47,'four-single-bond carbon');
}
{
  const {molecule,ids}=build(['C','C'],[[0,1,2]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[0]),'sp2',120,'one-double-bond carbon');
}
{
  const {molecule,ids}=build(['C','C','C'],[[0,1,2],[1,2,2]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[1]),'sp',180,'two-double-bond carbon');
}
{
  const {molecule,ids}=build(['H','C','C'],[[0,1,1],[1,2,3]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[1]),'sp',180,'triple-bond carbon');
}
{
  const {molecule,ids}=build(['O','H','H'],[[0,1,1],[0,2,1]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[0]),'sp3',104.5,'water oxygen');
}
{
  const {molecule,ids}=build(['N','H','H','H'],[[0,1,1],[0,2,1],[0,3,1]]);
  expectGeometry(bonding.geometryForAtom(molecule,ids[0]),'sp3',107,'ammonia nitrogen');
}

function solverFixture(elements, bonds, coordinates) {
  const {molecule,ids}=build(elements,bonds);
  const placements=new Map(ids.map((id,index)=>[id,{position:new Vector3(...coordinates[index])}]));
  const atomById=id=>molecule.atoms.find(atom=>atom.id===id);
  const bondBetween=(a,b)=>molecule.bonds.find(bond=>(bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a));
  const bondLengthFor=(a,b,order)=>((bonding.ATOMIC_MODEL[atomById(a).element]?.covalentRadius??.75)+(bonding.ATOMIC_MODEL[atomById(b).element]?.covalentRadius??.75))*.78*bonding.bondLengthScale(order);
  const geometryFor=id=>bonding.geometryForAtom(molecule,id);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,radiusFor:id=>chemistry.ELEMENTS[atomById(id).element].radius});
  return {molecule,ids,placements,solver,pos:index=>placements.get(ids[index]).position};
}

const angle=(a,center,b)=>a.clone().sub(center).angleTo(b.clone().sub(center))*180/Math.PI;
const settle=item=>{item.solver.rebuildTopology({resetFrames:true});for(let index=0;index<220;index++)item.solver.step(.8,2);};

{
  const item=solverFixture(['C','C','C'],[[0,1,1],[1,2,1]],[[-1,0,0],[0,0,0],[1,0,0]]);
  settle(item);
  const sp3Angle=angle(item.pos(0),item.pos(1),item.pos(2));
  assert.ok(Math.abs(sp3Angle-109.47)<3,`C-C-C did not settle toward provisional sp3: ${sp3Angle}`);

  item.molecule.setBond(item.ids[1],item.ids[2],2);
  settle(item);
  const sp2Angle=angle(item.pos(0),item.pos(1),item.pos(2));
  assert.equal(bonding.geometryForAtom(item.molecule,item.ids[1]).kind,'sp2');
  assert.ok(Math.abs(sp2Angle-120)<3,`C-C=C did not re-settle toward sp2: ${sp2Angle}`);

  item.molecule.setBond(item.ids[1],item.ids[0],2);
  settle(item);
  const spAngle=angle(item.pos(0),item.pos(1),item.pos(2));
  assert.equal(bonding.geometryForAtom(item.molecule,item.ids[1]).kind,'sp');
  assert.ok(Math.abs(spAngle-180)<3,`C=C=C did not re-settle toward sp: ${spAngle}`);
}

console.log('Incomplete carbon geometry classification and CRAFT-style topology settlement passed.');
