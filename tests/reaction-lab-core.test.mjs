import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  normalizeSpeciesSlots, planVisiblePopulation, compileReactionCatalog,
  reactionCandidates, resolveCandidateInstanceIds, createContactMatcher,
  planReactionExecution, resolveRegisteredProducts, matchDatabaseProduct,
  scoreReactionGeometry, arbitrateReactionCandidates, resolveSupplementalParticipants,
  REACTION_SITE_PATTERNS, REACTION_FAMILIES, REACTION_CATALOG, CONTACT_DWELL_MS,
  matchReactionSitePattern, environmentMatches, environmentsOverlap,
} from '../src/reaction-lab-core.js';
import { canonicalNonbondedPairGeometry } from '../src/reaction-lab-stage-a.js';
import { createReactionLabEnvironment, createDefaultReactionLabEnvironmentState, enumerateCanonicalReactionLabEnvironments, environmentTokensFromSnapshot, reactionLabEnvironmentStateFromTokens, validateNormalizedEnvironmentTokens, validateReactionLabEnvironmentState } from '../src/reaction-lab-environment.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const production=compileReactionCatalog(records);

test('production viewer delegates eligibility and arbitration to compiled Core without force exclusion',async()=>{
  const viewer=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
  assert.doesNotMatch(viewer,/reactionContactPairs|excludedMoleculePairs|REACTION_RULES|maxDistance\s*:\s*1\.18/);
  assert.match(viewer,/arbitrateReactionCandidates\(ready\)/);
  assert.match(viewer,/normalPhysicsStepObserved:stageBPhysicsEnabled&&!manipulating/);
  const probeSetter=viewer.match(/setEnvironmentConditions\(tokens\)\{([\s\S]*?)\},\n\s*setStageAPair/)?.[1]??'';
  assert.match(probeSetter,/activationEnvironment\.setFromConditionTokens\(tokens\)/,'The localhost probe uses the production Environment authority');
  assert.doesNotMatch(probeSetter,/contactMatcher\.reset\(\)/,'Condition writes preserve unrelated fixed-step dwell continuity');
});

test('three equal slots allow zero to three known species and reject duplicates',()=>{
  assert.deepEqual(normalizeSpeciesSlots([],records).slots,['','','']);
  assert.equal(normalizeSpeciesSlots(['water','ethanol',''],records).ok,true);
  assert.equal(normalizeSpeciesSlots(['water','water',''],records).reason,'duplicate-species');
  assert.equal(normalizeSpeciesSlots(['missing','',''],records).reason,'unknown-species');
  assert.equal(planVisiblePopulation(['water','','']).length,4);
  assert.equal(planVisiblePopulation(['water','ethanol','']).length,4);
  assert.equal(planVisiblePopulation(['water','ethanol','acetic-acid']).length,6);
});

test('production catalog compiles exhaustive labelled pathways for the two existing anhydride reactions',()=>{
  const hydrolysis=reactionCandidates([{species:'water',id:'w1'},{species:'acetic-anhydride',id:'a1'}],production);
  const alcoholysis=reactionCandidates([{species:'ethanol',id:'e1'},{species:'acetic-anhydride',id:'a1'}],production);
  assert.equal(hydrolysis.length,4,'both anhydride carbonyls and both explicit water H atoms remain distinct pathways');
  assert.equal(alcoholysis.length,2,'both anhydride carbonyls remain distinct pathways');
  assert.ok(hydrolysis.every(item=>item.bindings.primary.center>=0&&item.bindings.transferPair.transfer>=0));
  assert.ok(new Set(hydrolysis.map(item=>item.symmetryClassId)).size===1);
  assert.ok(new Set(alcoholysis.map(item=>item.symmetryClassId)).size===1);
  const reversed=reactionCandidates([{species:'acetic-anhydride',id:'a1'},{species:'water',id:'w1'}],production);
  assert.deepEqual(reversed.map(item=>item.pathwayId),hydrolysis.map(item=>item.pathwayId));
  assert.deepEqual(resolveCandidateInstanceIds(hydrolysis[0],['a1','w1']),hydrolysis[0].reactantInstanceIds);
  assert.equal(resolveCandidateInstanceIds(hydrolysis[0],['a1']),null);
  assert.deepEqual(reactionCandidates([{species:'oxygen',id:'o2'},{species:'ethanol',id:'e1'}],production),[]);
  assert.deepEqual(reactionCandidates([{species:'hydrogen',id:'h2'},{species:'acetic-acid',id:'acid'}],production),[]);
});

test('declared edits use the matched acyl binding and auto-map every source atom to strict DB products',()=>{
  const candidate=reactionCandidates([{species:'acetic-anhydride',id:'a1'},{species:'water',id:'w1'}],production).find(item=>item.bindings.primary.center===3&&item.bindings.transferPair.transfer===1);
  const plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);
  assert.equal(plan.reactionId,'complete-01-anhydride-hydrolysis');
  assert.equal(plan.familyId,'sigma-cross-exchange');
  assert.equal(plan.pathwayId,candidate.pathwayId);
  assert.deepEqual(plan.products.map(record=>record.id),['acetic-acid','acetic-acid']);
  assert.ok(plan.graphDiff.brokenBonds.length>0&&plan.graphDiff.formedBonds.length>0);
  assert.ok(plan.graphDiff.formedBonds.some(bond=>bond.a==='primary:3'&&bond.b==='transferPair:0'));
  assert.equal(plan.graphDiff.bondOrderChanges.length,0);
  assert.equal(plan.atomOrigins.reduce((sum,product)=>sum+product.origins.length,0),16);
  assert.equal(new Set(plan.atomOrigins.flatMap(product=>product.origins.map(origin=>origin.sourceAtom))).size,16);
  assert.equal('atomMaps' in candidate.reaction,false);
  assert.equal('temporarySupply' in plan,false);
  const brokenGuard={...REACTION_FAMILIES[0],edits:REACTION_FAMILIES[0].edits.map((edit,index)=>index===0?{...edit,from:2}:edit)};
  assert.throws(()=>compileReactionCatalog(records,{families:[brokenGuard],reactions:[REACTION_CATALOG[0]]}),/source-state-guard-failed/,'catalog compilation verifies each declared source-state guard');
  const ethanol=reactionCandidates([{species:'ethanol',id:'e1'},{species:'acetic-anhydride',id:'a1'}],production)[0];
  const alcoholysis=planReactionExecution(ethanol,records);
  assert.deepEqual(alcoholysis.products.map(record=>record.id),['ethyl-acetate','acetic-acid']);
  assert.ok(alcoholysis.participants.every(item=>item.instanceId));
  assert.ok(alcoholysis.matchedSites.transferPair.atomBindings.transfer>=0);
});

test('reaction execution freezes one canonical environment snapshot with normalized active conditions',()=>{
  const candidate=reactionCandidates([{species:'acetic-anhydride',id:'a1'},{species:'water',id:'w1'}],production)[0],state=Object.freeze({light:true,heat:true,medium:'acidic'});
  const plan=planReactionExecution({...candidate,environmentConditions:['light','heat','acidic'],environmentSnapshot:state},records);
  assert.equal(plan.ok,true);assert.deepEqual(plan.environmentSnapshot,state);assert.equal(Object.isFrozen(plan.environmentSnapshot),true);
  assert.deepEqual(plan.environmentConditions,{active:['acidic','heat','light'],requires:[],forbids:['basic']});
  assert.throws(()=>{plan.environmentSnapshot.medium='basic';},TypeError);
  const defaultPlan=planReactionExecution(candidate,records);assert.deepEqual(defaultPlan.environmentSnapshot,{light:false,heat:false,medium:'neutral'});assert.deepEqual(defaultPlan.environmentConditions.active,[]);
});

test('acyl transfer distance windows derive from canonical pair sigma and score target better than deep overlap',()=>{
  const candidate=reactionCandidates([{species:'acetic-anhydride',id:'a'},{species:'water',id:'w'}],production)[0];
  const constraint=candidate.geometryConstraints[0],anhydride=byId.get('acetic-anhydride'),water=byId.get('water');
  const reference=canonicalNonbondedPairGeometry({sigmaAngstrom:anhydride.nonbonded.sigmaAngstrom[constraint.from.atomIndex],epsilonKcalMol:anhydride.nonbonded.epsilonKcalMol[constraint.from.atomIndex]},{sigmaAngstrom:water.nonbonded.sigmaAngstrom[constraint.to.atomIndex],epsilonKcalMol:water.nonbonded.epsilonKcalMol[constraint.to.atomIndex]},0);
  assert.ok(Math.abs(constraint.min-constraint.minRatio*reference.sigmaPairAngstrom)<1e-12);
  assert.ok(Math.abs(constraint.target-constraint.targetRatio*reference.sigmaPairAngstrom)<1e-12);
  assert.ok(constraint.min>reference.softCoreBoundaryAngstrom);
  const positions={primary:[0,0,0],transferPair:[constraint.target,0,0]};
  const atTarget=scoreReactionGeometry(candidate.geometryConstraints,(role)=>positions[role]);
  const insideButOffTarget=scoreReactionGeometry(candidate.geometryConstraints,(role)=>role==='primary'?[0,0,0]:[constraint.max-.01,0,0]);
  const pushedDeep=scoreReactionGeometry(candidate.geometryConstraints,(role)=>role==='primary'?[0,0,0]:[constraint.min-.4,0,0]);
  assert.equal(atTarget.geometryReady,true);assert.equal(atTarget.worstNormalizedDeviation,0);
  assert.equal(insideButOffTarget.geometryReady,true);
  assert.ok(insideButOffTarget.worstNormalizedDeviation>atTarget.worstNormalizedDeviation);
  assert.equal(pushedDeep.geometryReady,false);
  assert.ok(pushedDeep.worstNormalizedDeviation>insideButOffTarget.worstNormalizedDeviation);
  assert.equal(canonicalNonbondedPairGeometry({sigmaAngstrom:3.4,epsilonKcalMol:0},{sigmaAngstrom:3.1,epsilonKcalMol:0},1).severeOverlap,true,'zero epsilon does not hide deep geometric overlap');
});

test('dwell uses current CONTACT_DWELL_MS and resets only when candidate eligibility or identity is lost',()=>{
  const matcher=createContactMatcher(),stepMs=CONTACT_DWELL_MS/2,lightRequired={requires:['light'],forbids:[]};
  assert.equal(matcher.update('light-candidate',environmentMatches(lightRequired,[]),stepMs),false);assert.equal(matcher.elapsed('light-candidate'),0,'A condition mismatch cannot start dwell');
  assert.equal(matcher.update('light-candidate',environmentMatches(lightRequired,['light']),stepMs),false);assert.equal(matcher.elapsed('light-candidate'),0,'The first eligible fixed step starts continuity at zero');
  assert.equal(matcher.update('light-candidate',environmentMatches(lightRequired,['light']),stepMs),false);assert.equal(matcher.elapsed('light-candidate'),stepMs);
  assert.equal(matcher.update('light-candidate',environmentMatches(lightRequired,['light','heat','basic']),stepMs),true,'Unrelated active HEAT and basic medium preserve LIGHT dwell');
  assert.equal(matcher.elapsed('light-candidate'),CONTACT_DWELL_MS);
  matcher.update('light-candidate',environmentMatches(lightRequired,['heat']),stepMs);assert.equal(matcher.elapsed('light-candidate'),0,'Losing a required condition invalidates elapsed dwell');
  assert.equal(matcher.update('light-candidate',environmentMatches(lightRequired,['light']),stepMs),false);assert.equal(matcher.elapsed('light-candidate'),0,'A restored condition begins new continuity');
  matcher.update('light-candidate',true,stepMs);assert.equal(matcher.elapsed('light-candidate'),stepMs);
  matcher.update('light-candidate',false,stepMs);assert.equal(matcher.elapsed('light-candidate'),0,'Geometry loss, overlap veto, or manipulation clears continuity');
  matcher.update('light-candidate:other-participant-set',true,stepMs);assert.equal(matcher.elapsed('light-candidate:other-participant-set'),0,'A changed participant set starts an independent continuity');
  assert.equal(matcher.update('light-candidate:other-participant-set',true,stepMs),false);assert.equal(matcher.elapsed('light-candidate:other-participant-set'),stepMs);
});

test('Core environment vocabulary, satisfiability, and subset matching follow the canonical twelve-state domain',()=>{
  const ordinary={requires:[],forbids:[]},heat={requires:['heat'],forbids:[]},light={requires:['light'],forbids:[]},acidic={requires:['acidic'],forbids:[]},basic={requires:['basic'],forbids:[]},heatAcid={requires:['heat','acidic'],forbids:[]},noLight={requires:[],forbids:['light']};
  const compileWith=(requires,forbids=[])=>compileReactionCatalog(records,{reactions:[{...REACTION_CATALOG[0],requires,forbids}]});
  assert.equal(enumerateCanonicalReactionLabEnvironments().length,12);
  for(const condition of [['light'],['heat'],['acidic'],['basic'],['heat','acidic']])assert.ok(compileWith(condition).pathways.length,`valid requirement ${condition.join('+')} compiles`);
  assert.ok(compileWith([],['light']).pathways.length);
  assert.equal(environmentMatches(ordinary,[]),true);assert.equal(environmentMatches(heat,['heat']),true);assert.equal(environmentMatches(light,['light','heat','acidic']),true,'Extra active conditions do not invalidate a matching rule');
  assert.equal(environmentMatches(light,['light','heat','basic']),true);assert.equal(environmentMatches(noLight,['light']),false);
  assert.throws(()=>compileWith(['uv']),/invalid-environment-condition/,'Unknown catalog tokens fail compilation');
  assert.throws(()=>compileWith(['light','light']),/invalid-environment-condition/,'Duplicate required tokens fail compilation');
  assert.throws(()=>compileWith(['light'],['light']),/invalid-environment-condition/,'A token cannot be both required and forbidden');
  assert.throws(()=>compileWith(['acidic','basic']),/invalid-environment-condition/,'Mutually exclusive pH media cannot both be required');
  assert.throws(()=>compileWith(['neutral']),/invalid-environment-condition/,'Neutral is not an environment token');
  assert.throws(()=>compileWith(['acidic'],['acidic']),/invalid-environment-condition|unsatisfiable-environment-condition/);
  assert.ok(compileWith([],['acidic','basic']).pathways.length,'Forbidding both pH conditions defines neutral-only eligibility');
  assert.throws(()=>environmentMatches(light,['light','acidic','basic']),/mutually-exclusive-ph/);
  assert.throws(()=>environmentMatches(light,['ultraviolet']),/unknown-environment-token/);
  assert.equal(environmentsOverlap(ordinary,heat),true);
  assert.equal(environmentsOverlap(heat,{requires:[],forbids:['heat']}),false);
  assert.equal(environmentsOverlap(acidic,basic),false);
  assert.equal(environmentsOverlap({requires:[],forbids:['acidic','basic']},acidic),false);
  assert.equal(environmentsOverlap(acidic,ordinary),true);
  assert.equal(environmentsOverlap(heatAcid,{requires:['heat','basic'],forbids:[]}),false);
  assert.equal(REACTION_CATALOG.length,29,'All ⑦A concrete rules are registered in production');
  assert.equal(REACTION_CATALOG[0].id,'complete-01-anhydride-hydrolysis');
  assert.equal(REACTION_CATALOG[1].id,'complete-02-anhydride-alcoholysis');
});

test('catalog, pattern and site enumeration order do not change stable pathway identities',()=>{
  const reordered=compileReactionCatalog(records,{patterns:[...REACTION_SITE_PATTERNS].reverse(),families:[...REACTION_FAMILIES].reverse(),reactions:[...REACTION_CATALOG].reverse()});
  assert.deepEqual(reordered.pathways.map(item=>item.pathwayId).sort(),production.pathways.map(item=>item.pathwayId).sort());
  const first=reactionCandidates([{species:'water',id:'w'},{species:'acetic-anhydride',id:'a'}],production).map(item=>item.pathwayId);
  const second=reactionCandidates([{species:'water',id:'w'},{species:'acetic-anhydride',id:'a'}],reordered).reverse().map(item=>item.pathwayId).sort();
  assert.deepEqual([...first].sort(),second);
});

test('runtime arbitration waits inside the interaction deadband and uses stable pathway tie-breaks',()=>{
  const candidate=(reactionId,pathwayId,worst,mean,formed)=>({reactionId,pathwayId,symmetryClassId:'sym',geometryQuality:{worstNormalizedDeviation:worst,meanNormalizedDeviation:mean},newBondEndpointDistanceSum:formed});
  const a=candidate('a','a-path',.2,.3,2),b=candidate('b','b-path',.205,.305,1);
  assert.equal(arbitrateReactionCandidates([a,b]).reason,'geometry-deadband');
  assert.equal(arbitrateReactionCandidates([b,a]).reason,'geometry-deadband');
  const hiddenTie=candidate('c','c-near',.12,.13,2),meanRunner=candidate('b','b-mean-runner',.1,.14,1);
  assert.equal(arbitrateReactionCandidates([a,meanRunner,hiddenTie]).reason,'geometry-deadband','a later distinct outcome inside the deadband cannot be hidden by another contender');
  assert.equal(arbitrateReactionCandidates([hiddenTie,meanRunner,a]).reason,'geometry-deadband');
  assert.equal(arbitrateReactionCandidates([candidate('a','z',.2,.3,2),candidate('a','a',.2,.3,1)]).selected.pathwayId,'a');
  assert.equal(arbitrateReactionCandidates([candidate('a','worse',.4,.4,0),candidate('a','geometry-best',.2,.3,2)]).selected.pathwayId,'geometry-best','formation-distance tie-break cannot override a clearly better geometry fit');
  const samePath=(left,right)=>({...candidate('a','same-path',.2,.3,1),participantInstances:{left,right}});
  assert.deepEqual(arbitrateReactionCandidates([samePath('z-instance','a-instance'),samePath('a-instance','z-instance')]).selected.participantInstances,{left:'a-instance',right:'z-instance'});
});

test('supplemental stoichiometry resolves only real free instances by distance then stable ID',()=>{
  const reaction={reactants:[{role:'a1',species:'A',participation:'encounter'},{role:'a2',species:'A',participation:'encounter'},{role:'b',species:'B',participation:'supplemental'}]};
  const candidate={participantInstances:{a1:'a-one',a2:'a-two'}};
  const instances=[{id:'z-near',species:'B',busy:false},{id:'a-near',species:'B',busy:false},{id:'busy',species:'B',busy:true},{id:'wrong',species:'C',busy:false}];
  const resolve=rows=>resolveSupplementalParticipants(reaction,candidate,rows,item=>item.id.endsWith('near')?2:1);
  assert.equal(resolve(instances).participantInstances.b,'a-near');
  assert.equal(resolve([...instances].reverse()).participantInstances.b,'a-near');
  assert.equal(resolve(instances.filter(item=>item.species!=='B'||item.busy)).reason,'missing-stoichiometric-participant');
});

test('strict product match includes formal charge and registered-product resolution rejects unknown IDs',()=>{
  const water=byId.get('water'),graph={atoms:water.atoms.map((element,id)=>({id,element,formalCharge:0})),bonds:water.bonds.map(([a,b,order])=>({a,b,order}))};
  assert.equal(matchDatabaseProduct(graph,records)?.id,'water');
  const charged={...graph,atoms:graph.atoms.map((atom,index)=>index===0?{...atom,formalCharge:1}:atom)};
  assert.equal(matchDatabaseProduct(charged,records),null);
  assert.equal(resolveRegisteredProducts(['acetic-acid','acetic-acid'],records).ok,true);
  assert.equal(resolveRegisteredProducts(['runtime-unknown'],records).reason,'product-not-in-database');
});

test('shared aromatic authority keeps alternating benzene C=C away from an alkene pattern',()=>{
  const benzene={id:'test-benzene',atoms:Array(6).fill('C'),bonds:[[0,1,2],[1,2,1],[2,3,2],[3,4,1],[4,5,2],[5,0,1]]};
  const alkenePattern={id:'alkene-site',atoms:[{label:'left',element:'C',aromatic:false},{label:'right',element:'C',aromatic:false}],bonds:[['left','right',2]]};
  assert.deepEqual(matchReactionSitePattern(benzene,alkenePattern),[]);
  assert.equal(matchReactionSitePattern(byId.get('ethene'),alkenePattern).length,2,'the two labelled carbon orientations are retained');
  assert.throws(()=>matchReactionSitePattern(byId.get('ethene'),{...alkenePattern,atoms:alkenePattern.atoms.map(atom=>({...atom,singleBondsOnly:true}))}),/unsupported-reaction-atom-constraint/,'the Reaction schema does not inherit functional-group-only predicates');
  assert.throws(()=>matchReactionSitePattern(byId.get('ethene'),alkenePattern,{limit:1}),/pattern-match-overflow/,'safety caps fail loudly instead of silently truncating labelled matches');
});
