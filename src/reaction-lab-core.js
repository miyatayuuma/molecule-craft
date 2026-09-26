// Deterministic sandbox and reaction authority, independent from Three.js.
import { graphsAreIsomorphic } from './chemistry.js?v=20';
export const REACTION_LAB_SLOT_COUNT = 3;
export const CONTACT_DWELL_MS = 520;
export const REACTION_RULES = Object.freeze([
  { id:'anhydride-hydrolysis', activation:'contact', reactants:[{species:'acetic-anhydride',site:'anhydride-carbonyl-carbon'},{species:'water',site:'water-oxygen'}], maxDistance:1.18, products:['acetic-acid','acetic-acid'], atomMaps:[[0,1,5,2,7,8,9,14],[4,3,6,13,10,11,12,15]] },
  { id:'anhydride-alcoholysis', activation:'contact', reactants:[{species:'acetic-anhydride',site:'anhydride-carbonyl-carbon'},{species:'ethanol',site:'alcohol-oxygen'}], maxDistance:1.18, products:['ethyl-acetate','acetic-acid'], atomMaps:[[0,1,5,15,14,13,7,8,9,19,20,16,17,18],[4,3,6,2,10,11,12,21]] },
]);

export function normalizeSpeciesSlots(values, records) {
  const ids=new Set(records.map(record=>record.id));
  const slots=Array.from({length:REACTION_LAB_SLOT_COUNT},(_,index)=>values?.[index]??'');
  const active=slots.filter(Boolean);
  if(active.some(id=>!ids.has(id)))return {ok:false,reason:'unknown-species',slots};
  if(new Set(active).size!==active.length)return {ok:false,reason:'duplicate-species',slots};
  return {ok:true,slots};
}
export function planVisiblePopulation(slots) {
  const selected=slots.filter(Boolean), perSpecies=selected.length===1?4:selected.length?2:0;
  return selected.flatMap(species=>Array.from({length:perSpecies},(_,index)=>({species,index})));
}

function atomElement(record,index){return typeof record.atoms[index]==='string'?record.atoms[index]:record.atoms[index].element;}
function neighbors(record,id){return record.bonds.flatMap(([a,b,order])=>a===id?[[b,order]]:b===id?[[a,order]]:[]);}
export function deriveInteractionSites(record) {
  const model=deriveInteractionModel(record);
  return [
    ...model.donors.map(site=>({kind:'donor',...site})),
    ...model.acceptors.map(site=>({kind:'acceptor',...site})),
    ...model.atoms.filter(atom=>atom.interactionCharge!==0).map(atom=>({kind:'interaction-charge',atom:atom.atom,charge:atom.interactionCharge})),
    ...model.atoms.filter(atom=>atom.formalCharge!==0).map(atom=>({kind:'formal-charge',atom:atom.atom,charge:atom.formalCharge})),
  ];
}

const ELECTRONEGATIVITY=Object.freeze({H:2.20,C:2.55,N:3.04,O:3.44,F:3.98,P:2.19,S:2.58,Cl:3.16,Br:2.96,I:2.66});
const pairKey=(a,b)=>[a,b].sort().join('-');
function bondPolarityScale(a,b){
  const key=pairKey(a,b);
  if(key==='C-H')return .018;
  if(key==='C-O')return .205;
  if(key==='H-O')return .285;
  if(key==='C-N')return .145;
  if(key==='H-N')return .17;
  if(key==='C-F')return .23;
  if(key==='C-Cl')return .105;
  if(key==='F-H')return .25;
  if(key==='Cl-H')return .20;
  if(key==='Cl-P')return .17;
  if(key==='H-P')return .045;
  if(key==='O-S')return .21;
  return .14;
}
function contextualBondPolarityScale(record,a,b,order){
  const elementA=atomElement(record,a),elementB=atomElement(record,b),elements=pairKey(elementA,elementB);
  if(elements==='H-O'){
    const oxygen=elementA==='O'?a:b;
    if(neighbors(record,oxygen).some(([carbon])=>atomElement(record,carbon)==='C'&&neighbors(record,carbon).some(([other,bondOrder])=>other!==oxygen&&atomElement(record,other)==='O'&&bondOrder>=2)))return .235;
  }
  if(elements==='C-O'){
    const oxygen=elementA==='O'?a:b,carbon=elementA==='C'?a:b,oxygenHasHydrogen=neighbors(record,oxygen).some(([other])=>atomElement(record,other)==='H');
    if(Number(order)>=2){
      const adjacent=neighbors(record,carbon).filter(([other])=>other!==oxygen).map(([other,bondOrder])=>({element:atomElement(record,other),order:bondOrder}));
      if(adjacent.some(item=>item.element==='N'&&item.order===1))return .175;
      if(adjacent.some(item=>item.element==='O'&&item.order===1))return .185;
      return .205;
    }
    const carbonylCarbon=neighbors(record,carbon).some(([other,bondOrder])=>other!==oxygen&&atomElement(record,other)==='O'&&bondOrder>=2);
    if(oxygenHasHydrogen)return carbonylCarbon ? .19 : .285;
    if(carbonylCarbon)return .105;
    return .15;
  }
  if(elements==='C-N'){
    const nitrogen=elementA==='N'?a:b;
    if(neighbors(record,nitrogen).some(([carbon,bondOrder])=>atomElement(record,carbon)==='C'&&neighbors(record,carbon).some(([other,otherOrder])=>other!==nitrogen&&atomElement(record,other)==='O'&&otherOrder>=2)))return .09;
  }
  return bondPolarityScale(elementA,elementB);
}
export function deriveInteractionCharges(record,{overrides={}}={}){
  const charges=record.atoms.map(()=>0);
  for(const [a,b,order=1] of record.bonds){
    const elementA=atomElement(record,a),elementB=atomElement(record,b),difference=(ELECTRONEGATIVITY[elementA]??2.5)-(ELECTRONEGATIVITY[elementB]??2.5);
    if(!difference)continue;
    const scale=contextualBondPolarityScale(record,a,b,order)*Math.sqrt(Math.max(1,Number(order)||1));
    const transfer=Math.max(-.42,Math.min(.42,difference*scale));
    charges[a]-=transfer;charges[b]+=transfer;
  }
  for(const [atom,value] of Object.entries(overrides))if(Number.isInteger(Number(atom))&&charges[Number(atom)]!==undefined&&Number.isFinite(Number(value)))charges[Number(atom)]=Number(value);
  // Bond dipoles are neutral by construction. The tiny correction also keeps
  // optional data overrides from accidentally creating a net molecular charge.
  const mean=charges.length?charges.reduce((sum,value)=>sum+value,0)/charges.length:0;
  const centered=charges.map(value=>value-mean),maximum=Math.max(0,...centered.map(Math.abs)),scale=maximum>.42 ? .42/maximum : 1;
  return centered.map(value=>value*scale);
}

const SUPPORTED_BOND_ENVIRONMENTS=new Set(['C-H','C-C','C-N','C-O','C-F','C-Cl','C-Br','C-I','C-P','C-S','Cl-Cl','Cl-H','Cl-O','Cl-P','F-H','F-S','H-H','H-N','H-O','H-P','H-S','N-N','N-O','N-S','O-O','O-P','O-S','P-S','S-S']);
export function auditInteractionEnvironment(record){
  const unsupported=[];
  for(const [a,b,order=1] of record.bonds){const left=atomElement(record,a),right=atomElement(record,b),key=pairKey(left,right);if(!SUPPORTED_BOND_ENVIRONMENTS.has(key))unsupported.push({kind:'bond',atoms:[a,b],elements:[left,right],order});}
  for(let atom=0;atom<record.atoms.length;atom++)if(!ELECTRONEGATIVITY[atomElement(record,atom)])unsupported.push({kind:'element',atom,element:atomElement(record,atom)});
  return {moleculeId:record.id??null,unsupported};
}
export function auditInteractionDatabase(records){
  const findings=[];
  for(const record of records){const charges=deriveInteractionCharges(record),environment=auditInteractionEnvironment(record),sum=charges.reduce((total,value)=>total+value,0);
    if(charges.some(value=>!Number.isFinite(value)||Math.abs(value)>.4200001))findings.push({kind:'invalid-charge',moleculeId:record.id});
    if(Math.abs(sum)>1e-8)findings.push({kind:'non-neutral-interaction-charge',moleculeId:record.id,sum});
    findings.push(...environment.unsupported.map(item=>({...item,moleculeId:record.id})));
    let labels=record.atoms.map((raw,index)=>`${atomElement(record,index)}:${Number(record.formalCharges?.[String(index)]??raw?.charge??0)}:${neighbors(record,index).length}`);
    for(let round=0;round<3;round++)labels=labels.map((label,index)=>`${label}[${neighbors(record,index).map(([other,order])=>`${order}:${labels[other]}`).sort().join(',')}]`);
    const groups=new Map();labels.forEach((label,index)=>{const members=groups.get(label)??[];members.push(index);groups.set(label,members);});
    for(const members of groups.values())if(members.length>1&&Math.max(...members.map(index=>charges[index]))-Math.min(...members.map(index=>charges[index]))>1e-8)findings.push({kind:'symmetry-equivalent-charge-mismatch',moleculeId:record.id,atoms:members});
  }
  return findings;
}
export function interactionDipole(charges,positions,center={x:0,y:0,z:0}){
  return charges.reduce((sum,charge,index)=>add(sum,scale(sub(positions[index],center),charge)),vec());
}

const vec=(x=0,y=0,z=0)=>({x,y,z});
const add=(a,b)=>vec(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a,b)=>vec(a.x-b.x,a.y-b.y,a.z-b.z);
const scale=(a,k)=>vec(a.x*k,a.y*k,a.z*k);
const cross=(a,b)=>vec(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
function atomInteractionForce(atomA,atomB,delta,{chargeOptions={},stericOptions={}}={}){
  const distance=Math.hypot(delta.x,delta.y,delta.z),coulomb=coulombPairForce(atomA.interactionCharge,atomB.interactionCharge,delta,chargeOptions);
  const minimum=atomA.excludedRadius+atomB.excludedRadius,overlap=Math.max(0,minimum-distance),stericMagnitude=overlap>0?Math.min(stericOptions.maxForce??.24,(stericOptions.stiffness??4.5)*overlap*overlap/Math.max(.08,distance)):0;
  const stericDirection=distance>1e-8?scale(delta,1/distance):vec(1,0,0),steric=scale(stericDirection,-stericMagnitude);
  return {coulomb:vec(coulomb.x,coulomb.y,coulomb.z),steric,distance,coulombMagnitude:coulomb.magnitude,stericMagnitude,minimumSeparation:minimum};
}
export function decomposeMoleculePairInteraction(instanceA,instanceB,{hbonds=[],chargeOptions={strength:.42,softening:.85,cutoff:4.25,maxForce:.025},stericOptions={},includeCoulomb=true,includeSteric=true,includeHBond=true,includePairs=true}={}){
  const molecule=()=>({coulombForce:vec(),stericForce:vec(),hbondForce:vec(),totalForce:vec(),torque:vec()});
  const aggregateA=molecule(),aggregateB=molecule(),pairs=[];
  for(let ai=0;ai<instanceA.atoms.length;ai++)for(let bi=0;bi<instanceB.atoms.length;bi++){
    const a=instanceA.atoms[ai],b=instanceB.atoms[bi],delta=sub(b.position,a.position),terms=atomInteractionForce(a,b,delta,{chargeOptions,stericOptions});
    const cx=includeCoulomb?terms.coulomb.x:0,cy=includeCoulomb?terms.coulomb.y:0,cz=includeCoulomb?terms.coulomb.z:0,sx=includeSteric?terms.steric.x:0,sy=includeSteric?terms.steric.y:0,sz=includeSteric?terms.steric.z:0,fx=cx+sx,fy=cy+sy,fz=cz+sz;
    aggregateA.coulombForce.x+=cx;aggregateA.coulombForce.y+=cy;aggregateA.coulombForce.z+=cz;aggregateB.coulombForce.x-=cx;aggregateB.coulombForce.y-=cy;aggregateB.coulombForce.z-=cz;
    aggregateA.stericForce.x+=sx;aggregateA.stericForce.y+=sy;aggregateA.stericForce.z+=sz;aggregateB.stericForce.x-=sx;aggregateB.stericForce.y-=sy;aggregateB.stericForce.z-=sz;
    aggregateA.totalForce.x+=fx;aggregateA.totalForce.y+=fy;aggregateA.totalForce.z+=fz;aggregateB.totalForce.x-=fx;aggregateB.totalForce.y-=fy;aggregateB.totalForce.z-=fz;
    const ax=a.position.x-instanceA.center.x,ay=a.position.y-instanceA.center.y,az=a.position.z-instanceA.center.z,bx=b.position.x-instanceB.center.x,by=b.position.y-instanceB.center.y,bz=b.position.z-instanceB.center.z;
    aggregateA.torque.x+=ay*fz-az*fy;aggregateA.torque.y+=az*fx-ax*fz;aggregateA.torque.z+=ax*fy-ay*fx;aggregateB.torque.x-=by*fz-bz*fy;aggregateB.torque.y-=bz*fx-bx*fz;aggregateB.torque.z-=bx*fy-by*fx;
    if(includePairs)pairs.push({instanceAId:instanceA.id,atomA:ai,elementA:a.element,chargeA:a.interactionCharge,instanceBId:instanceB.id,atomB:bi,elementB:b.element,chargeB:b.interactionCharge,distance:terms.distance,coulombForce:includeCoulomb?terms.coulomb:vec(),coulombMagnitude:includeCoulomb?terms.coulombMagnitude:0,stericForce:includeSteric?terms.steric:vec(),stericMagnitude:includeSteric?terms.stericMagnitude:0,minimumSeparation:terms.minimumSeparation,hbondForce:false});
  }
  for(const bond of hbonds){if(!includeHBond)continue;const aSide=bond.donorInstanceId===instanceA.id?instanceA:bond.donorInstanceId===instanceB.id?instanceB:null,bSide=bond.acceptorInstanceId===instanceA.id?instanceA:bond.acceptorInstanceId===instanceB.id?instanceB:null;if(!aSide||!bSide||aSide===bSide)continue;
    const donorAtom=bond.donorHydrogenAtom,acceptorAtom=bond.acceptorAtom,donor=aSide.atoms[donorAtom],acceptor=bSide.atoms[acceptorAtom];if(!donor||!acceptor)continue;
    const relative=bond.relativeSeparationSpeed??0;
    const forces=hydrogenBondDirectionalForces({donorPosition:aSide.atoms[bond.donorAtom]?.position??donor.position,hydrogenPosition:donor.position,acceptorPosition:acceptor.position,acceptorOpenDirection:bond.acceptorOpenDirection,targetDistance:bond.equilibriumDistance??1.95,relativeSeparationSpeed:relative});
    const donorForce=forces.onDonor,acceptorForce=forces.onAcceptor;
    const donorAggregate=aSide===instanceA?aggregateA:aggregateB,acceptorAggregate=bSide===instanceA?aggregateA:aggregateB;
    donorAggregate.hbondForce=add(donorAggregate.hbondForce,donorForce);acceptorAggregate.hbondForce=add(acceptorAggregate.hbondForce,acceptorForce);
    donorAggregate.totalForce=add(donorAggregate.totalForce,donorForce);acceptorAggregate.totalForce=add(acceptorAggregate.totalForce,acceptorForce);
    donorAggregate.torque=add(donorAggregate.torque,add(cross(sub(donor.position,aSide.center),donorForce),forces.donorTorque));acceptorAggregate.torque=add(acceptorAggregate.torque,add(cross(sub(acceptor.position,bSide.center),acceptorForce),forces.acceptorTorque));
    const row=includePairs&&(pairs.find(item=>item.instanceAId===aSide.id&&item.atomA===donorAtom&&item.instanceBId===bSide.id&&item.atomB===acceptorAtom)||pairs.find(item=>item.instanceAId===bSide.id&&item.atomA===acceptorAtom&&item.instanceBId===aSide.id&&item.atomB===donorAtom));if(row){row.hbondForce=true;row.hbondMagnitude=forces.magnitude;row.hbondTorqueMagnitude=forces.angularTorqueMagnitude;}
  }
  return {pairs,molecules:{[instanceA.id]:aggregateA,[instanceB.id]:aggregateB}};
}

function isAmideNitrogen(record,atom){return atomElement(record,atom)==='N'&&neighbors(record,atom).some(([carbon])=>atomElement(record,carbon)==='C'&&neighbors(record,carbon).some(([other,order])=>other!==atom&&atomElement(record,other)==='O'&&order>=2));}
export function classifyHydrogenBondSites(record){
  const donors=[],acceptors=[];
  for(let atom=0;atom<record.atoms.length;atom++){
    const element=atomElement(record,atom),bonded=neighbors(record,atom),hydrogens=bonded.filter(([other])=>atomElement(record,other)==='H').map(([other])=>other);
    const hasHydrogen=hydrogens.length>0;
    if(hasHydrogen&&(element==='O'||element==='N'))donors.push({atom,hydrogens});
    if(element==='O'){
      const carbonNeighbors=bonded.filter(([other])=>atomElement(record,other)==='C');
      const acidicHydroxyl=hasHydrogen&&carbonNeighbors.some(([carbon])=>neighbors(record,carbon).some(([other,order])=>other!==atom&&atomElement(record,other)==='O'&&order>=2));
      const nitroO=bonded.some(([other])=>atomElement(record,other)==='N'&&neighbors(record,other).filter(([n])=>atomElement(record,n)==='O').length>=2);
      if(!acidicHydroxyl&&(bonded.length<=2||nitroO))acceptors.push({atom,capacity:2,kind:carbonNeighbors.some(([carbon])=>neighbors(record,carbon).some(([other,order])=>other!==atom&&atomElement(record,other)==='O'&&order>=2))?'carbonyl-oxygen':'oxygen'});
    } else if(element==='N'&&!isAmideNitrogen(record,atom)){
      const formalCharge=Number(record.formalCharges?.[String(atom)]??record.atoms[atom]?.charge??0);
      if(formalCharge<=0&&bonded.length<=3)acceptors.push({atom,capacity:1,kind:'amine-nitrogen'});
    }
  }
  return {donors,acceptors};
}
export function deriveInteractionModel(record,options){
  const charges=deriveInteractionCharges(record,options),functional=classifyHydrogenBondSites(record);
  const atoms=record.atoms.map((raw,atom)=>({atom,element:atomElement(record,atom),interactionCharge:charges[atom],formalCharge:Number(record.formalCharges?.[String(atom)]??raw?.charge??0)}));
  return {atoms,donors:functional.donors,acceptors:functional.acceptors,netIonicCharge:Number(record.netIonicCharge??0)};
}

export function coulombPairForce(chargeA,chargeB,delta,{strength=.42,softening=.8,cutoff=4,maxForce=.035}={}){
  const distance=Math.hypot(delta.x,delta.y,delta.z);
  if(!distance||distance>=cutoff||!chargeA||!chargeB)return {x:0,y:0,z:0,magnitude:0};
  const product=chargeA*chargeB,denominator=Math.pow(distance*distance+softening*softening,1.5),rawScale=-strength*product/denominator,rawMagnitude=Math.abs(rawScale)*distance,scale=rawMagnitude>maxForce?rawScale*maxForce/rawMagnitude:rawScale;
  return {x:delta.x*scale,y:delta.y*scale,z:delta.z*scale,magnitude:Math.min(maxForce,rawMagnitude)};
}
export function coulombPairForces(chargeA,chargeB,delta,options){
  const onA=coulombPairForce(chargeA,chargeB,delta,options);
  return {onA:{x:onA.x,y:onA.y,z:onA.z},onB:{x:-onA.x,y:-onA.y,z:-onA.z},magnitude:onA.magnitude};
}
export function hydrogenBondEquilibriumDistance(donorElement='O',acceptorElement='O'){
  if(donorElement==='N')return acceptorElement==='N'?2.15:2.05;
  return acceptorElement==='N'?2.05:1.95;
}
export function hydrogenBondAngleDegrees(donor,hydrogen,acceptor){
  const u=sub(donor,hydrogen),v=sub(acceptor,hydrogen),denominator=Math.hypot(u.x,u.y,u.z)*Math.hypot(v.x,v.y,v.z);
  if(!denominator)return 0;
  const cosine=Math.max(-1,Math.min(1,(u.x*v.x+u.y*v.y+u.z*v.z)/denominator));
  return Math.acos(cosine)*180/Math.PI;
}
export function hydrogenBondDirectionalForces({donorPosition,hydrogenPosition,acceptorPosition,acceptorOpenDirection=null,targetDistance=1.95,relativeSeparationSpeed=0},{stiffness=.075,damping=.012,maxForce=.055,angularStiffness=.07}={}){
  const delta=sub(acceptorPosition,hydrogenPosition),distance=Math.hypot(delta.x,delta.y,delta.z);if(!distance)return {onDonor:vec(),onAcceptor:vec(),donorTorque:vec(),acceptorTorque:vec(),magnitude:0,angularTorqueMagnitude:0,equilibriumDistance:targetDistance};
  const radialError=distance-targetDistance;
  // A quadratic well around a generic equilibrium, with an independent steep
  // inner wall. Capture distance never becomes the equilibrium distance.
  const magnitude=Math.max(-maxForce,Math.min(maxForce,radialError*stiffness+relativeSeparationSpeed*damping));
  const onDonor=scale(delta,magnitude/distance),onAcceptor=scale(onDonor,-1);
  const donorAxis=sub(hydrogenPosition,donorPosition),donorLength=Math.hypot(donorAxis.x,donorAxis.y,donorAxis.z),toAcceptor=scale(delta,1/distance);
  let donorTorque=vec(),acceptorTorque=vec();
  // Conventional D–H–A linearity means the donor D→H bond axis and H→A
  // approach vector point in the same direction. Their cross product rotates
  // the donor bond toward 180°; using H→D here would bend it the wrong way.
  if(donorLength>1e-8){const donorBondAxis=scale(donorAxis,1/donorLength);donorTorque=scale(cross(donorBondAxis,toAcceptor),angularStiffness);}
  if(acceptorOpenDirection){const openLength=Math.hypot(acceptorOpenDirection.x,acceptorOpenDirection.y,acceptorOpenDirection.z);if(openLength>1e-8){const incoming=scale(delta,-1/distance);acceptorTorque=scale(cross(scale(acceptorOpenDirection,1/openLength),incoming),angularStiffness*.65);}}
  const angularTorqueMagnitude=Math.hypot(donorTorque.x,donorTorque.y,donorTorque.z)+Math.hypot(acceptorTorque.x,acceptorTorque.y,acceptorTorque.z);
  return {onDonor,onAcceptor,donorTorque,acceptorTorque,magnitude:Math.abs(magnitude),angularTorqueMagnitude,equilibriumDistance:targetDistance};
}
export function hydrogenBondSpringForces(delta,restLength,relativeSeparationSpeed=0,options={}){
  const forces=hydrogenBondDirectionalForces({donorPosition:vec(),hydrogenPosition:vec(),acceptorPosition:delta,targetDistance:restLength,relativeSeparationSpeed},options);
  return {onDonor:forces.onDonor,onAcceptor:forces.onAcceptor,magnitude:forces.magnitude};
}
export function torqueFromForce(offset,force){return {x:offset.y*force.z-offset.z*force.y,y:offset.z*force.x-offset.x*force.z,z:offset.x*force.y-offset.y*force.x};}

export function hydrogenBondEligibility(donor,acceptor,{distance,alignment=1,angle}={}) {
  return donor?.kind==='donor'&&acceptor?.kind==='acceptor'&&Number.isFinite(distance)&&distance<=3.35&&distance>=1.15&&(Number.isFinite(angle)?angle>=140:alignment>=.35);
}
export function chargeInteractionSign(chargeA,chargeB){const product=(Number(chargeA)||0)*(Number(chargeB)||0);return product===0?0:Math.sign(product);}

export function scoreHydrogenBondCandidate({distance,angle=180,acceptorOpenness=1,equilibriumDistance=1.95},{incumbent=false}={}){
  return -(Math.abs(distance-equilibriumDistance)*.52+Math.max(0,180-angle)/70*.78+(1-Math.max(0,Math.min(1,acceptorOpenness)))*.38)+(incumbent?.12:0);
}
export function createHydrogenBondTracker({formationDistance=3.35,breakDistance=4.05,formationAngle=140,breakAngle=105,breakRelativeSpeed=.11,breakTensileLoad=.12,reformCooldownMs=90,replacementAdvantage=.34,replacementDwellMs=320,maxPerMoleculePair=1}={}){
  const active=new Map(),cooldowns=new Map(),challengers=new Map();
  const pairKey=identity=>[identity.donorInstanceId,identity.acceptorInstanceId].sort().join('|');
  function metricsFor(candidate){const legacy=candidate.alignment,angle=candidate.angle??(legacy===undefined?180:105+Math.max(0,Math.min(1,(legacy-.12)/.88))*75);return {...candidate,angle,equilibriumDistance:candidate.equilibriumDistance??hydrogenBondEquilibriumDistance(candidate.donorElement??'O',candidate.acceptorElement??'O'),score:scoreHydrogenBondCandidate({...candidate,angle,equilibriumDistance:candidate.equilibriumDistance??hydrogenBondEquilibriumDistance(candidate.donorElement??'O',candidate.acceptorElement??'O')})};}
  function conflicts(candidate,bond){const x=candidate.acceptorApproachDirection,y=bond.acceptorApproachDirection,overlappingSector=x&&y&&(x.x*y.x+x.y*y.y+x.z*y.z)>.7;return (candidate.donorInstanceId===bond.donorInstanceId&&candidate.donorHydrogenAtom===bond.donorHydrogenAtom)||(pairKey(candidate)===pairKey(bond)&&maxPerMoleculePair<=1)||(candidate.acceptorInstanceId===bond.acceptorInstanceId&&candidate.acceptorAtom===bond.acceptorAtom&&overlappingSector);}
  function form(candidate,now){const {key,...data}=candidate,bond={...data,key,formedAt:now,lastDistance:data.distance,lastAngle:data.angle,incumbentSince:now,restLength:data.equilibriumDistance};active.set(key,bond);return bond;}
  function updateAll(rawCandidates,now){
    const byKey=new Map(rawCandidates.map(item=>{const value=metricsFor(item);return [value.key,value];})),broken=[];
    for(const [key,bond] of active){const current=byKey.get(key);if(!current){active.delete(key);cooldowns.set(key,now+reformCooldownMs);broken.push({key,reason:'candidate-lost'});continue;}
      const speed=current.relativeSpeed??0,load=current.tensileLoad??Math.max(0,current.distance-bond.equilibriumDistance)*.028;
      if(current.distance>breakDistance||current.distance<1.15||current.angle<breakAngle||speed>breakRelativeSpeed||load>breakTensileLoad){active.delete(key);cooldowns.set(key,now+reformCooldownMs);challengers.delete(key);const reason=current.distance>breakDistance?'extension':current.distance<1.15?'compression':current.angle<breakAngle?'angle':speed>breakRelativeSpeed?'relative-speed':'tensile-load';broken.push({key,reason});continue;}
      Object.assign(bond,current,{lastDistance:current.distance,lastAngle:current.angle,relativeSpeed:speed,tensileLoad:load,score:scoreHydrogenBondCandidate(current,{incumbent:true})});
    }
    const eligible=[...byKey.values()].filter(item=>item.distance<=formationDistance&&item.distance>=1.15&&item.angle>=formationAngle&&(item.acceptorOpenness??1)>=.2&&!(now<(cooldowns.get(item.key)??0))).sort((a,b)=>scoreHydrogenBondCandidate(b,{incumbent:active.has(b.key)})-scoreHydrogenBondCandidate(a,{incumbent:active.has(a.key)})||a.key.localeCompare(b.key)),suppressed=new Set();
    for(const candidate of eligible){if(suppressed.has(candidate.key))continue;const incumbent=active.get(candidate.key);if(incumbent){Object.assign(incumbent,{...candidate,score:scoreHydrogenBondCandidate(candidate,{incumbent:true})});continue;}
      const occupied=[...active.values()],acceptorCapacity=candidate.acceptorCapacity??2,acceptorBonds=occupied.filter(bond=>bond.acceptorInstanceId===candidate.acceptorInstanceId&&bond.acceptorAtom===candidate.acceptorAtom),conflictsNow=[...new Map([...occupied.filter(bond=>conflicts(candidate,bond)),...acceptorBonds.slice(Math.max(0,acceptorCapacity-1))].map(bond=>[bond.key,bond])).values()];
      if(conflictsNow.length){const challengerScore=scoreHydrogenBondCandidate(candidate),beatsEveryConflict=conflictsNow.every(bond=>challengerScore>=(bond.score??scoreHydrogenBondCandidate(bond,{incumbent:true}))+replacementAdvantage),since=challengers.get(candidate.key);
        if(beatsEveryConflict){if(since===undefined){challengers.set(candidate.key,now);continue;}if(now-since<replacementDwellMs)continue;for(const conflict of conflictsNow){active.delete(conflict.key);cooldowns.set(conflict.key,now+reformCooldownMs);suppressed.add(conflict.key);}challengers.delete(candidate.key);form(candidate,now);}
        else challengers.delete(candidate.key);
        continue;
      }
      challengers.delete(candidate.key);form(candidate,now);
    }
    for(const key of challengers.keys())if(!byKey.has(key))challengers.delete(key);
    return {active:[...active.values()],broken,challengers:[...challengers].map(([key,since])=>({key,since}))};
  }
  return {
    updateAll,
    update(key,identity,metrics,now){const candidate={...identity,...metrics,key,acceptorCapacity:identity?.acceptorCapacity??1},before=active.has(key);if(!before&&candidate.distance<formationDistance&&candidate.distance>=1.15&&metricsFor(candidate).angle>=formationAngle){const bonds=[...active.values()];if(bonds.some(bond=>bond.donorInstanceId===identity.donorInstanceId&&bond.donorHydrogenAtom===identity.donorHydrogenAtom))return {formed:false,bond:null,broken:false,blocked:'donor-occupied'};if(bonds.filter(bond=>bond.acceptorInstanceId===identity.acceptorInstanceId&&bond.acceptorAtom===identity.acceptorAtom).length>=candidate.acceptorCapacity)return {formed:false,bond:null,broken:false,blocked:'acceptor-capacity'};if(bonds.some(bond=>pairKey(bond)===pairKey(identity))&&maxPerMoleculePair<=1)return {formed:false,bond:null,broken:false,blocked:'pair-capacity'};}const result=updateAll([...byKeyCurrent(),candidate],now);const bond=active.get(key)??null;return {formed:!before&&!!bond,bond,broken:result.broken.some(item=>item.key===key)};},
    get(key){return active.get(key)??null;},values(){return [...active.values()];},diagnostics(){return [...challengers].map(([key,since])=>({key,since,reason:'challenger-score-dwell'}));},delete(key){challengers.delete(key);return active.delete(key);},reset(){active.clear();cooldowns.clear();challengers.clear();},
  };
  function byKeyCurrent(){return [...active.values()];}
}

function siteMatches(record,siteName,atomId){
  const element=record.atoms.map((_,i)=>atomElement(record,i))[atomId], ns=neighbors(record,atomId);
  if(siteName==='water-oxygen')return record.id==='water'&&element==='O';
  if(siteName==='alcohol-oxygen')return element==='O'&&ns.some(([other])=>atomElement(record,other)==='C')&&ns.some(([other])=>atomElement(record,other)==='H');
  if(siteName==='anhydride-carbonyl-carbon')return element==='C'&&ns.filter(([other,order])=>atomElement(record,other)==='O'&&order===2).length>=1&&ns.filter(([other])=>atomElement(record,other)==='O').length>=2;
  return false;
}
export function reactionCandidates(pair, records, rules=REACTION_RULES){
  const [left,right]=pair,byId=new Map(records.map(record=>[record.id,record])),matches=[];
  for(const rule of rules){if(rule.activation!=='contact')continue;const [a,b]=rule.reactants;
    for(const [first,second,flipped] of [[left,right,false],[right,left,true]])if(first.species===a.species&&second.species===b.species){
      const recordA=byId.get(a.species),recordB=byId.get(b.species);if(!recordA||!recordB)continue;
      for(let i=0;i<recordA.atoms.length;i++)for(let j=0;j<recordB.atoms.length;j++)if(siteMatches(recordA,a.site,i)&&siteMatches(recordB,b.site,j))matches.push({ruleId:rule.id,rule,speciesIds:[a.species,b.species],reactantInstanceIds:[first.id,second.id],siteAtomIndices:[i,j]});
    }
  }
  return matches;
}
export function resolveCandidateInstanceIds(candidate,availableInstanceIds){
  const available=new Set(availableInstanceIds);
  return candidate?.reactantInstanceIds?.length===2&&candidate.reactantInstanceIds.every(id=>available.has(id))?[...candidate.reactantInstanceIds]:null;
}
export function hydrogenBondVisualEndpoints(bond){
  if(!bond||!Number.isInteger(bond.donorHydrogenAtom)||!Number.isInteger(bond.acceptorAtom))return null;
  return {from:{instanceId:bond.donorInstanceId,atom:bond.donorHydrogenAtom},to:{instanceId:bond.acceptorInstanceId,atom:bond.acceptorAtom}};
}
export function createContactMatcher({dwellMs=CONTACT_DWELL_MS}={}){
  const contacts=new Map();return {update(key,eligible,now){if(!eligible){contacts.delete(key);return false;}const since=contacts.get(key)??now;contacts.set(key,since);return now-since>=dwellMs;},clear(key){contacts.delete(key);},reset(){contacts.clear();}};
}
export function planStoichiometricSupply(reactantIds,selectedSlots){const selected=new Set(selectedSlots.filter(Boolean));return reactantIds.every(id=>selected.has(id))?{ok:true,missing:reactantIds.filter(id=>!selected.has(id))}:{ok:false,reason:'required-species-not-in-slots'};}
export function resolveRegisteredProducts(productIds,records){const byId=new Map(records.map(record=>[record.id,record]));const products=productIds.map(id=>byId.get(id));return products.every(Boolean)?{ok:true,products}:{ok:false,reason:'product-not-in-database'};}
export function transformReactionGraph(rule,records){
  const byId=new Map(records.map(record=>[record.id,record])),reactants=rule.reactants.map(item=>byId.get(item.species)),resolved=resolveRegisteredProducts(rule.products,records);
  if(reactants.some(record=>!record)||!resolved.ok)return {ok:false,reason:'reactant-or-product-not-in-database'};
  const sourceAtoms=[],sourceBonds=[];for(const record of reactants){const offset=sourceAtoms.length;record.atoms.forEach((_,index)=>sourceAtoms.push({id:offset+index,element:atomElement(record,index)}));record.bonds.forEach(([a,b,order])=>sourceBonds.push({a:a+offset,b:b+offset,order}));}
  const maps=rule.atomMaps;if(!Array.isArray(maps)||maps.length!==resolved.products.length||maps.some((map,index)=>map.length!==resolved.products[index].atoms.length))return {ok:false,reason:'invalid-atom-map'};
  const allMapped=maps.flat();if(allMapped.length!==sourceAtoms.length||new Set(allMapped).size!==sourceAtoms.length||allMapped.some(id=>!sourceAtoms[id]))return {ok:false,reason:'unbalanced-atom-map'};
  const graphs=resolved.products.map((record,index)=>{const atomMap=maps[index],atoms=atomMap.map((sourceId,productId)=>({id:sourceId,element:atomElement(record,productId)}));if(atoms.some((atom,productId)=>atom.element!==sourceAtoms[atomMap[productId]].element))return null;const bonds=record.bonds.map(([a,b,order])=>({a:atomMap[a],b:atomMap[b],order}));return {record,atoms,bonds,atomMap};});
  if(graphs.some(graph=>!graph))return {ok:false,reason:'atom-map-element-mismatch'};
  const sourceEdge=new Map(sourceBonds.map(({a,b,order})=>[`${Math.min(a,b)}:${Math.max(a,b)}`,order])),productEdges=new Map(graphs.flatMap(graph=>graph.bonds.map(({a,b,order})=>[`${Math.min(a,b)}:${Math.max(a,b)}`,order])));
  const brokenBonds=sourceBonds.filter(bond=>productEdges.get(`${Math.min(bond.a,bond.b)}:${Math.max(bond.a,bond.b)}`)!==bond.order);
  const formedBonds=graphs.flatMap(graph=>graph.bonds.filter(bond=>sourceEdge.get(`${Math.min(bond.a,bond.b)}:${Math.max(bond.a,bond.b)}`)!==bond.order));
  for(const graph of graphs)if(matchDatabaseProduct(graph,records)?.id!==graph.record.id)return {ok:false,reason:'product-graph-unmatched'};
  return {ok:true,reactantGraph:{atoms:sourceAtoms,bonds:sourceBonds},productGraphs:graphs,brokenBonds,formedBonds};
}
export function planReactionExecution(candidate,records,selectedSlots,rules=REACTION_RULES){
  const rule=rules.find(item=>item.id===candidate?.rule?.id);if(!rule||rule.activation!=='contact')return {ok:false,reason:'inactive-or-unregistered-rule'};
  const required=rule.reactants.map(item=>item.species),actualIds=candidate.reactantInstanceIds??[],actualSpecies=candidate.speciesIds??[],consumed=[],supplied=[];
  if(candidate.ruleId!==rule.id||candidate.siteAtomIndices?.length!==required.length||actualSpecies.length!==actualIds.length)return {ok:false,reason:'invalid-candidate'};
  for(const species of new Set(required)){const count=required.filter(id=>id===species).length,instances=actualIds.flatMap((id,index)=>actualSpecies[index]===species?[{id,species}]:[]);consumed.push(...instances.slice(0,count));for(let i=instances.length;i<count;i++)supplied.push(species);}
  if(consumed.length+supplied.length!==required.length)return {ok:false,reason:'reactant-mismatch'};
  const supply=planStoichiometricSupply(supplied,selectedSlots);if(!supply.ok)return supply;
  const graphTransition=transformReactionGraph(rule,records);if(!graphTransition.ok)return graphTransition;
  const products=graphTransition.productGraphs.map(graph=>matchDatabaseProduct(graph,records));
  return {ok:true,rule,consumedInstanceIds:consumed.map(item=>item.id),temporarySupply:supplied,products,productInstanceCount:products.length,graphTransition};
}
export function matchDatabaseProduct(graph,records){
  for(const record of records){if(graph.atoms.length!==record.atoms.length||graph.bonds.length!==record.bonds.length)continue;
    const atoms=graph.atoms.map(atom=>({id:atom.id,element:atom.element}));
    const productAtoms=record.atoms.map((_,id)=>atomElement(record,id));
    const productBonds=record.bonds.map(([a,b,order])=>[a,b,order]);
    if(graphsAreIsomorphic(atoms,graph.bonds,productAtoms,productBonds))return record;
  }return null;
}
