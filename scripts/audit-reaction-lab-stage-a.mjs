#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  createStageABody, evaluateStageAForces, integrateStageA,
  STAGE_A_GAME_STEP_SECONDS, STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
  lennardJonesPairEnergyForce, coulombPairEnergyForce,
} from '../src/reaction-lab-stage-a.js';

const ROOT = new URL('../', import.meta.url);
const OUTPUT = new URL('../generated/reaction-lab-stage-a-audit.json', import.meta.url);
const db = JSON.parse(await readFile(new URL('../data/molecules.json', import.meta.url), 'utf8'));
const records = new Map(db.map(record => [record.id, record]));
const ENGINE_VERSION = 'reaction-lab-stage-a-v1';
const canonicalData={parameterSet:'reaction-lab-nonbonded-v1',molecules:db.map(record=>[record.id,record.nonbonded.atomicChargesE,record.nonbonded.sigmaAngstrom,record.nonbonded.epsilonKcalMol])};
const canonicalDatasetSha256=createHash('sha256').update(JSON.stringify(canonicalData)).digest('hex');
const SETTLE_STEPS = 6000;
const DETECTION_SEEDS = 24;
const EPS = 1e-12;

const structures = {
  water: [[0,0,0],[0.75695,0,0.58588],[-0.75695,0,0.58588]],
  acetone: [[-1.50,0,0],[0,0,0],[1.50,0,0],[0,1.22,0],[-2.13,-0.51,0.89],[-2.13,-0.51,-0.89],[-2.13,1.02,0],[-0.87,-0.51,0.89],[-0.87,-0.51,-0.89],[2.13,-0.51,0.89]],
  pyridine: [[1.39,0,0],[0.695,1.204,0],[-0.695,1.204,0],[-1.39,0,0],[-0.695,-1.204,0],[0.695,-1.204,0],[1.39,1.08,0],[-1.235,2.14,0],[-2.64,0,0],[-1.235,-2.14,0],[1.235,-2.14,0]],
  methane: [[0,0,0],[0.629,0.629,0.629],[0.629,-0.629,-0.629],[-0.629,0.629,-0.629],[-0.629,-0.629,0.629]],
  'carbon-dioxide': [[0,0,0],[-1.16,0,0],[1.16,0,0]],
  oxygen: [[-0.605,0,0],[0.605,0,0]],
  nitrogen: [[-0.55,0,0],[0.55,0,0]],
  'carbonic-acid': [[0,0,0],[1.23,0,0],[-0.615,1.065,0],[-0.615,-1.065,0],[-1.08,1.87,0],[-1.08,-1.87,0]],
};

function rng(seed) { let state = seed >>> 0; return () => { state = (1664525 * state + 1013904223) >>> 0; return state / 0x100000000; }; }
function quaternion(axis, angle) { const size=Math.hypot(...axis)||1, scale=Math.sin(angle/2)/size; return [...axis.map(value=>value*scale),Math.cos(angle/2)]; }
function seededQuaternion(random) { return quaternion([random()*2-1,random()*2-1,random()*2-1],random()*Math.PI*2); }
function rotate(point,q) { const [x,y,z,w]=q,[px,py,pz]=point; const tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px); return [px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*tz),pz+w*tz+(x*ty-y*tx)]; }
function plus(a,b){return a.map((value,index)=>value+b[index]);}
function minus(a,b){return a.map((value,index)=>value-b[index]);}
function norm(a){return Math.hypot(...a);}
function dot(a,b){return a.reduce((sum,value,index)=>sum+value*b[index],0);}
function angle(a,b){return Math.acos(Math.max(-1,Math.min(1,dot(a,b)/(norm(a)*norm(b)||1))))*180/Math.PI;}
function vectorFrom(a,b){return minus(b,a);}

if(process.argv.includes('--check')){
  const saved=JSON.parse(await readFile(OUTPUT,'utf8'));
  const expectedFixtures=['water-water','water-acetone','water-pyridine','water-methane','water-carbon-dioxide','water-oxygen','water-nitrogen','carbonic-acid-carbon-dioxide'];
  const knownFailures=['needs-anisotropy-stage-b','nonbonded-model-review','water-integration-review','implementation-bug'];
  const finiteTree=value=>typeof value==='number'?Number.isFinite(value):Array.isArray(value)?value.every(finiteTree):value&&typeof value==='object'?Object.values(value).every(finiteTree):true;
  const valid=saved.schemaVersion===1&&saved.parameterSet==='reaction-lab-nonbonded-v1'&&saved.physicsEngineVersion===ENGINE_VERSION&&saved.canonicalDatasetSha256===canonicalDatasetSha256&&expectedFixtures.every(id=>saved.fixtures?.[id]&&typeof saved.fixtures[id].pass==='boolean'&&Number.isInteger(saved.fixtures[id].orientationCount)&&Number.isFinite(saved.fixtures[id].lowestEnergyKcalMol))&&finiteTree(saved)&&Array.isArray(saved.failureClassification)&&saved.productionCutover===(saved.globalResult==='PASS')&&((saved.globalResult==='PASS'&&saved.failureClassification.length===0)||(saved.globalResult==='FAIL'&&saved.failureClassification.length===1&&knownFailures.includes(saved.failureClassification[0])))&&saved.continuity&&['waterWater','waterAcetone','waterPyridine'].every(id=>saved.continuity[id]?.finite===true&&saved.continuity[id]?.orientationScan?.finite===true&&saved.continuity[id]?.forceEnergyDerivativeCheck?.pass===true&&saved.continuity[id]?.normalRegionGuardActivations===0)&&saved.partnerExchange?.pass===true&&saved.partnerExchange?.historyIndependent===true&&saved.drag?.pass===true;
  if(!valid){console.error('Committed Stage A audit failed schema, canonical hash, fixture, continuity, or cutover consistency validation.');process.exitCode=1;}
  else console.log(`Stage A audit data check clean: ${expectedFixtures.length} fixtures; ${saved.globalResult}; ${saved.failureClassification.join(', ')||'all gates pass'}.`);
  process.exit();
}

function makeAtoms(id) {
  const record=records.get(id); if(!record) throw Error(`Missing molecule record ${id}`);
  return structures[id].map((positionAngstrom,index)=>({element:record.atoms[index],positionAngstrom,chargeE:record.nonbonded.atomicChargesE[index],sigmaAngstrom:record.nonbonded.sigmaAngstrom[index],epsilonKcalMol:record.nonbonded.epsilonKcalMol[index]}));
}
function makeBody(id,name,position,orientation) { return createStageABody({id,positionAngstrom:position,orientation,atoms:makeAtoms(name)}); }
function pairEnergy(bodies) { return evaluateStageAForces(bodies).pairDiagnostics.reduce((sum,pair)=>sum+pair.totalEnergyKcalMol,0); }
function bodyAtomPosition(body,index) { return plus(body.positionAngstrom,rotate(body.atoms[index].positionAngstrom,body.orientation)); }
function pairMeasures(left,right,leftName,rightName) {
  const leftRecord=records.get(leftName),rightRecord=records.get(rightName),positionsA=leftRecord.atoms.map((_,i)=>bodyAtomPosition(left,i)),positionsB=rightRecord.atoms.map((_,i)=>bodyAtomPosition(right,i));
  const measures={energyKcalMol:pairEnergy([left,right]),overlapGuardActivationCount:evaluateStageAForces([left,right]).overlapGuardActivationCount,centerDistanceAngstrom:norm(vectorFrom(left.positionAngstrom,right.positionAngstrom))};
  if(leftName==='water'&&rightName==='water'){
    measures.oxygenDistanceAngstrom=norm(vectorFrom(positionsA[0],positionsB[0]));
    measures.donorAnglesDeg=[1,2].map(index=>angle(vectorFrom(positionsA[index],positionsA[0]),vectorFrom(positionsA[index],positionsB[0])));
    measures.donorLinearityDeg=Math.max(...measures.donorAnglesDeg);
    measures.oneDonorOneAcceptor=measures.donorLinearityDeg>=150;
  }
  if(leftName==='water'&&rightName==='acetone'){
    const oxygen=positionsB[3],carbon=positionsB[1];
    const candidates=[1,2].map(hydrogen=>({distance: norm(vectorFrom(positionsA[hydrogen],oxygen)),donorAngle:angle(vectorFrom(positionsA[hydrogen],positionsA[0]),vectorFrom(positionsA[hydrogen],oxygen)),acceptorAngle:angle(vectorFrom(oxygen,carbon),vectorFrom(oxygen,positionsA[hydrogen])),outOfPlaneDeg:angle([0,0,1],vectorFrom(oxygen,positionsA[hydrogen]))}));
    measures.acceptorGeometry=candidates.sort((a,b)=>a.distance-b.distance)[0];
  }
  if(leftName==='water'&&rightName==='pyridine'){
    const nitrogen=positionsB[0],hydrogens=[1,2].map(index=>({index,distance:norm(vectorFrom(positionsA[index],nitrogen)),donorAngle:angle(vectorFrom(positionsA[index],positionsA[0]),vectorFrom(positionsA[index],nitrogen)),outsideN:dot(vectorFrom(nitrogen,positionsA[index]),vectorFrom(nitrogen,positionsB[1]))<0}));
    measures.acceptorGeometry=hydrogens.sort((a,b)=>a.distance-b.distance)[0];
  }
  measures.minimumIntermolecularAtomDistanceAngstrom=Math.min(...positionsA.flatMap(a=>positionsB.map(b=>norm(vectorFrom(a,b)))));
  return measures;
}
function settlePair(leftName,rightName,seed,{startDistance=6.5,steps=SETTLE_STEPS}={}){
  const random=rng(seed),left=makeBody(`A-${seed}`,leftName,[0,0,0],seededQuaternion(random)),right=makeBody(`B-${seed}`,rightName,[startDistance,0,0],seededQuaternion(random));
  let guardTotal=0;
  for(let step=0;step<steps;step++) guardTotal+=integrateStageA([left,right],STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND).overlapGuardActivationCount;
  return {left,right,guardTotal,measure:pairMeasures(left,right,leftName,rightName)};
}

function summarize(samples) {
  const energies=samples.map(sample=>sample.measure.energyKcalMol).sort((a,b)=>a-b),best=samples.reduce((lowest,sample)=>sample.measure.energyKcalMol<lowest.measure.energyKcalMol?sample:lowest,samples[0]);
  const result={orientationCount:samples.length,lowestEnergyKcalMol:energies[0],medianEnergyKcalMol:energies[Math.floor(energies.length/2)],highestEnergyKcalMol:energies.at(-1),lowestEnergyGeometry:best.measure,guardActivationCount:samples.reduce((sum,sample)=>sum+sample.guardTotal,0),guardFreeFinalCount:samples.filter(sample=>sample.guardTotal===0).length,allFinite:samples.every(sample=>Number.isFinite(sample.measure.energyKcalMol))};
  if(samples[0]?.measure.donorAnglesDeg)result.oneDonorOneAcceptorFinalCount=samples.filter(sample=>sample.measure.donorAnglesDeg.filter(value=>value>=150).length===1&&sample.measure.donorAnglesDeg.some(value=>value<=120)).length;
  return result;
}
function interactionEnergyAt(leftName,rightName,distance,orientationA=[0,0,0,1],orientationB=[0,0,0,1]) { return pairEnergy([makeBody('scan-a',leftName,[0,0,0],orientationA),makeBody('scan-b',rightName,[distance,0,0],orientationB)]); }
function continuityScan(leftName,rightName) {
  const samples=[]; for(let index=0;index<=80;index++){
    const distance=2.4+index*.05,bodies=[makeBody('scan-a',leftName,[0,0,0],[0,0,0,1]),makeBody('scan-b',rightName,[distance,0,0],[0,0,0,1])],result=evaluateStageAForces(bodies),a=result.bodies.get('scan-a'),b=result.bodies.get('scan-b');
    samples.push({distanceAngstrom:distance,minimumIntermolecularAtomDistanceAngstrom:Math.min(...bodies[0].atoms.flatMap(atomA=>bodies[1].atoms.map(atomB=>norm(vectorFrom(plus(bodies[0].positionAngstrom,rotate(atomA.positionAngstrom,bodies[0].orientation)),plus(bodies[1].positionAngstrom,rotate(atomB.positionAngstrom,bodies[1].orientation))))))),energyKcalMol:pairEnergy(bodies),forceOnA:a.forceKcalMolAngstrom,forceOnB:b.forceKcalMolAngstrom,torqueOnA:a.torqueKcalMolAngstrom,torqueOnB:b.torqueKcalMolAngstrom,overlapGuardActivationCount:result.overlapGuardActivationCount});
  }
  const finite=samples.every(item=>[item.energyKcalMol,...item.forceOnA,...item.forceOnB,...item.torqueOnA,...item.torqueOnB].every(Number.isFinite));
  const differences=samples.slice(1).map((item,index)=>Math.abs(item.energyKcalMol-samples[index].energyKcalMol));
  const maxVectorIncrement=field=>Math.max(...samples.slice(1).map((item,index)=>norm(minus(item[field],samples[index][field]))));
  const normalSamples=samples.filter(sample=>sample.minimumIntermolecularAtomDistanceAngstrom>=2.8);
  const rotationalSamples=[];for(let index=0;index<=36;index++){
    const orientation=quaternion([0,1,0],index*Math.PI/36),bodies=[makeBody('rot-a',leftName,[0,0,0],[0,0,0,1]),makeBody('rot-b',rightName,[4.5,0,0],orientation)],result=evaluateStageAForces(bodies),a=result.bodies.get('rot-a'),b=result.bodies.get('rot-b');
    rotationalSamples.push({angleRad:index*Math.PI/36,energyKcalMol:pairEnergy(bodies),forceOnA:a.forceKcalMolAngstrom,torqueOnA:a.torqueKcalMolAngstrom,torqueOnB:b.torqueKcalMolAngstrom,overlapGuardActivationCount:result.overlapGuardActivationCount});
  }
  return {scanAxis:'COM separation 2.40–6.40 Å in 0.05 Å increments; fixed orientation',samples,orientationScan:{axis:'rigid rotation about y at 4.5 Å COM separation',samples:rotationalSamples,finite:rotationalSamples.every(item=>[item.energyKcalMol,...item.forceOnA,...item.torqueOnA,...item.torqueOnB].every(Number.isFinite))},finite,normalRegionDefinition:'minimum real-atom pair distance >=2.8 Å; closer samples are reported as severe-overlap region',maxAbsEnergyIncrementKcalMol:Math.max(...differences),maxForceIncrementKcalMolAngstrom:Math.max(maxVectorIncrement('forceOnA'),maxVectorIncrement('forceOnB')),maxTorqueIncrementKcalMolAngstrom:Math.max(maxVectorIncrement('torqueOnA'),maxVectorIncrement('torqueOnB')),hasNonFiniteForce:!finite,normalRegionGuardActivations:normalSamples.filter(sample=>sample.overlapGuardActivationCount).length,severeOverlapRegionGuardActivations:samples.filter(sample=>sample.minimumIntermolecularAtomDistanceAngstrom<2.8).reduce((sum,sample)=>sum+sample.overlapGuardActivationCount,0),forceEnergyDerivativeCheck:centralDifferenceCheck(leftName,rightName)};
}
function centralDifferenceCheck(leftName,rightName) {
  let maximumRelativeError=0;
  for(const distance of [3.1,3.5,4,5,6]) {
    const h=1e-5,ePlus=interactionEnergyAt(leftName,rightName,distance+h),eMinus=interactionEnergyAt(leftName,rightName,distance-h);
    const numerical=(ePlus-eMinus)/(2*h),bodies=[makeBody('diff-a',leftName,[0,0,0],[0,0,0,1]),makeBody('diff-b',rightName,[distance,0,0],[0,0,0,1])],analytic=evaluateStageAForces(bodies).bodies.get('diff-a').forceKcalMolAngstrom[0];
    maximumRelativeError=Math.max(maximumRelativeError,Math.abs(analytic-numerical)/Math.max(1,Math.abs(analytic),Math.abs(numerical)));
  }
  return {maximumRelativeError,pass:maximumRelativeError<1e-4};
}

const waterWater=Array.from({length:DETECTION_SEEDS},(_,index)=>settlePair('water','water',20260927+index));
const waterAcetone=Array.from({length:12},(_,index)=>settlePair('water','acetone',20261001+index));
const waterPyridine=Array.from({length:12},(_,index)=>settlePair('water','pyridine',20261021+index));
const waterMethane=Array.from({length:12},(_,index)=>settlePair('water','methane',20261041+index));
const waterCO2=Array.from({length:12},(_,index)=>settlePair('water','carbon-dioxide',20261061+index));
const waterO2=Array.from({length:8},(_,index)=>settlePair('water','oxygen',20261081+index));
const waterN2=Array.from({length:8},(_,index)=>settlePair('water','nitrogen',20261091+index));
const carbonicCO2=Array.from({length:8},(_,index)=>settlePair('carbonic-acid','carbon-dioxide',20261101+index));
const waterWaterAudit=summarize(waterWater),acetoneAudit=summarize(waterAcetone),pyridineAudit=summarize(waterPyridine),methaneAudit=summarize(waterMethane),co2Audit=summarize(waterCO2),o2Audit=summarize(waterO2),n2Audit=summarize(waterN2),carbonicAudit=summarize(carbonicCO2);
const waterWaterPass=waterWaterAudit.lowestEnergyKcalMol>=-8&&waterWaterAudit.lowestEnergyKcalMol<=-3.5&&waterWaterAudit.lowestEnergyGeometry.oxygenDistanceAngstrom>=2.65&&waterWaterAudit.lowestEnergyGeometry.oxygenDistanceAngstrom<=3.15&&waterWaterAudit.lowestEnergyGeometry.donorLinearityDeg>=150&&waterWaterAudit.guardActivationCount===0;
const ratios={methaneToAcetone:Math.abs(methaneAudit.lowestEnergyKcalMol)/Math.max(EPS,Math.abs(acetoneAudit.lowestEnergyKcalMol)),co2ToAcetone:Math.abs(co2Audit.lowestEnergyKcalMol)/Math.max(EPS,Math.abs(acetoneAudit.lowestEnergyKcalMol)),pyridineToMethane:Math.abs(pyridineAudit.lowestEnergyKcalMol)/Math.max(EPS,Math.abs(methaneAudit.lowestEnergyKcalMol))};

// Statelessness audit: evaluate the exact same rigid-body state after two
// distinct prior trajectories; history is intentionally not an input.
const exchangeBodies=[makeBody('A','water',[0,0,0],[0,0,0,1]),makeBody('B','water',[2.9,0,0],[0,0,0,1]),makeBody('C','water',[7,0,0],[0,0,0,1])];
const exchangeInitial=evaluateStageAForces(exchangeBodies),initialAB=exchangeInitial.pairDiagnostics.filter(pair=>pair.bodyAId==='A'&&pair.bodyBId==='B').reduce((sum,pair)=>sum+norm(pair.forceOnA),0),initialAC=exchangeInitial.pairDiagnostics.filter(pair=>pair.bodyAId==='A'&&pair.bodyBId==='C').reduce((sum,pair)=>sum+norm(pair.forceOnA),0);
const displaced=[makeBody('A','water',[0,0,0],[0,0,0,1]),makeBody('B','water',[7,0,0],[0,0,0,1]),makeBody('C','water',[2.9,0,0],[0,0,0,1])],exchangeFinal=evaluateStageAForces(displaced),finalAB=exchangeFinal.pairDiagnostics.filter(pair=>pair.bodyAId==='A'&&pair.bodyBId==='B').reduce((sum,pair)=>sum+norm(pair.forceOnA),0),finalAC=exchangeFinal.pairDiagnostics.filter(pair=>pair.bodyAId==='A'&&pair.bodyBId==='C').reduce((sum,pair)=>sum+norm(pair.forceOnA),0);
const historySnapshot=[makeBody('A','water',[0,0,0],[0,0,0,1]),makeBody('B','water',[4.1,.25,0],[0,0,0,1])];
const approachOne=[makeBody('A','water',[0,0,0],[0,0,0,1]),makeBody('B','water',[3.8,0,0],[0,0,0,1]),makeBody('C','water',[7.6,0,0],[0,0,0,1])];
const approachTwo=[makeBody('A','water',[0,0,0],[0,0,0,1]),makeBody('B','water',[7.6,0,0],[0,0,0,1]),makeBody('C','water',[3.8,0,0],[0,0,0,1])];
for(let step=0;step<360;step++){integrateStageA(approachOne,STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);integrateStageA(approachTwo,STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);}
for(const history of [approachOne,approachTwo]){
  for(const body of history){const x=body.id==='A'?0:body.id==='B'?4.1:8;body.positionAngstrom=[x,.25,0];body.orientation=[0,0,0,1];}
}
const snapshot1=evaluateStageAForces(approachOne),snapshot2=evaluateStageAForces(approachTwo);
function forcesById(result){return [...result.bodies].sort(([a],[b])=>a.localeCompare(b)).map(([id,state])=>[id,state.energyKcalMol,...state.forceKcalMolAngstrom,...state.torqueKcalMolAngstrom]);}
const historyIndependent=JSON.stringify(forcesById(snapshot1))===JSON.stringify(forcesById(snapshot2));

const continuity={waterWater:continuityScan('water','water'),waterAcetone:continuityScan('water','acetone'),waterPyridine:continuityScan('water','pyridine')};
const fixtureResults={
  'water-water':{...waterWaterAudit,pass:waterWaterPass,classification:waterWaterPass?'pass':'water-integration-review'},
  'water-acetone':{...acetoneAudit,acceptorGeometry:acetoneAudit.lowestEnergyGeometry.acceptorGeometry,pass:acetoneAudit.lowestEnergyGeometry.acceptorGeometry?.distance>=1.7&&acetoneAudit.lowestEnergyGeometry.acceptorGeometry?.distance<=2.2&&acetoneAudit.lowestEnergyGeometry.acceptorGeometry?.donorAngle>=145&&acetoneAudit.lowestEnergyGeometry.acceptorGeometry?.acceptorAngle>=100&&acetoneAudit.lowestEnergyGeometry.acceptorGeometry?.acceptorAngle<=140,classification:'needs-anisotropy-stage-b'},
  'water-pyridine':{...pyridineAudit,acceptorGeometry:pyridineAudit.lowestEnergyGeometry.acceptorGeometry,pass:pyridineAudit.lowestEnergyGeometry.acceptorGeometry?.distance>=1.7&&pyridineAudit.lowestEnergyGeometry.acceptorGeometry?.distance<=2.3&&pyridineAudit.lowestEnergyGeometry.acceptorGeometry?.donorAngle>=145&&pyridineAudit.lowestEnergyGeometry.acceptorGeometry?.outsideN},
  'water-methane':{...methaneAudit,pass:Math.abs(methaneAudit.lowestEnergyKcalMol)<=1.5},
  'water-carbon-dioxide':{...co2Audit,pass:ratios.co2ToAcetone<.70},
  'water-oxygen':{...o2Audit,pass:Math.abs(o2Audit.lowestEnergyKcalMol)<=2&&o2Audit.guardActivationCount===0},
  'water-nitrogen':{...n2Audit,pass:Math.abs(n2Audit.lowestEnergyKcalMol)<=2&&n2Audit.guardActivationCount===0},
  'carbonic-acid-carbon-dioxide':{...carbonicAudit,pass:carbonicAudit.guardActivationCount===0&&carbonicAudit.allFinite&&carbonicAudit.lowestEnergyGeometry.centerDistanceAngstrom>1},
};
fixtureResults['water-carbon-dioxide'].pass&&=co2Audit.guardActivationCount===0;
fixtureResults['water-acetone'].pass&&=acetoneAudit.guardActivationCount===0;
fixtureResults['water-pyridine'].pass&&=pyridineAudit.guardActivationCount===0;
fixtureResults['water-methane'].pass&&=methaneAudit.guardActivationCount===0&&ratios.methaneToAcetone<=.35;
fixtureResults['water-acetone'].pass&&=Math.abs(acetoneAudit.lowestEnergyKcalMol)>0.5;
fixtureResults['water-pyridine'].pass&&=Math.abs(pyridineAudit.lowestEnergyKcalMol)>Math.abs(methaneAudit.lowestEnergyKcalMol);
fixtureResults['water-water'].pass&&=waterWaterAudit.orientationCount>=24;

const partnerExchange={initialForceAB:initialAB,initialForceAC:initialAC,finalForceAB:finalAB,finalForceAC:finalAC,initialRatio:initialAB/Math.max(EPS,initialAC),finalRatio:finalAC/Math.max(EPS,finalAB),historyIndependent,pass:initialAB>2*initialAC&&finalAC>2*finalAB&&historyIndependent};
function dragFixture(){
  const settled=settlePair('water','water',20260927),step=STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,baselineB=[...settled.right.positionAngstrom];
  const response=[settled.left,settled.right],startA=[...settled.left.positionAngstrom];settled.left.kinematic=true;settled.left.positionAngstrom[0]-=.05;
  let responseSteps=0;for(;responseSteps<24000;responseSteps++){
    integrateStageA(response,step);
    if(Math.abs(settled.right.positionAngstrom[0]-baselineB[0])>=.05*.632)break;
  }
  const tauPs=Math.max(step,responseSteps*step),runDrag=(durationPs,label)=>{
    const pair=settlePair('water','water',20260927),bodyA=pair.left,bodyB=pair.right,startA=[...bodyA.positionAngstrom],startB=[...bodyB.positionAngstrom],axis=bodyA.positionAngstrom[0]<bodyB.positionAngstrom[0]?-1:1;
    bodyA.kinematic=true;const steps=Math.max(1,Math.round(durationPs/step));
    for(let index=1;index<=steps;index++){bodyA.positionAngstrom=startA.map((value,axisIndex)=>axisIndex===0?value+axis*index/steps:value);integrateStageA([bodyA,bodyB],step);}
    const dragDistance=Math.abs(bodyA.positionAngstrom[0]-startA[0]),followDistance=Math.abs(bodyB.positionAngstrom[0]-startB[0]),initialSeparation=Math.abs(startB[0]-startA[0]),finalSeparation=Math.abs(bodyB.positionAngstrom[0]-bodyA.positionAngstrom[0]);
    return {durationPs,steps,dragDistanceAngstrom:dragDistance,partnerFollowAngstrom:followDistance,followFraction:followDistance/dragDistance,initialSeparationAngstrom:initialSeparation,finalSeparationAngstrom:finalSeparation,separationIncreaseAngstrom:finalSeparation-initialSeparation,pass:label==='slow'?followDistance>=.60*dragDistance&&finalSeparation<=4.0:followDistance<=.30*dragDistance&&finalSeparation>initialSeparation};
  };
  const slow=runDrag(4*tauPs,'slow'),fast=runDrag(.25*tauPs,'fast');
  return {responseTimeConstantTauPs:tauPs,responseThreshold:'partner reaches 63.2% of a held 0.05 Å kinematic step response',slow:{...slow,requiredMinimumDurationPs:4*tauPs},fast:{...fast,requiredMaximumDurationPs:.25*tauPs},pass:slow.pass&&fast.pass};
}
const drag=dragFixture();
const hash=canonicalDatasetSha256;
const broadGatesPass=Object.entries(fixtureResults).filter(([name])=>name!=='water-acetone').every(([,result])=>result.pass)&&Object.values(continuity).every(result=>result.finite&&result.orientationScan.finite&&result.forceEnergyDerivativeCheck.pass&&result.normalRegionGuardActivations===0)&&partnerExchange.pass&&drag.pass;
fixtureResults['water-acetone'].pass&&=fixtureResults['water-acetone'].acceptorGeometry.outOfPlaneDeg<=35;
fixtureResults['water-acetone'].classification=fixtureResults['water-acetone'].pass?'pass':'needs-anisotropy-stage-b';
const directionalityOnlyFailure=!fixtureResults['water-acetone'].pass;
const waterOnlyFailure=!fixtureResults['water-water'].pass&&Object.entries(fixtureResults).filter(([name])=>name!=='water-water').every(([,result])=>result.pass);
const implementationFailure=Object.values(continuity).some(result=>!result.finite||!result.orientationScan.finite||!result.forceEnergyDerivativeCheck.pass||result.normalRegionGuardActivations>0)||!partnerExchange.historyIndependent;
const failureClassification=Object.values(fixtureResults).every(result=>result.pass)&&Object.values(continuity).every(result=>result.finite&&result.orientationScan.finite&&result.forceEnergyDerivativeCheck.pass&&result.normalRegionGuardActivations===0)&&partnerExchange.pass&&drag.pass?'pass':implementationFailure?'implementation-bug':waterOnlyFailure?'water-integration-review':directionalityOnlyFailure&&broadGatesPass?'needs-anisotropy-stage-b':'nonbonded-model-review';
const audit={schemaVersion:1,parameterSet:'reaction-lab-nonbonded-v1',canonicalDatasetSha256:hash,physicsEngineVersion:ENGINE_VERSION,globalResult:failureClassification==='pass'?'PASS':'FAIL',productionCutover:failureClassification==='pass',fixtureProtocol:{thermalNoise:0,integrator:'Stage A fixed-step semi-implicit rigid-body integrator',gameStepSeconds:STAGE_A_GAME_STEP_SECONDS,physicalPsPerGameSecond:STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,settleSteps:SETTLE_STEPS,settleDurationPs:SETTLE_STEPS*STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,initialGeometryProtocol:'fixed idealized constitutional coordinates in Angstroms; deterministic LCG orientation seeds',waterWaterSeeds:Array.from({length:DETECTION_SEEDS},(_,index)=>20260927+index),crossSpeciesSeeds:'fixed 12-seed sequences per water pair; 8 for O2/N2 and carbonic-acid/CO2'},fixtures:fixtureResults,relativeStrengthRatios:ratios,continuity,partnerExchange,drag,failureClassification:failureClassification==='pass'?[]:[failureClassification],warnings:['Fixtures use fixed idealized molecular coordinates derived from the constitutional graphs and standard bond geometry. Production Reaction Lab CRAFT geometry remains unchanged; the separate 390×844 browser regression exercises preview-generated models.'],generatedWith:{numericRepresentation:'ECMAScript Number (IEEE-754 binary64)',seedProtocol:'LCG32 1664525/1013904223',thermalNoise:0}};

function stableNumbers(value,places=1e8){if(Array.isArray(value))return value.map(item=>stableNumbers(item,places));if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,stableNumbers(item,places)]));if(typeof value==='number'&&Number.isFinite(value))return Math.round(value*places)/places;return value;}
const output=JSON.stringify(stableNumbers(audit),null,2)+'\n';
if(process.argv.includes('--write')) await writeFile(OUTPUT,output);
else process.stdout.write(output);
