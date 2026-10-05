import {POLYMER_MORPHOLOGY_BUDGET} from './polymer-morphology-plan.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const subtract=(a,b)=>a.clone().sub(b);
const maxPlanZ=plan=>Math.max(1,Math.abs(plan.bounds.min[2]),Math.abs(plan.bounds.max[2]));

function appendStrand(THREE,strand,positions,normals,colors,indices,zScale){
  const points=strand.points.map(point=>new THREE.Vector3(...point)),ringCount=points.length,radial=POLYMER_MORPHOLOGY_BUDGET.radialSegments,baseVertex=positions.length/3;
  let previousNormal=null;
  for(let index=0;index<ringCount;index++){
    const tangent=index===0?subtract(points[1],points[0]).normalize():index===ringCount-1?subtract(points[index],points[index-1]).normalize():subtract(points[index+1],points[index-1]).normalize();
    let normal;
    if(previousNormal){normal=previousNormal.clone().addScaledVector(tangent,-previousNormal.dot(tangent));if(normal.lengthSq()<1e-7)normal.set(0,1,0).addScaledVector(tangent,-tangent.y);if(normal.lengthSq()<1e-7)normal.set(1,0,0).addScaledVector(tangent,-tangent.x);normal.normalize();}
    else{const helper=Math.abs(tangent.z)<.82?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);normal=new THREE.Vector3().crossVectors(tangent,helper).normalize();}
    const binormal=new THREE.Vector3().crossVectors(tangent,normal).normalize();previousNormal=normal;
    const depth=clamp((points[index].z/zScale+1)*.5,0,1),light=new THREE.Vector3(-.34,.58,.74).normalize(),strandTone=.95+((index*17+strand.points.length*13)%9)*.012;
    for(let side=0;side<radial;side++){
      const angle=(side/radial)*Math.PI*2,radialNormal=normal.clone().multiplyScalar(Math.cos(angle)).addScaledVector(binormal,Math.sin(angle)),radius=strand.radius*(1+.035*Math.sin(index*.23+side*.71));
      const vertex=points[index].clone().addScaledVector(radialNormal,radius),diffuse=.72+.17*depth+.15*Math.max(0,radialNormal.dot(light)),shade=clamp(diffuse*strandTone,.52,1.08);
      positions.push(vertex.x,vertex.y,vertex.z);normals.push(radialNormal.x,radialNormal.y,radialNormal.z);colors.push(.48*shade,.78*shade,.80*shade);
      if(index<ringCount-1){const a=baseVertex+index*radial+side,b=baseVertex+index*radial+(side+1)%radial,c=baseVertex+(index+1)*radial+side,d=baseVertex+(index+1)*radial+(side+1)%radial;indices.push(a,b,c,b,d,c);}
    }
  }
}

/** Create the static production morphology meshes from a deterministic plan. */
export function createPolymerMorphologyRenderer(THREE,plan){
  if(!THREE?.BufferGeometry||!THREE?.MeshStandardMaterial||!plan?.strands?.length)throw new TypeError('Three.js and a complete polymer morphology plan are required.');
  if(plan.stats?.pointCount>POLYMER_MORPHOLOGY_BUDGET.maxPlanPoints||plan.strands.length>POLYMER_MORPHOLOGY_BUDGET.maxMembers)throw new Error('Morphology render request exceeds its declared budget.');
  const root=new THREE.Group();root.name=`polymer-morphology-${plan.polymerId}`;
  const positions=[],normals=[],colors=[],indices=[],zScale=maxPlanZ(plan);
  for(const strand of plan.strands)appendStrand(THREE,strand,positions,normals,colors,indices,zScale);
  if(positions.length/3>POLYMER_MORPHOLOGY_BUDGET.maxVertices||indices.length>POLYMER_MORPHOLOGY_BUDGET.maxIndices)throw new Error('Morphology tube mesh exceeds its declared geometry budget.');
  const strandGeometry=new THREE.BufferGeometry();
  strandGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  strandGeometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  strandGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  strandGeometry.setIndex(indices);strandGeometry.computeBoundingSphere();
  const strandMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.48,metalness:.025});
  const mesh=new THREE.Mesh(strandGeometry,strandMaterial);mesh.name='mesoscale-polymer-strands';mesh.frustumCulled=true;root.add(mesh);
  let junctionGeometry=null,junctionMaterial=null,junctionMesh=null;
  if(plan.junctions.length){
    if(plan.junctions.length>POLYMER_MORPHOLOGY_BUDGET.maxJunctions)throw new Error('Morphology junction count exceeds its declared budget.');
    junctionGeometry=new THREE.SphereGeometry(.092,10,8);junctionMaterial=new THREE.MeshStandardMaterial({color:'#d3e8e8',roughness:.42,metalness:.015});
    junctionMesh=new THREE.InstancedMesh(junctionGeometry,junctionMaterial,plan.junctions.length);junctionMesh.name='connected-network-junctions';
    const marker=new THREE.Object3D();
    plan.junctions.forEach((junction,index)=>{marker.position.set(...junction.position);marker.scale.setScalar(1);marker.updateMatrix();junctionMesh.setMatrixAt(index,marker.matrix);});
    junctionMesh.instanceMatrix.needsUpdate=true;junctionMesh.frustumCulled=true;root.add(junctionMesh);
  }
  const resources={disposed:false,objectCount:root.children.length,geometryCount:junctionGeometry?2:1,materialCount:junctionMaterial?2:1,vertexCount:positions.length/3,indexCount:indices.length,strandCount:plan.strands.length,junctionCount:plan.junctions.length};
  function dispose(){
    if(resources.disposed)return;
    resources.disposed=true;root.removeFromParent();strandGeometry.dispose();strandMaterial.dispose();junctionGeometry?.dispose();junctionMaterial?.dispose();root.clear();
    resources.objectCount=0;resources.geometryCount=0;resources.materialCount=0;resources.vertexCount=0;resources.indexCount=0;
  }
  return{root,plan,stats:()=>({...resources}),dispose};
}
