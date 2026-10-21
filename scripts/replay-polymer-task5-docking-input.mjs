// Owner: Task⑤ PET recovery. Read-only replay of the actual release instant;
// this proves a reachable safe endpoint, not a browser gesture or swept path.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from '../vendor/three/three.module.min.js';
import {modelAtomRadius} from '../src/chemistry.js';
const bytes=await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/sequential-pet-docking-input.json',import.meta.url)),input=JSON.parse(bytes);
const sha=value=>createHash('sha256').update(value).digest('hex'),before=JSON.stringify(input),normal=new THREE.Vector3(0,0,1).applyQuaternion(new THREE.Quaternion(...input.camera.quaternion)),q=new THREE.Quaternion(...input.incoming.quaternion);
const rows=input.candidatePoses.map(candidate=>{
  const position=new THREE.Vector3(...candidate.position),travel=position.clone().sub(new THREE.Vector3(...input.incoming.position)),depth=travel.dot(normal),lateral=travel.clone().addScaledVector(normal,-depth).length(),overlaps=[];
  for(const a of input.incoming.atoms){const world=new THREE.Vector3(...a.local).applyQuaternion(q).add(position);for(const b of input.fragment){if(a.index===input.interaction.incomingAtomIndex&&b.index===input.interaction.fragmentAtomIndex)continue;const distance=world.distanceTo(new THREE.Vector3(...b.point)),minimum=(modelAtomRadius(a.element)+modelAtomRadius(b.element))*.58;if(distance<minimum)overlaps.push({incoming:a.index,fragment:b.index,distance,minimum});}}
  const incoming=input.incoming.atoms[input.interaction.incomingAtomIndex],site=new THREE.Vector3(...incoming.local).applyQuaternion(q).add(position),bondDistance=site.distanceTo(new THREE.Vector3(...input.target)),safe=overlaps.length===0&&Math.abs(bondDistance-1.48*.78)<=.03;
  return{position:candidate.position,travel:travel.length(),lateral,depth,bondDistance,overlaps,safe,legacyReachable:safe&&travel.length()<=2.8,depthResolvedReachable:safe&&lateral<=2.8};
});
const oldSafe=rows.filter(p=>p.legacyReachable),recovered=rows.filter(p=>p.depthResolvedReachable).sort((a,b)=>a.travel-b.travel),report={kind:'FROZEN_ACTUAL_RELEASE_ENDPOINT_REPLAY_NOT_BROWSER_ACCEPTANCE',inputSHA256:sha(bytes),graphDigest:sha(JSON.stringify(input.core.fragment)),routeId:input.routeId,generation:input.batch.generation,instanceId:input.incoming.id,oldSafePoseCount:oldSafe.length,recoveredSafePoseCount:recovered.length,selected:recovered[0]??null,rows,unchanged:before===JSON.stringify(input),pass:oldSafe.length===0&&recovered.length>0&&before===JSON.stringify(input)};
await mkdir('test-results/task5-solver',{recursive:true});await writeFile('test-results/task5-solver/docking-replay.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rows:undefined},null,2));if(!report.pass)process.exitCode=1;
