import * as THREE from '../vendor/three/three.module.min.js';
import {createPolymerReferenceModel,polymerReferenceDefinition} from './polymer-reference-model.js';
import {createCollectionViewer} from './collection-viewer.js?v=42';

// Shared read-only 3D model for Collection thumbnails and detailed rotation.
// Each layout uses real atoms, bonds and XYZ from the same approved reference
// chain used by Reaction Lab; finite PolymerSamples are never read or edited.
const layouts=new Map();
export const hasPolymerUnitPreview=id=>!!polymerReferenceDefinition(id);
const VIEWS={
  polyethylene:{yaw:.54,pitch:.36,roll:1.41,zoom:1.12},
  'polyethylene-terephthalate':{yaw:-1.71,pitch:.08,roll:.83,zoom:1.04},
  'phenol-formaldehyde-resin':{yaw:.46,pitch:.32,roll:0,zoom:1.08},
};


// A terminal marker represents the next repeat's bond, not an extra atom.
// The approved PET reference pose has one outside carbonyl positioned inside
// the neighboring benzene ring. Preserve all actual atoms/bonds and the 116°
// ester oxygen bond angle, but rotate that virtual continuation away from the
// aromatic ring so the local repeating unit reads as an extended chain.
function spreadPetContinuationPorts(THREE,layout){
  const ring=layout.aromaticCycles[0];if(!ring)return;
  const ringCenter=ring.reduce((sum,id)=>sum.add(layout.atoms[id].point),new THREE.Vector3()).multiplyScalar(1/ring.length);
  for(const port of layout.ports){
    if(Math.min(...ring.map(id=>port.point.distanceTo(layout.atoms[id].point)))>=1.1)continue;
    const neighbor=layout.bonds.find(bond=>bond.a===port.atom||bond.b===port.atom);
    if(!neighbor||layout.atoms[port.atom].element!=='O')continue;
    const inner=layout.atoms[neighbor.a===port.atom?neighbor.b:neighbor.a];
    if(inner.element!=='C')continue;
    const inward=inner.point.clone().sub(port.start).normalize();
    const outward=port.start.clone().sub(ringCenter);
    outward.addScaledVector(inward,-outward.dot(inward));
    if(outward.lengthSq()<1e-8)continue;
    outward.normalize();
    const bend=116*Math.PI/180,length=port.point.distanceTo(port.start);
    const direction=inward.multiplyScalar(Math.cos(bend)).addScaledVector(outward,Math.sin(bend));
    port.point=port.start.clone().addScaledVector(direction,length);
  }
}

export function createPolymerUnitLayout(THREE,polymerId){
  if(!hasPolymerUnitPreview(polymerId))throw new RangeError('Unsupported polymer reference');
  if(layouts.has(polymerId))return layouts.get(polymerId);
  // Butyl rubber needs an interior low-frequency isoprene site; the standard
  // 10-unit display would place it only at the capped terminal unit.
  const referenceUnits=polymerId==='butyl-rubber'?30:10;
  const plan=createPolymerReferenceModel(THREE,polymerId,referenceUnits),selected=new Set(),outgoing=[];
  let sourceUnits=[4],componentSequence=null;
  if(Array.isArray(plan.sequence)){
    const candidates=[];
    for(let i=1;i<plan.sequence.length-2;i++)if(plan.sequence[i]!==plan.sequence[i+1])candidates.push(i);
    if(!candidates.length)throw new Error(polymerId+': copolymer reference has no distinct adjacent components');
    candidates.sort((a,b)=>Math.abs(a+.5-plan.sequence.length/2)-Math.abs(b+.5-plan.sequence.length/2));
    sourceUnits=[candidates[0],candidates[0]+1];
    componentSequence=sourceUnits.map(i=>plan.sequence[i]);
  }
  if(polymerId!=='phenol-formaldehyde-resin'){
    plan.atoms.forEach((atom,i)=>{if(sourceUnits.includes(atom.unit))selected.add(i);});
    for(const bond of plan.bonds){
      const a=selected.has(bond.a),b=selected.has(bond.b);
      if(a!==b)outgoing.push({atom:a?bond.a:bond.b,toward:a?bond.b:bond.a,order:bond.order});
    }
  }else{
    // A ring with its actual three methylene links is the local network motif.
    sourceUnits=[0];
    plan.atoms.forEach((atom,i)=>{if(atom.unit===0)selected.add(i);});
    const bridges=plan.bridges.filter(bridge=>bridge.rings.includes(0));
    if(bridges.length!==3||bridges.some(bridge=>bridge.rings[0]!==0))throw new Error('Phenolic preview requires three central ring bridges');
    for(const bridge of bridges){
      selected.add(bridge.atom);
      for(const bond of plan.bonds){
        const other=bond.a===bridge.atom?bond.b:bond.b===bridge.atom?bond.a:-1;
        if(other>=0&&plan.atoms[other].element==='H')selected.add(other);
      }
      const outside=plan.bonds.flatMap(bond=>bond.a===bridge.atom?[bond.b]:bond.b===bridge.atom?[bond.a]:[])
        .find(i=>plan.atoms[i].element==='C'&&!selected.has(i)&&plan.atoms[i].unit!==0);
      if(outside===undefined)throw new Error('Phenolic bridge lacks its outgoing aromatic bond');
      outgoing.push({atom:bridge.atom,toward:outside,order:1});
    }
  }
  const expectedPorts=polymerId==='phenol-formaldehyde-resin'?3:2;
  if(!selected.size||outgoing.length!==expectedPorts||outgoing.some(port=>port.order!==1))throw new Error(polymerId+': invalid polymer unit boundaries');
  const ids=[...selected],local=new Map(ids.map((id,index)=>[id,index]));
  const atoms=ids.map(i=>plan.atoms[i]);
  const extent=[...atoms,...outgoing.map(port=>plan.atoms[port.toward])];
  const center=new THREE.Vector3(
    (Math.min(...extent.map(a=>a.x))+Math.max(...extent.map(a=>a.x)))/2,
    (Math.min(...extent.map(a=>a.y))+Math.max(...extent.map(a=>a.y)))/2,
    (Math.min(...extent.map(a=>a.z))+Math.max(...extent.map(a=>a.z)))/2
  );
  const point=a=>new THREE.Vector3(a.x,a.y,a.z).sub(center);
  const layout={
    atoms:atoms.map(atom=>({element:atom.element,charge:0,point:point(atom)})),
    bonds:plan.bonds.filter(bond=>local.has(bond.a)&&local.has(bond.b))
      .map(bond=>({a:local.get(bond.a),b:local.get(bond.b),order:bond.order})),
    ports:outgoing.map(port=>({
      atom:local.get(port.atom),
      start:point(plan.atoms[port.atom]),
      point:point(plan.atoms[port.toward]),
    })),
    aromaticCycles:(plan.aromaticCycles??[]).filter(cycle=>cycle.every(id=>local.has(id)))
      .map(cycle=>cycle.map(id=>local.get(id))),
    sharedGroups:[],
    stereoDescriptor:null,
    sourceUnits,
    componentSequence,
  };
  if(layout.bonds.some(bond=>bond.a===undefined||bond.b===undefined)||layout.ports.some(port=>port.atom===undefined))throw new Error('Incomplete polymer preview graph');
  if(polymerId==='polyethylene-terephthalate')spreadPetContinuationPorts(THREE,layout);
  layouts.set(polymerId,layout);
  return layout;
}

export function mountPolymerUnitPreview({host,polymerId,name,compact=false,onReady=()=>{},onThumbnail=()=>{}}){
  const layout=createPolymerUnitLayout(THREE,polymerId);
  const record={atoms:layout.atoms.map(atom=>({element:atom.element})),bonds:layout.bonds,attachments:[]};
  return createCollectionViewer({
    host,record,name,fixedLayout:layout,initialView:VIEWS[polymerId]??null,
    portColor:0x48d9ff,showGestureHint:!compact,compact,onReady,onThumbnail,
  });
}
