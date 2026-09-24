import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeSpeciesSlots, planVisiblePopulation, deriveInteractionSites, hydrogenBondEligibility, chargeInteractionSign, reactionCandidates, createContactMatcher, planStoichiometricSupply, planReactionExecution, resolveRegisteredProducts, matchDatabaseProduct } from '../src/reaction-lab-core.js';
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(r=>[r.id,r]));

test('three equal slots allow zero to three discovered species and reject duplicates',()=>{
 assert.deepEqual(normalizeSpeciesSlots([],records).slots,['','','']);assert.equal(normalizeSpeciesSlots(['water','ethanol',''],records).ok,true);assert.equal(normalizeSpeciesSlots(['water','water',''],records).reason,'duplicate-species');assert.equal(normalizeSpeciesSlots(['missing','',''],records).reason,'unknown-species');
});
test('representative population is four for one species and two per species for two or three',()=>{
 assert.equal(planVisiblePopulation(['water','','']).length,4);assert.equal(planVisiblePopulation(['water','ethanol','']).length,4);assert.equal(planVisiblePopulation(['water','ethanol','acetic-acid']).length,6);assert.equal(planVisiblePopulation(['','','']).length,0);
});
test('database derives donor, acceptor, and polar sites for water',()=>{
 const sites=deriveInteractionSites(byId.get('water'));assert.equal(sites.filter(s=>s.kind==='donor').length,1);assert.ok(sites.some(s=>s.kind==='acceptor'));assert.ok(sites.some(s=>s.kind==='partial-charge'&&s.charge<0));assert.ok(sites.some(s=>s.kind==='partial-charge'&&s.charge>0));
});
test('hydrogen bonding requires donor, acceptor, plausible distance, and rough alignment',()=>{
 const donor={kind:'donor'},acceptor={kind:'acceptor'};assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.7}),true);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:2.4,alignment:.1}),false);assert.equal(hydrogenBondEligibility(donor,acceptor,{distance:4,alignment:1}),false);
});
test('formal charge interaction sign distinguishes attraction and repulsion',()=>{assert.equal(chargeInteractionSign(1,-1),-1);assert.equal(chargeInteractionSign(1,1),1);assert.equal(chargeInteractionSign(0,-1),0);});
test('only site-matched pairwise contact rules are eligible; activated rules stay dormant',()=>{
 const pair=[{species:'acetic-anhydride',id:'an-1'},{species:'water',id:'w-1'}];assert.ok(reactionCandidates(pair,records).some(c=>c.rule.id==='anhydride-hydrolysis'));assert.ok(reactionCandidates([{species:'acetic-anhydride',id:'an-2'},{species:'ethanol',id:'e-1'}],records).some(c=>c.rule.id==='anhydride-alcoholysis'));
 assert.deepEqual(reactionCandidates(pair,records,[{...{id:'future',activation:'activated'},reactants:[{species:'acetic-anhydride',site:'anhydride-carbonyl-carbon'},{species:'water',site:'water-oxygen'}]}]),[]);
 assert.deepEqual(reactionCandidates([{species:'oxygen',id:'o2'},{species:'ethanol',id:'e'}],records),[]);assert.deepEqual(reactionCandidates([{species:'hydrogen',id:'h2'},{species:'acetic-acid',id:'acid'}],records),[]);
});
test('contact matcher debounces brief threshold crossings',()=>{const matcher=createContactMatcher({dwellMs:500});assert.equal(matcher.update('pair',true,10),false);assert.equal(matcher.update('pair',false,300),false);assert.equal(matcher.update('pair',true,400),false);assert.equal(matcher.update('pair',true,900),true);});
test('stoichiometric supply requires every species to be selected in slots',()=>{assert.equal(planStoichiometricSupply(['water','water'],['water','','']).ok,true);assert.equal(planStoichiometricSupply(['water','ethanol'],['water','','']).reason,'required-species-not-in-slots');});
test('registered reactions consume a pair and return the correct database product instance count',()=>{
 const candidate=reactionCandidates([{species:'water',id:'w-1'},{species:'acetic-anhydride',id:'an-1'}],records).find(item=>item.rule.id==='anhydride-hydrolysis');assert.equal(candidate.reactantInstances[0].species,'acetic-anhydride');const plan=planReactionExecution(candidate,records,['acetic-anhydride','water','']);assert.equal(plan.ok,true);assert.deepEqual(plan.consumedInstanceIds,['an-1','w-1']);assert.deepEqual(plan.products.map(item=>item.id),['acetic-acid','acetic-acid']);assert.equal(plan.productInstanceCount,2);assert.ok(plan.graphTransition.brokenBonds.length>0);assert.ok(plan.graphTransition.formedBonds.length>0);
});
test('alcoholysis atom-map transforms into the two distinct registered product graphs',()=>{const candidate=reactionCandidates([{species:'ethanol',id:'e1'},{species:'acetic-anhydride',id:'a1'}],records).find(item=>item.rule.id==='anhydride-alcoholysis');const plan=planReactionExecution(candidate,records,['ethanol','acetic-anhydride','']);assert.equal(plan.ok,true);assert.deepEqual(plan.products.map(item=>item.id),['ethyl-acetate','acetic-acid']);assert.ok(plan.graphTransition.brokenBonds.length>0);assert.ok(plan.graphTransition.formedBonds.length>0);});
test('stoichiometric supply uses a selected species slot and rejects an absent one',()=>{
 const rule={id:'two-water',activation:'contact',reactants:[{species:'water'},{species:'water'}],products:['water','water'],atomMaps:[[0,1,2],[3,4,5]]},candidate={rule,reactantInstances:[{species:'water',id:'w1'}]};assert.equal(planReactionExecution(candidate,records,['','',''],[rule]).reason,'required-species-not-in-slots');const plan=planReactionExecution(candidate,records,['water','',''],[rule]);assert.equal(plan.ok,true);assert.deepEqual(plan.temporarySupply,['water']);
});
test('reaction products resolve only to database records and product graph matching is structural',()=>{
 const products=resolveRegisteredProducts(['acetic-acid','acetic-acid'],records);assert.equal(products.products.length,2);assert.equal(resolveRegisteredProducts(['db-external'],records).ok,false);
 const water=byId.get('water'),graph={atoms:water.atoms.map((element,id)=>({id,element})),bonds:water.bonds.map(([a,b,order])=>({a,b,order}))};assert.equal(matchDatabaseProduct(graph,records)?.id,'water');
});
