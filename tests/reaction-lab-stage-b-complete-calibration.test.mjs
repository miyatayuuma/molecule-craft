import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import { createPreviewModel } from '../src/preview-model.js';
import {
  compileReactionCatalog, reactionCandidates, resolveSupplementalParticipants,
  createContactMatcher, CONTACT_DWELL_MS, environmentMatches, REACTION_CATALOG,
  REACTION_FAMILIES,
} from '../src/reaction-lab-core.js';
import {
  canonicalNonbondedPairGeometry, createStageABody, rigidBodyMassProperties,
  REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, STAGE_A_GAME_STEP_SECONDS,
} from '../src/reaction-lab-stage-a.js';
import { createStageBVirtualSites, integrateStageB, STAGE_B_TEST_QA_E } from '../src/reaction-lab-stage-b.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const catalog=compileReactionCatalog(records);
const fixedStepMs=STAGE_A_GAME_STEP_SECONDS*1000;
const physicalStepPs=STAGE_A_GAME_STEP_SECONDS*.10;
const orientationCount=24;
const maximumTrajectorySteps=Math.ceil(CONTACT_DWELL_MS/fixedStepMs)+2;
const bodyCache=new Map();

function canonicalPreviewBody(species,id){
  if(!bodyCache.has(species)){
    const record=byId.get(species);assert.ok(record,`database species ${species}`);
    const model=createPreviewModel(THREE,record);for(let step=0;step<190;step++)model.step();
    const atoms=model.snapshot().atoms.map((atom,index)=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}));
    const massProperties=rigidBodyMassProperties(atoms),runtimeAtoms=atoms.map((atom,index)=>({...atom,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index]}));
    const body=createStageABody({id:`template-${species}`,positionAngstrom:[0,0,0],atoms:runtimeAtoms,massProperties,virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom}))});
    body.stageBVirtualChargeSites=createStageBVirtualSites(body.atoms.map(atom=>({element:atom.element,positionAngstrom:atom.positionAngstrom})),record.bonds,{qA:STAGE_B_TEST_QA_E});
    bodyCache.set(species,body);
  }
  const body=structuredClone(bodyCache.get(species));body.id=id;body.positionAngstrom=[0,0,0];body.orientation=[0,0,0,1];body.velocityAngstromPerPs=[0,0,0];body.angularVelocityRadPerPs=[0,0,0];body.kinematic=false;return body;
}

function deterministicOrientation(index,count,roleOffset=0){
  const sequence=(index+roleOffset)%count,y=1-2*(sequence+.5)/count,r=Math.sqrt(1-y*y),angle=sequence*2.399963229728653+roleOffset*.731,axis=[r*Math.cos(angle),y,r*Math.sin(angle)],turn=((sequence*.61803398875)%1)*Math.PI*2,sine=Math.sin(turn/2);
  return[axis[0]*sine,axis[1]*sine,axis[2]*sine,Math.cos(turn/2)];
}
function rotate([x,y,z],[qx,qy,qz,qw]){
  const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
  return[x+qw*tx+(qy*tz-qz*ty),y+qw*ty+(qz*tx-qx*tz),z+qw*tz+(qx*ty-qy*tx)];
}
function worldAtom(body,index){return rotate(body.atoms[index].positionAngstrom,body.orientation).map((value,axis)=>value+body.positionAngstrom[axis]);}
function placeAtAnchor(bodyA,bodyB,anchorA,anchorB,distance){
  const pointA=rotate(bodyA.atoms[anchorA].positionAngstrom,bodyA.orientation),pointB=rotate(bodyB.atoms[anchorB].positionAngstrom,bodyB.orientation);
  bodyB.positionAngstrom=pointA.map((value,axis)=>value+(axis===0?distance:0)-pointB[axis]);
}
function participantMetrics(bodies){
  let minimumRatio=Infinity,severeOverlap=false,minimumDistance=Infinity;
  for(let first=0;first<bodies.length;first++)for(let second=first+1;second<bodies.length;second++)
    for(let indexA=0;indexA<bodies[first].atoms.length;indexA++)for(let indexB=0;indexB<bodies[second].atoms.length;indexB++){
      const atomA=bodies[first].atoms[indexA],atomB=bodies[second].atoms[indexB],pa=worldAtom(bodies[first],indexA),pb=worldAtom(bodies[second],indexB),distance=Math.hypot(...pa.map((value,axis)=>value-pb[axis]));
      if(!Number.isFinite(distance))throw new Error(`non-finite initial atom pose ${bodies[first].id}:${indexA} ${bodies[second].id}:${indexB} ${JSON.stringify({pa,pb,a:bodies[first].positionAngstrom,b:bodies[second].positionAngstrom,qa:bodies[first].orientation,qb:bodies[second].orientation})}`);
      const physical=canonicalNonbondedPairGeometry(atomA,atomB,distance);minimumRatio=Math.min(minimumRatio,physical.minimumNonbondedSeparationRatio);minimumDistance=Math.min(minimumDistance,distance);severeOverlap||=physical.severeOverlap;
    }
  return{minimumRatio,minimumDistance,severeOverlap};
}
function trajectory(rule,candidate,participants,anchor,orientationA,orientationB){
  const left=candidate.participantInstances[anchor.from.role],right=candidate.participantInstances[anchor.to.role],roleA=participants.find(row=>row.instance.id===left),roleB=participants.find(row=>row.instance.id===right);
  const bodies=participants.map(row=>row.body),bodyByRole=new Map(participants.map(row=>[row.role,row.body]));
  roleA.body.orientation=[...orientationA];roleB.body.orientation=[...orientationB];placeAtAnchor(roleA.body,roleB.body,anchor.from.atomIndex,anchor.to.atomIndex,anchor.target);
  const center=roleA.body.positionAngstrom.map((value,axis)=>(value+roleB.body.positionAngstrom[axis])*.5);
  for(const row of participants)if(row.role!==anchor.from.role&&row.role!==anchor.to.role){row.body.positionAngstrom=[center[0],center[1]+12,center[2]];}
  const initial=participantMetrics(bodies);if(initial.severeOverlap)return null;
  const matcher=createContactMatcher({dwellMs:CONTACT_DWELL_MS}),key=`${rule.id}:${candidate.pathwayId}`;let finite=true,minimum=Infinity,maximum=0,minimumRatio=Infinity,readySteps=0,commitStep=null,overlapGuardActivations=0;
  for(let step=0;step<maximumTrajectorySteps;step++){
    const physics=integrateStageB(bodies,physicalStepPs,{collectPairDiagnostics:false});overlapGuardActivations+=physics.overlapGuardActivationCount??0;
    const from=worldAtom(bodyByRole.get(anchor.from.role),anchor.from.atomIndex),to=worldAtom(bodyByRole.get(anchor.to.role),anchor.to.atomIndex),actual=Math.hypot(...from.map((value,axis)=>value-to[axis]));
    const geometryReady=actual>=anchor.min&&actual<=anchor.max,metrics=participantMetrics(bodies);minimum=Math.min(minimum,actual);maximum=Math.max(maximum,actual);minimumRatio=Math.min(minimumRatio,metrics.minimumRatio);
    const forceRows=[...physics.bodies.values()];finite&&=[...bodies.flatMap(body=>[...body.positionAngstrom,...body.orientation,...body.velocityAngstromPerPs,...body.angularVelocityRadPerPs]),...forceRows.flatMap(row=>[...row.forceKcalMolAngstrom,...row.torqueKcalMolAngstrom])].every(Number.isFinite);
    if(!finite||!Number.isFinite(actual))return null;
    const eligible=geometryReady&&!metrics.severeOverlap;
    if(eligible)readySteps++;
    const committed=matcher.update(key,eligible,fixedStepMs);
    if(committed){commitStep=step+1;break;}
  }
  if(commitStep==null)return null;
  return{orientationA,orientationB,commitStep,steps:readySteps,window:{min:anchor.min,target:anchor.target,max:anchor.max},observed:{min:minimum,max:maximum,minimumNonbondedSeparationRatio:minimumRatio,severeOverlap:false},overlapGuardActivations,finite};
}

function calibrate(rule){
  const family=REACTION_FAMILIES.find(item=>item.id===rule.familyId),encounterRows=rule.reactants.filter(item=>family.roles[item.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
  assert.equal(encounterRows.length,2,`${rule.id} has two encounter roles`);
  const ids=encounterRows.map((_,index)=>`${rule.id}-encounter-${index}`),pair=encounterRows.map((row,index)=>({species:row.species,id:ids[index]}));
  const candidate=reactionCandidates(pair,catalog).find(item=>item.reactionId===rule.id);
  assert.ok(candidate,`${rule.id} exposes its matching encounter pathway to the production catalog`);
  const active=[...encounterRows.map((row,index)=>({id:ids[index],species:row.species,busy:false,batchGeneration:1})),...rule.reactants.filter(item=>family.roles[item.role].participation==='supplemental').map((row,index)=>({id:`${rule.id}-supplemental-${index}`,species:row.species,busy:false,batchGeneration:1}))];
  const resolved=resolveSupplementalParticipants(candidate.reaction,candidate,active,item=>0);
  assert.equal(resolved.ok,true,`${rule.id} has all real supplemental instances`);
  candidate.participantInstances=resolved.participantInstances;
  const participants=rule.reactants.map(row=>{
    const id=candidate.participantInstances[row.role];assert.ok(id,`${rule.id} resolves role ${row.role}`);
    return{role:row.role,instance:{id,species:row.species,busy:false,batchGeneration:1},body:canonicalPreviewBody(row.species,id)};
  });
  const constraint=candidate.geometryConstraints[0];
  let best=null;
  // Bounded, deterministic orientation grid shared by every chemistry rule.
  // Every pair in this 24 × 24 grid uses the same low-discrepancy generator;
  // no reaction-specific orientation seed or force override is supplied.
  for(let first=0;first<orientationCount&&!best;first++)for(let second=0;second<orientationCount&&!best;second++){
    const result=trajectory(rule,candidate,participants.map(row=>({...row,body:structuredClone(row.body)})),constraint,deterministicOrientation(first,orientationCount),deterministicOrientation(second,orientationCount,7));
    if(result)best=result;
  }
  return{rule,candidate,result:best};
}

test('all 29 production rules reach geometry-ready Stage B dwell with a bounded orientation search',()=>{
  const results=[];
  for(const rule of REACTION_CATALOG){
    // The compiler validated every canonical environment; this runtime check
    // confirms one concrete state satisfies the rule before trajectory work.
    assert.ok(environmentMatches(rule,new Set([...rule.requires])),`${rule.id} has a valid activation subset`);
    const calibration=calibrate(rule);
    assert.ok(calibration.result,`${rule.id} has at least one deterministic Stage B trajectory with geometryReady dwell, finite body state and no severe overlap`);
    assert.equal(calibration.result.finite,true);
    assert.equal(calibration.result.observed.severeOverlap,false);
    assert.ok(calibration.result.observed.minimumNonbondedSeparationRatio>=.75);
    assert.ok(calibration.result.commitStep*fixedStepMs>=CONTACT_DWELL_MS);
    results.push({reaction:rule.id,family:rule.familyId,pathway:calibration.candidate.pathwayId,commitStep:calibration.result.commitStep,orientationCount,window:calibration.result.window,observed:calibration.result.observed,overlapGuardActivations:calibration.result.overlapGuardActivations});
  }
  assert.equal(results.length,29);
  console.log(`REACTION_STAGE_B_COMPLETE_CALIBRATION ${JSON.stringify({physics:'production-stage-b',qA:STAGE_B_TEST_QA_E,previewRelaxationSteps:190,orientationPairs:orientationCount**2,fixedStepMs,dwellMs:CONTACT_DWELL_MS,results})}`);
});
