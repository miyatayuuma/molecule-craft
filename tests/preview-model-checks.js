import {createPreviewModel} from '../src/preview-model.js?v=30';
import {ATOMIC_MODEL,bondLengthScale} from '../src/bonding-model.js?v=30';

export function checkPreviewModels(THREE,records,templates){
  const assert=(condition,message)=>{if(!condition)throw new Error(message);};
  const snapshots=new Map();
  for(const record of [...records,...templates]){
    const original=JSON.stringify(record),model=createPreviewModel(THREE,record);
    for(let i=0;i<220;i++)model.step();
    const result=model.snapshot();
    assert(JSON.stringify(record)===original,`${record.id}: changed DB`);
    assert(result.atoms.length===record.atoms.length&&result.bonds.length===record.bonds.length,`${record.id}: changed topology`);
    assert(result.atoms.every(atom=>Number.isFinite(atom.point.x+atom.point.y+atom.point.z)),`${record.id}: invalid geometry`);
    assert(result.ports.length===(record.attachments??[]).reduce((sum,port)=>sum+port.slots,0),`${record.id}: incorrect ports`);
    assert(result.ports.every(port=>Number.isFinite(port.point.x+port.point.y+port.point.z)),`${record.id}: invalid port`);
    if(record.learningNote||['methyl','isopropyl','n-butyl'].includes(record.id))for(const bond of result.bonds){
      const a=result.atoms[bond.a],b=result.atoms[bond.b];
      const target=(ATOMIC_MODEL[a.element].covalentRadius+ATOMIC_MODEL[b.element].covalentRadius)*.78*bondLengthScale(bond.order);
      assert(Math.abs(a.point.distanceTo(b.point)-target)/target<.035,`${record.id}: stretched bond in new collection model`);
    }
    if(!record.attachments)snapshots.set(record.id,result);
  }
  const points=id=>snapshots.get(id)?.atoms.map(atom=>atom.point);
  for(const id of ['ethene','benzene']){
    const p=points(id);if(!p)continue;
    // Use a non-collinear triple so atom ordering does not define a fake plane.
    let normal=null;
    for(let i=2;i<p.length&&!normal;i++){const n=new THREE.Vector3().crossVectors(p[1].clone().sub(p[0]),p[i].clone().sub(p[0]));if(n.length()>.01)normal=n.normalize();}
    assert(normal&&p.every(point=>Math.abs(point.clone().sub(p[0]).dot(normal))<.05),`${id}: non-planar preview`);
  }
  const ethyne=points('ethyne');
  if(ethyne){const axis=ethyne[1].clone().sub(ethyne[0]).normalize();assert(ethyne.every(p=>new THREE.Vector3().crossVectors(p.clone().sub(ethyne[0]),axis).length()<.03),'ethyne: non-linear preview');}
  const methane=snapshots.get('methane');
  if(methane){
    const carbon=methane.atoms.find(a=>a.element==='C').point,hydrogen=methane.atoms.filter(a=>a.element==='H');
    for(let i=0;i<hydrogen.length;i++)for(let j=i+1;j<hydrogen.length;j++){
      const angle=hydrogen[i].point.clone().sub(carbon).angleTo(hydrogen[j].point.clone().sub(carbon))*180/Math.PI;
      assert(Math.abs(angle-109.47)<4,`methane: invalid tetrahedral angle ${angle}`);
    }
  }
  return `${records.length} molecules and ${templates.length} parts: independent finite 3D geometry, ports, sp/sp2/sp3 checks passed`;
}
