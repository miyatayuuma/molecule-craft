// Qualitative resonance notation, not an electron trajectory or orbital density.
// Only equivalent terminal oxo bonds are grouped; S–OH is never included.
export function sharedOxoGroups(molecule) {
  return molecule.atoms.filter(a => a.element === 'S').flatMap(atom => {
    const ns = molecule.neighbors(atom.id), used = molecule.bondOrderForAtom(atom.id);
    if (![4,6].includes(used)) return [];
    const ends = ns.filter(n => n.order === 2 && molecule.atoms.find(a => a.id === n.atomId)?.element === 'O' && molecule.neighbors(n.atomId).length === 1).map(n => n.atomId);
    return ends.length >= 2 ? [{ center: atom.id, ends }] : [];
  });
}
export const specialEdgeKeys = groups => new Set(groups.flatMap(g => g.ends.map(id => `${Math.min(g.center,id)}:${Math.max(g.center,id)}`)));

export function sharedBondCurves(THREE, group, positionFor) {
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

export function createSharedBonds(THREE, own = x => x) {
  const group = new THREE.Group();
  for (let i=0;i<6;i++) {
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(75),3));
    const material = own(new THREE.LineBasicMaterial({color:0x8ce7ee,transparent:true,opacity:.65,depthWrite:false}));
    const line = new THREE.Line(geometry,material);line.frustumCulled=false;group.add(line);
  }
  return group;
}
export function updateSharedBonds(THREE, visual, group, positionFor) {
  const curves = sharedBondCurves(THREE,group,positionFor);
  visual.children.forEach((line,i) => {
    line.visible=!!curves[i];if (!curves[i]) return;
    const positions=line.geometry.attributes.position;
    curves[i].forEach((point,j)=>positions.setXYZ(j,point.x,point.y,point.z));positions.needsUpdate=true;
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
