import {supportedResonanceGroups} from './resonance-model.js?v=2';

// Qualitative resonance notation, not an electron trajectory or orbital density.
// Sulfur oxo groups keep their established curved-band contract. Nitro and ozone
// instead use one weak auxiliary bond-order component on each center-terminal bond.
function sulfurOxoGroups(molecule) {
  return molecule.atoms.filter(a => a.element === 'S').flatMap(atom => {
    const ns = molecule.neighbors(atom.id), used = molecule.bondOrderForAtom(atom.id);
    if (![4,6].includes(used)) return [];
    const ends = ns.filter(n => n.order === 2 && molecule.atoms.find(a => a.id === n.atomId)?.element === 'O' && molecule.neighbors(n.atomId).length === 1).map(n => n.atomId);
    return ends.length >= 2 ? [{ kind:'sulfur-oxo', center: atom.id, ends }] : [];
  });
}
export function sharedOxoGroups(molecule) { return [...sulfurOxoGroups(molecule),...supportedResonanceGroups(molecule)]; }
export const specialEdgeKeys = groups => new Set(groups.flatMap(g => g.ends.map(id => `${Math.min(g.center,id)}:${Math.max(g.center,id)}`)));

function legacySharedBondCurves(THREE, group, positionFor) {
  const center = positionFor(group.center), points = group.ends.map(positionFor);
  if (!center || points.some(p => !p || ![p.x,p.y,p.z].every(Number.isFinite))) return [];
  const first = points[0].clone().sub(center), second = points[1].clone().sub(center);
  const normal = new THREE.Vector3().crossVectors(first, second);
  if (normal.lengthSq() < 1e-9) normal.crossVectors(first, Math.abs(first.z) < .8 * first.length() ? new THREE.Vector3(0,0,1) : new THREE.Vector3(0,1,0));
  normal.normalize();
  return points.flatMap(end => {
    const axis = end.clone().sub(center), side = new THREE.Vector3().crossVectors(normal, axis).normalize();
    return [-1,1].map(sign => Array.from({length:25}, (_,i) => {
      const t = .22 + .56*i/24;
      return center.clone().addScaledVector(axis,t).addScaledVector(side,sign*.14*Math.sin(Math.PI*i/24));
    }));
  });
}

// Nitro / ozone resonance hybrid grammar. Each returned line stays parallel to
// exactly one center-terminal bond and is offset toward the inside of the
// three-atom region. The two terminal atoms are never connected to each other.
export function distributedResonanceBondLines(THREE, group, positionFor) {
  if(!['nitro','ozone'].includes(group?.kind)||group.ends?.length!==2)return [];
  const center=positionFor(group.center),ends=group.ends.map(positionFor);
  if(!center||ends.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return [];
  const vectors=ends.map(end=>end.clone().sub(center)),lengths=vectors.map(vector=>vector.length());
  if(lengths.some(length=>length<1e-6))return [];
  const directions=vectors.map(vector=>vector.clone().normalize());
  const normal=new THREE.Vector3().crossVectors(vectors[0],vectors[1]);
  if(normal.lengthSq()<1e-9){
    const axis=directions[0],reference=Math.abs(axis.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    normal.crossVectors(axis,reference);
    if(normal.lengthSq()<1e-9)normal.crossVectors(axis,new THREE.Vector3(1,0,0));
  }
  normal.normalize();
  const offset=Math.min(...lengths)*.095;
  return vectors.map((axis,index)=>{
    const inside=new THREE.Vector3().crossVectors(normal,directions[index]).normalize(),other=directions[1-index];
    if(inside.dot(other)<0)inside.negate();
    return Array.from({length:25},(_,i)=>{
      const t=.24+.52*i/24;
      return center.clone().addScaledVector(axis,t).addScaledVector(inside,offset);
    });
  });
}

export function sharedBondCurves(THREE, group, positionFor, {mode='craft'}={}) {
  if(['nitro','ozone'].includes(group?.kind))return distributedResonanceBondLines(THREE,group,positionFor);
  return legacySharedBondCurves(THREE,group,positionFor);
}

export function createSharedBonds(THREE, own = x => x, {mode='craft'}={}) {
  const group = new THREE.Group();group.userData.sharedBondDisplayMode=mode;
  for (let i=0;i<6;i++) {
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(111),3));
    const material = own(new THREE.LineBasicMaterial({color:0x8ce7ee,transparent:true,opacity:mode==='encyclopedia'?.82:.65,depthWrite:false}));
    const line = new THREE.Line(geometry,material);line.frustumCulled=false;group.add(line);
  }
  return group;
}
export function updateSharedBonds(THREE, visual, group, positionFor, options={}) {
  const mode=options.mode??visual?.userData?.sharedBondDisplayMode??'craft',curves = sharedBondCurves(THREE,group,positionFor,{mode}),distributed=['nitro','ozone'].includes(group?.kind);
  visual.children.forEach((line,i) => {
    line.visible=!!curves[i];if (!curves[i]) return;
    if(line.material?.color){line.material.color.setHex(distributed?0x9eafc5:0x8ce7ee);line.material.opacity=distributed?(mode==='encyclopedia'?.56:.5):(mode==='encyclopedia'?.82:.65);}
    line.userData.resonanceVisual=distributed?'distributed-bond-component':'shared-oxo-band';
    line.userData.resonanceBranch=distributed?i:null;
    const positions=line.geometry.attributes.position;
    for(let j=0;j<positions.count;j++){
      const point=curves[i][Math.min(j,curves[i].length-1)];positions.setXYZ(j,point.x,point.y,point.z);
    }
    positions.needsUpdate=true;line.geometry.setDrawRange(0,curves[i].length);
  });
}

export function createChargeLabel(THREE, charge, owner = document, own = x => x) {
  const canvas=owner.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d');context.fillStyle='#e5f8ff';context.font='bold 52px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(charge>0?'+':'−',32,34);
  const texture=own(new THREE.CanvasTexture(canvas));
  const material=own(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));
  const sprite=new THREE.Sprite(material);sprite.scale.set(.26,.26,1);sprite.renderOrder=8;sprite.userData.formalCharge=charge;
  return sprite;
}
