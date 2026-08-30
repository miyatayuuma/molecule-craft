import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {runInNewContext} from 'node:vm';
import {checkSpawnLayouts} from './spawn-layout-checks.js';
import {planSpawn} from '../src/spawn-layout.js';
import {ELEMENTS,Molecule} from '../src/chemistry.js';
import {unpairedElectronCount,lonePairCount,valenceShellRadius} from '../src/bonding-model.js?v=31';
import {createPreviewModel} from '../src/preview-model.js?v=31';
import {expandCraftStructure} from '../src/craft-structures.js?v=31';
if(!process.argv[2])throw new Error('Pass the path to three.module.js');
const THREE=await import(pathToFileURL(process.argv[2]));
const templates=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url)));
console.log(checkSpawnLayouts(THREE,templates));
const app=await readFile(new URL('../src/app-v14.js?v=31',import.meta.url),'utf8');
const section=(a,b)=>app.slice(app.indexOf(`function ${a}(`),app.indexOf(`function ${b}(`));
const source=section('addElement','onPointerDown')+section('spawnRadius','disposeObject')+section('updateStructureFrame','updateDebris');
function workspace(distance){
  const camera=new THREE.PerspectiveCamera(44,390/430,.01,200),target=new THREE.Vector3(1,2,3);
  camera.position.copy(target).add(new THREE.Vector3(3,2,5).normalize().multiplyScalar(distance));camera.lookAt(target);camera.updateMatrixWorld();
  const scope={THREE,ELEMENTS,Molecule,planSpawn,unpairedElectronCount,lonePairCount,valenceShellRadius,createPreviewModel,expandCraftStructure,
    camera,cameraTarget:target,molecule:new Molecule(),placements:new Map(),protectedUntil:new Map(),activePointers:new Map(),craftSpawnLayouts:new Map(),selectedAtomId:null,dragState:null,relaxation:null,frameTransition:null,bondTransition:null,reduceMotion:false,performance:{now:()=>1000},DEBRIS_POLICY:{protectionMs:8000},
    elementPalette:{canUse:()=>true},collectionGame:{templateFor:id=>templates.find(t=>t.id===id)},renderer:{domElement:{getBoundingClientRect:()=>({left:0,top:0,right:390,bottom:430,width:390,height:430})}},
    document:{querySelector:()=>({getBoundingClientRect:()=>({bottom:74})})},selectionChip:{getBoundingClientRect:()=>({top:370})},pulse:()=>{},interactionLocked:()=>!!scope.frameTransition,
    topologyChanged:()=>{},refresh:()=>{},refreshInfo:()=>{},selectAtom:id=>{scope.selectedAtomId=id;},pos:id=>scope.placements.get(id)?.position,
    atomById:id=>scope.molecule.atoms.find(a=>a.id===id),bondBetween:(a,b)=>scope.molecule.bonds.find(bond=>(bond.a===a&&bond.b===b)||(bond.a===b&&bond.b===a)),
    startRelaxation:()=>{throw new Error('Pre-solved parts must not relax again after fitting');},
    cameraRight:()=>new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),cameraUp:()=>new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1),cameraDirection:()=>target.clone().sub(camera.position).normalize()};
  runInNewContext(source,scope);return scope;
}
const room=workspace(10),cameraBefore=room.camera.position.clone(),targetBefore=room.cameraTarget.clone();room.addElement('C');room.addElement('H');
assert.equal(room.molecule.atoms.length,2);assert.equal(room.frameTransition,null);assert.ok(room.camera.position.equals(cameraBefore)&&room.cameraTarget.equals(targetBefore),'In-frame additions moved camera');
const crowded=workspace(1.2),before=crowded.camera.position.clone(),direction=before.clone().sub(crowded.cameraTarget).normalize();crowded.addCraftPart('phenyl');
assert.equal(crowded.frameTransition.kind,'spawn');assert.ok(crowded.camera.position.equals(before),'Zoom jumped immediately');
const points=[...crowded.placements.values()].map(p=>p.position.clone());
crowded.updateStructureFrame(1210);const middle=crowded.camera.position.distanceTo(crowded.cameraTarget);
assert.ok(middle>1.2&&middle<crowded.frameTransition.position.distanceTo(crowded.cameraTarget),'Spawn zoom did not interpolate');
crowded.updateStructureFrame(1420);assert.equal(crowded.frameTransition,null);
assert.ok(crowded.cameraTarget.equals(targetBefore));assert.ok(crowded.camera.position.clone().sub(crowded.cameraTarget).normalize().distanceTo(direction)<1e-10);
assert.ok([...crowded.placements.values()].every((p,i)=>p.position.equals(points[i])),'Camera animation moved atoms');
const final=crowded.camera.position.clone();crowded.relaxation=null;crowded.updateStructureFrame(2500);assert.ok(crowded.camera.position.equals(final),'Late reframe after relaxation');
const ordinary=workspace(10);ordinary.frameTransition={kind:'manual'};ordinary.relaxation={};ordinary.updateStructureFrame(2000);assert.equal(ordinary.frameTransition.kind,'manual','Ordinary editing should not move the camera');
console.log('Production spawn adapter passed: no-zoom additions, smooth part zoom, fixed target/direction/atoms, no late reframe.');
for(const template of templates){
  const field=workspace(1.2);field.addCraftPart(template.id);field.updateStructureFrame(1420);
  assert.equal(field.relaxation,null,'Pre-solved part unexpectedly started a second relaxation');
  field.camera.lookAt(field.cameraTarget);field.camera.updateMatrixWorld();
  for(const atom of field.molecule.atoms){
    const r=field.spawnRadius(atom.element,field.molecule.bondOrderForAtom(atom.id))-.06;
    for(let i=0;i<48;i++){
      const y=1-2*(i+.5)/48,s=Math.sqrt(1-y*y),a=i*2.3999632297;
      const p=field.pos(atom.id).clone().add(new THREE.Vector3(s*Math.cos(a),y,s*Math.sin(a)).multiplyScalar(r)).project(field.camera);
      const x=(p.x+1)*195,sy=(1-p.y)*215;
      assert.ok(x>=18&&x<=372&&sy>=88&&sy<=358,`${template.id}: spawned atom/electron clipped`);
    }
  }
}
console.log('All 17 pre-solved parts remain in view after placement and zoom; no second relaxation or delayed camera fit.');
