import {structuralOxoGroups} from './structural-groups.js?v=1';
import {AROMATIC_STYLE} from './aromatic-rendering.js?v=27';

// Qualitative distributed-bond notation, not a numerical fractional bond order.
export const RESONANCE_STYLE=Object.freeze({
  color:AROMATIC_STYLE.color,
  cssColor:AROMATIC_STYLE.cssColor,
  assetCssColor:AROMATIC_STYLE.assetCssColor,
  opacity:.68,
  offset:.13,
  start:.20,
  end:.80,
  dashCount:4,
  dashGapRatio:.65,
  craftRadius:.022,
  encyclopediaRadius:.045,
});
export const SULFUR_OXO_STYLE=Object.freeze({
  color:AROMATIC_STYLE.color,
  cssColor:AROMATIC_STYLE.cssColor,
  spanStart:.20,
  spanEnd:.80,
  craftRadius:.072,
  encyclopediaRadius:.096,
  opacity:.18,
});

export function sharedOxoGroups(molecule) { return structuralOxoGroups(molecule); }
export const specialEdgeKeys = groups => new Set(groups.flatMap(g => g.ends.map(id => `${Math.min(g.center,id)}:${Math.max(g.center,id)}`)));

// Parallel dashed contributors are reserved for Nitro / Ozone resonance.
export function distributedBondLines(THREE, group, positionFor) {
  if(!['nitro','ozone'].includes(group?.kind)||!group?.ends||group.ends.length<2)return [];
  const center=positionFor(group.center),ends=group.ends.map(positionFor);
  if(!center||ends.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return [];
  const vectors=ends.map(end=>end.clone().sub(center)),lengths=vectors.map(vector=>vector.length());
  if(lengths.some(length=>length<1e-6))return [];
  const normal=new THREE.Vector3();let area=0;
  for(let a=0;a<vectors.length;a++)for(let b=a+1;b<vectors.length;b++){
    const candidate=new THREE.Vector3().crossVectors(vectors[a],vectors[b]);
    if(candidate.lengthSq()>area){area=candidate.lengthSq();normal.copy(candidate);}
  }
  if(normal.lengthSq()<1e-9){
    const axis=vectors[0].clone().normalize(),reference=Math.abs(axis.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    normal.crossVectors(axis,reference);if(normal.lengthSq()<1e-9)normal.crossVectors(axis,new THREE.Vector3(1,0,0));
  }
  normal.normalize();
  const offset=Math.min(RESONANCE_STYLE.offset,Math.min(...lengths)*.10);
  return vectors.map((axis,index)=>{
    const direction=axis.clone().normalize(),inside=new THREE.Vector3().crossVectors(normal,direction).normalize();
    const projected=ends.map((point,otherIndex)=>({point,otherIndex})).filter(item=>item.otherIndex!==index)
      .map(item=>item.point.clone().sub(center).addScaledVector(direction,-item.point.clone().sub(center).dot(direction)))
      .sort((a,b)=>b.lengthSq()-a.lengthSq());
    const toward=projected.find(vector=>vector.lengthSq()>1e-9);
    if(toward&&inside.dot(toward)<0)inside.negate();
    return [RESONANCE_STYLE.start,RESONANCE_STYLE.end].map(t=>center.clone().addScaledVector(axis,t).addScaledVector(inside,offset));
  });
}

// Sulfur-oxo bonding is shown by a translucent sleeve centered on each
// terminal S–O bond axis. The sleeve is qualitative: it is neither another
// bond line nor a fractional bond-order or orbital drawing.
export function sulfurOxoBondAxes(THREE, group, positionFor) {
  if(group?.kind!=='sulfur-oxo'||!group?.ends?.length)return [];
  const center=positionFor(group.center);
  if(!center||![center.x,center.y,center.z].every(Number.isFinite))return [];
  return group.ends.flatMap((id,branch)=>{
    const end=positionFor(id);
    if(!end||![end.x,end.y,end.z].every(Number.isFinite))return [];
    const axis=end.clone().sub(center);
    if(axis.length()<1e-6)return [];
    return [{branch,atomId:id,start:center.clone().addScaledVector(axis,SULFUR_OXO_STYLE.spanStart),end:center.clone().addScaledVector(axis,SULFUR_OXO_STYLE.spanEnd)}];
  });
}

export function sharedBondCurves(THREE, group, positionFor, {mode='craft'}={}) {
  return distributedBondLines(THREE,group,positionFor);
}

function placeDash(THREE,mesh,a,b,radius){
  const delta=b.clone().sub(a),length=delta.length();mesh.visible=length>1e-6;if(!mesh.visible)return;
  mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.scale.set(radius,length,radius);
}
function placeSleeve(THREE,mesh,start,end,radius){
  const delta=end.clone().sub(start),length=delta.length();mesh.visible=length>1e-6;if(!mesh.visible)return;
  mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());mesh.scale.set(radius,length,radius);
}

export function createSharedBonds(THREE, own = x => x, {mode='craft'}={}) {
  const group = new THREE.Group();group.userData.sharedBondDisplayMode=mode;
  for(let branch=0;branch<3;branch++)for(let dash=0;dash<RESONANCE_STYLE.dashCount;dash++){
    const geometry=own(new THREE.CylinderGeometry(1,1,1,8));
    const material=own(new THREE.MeshBasicMaterial({color:RESONANCE_STYLE.color,transparent:true,opacity:RESONANCE_STYLE.opacity,depthWrite:false}));
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.userData.distributedBondComponent=true;mesh.userData.distributedBondStyle='distributed-dashed';mesh.userData.distributedBondBranch=branch;mesh.userData.distributedBondDash=dash;mesh.userData.distributedBondLineWidth='bond';group.add(mesh);
  }
  for(let branch=0;branch<3;branch++){
    const geometry=own(new THREE.CylinderGeometry(1,1,1,16,1,true));
    const material=own(new THREE.MeshBasicMaterial({color:SULFUR_OXO_STYLE.color,transparent:true,opacity:SULFUR_OXO_STYLE.opacity,depthWrite:false,side:THREE.DoubleSide}));
    const mesh=new THREE.Mesh(geometry,material);mesh.visible=false;mesh.userData.sulfurOxoHalo=true;mesh.userData.sulfurOxoStyle='bond-axis-halo';mesh.userData.sulfurOxoBranch=branch;mesh.userData.baseOpacity=SULFUR_OXO_STYLE.opacity;mesh.renderOrder=1;group.add(mesh);
  }
  return group;
}
export function updateSharedBonds(THREE, visual, group, positionFor, options={}) {
  const mode=options.mode??visual?.userData?.sharedBondDisplayMode??'craft',curves=sharedBondCurves(THREE,group,positionFor,{mode}),axes=sulfurOxoBondAxes(THREE,group,positionFor),distributed=curves.length>=2;
  const dashMeshes=visual.children.filter(item=>item.userData.distributedBondComponent);
  const sleeves=visual.children.filter(item=>item.userData.sulfurOxoHalo);
  const radius=mode==='encyclopedia'?RESONANCE_STYLE.encyclopediaRadius:RESONANCE_STYLE.craftRadius;
  if(distributed){
    dashMeshes.forEach(mesh=>{mesh.visible=false;mesh.material.color.setHex(RESONANCE_STYLE.color);mesh.material.opacity=RESONANCE_STYLE.opacity;});
    sleeves.forEach(mesh=>{mesh.visible=false;});
    curves.forEach((curve,branch)=>{
      if(curve.length<2)return;const start=curve[0],end=curve.at(-1),axis=end.clone().sub(start),length=axis.length();if(length<1e-6)return;axis.normalize();
      const denominator=RESONANCE_STYLE.dashCount+(RESONANCE_STYLE.dashCount-1)*RESONANCE_STYLE.dashGapRatio,dashLength=length/denominator,gap=dashLength*RESONANCE_STYLE.dashGapRatio;
      for(let index=0;index<RESONANCE_STYLE.dashCount;index++){
        const mesh=dashMeshes.find(item=>item.userData.distributedBondBranch===branch&&item.userData.distributedBondDash===index);if(!mesh)continue;
        const resonance=['nitro','ozone'].includes(group?.kind);if(resonance){mesh.userData.resonanceVisual='distributed-bond-component';mesh.userData.resonanceStyle='distributed-dashed';mesh.userData.resonanceBranch=branch;mesh.userData.resonanceDash=index;mesh.userData.resonanceLineWidth='bond';}
        else{delete mesh.userData.resonanceVisual;delete mesh.userData.resonanceStyle;delete mesh.userData.resonanceBranch;delete mesh.userData.resonanceDash;delete mesh.userData.resonanceLineWidth;}
        const from=start.clone().addScaledVector(axis,index*(dashLength+gap)),to=from.clone().addScaledVector(axis,dashLength);placeDash(THREE,mesh,from,to,radius);
      }
    });
    return;
  }
  dashMeshes.forEach(mesh=>{mesh.visible=false;});
  sleeves.forEach(mesh=>{mesh.visible=false;});
  if(axes.length){
    const haloRadius=mode==='encyclopedia'?SULFUR_OXO_STYLE.encyclopediaRadius:SULFUR_OXO_STYLE.craftRadius;
    axes.forEach(({branch,atomId,start,end})=>{
      const mesh=sleeves.find(item=>item.userData.sulfurOxoBranch===branch);if(!mesh)return;
      mesh.material.color.setHex(SULFUR_OXO_STYLE.color);mesh.material.opacity=SULFUR_OXO_STYLE.opacity;
      mesh.userData.sulfurOxoAtomId=atomId;
      placeSleeve(THREE,mesh,start,end,haloRadius);
    });
  }
}

export function createChargeLabel(THREE, charge, owner = document, own = x => x) {
  const canvas=owner.createElement('canvas');canvas.width=64;canvas.height=64;
  const context=canvas.getContext('2d');context.fillStyle='#e5f8ff';context.font='bold 52px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(charge>0?'+':'−',32,34);
  const texture=own(new THREE.CanvasTexture(canvas));
  const material=own(new THREE.SpriteMaterial({map:texture,depthTest:false,transparent:true}));
  const sprite=new THREE.Sprite(material);sprite.scale.set(.26,.26,1);sprite.renderOrder=8;sprite.userData.formalCharge=charge;
  return sprite;
}
