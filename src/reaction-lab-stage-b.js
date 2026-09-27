// Stateless carbonyl-local electrostatic anisotropy for the RL-NB4 test path.
// Sites are derived once from canonical graph + local geometry and rotate with
// the rigid body. No lifecycle, donor/acceptor state, LJ, or real-atom edits.
import { evaluateStageAForces, integrateStageA } from './reaction-lab-stage-a.js';

const add=(a,b)=>a.map((value,index)=>value+b[index]);
const sub=(a,b)=>a.map((value,index)=>value-b[index]);
const mul=(a,k)=>a.map(value=>value*k);
const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>Math.hypot(...a);
const unit=(a,label)=>{const length=norm(a);if(!(length>1e-10)||!Number.isFinite(length))throw new Error(`Unable to construct carbonyl anisotropy frame: degenerate ${label}.`);return mul(a,1/length);};
const finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
export const STAGE_B_SITE_DISTANCE_ANGSTROM=0.47;
export const STAGE_B_ENGINE_VERSION='reaction-lab-stage-b-v1';
// Candidate qA is set from the committed audit when one passes; otherwise the
// localhost-only probe uses the scan ceiling to expose the best attempted correction.
export const STAGE_B_TEST_QA_E=0.15;

function bondRows(bonds){return bonds.map((bond,index)=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2],index}:{...bond,index});}
const elementOf=atom=>typeof atom==='string'?atom:atom?.element;

/** Find trigonal O=C motifs without species-name logic. atomPositions are local Å. */
export function detectCarbonylAnisotropySites(atoms,bonds,{qA=0.0}={}){
  if(!Array.isArray(atoms)||!Array.isArray(bonds)||!Number.isFinite(qA)||qA<0)throw new Error('Invalid carbonyl site input.');
  const rows=bondRows(bonds),adjacency=atoms.map(()=>[]);
  for(const bond of rows){if(!Number.isInteger(bond.a)||!Number.isInteger(bond.b)||bond.a<0||bond.b<0||bond.a>=atoms.length||bond.b>=atoms.length)throw new Error('Carbonyl graph has an invalid bond index.');adjacency[bond.a].push({index:bond.b,order:bond.order,bondIndex:bond.index});adjacency[bond.b].push({index:bond.a,order:bond.order,bondIndex:bond.index});}
  const result=[];
  for(let oxygenAtomIndex=0;oxygenAtomIndex<atoms.length;oxygenAtomIndex++){
    if(elementOf(atoms[oxygenAtomIndex])!=='O')continue;
    const doubleCarbon=adjacency[oxygenAtomIndex].filter(item=>elementOf(atoms[item.index])==='C'&&(item.order===2||item.order==='2'||item.order==='double'));
    for(const carbon of doubleCarbon){
      const substituentAtomIndices=adjacency[carbon.index].filter(item=>item.index!==oxygenAtomIndex).map(item=>item.index);
      if(substituentAtomIndices.length!==2)continue;
      const pO=atoms[oxygenAtomIndex].positionAngstrom,pC=atoms[carbon.index].positionAngstrom;
      const e=unit(sub(pC,pO),'O-to-C axis');
      const vectors=substituentAtomIndices.map(index=>sub(atoms[index].positionAngstrom,pC));
      // O->C and either C->substituent vector span the molecular plane. This
      // remains defined for valid symmetric carbonyls whose substituents lie
      // on opposite sides of C (crossing the two substituent vectors would
      // incorrectly mark that geometry degenerate).
      const planeCandidates=[...vectors.map(vector=>cross(e,vector)),cross(vectors[0],vectors[1])].filter(vector=>norm(vector)>1e-10).sort((a,b)=>norm(b)-norm(a));
      const n=unit(planeCandidates[0]??[0,0,0],'carbonyl plane');
      const t=unit(cross(n,e),'in-plane transverse axis');
      const d=STAGE_B_SITE_DISTANCE_ANGSTROM,lpDirectionPlus=unit(add(mul(e,-0.5),mul(t,Math.sqrt(3)/2)),'LP+ direction'),lpDirectionMinus=unit(sub(mul(e,-0.5),mul(t,Math.sqrt(3)/2)),'LP- direction');
      const lpPlusPositionAngstrom=add(pO,mul(lpDirectionPlus,d)),lpMinusPositionAngstrom=add(pO,mul(lpDirectionMinus,d)),compensationPositionAngstrom=mul(add(lpPlusPositionAngstrom,lpMinusPositionAngstrom),0.5);
      const chargeSites=[{label:'LP+',chargeE:-qA,positionAngstrom:lpPlusPositionAngstrom},{label:'LP-',chargeE:-qA,positionAngstrom:lpMinusPositionAngstrom},{label:'CP',chargeE:2*qA,positionAngstrom:compensationPositionAngstrom}];
      const chargeSum=chargeSites.reduce((sum,site)=>sum+site.chargeE,0),dipole=chargeSites.reduce((sum,site)=>add(sum,mul(site.positionAngstrom,site.chargeE)),[0,0,0]);
      result.push({oxygenAtomIndex,carbonAtomIndex:carbon.index,substituentAtomIndices,plane:{e,n,t},lpPlusPositionAngstrom,lpMinusPositionAngstrom,compensationPositionAngstrom,chargeSites,correctionChargeE:chargeSum,correctionDipoleEAngstrom:dipole,frameStatus:'ok'});
    }
  }
  return result;
}

export function createStageBVirtualSites(atoms,bonds,{qA=0.0}={}){
  return detectCarbonylAnisotropySites(atoms,bonds,{qA}).flatMap(site=>site.chargeSites.map(chargeSite=>({...chargeSite,carbonylOxygenAtomIndex:site.oxygenAtomIndex,carbonylCarbonAtomIndex:site.carbonAtomIndex,parameterization:'carbonyl-local-anisotropy',massless:true,lj:false})));
}

function quatRotate(q,p){const [x,y,z,w]=q,[px,py,pz]=p,tx=2*(y*pz-z*py),ty=2*(z*px-x*pz),tz=2*(x*py-y*px);return [px+w*tx+(y*tz-z*ty),py+w*ty+(z*tx-x*tz),pz+w*tz+(x*ty-y*tx)];}

/** Evaluate baseline and added site terms, retaining Stage A's force authority. */
export function evaluateStageBForces(bodies,{excludedMoleculePairs=new Set(),collectPairDiagnostics=true}={}){
  const baseline=evaluateStageAForces(bodies,{excludedMoleculePairs,collectPairDiagnostics:true});
  const augmentedBodies=bodies.map(body=>({...body,virtualChargeSites:[...(body.virtualChargeSites??[]),...(body.stageBVirtualChargeSites??[])]}));
  const total=evaluateStageAForces(augmentedBodies,{excludedMoleculePairs,collectPairDiagnostics:true});
  return stageBForceReport(bodies,baseline,total,collectPairDiagnostics);
}

function stageBForceReport(bodies,baseline,total,collectPairDiagnostics=true){
  const bodyById=new Map(bodies.map(body=>[body.id,body]));
  const bodyResults=new Map();
  for(const body of bodies){const base=baseline.bodies.get(body.id),all=total.bodies.get(body.id),correctionForce=sub(all.forceKcalMolAngstrom,base.forceKcalMolAngstrom),correctionTorque=sub(all.torqueKcalMolAngstrom,base.torqueKcalMolAngstrom);bodyResults.set(body.id,{forceKcalMolAngstrom:[...all.forceKcalMolAngstrom],stageBCorrectionForceKcalMolAngstrom:correctionForce,baselineForceKcalMolAngstrom:[...base.forceKcalMolAngstrom],torqueKcalMolAngstrom:[...all.torqueKcalMolAngstrom],stageBCorrectionTorqueKcalMolAngstrom:correctionTorque,baselineTorqueKcalMolAngstrom:[...base.torqueKcalMolAngstrom],energyKcalMol:all.energyKcalMol,baselineEnergyKcalMol:base.energyKcalMol,anisotropyEnergyKcalMol:all.energyKcalMol-base.energyKcalMol});}
  const baseCounts=new Map(bodies.map(body=>[body.id,(body.virtualChargeSites??[]).length]));
  const baseByKey=new Map(baseline.pairDiagnostics.map(pair=>[`${pair.bodyAId}|${pair.siteA.kind}:${pair.siteA.index}|${pair.bodyBId}|${pair.siteB.kind}:${pair.siteB.index}`,pair]));
  const diagnostics=total.pairDiagnostics.map(pair=>{const isB=(site,id)=>site.kind==='virtual'&&site.index>=baseCounts.get(id),usesStageB=isB(pair.siteA,pair.bodyAId)||isB(pair.siteB,pair.bodyBId),base=baseByKey.get(`${pair.bodyAId}|${pair.siteA.kind}:${pair.siteA.index}|${pair.bodyBId}|${pair.siteB.kind}:${pair.siteB.index}`),stageACoulombForceOnA=base?.coulombForceOnA??[0,0,0],stageACoulombTorqueOnA=base?cross(sub(base.positionA,bodyById.get(pair.bodyAId).positionAngstrom),stageACoulombForceOnA):[0,0,0],stageACoulombTorqueOnB=base?cross(sub(base.positionB,bodyById.get(pair.bodyBId).positionAngstrom),mul(stageACoulombForceOnA,-1)):[0,0,0],anisotropy=usesStageB?pair.coulombEnergyKcalMol:0,stageBAnisotropyForceOnA=usesStageB?pair.coulombForceOnA:[0,0,0];return {...pair,stageACoulombEnergyKcalMol:pair.coulombEnergyKcalMol-anisotropy,stageBAnisotropyCoulombEnergyKcalMol:anisotropy,stageACoulombForceOnA,stageBAnisotropyForceOnA,ljForceOnA:pair.ljForceOnA,stageACoulombTorqueOnA,stageACoulombTorqueOnB,stageBAnisotropyTorqueOnA:usesStageB?pair.torqueOnA:[0,0,0],stageBAnisotropyTorqueOnB:usesStageB?pair.torqueOnB:[0,0,0],ljEnergyKcalMol:pair.ljEnergyKcalMol,totalEnergyKcalMol:pair.totalEnergyKcalMol};}).filter(pair=>collectPairDiagnostics||pair.stageBAnisotropyCoulombEnergyKcalMol!==0);
  return {bodies:bodyResults,pairDiagnostics:diagnostics,stageAPairDiagnostics:baseline.pairDiagnostics,overlapGuardActivationCount:total.overlapGuardActivationCount,stageAOverlapGuardActivationCount:baseline.overlapGuardActivationCount,anisotropySiteCount:bodies.reduce((sum,body)=>sum+(body.stageBVirtualChargeSites?.length??0),0)};
}

export function stageBCarbonylDiagnostics(body){
  return (body.carbonylAnisotropySites??[]).map(site=>{const transform=p=>add(body.positionAngstrom,quatRotate(body.orientation,p));return {...site,lpPlusWorldPositionAngstrom:transform(site.lpPlusPositionAngstrom),lpMinusWorldPositionAngstrom:transform(site.lpMinusPositionAngstrom),compensationWorldPositionAngstrom:transform(site.compensationPositionAngstrom)};});
}

export function integrateStageB(bodies,physicalDeltaPs,options={}){
  const wantDiagnostics=options.collectPairDiagnostics??true;
  if(!wantDiagnostics){const total=integrateStageA(bodies,physicalDeltaPs,{...options,includeStageBVirtualSites:true});return {...total,anisotropySiteCount:bodies.reduce((sum,body)=>sum+(body.stageBVirtualChargeSites?.length??0),0)};}
  const augmented=bodies.map(body=>({...body,virtualChargeSites:[...(body.virtualChargeSites??[]),...(body.stageBVirtualChargeSites??[])]}));
  const total=integrateStageA(augmented,physicalDeltaPs,{...options,collectPairDiagnostics:true});
  for(let index=0;index<bodies.length;index++){const source=augmented[index],target=bodies[index];target.positionAngstrom=source.positionAngstrom;target.orientation=source.orientation;target.velocityAngstromPerPs=source.velocityAngstromPerPs;target.angularVelocityRadPerPs=source.angularVelocityRadPerPs;}
  const baseline=evaluateStageAForces(bodies,{excludedMoleculePairs:options.excludedMoleculePairs??new Set(),collectPairDiagnostics:true});
  return stageBForceReport(bodies,baseline,total,wantDiagnostics);
}

export function carbonylCorrectionMoments(site){
  const chargeSites=site.chargeSites??[];
  return {chargeE:chargeSites.reduce((sum,item)=>sum+item.chargeE,0),dipoleEAngstrom:chargeSites.reduce((sum,item)=>add(sum,mul(item.positionAngstrom,item.chargeE)),[0,0,0]),allFinite:chargeSites.every(item=>finite(item.positionAngstrom)&&Number.isFinite(item.chargeE))};
}
