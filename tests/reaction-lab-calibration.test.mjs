import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import { createPreviewModel } from '../src/preview-model.js';
import { compileReactionCatalog, reactionCandidates, createContactMatcher, CONTACT_DWELL_MS } from '../src/reaction-lab-core.js';
import { createStageABody, rigidBodyMassProperties, REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, canonicalNonbondedPairGeometry, STAGE_A_GAME_STEP_SECONDS } from '../src/reaction-lab-stage-a.js';
import { integrateStageB, createStageBVirtualSites, STAGE_B_TEST_QA_E } from '../src/reaction-lab-stage-b.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const catalog=compileReactionCatalog(records);
const fixedStepMs=STAGE_A_GAME_STEP_SECONDS*1000;
const physicalStepPs=STAGE_A_GAME_STEP_SECONDS*.10;

function calibratedBody(record,id){
  const model=createPreviewModel(THREE,record);for(let step=0;step<190;step++)model.step();
  const snapshot=model.snapshot(),sourceAtoms=snapshot.atoms.map((atom,index)=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/REACTION_LAB_WORLD_UNITS_PER_ANGSTROM)}));
  const massProperties=rigidBodyMassProperties(sourceAtoms),atoms=sourceAtoms.map((atom,index)=>({...atom,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index]}));
  const body=createStageABody({id,positionAngstrom:[0,0,0],atoms,massProperties,virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom}))});
  body.stageBVirtualChargeSites=createStageBVirtualSites(body.atoms.map(atom=>({element:atom.element,positionAngstrom:atom.positionAngstrom})),record.bonds,{qA:STAGE_B_TEST_QA_E});
  return body;
}
function deterministicOrientation(index,count,phase=0){
  const y=1-2*(index+.5)/count,r=Math.sqrt(1-y*y),angle=index*2.399963229728653+phase,axis=[r*Math.cos(angle),y,r*Math.sin(angle)],rotation=(index*.61803398875%1)*Math.PI*2,sine=Math.sin(rotation/2);
  return[axis[0]*sine,axis[1]*sine,axis[2]*sine,Math.cos(rotation/2)];
}
function rotate([x,y,z],[qx,qy,qz,qw]){
  const tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);
  return[x+qw*tx+(qy*tz-qz*ty),y+qw*ty+(qz*tx-qx*tz),z+qw*tz+(qx*ty-qy*tx)];
}
function alignReactionSites(a,b,atomA,atomB,separationAngstrom,orientationA,orientationB){
  a.orientation=[...orientationA];b.orientation=[...orientationB];
  const pointA=rotate(a.atoms[atomA].positionAngstrom,a.orientation),pointB=rotate(b.atoms[atomB].positionAngstrom,b.orientation);
  b.positionAngstrom=[pointA[0]+separationAngstrom-pointB[0],pointA[1]-pointB[1],pointA[2]-pointB[2]];
}
function measurePair(a,b,siteA,siteB){
  const from=rotate(a.atoms[siteA].positionAngstrom,a.orientation).map((value,index)=>value+a.positionAngstrom[index]),to=rotate(b.atoms[siteB].positionAngstrom,b.orientation).map((value,index)=>value+b.positionAngstrom[index]);
  const actualSiteDistance=Math.hypot(...from.map((value,index)=>value-to[index]));let minimumRealAtomDistance=Infinity,minimumNonbondedSeparationRatio=Infinity,severeOverlap=false;
  for(const atomA of a.atoms)for(const atomB of b.atoms){
    const pa=rotate(atomA.positionAngstrom,a.orientation).map((value,index)=>value+a.positionAngstrom[index]),pb=rotate(atomB.positionAngstrom,b.orientation).map((value,index)=>value+b.positionAngstrom[index]),distance=Math.hypot(...pa.map((value,index)=>value-pb[index]));
    const geometry=canonicalNonbondedPairGeometry(atomA,atomB,distance);minimumRealAtomDistance=Math.min(minimumRealAtomDistance,distance);minimumNonbondedSeparationRatio=Math.min(minimumNonbondedSeparationRatio,geometry.minimumNonbondedSeparationRatio);severeOverlap||=geometry.severeOverlap;
  }
  return{actualSiteDistance,minimumRealAtomDistance,minimumNonbondedSeparationRatio,severeOverlap};
}

for(const fixture of [
  {name:'hydrolysis',nucleophile:'water',oxygenIndex:0,rotationSeed:88},
  {name:'alcoholysis',nucleophile:'ethanol',oxygenIndex:2,rotationSeed:35},
])test(`production Stage B calibration: ${fixture.name} supports the final global dwell without exclusion or overlap`,()=>{
  const candidates=reactionCandidates([{species:'acetic-anhydride',id:'anhydride'},{species:fixture.nucleophile,id:'nucleophile'}],catalog),candidate=candidates.find(item=>item.bindings.primary.center===1&&item.bindings.transferPair.incoming===fixture.oxygenIndex);
  assert.ok(candidate,`compiled ${fixture.name} pathway exists`);
  const a=calibratedBody(byId.get('acetic-anhydride'),'anhydride'),b=calibratedBody(byId.get(fixture.nucleophile),'nucleophile'),orientationA=deterministicOrientation(fixture.rotationSeed,180),orientationB=deterministicOrientation((fixture.rotationSeed*73)%180,180,.7);
  alignReactionSites(a,b,1,fixture.oxygenIndex,2.7,orientationA,orientationB);
  const constraint=candidate.geometryConstraints[0],matcher=createContactMatcher({dwellMs:CONTACT_DWELL_MS}),key=`${candidate.reactionId}:${candidate.pathwayId}`;let ready=false,minimum=Infinity,maximum=0,minimumRatio=Infinity,activationCount=0,firstStepElapsed=null;
  // This pose models direct drag release into the reaction-ready manifold.
  // All subsequent movement is the unmodified production Stage B rigid-body
  // integrator, including both forces and torques.
  for(let step=0;step<64;step++){
    const physics=integrateStageB([a,b],physicalStepPs,{collectPairDiagnostics:false});activationCount+=physics.overlapGuardActivationCount??0;
    const diagnostics=measurePair(a,b,1,fixture.oxygenIndex),geometryReady=diagnostics.actualSiteDistance>=constraint.min&&diagnostics.actualSiteDistance<=constraint.max;
    minimum=Math.min(minimum,diagnostics.actualSiteDistance);maximum=Math.max(maximum,diagnostics.actualSiteDistance);minimumRatio=Math.min(minimumRatio,diagnostics.minimumNonbondedSeparationRatio);
    assert.equal(diagnostics.severeOverlap,false,`${fixture.name} fixture must remain outside the canonical soft-core boundary at step ${step}`);
    assert.equal(geometryReady,true,`${fixture.name} full-body trajectory leaves the family window at step ${step}: ${JSON.stringify({...diagnostics,window:[constraint.min,constraint.max]})}`);
    ready=matcher.update(key,geometryReady&&!diagnostics.severeOverlap,fixedStepMs);
    if(step===0)firstStepElapsed=matcher.elapsed(key);
    if(step===0||step===1)assert.equal(ready,false,'the first eligible fixed step starts dwell at zero, then measures only completed NORMAL Stage B intervals');
    if(step===2)assert.equal(ready,true,'the calibrated global dwell is reached after two fixed-step intervals');
  }
  assert.equal(firstStepElapsed,0);assert.equal(ready,true);assert.ok(minimum>=constraint.min);assert.ok(maximum<=constraint.max);
  assert.ok(Number.isFinite(minimumRatio));
  console.log(`REACTION_CALIBRATION ${JSON.stringify({reaction:candidate.reactionId,family:candidate.familyId,qA:STAGE_B_TEST_QA_E,steps:64,fixedStepMs,windowAngstrom:{min:constraint.min,target:constraint.target,max:constraint.max},siteDistanceRetentionAngstrom:{min:minimum,max:maximum},minimumRealAtomSeparationRatio:minimumRatio,severeOverlap:false,overlapGuardActivations:activationCount,requiredDwellMs:CONTACT_DWELL_MS,firstCommitReadyStep:2})}`);
});
