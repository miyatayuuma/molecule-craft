import { ELEMENTS, modelAtomRadius } from './chemistry.js?v=20';
import { ATOMIC_MODEL, bondLengthScale, geometryForAtom, atomBondState, nonbondedDistance } from './bonding-model.js?v=31';
import { sharedOxoGroups } from './special-bonds.js?v=31';
import { seedCraftCoordinates } from './craft-structures.js?v=31';
import { createStructureSolver } from './structure-relaxation.js?v=32';
import { describeAlkeneRelativeSide } from './stereo-descriptor.js?v=1';

// A private graph, not a Molecule instance: opening the book cannot even consume
// the field's atom-id sequence. DB topology and player placements are read-only.
function branchIds(molecule,start,blockedId){
  const ids=new Set([start]),queue=[start];
  for(let index=0;index<queue.length;index++)for(const neighbor of molecule.neighbors(queue[index])){
    if(neighbor.atomId===blockedId||ids.has(neighbor.atomId))continue;
    ids.add(neighbor.atomId);queue.push(neighbor.atomId);
  }
  return ids;
}

function presentationDescriptor(molecule,placements,bonds){
  const supported=[];
  for(const bond of bonds){
    const descriptor=describeAlkeneRelativeSide(molecule,placements,bond);
    if(descriptor)supported.push({bond,descriptor});
  }
  return supported.length===1?supported[0]:null;
}

function flipSupportedAlkeneSide(THREE,molecule,placements,descriptor){
  const [partnerId,centerId]=descriptor.bondAtomIds,[,referenceId]=descriptor.referenceSubstituentIds;
  const center=placements.get(centerId)?.position,partner=placements.get(partnerId)?.position,reference=placements.get(referenceId)?.position;
  if(!center||!partner||!reference)return false;
  const axis=partner.clone().sub(center);if(axis.lengthSq()<1e-10)return false;axis.normalize();
  const planeNormal=reference.clone().sub(center).addScaledVector(axis,-reference.clone().sub(center).dot(axis));
  if(planeNormal.lengthSq()<1e-10)return false;planeNormal.normalize();
  const roots=molecule.neighbors(centerId).filter(neighbor=>neighbor.atomId!==partnerId).map(neighbor=>neighbor.atomId);
  const reflected=new Set(roots.flatMap(root=>[...branchIds(molecule,root,centerId)]));
  for(const id of reflected){
    const point=placements.get(id)?.position;if(!point)continue;
    const offset=point.clone().sub(center),distance=offset.dot(planeNormal);
    point.addScaledVector(planeNormal,-2*distance);
  }
  return true;
}

export function createPreviewModel(THREE, record,{presentation=null}={}) {
  const atoms=record.atoms.map((element,id)=>({id,element}));
  const bonds=record.bonds.map(([a,b,order])=>({a,b,order}));
  const adjacency=atoms.map(()=>[]);
  for(const {a,b,order} of bonds){adjacency[a].push({atomId:b,order});adjacency[b].push({atomId:a,order});}
  const molecule={atoms,bonds,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((sum,n)=>sum+n.order,0)};
  const seeds=seedCraftCoordinates({...record,attachments:record.attachments??[{atom:0}]});
  const placements=new Map(seeds.map((p,id)=>[id,{position:new THREE.Vector3(p.x,p.y,p.z)}]));
  const geometryFor=id=>geometryForAtom(molecule,id,record.attachments?.find(port=>port.atom===id)?.slots??0);
  const solver=createStructureSolver({THREE,molecule,placements,geometryFor,
    atomById:id=>atoms[id],bondBetween:(a,b)=>bonds.find(bond=>(bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a)),
    bondLengthFor:(a,b,order)=>(ATOMIC_MODEL[atoms[a].element].covalentRadius+ATOMIC_MODEL[atoms[b].element].covalentRadius)*.78*bondLengthScale(order),
    radiusFor:id=>ELEMENTS[atoms[id].element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(atoms[a].element,atoms[b].element),
  });
  let presentationPrepared=presentation?.kind!=='alkene-relative-side';
  function preparePresentationIfReady(){
    if(presentationPrepared)return;
    const target=presentationDescriptor(molecule,placements,bonds);if(!target)return;
    if(target.descriptor.relation!==presentation.relation){
      if(!flipSupportedAlkeneSide(THREE,molecule,placements,target.descriptor))throw new Error('Unable to prepare alkene relative-side presentation pose.');
      solver.rebuildTopology({resetFrames:true});
      const flipped=describeAlkeneRelativeSide(molecule,placements,target.bond);
      if(flipped?.relation!==presentation.relation)throw new Error('Prepared alkene pose does not match requested relation.');
    }
    presentationPrepared=true;
  }
  function snapshot(){
    const center=atoms.reduce((sum,atom)=>sum.add(placements.get(atom.id).position),new THREE.Vector3()).multiplyScalar(1/atoms.length);
    const points=atoms.map(atom=>placements.get(atom.id).position.clone().sub(center));
    const ports=[];
    for(const port of record.attachments??[]){
      const origin=points[port.atom],used=adjacency[port.atom].map(n=>points[n.atomId].clone().sub(origin).normalize());
      for(let slot=0;slot<port.slots;slot++){
        // Pick a direction far from all occupied bonds. No dummy atom is added
        // to recognition/geometry, and the marker is never a real electron.
        const preferred=used.reduce((sum,v)=>sum.sub(v),new THREE.Vector3());
        const choices=[];if(preferred.lengthSq()>1e-6)choices.push(preferred.normalize());
        for(let i=0;i<64;i++){const y=1-2*(i+.5)/64,r=Math.sqrt(1-y*y),a=i*2.3999632297;choices.push(new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a)));}
        choices.sort((a,b)=>Math.min(...used.map(v=>1-b.dot(v)))-Math.min(...used.map(v=>1-a.dot(v))));
        const direction=choices[0];used.push(direction);ports.push({atom:port.atom,start:origin.clone().addScaledVector(direction,modelAtomRadius(atoms[port.atom].element)+.012),point:origin.clone().addScaledVector(direction,.95)});
      }
    }
    const sharedGroups=sharedOxoGroups(molecule),hybridChargeAtoms=new Set(sharedGroups.filter(group=>['nitro','ozone'].includes(group.kind)).flatMap(group=>[group.center,...group.ends]));
    const centeredPlacements=new Map(points.map((point,id)=>[id,{position:point}]));
    const stereoTarget=presentation?.kind==='alkene-relative-side'?presentationDescriptor(molecule,centeredPlacements,bonds):null;
    const stereoDescriptor=stereoTarget?.descriptor??null;
    if(presentation?.kind==='alkene-relative-side'&&(!presentationPrepared||stereoDescriptor?.relation!==presentation.relation))throw new Error('Settled alkene pose no longer matches requested relation.');
    return {atoms:atoms.map((atom,id)=>({...atom,charge:hybridChargeAtoms.has(atom.id)?0:atomBondState(molecule,atom.id).charge,point:points[id]})),bonds:bonds.map(b=>({...b})),ports,aromaticCycles:solver.snapshot().aromaticCycles,sharedGroups,stereoDescriptor};
  }
  return {step:()=>{const movement=solver.step(.65,2);preparePresentationIfReady();return movement;},snapshot};
}
