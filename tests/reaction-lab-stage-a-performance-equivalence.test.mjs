import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createStageABody, evaluateStageAForces, integrateStageA } from '../src/reaction-lab-stage-a.js';
import { integrateStageB } from '../src/reaction-lab-stage-b.js';

const expected=JSON.parse(await readFile(new URL('./fixtures/reaction-lab-stage-a-equivalence.json',import.meta.url),'utf8'));
const atom=(element,positionAngstrom,chargeE,sigmaAngstrom=3.1,epsilonKcalMol=.08)=>({element,positionAngstrom,chargeE,sigmaAngstrom,epsilonKcalMol});
function makeScene(stageB=false){
 const water=createStageABody({id:'water',positionAngstrom:[0,0,0],orientation:[.08,-.11,.06,.987],velocityAngstromPerPs:[.02,-.01,.005],angularVelocityRadPerPs:[.003,.002,-.004],atoms:[atom('O',[0,0,0],-.834,3.15,.152),atom('H',[.9572,0,0],.417,2,0),atom('H',[-.239,.927,0],.417,2,0)],virtualChargeSites:[{chargeE:.08,positionAngstrom:[0,0,.25]}]});
 const carbonyl=createStageABody({id:'carbonyl',positionAngstrom:[3.3,.35,.2],orientation:[-.04,.13,.02,.99],velocityAngstromPerPs:[-.01,.015,0],angularVelocityRadPerPs:[-.002,.003,.001],atoms:[atom('C',[0,0,0],.55,3.4,.086),atom('O',[1.23,0,0],-.52,2.96,.21),atom('C',[-.6,1.02,0],-.01,3.4,.109),atom('C',[-.6,-1.02,0],-.02,3.4,.109)]});
 if(stageB)carbonyl.stageBVirtualChargeSites=[{chargeE:-.15,positionAngstrom:[1,.4,0]},{chargeE:-.15,positionAngstrom:[1,-.4,0]},{chargeE:.3,positionAngstrom:[.76,0,0]}];
 return [water,carbonyl];
}
const closeTree=(actual,reference,path='state')=>{
 if(Array.isArray(reference)){assert.equal(actual.length,reference.length,`${path}.length`);reference.forEach((value,index)=>closeTree(actual[index],value,`${path}[${index}]`));}
 else if(typeof reference==='number')assert.ok(Math.abs(actual-reference)<=1e-8*Math.max(1,Math.abs(reference)),`${path}: ${actual} != ${reference}`);
 else assert.equal(actual,reference,path);
};

test('optimized Stage A and Stage B match the pre-optimization force, torque, energy, guard, and next-state fixtures',()=>{
 for(const mode of ['stage-a','stage-b']){
  const stageB=mode==='stage-b',bodies=makeScene(stageB),sample=expected[mode],forces=evaluateStageAForces(bodies,{collectPairDiagnostics:false,includeStageBVirtualSites:stageB});
  assert.equal(forces.overlapGuardActivationCount,sample.fastGuard);
  for(let index=0;index<bodies.length;index++){
   const actual=forces.bodies.get(bodies[index].id),reference=sample.reference[index];
   closeTree(actual.forceKcalMolAngstrom,reference.force,`${mode}.${reference.id}.force`);
   closeTree(actual.torqueKcalMolAngstrom,reference.torque,`${mode}.${reference.id}.torque`);
   closeTree(actual.energyKcalMol,reference.energy,`${mode}.${reference.id}.energy`);
  }
  if(stageB)integrateStageB(bodies,expected.dt,{collectPairDiagnostics:false});
  else integrateStageA(bodies,expected.dt,{collectPairDiagnostics:false});
  for(let index=0;index<bodies.length;index++){
   const actual=bodies[index],reference=sample.integrated[index].reference;
   closeTree(actual.positionAngstrom,reference.position,`${mode}.${actual.id}.position`);
   closeTree(actual.orientation,reference.orientation,`${mode}.${actual.id}.orientation`);
   closeTree(actual.velocityAngstromPerPs,reference.velocity,`${mode}.${actual.id}.velocity`);
   closeTree(actual.angularVelocityRadPerPs,reference.angularVelocity,`${mode}.${actual.id}.angularVelocity`);
  }
 }
});
