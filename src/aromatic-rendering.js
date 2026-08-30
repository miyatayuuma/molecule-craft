// Display only: the graph keeps its integer bond orders for crafting/recognition.
export const AROMATIC_STYLE = Object.freeze({color:0x67e8f9,cssColor:'#67e8f9',opacity:.9,glowOpacity:.12,tube:.025,glowTube:.065,segments:64});
const edgeKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;

export function aromaticBondKeys(cycles){
  return new Set(cycles.flatMap(cycle=>cycle.map((id,index)=>edgeKey(id,cycle[(index+1)%cycle.length]))));
}
export function displayedBondOrder(bond,edges){return edges.has(edgeKey(bond.a,bond.b))?1:bond.order;}

// Follow the molecular plane, never the camera. Hide a collapsed/invalid ring
// instead of leaving the previous frame floating in space during an edit.
export function aromaticRingFrame(THREE,points){
  if(points.length<3||points.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return null;
  const center=points.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/points.length);
  const offsets=points.map(p=>p.clone().sub(center)),normal=new THREE.Vector3();
  for(let i=0;i<offsets.length;i++)normal.add(new THREE.Vector3().crossVectors(offsets[i],offsets[(i+1)%offsets.length]));
  if(normal.lengthSq()<1e-10)return null;normal.normalize();
  const flat=offsets.map(p=>p.addScaledVector(normal,-p.dot(normal)));
  let clearance=Infinity;
  for(let i=0;i<flat.length;i++){
    const a=flat[i],delta=flat[(i+1)%flat.length].clone().sub(a),lengthSq=delta.lengthSq();
    if(lengthSq<1e-10)return null;
    const t=Math.max(0,Math.min(1,-a.dot(delta)/lengthSq));
    clearance=Math.min(clearance,a.clone().addScaledVector(delta,t).length());
  }
  const radius=Math.min(flat.reduce((sum,p)=>sum+p.length(),0)/flat.length*.56,clearance*.78);
  if(radius<1e-4||flat[0].lengthSq()<1e-10)return null;
  const u=flat[0].clone().normalize(),v=new THREE.Vector3().crossVectors(normal,u).normalize();
  return {center,normal,u,v,radius};
}

export function aromaticRingPoints(frame){
  return Array.from({length:AROMATIC_STYLE.segments},(_,index)=>{
    const angle=index*2*Math.PI/AROMATIC_STYLE.segments;
    return frame.center.clone().addScaledVector(frame.u,Math.cos(angle)*frame.radius).addScaledVector(frame.v,Math.sin(angle)*frame.radius);
  });
}

export function createAromaticRing(THREE,own=resource=>resource){
  const group=new THREE.Group();group.userData.aromaticRing=true;
  for(const [tube,opacity] of [[AROMATIC_STYLE.tube,AROMATIC_STYLE.opacity],[AROMATIC_STYLE.glowTube,AROMATIC_STYLE.glowOpacity]]){
    const geometry=own(new THREE.TorusGeometry(1,tube,8,AROMATIC_STYLE.segments));
    const material=own(new THREE.MeshBasicMaterial({color:AROMATIC_STYLE.color,transparent:true,opacity,depthTest:true,depthWrite:false}));
    const mesh=new THREE.Mesh(geometry,material);mesh.userData.baseOpacity=opacity;group.add(mesh);
  }
  return group;
}
export function updateAromaticRing(THREE,group,frame){
  group.visible=!!frame;if(!frame)return;
  group.position.copy(frame.center);group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),frame.normal);group.scale.setScalar(frame.radius);
}
export function setAromaticOpacity(group,opacity){
  for(const mesh of group.children)mesh.material.opacity=mesh.userData.baseOpacity*opacity;
}
