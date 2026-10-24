// Owner: Task5 PIB recovery. One predeclared mesh calibration, never acceptance.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

export const exactMeshProbeSource = `
      polymerExactMeshSnapshot(){
        const v=polymerGraphVisual;if(!v||v.suspended)throw Error('No live finite mesh');
        camera.updateMatrixWorld(true);v.group.updateMatrixWorld(true);
        const geometries={},meshes=[];
        const add=(mesh,id,kind,index)=>{
          const geometry=mesh.geometry,key=JSON.stringify([geometry.type,geometry.parameters]);
          geometries[key]??={type:geometry.type,parameters:geometry.parameters,positions:Array.from(geometry.attributes.position.array),indices:Array.from(geometry.index.array)};
          meshes.push({id,kind,index,geometry:key,visible:mesh.visible,position:mesh.position.toArray(),quaternion:mesh.quaternion.toArray(),scale:mesh.scale.toArray(),matrix:mesh.matrix.toArray(),matrixWorld:mesh.matrixWorld.toArray(),materialSide:mesh.material.side});
        };
        for(const [index,mesh]of v.atomByGraphIndex)add(mesh,index+1,'atom',index);
        v.bondMeshes.forEach((mesh,index)=>add(mesh,1024+index,'bond',mesh.userData.polymerBondIndex));
        return{groupMatrix:v.group.matrixWorld.toArray(),geometries,meshes,visual:this.polymerVisualSnapshot()};
      },
      polymerFrozenMeshDiagnostic(input){
        const v=polymerGraphVisual;if(JSON.stringify(v.graph)!==JSON.stringify(input.graph))throw Error('Frozen graph mismatch');
        // Deliberately test-only replay. Actual inherited mesh quaternions are
        // retained, not replaced by identity or claimed to be historical ones.
        for(const [index,mesh]of v.atomByGraphIndex){const a=input.layoutAtoms[index];mesh.position.set(a.x,a.y,a.z);}
        v.layoutPlan={...v.layoutPlan,atoms:input.layoutAtoms};
        v.group.position.fromArray(input.pose.position);v.group.quaternion.fromArray(input.pose.quaternion);v.group.scale.setScalar(input.pose.scale);
        const matrix=new THREE.Matrix4().fromArray(input.camera.matrix);matrix.decompose(camera.position,camera.quaternion,camera.scale);camera.fov=input.camera.fov;camera.near=input.camera.near;camera.far=input.camera.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
        v.group.updateMatrixWorld(true);updatePolymerBondVisuals();renderer.render(scene,camera);
        return this.polymerExactMeshSnapshot();
      },
`;

export async function capturePolymerExactMesh({evaluate,send,artifactDir,sourceSha}){
  const base=new URL('../../docs/validation/polymer-local-fragment-task5-evidence/recovery/',import.meta.url);
  const bytes=await readFile(new URL('ba94cb-pib-visual.json.gz',base)),report=JSON.parse(gunzipSync(bytes));
  const conflict=JSON.parse(await readFile(new URL('pib-visibility-conflict.json',base)));
  const refined=JSON.parse(gunzipSync(await readFile(new URL('pib-occlusion-6036606d/mesh-pixel-refinement.json.gz',base))));
  const dir=join(artifactDir,'exact-mesh');await mkdir(dir,{recursive:true});
  const protocol={kind:'ONE_EXACT_PRODUCTION_MESH_CALIBRATION_NOT_ACCEPTANCE',sourceSha,frozenSha256:createHash('sha256').update(bytes).digest('hex'),controls:6,candidates:3,orientationSearches:0,thresholdChanges:0,limits:['Historical local quaternion was never captured; current actual inherited quaternion is separately identified','Frozen graph/XYZ/camera/poses; no optimization or new directions','No pointer/photometry/PIB acceptance is claimed by this diagnostic']};
  await writeFile(join(dir,'protocol.json'),JSON.stringify(protocol,null,2)+'\n');
  const current=await evaluate('window.__reactionLabProbe.polymerExactMeshSnapshot()');
  assert.deepEqual(current.visual.graph,report.initial.graph,'same finite graph before frozen diagnostic');
  assert.equal(current.visual.canvas.width,report.initial.canvas.width);assert.equal(current.visual.canvas.height,report.initial.canvas.height);
  await writeFile(join(dir,'production-before-replay.json'),JSON.stringify(current)+'\n');
  const poses=conflict.groups.flatMap(g=>g.retained.map(v=>{const view=report.views.find(w=>w.mode==='local-'+g.anchor&&w.yaw===v.yaw&&w.pitch===v.pitch);return{kind:'control',anchor:g.anchor,name:`control-${g.anchor}-y${v.yaw}-p${v.pitch}`,pose:view.pose,oldMask:view.mask,domOcclusions:view.domOcclusions};}));
  poses.push(...refined.best.map((v,index)=>({kind:'retained-boundary',anchor:30,name:`boundary-30-${index}`,pose:v.pose,domOcclusions:report.views[0].domOcclusions})));
  const rows=[];
  for(const row of poses){
    const input={graph:report.initial.graph,layoutAtoms:report.initial.layoutAtoms,camera:report.initial.camera,pose:row.pose};
    const snapshot=await evaluate(`window.__reactionLabProbe.polymerFrozenMeshDiagnostic(${JSON.stringify(input)})`);
    const mask=Buffer.from((await evaluate('window.__reactionLabProbe.polymerIdMask()')).split(',')[1],'base64');
    const actual=Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64');
    await writeFile(join(dir,row.name+'.json'),JSON.stringify({...row,snapshot})+'\n');
    await writeFile(join(dir,row.name+'-id.png'),mask);await writeFile(join(dir,row.name+'-actual.png'),actual);
    rows.push({...row,maskSha256:createHash('sha256').update(mask).digest('hex'),actualSha256:createHash('sha256').update(actual).digest('hex')});
  }
  await writeFile(join(dir,'index.json'),JSON.stringify({protocol,rows},null,2)+'\n');
  console.log('EXACT_MESH_CAPTURE',JSON.stringify({sourceSha,views:rows.length,actualMeshes:current.meshes.length,atomQuaternions:current.meshes.filter(m=>m.kind==='atom').map(m=>({index:m.index,quaternion:m.quaternion}))}));
}
