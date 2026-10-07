const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** One bounded, reusable tube that carries the PE hero identity between plans. */
export function createPolymerMorphologyBridgeRenderer(THREE,{pointCount=72,radialSegments=8,color='#a8ddd7',radius=.04}={}){
  if(!THREE?.BufferGeometry||!THREE?.MeshStandardMaterial||!Number.isInteger(pointCount)||pointCount<2||!Number.isInteger(radialSegments)||radialSegments<6)throw new TypeError('Three.js and a bounded bridge tube configuration are required.');
  const positions=new Float32Array(pointCount*radialSegments*3),normals=new Float32Array(positions.length),indices=[];
  for(let point=0;point<pointCount-1;point++)for(let side=0;side<radialSegments;side++){
    const a=point*radialSegments+side,b=point*radialSegments+(side+1)%radialSegments,c=a+radialSegments,d=b+radialSegments;indices.push(a,b,c,b,d,c);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3).setUsage(THREE.DynamicDrawUsage));geometry.setIndex(indices);
  const material=new THREE.MeshStandardMaterial({color,emissive:'#12363b',roughness:.48,metalness:.055,transparent:true,opacity:0,depthWrite:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='temporary-polymer-hero-bridge';mesh.frustumCulled=false;mesh.visible=false;
  const root=new THREE.Group();root.name='polymer-morphology-hero-bridge';root.add(mesh);
  const a=new THREE.Vector3(),b=new THREE.Vector3(),tangent=new THREE.Vector3(),normal=new THREE.Vector3(),binormal=new THREE.Vector3(),helper=new THREE.Vector3(),radial=new THREE.Vector3();
  let disposed=false,lastRadius=radius,opacity=0;
  const stats={objectCount:1,geometryCount:1,materialCount:1,pointCount,vertexCount:pointCount*radialSegments,indexCount:indices.length,radius,opacity,disposed:false};
  function update(points,nextRadius=lastRadius){
    if(disposed)throw new Error('Cannot update a disposed polymer bridge.');
    if(!Array.isArray(points)||points.length!==pointCount||points.some(point=>!Array.isArray(point)||point.length!==3||point.some(value=>!Number.isFinite(value))))throw new TypeError('Bridge centerline must match its bounded sample count.');
    lastRadius=clamp(Number.isFinite(nextRadius)?nextRadius:radius,.004,8);stats.radius=lastRadius;
    for(let pointIndex=0;pointIndex<pointCount;pointIndex++){
      a.fromArray(points[Math.max(0,pointIndex-1)]);b.fromArray(points[Math.min(pointCount-1,pointIndex+1)]);tangent.subVectors(b,a);
      if(tangent.lengthSq()<1e-12)tangent.set(1,0,0);else tangent.normalize();
      if(pointIndex===0){if(Math.abs(tangent.z)<.82)helper.set(0,0,1);else helper.set(0,1,0);normal.crossVectors(tangent,helper);if(normal.lengthSq()<1e-10)normal.set(0,1,0).addScaledVector(tangent,-tangent.y);normal.normalize();}
      else{normal.addScaledVector(tangent,-normal.dot(tangent));if(normal.lengthSq()<1e-10){helper.set(0,1,0).addScaledVector(tangent,-tangent.y);normal.copy(helper);if(normal.lengthSq()<1e-10)normal.set(1,0,0).addScaledVector(tangent,-tangent.x);}normal.normalize();}
      binormal.crossVectors(tangent,normal).normalize();const center=points[pointIndex];
      for(let sideIndex=0;sideIndex<radialSegments;sideIndex++){
        const angle=sideIndex/radialSegments*Math.PI*2,cos=Math.cos(angle),sin=Math.sin(angle),vertex=pointIndex*radialSegments+sideIndex,offset=vertex*3;
        radial.copy(normal).multiplyScalar(cos).addScaledVector(binormal,sin).normalize();
        positions[offset]=center[0]+radial.x*lastRadius;positions[offset+1]=center[1]+radial.y*lastRadius;positions[offset+2]=center[2]+radial.z*lastRadius;
        normals[offset]=radial.x;normals[offset+1]=radial.y;normals[offset+2]=radial.z;
      }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;geometry.computeBoundingSphere();
  }
  function setOpacity(value){if(disposed)return;opacity=clamp(Number.isFinite(value)?value:0,0,1);material.opacity=opacity;material.transparent=opacity<.999;material.depthWrite=opacity>.999;mesh.visible=opacity>.001;stats.opacity=opacity;}
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();material.dispose();root.clear();stats.objectCount=0;stats.geometryCount=0;stats.materialCount=0;stats.vertexCount=0;stats.indexCount=0;stats.opacity=0;stats.disposed=true;}
  return{root,mesh,geometry,material,stats,update,setOpacity,dispose};
}
