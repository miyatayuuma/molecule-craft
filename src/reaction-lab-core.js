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
export function createContactMatcher({dwellMs=CONTACT_DWELL_MS}={}){
  const contacts=new Map();return {update(key,eligible,now){if(!eligible){contacts.delete(key);return false;}const since=contacts.get(key)??now;contacts.set(key,since);return now-since>=dwellMs;},clear(key){contacts.delete(key);},reset(){contacts.clear();}};
}
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
export function planReactionExecution(candidate,records,rules=REACTION_RULES){
  const rule=rules.find(item=>item.id===candidate?.rule?.id);if(!rule||rule.activation!=='contact')return {ok:false,reason:'inactive-or-unregistered-rule'};
  const required=rule.reactants.map(item=>item.species),actualIds=candidate.reactantInstanceIds??[],actualSpecies=candidate.speciesIds??[];
  if(candidate.ruleId!==rule.id||candidate.siteAtomIndices?.length!==required.length||actualSpecies.length!==actualIds.length||actualIds.length!==required.length||new Set(actualIds).size!==actualIds.length)return {ok:false,reason:'invalid-candidate'};
  const requiredCounts=new Map(),actualCounts=new Map();for(const species of required)requiredCounts.set(species,(requiredCounts.get(species)??0)+1);for(const species of actualSpecies)actualCounts.set(species,(actualCounts.get(species)??0)+1);
  if(requiredCounts.size!==actualCounts.size||[...requiredCounts].some(([species,count])=>actualCounts.get(species)!==count))return {ok:false,reason:'missing-reactant-instances'};
  const graphTransition=transformReactionGraph(rule,records);if(!graphTransition.ok)return graphTransition;
  const products=graphTransition.productGraphs.map(graph=>matchDatabaseProduct(graph,records));
  return {ok:true,rule,consumedInstanceIds:[...actualIds],products,productInstanceCount:products.length,graphTransition};
}
export function matchDatabaseProduct(graph,records){
  for(const record of records){if(graph.atoms.length!==record.atoms.length||graph.bonds.length!==record.bonds.length)continue;
    const atoms=graph.atoms.map(atom=>({id:atom.id,element:atom.element}));
    const productAtoms=record.atoms.map((_,id)=>atomElement(record,id));
    const productBonds=record.bonds.map(([a,b,order])=>[a,b,order]);
    if(graphsAreIsomorphic(atoms,graph.bonds,productAtoms,productBonds))return record;
  }return null;
}
