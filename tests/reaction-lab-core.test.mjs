import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSpeciesSlots, planVisiblePopulation, deriveInteractionSites, deriveInteractionModel, deriveInteractionCharges, classifyHydrogenBondSites, hydrogenBondEligibility, createHydrogenBondTracker, hydrogenBondVisualEndpoints, coulombPairForce, coulombPairForces, hydrogenBondSpringForces, torqueFromForce, chargeInteractionSign, reactionCandidates, resolveCandidateInstanceIds, createContactMatcher, planStoichiometricSupply, planReactionExecution, resolveRegisteredProducts, matchDatabaseProduct } from '../src/reaction-lab-core.js';
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
 const donor={kind:'donor'},acceptor={kind:'acceptor'};assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.7}),true);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.1}),false);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:4,alignment:1}),false);
});
test('formal charge interaction sign distinguishes attraction and repulsion',()=>{assert.equal(chargeInteractionSign(1,-1),-1);assert.equal(chargeInteractionSign(1,1),1);assert.equal(chargeInteractionSign(0,-1),0);});
test('softened atom force has opposite-charge attraction, same-charge repulsion, and a finite cap',()=>{
 const toward=coulombPairForce(.3,-.3,{x:1,y:0,z:0}),away=coulombPairForce(.3,.3,{x:1,y:0,z:0}),capped=coulombPairForce(.65,.65,{x:.001,y:0,z:0});
 assert.ok(toward.x>0);assert.ok(away.x<0);assert.ok(Math.abs(capped.x)<=.035);assert.deepEqual(coulombPairForce(.2,.2,{x:5,y:0,z:0}),{x:0,y:0,z:0,magnitude:0});
 const pair=coulombPairForces(.3,-.3,{x:1,y:0,z:0});assert.equal(pair.onA.x+pair.onB.x,0);assert.equal(pair.onA.y+pair.onB.y,0);
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
test('hydrogen bond state forms, persists through hysteresis, and breaks by stretch, speed, or misalignment',()=>{
 const tracker=createHydrogenBondTracker(),identity={donorInstanceId:'w1',donorAtom:0,donorHydrogenAtom:1,acceptorInstanceId:'w2',acceptorAtom:0};
 assert.equal(tracker.update('hbond',identity,{distance:3,alignment:.8},0).formed,true);
 assert.ok(tracker.update('hbond',identity,{distance:3.7,alignment:.3},100).bond,'bond persists between formation and break thresholds');
 assert.equal(tracker.update('hbond',identity,{distance:4.2,alignment:.8},200).broken,true);
 assert.equal(tracker.update('hbond',identity,{distance:2.4,alignment:.8},300).formed,false,'A broken bond does not reform during its short cooldown');
 tracker.update('hbond',identity,{distance:2.4,alignment:.8},500);assert.equal(tracker.update('hbond',identity,{distance:2.5,alignment:.8,relativeSpeed:.2},600).broken,true);
 tracker.update('hbond',identity,{distance:2.4,alignment:.8},900);assert.equal(tracker.update('hbond',identity,{distance:2.4,alignment:.05},1000).broken,true);
 tracker.update('hbond',identity,{distance:2.4,alignment:.8},1300);assert.equal(tracker.update('hbond',identity,{distance:2.5,alignment:.8,tensileLoad:.2},1400).broken,true);
 assert.deepEqual(hydrogenBondVisualEndpoints(identity),{from:{instanceId:'w1',atom:1},to:{instanceId:'w2',atom:0}});
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
