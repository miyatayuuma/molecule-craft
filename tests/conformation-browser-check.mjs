import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import * as THREE from '../vendor/three/three.module.min.js';
import {Molecule,ELEMENTS} from '../src/chemistry.js?v=20';
import {ATOMIC_MODEL,bondLengthScale,geometryForAtom,nonbondedDistance} from '../src/bonding-model.js?v=31';
import {createPreviewModel} from '../src/preview-model.js?v=31';
import {createStructureSolver} from '../src/structure-relaxation.js?v=32';

if(!process.argv[2]||!process.argv[3])throw new Error('Pass playwright/index.mjs and the local app URL');
const {chromium}=await import(pathToFileURL(process.argv[2])),baseURL=process.argv[3],screenshotDir=process.argv[4]??null,browserExecutable=process.argv[5]??null;
if(screenshotDir)await mkdir(screenshotDir,{recursive:true});

function builder(){
  const atoms=[],bonds=[];
  const atom=element=>(atoms.push(element),atoms.length-1),bond=(a,b,order=1)=>bonds.push([a,b,order]);
  const hydrogens=(center,count)=>{for(let index=0;index<count;index++)bond(center,atom('H'));};
  return{atoms,bonds,atom,bond,hydrogens};
}

function benzene(chainLength=0){
  const record=builder(),ring=Array.from({length:6},()=>record.atom('C'));
  ring.forEach((id,index)=>record.bond(id,ring[(index+1)%6],index%2===0?2:1));
  for(let index=1;index<6;index++)record.hydrogens(ring[index],1);
  if(!chainLength){record.hydrogens(ring[0],1);return{...record,id:'benzene',dragIndex:ring[0],expectMove:false,rigidIndices:ring};}
  const chain=Array.from({length:chainLength},()=>record.atom('C'));record.bond(ring[0],chain[0]);
  for(let index=1;index<chain.length;index++)record.bond(chain[index-1],chain[index]);
  chain.forEach((id,index)=>record.hydrogens(id,chainLength===1?3:index===chain.length-1?3:2));
  return{...record,id:chainLength===1?'toluene':'butylbenzene',dragIndex:chain[chain.length-1],expectMove:chainLength>1,rigidIndices:ring};
}

function alkane(length=6){
  const record=builder(),chain=Array.from({length},()=>record.atom('C'));
  for(let index=1;index<length;index++)record.bond(chain[index-1],chain[index]);
  chain.forEach((id,index)=>record.hydrogens(id,index===0||index===length-1?3:2));
  return{...record,id:'hexane',dragIndex:chain[0],expectMove:true,rigidIndices:[]};
}

function butene(){
  const record=builder(),chain=Array.from({length:4},()=>record.atom('C'));record.bond(chain[0],chain[1],2);record.bond(chain[1],chain[2]);record.bond(chain[2],chain[3]);
  [2,1,2,3].forEach((count,index)=>record.hydrogens(chain[index],count));
  return{...record,id:'1-butene',dragIndex:chain[3],dragDelta:[115,-65],expectMove:true,
    rigidIndices:[chain[0],chain[1],...record.bonds.filter(([a,b])=>[a,b].includes(chain[0])||[a,b].includes(chain[1])).flatMap(([a,b])=>[a,b])]};
}

function branchedAlkane(){
  const record=builder(),chain=Array.from({length:5},()=>record.atom('C')),branch=record.atom('C');
  for(let index=1;index<chain.length;index++)record.bond(chain[index-1],chain[index]);record.bond(chain[2],branch);
  [3,2,1,2,3].forEach((count,index)=>record.hydrogens(chain[index],count));record.hydrogens(branch,3);
  return{...record,id:'3-methylpentane',dragIndex:chain[0],expectMove:true,rigidIndices:[]};
}

function ethylcyclohexane(){
  const record=builder(),ring=Array.from({length:6},()=>record.atom('C')),alpha=record.atom('C'),beta=record.atom('C');
  ring.forEach((id,index)=>record.bond(id,ring[(index+1)%6]));record.bond(ring[0],alpha);record.bond(alpha,beta);
  ring.forEach((id,index)=>record.hydrogens(id,index===0?1:2));record.hydrogens(alpha,2);record.hydrogens(beta,3);
  return{...record,id:'ethylcyclohexane',dragIndex:beta,expectMove:true,rigidIndices:ring};
}

function workspaceFor(record){
  const preview=createPreviewModel(THREE,record);for(let step=0;step<360;step++)preview.step();const layout=preview.snapshot();
  return{schemaVersion:1,atoms:record.atoms.map((element,index)=>({element,position:layout.atoms[index].point.toArray()})),bonds:record.bonds,
    selected:record.dragIndex,focus:0,pivot:null,camera:{position:[5.2,4,7.6],target:[0,0,0],up:[0,1,0]}};
}

function solverFor(workspace){
  const molecule=new Molecule(),ids=workspace.atoms.map(atom=>molecule.addAtom(atom.element).id);for(const[a,b,order]of workspace.bonds)molecule.setBond(ids[a],ids[b],order);
  const placements=new Map(ids.map((id,index)=>[id,{position:new THREE.Vector3(...workspace.atoms[index].position)}]));
  const atomById=id=>molecule.atoms.find(atom=>atom.id===id),positionFor=id=>placements.get(id)?.position;
  const solver=createStructureSolver({THREE,molecule,placements,atomById,positionFor,
    bondBetween:(a,b)=>molecule.bonds.find(bond=>bond.a===a&&bond.b===b||bond.a===b&&bond.b===a),
    bondLengthFor:(a,b,order)=>(ATOMIC_MODEL[atomById(a).element].covalentRadius+ATOMIC_MODEL[atomById(b).element].covalentRadius)*.78*bondLengthScale(order),
    geometryFor:id=>geometryForAtom(molecule,id),radiusFor:id=>ELEMENTS[atomById(id).element].radius,
    nonbondedDistanceFor:(a,b)=>nonbondedDistance(atomById(a).element,atomById(b).element)});
  solver.rebuildTopology();return{solver,ids};
}

function remapRigidReference(reference,fromIds,toIds){
  const indices=new Map(fromIds.map((id,index)=>[id,index]));
  return reference.map(fragment=>({...fragment,pairs:fragment.pairs.map(pair=>({
    ...pair,a:toIds[indices.get(pair.a)],b:toIds[indices.get(pair.b)],
  }))}));
}

const browser=await chromium.launch({headless:true,executablePath:browserExecutable??undefined,args:[
  '--no-sandbox','--disable-setuid-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl','--ignore-gpu-blocklist',
]}),results=[];
try{
  for(const record of [benzene(),benzene(1),benzene(4),butene(),alkane(),branchedAlkane(),ethylcyclohexane()]){
    const initial=workspaceFor(record),initialSolver=solverFor(initial),rigidReference=initialSolver.solver.captureRigidReference();
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{
      if(message.type()==='error'&&!message.text().includes('Blocked call to navigator.vibrate'))errors.push(message.text());
    });
    await page.addInitScript(workspace=>localStorage.setItem('molecule-craft.workspace.v1',JSON.stringify(workspace)),initial);
    await page.goto(baseURL,{waitUntil:'networkidle'});await page.waitForSelector('#viewer canvas');await page.waitForTimeout(900);
    const webgl=await page.locator('#viewer canvas').evaluate(canvas=>!!(canvas.getContext('webgl2')||canvas.getContext('webgl')));assert.ok(webgl,`${record.id}: WebGL unavailable`);
    const point=await page.evaluate(async atomIndex=>{
      const THREE=await import('./vendor/three/three.module.min.js'),resource=JSON.parse(localStorage.getItem('molecule-craft.resources.v1')||'null');
      const workspace=resource?.workspace??JSON.parse(localStorage.getItem('molecule-craft.workspace.v1')),rect=document.querySelector('#viewer canvas').getBoundingClientRect();
      const camera=new THREE.PerspectiveCamera(44,rect.width/rect.height,.1,100);camera.position.fromArray(workspace.camera.position);camera.up.fromArray(workspace.camera.up);camera.lookAt(...workspace.camera.target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
      const projected=new THREE.Vector3(...workspace.atoms[atomIndex].position).project(camera);return{x:rect.left+(projected.x+1)*rect.width/2,y:rect.top+(1-projected.y)*rect.height/2,rect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}};
    },record.dragIndex);
    const [dragX,dragY]=record.dragDelta??[145,185];
    const target={x:Math.max(point.rect.left+28,Math.min(point.rect.right-28,point.x+dragX)),y:Math.max(point.rect.top+70,Math.min(point.rect.bottom-70,point.y+dragY))};
    await page.mouse.move(point.x,point.y);await page.mouse.down();
    const gesture=await page.evaluate(()=>({cue:document.querySelector('#rotation-cue')?.dataset.state??null,
      cueHidden:document.querySelector('#rotation-cue')?.hidden??null,selection:document.querySelector('#selection-chip')?.textContent??null}));
    await page.mouse.move(target.x,target.y,{steps:2});await page.mouse.up();await page.waitForTimeout(1100);
    await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));const final=await page.evaluate(()=>JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).workspace);
    const checked=solverFor(final),validation=checked.solver.validateConformation({
      rigidReference:remapRigidReference(rigidReference,initialSolver.ids,checked.ids),
    });
    const perAtomMovement=final.atoms.map((atom,index)=>new THREE.Vector3(...atom.position).distanceTo(new THREE.Vector3(...initial.atoms[index].position))),
      movement=Math.max(...perAtomMovement),draggedMovement=perAtomMovement[record.dragIndex];
    if(screenshotDir)await page.screenshot({path:`${screenshotDir}/${record.id}.png`,fullPage:true});
    assert.equal(validation.valid,true,`${record.id}: ${validation.reasons.join(',')}`);assert.equal(errors.length,0,`${record.id}: ${errors.join(' | ')}`);
    if(record.expectMove)assert.ok(draggedMovement>.01,`${record.id}: hostile drag produced no deformation (${JSON.stringify({gesture,point,target})})`);
    else assert.ok(draggedMovement<.01,`${record.id}: structurally unreachable atom followed the pointer`);
    results.push({id:record.id,movement:+movement.toFixed(3),draggedMovement:+draggedMovement.toFixed(3),gesture,ringPenetrations:validation.errors.ringPenetrations,
      bondIntersections:validation.errors.bondIntersections,overlap:+validation.errors.overlapRelative.toFixed(3)});
    await context.close();
  }
}finally{await browser.close();}
console.log(results);
