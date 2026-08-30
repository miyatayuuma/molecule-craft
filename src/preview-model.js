import { ELEMENTS } from './chemistry.js?v=20';
import { ATOMIC_MODEL, bondLengthScale, idealBondAngleDeg } from './bonding-model.js';
import { seedCraftCoordinates } from './craft-structures.js?v=21';
import { createStructureSolver } from './structure-relaxation.js?v=24';

// A private graph, not a Molecule instance: opening the book cannot even consume
// the field's atom-id sequence. DB topology and player placements are read-only.
export function createPreviewModel(THREE, record) {
  const atoms=record.atoms.map((element,id)=>({id,element}));
  const bonds=record.bonds.map(([a,b,order])=>({a,b,order}));
  const adjacency=atoms.map(()=>[]);
  for(const {a,b,order} of bonds){adjacency[a].push({atomId:b,order});adjacency[b].push({atomId:a,order});}
  const molecule={atoms,bonds,neighbors:id=>adjacency[id],bondOrderForAtom:id=>adjacency[id].reduce((sum,n)=>sum+n.order,0)};
  const seeds=seedCraftCoordinates({...record,attachments:record.attachments??[{atom:0}]});
  const placements=new Map(seeds.map((p,id)=>[id,{position:new THREE.Vector3(p.x,p.y,p.z)}]));
  const geometryFor=id=>{
    const ns=adjacency[id],orders=ns.map(n=>n.order),doubles=orders.filter(order=>order===2).length;
    if(orders.includes(3)||doubles>=2)return {kind:'sp',angle:Math.PI};
    if(doubles===1)return {kind:'sp2',angle:Math.PI*2/3};
    // Open single-bond ports are electron domains too. The visible part must not
    // turn vinyl into a bent alkyne or flatten methoxy's methyl carbon.
    const ports=record.attachments?.find(port=>port.atom===id)?.slots??0;
    const degrees=idealBondAngleDeg(atoms[id].element,molecule.bondOrderForAtom(id)+ports,ns.length+ports);
    return {kind:degrees>=175?'linear':degrees>=116?'trigonal':'sp3',angle:degrees*Math.PI/180};
  };
  const solver=createStructureSolver({THREE,molecule,placements,geometryFor,
    atomById:id=>atoms[id],bondBetween:(a,b)=>bonds.find(bond=>(bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a)),
    bondLengthFor:(a,b,order)=>(ATOMIC_MODEL[atoms[a].element].covalentRadius+ATOMIC_MODEL[atoms[b].element].covalentRadius)*.78*bondLengthScale(order),
    radiusFor:id=>ELEMENTS[atoms[id].element].radius,
  });
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
        const direction=choices[0];used.push(direction);ports.push({atom:port.atom,point:origin.clone().addScaledVector(direction,.95)});
      }
    }
    return {atoms:atoms.map((atom,id)=>({...atom,point:points[id]})),bonds:bonds.map(b=>({...b})),ports,aromaticCycles:solver.snapshot().aromaticCycles};
  }
  return {step:()=>solver.step(.65,2),snapshot};
}
