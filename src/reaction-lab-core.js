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
  if(key==='O-S')return .21;
  return .14;
}
export function deriveInteractionCharges(record,{overrides={}}={}){
  const charges=record.atoms.map(()=>0);
  for(const [a,b,order=1] of record.bonds){
    const elementA=atomElement(record,a),elementB=atomElement(record,b),difference=(ELECTRONEGATIVITY[elementA]??2.5)-(ELECTRONEGATIVITY[elementB]??2.5);
    if(!difference)continue;
    const scale=bondPolarityScale(elementA,elementB)*Math.sqrt(Math.max(1,Number(order)||1));
    const transfer=Math.max(-.42,Math.min(.42,difference*scale));
    charges[a]-=transfer;charges[b]+=transfer;
  }
  for(const [atom,value] of Object.entries(overrides))if(Number.isInteger(Number(atom))&&charges[Number(atom)]!==undefined&&Number.isFinite(Number(value)))charges[Number(atom)]=Number(value);
  // Bond dipoles are neutral by construction. The tiny correction also keeps
  // optional data overrides from accidentally creating a net molecular charge.
  const mean=charges.length?charges.reduce((sum,value)=>sum+value,0)/charges.length:0;
  const centered=charges.map(value=>value-mean),maximum=Math.max(0,...centered.map(Math.abs)),scale=maximum>.8 ? .8/maximum : 1;
  return centered.map(value=>value*scale);
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
      if(!acidicHydroxyl&&(bonded.length<=2||nitroO))acceptors.push({atom});
    } else if(element==='N'&&!isAmideNitrogen(record,atom)){
      const formalCharge=Number(record.formalCharges?.[String(atom)]??record.atoms[atom]?.charge??0);
      if(formalCharge<=0&&bonded.length<=3)acceptors.push({atom});
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
  const product=chargeA*chargeB,denominator=Math.pow(distance*distance+softening*softening,1.5),scale=Math.max(-maxForce,Math.min(maxForce,-strength*product/denominator));
  return {x:delta.x*scale,y:delta.y*scale,z:delta.z*scale,magnitude:Math.abs(scale)};
}
export function coulombPairForces(chargeA,chargeB,delta,options){
  const onA=coulombPairForce(chargeA,chargeB,delta,options);
  return {onA:{x:onA.x,y:onA.y,z:onA.z},onB:{x:-onA.x,y:-onA.y,z:-onA.z},magnitude:onA.magnitude};
}
export function hydrogenBondSpringForces(delta,restLength,relativeSeparationSpeed=0,{stiffness=.032,damping=.018,maxForce=.055}={}){
  const distance=Math.hypot(delta.x,delta.y,delta.z);if(!distance)return {onDonor:{x:0,y:0,z:0},onAcceptor:{x:0,y:0,z:0},magnitude:0};
  const magnitude=Math.max(-maxForce,Math.min(maxForce,(distance-restLength)*stiffness+relativeSeparationSpeed*damping));
  const onDonor={x:delta.x/distance*magnitude,y:delta.y/distance*magnitude,z:delta.z/distance*magnitude};
  return {onDonor,onAcceptor:{x:-onDonor.x,y:-onDonor.y,z:-onDonor.z},magnitude:Math.abs(magnitude)};
}
export function torqueFromForce(offset,force){return {x:offset.y*force.z-offset.z*force.y,y:offset.z*force.x-offset.x*force.z,z:offset.x*force.y-offset.y*force.x};}

export function hydrogenBondEligibility(donor,acceptor,{distance,alignment=1}={}) {
  return donor?.kind==='donor'&&acceptor?.kind==='acceptor'&&Number.isFinite(distance)&&distance<=3.35&&distance>=1.15&&alignment>=.35;
}
export function chargeInteractionSign(chargeA,chargeB){const product=(Number(chargeA)||0)*(Number(chargeB)||0);return product===0?0:Math.sign(product);}

export function createHydrogenBondTracker({formationDistance=3.35,breakDistance=4.05,formationAlignment=.35,breakAlignment=.12,breakRelativeSpeed=.11,breakTensileLoad=.12}={}){
  const active=new Map();
  return {
    update(key,identity,metrics,now){
      const previous=active.get(key),distance=metrics.distance,alignment=metrics.alignment??1;
      if(!previous){
        if(!identity||distance>formationDistance||distance<1.15||alignment<formationAlignment)return {formed:false,bond:null,broken:false};
        const bond={...identity,key,formedAt:now,restLength:Math.min(2.45,Math.max(1.8,distance)),distance,alignment};active.set(key,bond);return {formed:true,bond,broken:false};
      }
      const broken=distance>breakDistance||distance<1.15||alignment<breakAlignment||(metrics.relativeSpeed??0)>breakRelativeSpeed||(metrics.tensileLoad??0)>breakTensileLoad;
      if(broken){active.delete(key);return {formed:false,bond:null,broken:true};}
      Object.assign(previous,{distance,alignment,relativeSpeed:metrics.relativeSpeed??0,tensileLoad:metrics.tensileLoad??0});return {formed:false,bond:previous,broken:false};
    },
    get(key){return active.get(key)??null;},
    values(){return [...active.values()];},
    delete(key){return active.delete(key);},
    reset(){active.clear();},
  };
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
