// Display-only batching. Preserve the existing sphere/cylinder tessellation,
// material properties and every atom/lane transform; only draw ownership changes.
export function advanceReferenceGrowth(growth,now,target){
  if(growth.lastRenderedAt===null||now-growth.lastRenderedAt<150||growth.units>=target)return false;
  growth.units++;growth.lastRenderedAt=null;return true;
}
export function initializeReferenceAtoms(THREE,visual,{elements,atomRadius,originKey,growth=false}){
  const byElement=new Map();
  for(const atom of visual.graph.atoms){if(!byElement.has(atom.element))byElement.set(atom.element,[]);byElement.get(atom.element).push(atom);}
  const matrix=new THREE.Matrix4();
  for(const [element,atoms] of byElement){
    if(growth)atoms.sort((a,b)=>a.unit-b.unit||a.id-b.id);
    const geometry=new THREE.SphereGeometry(atomRadius(element),24,16),material=new THREE.MeshStandardMaterial({color:elements[element].color,roughness:.42,metalness:0});
    const batch=new THREE.InstancedMesh(geometry,material,atoms.length);batch.frustumCulled=false;batch.userData.referenceBatch='atoms';visual.group.add(batch);
    atoms.forEach((atom,index)=>{
      matrix.makeTranslation(atom.x,atom.y,atom.z);batch.setMatrixAt(index,matrix);
      // Lightweight transform/identity handles for fitting and read-only probes.
      // They are not renderable meshes and never enter the chemistry graph.
      const handle=new THREE.Object3D();handle.position.set(atom.x,atom.y,atom.z);handle.material=material;visual.group.add(handle);
      visual.atomByGraphIndex.set(atom.id,handle);visual.atomMeshesByOrigin.set(originKey(visual.graph.atomOrigins[atom.id]),handle);
    });
    batch.instanceMatrix.needsUpdate=true;
    if(growth){batch.userData.units=atoms.map(atom=>atom.unit);batch.count=0;}
  }
}

// Change only the active instance counts; the approved graph and transforms
// remain immutable. A bridge appears only when both endpoint units exist.
export function setReferenceGrowth(THREE,visual,unitCount){
  const count=Math.max(1,Math.min(visual.layoutPlan.unitCount,Math.floor(unitCount)));
  visual.growthUnits=count;
  for(const child of visual.group.children){
    if(child.userData.referenceBatch==='atoms'&&child.userData.units){let n=0;while(n<child.userData.units.length&&child.userData.units[n]<count)n++;child.count=n;}
    if(child.userData.growthUnit!==undefined)child.visible=child.userData.growthUnit<count;
    if(child.userData.hideAtGrowthUnit!==undefined||child.userData.showAtGrowthUnit!==undefined)child.visible=(child.userData.showAtGrowthUnit===undefined||count>=child.userData.showAtGrowthUnit)&&(child.userData.hideAtGrowthUnit===undefined||count<child.userData.hideAtGrowthUnit);
  }
  syncReferenceBondBatch(THREE,visual);
}

export function syncReferenceBondBatch(THREE,visual){
  let batch=visual.referenceBondBatch;
  if(!batch){
    const capacity=visual.graph.bonds.reduce((n,b)=>n+b.order,0);
    batch=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,16),new THREE.MeshStandardMaterial({color:'#b8d1de',roughness:.5,metalness:0}),capacity);
    batch.frustumCulled=false;batch.userData.referenceBatch='bonds';visual.referenceBondBatch=batch;visual.group.add(batch);
  }
  let count=0;
  for(const handle of visual.bondMeshes)if(handle.visible){
    const indices=handle.userData.polymerAtomIndices;
    if(visual.growthUnits!==undefined&&indices?.some(i=>visual.graph.atoms[i].unit>=visual.growthUnits))continue;
    handle.updateMatrix();batch.setMatrixAt(count++,handle.matrix);
  }
  batch.count=count;batch.instanceMatrix.needsUpdate=true;
}
