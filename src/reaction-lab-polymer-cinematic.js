import {createMorphologyPlan,cinematicFrame,MORPHOLOGY_BUDGET} from './polymer-morphology.js?v=1';

// One batched tube mesh, one batched pendant outline, two fixed instanced feed LODs.
// All geometry is built once; animation changes draw ranges and fixed matrices only.
export function createPolymerCinematic({THREE,polymerId,sourceRecords=[],reducedMotion=false}){
  const plan=createMorphologyPlan(polymerId),root=new THREE.Group(),positions=[],indices=[],colors=[],pendants=[];
  const radius=.045+plan.profile.bulk*.022,radial=4,baseColor=new THREE.Color('#99e2d6');
  for(let s=0;s<plan.strands.length;s++){
    const strand=plan.strands[s],start=positions.length/3,shade=.64+(s%5)*.09;
    for(let i=0;i<strand.length;i++){
      const point=new THREE.Vector3(...strand[i]),a=new THREE.Vector3(...strand[Math.max(0,i-1)]),b=new THREE.Vector3(...strand[Math.min(strand.length-1,i+1)]),axis=b.sub(a).normalize(),reference=Math.abs(axis.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),side=new THREE.Vector3().crossVectors(axis,reference).normalize(),up=new THREE.Vector3().crossVectors(axis,side).normalize();
      for(let j=0;j<radial;j++){const angle=j/radial*Math.PI*2;positions.push(point.x+radius*(side.x*Math.cos(angle)+up.x*Math.sin(angle)),point.y+radius*(side.y*Math.cos(angle)+up.y*Math.sin(angle)),point.z+radius*(side.z*Math.cos(angle)+up.z*Math.sin(angle)));colors.push(baseColor.r*shade,baseColor.g*shade,baseColor.b*shade);}
      if(i<strand.length-1)for(let j=0;j<radial;j++){const a=start+i*radial+j,b=start+i*radial+(j+1)%radial,c=a+radial,d=b+radial;indices.push(a,b,c,b,d,c);}
      if(plan.profile.bulk>0&&i%8===4&&(!plan.profile.rhythm||Math.floor(i/8)%plan.profile.rhythm===0)){
        const size=.12+plan.profile.bulk*.28,center=point.clone().addScaledVector(side,size),steps=plan.profile.bulk>=.75?6:3;
        for(let j=0;j<steps;j++)for(const k of [j,j+1]){const angle=k/steps*Math.PI*2;pendants.push(center.x+size*(side.x*Math.cos(angle)+up.x*Math.sin(angle)),center.y+size*(side.y*Math.cos(angle)+up.y*Math.sin(angle)),center.z+size*(side.z*Math.cos(angle)+up.z*Math.sin(angle)));}
      }
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.setDrawRange(0,0);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.45,metalness:.12,transparent:true}),mesh=new THREE.Mesh(geometry,material);root.add(mesh);
  const pendantGeometry=new THREE.BufferGeometry();pendantGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pendants,3));pendantGeometry.setDrawRange(0,0);
  const pendantMaterial=new THREE.LineBasicMaterial({color:'#cbe7ed',transparent:true}),outline=new THREE.LineSegments(pendantGeometry,pendantMaterial);root.add(outline);
  const sphere=new THREE.SphereGeometry(1,6,4),feedMaterial=new THREE.MeshStandardMaterial({color:'#eaf8ff',roughness:.5});
  const particles=new THREE.InstancedMesh(sphere,feedMaterial,MORPHOLOGY_BUDGET.feedCapacity);particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);particles.frustumCulled=false;root.add(particles);
  // At most four recognizable heavy-atom monomer templates. No runtime Molecule/body.
  const templates=sourceRecords.map(record=>{
    const selected=record.atoms.map((a,i)=>({a,i})).slice(0,16),map=new Map(selected.map((row,i)=>[row.i,i]));
    const atoms=selected.map(({a})=>({element:a.element,point:a.point?.toArray?.()??a.point??[a.x??0,a.y??0,a.z??0]}));
    const bonds=record.bonds.filter(b=>map.has(b.a)&&map.has(b.b)).map(b=>[map.get(b.a),map.get(b.b)]);
    return{atoms,bonds};
  }).filter(t=>t.atoms.length);
  const atomCapacity=64,atoms=new THREE.InstancedMesh(sphere,feedMaterial,atomCapacity);atoms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);atoms.frustumCulled=false;root.add(atoms);
  const bondGeometry=new THREE.CylinderGeometry(.045,.045,1,4),bonds=new THREE.InstancedMesh(bondGeometry,feedMaterial,64);bonds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);bonds.frustumCulled=false;root.add(bonds);
  const bondAxis=new THREE.Vector3(),bondMid=new THREE.Vector3(),yAxis=new THREE.Vector3(0,1,0),feedPoint=new THREE.Vector3();
  const dummy=new THREE.Object3D(),color=new THREE.Color(),feedOrigin=new THREE.Vector3(-7,4,0),target=new THREE.Vector3(),first=plan.strands[0],stats={phase:'bulk-feed',progress:0,feedVisualCapacity:24,feedVisualActiveCount:0,representativeChainCount:plan.strands.length,morphologyPrimitiveCount:indices.length/3,geometryVertexCount:positions.length/3+pendants.length/3+ sphere.attributes.position.count,objectCount:5,geometryCount:3,materialCount:3,morphologyArchetype:plan.profile.archetype,morphologyReady:false,updateCount:0};
  const objects=[],geometries=new Set(),materials=new Set();root.traverse(o=>{objects.push(o);if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
  stats.objectCount=objects.length;stats.geometryCount=geometries.size;stats.materialCount=materials.size;stats.geometryVertexCount=[...geometries].reduce((n,g)=>n+(g.attributes.position?.count??0),0);
  let elapsed=0,disposed=false;
  function update(deltaMs){
    if(disposed)return{done:true};elapsed+=Math.min(50,Math.max(0,deltaMs));const frame=cinematicFrame(elapsed,reducedMotion);stats.phase=frame.phase;stats.progress=frame.progress;stats.updateCount++;
    const growth=frame.index===0?.025*frame.progress:frame.index===1?.025+.15*frame.progress:frame.index===2?.175+.825*frame.progress:1;
    geometry.setDrawRange(0,Math.floor(indices.length*growth/24)*24);pendantGeometry.setDrawRange(0,Math.floor(pendants.length/3*growth/2)*2);
    const collapse=frame.index===4?frame.progress:frame.done?1:0;material.opacity=1-collapse;pendantMaterial.opacity=1-collapse;
    const scale=frame.index===0?.28:frame.index===1?.28+.72*frame.progress:1;root.scale.setScalar(scale*(1-collapse*.92));
    const pointIndex=Math.min(first.length-1,Math.floor(Math.min(1,growth*plan.strands.length)*(first.length-1)));target.fromArray(first[pointIndex]);
    const moving=frame.index<3&&!reducedMotion,atomistic=moving&&frame.index===0&&templates.length>0;particles.visible=moving&&!atomistic;atoms.visible=atomistic;
    let atomIndex=0,bondIndex=0;dummy.quaternion.identity();bonds.visible=atomistic;
    if(moving)for(let i=0;i<(atomistic?4:24);i++){
      const t=(elapsed/(atomistic?650:420)+i/(atomistic?4:24))%1;
      dummy.position.lerpVectors(feedOrigin,target,t);dummy.position.z+=Math.sin(i*2.4)*(1-t)*1.2;dummy.scale.setScalar(.14+.08*(1-t));dummy.updateMatrix();
      if(!atomistic)particles.setMatrixAt(i,dummy.matrix);
      else{const template=templates[i%templates.length];for(const atom of template.atoms){if(atomIndex>=atomCapacity)break;dummy.position.lerpVectors(feedOrigin,target,t);dummy.position.x+=atom.point[0]*.5;dummy.position.y+=atom.point[1]*.5;dummy.position.z+=atom.point[2]*.5;dummy.scale.setScalar(atom.element==='H'?.13:.21);dummy.updateMatrix();atoms.setMatrixAt(atomIndex,dummy.matrix);color.set(atom.element==='O'?'#ee766c':atom.element==='N'?'#88b2ff':atom.element==='Cl'?'#83cd8c':atom.element==='H'?'#ffffff':'#aab7c6');atoms.setColorAt(atomIndex++,color);}
        feedPoint.lerpVectors(feedOrigin,target,t);
        for(const [a,b] of template.bonds){if(bondIndex>=64)break;const pa=template.atoms[a].point,pb=template.atoms[b].point;bondAxis.set(pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2]).multiplyScalar(.5);bondMid.set((pa[0]+pb[0])*.25,(pa[1]+pb[1])*.25,(pa[2]+pb[2])*.25);dummy.position.copy(feedPoint).add(bondMid);dummy.quaternion.setFromUnitVectors(yAxis,bondAxis.clone().normalize());dummy.scale.set(1,bondAxis.length(),1);dummy.updateMatrix();bonds.setMatrixAt(bondIndex++,dummy.matrix);}dummy.quaternion.identity();}
    }
    bonds.count=bondIndex;if(atomistic)bonds.instanceMatrix.needsUpdate=true;atoms.count=atomIndex;if(atomistic){atoms.instanceMatrix.needsUpdate=true;if(atoms.instanceColor)atoms.instanceColor.needsUpdate=true;}if(moving&&!atomistic)particles.instanceMatrix.needsUpdate=true;
    stats.feedVisualActiveCount=moving?(atomistic?4:24):0;stats.morphologyReady=frame.index===3;return{...frame,scale,cameraProgress:reducedMotion?0:frame.index===0?0:frame.index===1?frame.progress:frame.index===4?1-frame.progress:frame.done?0:1,atomOpacity:frame.index===0?1:frame.index===1?1-frame.progress:frame.index===4?frame.progress:frame.done?1:0};
  }
  function dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();pendantGeometry.dispose();sphere.dispose();bondGeometry.dispose();material.dispose();pendantMaterial.dispose();feedMaterial.dispose();root.clear();stats.objectCount=0;stats.geometryCount=0;stats.materialCount=0;stats.feedVisualActiveCount=0;}
  return{root,plan,stats,feedOrigin,update,dispose};
}
