#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.min.js';
import { createPreviewModel } from '../src/preview-model.js';
import { modelAtomRadius } from '../src/chemistry.js';
import { compileReactionCatalog, reactionCandidates } from '../src/reaction-lab-core.js';
import {
  createStageABody, REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,
  STAGE_A_GAME_STEP_SECONDS, STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
} from '../src/reaction-lab-stage-a.js';
import {
  createStageBPairSafetyOracle, createStageBVirtualSites,
  evaluateStageBForces, integrateStageB, STAGE_B_TEST_QA_E,
} from '../src/reaction-lab-stage-b.js';
import { MAX_DOCK_RELEASE_SEPARATION_ACCELERATION, minimumMoleculeSurfaceGap, solveDepthDocking, solveSafeDepthDocking } from '../src/reaction-lab-manipulation.js';

const records = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
const byId = new Map(records.map(record => [record.id, record]));
const catalog = compileReactionCatalog(records);
const scale = REACTION_LAB_WORLD_UNITS_PER_ANGSTROM;
const dt = STAGE_A_GAME_STEP_SECONDS * STAGE_A_PHYSICAL_PS_PER_GAME_SECOND;
const axis = [0, 0, -1];
const add = (a,b) => a.map((value,index)=>value+b[index]);
const sub = (a,b) => a.map((value,index)=>value-b[index]);
const dot = (a,b) => a.reduce((sum,value,index)=>sum+value*b[index],0);
const norm = value => Math.hypot(...value);
const rotate = (p,q) => { const [x,y,z,w]=q,[px,py,pz]=p,tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px); return [px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*ty),pz+w*tz+(x*ty-y*tx)]; };

function buildBody(id,species,positionAngstrom=[0,0,0],orientation=[0,0,0,1]) {
  const record=byId.get(species),model=createPreviewModel(THREE,record);
  for(let step=0;step<190;step++)model.step();
  const source=model.snapshot().atoms.map(atom=>({element:atom.element,positionAngstrom:atom.point.toArray().map(value=>value/scale)}));
  const atoms=source.map((atom,index)=>({...atom,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index]}));
  const body=createStageABody({id,positionAngstrom:[...positionAngstrom],orientation:[...orientation],atoms,virtualChargeSites:record.nonbonded.virtualChargeSites.map(site=>({chargeE:site.chargeE,positionAngstrom:site.positionAngstromAngstrom??site.positionAngstrom}))});
  body.stageBVirtualChargeSites=createStageBVirtualSites(body.atoms,record.bonds,{qA:STAGE_B_TEST_QA_E});
  return body;
}
function visualShape(body) {
  return {center:body.positionAngstrom.map(value=>value*scale),orientation:body.orientation,atoms:body.atoms.map(atom=>({position:atom.positionAngstrom.map(value=>value*scale),radius:modelAtomRadius(atom.element)}))};
}
function atomPositions(body) { return body.atoms.map(atom=>add(body.positionAngstrom,rotate(atom.positionAngstrom,body.orientation))); }
function minAtomDistance(a,b) { return Math.min(...atomPositions(a).flatMap(left=>atomPositions(b).map(right=>norm(sub(left,right))))); }
function stageBMeasure(a,b) {
  const result=evaluateStageBForces([a,b]);
  const bodyA=result.bodies.get(a.id),bodyB=result.bodies.get(b.id);
  return {energyKcalMol:[...result.bodies.values()].reduce((sum,row)=>sum+row.energyKcalMol,0),coulombPotentialKcalMol:result.pairDiagnostics.reduce((sum,row)=>sum+row.coulombEnergyKcalMol,0),ljPotentialKcalMol:result.pairDiagnostics.reduce((sum,row)=>sum+row.ljEnergyKcalMol,0),carbonylAnisotropyPotentialKcalMol:result.pairDiagnostics.reduce((sum,row)=>sum+(row.stageBAnisotropyCoulombEnergyKcalMol??0),0),overlapGuardActivationCount:result.overlapGuardActivationCount,minAtomDistanceAngstrom:minAtomDistance(a,b),stageBCarbonylTorqueMagnitudeKcalMolAngstrom:Math.hypot(...(bodyA.stageBCorrectionTorqueKcalMolAngstrom??[0,0,0]),...(bodyB.stageBCorrectionTorqueKcalMolAngstrom??[0,0,0]))};
}
function cloneBody(body) { return {...body,positionAngstrom:[...body.positionAngstrom],orientation:[...body.orientation],velocityAngstromPerPs:[...body.velocityAngstromPerPs],angularVelocityRadPerPs:[...body.angularVelocityRadPerPs]}; }
function releaseTrajectory(a,b,normal=axis) {
  return [3,8,16].map(steps=>{
    const left=cloneBody(a),right=cloneBody(b),initial=Math.abs(dot(sub(left.positionAngstrom,right.positionAngstrom),normal));
    for(let step=0;step<steps;step++)integrateStageB([left,right],dt,{collectPairDiagnostics:false});
    const separation=Math.abs(dot(sub(left.positionAngstrom,right.positionAngstrom),normal));
    return {steps,centerDepthSeparationAngstrom:+separation.toFixed(6),increaseAngstrom:+(separation-initial).toFixed(6),minimumRealAtomDistanceAngstrom:+minAtomDistance(left,right).toFixed(6)};
  });
}
function contactAndSafe(speciesA,speciesB) {
  const target=buildBody(`${speciesA}-target`,speciesA,[0,0,0]),dragged=buildBody(`${speciesB}-dragged`,speciesB,[0,0,5/scale]);
  const targetShape=visualShape(target),draggedShape=visualShape(dragged),previousCenter=[0,0,5],contact=solveDepthDocking({dragged:draggedShape,target:targetShape,cameraNormal:axis,previousCenter});
  const contactWorldCenter=contact.center,contactCenterAngstrom=contactWorldCenter.map(value=>value/scale),contactBranch=Math.sign(dot(sub(contactCenterAngstrom,target.positionAngstrom),axis))||1;
  const contactBody=cloneBody(dragged);contactBody.positionAngstrom=contactCenterAngstrom;
  const contactOracle=createStageBPairSafetyOracle(contactBody,target),contactSafety=contactOracle({draggedPositionAngstrom:contactCenterAngstrom,targetPositionAngstrom:target.positionAngstrom,cameraNormal:axis,branchSign:contactBranch}),contactMeasure=stageBMeasure(contactBody,target);
  const oracle=createStageBPairSafetyOracle(dragged,target);
  const safe=solveSafeDepthDocking({dragged:draggedShape,target:targetShape,cameraNormal:axis,previousCenter,outwardAccelerationAt:(center,_offset,branchSign)=>oracle({draggedPositionAngstrom:center.map(value=>value/scale),targetPositionAngstrom:target.positionAngstrom,cameraNormal:axis,branchSign}).outwardRelativeAcceleration,worldUnitsPerAngstrom:scale});
  if(!safe)throw new Error(`No safe pose in bounded search for ${speciesA}/${speciesB}`);
  dragged.positionAngstrom=safe.center.map(value=>value/scale);
  const safeSafety=oracle({draggedPositionAngstrom:dragged.positionAngstrom,targetPositionAngstrom:target.positionAngstrom,cameraNormal:axis,branchSign:safe.branchSign});
  const safeMeasure=stageBMeasure(dragged,target);
  const energyReport=measure=>({stageBPotentialKcalMol:+measure.energyKcalMol.toFixed(3),coulombPotentialKcalMol:+measure.coulombPotentialKcalMol.toFixed(3),ljPotentialKcalMol:+measure.ljPotentialKcalMol.toFixed(3),carbonylAnisotropyPotentialKcalMol:+measure.carbonylAnisotropyPotentialKcalMol.toFixed(3)});
  return {target,dragged,report:{pair:`${speciesA} / ${speciesB}`,oldVisualContact:{centerDepthAngstrom:+(contact.center[2]/scale).toFixed(6),visualGapWorld:+contact.minimumSurfaceGap.toFixed(6),minimumAtomDistanceAngstrom:+contactMeasure.minAtomDistanceAngstrom.toFixed(6),...energyReport(contactMeasure),outwardRelativeAcceleration:+contactSafety.outwardRelativeAcceleration.toFixed(3),release:releaseTrajectory(contactBody,target)},newSafeEndpoint:{centerDepthAngstrom:+(safe.center[2]/scale).toFixed(6),visualGapWorld:+minimumMoleculeSurfaceGap({dragged:visualShape(dragged),target:visualShape(target)}).toFixed(6),minimumAtomDistanceAngstrom:+safeMeasure.minAtomDistanceAngstrom.toFixed(6),...energyReport(safeMeasure),stageBCarbonylTorqueMagnitudeKcalMolAngstrom:+safeMeasure.stageBCarbonylTorqueMagnitudeKcalMolAngstrom.toFixed(6),outwardRelativeAcceleration:+safeSafety.outwardRelativeAcceleration.toFixed(3),searchDistanceAngstrom:+safe.safetySearchDistanceAngstrom.toFixed(3),querySamples:safe.safetySampleCount,release:releaseTrajectory(dragged,target)}}};
}
function seededRandom(seed) { return () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; }; }
function randomQuaternion(random) { const axis=[random()*2-1,random()*2-1,random()*2-1],magnitude=norm(axis)||1,angle=random()*Math.PI*2,sine=Math.sin(angle/2)/magnitude;return[axis[0]*sine,axis[1]*sine,axis[2]*sine,Math.cos(angle/2)]; }
function settledFixtures() {
  const rows=[];
  for(const [speciesA,speciesB] of [['water','water'],['water','carbon-dioxide'],['water','acetone']])for(let seed=1;seed<=3;seed++){
    const random=seededRandom(20260927+seed*97+speciesA.length*31+speciesB.length),a=buildBody('settled-A',speciesA,[0,0,0],randomQuaternion(random)),b=buildBody('settled-B',speciesB,[6.5,0,0],randomQuaternion(random));
    for(let step=0;step<6000;step++)integrateStageB([a,b],dt,{collectPairDiagnostics:false});
    const delta=sub(b.positionAngstrom,a.positionAngstrom),distance=norm(delta),normal=delta.map(value=>value/(distance||1)),oracle=createStageBPairSafetyOracle(b,a),safety=oracle({draggedPositionAngstrom:b.positionAngstrom,targetPositionAngstrom:a.positionAngstrom,cameraNormal:normal,branchSign:1});
    rows.push({pair:`${speciesA}/${speciesB}`,seed,minimumAtomDistanceAngstrom:+minAtomDistance(a,b).toFixed(3),energyKcalMol:+stageBMeasure(a,b).energyKcalMol.toFixed(3),outwardRelativeAcceleration:+safety.outwardRelativeAcceleration.toFixed(3)});
  }
  return rows;
}
function orientation(index,count,phase=0){const y=1-2*(index+.5)/count,r=Math.sqrt(1-y*y),angle=index*2.399963229728653+phase,axis=[r*Math.cos(angle),y,r*Math.sin(angle)],turn=(index*.61803398875%1)*Math.PI*2,sine=Math.sin(turn/2);return[axis[0]*sine,axis[1]*sine,axis[2]*sine,Math.cos(turn/2)];}
function reactionReady(species,oxygenIndex,seed,reactionId,siteDistanceAngstrom){
  const anhydride=buildBody('anhydride','acetic-anhydride'),nucleophile=buildBody('nucleophile',species),aQ=orientation(seed,180),bQ=orientation((seed*73)%180,180,.7);anhydride.orientation=aQ;nucleophile.orientation=bQ;
  const siteA=rotate(anhydride.atoms[1].positionAngstrom,aQ),siteB=rotate(nucleophile.atoms[oxygenIndex].positionAngstrom,bQ);nucleophile.positionAngstrom=siteA.map((value,index)=>value+(index===0?siteDistanceAngstrom:0)-siteB[index]);
  const candidate=reactionCandidates([{species:'acetic-anhydride',id:anhydride.id},{species,id:nucleophile.id}],catalog).find(row=>row.reactionId===reactionId&&row.bindings.acyl?.acylC===1&&row.bindings.nucleophile?.oxygen===oxygenIndex);
  if(!candidate)throw Error(`Missing compiled ${reactionId} calibration candidate`);
  const constraint=candidate.geometryConstraints[0],delta=sub(nucleophile.positionAngstrom,anhydride.positionAngstrom),distance=norm(delta),axis=delta.map(value=>value/(distance||1)),oracle=createStageBPairSafetyOracle(nucleophile,anhydride),safety=oracle({draggedPositionAngstrom:nucleophile.positionAngstrom,targetPositionAngstrom:anhydride.positionAngstrom,cameraNormal:axis,branchSign:1});
  let severeOverlap=false,minimumRatio=Infinity;
  for(const atomA of anhydride.atoms)for(const atomB of nucleophile.atoms){const pa=add(anhydride.positionAngstrom,rotate(atomA.positionAngstrom,anhydride.orientation)),pb=add(nucleophile.positionAngstrom,rotate(atomB.positionAngstrom,nucleophile.orientation)),r=norm(sub(pa,pb)),sigma=(atomA.sigmaAngstrom+atomB.sigmaAngstrom)/2;minimumRatio=Math.min(minimumRatio,r/sigma);severeOverlap||=r<.75*sigma;}
  return {reactionId,species,siteDistanceAngstrom,reactionWindowAngstrom:{min:+constraint.min.toFixed(4),target:+constraint.target.toFixed(4),max:+constraint.max.toFixed(4)},geometryReady:siteDistanceAngstrom>=constraint.min&&siteDistanceAngstrom<=constraint.max,minimumNonbondedRatio:+minimumRatio.toFixed(3),severeOverlap,outwardRelativeAcceleration:+safety.outwardRelativeAcceleration.toFixed(3)};
}

const pairs=[contactAndSafe('water','water'),contactAndSafe('water','carbon-dioxide'),contactAndSafe('water','acetone'),contactAndSafe('water','methane')];
const settled=settledFixtures();
const reactions=[reactionReady('water',0,88,'anhydride-hydrolysis',3.174),reactionReady('ethanol',2,35,'anhydride-alcoholysis',2.911)];
const globalSafetyThreshold=MAX_DOCK_RELEASE_SEPARATION_ACCELERATION;
assert.ok(pairs.every(row=>row.report.oldVisualContact.outwardRelativeAcceleration>globalSafetyThreshold),'all visual-contact controls must be unsafe');
assert.ok(pairs.every(row=>row.report.newSafeEndpoint.outwardRelativeAcceleration<=globalSafetyThreshold),'all new endpoints must meet the global limit');
assert.ok(settled.every(row=>row.outwardRelativeAcceleration<=globalSafetyThreshold),'representative naturally settled poses must be safe');
assert.ok(reactions.every(row=>row.geometryReady&&!row.severeOverlap&&row.outwardRelativeAcceleration<=globalSafetyThreshold),'PR #308 reaction-ready non-overlap poses must be safe');
console.log(JSON.stringify({schemaVersion:1,physics:'production Stage B, qA=0.15, fixed step 1/120 game s × 0.10 physical ps/game s',globalSafetyThreshold,globalSafetyThresholdBasis:{calibrationRule:'round upward to 150 Å/ps², giving 28% margin over the largest measured PR #308 non-overlap reaction-ready pose',oldVisualContactUnsafe:true,settledOutwardAccelerationRange:[Math.min(...settled.map(row=>row.outwardRelativeAcceleration)),Math.max(...settled.map(row=>row.outwardRelativeAcceleration))],reactionReadyOutwardAccelerationRange:[Math.min(...reactions.map(row=>row.outwardRelativeAcceleration)),Math.max(...reactions.map(row=>row.outwardRelativeAcceleration))]},pairs:pairs.map(row=>row.report),settled,reactionReady:reactions},null,2));
