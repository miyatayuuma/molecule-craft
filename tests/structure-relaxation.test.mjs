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
const bonding = await importSource(new URL('../src/bonding-model.js?v=31', import.meta.url));
const { createStructureSolver } = await importSource(new URL('../src/structure-relaxation.js?v=32', import.meta.url));

function fixture(elements, bonds, coordinates) {
  const molecule = new chemistry.Molecule(), ids = elements.map(element => molecule.addAtom(element).id);
  bonds.forEach(([a,b,order]) => molecule.setBond(ids[a],ids[b],order));
  const placements = new Map(ids.map((id,index) => [id,{position:new Vector3(...coordinates[index])}]));
  const atomById = id => molecule.atoms.find(atom => atom.id === id);
  const bondBetween = (a,b) => molecule.bonds.find(bond => (bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a));
  const bondLengthFor = (a,b,order) => ((bonding.ATOMIC_MODEL[atomById(a).element]?.covalentRadius??.75)+(bonding.ATOMIC_MODEL[atomById(b).element]?.covalentRadius??.75))*.78*bonding.bondLengthScale(order);
  const geometryFor = id => bonding.geometryForAtom(molecule,id);
  const solver=createStructureSolver({THREE,molecule,placements,atomById,bondBetween,bondLengthFor,geometryFor,radiusFor:id=>chemistry.ELEMENTS[atomById(id).element].radius});
  return{molecule,ids,placements,solver,pos:index=>placements.get(ids[index]).position};
}

const angle=(a,center,b)=>a.clone().sub(center).angleTo(b.clone().sub(center))*180/Math.PI;
const centroid=points=>points.reduce((sum,point)=>sum.add(point),new Vector3()).multiplyScalar(1/points.length);
const planeSpread=(points,normal=new Vector3(0,0,1))=>{const center=centroid(points);return Math.max(...points.map(point=>Math.abs(point.clone().sub(center).dot(normal))));};
const relaxLikeApp=(solver,duration=1380)=>{for(let elapsed=0;elapsed<=duration;elapsed+=1000/60){const scale=elapsed<280?.76:elapsed<760?.54:.36;solver.step(scale,2);}};

{
  const item=fixture(['C','C','H','H','H','H'],[[0,1,2],[0,2,1],[0,3,1],[1,4,1],[1,5,1]],[[-.6,0,0],[.6,0,0],[-1,.75,0],[-1,-.75,0],[1,.75,0],[1,-.75,0]]);
  item.solver.rebuildTopology();assert.equal(item.solver.snapshot().doublePlanarGroups[0].length,6);
  assert.ok(item.solver.snapshot().doubleSubstituentSlots.every(endpoint=>new Set(endpoint.roots.map(root=>root.sign)).size===2),'Ethene hydrogens were not assigned distinct sp2 slots');
  item.pos(2).set(-.08,.18,1.1);item.pos(3).set(-.12,.12,-.7);item.solver.rebuildTopology();
  relaxLikeApp(item.solver);
  const ethenePlaneError=planeSpread(item.ids.map((_,index)=>item.pos(index)));
  assert.ok(ethenePlaneError<.025,`Ethene did not return all atoms to plane: ${ethenePlaneError}`);
  for(const [center,partner,left,right] of [[0,1,2,3],[1,0,4,5]]){
    const values=[angle(item.pos(partner),item.pos(center),item.pos(left)),angle(item.pos(partner),item.pos(center),item.pos(right)),angle(item.pos(left),item.pos(center),item.pos(right))];
    assert.ok(values.every(value=>Math.abs(value-120)<2),`Ethene sp2 angles at carbon ${center}: ${values.join(', ')}`);
    const axis=item.pos(partner).clone().sub(item.pos(center)).normalize(),side=new Vector3().crossVectors(new Vector3(0,0,1),axis).normalize();
    const sideProducts=item.pos(left).clone().sub(item.pos(center)).normalize().dot(side)*item.pos(right).clone().sub(item.pos(center)).normalize().dot(side);
    assert.ok(sideProducts<-.6,`Ethene hydrogens collapsed into the same in-plane slot at carbon ${center}`);
  }
}

{
  const elements=[...Array(6).fill('C'),...Array(6).fill('H')],bonds=[],coordinates=[];
  for(let index=0;index<6;index++){bonds.push([index,(index+1)%6,index%2===0?2:1]);bonds.push([index,index+6,1]);}
  for(const radius of[1,1.65])for(let index=0;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3)*radius,Math.sin(index*Math.PI/3)*radius,0]);
  const item=fixture(elements,bonds,coordinates);item.solver.rebuildTopology();assert.equal(item.solver.snapshot().aromaticPlanarGroups[0].length,12);item.pos(8).set(.05,.02,1.2);item.solver.rebuildTopology();
  relaxLikeApp(item.solver);
  assert.ok(planeSpread(item.ids.map((_,index)=>item.pos(index)))<.03,'Benzene substituent did not return to ring plane');
  const center=centroid([...Array(6)].map((_,index)=>item.pos(index)));
  for(let index=0;index<6;index++){
    const radial=item.pos(index).clone().sub(center).normalize(),bondDirection=item.pos(index+6).clone().sub(item.pos(index)).normalize();
    assert.ok(radial.dot(bondDirection)>.985,`Benzene hydrogen ${index} did not return outward`);
  }
}

{
  const elements=[...Array(6).fill('C'),...Array(5).fill('H'),'O','H'],bonds=[],coordinates=[];
  for(let index=0;index<6;index++)bonds.push([index,(index+1)%6,index%2===0?2:1]);
  for(let index=1;index<6;index++)bonds.push([index,index+5,1]);
  bonds.push([0,11,1],[11,12,1]);
  for(let index=0;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3),Math.sin(index*Math.PI/3),0]);
  for(let index=1;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3)*1.65,Math.sin(index*Math.PI/3)*1.65,0]);
  coordinates.push([1.7,0,0],[2.35,0,0]);
  const item=fixture(elements,bonds,coordinates);item.solver.rebuildTopology();
  const branchShift=new Vector3(-1.45,.18,.9);item.pos(11).add(branchShift);item.pos(12).add(branchShift);item.solver.rebuildTopology();
  relaxLikeApp(item.solver);
  const center=centroid([...Array(6)].map((_,index)=>item.pos(index))),radial=item.pos(0).clone().sub(center).normalize(),oxygenDirection=item.pos(11).clone().sub(item.pos(0)).normalize();
  assert.ok(radial.dot(oxygenDirection)>.985,'Phenol oxygen did not return outside the aromatic ring');
  const ringPlaneZ=centroid([...Array(6)].map((_,index)=>item.pos(index))).z;
  assert.ok(Math.abs(item.pos(11).z-ringPlaneZ)<.03,'Phenol oxygen did not return to the aromatic plane');
  assert.ok(Math.abs(item.pos(12).z-ringPlaneZ)<.05,'Phenol OH branch did not follow its oxygen back to the aromatic plane');
}

{
  const elements=[...Array(6).fill('C'),...Array(5).fill('H'),'O','C','H','H','H'],bonds=[],coordinates=[];
  for(let index=0;index<6;index++)bonds.push([index,(index+1)%6,index%2===0?2:1]);
  for(let index=1;index<6;index++)bonds.push([index,index+5,1]);
  bonds.push([0,11,1],[11,12,1],[12,13,1],[12,14,1],[12,15,1]);
  for(let index=0;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3),Math.sin(index*Math.PI/3),0]);
  for(let index=1;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3)*1.65,Math.sin(index*Math.PI/3)*1.65,0]);
  coordinates.push([1.75,0,0],[1.02,.03,.12],[.55,.62,.28],[.55,-.52,-.25],[.72,.02,.82]);
  const item=fixture(elements,bonds,coordinates);item.solver.rebuildTopology();
  const followerSlot=item.solver.snapshot().aromaticFollowerSlots.flatMap(group=>group.followers).find(follower=>follower.id===item.ids[12]);
  assert.ok(followerSlot&&Math.abs(followerSlot.sign)===1,'Anisole methyl branch did not receive a stable aromatic follower slot');
  relaxLikeApp(item.solver);
  const ringCenter=centroid([...Array(6)].map((_,index)=>item.pos(index))),ringPlaneZ=ringCenter.z;
  const arylOAngle=angle(item.pos(0),item.pos(11),item.pos(12));
  const nearestRingDistance=Math.min(...[...Array(6)].map((_,index)=>item.pos(12).distanceTo(item.pos(index))));
  assert.ok(arylOAngle>112,`Anisole C-O-C angle stayed folded at ${arylOAngle}`);
  assert.ok(nearestRingDistance>.9,`Anisole methyl carbon remained stacked on the ring at ${nearestRingDistance}`);
  assert.ok(Math.abs(item.pos(11).z-ringPlaneZ)<.04&&Math.abs(item.pos(12).z-ringPlaneZ)<.06,'Anisole C-O-C group did not return to the aromatic plane');
}

{
  const elements=[...Array(6).fill('C'),...Array(5).fill('H'),'N','H','H'],bonds=[],coordinates=[];
  for(let index=0;index<6;index++)bonds.push([index,(index+1)%6,index%2===0?2:1]);
  for(let index=1;index<6;index++)bonds.push([index,index+5,1]);
  bonds.push([0,11,1],[11,12,1],[11,13,1]);
  for(let index=0;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3),Math.sin(index*Math.PI/3),0]);
  for(let index=1;index<6;index++)coordinates.push([Math.cos(index*Math.PI/3)*1.65,Math.sin(index*Math.PI/3)*1.65,0]);
  coordinates.push([1.75,0,0],[1.05,.08,.2],[1.08,-.05,-.18]);
  const item=fixture(elements,bonds,coordinates);item.solver.rebuildTopology();
  const slots=item.solver.snapshot().aromaticFollowerSlots.flatMap(group=>group.followers).filter(follower=>follower.id===item.ids[12]||follower.id===item.ids[13]);
  assert.equal(new Set(slots.map(slot=>slot.sign)).size,2,'Aniline hydrogens did not receive distinct aromatic follower slots');
  relaxLikeApp(item.solver);
  assert.ok(angle(item.pos(0),item.pos(11),item.pos(12))>112&&angle(item.pos(0),item.pos(11),item.pos(13))>112,'Aniline N-H branches folded toward the ring');
  assert.ok(angle(item.pos(12),item.pos(11),item.pos(13))>112,'Aniline N-H branches collapsed into one slot');
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
