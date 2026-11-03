/** Localhost-only visual diagnostics for the LAB probe. No production state is owned here. */
export function capturePolymerIdMask({THREE,visual,renderer,canvas,scene,world,camera,document}){
        if(!visual||visual.suspended)throw new Error('No visible sample');
        const maskColor=id=>(Math.imul(id,73856093)>>>0)&0xffffff,saved=[],background=scene.background,previousTarget=renderer.getRenderTarget(),target=new THREE.WebGLRenderTarget(canvas.width,canvas.height,{samples:0});target.texture.colorSpace=THREE.SRGBColorSpace;scene.background=new THREE.Color(0);let lane=1024;
        let occluder=50000;for(const child of world.children)if(child!==visual.group)child.traverse(o=>{if(o.isMesh){saved.push([o,'material',o.material]);o.material=new THREE.MeshBasicMaterial({color:maskColor(occluder++),toneMapped:false});}});
        for(const [i,m]of visual.atomByGraphIndex){saved.push([m,'material',m.material]);m.material=new THREE.MeshBasicMaterial({color:maskColor(i+1),toneMapped:false});}
        for(const m of visual.bondMeshes){saved.push([m,'material',m.material]);m.material=new THREE.MeshBasicMaterial({color:maskColor(lane++),toneMapped:false});}
        // ID coverage must not discard MSAA pixels whose colors mix two IDs.
        // This localhost-only attachment uses the same geometry/pose/DPR with
        // single-sample rasterization; the actual antialiased PNG is separate.
        try{renderer.setRenderTarget(target);renderer.render(scene,camera);const pixels=new Uint8Array(canvas.width*canvas.height*4);renderer.readRenderTargetPixels(target,0,0,canvas.width,canvas.height,pixels);const mask=document.createElement('canvas');mask.width=canvas.width;mask.height=canvas.height;const context=mask.getContext('2d'),image=context.createImageData(mask.width,mask.height),stride=mask.width*4;for(let y=0;y<mask.height;y++)image.data.set(pixels.subarray((mask.height-y-1)*stride,(mask.height-y)*stride),y*stride);context.putImageData(image,0,0);return mask.toDataURL('image/png');}finally{renderer.setRenderTarget(previousTarget);target.dispose();for(const [o,k,v]of saved){if(k==='material')o.material.dispose();o[k]=v;}scene.background=background;renderer.render(scene,camera);}

}

export function measurePolymerDisplayBounds({THREE,visual,camera,canvas,fit,modelAtomRadius}){
        if(!visual?.layoutPlan)return null;
        const rect=canvas.getBoundingClientRect(),forward=camera.getWorldDirection(new THREE.Vector3()),points=[];camera.updateMatrixWorld(true);visual.group.updateMatrixWorld(true);
        for(const[index,mesh]of visual.atomByGraphIndex){const atom=visual.layoutPlan.atoms[index],worldPoint=mesh.getWorldPosition(new THREE.Vector3()),depth=worldPoint.clone().sub(camera.position).dot(forward),projected=worldPoint.project(camera),radius=modelAtomRadius(atom.element)*visual.group.scale.x*rect.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))*Math.max(camera.near,depth));points.push({x:(projected.x+1)*.5*rect.width,y:(1-projected.y)*.5*rect.height,radius,depth,ndcZ:projected.z});}
        const bounds={left:Math.min(...points.map(point=>point.x-point.radius)),right:Math.max(...points.map(point=>point.x+point.radius)),top:Math.min(...points.map(point=>point.y-point.radius)),bottom:Math.max(...points.map(point=>point.y+point.radius))},safe=fit?.safeRegion??null;
        bounds.width=bounds.right-bounds.left;bounds.height=bounds.bottom-bounds.top;
        return{bounds,safeRegion:safe,atomCount:points.length,depthVisible:points.every(point=>point.depth>camera.near&&point.depth<camera.far&&point.ndcZ>=-1&&point.ndcZ<=1),insideSafeRegion:!!safe&&bounds.left>=safe.left-1&&bounds.right<=safe.right+1&&bounds.top>=safe.top-1&&bounds.bottom<=safe.bottom+1};

}
