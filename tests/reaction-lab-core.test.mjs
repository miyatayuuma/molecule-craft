import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSpeciesSlots, planVisiblePopulation, deriveInteractionSites, deriveInteractionModel, deriveInteractionCharges, classifyHydrogenBondSites, hydrogenBondEligibility, createHydrogenBondTracker, hydrogenBondVisualEndpoints, hydrogenBondEquilibriumDistance, hydrogenBondAngleDegrees, hydrogenBondDirectionalForces, scoreHydrogenBondCandidate, coulombPairForce, coulombPairForces, hydrogenBondSpringForces, torqueFromForce, chargeInteractionSign, reactionCandidates, resolveCandidateInstanceIds, createContactMatcher, planStoichiometricSupply, planReactionExecution, resolveRegisteredProducts, matchDatabaseProduct, auditInteractionDatabase, interactionDipole, decomposeMoleculePairInteraction } from '../src/reaction-lab-core.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(r=>[r.id,r]));

test('three equal slots allow zero to three discovered species and reject duplicates',()=>{
 assert.deepEqual(normalizeSpeciesSlots([],records).slots,['','','']);assert.equal(normalizeSpeciesSlots(['water','ethanol',''],records).ok,true);assert.equal(normalizeSpeciesSlots(['water','water',''],records).reason,'duplicate-species');assert.equal(normalizeSpeciesSlots(['missing','',''],records).reason,'unknown-species');
});
test('representative population is four for one species and two per species for two or three',()=>{
 assert.equal(planVisiblePopulation(['water','','']).length,4);assert.equal(planVisiblePopulation(['water','ethanol','']).length,4);assert.equal(planVisiblePopulation(['water','ethanol','acetic-acid']).length,6);assert.equal(planVisiblePopulation(['','','']).length,0);
});
test('atom interaction charges are one neutralized value per atom and distinct from formal charge',()=>{
 const water=byId.get('water'),waterModel=deriveInteractionModel(water),charges=deriveInteractionCharges(water);
 assert.equal(charges.length,water.atoms.length);assert.equal(new Set(waterModel.atoms.map(atom=>atom.atom)).size,water.atoms.length);
 assert.ok(charges[0]<0);assert.ok(charges[1]>0);assert.ok(Math.abs(charges.reduce((sum,value)=>sum+value,0))<1e-10);
 const nitro=byId.get('nitrobenzene'),nitroModel=deriveInteractionModel(nitro);assert.equal(nitroModel.atoms[6].formalCharge,1);assert.notEqual(nitroModel.atoms[6].interactionCharge,nitroModel.atoms[6].formalCharge);
 const ionModel=deriveInteractionModel({atoms:['Na','Cl'],bonds:[],netIonicCharge:-1});assert.equal(ionModel.netIonicCharge,-1);assert.deepEqual(ionModel.atoms.map(atom=>atom.interactionCharge),[0,0]);
 assert.ok(deriveInteractionSites(water).every(site=>site.kind!=='partial-charge'));
});
test('bond-order aware charge derivation recognizes carbonyls and keeps methane weakly polar',()=>{
 const acetone=deriveInteractionModel(byId.get('acetone')).atoms,methane=deriveInteractionModel(byId.get('methane')).atoms;
 assert.ok(acetone[3].interactionCharge<0);assert.ok(acetone[1].interactionCharge>0);
 assert.ok(Math.max(...methane.map(atom=>Math.abs(atom.interactionCharge)))<.04);
 assert.ok(Math.abs(methane.reduce((sum,atom)=>sum+atom.interactionCharge,0))<1e-10);
});
test('interaction charge authority preserves polarity, symmetry, neutrality, and a bounded magnitude',()=>{
 const close=(a,b,tolerance=1e-8)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);
 for(const id of ['water','carbon-dioxide','carbonic-acid','ethanol','acetone','methane','oxygen']){const charges=deriveInteractionCharges(byId.get(id));assert.ok(charges.every(Number.isFinite));assert.ok(Math.max(...charges.map(Math.abs))<=.42);close(charges.reduce((sum,value)=>sum+value,0),0);}
 const co2=deriveInteractionCharges(byId.get('carbon-dioxide'));assert.ok(co2[0]>0&&co2[1]<0);close(co2[1],co2[2]);
 const co2Dipole=interactionDipole(co2,[{x:0,y:0,z:0},{x:-1.16,y:0,z:0},{x:1.16,y:0,z:0}]);assert.ok(Math.hypot(co2Dipole.x,co2Dipole.y,co2Dipole.z)<1e-8);
 const water=deriveInteractionCharges(byId.get('water')),waterDipole=interactionDipole(water,[{x:0,y:0,z:0},{x:.76,y:.59,z:0},{x:-.76,y:.59,z:0}]);assert.ok(Math.hypot(waterDipole.x,waterDipole.y,waterDipole.z)>.1);assert.ok(waterDipole.y>0,'water dipole points from negative O toward its positive H side');
 const methane=deriveInteractionCharges(byId.get('methane'));assert.ok(Math.max(...methane.map(Math.abs))<.04);const methaneDipole=interactionDipole(methane,[{x:0,y:0,z:0},{x:1,y:1,z:1},{x:1,y:-1,z:-1},{x:-1,y:1,z:-1},{x:-1,y:-1,z:1}]);assert.ok(Math.hypot(methaneDipole.x,methaneDipole.y,methaneDipole.z)<1e-8);
 const acetone=deriveInteractionCharges(byId.get('acetone')),acetoneDipole=interactionDipole(acetone,[{x:-1,y:0,z:0},{x:0,y:0,z:0},{x:-1,y:0,z:0},{x:1.2,y:0,z:0},{x:-1,y:1,z:0},{x:-1,y:-1,z:0},{x:-1,y:0,z:1},{x:-1,y:0,z:-1},{x:-1,y:.7,z:.7},{x:-1,y:-.7,z:-.7}]);assert.ok(Math.hypot(acetoneDipole.x,acetoneDipole.y,acetoneDipole.z)>.1,'acetone retains a carbonyl-directed polar tendency');
 const acid=deriveInteractionCharges(byId.get('acetic-acid')),ethanol=deriveInteractionCharges(byId.get('ethanol'));assert.ok(acid[3]<0&&acid[7]>0);assert.notEqual(acid[7],ethanol[8],'carboxylic OH and alcohol O-H receive environment-aware charge distributions');
});
test('whole molecule database interaction audit reports no unsupported bond environments or invalid charges',()=>{
 const findings=auditInteractionDatabase(records);assert.deepEqual(findings,[]);
});
test('representative polar bond families receive the expected charge direction',()=>{
 const cases=[['O-H',['O','H'],[0,1,1],0],['N-H',['N','H'],[0,1,1],0],['C-O',['C','O'],[0,1,1],1],['C=O',['C','O'],[0,1,2],1],['C-N',['C','N'],[0,1,1],1],['C≡N',['C','N'],[0,1,3],1],['C-F',['C','F'],[0,1,1],1],['C-Cl',['C','Cl'],[0,1,1],1],['S=O',['S','O'],[0,1,2],1]];
 for(const [name,atoms,bond,negativeIndex] of cases){const charges=deriveInteractionCharges({atoms,bonds:[bond]});assert.ok(charges[negativeIndex]<0,`${name} should place the negative tendency on its more electronegative atom`);assert.ok(charges[1-negativeIndex]>0);}
});
test('donor and acceptor sites use functional-group context',()=>{
 const water=classifyHydrogenBondSites(byId.get('water')),ethanol=classifyHydrogenBondSites(byId.get('ethanol'));
 const acid=classifyHydrogenBondSites(byId.get('acetic-acid')),acetone=classifyHydrogenBondSites(byId.get('acetone'));
 const amide=classifyHydrogenBondSites({atoms:['C','O','N','H'],bonds:[[0,1,2],[0,2,1],[2,3,1]]}),amine=classifyHydrogenBondSites({atoms:['C','N','C'],bonds:[[0,1,1],[1,2,1]]}),organicFluoride=classifyHydrogenBondSites({atoms:['C','F'],bonds:[[0,1,1]]});
 assert.equal(water.donors.length,1);assert.equal(water.acceptors.length,1);
 assert.equal(ethanol.donors.length,1);assert.equal(ethanol.acceptors.length,1);
 assert.equal(acid.donors.length,1);assert.equal(acid.acceptors.length,1);assert.ok(acetone.acceptors.some(site=>site.atom===3));
 assert.equal(amide.donors.length,1);assert.equal(amide.acceptors.some(site=>site.atom===2),false);
 assert.ok(amine.acceptors.some(site=>site.atom===1));assert.deepEqual(organicFluoride.acceptors,[]);
});
test('hydrogen bonding requires donor, acceptor, plausible distance, and rough alignment',()=>{
 const donor={kind:'donor'},acceptor={kind:'acceptor'};assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,angle:180}),true);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,angle:139}),false);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.7}),true);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.1}),false);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:4,alignment:1}),false);
});
test('formal charge interaction sign distinguishes attraction and repulsion',()=>{assert.equal(chargeInteractionSign(1,-1),-1);assert.equal(chargeInteractionSign(1,1),1);assert.equal(chargeInteractionSign(0,-1),0);});
test('softened atom force has opposite-charge attraction, same-charge repulsion, and a finite cap',()=>{
 const toward=coulombPairForce(.3,-.3,{x:1,y:0,z:0}),away=coulombPairForce(.3,.3,{x:1,y:0,z:0}),capped=coulombPairForce(.65,.65,{x:.001,y:0,z:0});
 assert.ok(toward.x>0);assert.ok(away.x<0);assert.ok(Math.abs(capped.x)<=.035);assert.deepEqual(coulombPairForce(.2,.2,{x:5,y:0,z:0}),{x:0,y:0,z:0,magnitude:0});
 const longRange=coulombPairForce(.65,-.65,{x:3.9,y:0,z:0},{strength:100,softening:.01,cutoff:4,maxForce:.035});assert.ok(Math.hypot(longRange.x,longRange.y,longRange.z)<=.035+1e-12);assert.ok(Math.abs(Math.hypot(longRange.x,longRange.y,longRange.z)-longRange.magnitude)<1e-12,'reported magnitude equals vector length');
 const pair=coulombPairForces(.3,-.3,{x:1,y:0,z:0});assert.equal(pair.onA.x+pair.onB.x,0);assert.equal(pair.onA.y+pair.onB.y,0);
});
test('atom-pair Coulomb sign and Newton pair hold independently of element identity',()=>{
 for(const [qa,qb,sign] of [[.2,.3,-1],[-.2,-.3,-1],[.2,-.3,1],[-.2,.3,1]]){const delta={x:1.3,y:-.4,z:.2},force=coulombPairForce(qa,qb,delta);assert.ok(force.x*delta.x+force.y*delta.y+force.z*delta.z<0=== (sign<0));const pair=coulombPairForces(qa,qb,delta);assert.ok(Math.hypot(pair.onA.x+pair.onB.x,pair.onA.y+pair.onB.y,pair.onA.z+pair.onB.z)<1e-12);}
});
test('pair decomposition exposes Coulomb, steric, H-bond, net force, and torque with close-range steric dominance',()=>{
 const atom=(charge,position,element='O',excludedRadius=.3)=>({interactionCharge:charge,position,element,excludedRadius}),left={id:'w1',center:{x:0,y:0,z:0},atoms:[atom(-.42,{x:0,y:0,z:0}),atom(.21,{x:.8,y:.6,z:0},'H',.23)]},right={id:'w2',center:{x:0,y:0,z:0},atoms:[atom(-.42,{x:.3,y:0,z:0}),atom(.21,{x:1.1,y:.6,z:0},'H',.23)]};
 const closePair=decomposeMoleculePairInteraction(left,right,{chargeOptions:{strength:.42,softening:.85,cutoff:4.25,maxForce:.025},stericOptions:{stiffness:4.5,maxForce:.24}}),oo=closePair.pairs.find(pair=>pair.atomA===0&&pair.atomB===0);
 assert.ok(oo.coulombForce.x<0,'same-sign O/O Coulomb component repels');assert.ok(oo.stericMagnitude>Math.abs(oo.coulombForce.x),'excluded volume dominates the overlapped attractive/repulsive pair');assert.ok(closePair.pairs.every(pair=>Number.isFinite(pair.coulombMagnitude)&&Number.isFinite(pair.stericMagnitude)));
 const severe=decomposeMoleculePairInteraction({id:'a',center:{x:0,y:0,z:0},atoms:[atom(.4,{x:0,y:0,z:0})]},{id:'b',center:{x:.08,y:0,z:0},atoms:[atom(-.4,{x:.08,y:0,z:0})]},{stericOptions:{stiffness:4.5,maxForce:.24}}).pairs[0];assert.ok(severe.stericMagnitude>severe.coulombMagnitude,'short-range steric wall beats opposite-charge attraction');assert.ok(Number.isFinite(severe.stericMagnitude));
 const coincident=decomposeMoleculePairInteraction({id:'x',center:{x:0,y:0,z:0},atoms:[atom(.4,{x:0,y:0,z:0})]},{id:'y',center:{x:0,y:0,z:0},atoms:[atom(-.4,{x:0,y:0,z:0})]}).pairs[0];assert.ok(coincident.stericMagnitude>0&&Number.isFinite(coincident.stericForce.x),'exactly coincident atoms receive a finite deterministic separation direction');
 const offCenter=decomposeMoleculePairInteraction({id:'off',center:{x:0,y:0,z:0},atoms:[atom(.3,{x:0,y:1,z:0})]},{id:'other',center:{x:2,y:1,z:0},atoms:[atom(-.3,{x:2,y:1,z:0})]},{includeSteric:false});assert.ok(Math.abs(offCenter.molecules.off.torque.z)>0,'atom-site force produces molecular torque');
 const hbond=decomposeMoleculePairInteraction(left,right,{includeCoulomb:false,includeSteric:false,hbonds:[{donorInstanceId:'w1',donorHydrogenAtom:1,acceptorInstanceId:'w2',acceptorAtom:0,restLength:1.8}]});assert.ok(Math.hypot(...Object.values(hbond.molecules.w1.hbondForce))>0);assert.ok(hbond.molecules.w1.hbondForce.x===-hbond.molecules.w2.hbondForce.x);assert.ok(hbond.pairs.find(pair=>pair.atomA===1&&pair.atomB===0).hbondForce);assert.equal(hbond.pairs.find(pair=>pair.atomA===0&&pair.atomB===0).hbondForce,false);
});
test('hydrogen-bond spring pulls partners together with equal and opposite forces',()=>{
 const pair=hydrogenBondSpringForces({x:3,y:0,z:0},2,0),capped=hydrogenBondSpringForces({x:40,y:0,z:0},2,0);
 assert.ok(pair.onDonor.x>0);assert.ok(pair.onAcceptor.x<0);assert.equal(pair.onDonor.x+pair.onAcceptor.x,0);assert.ok(capped.magnitude<=.055);
});
test('off-center force creates a torque around the molecule center',()=>assert.deepEqual(torqueFromForce({x:1,y:0,z:0},{x:0,y:1,z:0}),{x:0,y:0,z:1}));
test('only site-matched pairwise contact rules are eligible; activated rules stay dormant',()=>{
 const pair=[{species:'acetic-anhydride',id:'an-1'},{species:'water',id:'w-1'}],hydrolysis=reactionCandidates(pair,records).find(c=>c.ruleId==='anhydride-hydrolysis');assert.ok(hydrolysis);assert.deepEqual(hydrolysis.reactantInstanceIds,['an-1','w-1']);assert.deepEqual(hydrolysis.siteAtomIndices,[1,0]);assert.ok(reactionCandidates([{species:'acetic-anhydride',id:'an-2'},{species:'ethanol',id:'e-1'}],records).some(c=>c.ruleId==='anhydride-alcoholysis'));
 assert.deepEqual(reactionCandidates(pair,records,[{...{id:'future',activation:'activated'},reactants:[{species:'acetic-anhydride',site:'anhydride-carbonyl-carbon'},{species:'water',site:'water-oxygen'}]}]),[]);
 assert.deepEqual(reactionCandidates([{species:'oxygen',id:'o2'},{species:'ethanol',id:'e'}],records),[]);assert.deepEqual(reactionCandidates([{species:'hydrogen',id:'h2'},{species:'acetic-acid',id:'acid'}],records),[]);
});
test('runtime candidate IDs resolve to present instances without Three.js objects in core data',()=>{
 const candidate=reactionCandidates([{species:'water',id:'w-1'},{species:'acetic-anhydride',id:'a-1'}],records)[0];
 assert.deepEqual(resolveCandidateInstanceIds(candidate,['w-1','a-1']),candidate.reactantInstanceIds);assert.equal(resolveCandidateInstanceIds(candidate,['w-1']),null);
 assert.equal('group' in candidate,false);assert.equal('record' in candidate,false);
});
test('contact matcher debounces brief threshold crossings',()=>{const matcher=createContactMatcher({dwellMs:500});assert.equal(matcher.update('pair',true,10),false);assert.equal(matcher.update('pair',false,300),false);assert.equal(matcher.update('pair',true,400),false);assert.equal(matcher.update('pair',true,900),true);});
test('capture range is separate from equilibrium and active H-bonds pull while correcting angle',()=>{
 assert.equal(hydrogenBondEquilibriumDistance('O','O'),1.95);assert.equal(hydrogenBondEquilibriumDistance('N','O'),2.05);
 const geometry={donorPosition:{x:0,y:1,z:0},hydrogenPosition:{x:0,y:0,z:0},acceptorPosition:{x:2.8,y:0,z:0},acceptorOpenDirection:{x:1,y:0,z:0},targetDistance:1.95};
 const force=hydrogenBondDirectionalForces(geometry);assert.ok(force.magnitude>0,'capture at 2.8 Å still attracts toward canonical equilibrium');assert.ok(force.onDonor.x>0);assert.ok(force.donorTorque.z>0,'donor D→H axis rotates toward H→A, increasing the conventional D-H-A angle toward 180°');assert.ok(force.angularTorqueMagnitude>0,'bent donor/acceptor geometry gets restoring torque');
 assert.equal(hydrogenBondAngleDegrees(geometry.donorPosition,geometry.hydrogenPosition,geometry.acceptorPosition),90);
 assert.equal(hydrogenBondAngleDegrees({x:-1,y:0,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0}),180,'D-H-A reports the conventional angle, with linear bonding at 180 degrees');
 const equilibrium=hydrogenBondDirectionalForces({...geometry,acceptorPosition:{x:1.95,y:0,z:0}});assert.ok(equilibrium.magnitude<1e-12);
 const compressed=hydrogenBondDirectionalForces({...geometry,acceptorPosition:{x:1.4,y:0,z:0}});assert.ok(compressed.onDonor.x<0,'close-range wall resists H···A collapse');
 const identity={donorInstanceId:'w1',donorAtom:0,donorHydrogenAtom:1,acceptorInstanceId:'w2',acceptorAtom:0};assert.deepEqual(hydrogenBondVisualEndpoints(identity),{from:{instanceId:'w1',atom:1},to:{instanceId:'w2',atom:0}});
});
test('global assignment prefers directional geometry over a nearer sideways candidate and ignores input order',()=>{
 const candidates=[{key:'sideways',donorInstanceId:'A',donorAtom:0,donorHydrogenAtom:1,acceptorInstanceId:'B',acceptorAtom:0,acceptorCapacity:2,distance:2,angle:142,acceptorOpenness:.2},{key:'linear',donorInstanceId:'A',donorAtom:0,donorHydrogenAtom:1,acceptorInstanceId:'C',acceptorAtom:0,acceptorCapacity:2,distance:2.25,angle:178,acceptorOpenness:1}];
 const one=createHydrogenBondTracker(),two=createHydrogenBondTracker();one.updateAll(candidates,0);two.updateAll([...candidates].reverse(),0);assert.equal(one.values()[0].key,'linear');assert.equal(two.values()[0].key,'linear');assert.ok(scoreHydrogenBondCandidate(candidates[1])>scoreHydrogenBondCandidate(candidates[0]));
});
test('hard break releases occupancy, permits a different rebinding partner, and challenger replaces after dwell',()=>{
 const tracker=createHydrogenBondTracker(),base={donorInstanceId:'A',donorAtom:0,donorHydrogenAtom:1,acceptorAtom:0,acceptorCapacity:2,angle:170,distance:2.1},ab={...base,key:'A-B',acceptorInstanceId:'B'};
 tracker.updateAll([ab],0);assert.equal(tracker.values()[0].equilibriumDistance,1.95);tracker.updateAll([{...ab,distance:4.2}],50);assert.equal(tracker.values().length,0);
 const ac={...base,key:'A-C',acceptorInstanceId:'C'};tracker.updateAll([ac],80);assert.equal(tracker.values()[0].key,'A-C','old partner cooldown cannot block the new partner');
 const replace=createHydrogenBondTracker(),incumbent={key:'A-B',...base,acceptorInstanceId:'B',distance:2.45,angle:160},degraded={...incumbent,angle:125},challenger={key:'A-C',...base,acceptorInstanceId:'C',distance:1.95,angle:178};replace.updateAll([incumbent],0);replace.updateAll([degraded,challenger],100);assert.equal(replace.values()[0].key,'A-B');replace.updateAll([degraded,challenger],300);assert.equal(replace.values()[0].key,'A-B');replace.updateAll([degraded,challenger],440);assert.equal(replace.values()[0].key,'A-C');
});
test('challenger dwell is continuous and replacement clears every occupancy conflict',()=>{
 const tracker=createHydrogenBondTracker({replacementDwellMs:100,replacementAdvantage:.1}),candidate=(key,donor,hydrogen,acceptor,atom,distance,angle,capacity=2)=>({key,donorInstanceId:donor,donorAtom:0,donorHydrogenAtom:hydrogen,acceptorInstanceId:acceptor,acceptorAtom:atom,acceptorCapacity:capacity,distance,angle});
 const first=candidate('old-donor','A',1,'X',0,2.8,150),second=candidate('old-acceptor','B',2,'W',1,2.8,150,1),challenger=candidate('new','A',1,'W',1,1.95,180,1);
 tracker.updateAll([first,second],0);assert.equal(tracker.values().length,2);
 tracker.updateAll([first,second,challenger],10);assert.equal(tracker.values().length,2);
 tracker.updateAll([first,second,{...challenger,distance:3.3,angle:140}],70);assert.equal(tracker.values().length,2);
 tracker.updateAll([first,second,challenger],90);assert.equal(tracker.values().length,2,'advantage must remain continuous for the full dwell');
 tracker.updateAll([first,second,challenger],191);assert.deepEqual(tracker.values().map(bond=>bond.key),['new'],'replacement releases donor and acceptor conflicts together');
});
test('acceptor occupancy is site-aware while donor and molecule-pair limits remain enforced',()=>{
 const candidate=(key,donor,hydrogen,acceptor,capacity,approach={x:1,y:0,z:0})=>({key,donorInstanceId:donor,donorAtom:0,donorHydrogenAtom:hydrogen,acceptorInstanceId:acceptor,acceptorAtom:0,acceptorCapacity:capacity,acceptorApproachDirection:approach,distance:2.1,angle:175});
 const water=createHydrogenBondTracker();water.updateAll([candidate('d1','A',1,'W',2)],0);water.updateAll([candidate('d1','A',1,'W',2),candidate('d2','B',1,'W',2,{x:0,y:1,z:0})],20);assert.equal(water.values().length,2);
 const crowded=createHydrogenBondTracker();crowded.updateAll([candidate('d1','A',1,'W',2)],0);crowded.updateAll([candidate('d1','A',1,'W',2),candidate('d2','B',1,'W',2)],20);assert.equal(crowded.values().length,1,'two donors cannot occupy the same approach sector');
 const donorSite=createHydrogenBondTracker();donorSite.updateAll([candidate('d1','A',1,'W',2)],0);donorSite.updateAll([candidate('d1','A',1,'W',2),candidate('d1-alt','A',1,'C',2,{x:0,y:1,z:0})],20);assert.equal(donorSite.values().length,1,'one donor hydrogen cannot bind two sites');
 const amine=createHydrogenBondTracker();amine.updateAll([candidate('d1','A',1,'N',1)],0);amine.updateAll([candidate('d1','A',1,'N',1),candidate('d2','B',1,'N',1)],20);assert.equal(amine.values().length,1);
 const pair=createHydrogenBondTracker();pair.updateAll([candidate('d1','A',1,'B',2),candidate('d2','B',1,'A',2)],0);assert.equal(pair.values().length,1);
});
test('hydrogen-bond occupancy permits one donor-H and one bond per molecule pair',()=>{
 const tracker=createHydrogenBondTracker(),metrics={distance:2.5,alignment:.9},identity=(donorHydrogenAtom,acceptorAtom=0)=>({donorInstanceId:'water-A',donorAtom:0,donorHydrogenAtom,acceptorInstanceId:'water-B',acceptorAtom});
 assert.equal(tracker.update('h1-a',identity(1),metrics,10).formed,true);assert.equal(tracker.update('h1-b',identity(1,2),metrics,11).blocked,'donor-occupied');assert.equal(tracker.update('h2-a',identity(2,2),metrics,12).blocked,'pair-capacity');assert.equal(tracker.values().length,1);
 const capacity=createHydrogenBondTracker(),make=(donor,acceptor)=>({donorInstanceId:donor,donorAtom:0,donorHydrogenAtom:1,acceptorInstanceId:'shared-acceptor',acceptorAtom:0});assert.equal(capacity.update('first',make('donor-1'),metrics,10).formed,true);assert.equal(capacity.update('second',make('donor-2'),metrics,11).blocked,'acceptor-capacity');
});
test('stoichiometric supply requires every species to be selected in slots',()=>{assert.equal(planStoichiometricSupply(['water','water'],['water','','']).ok,true);assert.equal(planStoichiometricSupply(['water','ethanol'],['water','','']).reason,'required-species-not-in-slots');});
test('registered reactions consume a pair and return the correct database product instance count',()=>{
 const candidate=reactionCandidates([{species:'water',id:'w-1'},{species:'acetic-anhydride',id:'an-1'}],records).find(item=>item.ruleId==='anhydride-hydrolysis');assert.deepEqual(candidate.reactantInstanceIds,['an-1','w-1']);const plan=planReactionExecution(candidate,records,['acetic-anhydride','water','']);assert.equal(plan.ok,true);assert.deepEqual(plan.consumedInstanceIds,['an-1','w-1']);assert.deepEqual(plan.products.map(item=>item.id),['acetic-acid','acetic-acid']);assert.equal(plan.productInstanceCount,2);assert.ok(plan.graphTransition.brokenBonds.length>0);assert.ok(plan.graphTransition.formedBonds.length>0);
});
test('alcoholysis atom-map transforms into the two distinct registered product graphs',()=>{const candidate=reactionCandidates([{species:'ethanol',id:'e1'},{species:'acetic-anhydride',id:'a1'}],records).find(item=>item.rule.id==='anhydride-alcoholysis');const plan=planReactionExecution(candidate,records,['ethanol','acetic-anhydride','']);assert.equal(plan.ok,true);assert.deepEqual(plan.products.map(item=>item.id),['ethyl-acetate','acetic-acid']);assert.ok(plan.graphTransition.brokenBonds.length>0);assert.ok(plan.graphTransition.formedBonds.length>0);});
test('stoichiometric supply uses a selected species slot and rejects an absent one',()=>{
 const rule={id:'two-water',activation:'contact',reactants:[{species:'water'},{species:'water'}],products:['water','water'],atomMaps:[[0,1,2],[3,4,5]]},candidate={ruleId:'two-water',rule,reactantInstanceIds:['w1'],speciesIds:['water'],siteAtomIndices:[0,0]};assert.equal(planReactionExecution(candidate,records,['','',''],[rule]).reason,'required-species-not-in-slots');const plan=planReactionExecution(candidate,records,['water','',''],[rule]);assert.equal(plan.ok,true);assert.deepEqual(plan.temporarySupply,['water']);
});
test('reaction products resolve only to database records and product graph matching is structural',()=>{
 const products=resolveRegisteredProducts(['acetic-acid','acetic-acid'],records);assert.equal(products.products.length,2);assert.equal(resolveRegisteredProducts(['db-external'],records).ok,false);
 const water=byId.get('water'),graph={atoms:water.atoms.map((element,id)=>({id,element})),bonds:water.bonds.map(([a,b,order])=>({a,b,order}))};assert.equal(matchDatabaseProduct(graph,records)?.id,'water');
});
