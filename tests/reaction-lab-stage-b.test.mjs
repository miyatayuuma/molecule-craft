import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { carbonylCorrectionMoments, createStageBVirtualSites, detectCarbonylAnisotropySites, evaluateStageBForces, stageBCarbonylDiagnostics, STAGE_B_SITE_DISTANCE_ANGSTROM } from '../src/reaction-lab-stage-b.js';
import { createStageABody, evaluateStageAForces } from '../src/reaction-lab-stage-a.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const record=id=>records.find(item=>item.id===id);
const structure=(id,positions)=>record(id).atoms.map((element,index)=>({element,positionAngstrom:positions[index]}));
const close=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
const rotate=([x,y,z],q)=>{const [a,b,c,w]=q,tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);return[x+w*tx+(b*tz-c*ty),y+w*ty+(c*tx-a*tz),z+w*tz+(a*ty-b*tx)];};
const quaternion=[0.18257418583505536,-0.3651483716701107,0.5477225575051661,0.7302967433402214];

test('carbonyl detector selects trigonal O=C sites and excludes non-carbonyl or linear motifs by graph',()=>{
  const one=structure('acetone',[[-1.5,0,0],[0,0,0],[1.5,0,0],[0,1.22,0],[-2.13,-.51,.89],[-2.13,-.51,-.89],[-2.13,1.02,0],[-.87,-.51,.89],[-.87,-.51,-.89],[2.13,-.51,.89]]);
  assert.equal(detectCarbonylAnisotropySites(one,record('acetone').bonds).length,1);
  const excluded=['carbon-dioxide','carbonyl-sulfide','water','pyridine','nitromethane','dimethyl-sulfoxide'];
  for(const id of excluded){const r=record(id),coords=Array.from({length:r.atoms.length},(_,index)=>[index*1.17,(index%3)*.83,(index%2)*.61]);assert.equal(detectCarbonylAnisotropySites(structure(id,coords),r.bonds).length,0,id);}
});

test('eligible carbonyl with a degenerate plane fails explicitly instead of falling back',()=>{
  const recordValue=record('acetone'),atoms=recordValue.atoms.map((element,index)=>({element,positionAngstrom:[index,0,0]}));
  assert.throws(()=>detectCarbonylAnisotropySites(atoms,recordValue.bonds,{qA:.1}),/degenerate carbonyl plane/);
});

test('virtual correction has zero charge and dipole, and symmetric lobes',()=>{
  const atoms=structure('acetone',[[-1.5,0,0],[0,0,0],[1.5,0,0],[0,1.22,0],[-2.13,-.51,.89],[-2.13,-.51,-.89],[-2.13,1.02,0],[-.87,-.51,.89],[-.87,-.51,-.89],[2.13,-.51,.89]]);
  const [site]=detectCarbonylAnisotropySites(atoms,record('acetone').bonds,{qA:.075});
  const moments=carbonylCorrectionMoments(site);close(moments.chargeE,0);for(const value of moments.dipoleEAngstrom)close(value,0);
  assert.deepEqual(site.chargeSites.map(item=>item.chargeE),[-.075,-.075,.15]);
  for(let axis=0;axis<3;axis++)close(site.compensationPositionAngstrom[axis],(site.lpPlusPositionAngstrom[axis]+site.lpMinusPositionAngstrom[axis])/2);
  close(Math.hypot(...site.lpPlusPositionAngstrom.map((x,i)=>x-atoms[3].positionAngstrom[i])),STAGE_B_SITE_DISTANCE_ANGSTROM);
  close(Math.hypot(...site.lpMinusPositionAngstrom.map((x,i)=>x-atoms[3].positionAngstrom[i])),STAGE_B_SITE_DISTANCE_ANGSTROM);
  for(const position of [site.lpPlusPositionAngstrom,site.lpMinusPositionAngstrom,site.compensationPositionAngstrom])assert.ok(position.every(Number.isFinite));
  for(const site of createStageBVirtualSites(atoms,record('acetone').bonds,{qA:0}))close(site.chargeE,0);
});

test('carbonyl local frame is permutation independent and covariant under rigid rotation',()=>{
  const atoms=structure('acetone',[[-1.5,0,0],[0,0,0],[1.5,0,0],[0,1.22,0],[-2.13,-.51,.89],[-2.13,-.51,-.89],[-2.13,1.02,0],[-.87,-.51,.89],[-.87,-.51,-.89],[2.13,-.51,.89]]),bonds=record('acetone').bonds;
  const original=detectCarbonylAnisotropySites(atoms,bonds,{qA:.08})[0],permutation=[9,4,2,3,1,7,0,5,6,8],inverse=new Map(permutation.map((old,index)=>[old,index]));
  const permuted=permutation.map(index=>atoms[index]),permutedBonds=bonds.map(([a,b,o])=>[inverse.get(a),inverse.get(b),o]),again=detectCarbonylAnisotropySites(permuted,permutedBonds,{qA:.08})[0];
  const sortPoints=points=>points.map(point=>point.map(value=>+value.toFixed(8)).join(',')).sort();
  assert.deepEqual(sortPoints([original.lpPlusPositionAngstrom,original.lpMinusPositionAngstrom]),sortPoints([again.lpPlusPositionAngstrom,again.lpMinusPositionAngstrom]));
  const rotatedAtoms=atoms.map(atom=>({...atom,positionAngstrom:rotate(atom.positionAngstrom,quaternion)})),rotated=detectCarbonylAnisotropySites(rotatedAtoms,bonds,{qA:.08})[0];
  assert.deepEqual(sortPoints([rotated.lpPlusPositionAngstrom,rotated.lpMinusPositionAngstrom]),sortPoints([rotate(original.lpPlusPositionAngstrom,quaternion),rotate(original.lpMinusPositionAngstrom,quaternion)]));
});

test('world-space carbonyl virtual-site diagnostics use the same quaternion transform as the physics',()=>{
  const acetone=record('acetone'),atoms=structure('acetone',[[-1.5,0,0],[0,0,0],[1.5,0,0],[0,1.22,0],[-2.13,-.51,.89],[-2.13,-.51,-.89],[-2.13,1.02,0],[-.87,-.51,.89],[-.87,-.51,-.89],[2.13,-.51,.89]]),position=[2,-1,.5],orientation=[0,0,Math.SQRT1_2,Math.SQRT1_2],body={id:'rotated-acetone',positionAngstrom:position,orientation,atoms,carbonylAnisotropySites:detectCarbonylAnisotropySites(atoms,acetone.bonds,{qA:.1})},diagnostic=stageBCarbonylDiagnostics(body)[0],site=body.carbonylAnisotropySites[0],expected=rotate(site.lpPlusPositionAngstrom,orientation).map((value,index)=>value+position[index]);
  for(let index=0;index<3;index++)close(diagnostic.lpPlusWorldPositionAngstrom[index],expected[index]);
});

test('Stage B augmentation is stateless, adds only Coulomb, and preserves Stage A base',()=>{
  const atoms=[{element:'C',positionAngstrom:[-.6,0,0],chargeE:.4,sigmaAngstrom:3.5,epsilonKcalMol:.1},{element:'O',positionAngstrom:[.6,0,0],chargeE:-.4,sigmaAngstrom:3,epsilonKcalMol:.15}];
  const base=createStageABody({id:'a',positionAngstrom:[0,0,0],atoms}),other=createStageABody({id:'b',positionAngstrom:[4,0,0],atoms});
  const stageA=evaluateStageAForces([base,other]),stageBBody={...base,stageBVirtualChargeSites:[{label:'LP+',chargeE:-.1,positionAngstrom:[-1,0,0],massless:true,lj:false},{label:'LP-',chargeE:-.1,positionAngstrom:[-1,.2,0],massless:true,lj:false},{label:'CP',chargeE:.2,positionAngstrom:[-.8,.1,0],massless:true,lj:false}]};
  const stageB=evaluateStageBForces([stageBBody,other]);
  close(stageB.bodies.get('a').baselineEnergyKcalMol,stageA.bodies.get('a').energyKcalMol);
  assert.ok(stageB.pairDiagnostics.some(pair=>Math.abs(pair.stageBAnisotropyCoulombEnergyKcalMol)>0));
  assert.ok(stageB.bodies.get('a').stageBCorrectionTorqueKcalMolAngstrom.every(Number.isFinite));
  for(let axis=0;axis<3;axis++)close(stageB.bodies.get('a').forceKcalMolAngstrom[axis]+stageB.bodies.get('b').forceKcalMolAngstrom[axis],0,1e-9);
});

test('all database trigonal carbonyl frames build finite, with no hardcoded site-count assumption',()=>{
  let moleculeCount=0,siteCount=0;
  for(const molecule of records){const atoms=molecule.atoms.map((element,index)=>({element,positionAngstrom:[Math.sin(index*12.9898+molecule.id.length)*3,Math.cos(index*7.233+molecule.id.length)*2,Math.sin(index*4.123+molecule.id.length)*1.7]}));const sites=detectCarbonylAnisotropySites(atoms,molecule.bonds,{qA:.1});if(sites.length)moleculeCount++;siteCount+=sites.length;for(const site of sites){assert.ok(site.plane.e.every(Number.isFinite));assert.ok(site.plane.n.every(Number.isFinite));assert.ok(site.lpPlusPositionAngstrom.every(Number.isFinite));assert.ok(site.lpMinusPositionAngstrom.every(Number.isFinite));assert.ok(site.compensationPositionAngstrom.every(Number.isFinite));assert.ok(Math.hypot(...carbonylCorrectionMoments(site).dipoleEAngstrom)<1e-12);}}
  assert.ok(moleculeCount>0);assert.ok(siteCount>=moleculeCount);
});

test('Stage B energy and force remain continuous across distance and rigid rotation scans',()=>{
  const carbonylAtoms=[{element:'O',positionAngstrom:[0,0,0],chargeE:0,sigmaAngstrom:3.1,epsilonKcalMol:0},{element:'C',positionAngstrom:[1.2,0,0],chargeE:0,sigmaAngstrom:3.4,epsilonKcalMol:0},{element:'C',positionAngstrom:[1.8,1,0],chargeE:0,sigmaAngstrom:3.4,epsilonKcalMol:0},{element:'C',positionAngstrom:[1.8,-1,0],chargeE:0,sigmaAngstrom:3.4,epsilonKcalMol:0}],donorAtoms=[{element:'H',positionAngstrom:[0,0,0],chargeE:1,sigmaAngstrom:2,epsilonKcalMol:0}];
  const from=createStageABody({id:'carbonyl',positionAngstrom:[0,0,0],atoms:carbonylAtoms}),site=detectCarbonylAnisotropySites(from.atoms,[[0,1,2],[1,2,1],[1,3,1]],{qA:.1})[0];from.stageBVirtualChargeSites=site.chargeSites;const to=createStageABody({id:'probe',positionAngstrom:[4,0,0],atoms:donorAtoms});
  let previousEnergy=null,previousForce=null;
  for(let step=0;step<=40;step++){to.positionAngstrom=[3+step*.05,0.3,0];const result=evaluateStageBForces([from,to]),energy=result.pairDiagnostics.reduce((sum,pair)=>sum+pair.totalEnergyKcalMol,0),force=result.bodies.get('to')?.forceKcalMolAngstrom??result.bodies.get('probe').forceKcalMolAngstrom;assert.ok(Number.isFinite(energy)&&force.every(Number.isFinite));if(previousEnergy!==null)assert.ok(Math.abs(energy-previousEnergy)<100,`Unexpected finite-step energy jump at ${step}`);previousEnergy=energy;previousForce=force;}
  assert.ok(previousForce.every(Number.isFinite));
  const distance=4.1,h=1e-5;to.positionAngstrom=[distance,0.3,0];const ePlus=2*evaluateStageBForces([from,{...to,positionAngstrom:[distance+h,.3,0]}]).bodies.get('probe').energyKcalMol,eMinus=2*evaluateStageBForces([from,{...to,positionAngstrom:[distance-h,.3,0]}]).bodies.get('probe').energyKcalMol,force=evaluateStageBForces([from,to]).bodies.get('probe').forceKcalMolAngstrom[0];close(force,-(ePlus-eMinus)/(2*h),1e-4);
  const rotationEnergies=[];for(let index=0;index<=36;index++){const angle=index*Math.PI/36,q=[0,Math.sin(angle/2),0,Math.cos(angle/2)];const rotated={...from,orientation:q};rotationEnergies.push(evaluateStageBForces([rotated,to]).bodies.get('probe').energyKcalMol);}assert.ok(rotationEnergies.every(Number.isFinite));assert.ok(rotationEnergies.every((value,index)=>index===0||Math.abs(value-rotationEnergies[index-1])<100));
});
