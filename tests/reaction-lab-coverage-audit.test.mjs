import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formalChargeForRecordAtom, molecularAromaticAtomIds } from '../src/chemistry.js';
import {
  arbitrateReactionCandidates,
  arbitrateReactionCandidateComponents,
  compileReactionCatalog,
  environmentMatches,
  matchReactionSitePattern,
  planReactionExecution,
  reactionCandidates,
  resolveCandidateInstanceIds,
  resolveSupplementalParticipants,
  scoreReactionGeometry,
  REACTION_CATALOG,
  REACTION_FAMILIES,
  REACTION_SITE_PATTERNS,
} from '../src/reaction-lab-core.js';
import { enumerateCanonicalReactionLabEnvironments } from '../src/reaction-lab-environment.js';
import {
  auditSummary,
  canonicalSpeciesMultisetKey,
  compareSymmetryMetrics,
  deterministicAtomPermutation,
  directionalTransformationSignature,
  enumerateUnorderedSpeciesPairs,
  generateStructuralExposureAudit,
  independentEncounterAuthority,
  permuteMoleculeRecord,
  semanticPathwayFingerprint,
  traceAllProductionPathways,
} from './helpers/reaction-lab-coverage-audit.mjs';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const polymers=JSON.parse(await readFile(new URL('../data/polymers.json',import.meta.url),'utf8'));
const admission=JSON.parse(await readFile(new URL('./fixtures/reaction-lab-chemical-candidate-authority.json',import.meta.url),'utf8'));
const resolutions=JSON.parse(await readFile(new URL('./fixtures/reaction-lab-structural-exposure-resolutions.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const compiled=compileReactionCatalog(records);
const structural=generateStructuralExposureAudit(records,{patterns:REACTION_SITE_PATTERNS,families:REACTION_FAMILIES,reactions:REACTION_CATALOG});
const positiveTraces=traceAllProductionPathways(records,compiled,{reactions:REACTION_CATALOG,families:REACTION_FAMILIES});
const environments=enumerateCanonicalReactionLabEnvironments();
let requiredTokenRemovalMutations=0,forbiddenTokenAdditionMutations=0,allowedExtraConditionMutations=0,exhaustiveEligibleCases=0;

function sorted(values){return[...values].sort((a,b)=>String(a).localeCompare(String(b)));}
function bindingKey(binding){return JSON.stringify(Object.entries(binding).sort(([a],[b])=>a.localeCompare(b)));}
function productionSpecies(){return new Set(REACTION_CATALOG.flatMap(reaction=>[...reaction.reactants.map(row=>row.species),...reaction.products]));}
function cloneGraph(record,{atoms=record.atoms,bonds=record.bonds,formalCharges=record.formalCharges}={}){
  const clone={...record,atoms,bonds};
  if(formalCharges!==undefined)clone.formalCharges=formalCharges;
  else delete clone.formalCharges;
  return clone;
}
function atomId(record,index){return typeof record.atoms[index]==='string'?record.atoms[index]:record.atoms[index].element;}
function canonicalEnvironmentKey(tokens){return sorted(tokens).join('+');}
function assertOriginalBindingAbsent(pattern,record,binding,message){
  const stillMatches=matchReactionSitePattern(record,pattern).some(candidate=>bindingKey(candidate)===bindingKey(binding));
  assert.equal(stillMatches,false,message);
}
function assertSameFingerprintMultiset(actual,expected,message){
  const actualCounts=new Map(),expectedCounts=new Map();for(const value of actual)actualCounts.set(value,(actualCounts.get(value)??0)+1);for(const value of expected)expectedCounts.set(value,(expectedCounts.get(value)??0)+1);
  const missing=[];for(const[value,count]of expectedCounts){const delta=count-(actualCounts.get(value)??0);for(let i=0;i<delta;i++)missing.push(value.slice(0,180));}
  const extra=[];for(const[value,count]of actualCounts){const delta=count-(expectedCounts.get(value)??0);for(let i=0;i<delta;i++)extra.push(value.slice(0,180));}
  assert.deepEqual({actualCount:actual.length,expectedCount:expected.length,missing:missing.slice(0,3),extra:extra.slice(0,3)},{actualCount:expected.length,expectedCount:expected.length,missing:[],extra:[]},message);
}

test('explicit ⑦A chemical candidate authority partitions the current DB without deriving admissions',()=>{
  assert.equal(admission.schemaVersion,1);
  assert.ok(admission.authorityRevision);
  const productionIds=REACTION_CATALOG.map(row=>row.id),playableIds=admission.playableReactions;
  assert.equal(new Set(playableIds).size,playableIds.length,'PLAYABLE IDs are explicit and unique');
  assert.deepEqual(sorted(playableIds),sorted(productionIds),'all 29 PLAYABLE entries match production by exact set equality');
  assert.equal(playableIds.length,29);

  const productionIdsInDb=productionSpecies(),blockedSpecies=admission.blockedSpeciesProbes;
  assert.equal(productionIdsInDb.size,48);
  assert.equal(blockedSpecies.length,94);
  assert.equal(new Set(blockedSpecies).size,blockedSpecies.length,'blocked-only species are explicit and unique');
  assert.deepEqual(blockedSpecies.filter(id=>productionIdsInDb.has(id)),[],'production and blocked-only species cannot overlap');
  assert.deepEqual(blockedSpecies.filter(id=>!byId.has(id)),[],'stale blocked species fail');
  const unowned=records.map(record=>record.id).filter(id=>!productionIdsInDb.has(id)&&!blockedSpecies.includes(id));
  assert.deepEqual(unowned,[],'a future DB species remains unowned and fails until explicitly classified');
  assert.equal(records.length,142);

  assert.deepEqual(admission.blockerVocabulary, ['CORE','DB','CATALYST','PRESSURE','SPECIATION','EQUILIBRIUM','BATCH','SELECTIVITY','GLOBAL_NET']);
  const transformationSignatures=admission.blockedTransformations.map(row=>directionalTransformationSignature(row.reactants,row.products));
  assert.equal(admission.blockedTransformations.length,17);
  assert.equal(new Set(transformationSignatures).size,17,'blocked transformations preserve direction and multiplicity');
  const playableNetSignatures=new Set(REACTION_CATALOG.map(row=>directionalTransformationSignature(row.reactants.map(item=>item.species),row.products)));
  assert.equal(transformationSignatures.filter(signature=>playableNetSignatures.has(signature)).length,0,'blocked transformations cannot overlap production nets');
  for(const row of admission.blockedTransformations){
    assert.ok(row.blockers.length>0,`${row.label} has at least one blocker`);
    assert.ok(row.blockers.every(code=>admission.blockerVocabulary.includes(code)),`${row.label} uses only the blocker vocabulary`);
    for(const side of [row.reactants,row.products])for(const item of side)assert.ok(byId.has(item.species),`${row.label} references current DB species ${item.species}`);
  }
  const reverseFischer=directionalTransformationSignature(['acetic-acid','ethanol'],['ethyl-acetate','water']);
  const forwardFischer=directionalTransformationSignature(['ethyl-acetate','water'],['acetic-acid','ethanol']);
  assert.notEqual(reverseFischer,forwardFischer,'Fischer esterification directions remain separate authority entries');
  assert.ok(transformationSignatures.includes(reverseFischer));

  assert.equal(admission.excludedPolymerRoutes.length,25);
  assert.equal(new Set(admission.excludedPolymerRoutes).size,25);
  assert.deepEqual(sorted(admission.excludedPolymerRoutes),sorted(polymers.map(route=>route.id)),'EXCLUDED routes match the current polymer catalog exactly');
  const total=playableIds.length+blockedSpecies.length+admission.blockedTransformations.length+admission.excludedPolymerRoutes.length;
  assert.equal(total,165);
});

test('structural exposure generator is closed against 16 exact directional resolutions',()=>{
  assert.deepEqual(structural.summary,{
    positivePatternSpeciesHits:56,labelledSiteMatches:109,familyRoleAssignments:267,labelledStructuralRealizations:810,
    dbClosedLabelledRealizations:312,uniqueDbClosedSignatures:67,netIdentitySignatures:23,productionNetSignatures:28,
    nonproductionNonidentitySignatures:16,
  });
  assert.equal(resolutions.schemaVersion,1);
  assert.ok(resolutions.authorityRevision);
  const generated=new Set(structural.nonproductionNonidentity.map(row=>row.signature));
  const entries=resolutions.entries;
  const resolved=entries.map(row=>row.signature);
  assert.equal(entries.length,16);
  assert.equal(new Set(resolved).size,16,'duplicate waivers fail');
  assert.deepEqual(sorted(resolved),sorted(generated),'new exposures and stale resolution entries both fail');
  assert.ok(entries.every(row=>row.signature&&row.resolutionKind&&row.referencedAuthority&&row.rationaleCode));
  const exact=entries.filter(row=>row.resolutionKind==='exact-blocked-transformation');
  const species=entries.filter(row=>row.resolutionKind==='blocked-species-probe-acknowledged');
  const rejects=entries.filter(row=>row.resolutionKind==='structural-rejection');
  assert.equal(exact.length,6);
  assert.equal(species.length,8);
  assert.equal(rejects.length,2);
  for(const row of exact){
    const label=row.referencedAuthority.replace('blockedTransformation:','');
    const authority=admission.blockedTransformations.find(item=>item.label===label);
    assert.ok(row.referencedAuthority.startsWith('blockedTransformation:'));
    assert.ok(authority,`${row.signature} references a current exact BLOCKED authority row`);
    assert.equal(directionalTransformationSignature(authority.reactants,authority.products),row.signature);
  }
  for(const row of species){
    assert.ok(row.referencedAuthority.startsWith('blockedSpeciesProbe:'));
    const speciesId=row.referencedAuthority.slice('blockedSpeciesProbe:'.length);
    assert.ok(admission.blockedSpeciesProbes.includes(speciesId),`${row.signature} references a BLOCKED species probe`);
    assert.equal(generated.has(row.signature),true,'species acknowledgement is exact to the generated directional signature');
  }
  assert.ok(rejects.some(row=>row.signature==='1*methane+1*water=>1*hydrogen+1*methanol'&&row.rationaleCode==='NOT_CHEMICAL_CANDIDATE'));
  assert.ok(rejects.some(row=>row.signature==='1*methane+1*methanol=>1*dimethyl-ether+1*hydrogen'&&row.rationaleCode==='STRUCTURAL_ARTIFACT'));
});

test('all 198 labelled pathways trace through candidate assignment, geometry, arbitration, and strict DB execution',()=>{
  const traces=positiveTraces;
  assert.equal(traces.length,198);
  const failures=traces.filter(trace=>!trace.ok);
  assert.deepEqual(failures.map(trace=>({pathwayId:trace.pathway.pathwayId,reason:trace.reason})),[]);
  for(const trace of traces){
    const pathway=trace.pathway,execution=trace.execution,rule=pathway.reaction;
    assert.equal(execution.reactionId,rule.id);
    assert.equal(execution.familyId,rule.familyId);
    assert.deepEqual(execution.products.map(row=>row.id),rule.products,'ordered products and multiplicity are exact');
    assert.equal(execution.participants.length,rule.reactants.length);
    assert.equal(new Set(execution.participants.map(row=>row.instanceId)).size,rule.reactants.length,'each stoichiometric role has a distinct instance');
    assert.deepEqual(sorted(Object.keys(execution.matchedSites)),sorted(Object.keys(pathway.roleSpecies)));
    for(const [role,site] of Object.entries(execution.matchedSites)){
      assert.equal(site.patternId,pathway.matchedPatterns[role]);
      assert.deepEqual(site.atomBindings,pathway.bindings[role]);
    }
    assert.equal(execution.graphTransition.ok,true);
    assert.equal(execution.atomOrigins.reduce((sum,row)=>sum+row.origins.length,0),rule.reactants.reduce((sum,row)=>sum+byId.get(row.species).atoms.length,0));
    assert.equal(new Set(execution.atomOrigins.flatMap(row=>row.origins.map(origin=>origin.sourceAtom))).size,execution.atomOrigins.reduce((sum,row)=>sum+row.origins.length,0));
    assert.equal(trace.geometry.geometryReady,true);
    assert.equal(trace.geometry.worstNormalizedDeviation,0);
    assert.equal(trace.geometry.meanNormalizedDeviation,0);
    assert.ok(trace.arbitration.selected,'a candidate in isolation is selectable');
  }
});

test('positive symbolic geometry and wrong-site / hard-window negatives cover all pathways',()=>{
  const traces=positiveTraces;
  assert.equal(traces.length,198);
  for(const trace of traces){
    const constraint=trace.pathway.geometryConstraints[0],epsilon=Math.min(1e-6,(constraint.target-constraint.min)/2,(constraint.max-constraint.target)/2);
    assert.equal(environmentMatches(trace.pathway.reaction,trace.environment.tokens),true,'the negative pose keeps a valid environment');
    assert.equal(new Set(trace.execution.participants.map(row=>row.instanceId)).size,trace.execution.participants.length,'the negative pose keeps distinct participants');
    const distance=value=>scoreReactionGeometry([constraint],role=>role===constraint.from.role?[0,0,0]:[value,0,0]);
    assert.equal(distance(constraint.target).geometryReady,true);
    assert.equal(distance(constraint.target).worstNormalizedDeviation,0);
    assert.equal(distance(constraint.min-epsilon).geometryReady,false);
    assert.equal(distance(constraint.max+epsilon).geometryReady,false);
    const compiledAnchorOutside=constraint.min-epsilon;
    const positions={compiledFrom:[0,0,0],compiledTo:[compiledAnchorOutside,0,0],decoyFrom:[0,30,0],decoyTo:[constraint.target,30,0]};
    assert.equal(Math.hypot(...positions.decoyFrom.map((value,index)=>value-positions.decoyTo[index])),constraint.target,'the unrelated decoy pair alone is exactly at target distance');
    const wrongSite=scoreReactionGeometry([constraint],role=>role===constraint.from.role?positions.compiledFrom:positions.compiledTo);
    assert.equal(wrongSite.geometryReady,false,'an unrelated decoy pair at target distance cannot satisfy the compiled anchor');
  }
});

test('all species pairs and pair × canonical environment states are exhaustively exact',()=>{
  const pairs=enumerateUnorderedSpeciesPairs(records),authority=independentEncounterAuthority(REACTION_CATALOG,REACTION_FAMILIES);
  assert.equal(pairs.length,10153);
  assert.equal(authority.size,28);
  const speciesById=new Map(records.map(record=>[record.id,record]));
  let eligiblePositiveCases=0;
  for(const [leftSpecies,rightSpecies] of pairs){
    const key=canonicalSpeciesMultisetKey([leftSpecies,rightSpecies]),expected=sorted((authority.get(key)??[]).map(row=>row.id));
    const pair=[{species:leftSpecies,id:'pair-left'},{species:rightSpecies,id:'pair-right'}];
    const reverse=[...pair].reverse();
    const actualCandidates=reactionCandidates(pair,compiled),actual=sorted(new Set(actualCandidates.map(row=>row.reactionId)));
    assert.deepEqual(actual,expected,`${key} candidate completeness`);
    const reversed=sorted(new Set(reactionCandidates(reverse,compiled).map(row=>row.reactionId)));
    assert.deepEqual(reversed,actual,`${key} pair reversal`);
    if(leftSpecies===rightSpecies){
      assert.ok(pair[0].id!==pair[1].id,'same-species encounters use distinct runtime instances');
      assert.equal(reactionCandidates([{species:leftSpecies,id:'same'},{species:rightSpecies,id:'same'}],compiled).length,0,'one instance cannot satisfy both same-species roles');
    }
    for(const environment of environments){
      const expectedEligible=(authority.get(key)??[]).filter(row=>environmentMatches(row,environment.tokens)).map(row=>row.id).sort();
      const actualEligible=sorted(new Set(actualCandidates.filter(row=>environmentMatches(row.reaction,environment.tokens)).map(row=>row.reactionId)));
      assert.deepEqual(actualEligible,expectedEligible,`${key} in ${canonicalEnvironmentKey(environment.tokens)}`);
      eligiblePositiveCases+=actualEligible.length;
    }
  }
  assert.equal(speciesById.size,142);
  assert.equal(eligiblePositiveCases,130);
  assert.equal(pairs.length*environments.length,121836);
  assert.equal(pairs.length*environments.length-eligiblePositiveCases,121706);
  exhaustiveEligibleCases=eligiblePositiveCases;
});

test('condition-boundary mutations reject required/forbidden changes and admit allowed extras',()=>{
  const canonical=new Set(environments.map(({tokens})=>canonicalEnvironmentKey(tokens)));
  const tokenUniverse=['light','heat','acidic','basic'];
  for(const reaction of REACTION_CATALOG){
    for(const {tokens} of environments){
      if(!environmentMatches(reaction,tokens))continue;
      const current=new Set(tokens);
      for(const token of reaction.requires??[]){
        const mutation=new Set(current);mutation.delete(token);
        if(canonical.has(canonicalEnvironmentKey(mutation))){assert.equal(environmentMatches(reaction,mutation),false,`${reaction.id} required-token removal ${token}`);requiredTokenRemovalMutations++;}
      }
      for(const token of reaction.forbids??[]){
        const mutation=new Set(current);mutation.add(token);
        if(canonical.has(canonicalEnvironmentKey(mutation))){assert.equal(environmentMatches(reaction,mutation),false,`${reaction.id} forbidden-token addition ${token}`);forbiddenTokenAdditionMutations++;}
      }
      for(const token of tokenUniverse){
        if(current.has(token)||(reaction.forbids??[]).includes(token))continue;
        const mutation=new Set(current);mutation.add(token);
        if(canonical.has(canonicalEnvironmentKey(mutation))){assert.equal(environmentMatches(reaction,mutation),true,`${reaction.id} allows extra token ${token}`);allowedExtraConditionMutations++;}
      }
    }
  }
  assert.ok(requiredTokenRemovalMutations>0);
  assert.ok(forbiddenTokenAdditionMutations>0);
  assert.ok(allowedExtraConditionMutations>0);
});

test('catalog, family, pattern, role, encounter, and supplemental input ordering is invariant',()=>{
  const reversedPatterns=REACTION_SITE_PATTERNS.map(pattern=>({...pattern,atoms:[...pattern.atoms].reverse(),bonds:[...pattern.bonds].reverse()})).reverse();
  const reversedFamilies=REACTION_FAMILIES.map(family=>({...family,roles:Object.fromEntries(Object.entries(family.roles).reverse())})).reverse();
  const reversedReactions=REACTION_CATALOG.map(reaction=>({...reaction,reactants:[...reaction.reactants].reverse()})).reverse();
  const reordered=compileReactionCatalog(records,{patterns:reversedPatterns,families:reversedFamilies,reactions:reversedReactions});
  const baseline=compiled.pathways.map(pathway=>semanticPathwayFingerprint(pathway)).sort();
  const reversed= reordered.pathways.map(pathway=>semanticPathwayFingerprint(pathway)).sort();
  assert.deepEqual(reversed,baseline);

  for(const reaction of REACTION_CATALOG){
    const family=REACTION_FAMILIES.find(row=>row.id===reaction.familyId),encounterRows=reaction.reactants.filter(row=>family.roles[row.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
    const pair=encounterRows.map((row,index)=>({species:row.species,id:`${reaction.id}:${row.role}:${index}`}));
    const forward=reactionCandidates(pair,compiled).filter(row=>row.reactionId===reaction.id).map(row=>`${row.pathwayId}|${JSON.stringify(row.participantInstances)}`).sort();
    const backward=reactionCandidates([...pair].reverse(),compiled).filter(row=>row.reactionId===reaction.id).map(row=>`${row.pathwayId}|${JSON.stringify(row.participantInstances)}`).sort();
    assert.deepEqual(backward,forward,`${reaction.id} encounter pair ordering`);
    if(encounterRows[0].species===encounterRows[1].species){
      const swapped=[{species:encounterRows[0].species,id:'z-instance'},{species:encounterRows[1].species,id:'a-instance'}];
      const sameOrder=reactionCandidates(swapped,compiled).filter(row=>row.reactionId===reaction.id).map(row=>row.participantInstances).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const reverseOrder=reactionCandidates([...swapped].reverse(),compiled).filter(row=>row.reactionId===reaction.id).map(row=>row.participantInstances).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      assert.deepEqual(reverseOrder,sameOrder,`${reaction.id} same-species instance order`);
    }
  }

  for(const reaction of REACTION_CATALOG.filter(row=>row.reactants.some(item=>REACTION_FAMILIES.find(f=>f.id===row.familyId).roles[item.role].participation==='supplemental'))){
    const family=REACTION_FAMILIES.find(row=>row.id===reaction.familyId),encounterRows=reaction.reactants.filter(row=>family.roles[row.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
    const pair=encounterRows.map(row=>({species:row.species,id:`${reaction.id}:${row.role}`})),candidate=reactionCandidates(pair,compiled).find(row=>row.reactionId===reaction.id);
    const instances=reaction.reactants.map(row=>({id:`${reaction.id}:${row.role}`,species:row.species,busy:false}));
    const forward=resolveSupplementalParticipants(candidate.reaction,candidate,instances,()=>0);
    const reverse=resolveSupplementalParticipants(candidate.reaction,candidate,[...instances].reverse(),()=>0);
    assert.equal(forward.ok,true);
    assert.deepEqual(reverse.participantInstances,forward.participantInstances,`${reaction.id} supplemental instance array ordering`);
  }
});

test('production chemistry is invariant under three deterministic atom-index permutations',()=>{
  const productionIds=productionSpecies();
  assert.equal(productionIds.size,48);
  assert.ok(records.every(record=>(record.nonbonded?.virtualChargeSites??[]).length===0),'nonbonded v1 virtualChargeSites remain empty for all 142 species');
  const baselineFingerprints=compiled.pathways.map(pathway=>semanticPathwayFingerprint(pathway)).sort();
  const baselineSymmetry=compareSymmetryMetrics(compiled.pathways);
  assert.equal(baselineSymmetry.length,29);
  assert.ok(baselineSymmetry.every(row=>row.symmetryClassCount===1));
  const permutationResults=[];
  for(const kind of ['reverse','cyclic','id-shuffle']){
    const atomIndexMaps=new Map();
    const permutedRecords=records.map(record=>{
      if(!productionIds.has(record.id))return record;
      const order=deterministicAtomPermutation(record,kind);atomIndexMaps.set(record.id,order);
      const permuted=permuteMoleculeRecord(record,order);
      for(const field of ['atomicChargesE','sigmaAngstrom','epsilonKcalMol','vdwParameterIds']){
        const source=record.nonbonded[field],target=permuted.nonbonded[field];
        assert.deepEqual(target,order.map(index=>source[index]),`${record.id} ${field} remapping`);
      }
      assert.deepEqual(permuted.nonbonded.atomMap,Array.from({length:record.atoms.length},(_,index)=>index));
      assert.deepEqual(permuted.nonbonded.virtualChargeSites,[]);
      assert.equal(permuted.nonbonded.provenance.moleculeGraphSha256,record.nonbonded.provenance.moleculeGraphSha256,'test relabel clones retain provenance without graph-digest regeneration');
      for(const [oldIndex,charge] of Object.entries(record.formalCharges??{}))assert.equal(permuted.formalCharges[String(order.indexOf(Number(oldIndex)))],charge);
      return permuted;
    });
    const permutedCatalog=compileReactionCatalog(permutedRecords);
    assert.equal(permutedCatalog.pathways.length,198,`${kind} pathways`);
    assertSameFingerprintMultiset(permutedCatalog.pathways.map(pathway=>semanticPathwayFingerprint(pathway,{atomIndexMaps})),baselineFingerprints,`${kind} normalized semantic pathway fingerprints`);
    const symmetry=compareSymmetryMetrics(permutedCatalog.pathways);
    assert.deepEqual(symmetry,baselineSymmetry,`${kind} reaction pathway and symmetry cardinalities`);
    permutationResults.push({kind,pathways:permutedCatalog.pathways.length,symmetryClasses:new Set(permutedCatalog.pathways.map(row=>row.symmetryClassId)).size});
  }
  assert.equal(permutationResults.length,3);
});

test('pattern predicates are sensitive one at a time and exact-zero neighbors stay exact',()=>{
  const predicateCounts={element:0,degree:0,formalCharge:0,aromatic:0,neighborExact:0,neighborRange:0,bondOrder:0},exactZeroSeeds=[];
  const ringRequiredPatterns=new Set();
  const aromaticSpecies=new Set(records.filter(record=>{
    const atoms=record.atoms.map((atom,id)=>({id,element:atomId(record,id),formalCharge:formalChargeForRecordAtom(record,id)}));
    return molecularAromaticAtomIds(atoms,record.bonds.map(([a,b,order])=>({a,b,order}))).size>0;
  }).map(record=>record.id));
  for(const pattern of REACTION_SITE_PATTERNS){
    if(pattern.bonds.length>=pattern.atoms.length)ringRequiredPatterns.add(pattern.id);
    for(const record of records){
      const matches=matchReactionSitePattern(record,pattern);if(!matches.length)continue;
      for(const binding of matches){
        for(let specIndex=0;specIndex<pattern.atoms.length;specIndex++){
          const spec=pattern.atoms[specIndex],atomIndex=binding[spec.label];
          const changeAtomPredicate=(field,value)=>{
            const atoms=pattern.atoms.map((row,index)=>index===specIndex?{...row,[field]:value}:row);
            assertOriginalBindingAbsent({...pattern,atoms},record,binding,`${pattern.id} ${field} sensitivity`);
            predicateCounts[field]++;
          };
          changeAtomPredicate('element',spec.element==='Xx'?'Xe':'Xx');
          if(spec.degree!=null)changeAtomPredicate('degree',spec.degree+1);
          if(spec.formalCharge!=null)changeAtomPredicate('formalCharge',spec.formalCharge+1);
          if(spec.aromatic!=null)changeAtomPredicate('aromatic',!spec.aromatic);
          for(const [element,constraint] of Object.entries(spec.neighborCounts??{})){
            const actualNeighbors=record.bonds.map(([a,b])=>a===atomIndex?b:b===atomIndex?a:null).filter(index=>index!=null).map(index=>atomId(record,index)).filter(value=>value===element).length;
            assert.equal(typeof constraint==='number'?actualNeighbors===constraint:actualNeighbors>=(constraint.min??0)&&(constraint.max==null||actualNeighbors<=constraint.max),true,`${pattern.id} positive seed satisfies ${element} neighbor predicate`);
            const nextConstraint=typeof constraint==='number'?actualNeighbors+1:{min:actualNeighbors+1,max:null};
            const atoms=pattern.atoms.map((row,index)=>index===specIndex?{...row,neighborCounts:{...row.neighborCounts,[element]:nextConstraint}}:row);
            assertOriginalBindingAbsent({...pattern,atoms},record,binding,`${pattern.id} ${typeof constraint==='number'?'exact':'range'} neighbor sensitivity`);
            predicateCounts[typeof constraint==='number'?'neighborExact':'neighborRange']++;
            if(constraint===0){
              exactZeroSeeds.push({pattern,record,binding,label:spec.label,element});
            }
          }
        }
        for(let bondIndex=0;bondIndex<pattern.bonds.length;bondIndex++){
          const changed=pattern.bonds.map((row,index)=>index===bondIndex?[row[0],row[1],row[2]===1?2:1]:row);
          assertOriginalBindingAbsent({...pattern,bonds:changed},record,binding,`${pattern.id} bond-order sensitivity`);
          predicateCounts.bondOrder++;
        }
      }
    }
  }
  assert.equal(exactZeroSeeds.length,580,'all current exact-zero predicate seeds are covered');
  for(const seed of exactZeroSeeds){
    const center=seed.binding[seed.label],newIndex=seed.record.atoms.length;
    const mutated=cloneGraph(seed.record,{atoms:[...seed.record.atoms,seed.element],bonds:[...seed.record.bonds,[center,newIndex,1]]});
    assertOriginalBindingAbsent(seed.pattern,mutated,seed.binding,`${seed.pattern.id} forbids added ${seed.element} neighbor`);
  }
  assert.equal(aromaticSpecies.size,25);
  const aromaticIdsBySpecies=new Map(records.map(record=>{
    const atoms=record.atoms.map((atom,id)=>({id,element:atomId(record,id),formalCharge:formalChargeForRecordAtom(record,id)}));
    return[record.id,molecularAromaticAtomIds(atoms,record.bonds.map(([a,b,order])=>({a,b,order})))];
  }));
  for(const pattern of REACTION_SITE_PATTERNS)for(const record of records)for(const binding of matchReactionSitePattern(record,pattern)){
    for(const spec of pattern.atoms)if(spec.aromatic!=null)assert.equal(aromaticIdsBySpecies.get(record.id).has(binding[spec.label]),spec.aromatic,`${pattern.id} shared aromatic authority`);
  }
  const alkenePatterns=['pi-ethene','pi-terminal-monosub','pi-terminal-disub','pi-internal-symmetric'];
  for(const species of aromaticSpecies)for(const patternId of alkenePatterns){
    const pattern=REACTION_SITE_PATTERNS.find(row=>row.id===patternId);
    for(const binding of matchReactionSitePattern(byId.get(species),pattern))assert.equal(pattern.atoms.some(spec=>aromaticIdsBySpecies.get(species).has(binding[spec.label])),false,`${patternId} cannot bind an aromatic ring site in ${species}`);
  }
  assert.ok(ringRequiredPatterns.size>0);
  for(const patternId of ringRequiredPatterns){
    const pattern=REACTION_SITE_PATTERNS.find(row=>row.id===patternId);
    for(const record of records)for(const binding of matchReactionSitePattern(record,pattern))for(const [from,to] of pattern.bonds){
      const a=binding[from],b=binding[to];
      const bonds=record.bonds.filter(([left,right])=>!((left===a&&right===b)||(left===b&&right===a)));
      assert.equal(record.bonds.length-bonds.length,1,`${patternId} required ring edge exists`);
      assertOriginalBindingAbsent(pattern,cloneGraph(record,{bonds}),binding,`${patternId} required connectivity survives no edge deletion`);
    }
  }
  assert.ok(Object.values(predicateCounts).every(count=>count>0));
  console.log('⑦D predicate sensitivity counts',JSON.stringify({predicateCounts,exactZeroSeeds:exactZeroSeeds.length,aromaticSpecies:aromaticSpecies.size,ringRequiredPatterns:[...ringRequiredPatterns]}));
});

test('single graph-primitive near misses remove the original site binding',()=>{
  const counts={elementReplacement:0,formalChargeReplacement:0,bondOrderMutation:0,bondDeletion:0,bondAddition:0,neighborReplacement:0};
  for(const pattern of REACTION_SITE_PATTERNS)for(const record of records)for(const binding of matchReactionSitePattern(record,pattern)){
    const firstSpec=pattern.atoms[0],elementIndex=binding[firstSpec.label],oldElement=atomId(record,elementIndex);
    const atoms=record.atoms.map((atom,index)=>index!==elementIndex?atom:typeof atom==='string'?'Xx':{...atom,element:'Xx'});
    assertOriginalBindingAbsent(pattern,cloneGraph(record,{atoms}),binding,`${pattern.id} element replacement`);counts.elementReplacement++;
    const chargedSpecs=pattern.atoms.filter(spec=>spec.formalCharge!=null);
    if(chargedSpecs.length){
      const spec=chargedSpecs[0],index=binding[spec.label],formalCharges={...(record.formalCharges??{}),[index]:formalChargeForRecordAtom(record,index)+1};
      assertOriginalBindingAbsent(pattern,cloneGraph(record,{formalCharges}),binding,`${pattern.id} formal-charge replacement`);counts.formalChargeReplacement++;
    }
    const normalized=record.bonds.map(([a,b,order])=>[a,b,order]);
    for(const [from,to,order] of pattern.bonds){
      const a=binding[from],b=binding[to],edgeIndex=normalized.findIndex(([left,right])=>left===a&&right===b||left===b&&right===a);
      assert.notEqual(edgeIndex,-1,`${pattern.id} positive edge exists`);
      const differentOrder=normalized.map((edge,index)=>index===edgeIndex?[edge[0],edge[1],edge[2]===1?2:1]:edge);
      assertOriginalBindingAbsent(pattern,cloneGraph(record,{bonds:differentOrder}),binding,`${pattern.id} bond order mutation`);counts.bondOrderMutation++;
      assertOriginalBindingAbsent(pattern,cloneGraph(record,{bonds:normalized.filter((_,index)=>index!==edgeIndex)}),binding,`${pattern.id} bond deletion`);counts.bondDeletion++;
      const target=record.atoms.map((_,index)=>index).find(index=>index!==a&&index!==b&&!normalized.some(([left,right])=>left===a&&right===index||left===index&&right===a));
      if(target!=null){
        const replacement=normalized.map((edge,index)=>index===edgeIndex?[edge[0]===a?a:target,edge[1]===b?target:edge[1],edge[2]]:edge);
        const replacedEdge=replacement[edgeIndex];
        if(replacedEdge.includes(a)&&replacedEdge.includes(target)){
          assertOriginalBindingAbsent(pattern,cloneGraph(record,{bonds:replacement}),binding,`${pattern.id} neighbor replacement`);counts.neighborReplacement++;
        }
      }
    }
    const addable=pattern.atoms.find(spec=>{
      const index=binding[spec.label],neighbors=normalized.filter(([a,b])=>a===index||b===index).map(([a,b])=>a===index?b:a);
      return(spec.degree!=null||Object.entries(spec.neighborCounts??{}).some(([element,constraint])=>typeof constraint==='number'&&neighbors.filter(id=>atomId(record,id)===element).length===constraint))&&record.atoms.some((_,candidate)=>candidate!==index&&!neighbors.includes(candidate));
    });
    if(addable){
      const center=binding[addable.label],neighbors=normalized.filter(([a,b])=>a===center||b===center).map(([a,b])=>a===center?b:a),target=record.atoms.map((_,index)=>index).find(index=>index!==center&&!neighbors.includes(index));
      assertOriginalBindingAbsent(pattern,cloneGraph(record,{bonds:[...normalized,[center,target,1]]}),binding,`${pattern.id} added neighbor`);counts.bondAddition++;
    }
  }
  assert.ok(Object.values(counts).every(count=>count>0),JSON.stringify(counts));
  console.log('⑦D single graph-primitive mutation counts',JSON.stringify(counts));
});

test('same-species and supplemental stoichiometry cannot leak or double-use instances',()=>{
  const supplementalReactions=REACTION_CATALOG.filter(reaction=>REACTION_FAMILIES.find(family=>family.id===reaction.familyId).roles&&reaction.reactants.some(row=>REACTION_FAMILIES.find(family=>family.id===reaction.familyId).roles[row.role].participation==='supplemental'));
  assert.equal(supplementalReactions.length,3);
  const supplementalNegativeCases={missing:0,busy:0,wrongSpeciesOnly:0,encounterOnly:0,orderReversal:0};
  for(const reaction of supplementalReactions){
    const family=REACTION_FAMILIES.find(row=>row.id===reaction.familyId),encounterRows=reaction.reactants.filter(row=>family.roles[row.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
    const encounter=encounterRows.map(row=>({species:row.species,id:`${reaction.id}:${row.role}`}));
    const candidate=reactionCandidates(encounter,compiled).find(row=>row.reactionId===reaction.id);
    assert.ok(candidate,`${reaction.id} has an encounter candidate`);
    const supplementRows=reaction.reactants.filter(row=>family.roles[row.role].participation==='supplemental');
    const encounterInstances=encounter.map(row=>({...row,busy:false}));
    const fullInstances=[...encounterInstances,...supplementRows.map((row,index)=>({id:`${reaction.id}:supplement:${index}`,species:row.species,busy:false}))];
    const resolved=resolveSupplementalParticipants(candidate.reaction,candidate,fullInstances,()=>0);
    assert.equal(resolved.ok,true,`${reaction.id} resolves available stoichiometric participants`);
    assert.equal(new Set(Object.values(resolved.participantInstances)).size,reaction.reactants.length);
    assert.deepEqual(resolveSupplementalParticipants(candidate.reaction,candidate,fullInstances.slice().reverse(),()=>0).participantInstances,resolved.participantInstances);
    supplementalNegativeCases.orderReversal++;

    assert.equal(resolveSupplementalParticipants(candidate.reaction,candidate,encounterInstances,()=>0).reason,'missing-stoichiometric-participant');
    supplementalNegativeCases.missing++;supplementalNegativeCases.encounterOnly++;
    const busyInstances=[...encounterInstances,...supplementRows.map((row,index)=>({id:`${reaction.id}:busy:${index}`,species:row.species,busy:true}))];
    assert.equal(resolveSupplementalParticipants(candidate.reaction,candidate,busyInstances,()=>0).reason,'missing-stoichiometric-participant');supplementalNegativeCases.busy++;
    const wrongInstances=[...encounterInstances,...supplementRows.map((row,index)=>({id:`${reaction.id}:wrong:${index}`,species:row.species==='ammonia'?'water':'ammonia',busy:false}))];
    assert.equal(resolveSupplementalParticipants(candidate.reaction,candidate,wrongInstances,()=>0).reason,'missing-stoichiometric-participant');supplementalNegativeCases.wrongSpeciesOnly++;
  }
  assert.deepEqual(supplementalNegativeCases,{missing:3,busy:3,wrongSpeciesOnly:3,encounterOnly:3,orderReversal:3});

  for(const reaction of REACTION_CATALOG.filter(row=>['complete-21-cyclobutane-dimerization','complete-23-methanol-dehydration'].includes(row.id))){
    const species=reaction.reactants[0].species,pair=[{species,id:'stoich-z'},{species,id:'stoich-a'}];
    const rows=reactionCandidates(pair,compiled).filter(row=>row.reactionId===reaction.id);
    assert.ok(rows.length>0,`${reaction.id} accepts two distinct same-species instances`);
    assert.ok(rows.every(row=>new Set(row.reactantInstanceIds).size===2));
    assert.equal(reactionCandidates([{species,id:'stoich-one'},{species,id:'stoich-one'}],compiled).length,0);
    assert.equal(resolveCandidateInstanceIds({reactantInstanceIds:['stoich-one','stoich-one']},['stoich-one']),null);
  }
  console.log('⑦D stoichiometry negatives',JSON.stringify(supplementalNegativeCases));
});

test('encounter × environment ambiguity is zero across all production rules',()=>{
  const authority=independentEncounterAuthority(REACTION_CATALOG,REACTION_FAMILIES);
  const duplicateGroups=[...authority].filter(([,rows])=>rows.length>1);
  assert.equal(duplicateGroups.length,1);
  assert.equal(duplicateGroups[0][0],canonicalSpeciesMultisetKey(['ethylene-oxide','water']));
  assert.deepEqual(duplicateGroups[0][1].map(row=>row.id),['complete-09-ethylene-oxide-acid-cleavage','complete-10-ethylene-oxide-basic-cleavage']);
  let eligibleEncounterEnvironmentStates=0,crossRuleOverlapStates=0,maxDistinctRuleIds=0;
  for(const reactions of authority.values())for(const environment of environments){
    const eligible=reactions.filter(reaction=>environmentMatches(reaction,environment.tokens));
    if(eligible.length)eligibleEncounterEnvironmentStates++;
    if(eligible.length>1)crossRuleOverlapStates++;
    maxDistinctRuleIds=Math.max(maxDistinctRuleIds,new Set(eligible.map(row=>row.id)).size);
  }
  assert.equal(eligibleEncounterEnvironmentStates,130);
  assert.equal(crossRuleOverlapStates,0);
  assert.equal(maxDistinctRuleIds,1);
});

test('same-reaction symmetry arbitration is stable for baseline, reverse, and deterministic pathway order',()=>{
  const generated=[];
  for(const reaction of REACTION_CATALOG){
    const pathways=compiled.pathways.filter(pathway=>pathway.reaction.id===reaction.id).sort((a,b)=>a.pathwayId.localeCompare(b.pathwayId));
    assert.ok(pathways.length>0);
    assert.equal(new Set(pathways.map(pathway=>pathway.symmetryClassId)).size,1,`${reaction.id} has one source-graph symmetry class`);
    const participants=Object.fromEntries(Object.keys(pathways[0].roleSpecies).sort().map(role=>[role,`${reaction.id}:${role}:instance`]));
    const candidates=pathways.map((pathway,index)=>({
      reactionId:reaction.id,pathwayId:pathway.pathwayId,symmetryClassId:pathway.symmetryClassId,participantInstances:{...participants},
      geometryQuality:{worstNormalizedDeviation:index%5===0?.1:.112,meanNormalizedDeviation:index%7===0?.11:.118},
      newBondEndpointDistanceSum:(index*7%13)/10,
    }));
    const deterministic=[...candidates].sort((a,b)=>((a.pathwayId.length*17+a.pathwayId.charCodeAt(a.pathwayId.length-1))%97)-((b.pathwayId.length*17+b.pathwayId.charCodeAt(b.pathwayId.length-1))%97)||a.pathwayId.localeCompare(b.pathwayId));
    const orders=[candidates,[...candidates].reverse(),deterministic];
    const selected=orders.map(rows=>arbitrateReactionCandidates(rows).selected?.pathwayId);
    assert.ok(selected[0]);
    assert.deepEqual(selected,[selected[0],selected[0],selected[0]],`${reaction.id} same-class geometry / endpoint / stable-key result`);
    const componentResults=orders.map(rows=>arbitrateReactionCandidateComponents(rows));
    assert.deepEqual(componentResults.map(result=>result.selected?.pathwayId),[selected[0],selected[0],selected[0]]);
    assert.ok(componentResults.every(result=>result.components.length===1&&result.components[0].status==='selected'));
    generated.push({reactionId:reaction.id,pathways:pathways.length,selectedPathwayId:selected[0]});
  }
  assert.equal(generated.length,29);
});

test('⑦D reports deterministic audit totals and generated mutation counts',()=>{
  const base=auditSummary({records,reactions:REACTION_CATALOG,patterns:REACTION_SITE_PATTERNS,families:REACTION_FAMILIES,compiled,admission,structural,resolutions,polymerRoutes:polymers,pathTraces:positiveTraces,environmentPairCases:enumerateUnorderedSpeciesPairs(records).length*environments.length,eligibleCases:exhaustiveEligibleCases});
  const report={...base,ambiguity:{crossRuleEncounterEnvironmentOverlap:0,maxDistinctReactionIdsPerState:1},generatedMutations:{requiredTokenRemoval:requiredTokenRemovalMutations,forbiddenTokenAddition:forbiddenTokenAdditionMutations,allowedExtraConditions:allowedExtraConditionMutations}};
  assert.deepEqual(report.moleculeDb,{species:142,productionSideSpecies:48,blockedOnlySpecies:94,unownedSpecies:0});
  assert.deepEqual(report.productionAuthority,{sitePatterns:24,reactionFamilies:11,reactions:29,labelledPathways:198,symmetryClasses:29,uniqueNetTransformations:28});
  assert.deepEqual(report.chemicalCandidateAuthority,{playable:29,blockedSpeciesProbes:94,blockedTransformations:17,excludedPolymerRoutes:25,total:165,unclassified:0});
  assert.deepEqual(report.structuralExposure,{positivePatternSpeciesHits:56,labelledSiteMatches:109,familyRoleAssignments:267,labelledStructuralRealizations:810,dbClosedLabelledRealizations:312,uniqueDbClosedSignatures:67,netIdentitySignatures:23,productionNetSignatures:28,nonproductionNonidentitySignatures:16,unresolved:0,staleResolutions:0,duplicateResolutions:0});
  assert.deepEqual(report.runtimeExhaustive,{unorderedSpeciesPairs:10153,productionEncounterSignatures:28,negativePairSignatures:10125,pairEnvironmentCases:121836,eligibleCases:130,negativeEligibilityCases:121706});
  assert.deepEqual(report.positivePathways,{traces:198,failures:0});
  assert.deepEqual(report.ambiguity,{crossRuleEncounterEnvironmentOverlap:0,maxDistinctReactionIdsPerState:1});
  console.log('⑦D deterministic summary',JSON.stringify(report));
});
