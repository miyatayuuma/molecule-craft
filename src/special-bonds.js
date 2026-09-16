import {supportedResonanceGroups} from './resonance-model.js?v=2';

// Qualitative resonance notation, not an electron trajectory or orbital density.
// Existing sulfur oxo groups keep their visual contract. Nitro and ozone can use
// an Encyclopedia-only three-center primitive while CRAFT retains its current
// interaction feedback and display contract.
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

// Encyclopedia three-center resonance grammar. The endpoints live on the two
// center-terminal bonds, never on the terminal atoms themselves, so the curve
// cannot read as a new terminal-terminal bond. The path depends only on the
// three atom positions, not on which Lewis contributor owns the double bond.
export function threeCenterResonanceCurve(THREE, group, positionFor) {
  if(!['nitro','ozone'].includes(group?.kind)||group.ends?.length!==2)return null;
  const center=positionFor(group.center),ends=group.ends.map(positionFor);
  if(!center||ends.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return null;
  const vectors=ends.map(end=>end.clone().sub(center)),lengths=vectors.map(v=>v.length());
  if(lengths.some(length=>length<1e-6))return null;
  const start=center.clone().addScaledVector(vectors[0],.56),finish=center.clone().addScaledVector(vectors[1],.56);
  const directions=vectors.map(v=>v.clone().normalize()),bisector=directions[0].clone().add(directions[1]);
  if(bisector.lengthSq()<1e-8){
    const axis=directions[0],reference=Math.abs(axis.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    bisector.crossVectors(reference,axis).normalize();
  }else bisector.normalize();
  const control=center.clone().addScaledVector(bisector,(lengths[0]+lengths[1])*.16);
  return Array.from({length:37},(_,index)=>{
    const t=index/36,u=1-t;
    return start.clone().multiplyScalar(u*u).addScaledVector(control,2*u*t).addScaledVector(finish,t*t);
  });
}

export function sharedBondCurves(THREE, group, positionFor, {mode='craft'}={}) {
  if(mode==='encyclopedia'&&['nitro','ozone'].includes(group?.kind)){
    const curve=threeCenterResonanceCurve(THREE,group,positionFor);return curve?[curve]:[];
  }
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
  const mode=options.mode??visual?.userData?.sharedBondDisplayMode??'craft',curves = sharedBondCurves(THREE,group,positionFor,{mode});
  visual.children.forEach((line,i) => {
    line.visible=!!curves[i];if (!curves[i]) return;
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
