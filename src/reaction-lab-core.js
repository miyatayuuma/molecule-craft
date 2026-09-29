// Compiled structural reaction authority. This module has no Three.js or
// viewer dependency; catalog work happens once at startup, never per frame.
import { formalChargeForRecordAtom, molecularAromaticAtomIds } from './chemistry.js?v=23';
import { canonicalNonbondedPairGeometry } from './reaction-lab-stage-a.js?v=4';
import { enumerateSubgraphMappings } from './subgraph-matcher.js?v=1';
import { REACTION_LAB_ENVIRONMENT_TOKENS, enumerateCanonicalReactionLabEnvironments, environmentTokensFromSnapshot, reactionLabEnvironmentStateFromTokens, validateNormalizedEnvironmentTokens, snapshotReactionLabEnvironment } from './reaction-lab-environment.js?v=1';
import { REACTION_SITE_PATTERNS, REACTION_FAMILIES } from './reaction-lab-authority.js?v=1';
import { REACTION_CATALOG } from './reaction-lab-catalog.js?v=1';
export { REACTION_SITE_PATTERNS, REACTION_FAMILIES };
export { REACTION_CATALOG };

export const REACTION_LAB_SLOT_COUNT = 3;
// User-driven Stage B trajectories retain safe acyl-transfer geometry for
// roughly 2–5 observed 120 Hz steps, so require two complete simulation-time
// intervals after the first eligible fixed step.
export const CONTACT_DWELL_MS = 1000/60;
export const MAX_REACTION_PATTERN_MATCHES = 10000;

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

const atomElement=(record,index)=>typeof record.atoms[index]==='string'?record.atoms[index]:record.atoms[index].element;
const atomCharge=formalChargeForRecordAtom;
const normalizedBond=(bond)=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond;
const edgeKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const refParts=ref=>{const split=ref.indexOf('.');return split>0?[ref.slice(0,split),ref.slice(split+1)]:[];};
const sorted=(values)=>[...values].sort((a,b)=>String(a).localeCompare(String(b)));
const multiset=(values)=>{const map=new Map();for(const value of values)map.set(value,(map.get(value)??0)+1);return map;};
const mapsEqual=(a,b)=>a.size===b.size&&[...a].every(([key,value])=>b.get(key)===value);
function assertOnlyFields(value,allowed,error){for(const key of Object.keys(value??{}))if(!allowed.includes(key))throw new Error(error);}

function graphIndex(record) {
  const atoms=record.atoms.map((_,id)=>({id,element:atomElement(record,id),formalCharge:atomCharge(record,id)}));
  const bonds=record.bonds.map(normalizedBond),adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const bond of bonds){adjacency.get(bond.a).push({id:bond.b,order:bond.order});adjacency.get(bond.b).push({id:bond.a,order:bond.order});}
  const aromatic=molecularAromaticAtomIds(atoms,bonds);
  return{atoms,bonds,adjacency,aromatic};
}

function validatePattern(pattern) {
  if(!pattern?.id||!Array.isArray(pattern.atoms)||!pattern.atoms.length||!Array.isArray(pattern.bonds))throw new Error('invalid-reaction-site-pattern');
  assertOnlyFields(pattern,['id','atoms','bonds'],'unsupported-reaction-pattern-field');
  const labels=new Set();
  for(const atom of pattern.atoms){
    assertOnlyFields(atom,['label','element','degree','formalCharge','aromatic','neighborCounts'],'unsupported-reaction-atom-constraint');
    if(!atom.label||labels.has(atom.label)||!atom.element)throw new Error(`invalid-pattern-label:${pattern.id}`);
    labels.add(atom.label);
    if(atom.degree!=null&&(!Number.isInteger(atom.degree)||atom.degree<0))throw new Error(`invalid-pattern-degree:${pattern.id}`);
    if(atom.formalCharge!=null&&!Number.isFinite(atom.formalCharge))throw new Error(`invalid-pattern-charge:${pattern.id}`);
    if(atom.aromatic!=null&&typeof atom.aromatic!=='boolean')throw new Error(`invalid-pattern-aromatic:${pattern.id}`);
    for(const [element,count] of Object.entries(atom.neighborCounts??{})){
      const validExact=Number.isInteger(count)&&count>=0;
      const validRange=count&&typeof count==='object'&&!Array.isArray(count)&&Object.keys(count).every(key=>['min','max'].includes(key))&&Number.isInteger(count.min??0)&&(count.min??0)>=0&&(count.max==null||(Number.isInteger(count.max)&&count.max>=(count.min??0)));
      if(!element||(!validExact&&!validRange))throw new Error(`invalid-pattern-neighbor-count:${pattern.id}`);
    }
  }
  const adjacency=new Map([...labels].map(label=>[label,[]]));
  const bondKeys=new Set();
  for(const [a,b,order] of pattern.bonds){
    const key=[a,b].sort().join('|');if(!labels.has(a)||!labels.has(b)||a===b||![1,2,3].includes(order)||bondKeys.has(key))throw new Error(`invalid-pattern-bond:${pattern.id}`);bondKeys.add(key);
    adjacency.get(a).push(b);adjacency.get(b).push(a);
  }
  const visited=new Set(),queue=[pattern.atoms[0].label];
  for(let index=0;index<queue.length;index++){const label=queue[index];if(visited.has(label))continue;visited.add(label);queue.push(...adjacency.get(label));}
  if(visited.size!==labels.size)throw new Error(`disconnected-reaction-pattern:${pattern.id}`);
  return pattern;
}

function matchPattern(record,pattern,{limit=MAX_REACTION_PATTERN_MATCHES}={}) {
  const graph=graphIndex(record),specs=pattern.atoms,edgeRows=pattern.bonds.map(([a,b,order])=>({a,b,order}));
  const candidates=new Map(specs.map(spec=>[spec.label,graph.atoms.filter(graphAtom=>{
    const ns=graph.adjacency.get(graphAtom.id),elementCounts=multiset(ns.map(neighbor=>graph.atoms[neighbor.id].element));
    if(spec.element!==undefined&&spec.element!==graphAtom.element)return false;
    if(spec.degree!=null&&ns.length!==spec.degree)return false;
    if(spec.formalCharge!=null&&spec.formalCharge!==graphAtom.formalCharge)return false;
    if(spec.aromatic!=null&&spec.aromatic!==graph.aromatic.has(graphAtom.id))return false;
    return Object.entries(spec.neighborCounts??{}).every(([element,count])=>typeof count==='number'?(elementCounts.get(element)??0)===count:(elementCounts.get(element)??0)>=(count.min??0)&&(count.max==null||(elementCounts.get(element)??0)<=count.max));
  }).map(graphAtom=>graphAtom.id)]));
  if([...candidates.values()].some(list=>!list.length))return[];
  const matches=enumerateSubgraphMappings({labels:specs.map(spec=>spec.label),candidates,edges:edgeRows,adjacency:graph.adjacency,limit});
  return matches.sort((a,b)=>bindingKey(a).localeCompare(bindingKey(b)));
}
const bindingKey=binding=>Object.entries(binding??{}).sort(([a],[b])=>a.localeCompare(b)).map(([label,id])=>`${label}=${id}`).join(',');
export function matchReactionSitePattern(record,pattern,{limit=MAX_REACTION_PATTERN_MATCHES}={}){
  return matchPattern(record,validatePattern(pattern),{limit});
}

function validateEnvironment(reaction) {
  const requires=reaction.requires??[],forbids=reaction.forbids??[];
  const validList=items=>Array.isArray(items)&&items.every(token=>typeof token==='string'&&REACTION_LAB_ENVIRONMENT_TOKENS.includes(token))&&new Set(items).size===items.length;
  if(!validList(requires)||!validList(forbids)||requires.some(token=>forbids.includes(token))||requires.includes('acidic')&&requires.includes('basic'))throw new Error(`invalid-environment-condition:${reaction.id}`);
  if(!enumerateCanonicalReactionLabEnvironments().some(({tokens})=>environmentMatches(reaction,tokens)))throw new Error(`unsatisfiable-environment-condition:${reaction.id}`);
}
export function environmentMatches(reaction,environment=new Set()) {
  const values=environment??[];validateNormalizedEnvironmentTokens(values);const active=values instanceof Set?values:new Set(values);
  return(reaction.requires??[]).every(token=>active.has(token))&&!(reaction.forbids??[]).some(token=>active.has(token));
}
export function environmentsOverlap(a,b) {
  return enumerateCanonicalReactionLabEnvironments().some(({tokens})=>environmentMatches(a,tokens)&&environmentMatches(b,tokens));
}

function sourceGraphForReaction(reaction,records,bindings={}) {
  const byId=new Map(records.map(record=>[record.id,record])),atoms=[],bonds=[];
  for(const participant of reaction.reactants){
    const record=byId.get(participant.species);if(!record)throw new Error(`unknown-reactant-species:${participant.species}`);
    record.atoms.forEach((_,index)=>atoms.push({id:`${participant.role}:${index}`,role:participant.role,sourceAtomIndex:index,element:atomElement(record,index),formalCharge:atomCharge(record,index),species:record.id}));
    for(const bond of record.bonds.map(normalizedBond))bonds.push({a:`${participant.role}:${bond.a}`,b:`${participant.role}:${bond.b}`,order:bond.order});
  }
  return{atoms,bonds,bindings};
}
function resolveRef(ref,bindings){
  const[role,label]=refParts(ref);if(!role||!label||!Number.isInteger(bindings?.[role]?.[label]))throw new Error(`unbound-graph-edit-reference:${ref}`);
  return`${role}:${bindings[role][label]}`;
}
function connectedComponents(atoms,bonds){
  const adjacency=new Map(atoms.map(atom=>[atom.id,[]]));for(const bond of bonds){adjacency.get(bond.a)?.push(bond.b);adjacency.get(bond.b)?.push(bond.a);}
  const seen=new Set(),components=[];
  for(const atom of atoms){if(seen.has(atom.id))continue;const ids=[],queue=[atom.id];for(let cursor=0;cursor<queue.length;cursor++){const id=queue[cursor];if(seen.has(id))continue;seen.add(id);ids.push(id);queue.push(...adjacency.get(id));}const set=new Set(ids);components.push({atoms:atoms.filter(item=>set.has(item.id)).sort((a,b)=>a.id.localeCompare(b.id)),bonds:bonds.filter(bond=>set.has(bond.a)&&set.has(bond.b)).sort((a,b)=>edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)))});}
  return components.sort((a,b)=>a.atoms[0].id.localeCompare(b.atoms[0].id));
}
function strictProductMappings(graph,record){
  if(graph.atoms.length!==record.atoms.length||graph.bonds.length!==record.bonds.length)return[];
  const target=graphIndex(record),sourceAdj=new Map(graph.atoms.map(atom=>[atom.id,[]]));
  for(const bond of graph.bonds){sourceAdj.get(bond.a).push({id:bond.b,order:bond.order});sourceAdj.get(bond.b).push({id:bond.a,order:bond.order});}
  const sourceAromatic=molecularAromaticAtomIds(graph.atoms,graph.bonds);
  const candidates=new Map(graph.atoms.map(atom=>[atom.id,target.atoms.filter(candidate=>candidate.element===atom.element&&candidate.formalCharge===atom.formalCharge&&target.aromatic.has(candidate.id)===sourceAromatic.has(atom.id)&&target.adjacency.get(candidate.id).length===sourceAdj.get(atom.id).length).map(candidate=>candidate.id)]));
  if([...candidates.values()].some(list=>!list.length))return[];
  const order=graph.atoms.map(atom=>atom.id).sort((a,b)=>candidates.get(a).length-candidates.get(b).length||sourceAdj.get(b).length-sourceAdj.get(a).length||String(a).localeCompare(String(b)));
  const mapping=new Map(),used=new Set(),results=[];
  function search(depth){
    if(depth===order.length){results.push(new Map(mapping));return;}
    const sourceId=order[depth];for(const targetId of candidates.get(sourceId)){
      if(used.has(targetId))continue;
      if(!sourceAdj.get(sourceId).every(edge=>!mapping.has(edge.id)||target.adjacency.get(targetId).some(item=>item.id===mapping.get(edge.id)&&item.order===edge.order)))continue;
      mapping.set(sourceId,targetId);used.add(targetId);search(depth+1);mapping.delete(sourceId);used.delete(targetId);
    }
  }
  search(0);return results.sort((a,b)=>[...a].map(([key,value])=>`${key}=${value}`).join('|').localeCompare([...b].map(([key,value])=>`${key}=${value}`).join('|')));
}
function strictGraphMatch(graph,record){return strictProductMappings(graph,record)[0]??null;}

function transformPathway(pathway,records,{bindings=pathway.bindings??{}}={}){
  const reaction=pathway.reaction??pathway, family=pathway.family??null, source=sourceGraphForReaction(reaction,records,bindings),atoms=source.atoms.map(atom=>({...atom})),bonds=source.bonds.map(bond=>({...bond})),sourceBonds=new Map(source.bonds.map(bond=>[edgeKey(bond.a,bond.b),bond.order])),byAtom=new Map(atoms.map(atom=>[atom.id,atom]));
  for(const edit of family?.edits??pathway.edits??[]){
    const a=resolveRef(edit.a,bindings),atomA=byAtom.get(a);if(!atomA)throw new Error(`unknown-source-atom:${a}`);
    if(edit.op==='changeFormalCharge'){
      if(atomA.formalCharge!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}`);atomA.formalCharge=edit.to;continue;
    }
    const b=resolveRef(edit.b,bindings),atomB=byAtom.get(b);if(!atomB)throw new Error(`unknown-source-atom:${b}`);
    const key=edgeKey(a,b),bond=bonds.find(item=>edgeKey(item.a,item.b)===key);
    if(edit.op==='breakBond'){
      if(!bond||bond.order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);bonds.splice(bonds.indexOf(bond),1);
    }else if(edit.op==='formBond'){
      if(edit.from!=='absent'||bond)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);bonds.push({a,b,order:edit.order});
    }else if(edit.op==='changeBondOrder'){
      if(!bond||bond.order!==edit.from)throw new Error(`source-state-guard-failed:${edit.op}:${edit.a}:${edit.b}`);bond.order=edit.to;
    }else throw new Error(`unsupported-graph-edit:${edit.op}`);
  }
  bonds.sort((a,b)=>edgeKey(a.a,a.b).localeCompare(edgeKey(b.a,b.b)));
  if(atoms.length!==source.atoms.length||new Set(atoms.map(atom=>atom.id)).size!==source.atoms.length)throw new Error('atom-conservation-failed');
  const sourceElements=multiset(source.atoms.map(atom=>atom.element)),productElements=multiset(atoms.map(atom=>atom.element));
  const sourceCharge=source.atoms.reduce((sum,atom)=>sum+atom.formalCharge,0),transformedCharge=atoms.reduce((sum,atom)=>sum+atom.formalCharge,0);
  if(!mapsEqual(sourceElements,productElements))throw new Error('element-conservation-failed');
  if(sourceCharge!==transformedCharge)throw new Error('formal-charge-conservation-failed');
  const components=connectedComponents(atoms,bonds),expected= reaction.products.map(id=>records.find(record=>record.id===id));
  if(expected.some(record=>!record))throw new Error('product-not-in-database');
  if(components.length!==expected.length)throw new Error('product-component-count-mismatch');
  const assignments=new Array(expected.length),usedComponents=new Set();
  const slotOrder=expected.map((record,index)=>({record,index})).sort((a,b)=>a.record.id.localeCompare(b.record.id)||a.index-b.index);
  function assign(depth){
    if(depth===slotOrder.length)return true;
    const slot=slotOrder[depth];for(let componentIndex=0;componentIndex<components.length;componentIndex++){
      if(usedComponents.has(componentIndex))continue;const mapping=strictGraphMatch(components[componentIndex],slot.record);if(!mapping)continue;
      usedComponents.add(componentIndex);assignments[slot.index]={component:components[componentIndex],mapping,record:slot.record};if(assign(depth+1))return true;usedComponents.delete(componentIndex);assignments[slot.index]=null;
    }return false;
  }
  if(!assign(0))throw new Error(`product-graph-unmatched:${JSON.stringify({components:components.map(component=>({atoms:component.atoms.map(atom=>`${atom.element}:${atom.formalCharge}:${atom.id}`),bonds:component.bonds})),expected:expected.map(record=>({id:record.id,atoms:record.atoms.map((_,index)=>`${atomElement(record,index)}:${atomCharge(record,index)}`),bonds:record.bonds}))})}`);
  const productGraphs=assignments.map(({component,mapping,record})=>({record,atoms:component.atoms,bonds:component.bonds,sourceToProduct:Object.fromEntries([...mapping].sort(([a],[b])=>a.localeCompare(b)))}));
  const transformedEdges=new Map(bonds.map(bond=>[edgeKey(bond.a,bond.b),bond]));
  const brokenBonds=[],formedBonds=[],bondOrderChanges=[];
  for(const[sourceKey,sourceOrder]of sourceBonds){const current=transformedEdges.get(sourceKey);const[atomAId,atomBId]=sourceKey.split('|');if(!current)brokenBonds.push({a:atomAId,b:atomBId,from:sourceOrder});else if(current.order!==sourceOrder)bondOrderChanges.push({a:atomAId,b:atomBId,from:sourceOrder,to:current.order});}
  for(const bond of bonds)if(!sourceBonds.has(edgeKey(bond.a,bond.b)))formedBonds.push({...bond});
  const formalChargeChanges=atoms.filter(atom=>atom.formalCharge!==byAtom.get(atom.id)?.formalCharge||atom.formalCharge!==source.atoms.find(item=>item.id===atom.id)?.formalCharge).map(atom=>({atom:atom.id,from:source.atoms.find(item=>item.id===atom.id).formalCharge,to:atom.formalCharge}));
  return{ok:true,reactantGraph:source,transformedGraph:{atoms,bonds},productGraphs,brokenBonds,formedBonds,bondOrderChanges,formalChargeChanges};
}

function validateEditRefs(family,patternById){
  for(const edit of family.edits??[]){
    if(!['breakBond','formBond','changeBondOrder','changeFormalCharge'].includes(edit.op))throw new Error(`unsupported-graph-edit:${edit.op}`);
    const fields=edit.op==='changeFormalCharge'?['op','a','from','to']:edit.op==='breakBond'?['op','a','b','from']:edit.op==='formBond'?['op','a','b','from','order']:['op','a','b','from','to'];
    assertOnlyFields(edit,fields,'unsupported-reaction-graph-edit-field');
    for(const ref of [edit.a,...(edit.op==='changeFormalCharge'?[]:[edit.b])]){const[role,label]=refParts(ref),definition=family.roles?.[role];if(!role||!definition)throw new Error(`invalid-graph-edit-reference:${ref}`);const patternIds=definition.patterns??[];if(patternIds.length&&!patternIds.some(id=>patternById.get(id)?.atoms.some(atom=>atom.label===label)))throw new Error(`unknown-graph-edit-label:${ref}`);}
    if(edit.op==='breakBond'&&![1,2,3].includes(edit.from))throw new Error('invalid-break-bond-guard');
    if(edit.op==='formBond'&&(edit.from!=='absent'||![1,2,3].includes(edit.order)))throw new Error('invalid-form-bond-guard-or-order');
    if(['changeBondOrder'].includes(edit.op)&&(![1,2,3].includes(edit.from)||![1,2,3].includes(edit.to)||edit.from===edit.to))throw new Error('invalid-bond-order-change');
    if(edit.op==='changeFormalCharge'&&(!Number.isInteger(edit.from)||!Number.isInteger(edit.to)||edit.from===edit.to))throw new Error('invalid-formal-charge-change');
  }
}

function compatibleAutomorphism(record,from,to){
  const graph=graphIndex(record),atomById=new Map(graph.atoms.map(atom=>[atom.id,atom]));
  const candidates=new Map(graph.atoms.map(atom=>[atom.id,graph.atoms.filter(other=>other.element===atom.element&&other.formalCharge===atom.formalCharge&&graph.aromatic.has(atom.id)===graph.aromatic.has(other.id)&&graph.adjacency.get(atom.id).length===graph.adjacency.get(other.id).length).map(other=>other.id)]));
  const fixed=new Map();for(const[label,fromId]of Object.entries(from)){const toId=to[label];if(!Number.isInteger(fromId)||!Number.isInteger(toId))return false;fixed.set(fromId,toId);}
  const reverse=new Map();for(const[a,b]of fixed){if(reverse.has(b)&&reverse.get(b)!==a)return false;reverse.set(b,a);}
  const mapping=new Map(),used=new Set();for(const[a,b]of fixed){if(!candidates.get(a)?.includes(b))return false;mapping.set(a,b);used.add(b);}
  for(const[a,b]of fixed)if(!graph.adjacency.get(a).every(edge=>!mapping.has(edge.id)||graph.adjacency.get(b).some(other=>other.id===mapping.get(edge.id)&&other.order===edge.order)))return false;
  const order=graph.atoms.map(atom=>atom.id).filter(id=>!mapping.has(id)).sort((a,b)=>candidates.get(a).length-candidates.get(b).length||a-b);
  function search(depth){if(depth===order.length)return true;const a=order[depth];for(const b of candidates.get(a)){if(used.has(b))continue;if(!graph.adjacency.get(a).every(edge=>!mapping.has(edge.id)||graph.adjacency.get(b).some(other=>other.id===mapping.get(edge.id)&&other.order===edge.order)))continue;mapping.set(a,b);used.add(b);if(search(depth+1))return true;mapping.delete(a);used.delete(b);}return false;}
  return search(0);
}
function symmetryEquivalent(a,b,records){
  if(a.reaction.id!==b.reaction.id||a.roleSpeciesKey!==b.roleSpeciesKey)return false;
  const byId=new Map(records.map(record=>[record.id,record]));
  return a.reaction.reactants.every(participant=>compatibleAutomorphism(byId.get(participant.species),a.bindings[participant.role]??{},b.bindings[participant.role]??{}));
}

function compileDistanceConstraints(family,pathway,records){
  return(family.geometry?.constraints??[]).map(constraint=>{
    const fromRef=constraint.from,toRef=constraint.to,[fromRole,fromLabel]=refParts(fromRef),[toRole,toLabel]=refParts(toRef);
    const fromIndex=pathway.bindings[fromRole]?.[fromLabel],toIndex=pathway.bindings[toRole]?.[toLabel];
    const fromRecord=records.find(record=>record.id===pathway.roleSpecies[fromRole]),toRecord=records.find(record=>record.id===pathway.roleSpecies[toRole]);
    if(!Number.isInteger(fromIndex)||!Number.isInteger(toIndex)||!fromRecord||!toRecord)throw new Error(`invalid-geometry-reference:${fromRef}:${toRef}`);
    const geometry=canonicalNonbondedPairGeometry(
      {sigmaAngstrom:fromRecord.nonbonded?.sigmaAngstrom?.[fromIndex],epsilonKcalMol:fromRecord.nonbonded?.epsilonKcalMol?.[fromIndex]},
      {sigmaAngstrom:toRecord.nonbonded?.sigmaAngstrom?.[toIndex],epsilonKcalMol:toRecord.nonbonded?.epsilonKcalMol?.[toIndex]},
      0,
    );
    const sigma=geometry.sigmaPairAngstrom,min=constraint.minRatio*sigma,target=constraint.targetRatio*sigma,max=constraint.maxRatio*sigma;
    if(!(min<target&&target<max)||min<geometry.softCoreBoundaryAngstrom)throw new Error(`invalid-reaction-geometry-window:${family.id}`);
    return{from:{role:fromRole,label:fromLabel,atomIndex:fromIndex},to:{role:toRole,label:toLabel,atomIndex:toIndex},referenceSigmaAngstrom:sigma,min,target,max,minRatio:constraint.minRatio,targetRatio:constraint.targetRatio,maxRatio:constraint.maxRatio};
  });
}

function validateCatalogIds(patterns,families,reactions){
  for(const[items,label]of [[patterns,'pattern'],[families,'family'],[reactions,'reaction']]){const ids=items.map(item=>item.id);if(ids.some(id=>!id)||new Set(ids).size!==ids.length)throw new Error(`duplicate-or-missing-${label}-id`);}
  const patternById=new Map(patterns.map(pattern=>[pattern.id,validatePattern(pattern)])),familyById=new Map(families.map(family=>[family.id,family]));
  for(const family of families){
    assertOnlyFields(family,['id','roles','geometry','edits'],'unsupported-reaction-family-field');
    const roleRows=Object.entries(family.roles??{});if(roleRows.filter(([,role])=>role.participation==='encounter').length!==2)throw new Error(`invalid-encounter-role-count:${family.id}`);
    for(const[roleName,role]of roleRows){assertOnlyFields(role,['participation','patterns'],'unsupported-reaction-role-field');if(!['encounter','supplemental'].includes(role.participation)||!Array.isArray(role.patterns??[]))throw new Error(`invalid-family-role:${family.id}:${roleName}`);}
    if(!Array.isArray(family.geometry?.constraints)||!family.geometry.constraints.length)throw new Error(`missing-reaction-ready-geometry:${family.id}`);
    for(const[roleName,role]of roleRows)for(const patternId of role.patterns??[])if(!patternById.has(patternId))throw new Error(`unknown-pattern-reference:${family.id}:${roleName}:${patternId}`);
    for(const constraint of family.geometry.constraints){
      assertOnlyFields(constraint,['from','to','reference','minRatio','targetRatio','maxRatio'],'unsupported-reaction-geometry-field');
      if(constraint.reference!=='canonical-sigma'||![constraint.minRatio,constraint.targetRatio,constraint.maxRatio].every(Number.isFinite)||!(constraint.minRatio>0&&constraint.minRatio<constraint.targetRatio&&constraint.targetRatio<constraint.maxRatio))throw new Error(`invalid-family-geometry-window:${family.id}`);
      const[fromRole,fromLabel]=refParts(constraint.from),[toRole,toLabel]=refParts(constraint.to);
      if(!fromRole||!toRole||fromRole===toRole||family.roles[fromRole]?.participation!=='encounter'||family.roles[toRole]?.participation!=='encounter')throw new Error(`invalid-family-geometry-roles:${family.id}`);
      for(const ref of [constraint.from,constraint.to]){const[role,label]=refParts(ref);if(!family.roles[role]||!(family.roles[role].patterns??[]).some(patternId=>patternById.get(patternId).atoms.some(atom=>atom.label===label)))throw new Error(`invalid-family-geometry-reference:${family.id}:${ref}`);}
    }
    validateEditRefs(family,patternById);
  }
  for(const reaction of reactions){
    assertOnlyFields(reaction,['id','familyId','reactants','products','requires','forbids'],'unsupported-concrete-reaction-field');
    if(!familyById.has(reaction.familyId))throw new Error(`unknown-family-reference:${reaction.id}`);validateEnvironment(reaction);
    if(!Array.isArray(reaction.reactants)||!Array.isArray(reaction.products)||reaction.reactants.length<2||!reaction.products.length)throw new Error(`invalid-reaction-stoichiometry:${reaction.id}`);
    const family=familyById.get(reaction.familyId),roles=new Set(reaction.reactants.map(item=>item.role));
    if(roles.size!==reaction.reactants.length)throw new Error(`invalid-reaction-stoichiometry:${reaction.id}`);
    for(const participant of reaction.reactants){assertOnlyFields(participant,['role','species'],'unsupported-reactant-binding-field');if(!family.roles[participant.role])throw new Error(`unknown-reaction-role:${reaction.id}:${participant.role}`);if(!participant.species)throw new Error(`missing-reactant-species:${reaction.id}`);}
    for(const role of Object.keys(family.roles))if(!roles.has(role))throw new Error(`missing-reaction-role:${reaction.id}:${role}`);
  }
  return{patternById,familyById};
}

function chemistrySignature(pathway,records){
  const execution=transformPathway(pathway,records),graphs=execution.productGraphs.map(graph=>({id:graph.record.id,atoms:graph.atoms.map(atom=>`${atom.element}:${atom.formalCharge}`).sort(),bonds:graph.bonds.map(bond=>`${bond.a}>${bond.b}:${bond.order}`).sort()}));
  return JSON.stringify({products:sorted(graphs.map(graph=>graph.id)),graphs:graphs.sort((a,b)=>a.id.localeCompare(b.id)),edits:pathway.family.edits});
}
function concreteReactantKey(pathway){return sorted(pathway.reaction.reactants.map(item=>`${pathway.family.roles[item.role].participation}:${item.species}`)).join('|');}
function anchorKey(pathway){return pathway.geometryConstraints.map(constraint=>[
  `${pathway.roleSpecies[constraint.from.role]}:${constraint.from.atomIndex}`,
  `${pathway.roleSpecies[constraint.to.role]}:${constraint.to.atomIndex}`,
].sort().join('~')).sort().join('|');}

export function compileReactionCatalog(records,{patterns=REACTION_SITE_PATTERNS,families=REACTION_FAMILIES,reactions=REACTION_CATALOG,maxMatches=MAX_REACTION_PATTERN_MATCHES}={}){
  const{patternById,familyById}=validateCatalogIds(patterns,families,reactions),byId=new Map(records.map(record=>[record.id,record])),compiled=[];
  for(const reaction of [...reactions].sort((a,b)=>a.id.localeCompare(b.id))){
    for(const participant of reaction.reactants)if(!byId.has(participant.species))throw new Error(`unknown-reactant-species:${reaction.id}:${participant.species}`);
    for(const product of reaction.products)if(!byId.has(product))throw new Error(`product-not-in-database:${reaction.id}:${product}`);
    const family=familyById.get(reaction.familyId),compiledReaction={...reaction,reactants:reaction.reactants.map(item=>({...item,participation:family.roles[item.role].participation}))},encounter=compiledReaction.reactants.filter(item=>family.roles[item.role].participation==='encounter');
    if(encounter.length!==2)throw new Error(`invalid-encounter-role-count:${reaction.id}`);
    const roleSpecies=Object.fromEntries(compiledReaction.reactants.map(item=>[item.role,item.species]));
    const matchOptions=new Map();
    for(const participant of compiledReaction.reactants){
      const roleDefinition=family.roles[participant.role],options=[];
      for(const patternId of roleDefinition.patterns??[]){const pattern=patternById.get(patternId),matches=matchPattern(byId.get(participant.species),pattern,{limit:maxMatches});for(const binding of matches)options.push({patternId,binding});}
      matchOptions.set(participant.role,options);
    }
    const roleOrder=compiledReaction.reactants.map(item=>item.role).sort((a,b)=>a.localeCompare(b));let pathwayCount=0;
    const enumerate=(index,bindings,matchedPatterns)=>{
      if(index===roleOrder.length){
        const pathwayId=`${compiledReaction.id}/${Object.entries(bindings).sort(([a],[b])=>a.localeCompare(b)).map(([role,binding])=>`${role}:${matchedPatterns[role]}[${bindingKey(binding)}]`).join('/')}`;
        const pathway={reaction:compiledReaction,family,roleSpecies,bindings,matchedPatterns,pathwayId,roleSpeciesKey:roleOrder.map(role=>`${role}=${roleSpecies[role]}`).join('|')};
        pathway.geometryConstraints=compileDistanceConstraints(family,pathway,records);
        pathway.graphTransition=transformPathway(pathway,records);pathway.outcomeSignature=chemistrySignature(pathway,records);compiled.push(pathway);pathwayCount++;return;
      }
      const role=roleOrder[index],options=matchOptions.get(role)??[];
      for(const option of options)enumerate(index+1,{...bindings,[role]:option.binding},{...matchedPatterns,[role]:option.patternId});
    };
    enumerate(0,{},{});
    if(!pathwayCount)throw new Error(`site-pattern-no-match:${reaction.id}`);
    if(compiled.length>maxMatches)throw new Error('pattern-match-overflow');
  }
  // Keep every labelled pathway. A complete-graph automorphism only groups
  // pathways; it never discards the actual atom binding.
  const classByPathway=new Map(),byReaction=new Map();for(const pathway of compiled){const key=pathway.reaction.id;if(!byReaction.has(key))byReaction.set(key,[]);byReaction.get(key).push(pathway);}
  for(const rows of byReaction.values()){
    const unseen=new Set(rows);
    while(unseen.size){const seed=[...unseen].sort((a,b)=>a.pathwayId.localeCompare(b.pathwayId))[0],group=[seed];unseen.delete(seed);
      for(const candidate of [...unseen])if(symmetryEquivalent(seed,candidate,records)){group.push(candidate);unseen.delete(candidate);}
      const classId=`${seed.reaction.id}:sym:${sorted(group.map(item=>item.pathwayId))[0]}`;for(const item of group)classByPathway.set(item.pathwayId,classId);
    }
  }
  for(const pathway of compiled)pathway.symmetryClassId=classByPathway.get(pathway.pathwayId);
  // Definitions that overlap in reactants, actual encounter anchors and
  // environment may not compete by catalog order or priority.
  const orderedCompiled=[...compiled].sort((a,b)=>a.pathwayId.localeCompare(b.pathwayId));
  for(let i=0;i<orderedCompiled.length;i++)for(let j=i+1;j<orderedCompiled.length;j++){
    const a=orderedCompiled[i],b=orderedCompiled[j];if(a.reaction.id===b.reaction.id||concreteReactantKey(a)!==concreteReactantKey(b)||anchorKey(a)!==anchorKey(b)||!environmentsOverlap(a.reaction,b.reaction))continue;
    if(a.outcomeSignature===b.outcomeSignature)throw new Error('duplicate-reaction-definition');
    throw new Error('ambiguous-reaction-definition');
  }
  const lookup=new Map();for(const pathway of compiled){const key=sorted(pathway.reaction.reactants.filter(item=>pathway.family.roles[item.role].participation==='encounter').map(item=>item.species)).join('|');if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push(pathway);}
  for(const rows of lookup.values())rows.sort((a,b)=>a.pathwayId.localeCompare(b.pathwayId));
  return{pathways:compiled,byEncounterSpecies:lookup,patterns:patternById,families:familyById,reactions:new Map(reactions.map(item=>[item.id,item]))};
}

let defaultCompiledCatalog=null;
function defaultCatalog(records){if(!defaultCompiledCatalog)defaultCompiledCatalog=compileReactionCatalog(records);return defaultCompiledCatalog;}

export function reactionCandidates(pair,catalogOrRecords){
  const[left,right]=pair,catalog=Array.isArray(catalogOrRecords)?defaultCatalog(catalogOrRecords):catalogOrRecords;
  if(!catalog?.byEncounterSpecies)return[];
  const key=sorted([left.species,right.species]).join('|'),result=[];
  for(const pathway of catalog.byEncounterSpecies.get(key)??[]){
    // Role ordering is authority for an encounter. It is independent of the
    // concrete reaction's declaration order, so same-species instances can
    // be assigned deterministically below.
    const encounter=pathway.reaction.reactants.filter(item=>pathway.family.roles[item.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
    const assignments=[];
    for(const[first,second]of [[left,right],[right,left]])if(first.species===pathway.roleSpecies[encounter[0].role]&&second.species===pathway.roleSpecies[encounter[1].role]){
      if(encounter[0].species===encounter[1].species&&first.id.localeCompare(second.id)>0)continue;
      assignments.push([first,second]);
    }
    for(const assigned of assignments){
      const participantInstances=Object.fromEntries(encounter.map((role,index)=>[role.role,assigned[index].id]));
      const speciesIds=encounter.map(role=>pathway.roleSpecies[role.role]),reactantInstanceIds=encounter.map(role=>participantInstances[role.role]);
      result.push({reactionId:pathway.reaction.id,familyId:pathway.family.id,pathwayId:pathway.pathwayId,symmetryClassId:pathway.symmetryClassId,reaction:pathway.reaction,family:pathway.family,bindings:pathway.bindings,matchedPatterns:pathway.matchedPatterns,geometryConstraints:pathway.geometryConstraints,graphTransition:pathway.graphTransition,participantInstances,encounterRoles:encounter.map(item=>item.role),speciesIds,reactantInstanceIds,outcomeSignature:pathway.outcomeSignature});
    }
  }
  return result.sort((a,b)=>a.pathwayId.localeCompare(b.pathwayId)||a.reactantInstanceIds.join('|').localeCompare(b.reactantInstanceIds.join('|')));
}

export function resolveCandidateInstanceIds(candidate,availableInstanceIds){
  const available=new Set(availableInstanceIds),ids=candidate?.reactantInstanceIds??[];
  return ids.length===2&&ids.every(id=>available.has(id))?[...ids]:null;
}
export function createContactMatcher({dwellMs=CONTACT_DWELL_MS}={}){
  const contacts=new Map();let activeStep=null;return{
    beginStep(){activeStep=new Set();},
    markActive(key){activeStep?.add(key);},
    endStep(){if(activeStep){for(const key of contacts.keys())if(!activeStep.has(key))contacts.delete(key);activeStep=null;}},
    update(key,eligible,stepMs=0){activeStep?.add(key);if(!eligible){contacts.delete(key);return false;}const elapsed=contacts.get(key);if(elapsed==null){contacts.set(key,0);return false;}const next=elapsed+Math.max(0,stepMs);contacts.set(key,next);return next>=dwellMs;},
    elapsed(key){return contacts.get(key)??0;},clear(key){contacts.delete(key);},reset(){contacts.clear();activeStep=null;},
  };
}
export function resolveRegisteredProducts(productIds,records){const byId=new Map(records.map(record=>[record.id,record]));const products=productIds.map(id=>byId.get(id));return products.every(Boolean)?{ok:true,products}:{ok:false,reason:'product-not-in-database'};}
export function transformReactionGraph(pathway,records,bindings){
  try{return transformPathway(pathway,records,{bindings});}catch(error){return{ok:false,reason:error.message};}
}
export function planReactionExecution(candidate,records){
  if(!candidate?.reaction||!candidate?.family||!candidate.reactionId)return{ok:false,reason:'inactive-or-unregistered-reaction'};
  const execution=candidate.graphTransition??transformReactionGraph(candidate,records,candidate.bindings);if(!execution.ok)return execution;
  const environmentSnapshot=candidate.environmentSnapshot===undefined?reactionLabEnvironmentStateFromTokens(candidate.environmentConditions??[]):snapshotReactionLabEnvironment(candidate.environmentSnapshot),activeConditions=[...environmentTokensFromSnapshot(environmentSnapshot)].sort();
  const participants=candidate.reaction.reactants.map(row=>({role:row.role,instanceId:candidate.participantInstances?.[row.role]??null,species:row.species,participation:candidate.family.roles[row.role].participation}));
  const products=execution.productGraphs.map(graph=>graph.record);
  const atomOrigins=execution.productGraphs.map(graph=>({species:graph.record.id,origins:Object.entries(graph.sourceToProduct).map(([sourceAtom,productAtom])=>({sourceAtom,productAtom}))}));
  return{ok:true,reactionId:candidate.reactionId,familyId:candidate.familyId,pathwayId:candidate.pathwayId,reaction:candidate.reaction,environmentSnapshot,environmentConditions:{active:activeConditions,requires:[...(candidate.reaction.requires??[])],forbids:[...(candidate.reaction.forbids??[])]},participants,matchedSites:Object.fromEntries(Object.entries(candidate.bindings??{}).map(([role,atomBindings])=>[role,{patternId:candidate.matchedPatterns?.[role]??null,atomBindings}])),consumedInstanceIds:participants.map(item=>item.instanceId).filter(Boolean),products,productInstanceCount:products.length,atomOrigins,graphTransition:execution,graphDiff:{brokenBonds:execution.brokenBonds,formedBonds:execution.formedBonds,bondOrderChanges:execution.bondOrderChanges,formalChargeChanges:execution.formalChargeChanges}};
}

export function scoreReactionGeometry(constraints,positionFor){
  const scored=(constraints??[]).map(constraint=>{
    const from=positionFor(constraint.from.role,constraint.from.atomIndex),to=positionFor(constraint.to.role,constraint.to.atomIndex),actual=Math.hypot(from[0]-to[0],from[1]-to[1],from[2]-to[2]);
    const normalizedError=actual<constraint.target?(constraint.target-actual)/(constraint.target-constraint.min):(actual-constraint.target)/(constraint.max-constraint.target);
    return{...constraint,actual,normalizedError,withinWindow:actual>=constraint.min&&actual<=constraint.max};
  });
  const errors=scored.map(item=>item.normalizedError),worstNormalizedDeviation=errors.length?Math.max(...errors):Infinity,meanNormalizedDeviation=errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:Infinity;
  return{constraints:scored,geometryReady:scored.length>0&&scored.every(item=>item.withinWindow),worstNormalizedDeviation,meanNormalizedDeviation,quality:[worstNormalizedDeviation,meanNormalizedDeviation]};
}

export function arbitrateReactionCandidates(candidates,{deadband=.025}={}){
  if(!candidates.length)return{selected:null,reason:'no-commit-ready-candidate'};
  const stableKey=item=>`${item.pathwayId}|${Object.entries(item.participantInstances??{}).sort(([a],[b])=>a.localeCompare(b)).map(([role,id])=>`${role}=${id}`).join('|')}`;
  const sortedCandidates=[...candidates].sort((a,b)=>a.geometryQuality.worstNormalizedDeviation-b.geometryQuality.worstNormalizedDeviation||a.geometryQuality.meanNormalizedDeviation-b.geometryQuality.meanNormalizedDeviation||stableKey(a).localeCompare(stableKey(b)));
  const rawBest=sortedCandidates[0],clearlyBetter=sortedCandidates.filter(item=>item.reactionId!==rawBest.reactionId&&(
    item.geometryQuality.worstNormalizedDeviation<rawBest.geometryQuality.worstNormalizedDeviation-deadband||
    Math.abs(item.geometryQuality.worstNormalizedDeviation-rawBest.geometryQuality.worstNormalizedDeviation)<=deadband&&item.geometryQuality.meanNormalizedDeviation<rawBest.geometryQuality.meanNormalizedDeviation-deadband
  ));
  const preferredReactionId=(clearlyBetter[0]??rawBest).reactionId,reactionLeader=sortedCandidates.find(item=>item.reactionId===preferredReactionId);
  const competing=sortedCandidates.filter(item=>item.reactionId!==reactionLeader.reactionId&&Math.abs(item.geometryQuality.worstNormalizedDeviation-reactionLeader.geometryQuality.worstNormalizedDeviation)<=deadband&&Math.abs(item.geometryQuality.meanNormalizedDeviation-reactionLeader.geometryQuality.meanNormalizedDeviation)<=deadband);
  if(competing.length)return{selected:null,reason:'geometry-deadband',contenders:[reactionLeader,...competing]};
  const equivalent=sortedCandidates.filter(item=>item.reactionId===reactionLeader.reactionId&&item.symmetryClassId===reactionLeader.symmetryClassId);
  const geometryLeader=equivalent[0],geometryTie=equivalent.filter(item=>Math.abs(item.geometryQuality.worstNormalizedDeviation-geometryLeader.geometryQuality.worstNormalizedDeviation)<=deadband&&Math.abs(item.geometryQuality.meanNormalizedDeviation-geometryLeader.geometryQuality.meanNormalizedDeviation)<=deadband);
  const selected=geometryTie.sort((a,b)=>(a.newBondEndpointDistanceSum??Infinity)-(b.newBondEndpointDistanceSum??Infinity)||stableKey(a).localeCompare(stableKey(b)))[0];
  return{selected,reason:preferredReactionId===rawBest.reactionId?'selected':'selected-by-fit'};
}

export function resolveSupplementalParticipants(reaction,candidate,instances,centerFor){
  const chosen={...(candidate.participantInstances??{})},used=new Set(Object.values(chosen));
  if(used.size!==Object.values(chosen).length)return{ok:false,reason:'duplicate-participant-instance'};
  for(const participant of reaction.reactants.filter(row=>row.participation==='supplemental').sort((a,b)=>a.role.localeCompare(b.role))){
    const match=instances.filter(item=>item.species===participant.species&&!item.busy&&!used.has(item.id)).map(item=>({item,distance:centerFor(item)})).sort((a,b)=>a.distance-b.distance||a.item.id.localeCompare(b.item.id))[0];
    if(!match)return{ok:false,reason:'missing-stoichiometric-participant',species:participant.species,count:1};
    chosen[participant.role]=match.item.id;used.add(match.item.id);
  }
  return{ok:true,participantInstances:chosen,participants:reaction.reactants.map(row=>({role:row.role,instanceId:chosen[row.role]??null,species:row.species,participation:row.participation??'encounter'}))};
}

export function supplementalSelectionCenter(candidate,positionFor){
  const endpointByKey=new Map();
  for(const constraint of candidate?.geometryConstraints??[])for(const endpoint of [constraint.from,constraint.to]){
    if(!endpoint||typeof endpoint.role!=='string'||!Number.isInteger(endpoint.atomIndex))return null;
    endpointByKey.set(`${endpoint.role}\u0000${endpoint.atomIndex}`,endpoint);
  }
  if(!endpointByKey.size)return null;
  const endpoints=[...endpointByKey.values()].sort((a,b)=>a.role.localeCompare(b.role)||a.atomIndex-b.atomIndex);
  const positions=endpoints.map(endpoint=>positionFor(endpoint.role,endpoint.atomIndex));
  if(positions.some(position=>!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite)))return null;
  return [0,1,2].map(axis=>positions.reduce((sum,position)=>sum+position[axis],0)/positions.length);
}

// Retained only as a pure strict product lookup helper for consumers/tests.
export function matchDatabaseProduct(graph,records){for(const record of records)if(strictGraphMatch(graph,record))return record;return null;}
