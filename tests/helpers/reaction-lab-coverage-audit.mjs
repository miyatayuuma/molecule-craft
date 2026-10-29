import { formalChargeForRecordAtom, molecularAromaticAtomIds } from '../../src/chemistry.js';
import {
  arbitrateReactionCandidates,
  compileReactionCatalog,
  environmentMatches,
  matchDatabaseProduct,
  matchReactionSitePattern,
  planReactionExecution,
  reactionCandidates,
  resolveSupplementalParticipants,
  scoreReactionGeometry,
} from '../../src/reaction-lab-core.js';
import { enumerateCanonicalReactionLabEnvironments } from '../../src/reaction-lab-environment.js';

export const REACTION_BLOCKER_CODES=Object.freeze([
  'CORE','DB','CATALYST','PRESSURE','SPECIATION','EQUILIBRIUM','BATCH','SELECTIVITY','GLOBAL_NET',
]);

const sortText=(a,b)=>String(a).localeCompare(String(b));
const normalizedBond=bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond;
const atomElement=(record,index)=>typeof record.atoms[index]==='string'?record.atoms[index]:record.atoms[index].element;
const sortedUnique=values=>[...new Set(values)].sort(sortText);

function normalizedCounts(side){
  const counts=new Map();
  for(const row of side??[]){
    const species=typeof row==='string'?row:row.species,count=typeof row==='string'?1:(row.count??1);
    if(typeof species!=='string'||!species||!Number.isInteger(count)||count<1)throw new Error('invalid-transformation-side');
    counts.set(species,(counts.get(species)??0)+count);
  }
  return[...counts].sort(([a],[b])=>sortText(a,b));
}
const encodeSide=side=>normalizedCounts(side).map(([species,count])=>`${count}*${species}`).join('+');
export const canonicalSpeciesMultisetKey=species=>encodeSide(species);

// Species order and multiplicity are canonical; the arrow is intentionally directional.
export function directionalTransformationSignature(reactants,products){
  return`${encodeSide(reactants)}=>${encodeSide(products)}`;
}

export function enumerateUnorderedSpeciesPairs(records){
  const species=records.map(record=>record.id).sort(sortText),pairs=[];
  for(let left=0;left<species.length;left++)for(let right=left;right<species.length;right++)pairs.push([species[left],species[right]]);
  return pairs;
}

export function independentEncounterAuthority(reactions,families){
  const familyById=new Map(families.map(family=>[family.id,family])),bySignature=new Map();
  for(const reaction of reactions){
    const family=familyById.get(reaction.familyId);
    const encounter=reaction.reactants.filter(row=>family.roles[row.role].participation==='encounter').map(row=>row.species);
    const key=encodeSide(encounter);
    bySignature.set(key,[...(bySignature.get(key)??[]),reaction]);
  }
  for(const rows of bySignature.values())rows.sort((a,b)=>sortText(a.id,b.id));
  return bySignature;
}

function transformedRoleGraph(family,roleSpecies,bindings,recordsById){
  const atoms=[],bonds=[];
  for(const role of Object.keys(roleSpecies).sort(sortText)){
    const record=recordsById.get(roleSpecies[role]);
    record.atoms.forEach((_,index)=>atoms.push({id:`${role}:${index}`,role,sourceAtomIndex:index,species:record.id,element:atomElement(record,index),formalCharge:formalChargeForRecordAtom(record,index)}));
    for(const sourceBond of record.bonds){const bond=normalizedBond(sourceBond);bonds.push({a:`${role}:${bond.a}`,b:`${role}:${bond.b}`,order:bond.order});}
  }
  const outputAtoms=atoms.map(atom=>({...atom})),outputBonds=bonds.map(bond=>({...bond})),atomById=new Map(outputAtoms.map(atom=>[atom.id,atom]));
  const resolve=ref=>{const split=ref.indexOf('.'),role=ref.slice(0,split),label=ref.slice(split+1),index=bindings[role]?.[label];if(!Number.isInteger(index))throw new Error(`unbound-structural-edit:${ref}`);return`${role}:${index}`;};
  const edgeIndex=(a,b)=>outputBonds.findIndex(row=>row.a===a&&row.b===b||row.a===b&&row.b===a);
  for(const edit of family.edits??[]){
    const a=resolve(edit.a),atomA=atomById.get(a);if(!atomA)throw new Error(`unknown-structural-atom:${a}`);
    if(edit.op==='changeFormalCharge'){
      if(atomA.formalCharge!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}`);
      atomA.formalCharge=edit.to;continue;
    }
    const b=resolve(edit.b),index=edgeIndex(a,b);
    if(edit.op==='breakBond'){
      if(index<0||outputBonds[index].order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      outputBonds.splice(index,1);
    }else if(edit.op==='formBond'){
      if(edit.from!=='absent'||index>=0)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      outputBonds.push({a,b,order:edit.order});
    }else if(edit.op==='changeBondOrder'){
      if(index<0||outputBonds[index].order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);
      outputBonds[index].order=edit.to;
    }else throw new Error(`unsupported-structural-edit:${edit.op}`);
  }
  const sourceElementCounts=new Map(),outputElementCounts=new Map();
  for(const atom of atoms)sourceElementCounts.set(atom.element,(sourceElementCounts.get(atom.element)??0)+1);
  for(const atom of outputAtoms)outputElementCounts.set(atom.element,(outputElementCounts.get(atom.element)??0)+1);
  const sourceCharge=atoms.reduce((sum,atom)=>sum+atom.formalCharge,0),outputCharge=outputAtoms.reduce((sum,atom)=>sum+atom.formalCharge,0);
  if(JSON.stringify([...sourceElementCounts].sort(([a],[b])=>sortText(a,b)))!==JSON.stringify([...outputElementCounts].sort(([a],[b])=>sortText(a,b)))||sourceCharge!==outputCharge)return{closed:false,reason:'nonconserving-graph-edit'};
  const adjacency=new Map(outputAtoms.map(atom=>[atom.id,[]]));
  for(const bond of outputBonds){adjacency.get(bond.a).push(bond.b);adjacency.get(bond.b).push(bond.a);}
  const seen=new Set(),components=[];
  for(const atom of outputAtoms){
    if(seen.has(atom.id))continue;
    const queue=[atom.id],ids=[];
    for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor];if(seen.has(id))continue;seen.add(id);ids.push(id);queue.push(...adjacency.get(id));}
    const idSet=new Set(ids),graph={atoms:outputAtoms.filter(row=>idSet.has(row.id)),bonds:outputBonds.filter(row=>idSet.has(row.a)&&idSet.has(row.b))};
    const product=matchDatabaseProduct(graph,[...recordsById.values()]);
    if(!product)return{closed:false,reason:'component-not-in-db'};
    components.push(product.id);
  }
  return{closed:true,products:components};
}

export function generateStructuralExposureAudit(records,{patterns,families,reactions}){
  const recordsById=new Map(records.map(record=>[record.id,record])),patternById=new Map(patterns.map(pattern=>[pattern.id,pattern]));
  const matchesBySpeciesPattern=new Map();let positivePatternSpeciesHits=0,labelledSiteMatches=0;
  for(const pattern of patterns)for(const record of records){
    const matches=matchReactionSitePattern(record,pattern);
    if(!matches.length)continue;
    matchesBySpeciesPattern.set(`${record.id}\u0000${pattern.id}`,matches);positivePatternSpeciesHits++;labelledSiteMatches+=matches.length;
  }
  const realizations=[],familyRoleAssignments=0;
  let familyRoleAssignmentCount=familyRoleAssignments,labelledStructuralRealizations=0,dbClosedLabelledRealizations=0;
  for(const family of families){
    const roleRows=Object.entries(family.roles).sort(([a],[b])=>sortText(a,b));
    const speciesOptions=roleRows.map(([role,definition])=>{
      const ids=sortedUnique((definition.patterns??[]).flatMap(patternId=>records.filter(record=>matchesBySpeciesPattern.has(`${record.id}\u0000${patternId}`)).map(record=>record.id)));
      return[role,ids];
    });
    let tuples=[{}];
    for(const [role,ids] of speciesOptions)tuples=tuples.flatMap(tuple=>ids.map(species=>({...tuple,[role]:species})));
    familyRoleAssignmentCount+=tuples.length;
    for(const roleSpecies of tuples){
      let bindingsOptions=[{}];
      for(const [role,definition] of roleRows){
        const options=(definition.patterns??[]).flatMap(patternId=>(matchesBySpeciesPattern.get(`${roleSpecies[role]}\u0000${patternId}`)??[]).map(bindings=>({patternId,bindings})));
        bindingsOptions=bindingsOptions.flatMap(previous=>options.map(option=>({...previous,[role]:option})));
      }
      for(const optionRows of bindingsOptions){
        labelledStructuralRealizations++;
        const bindings=Object.fromEntries(Object.entries(optionRows).map(([role,value])=>[role,value.bindings]));
        const result=transformedRoleGraph(family,roleSpecies,bindings,recordsById);
        if(!result.closed)continue;
        dbClosedLabelledRealizations++;
        const reactants=Object.values(roleSpecies),signature=directionalTransformationSignature(reactants,result.products);
        const identity=directionalTransformationSignature(reactants,reactants)===signature;
        realizations.push({signature,familyId:family.id,roleSpecies:{...roleSpecies},matchedPatterns:Object.fromEntries(Object.entries(optionRows).map(([role,value])=>[role,value.patternId])),bindings,products:[...result.products]});
      }
    }
  }
  const productionSignatures=new Set(reactions.map(reaction=>directionalTransformationSignature(reaction.reactants.map(row=>row.species),reaction.products)));
  const uniqueDbClosed=new Map();
  for(const row of realizations)if(!uniqueDbClosed.has(row.signature))uniqueDbClosed.set(row.signature,row);
  const netIdentities=[...uniqueDbClosed.values()].filter(row=>{
    const [reactants,products]=row.signature.split('=>');return reactants===products;
  });
  const nonproductionNonidentity=[...uniqueDbClosed.values()].filter(row=>!productionSignatures.has(row.signature)&&!netIdentities.includes(row));
  return{
    summary:{positivePatternSpeciesHits,labelledSiteMatches,familyRoleAssignments:familyRoleAssignmentCount,labelledStructuralRealizations,dbClosedLabelledRealizations,uniqueDbClosedSignatures:uniqueDbClosed.size,netIdentitySignatures:netIdentities.length,productionNetSignatures:productionSignatures.size,nonproductionNonidentitySignatures:nonproductionNonidentity.length},
    realizations,
    uniqueDbClosedSignatures:[...uniqueDbClosed.values()].sort((a,b)=>sortText(a.signature,b.signature)),
    productionSignatures,
    nonproductionNonidentity:nonproductionNonidentity.sort((a,b)=>sortText(a.signature,b.signature)),
    patternsById:patternById,
  };
}

export function deterministicAtomPermutation(record,kind){
  const count=record.atoms.length,order=Array.from({length:count},(_,index)=>index);
  if(kind==='reverse')order.reverse();
  else if(kind==='cyclic'&&count>1){const shift=1;order.splice(0,count,...order.slice(shift),...order.slice(0,shift));}
  else if(kind==='id-shuffle'){
    let seed=2166136261;for(const char of record.id)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
    for(let index=count-1;index>0;index--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const target=seed%(index+1);[order[index],order[target]]=[order[target],order[index]];}
  }else if(kind!=='reverse'&&kind!=='cyclic')throw new Error(`unknown-atom-permutation:${kind}`);
  return order;
}

export function permuteMoleculeRecord(record,newIndexToOldIndex){
  const count=record.atoms.length;
  if(newIndexToOldIndex.length!==count||new Set(newIndexToOldIndex).size!==count||newIndexToOldIndex.some(index=>!Number.isInteger(index)||index<0||index>=count))throw new Error('invalid-atom-permutation');
  const oldToNew=Array(count);newIndexToOldIndex.forEach((oldIndex,newIndex)=>oldToNew[oldIndex]=newIndex);
  const permuteArray=value=>Array.isArray(value)&&value.length===count?newIndexToOldIndex.map(oldIndex=>value[oldIndex]):value;
  const clone={...record,atoms:newIndexToOldIndex.map(oldIndex=>typeof record.atoms[oldIndex]==='object'?{...record.atoms[oldIndex]}:record.atoms[oldIndex]),bonds:record.bonds.map(source=>{const bond=normalizedBond(source),a=oldToNew[bond.a],b=oldToNew[bond.b];return[a,b,bond.order];})};
  if(record.formalCharges){clone.formalCharges=Object.fromEntries(Object.entries(record.formalCharges).map(([oldIndex,charge])=>[String(oldToNew[Number(oldIndex)]),charge]).sort(([a],[b])=>Number(a)-Number(b)));}
  if(record.nonbonded){
    const nonbonded={...record.nonbonded};
    for(const field of ['atomicChargesE','sigmaAngstrom','epsilonKcalMol','vdwParameterIds'])if(Array.isArray(nonbonded[field]))nonbonded[field]=permuteArray(nonbonded[field]);
    nonbonded.atomMap=Array.from({length:count},(_,index)=>index);
    nonbonded.virtualChargeSites=(nonbonded.virtualChargeSites??[]).map(site=>{
      if(Number.isInteger(site.atom))return{...site,atom:oldToNew[site.atom]};
      if(Number.isInteger(site.atomIndex))return{...site,atomIndex:oldToNew[site.atomIndex]};
      return{...site};
    });
    clone.nonbonded=nonbonded;
  }
  return clone;
}

function normalizedIndex(species,index,indexMaps){return indexMaps?.get(species)?.[index]??index;}
function normalizeAtomRef(ref,roleIndexMaps){
  const split=ref.indexOf(':'),role=ref.slice(0,split),index=Number(ref.slice(split+1)),inverse=roleIndexMaps?.get(role);
  return`${role}:${inverse?.[index]??index}`;
}

export function semanticPathwayFingerprint(pathway,{atomIndexMaps=new Map()}={}){
  const roleSpecies=Object.fromEntries(Object.entries(pathway.roleSpecies).sort(([a],[b])=>sortText(a,b)));
  const roleIndexMaps=new Map(Object.entries(roleSpecies).map(([role,species])=>[role,atomIndexMaps.get(species)]));
  const normalizedBindings=Object.fromEntries(Object.entries(pathway.bindings).sort(([a],[b])=>sortText(a,b)).map(([role,binding])=>[
    role,Object.fromEntries(Object.entries(binding).sort(([a],[b])=>sortText(a,b)).map(([label,index])=>[label,normalizedIndex(roleSpecies[role],index,atomIndexMaps)])),
  ]));
  const transition=pathway.graphTransition;
  const atoms=rows=>rows.map(atom=>({role:atom.role??atom.id.slice(0,atom.id.indexOf(':')),index:normalizedIndex(atom.species??roleSpecies[atom.role??atom.id.slice(0,atom.id.indexOf(':'))],atom.sourceAtomIndex??Number(atom.id.slice(atom.id.indexOf(':')+1)),atomIndexMaps),element:atom.element,formalCharge:atom.formalCharge})).sort((a,b)=>sortText(`${a.role}:${a.index}`,`${b.role}:${b.index}`));
  const bonds=rows=>rows.map(bond=>[normalizeAtomRef(bond.a,roleIndexMaps),normalizeAtomRef(bond.b,roleIndexMaps)].sort(sortText).concat(bond.order)).sort((a,b)=>sortText(a.join('|'),b.join('|')));
  const normalizedPair=(a,b)=>[normalizeAtomRef(a,roleIndexMaps),normalizeAtomRef(b,roleIndexMaps)].sort(sortText);
  const productGraphs=transition.productGraphs.map(graph=>({
    species:graph.record.id,atoms:atoms(graph.atoms),bonds:bonds(graph.bonds),
  })).sort((a,b)=>sortText(`${a.species}|${JSON.stringify(a.atoms)}|${JSON.stringify(a.bonds)}`,`${b.species}|${JSON.stringify(b.atoms)}|${JSON.stringify(b.bonds)}`));
  const graphTransition={
    reactantAtoms:atoms(transition.reactantGraph.atoms),reactantBonds:bonds(transition.reactantGraph.bonds),
    transformedAtoms:atoms(transition.transformedGraph.atoms),transformedBonds:bonds(transition.transformedGraph.bonds),
    productGraphs,
    brokenBonds:transition.brokenBonds.map(row=>({atoms:normalizedPair(row.a,row.b),from:row.from})).sort((a,b)=>sortText(`${a.atoms.join('|')}|${a.from}`,`${b.atoms.join('|')}|${b.from}`)),
    formedBonds:transition.formedBonds.map(row=>({atoms:normalizedPair(row.a,row.b),order:row.order})).sort((a,b)=>sortText(`${a.atoms.join('|')}|${a.order}`,`${b.atoms.join('|')}|${b.order}`)),
    bondOrderChanges:transition.bondOrderChanges.map(row=>({atoms:normalizedPair(row.a,row.b),from:row.from,to:row.to})).sort((a,b)=>sortText(`${a.atoms.join('|')}|${a.from}|${a.to}`,`${b.atoms.join('|')}|${b.from}|${b.to}`)),
    formalChargeChanges:transition.formalChargeChanges.map(row=>({atom:normalizeAtomRef(row.atom,roleIndexMaps),from:row.from,to:row.to})).sort((a,b)=>sortText(a.atom,b.atom)),
  };
  const environmentDomain=enumerateCanonicalReactionLabEnvironments().filter(({tokens})=>environmentMatches(pathway.reaction,tokens)).map(({tokens})=>[...tokens].sort(sortText));
  return JSON.stringify({
    reactionId:pathway.reaction.id,familyId:pathway.family.id,roleSpecies,rolePatterns:Object.fromEntries(Object.entries(pathway.matchedPatterns).sort(([a],[b])=>sortText(a,b))),
    roleBindings:normalizedBindings,participation:Object.fromEntries(Object.entries(pathway.family.roles).map(([role,definition])=>[role,definition.participation]).sort(([a],[b])=>sortText(a,b))),
    geometry:pathway.geometryConstraints.map(constraint=>({from:{role:constraint.from.role,label:constraint.from.label,index:normalizedIndex(roleSpecies[constraint.from.role],constraint.from.atomIndex,atomIndexMaps)},to:{role:constraint.to.role,label:constraint.to.label,index:normalizedIndex(roleSpecies[constraint.to.role],constraint.to.atomIndex,atomIndexMaps)},min:constraint.min,target:constraint.target,max:constraint.max,referenceSigmaAngstrom:constraint.referenceSigmaAngstrom})),
    graphTransition,orderedProducts:pathway.reaction.products,environmentDomain,
  });
}

export function compareSymmetryMetrics(pathways){
  const byReaction=new Map();for(const pathway of pathways){if(!byReaction.has(pathway.reaction.id))byReaction.set(pathway.reaction.id,[]);byReaction.get(pathway.reaction.id).push(pathway);}
  return[...byReaction].map(([reactionId,rows])=>{
    const classSizes=new Map();for(const row of rows)classSizes.set(row.symmetryClassId,(classSizes.get(row.symmetryClassId)??0)+1);
    return{reactionId,labelledPathwayCount:rows.length,symmetryClassCount:classSizes.size,symmetryClassCardinalities:[...classSizes.values()].sort((a,b)=>a-b)};
  }).sort((a,b)=>sortText(a.reactionId,b.reactionId));
}

export function traceAllProductionPathways(records,compiled,{reactions,families}){
  const familyById=new Map(families.map(family=>[family.id,family])),traces=[];
  for(const pathway of compiled.pathways){
    const reaction=pathway.reaction,family=familyById.get(reaction.familyId),encounterRows=reaction.reactants.filter(row=>family.roles[row.role].participation==='encounter').sort((a,b)=>sortText(a.role,b.role));
    const runtimeInstances=reaction.reactants.map(row=>({id:`${reaction.id}:${row.role}`,species:row.species,busy:false}));
    const pair=encounterRows.map(row=>({species:row.species,id:`${reaction.id}:${row.role}`}));
    const candidates=reactionCandidates(pair,compiled),candidate=candidates.find(row=>row.reactionId===reaction.id&&row.pathwayId===pathway.pathwayId);
    if(!candidate){traces.push({ok:false,pathway,reason:'candidate-not-found'});continue;}
    const supplemental=resolveSupplementalParticipants(reaction,candidate,runtimeInstances,()=>0);
    if(!supplemental.ok){traces.push({ok:false,pathway,reason:supplemental.reason});continue;}
    const environment=enumerateCanonicalReactionLabEnvironments().find(({tokens})=>environmentMatches(reaction,tokens));
    const execution=planReactionExecution({...candidate,...supplemental,environmentConditions:environment.tokens,environmentSnapshot:environment.snapshot},records);
    if(!execution.ok){traces.push({ok:false,pathway,reason:execution.reason});continue;}
    const geometry=scoreReactionGeometry(candidate.geometryConstraints,(role,index)=>{
      const constraint=candidate.geometryConstraints.find(row=>row.from.role===role&&row.from.atomIndex===index||row.to.role===role&&row.to.atomIndex===index);
      if(!constraint)return[0,0,0];return role===constraint.from.role&&index===constraint.from.atomIndex?[0,0,0]:[constraint.target,0,0];
    });
    const arbitration=arbitrateReactionCandidates([{...candidate,geometryQuality:{worstNormalizedDeviation:geometry.worstNormalizedDeviation,meanNormalizedDeviation:geometry.meanNormalizedDeviation}}]);
    traces.push({ok:execution.ok&&geometry.geometryReady&&geometry.worstNormalizedDeviation===0&&Boolean(arbitration.selected),pathway,candidate,execution,geometry,arbitration,environment});
  }
  return traces;
}

export function deterministicIdShuffle(seedValue){
  let seed=2166136261;for(const char of seedValue)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
  return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
}

export function auditSummary({records,reactions,patterns,families,compiled,admission,structural,resolutions,polymerRoutes=[],pathTraces=[],environmentPairCases,eligibleCases}){
  const productionSpecies=new Set(reactions.flatMap(row=>[...row.reactants.map(item=>item.species),...row.products]));
  const blockedSpecies=new Set(admission.blockedSpeciesProbes),dbSpecies=new Set(records.map(record=>record.id));
  const playableIds=new Set(admission.playableReactions),reactionIds=new Set(reactions.map(row=>row.id));
  const polymerIds=new Set(admission.excludedPolymerRoutes),generatedPolymerIds=new Set(polymerRoutes.map(row=>row.id));
  const blockedSignatures=admission.blockedTransformations.map(row=>directionalTransformationSignature(row.reactants,row.products));
  const validBlockers=new Set(REACTION_BLOCKER_CODES);
  const playableSignatures=new Set(reactions.map(row=>directionalTransformationSignature(row.reactants.map(item=>item.species),row.products)));
  const exposureRows=resolutions?.entries??[],resolvedSignatures=new Set(exposureRows.map(row=>row.signature));
  const generatedSignatures=new Set(structural.nonproductionNonidentity.map(row=>row.signature));
  const unresolved=[...generatedSignatures].filter(signature=>!resolvedSignatures.has(signature)).length;
  const stale=exposureRows.filter(row=>!generatedSignatures.has(row.signature)).length;
  const duplicateResolutions=exposureRows.length-resolvedSignatures.size;
  const unownedSpecies=[...dbSpecies].filter(id=>!productionSpecies.has(id)&&!blockedSpecies.has(id)).length;
  const speciesOverlap=[...blockedSpecies].filter(id=>productionSpecies.has(id)).length;
  const blockedSpeciesAnomalies=admission.blockedSpeciesProbes.length-blockedSpecies.size+[...blockedSpecies].filter(id=>!dbSpecies.has(id)).length;
  const missingPlayable=[...reactionIds].filter(id=>!playableIds.has(id)).length+[...playableIds].filter(id=>!reactionIds.has(id)).length;
  const playableAnomalies=admission.playableReactions.length-playableIds.size;
  const blockedTransformationAnomalies=admission.blockedTransformations.length-new Set(blockedSignatures).size+admission.blockedTransformations.filter(row=>!row.blockers?.length||row.blockers.some(code=>!validBlockers.has(code))).length;
  const blockedCollisions=blockedSignatures.filter(signature=>playableSignatures.has(signature)).length;
  const polymerDelta=[...polymerIds].filter(id=>!generatedPolymerIds.has(id)).length+[...generatedPolymerIds].filter(id=>!polymerIds.has(id)).length;
  const polymerDuplicates=admission.excludedPolymerRoutes.length-polymerIds.size;
  const unclassified=unownedSpecies+speciesOverlap+blockedSpeciesAnomalies+missingPlayable+playableAnomalies+blockedTransformationAnomalies+blockedCollisions+polymerDelta+polymerDuplicates+unresolved+stale+duplicateResolutions;
  const positiveTraces=pathTraces;
  return{
    moleculeDb:{species:records.length,productionSideSpecies:productionSpecies.size,blockedOnlySpecies:blockedSpecies.size,unownedSpecies},
    productionAuthority:{sitePatterns:patterns.length,reactionFamilies:families.length,reactions:reactions.length,labelledPathways:compiled.pathways.length,symmetryClasses:new Set(compiled.pathways.map(row=>row.symmetryClassId)).size,uniqueNetTransformations:new Set(reactions.map(row=>directionalTransformationSignature(row.reactants.map(item=>item.species),row.products))).size},
    chemicalCandidateAuthority:{playable:playableIds.size,blockedSpeciesProbes:blockedSpecies.size,blockedTransformations:blockedSignatures.length,excludedPolymerRoutes:polymerIds.size,total:playableIds.size+blockedSpecies.size+blockedSignatures.length+polymerIds.size,unclassified},
    structuralExposure:{...structural.summary,unresolved,staleResolutions:stale,duplicateResolutions},
    runtimeExhaustive:{unorderedSpeciesPairs:enumerateUnorderedSpeciesPairs(records).length,productionEncounterSignatures:independentEncounterAuthority(reactions,families).size,negativePairSignatures:enumerateUnorderedSpeciesPairs(records).length-independentEncounterAuthority(reactions,families).size,pairEnvironmentCases:environmentPairCases,eligibleCases,negativeEligibilityCases:environmentPairCases-eligibleCases},
    positivePathways:{traces:positiveTraces.length,failures:positiveTraces.filter(row=>!row.ok).length},
  };
}
