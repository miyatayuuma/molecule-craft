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
  const sites=[];
  record.atoms.forEach((raw,id)=>{
    const element=atomElement(record,id), bonded=neighbors(record,id), hCount=bonded.filter(([other])=>atomElement(record,other)==='H').length;
    if(element==='O'&&hCount)sites.push({kind:'donor',atom:id,hydrogens:bonded.filter(([other])=>atomElement(record,other)==='H').map(([other])=>other)});
    if(['O','N','F'].includes(element)&&bonded.length<=(element==='O'?2:3))sites.push({kind:'acceptor',atom:id});
    const charge=raw.charge??record.formalCharges?.[String(id)];
    if(charge)sites.push({kind:'formal-charge',atom:id,charge});
  });
  const electronegativity={H:2.2,C:2.55,N:3.04,O:3.44,F:3.98,P:2.19,S:2.58,Cl:3.16};
  record.bonds.forEach(([a,b,order])=>{if(order===1&&atomElement(record,a)!==atomElement(record,b)){sites.push({kind:'polar-bond',atoms:[a,b]});const negative=electronegativity[atomElement(record,a)]>=electronegativity[atomElement(record,b)]?a:b,positive=negative===a?b:a;sites.push({kind:'partial-charge',atom:negative,charge:-.22},{kind:'partial-charge',atom:positive,charge:.22});}});
  return sites;
}
export function hydrogenBondEligibility(donor,acceptor,{distance,alignment=1}={}) {
  return !!donor&&donor.kind==='donor'&&!!acceptor&&acceptor.kind==='acceptor'&&distance<=3.35&&distance>=1.15&&alignment>=.35;
}
export function chargeInteractionSign(chargeA,chargeB){const product=(Number(chargeA)||0)*(Number(chargeB)||0);return product===0?0:Math.sign(product);}

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
      for(let i=0;i<recordA.atoms.length;i++)for(let j=0;j<recordB.atoms.length;j++)if(siteMatches(recordA,a.site,i)&&siteMatches(recordB,b.site,j))matches.push({rule,reactantInstances:[first,second],siteAtoms:[i,j]});
    }
  }
  return matches;
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
  const required=rule.reactants.map(item=>item.species),actual=candidate.reactantInstances??[],consumed=[],supplied=[];
  for(const species of new Set(required)){const count=required.filter(id=>id===species).length,instances=actual.filter(item=>item.species===species);consumed.push(...instances.slice(0,count));for(let i=instances.length;i<count;i++)supplied.push(species);}
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
