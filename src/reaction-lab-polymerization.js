// Three.js and DOM-free finite polymer transaction authority. Polymer graphs
// remain separate from molecule records and from the Stage B body population.
import {CONTACT_DWELL_MS,matchDatabaseProduct,matchReactionSitePattern,environmentMatches} from './reaction-lab-core.js?v=13';
import {applyGuardedGraphEdits,graphConnectedComponents,validateGraphAtomConservation} from './reaction-graph-edits.js?v=1';

export const POLYMER_COMMIT_DWELL_MS=CONTACT_DWELL_MS;
export const POLYMERIZATION_STATES=Object.freeze({WAITING:'WAITING',TRANSFORMING:'TRANSFORMING',AUTO_PENDING:'AUTO_PENDING',COMPLETING:'COMPLETING',SAMPLE:'SAMPLE'});
const elementOf=(record,index)=>typeof record.atoms[index]==='string'?record.atoms[index]:record.atoms[index].element;
const chargeOf=(record,index)=>typeof record.atoms[index]==='string'?0:(record.atoms[index].formalCharge??record.atoms[index].charge??0);
const bondOf=bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond;
const edgeKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const clone=value=>structuredClone(value);

function normalizeMoleculeGraph(record){
  return{
    atoms:record.atoms.map((_,index)=>({id:index,element:elementOf(record,index),formalCharge:chargeOf(record,index)})),
    bonds:record.bonds.map(bondOf).map(bond=>({a:bond.a,b:bond.b,order:bond.order})),
  };
}
function asPatternRecord(graph){return{atoms:graph.atoms.map(atom=>({element:atom.element,formalCharge:atom.formalCharge??0})),bonds:graph.bonds.map(bond=>({a:bond.a,b:bond.b,order:bond.order}))};}
function neighbors(graph,index,element=null){
  const result=[];for(const bond of graph.bonds){if(bond.a===index)result.push({index:bond.b,bond});else if(bond.b===index)result.push({index:bond.a,bond});}
  return result.filter(item=>element==null||graph.atoms[item.index]?.element===element);
}
function matchSites(graph,pattern){return matchReactionSitePattern(asPatternRecord(graph),pattern);}
function firstSite(graph,pattern){return matchSites(graph,pattern)[0]??null;}
function ref(role,label){return`${role}.${label}`;}

function flattenOrigins(instances,records){
  const result=[];for(const instance of instances){const record=records.get(instance.species);if(!record)throw new Error(`unknown-polymer-feed-species:${instance.species}`);record.atoms.forEach((_,sourceAtomIndex)=>result.push({instanceId:instance.id,sourceAtomIndex,element:elementOf(record,sourceAtomIndex),formalCharge:chargeOf(record,sourceAtomIndex)}));}return result;
}
function originKey(origin){return`${origin.instanceId}:${origin.sourceAtomIndex}`;}

function originFromRoleId(id,fragment,incoming){
  const split=id.indexOf(':');if(split<0)throw new Error(`invalid-polymer-atom-ref:${id}`);
  const role=id.slice(0,split),index=Number(id.slice(split+1));
  if(!Number.isInteger(index))throw new Error(`invalid-polymer-atom-ref:${id}`);
  if(role==='fragment')return fragment.atomOrigins[index];
  if(role==='incoming')return{instanceId:incoming.id,sourceAtomIndex:index};
  throw new Error(`invalid-polymer-atom-role:${role}`);
}
function graphFromComponent(component,fragment,incoming){
  const indexes=new Map(component.atoms.map((atom,index)=>[atom.id,index]));
  const atoms=component.atoms.map((atom,id)=>({id,element:atom.element,formalCharge:atom.formalCharge??0}));
  const bonds=component.bonds.map(bond=>({a:indexes.get(bond.a),b:indexes.get(bond.b),order:bond.order}));
  const atomOrigins=component.atoms.map(atom=>originFromRoleId(atom.id,fragment,incoming));
  return{atoms,bonds,atomOrigins};
}
function valenceLimit(atom){
  if(atom.formalCharge!==0)throw new Error(`unsupported-polymer-formal-charge:${atom.id}`);
  return({H:1,C:4,N:3,O:2,F:1,Cl:1})[atom.element]??null;
}
function valenceDeficits(graph){
  const sums=new Map(graph.atoms.map(atom=>[atom.id,0]));
  for(const bond of graph.bonds){if(!sums.has(bond.a)||!sums.has(bond.b)||![1,2,3].includes(bond.order))throw new Error('invalid-polymer-bond');sums.set(bond.a,sums.get(bond.a)+bond.order);sums.set(bond.b,sums.get(bond.b)+bond.order);}
  const deficits=[];for(const atom of graph.atoms){const limit=valenceLimit(atom);if(limit==null)throw new Error(`unsupported-polymer-element:${atom.element}`);const deficit=limit-sums.get(atom.id);if(deficit<0||deficit>1)throw new Error(`invalid-polymer-valence:${atom.id}:${deficit}`);if(deficit)deficits.push({atomRef:atom.id,valence:deficit,semantic:'chain-continuation'});}
  return deficits;
}
function validateSourcePartition(consumedInstances,fragment,byproducts,records){
  const expected=flattenOrigins(consumedInstances,records),actual=[...fragment.atomOrigins,...byproducts.flatMap(item=>item.atomOrigins)];
  if(new Set(actual.map(originKey)).size!==actual.length)throw new Error('duplicate-polymer-source-atom');
  const expectedKeys=expected.map(originKey).sort(),actualKeys=actual.map(originKey).sort();
  if(expectedKeys.length!==actualKeys.length||expectedKeys.some((key,index)=>key!==actualKeys[index]))throw new Error('polymer-source-atom-partition-failed');
  const expectedElements=expected.map(atom=>atom.element).sort(),actualElements=[...fragment.atoms.map(atom=>atom.element),...byproducts.flatMap(item=>item.graph.atoms.map(atom=>atom.element))].sort();
  if(expectedElements.join('|')!==actualElements.join('|'))throw new Error('polymer-element-conservation-failed');
  const charge=items=>items.reduce((sum,item)=>sum+(item.formalCharge??0),0);
  const output=[...fragment.atoms,...byproducts.flatMap(item=>item.graph.atoms)];
  if(charge(expected)!==charge(output))throw new Error('polymer-formal-charge-conservation-failed');
}
function validateMainGraph(graph,continuations,{network=false}={}){
  if(!graph.atoms.length||graphConnectedComponents(graph.atoms,graph.bonds).length!==1)throw new Error('polymer-main-fragment-disconnected');
  validateGraphAtomConservation(graph,graph);
  const deficits=valenceDeficits(graph),declared=new Map(continuations.map(item=>[item.atomRef,item.valence]));
  if(new Set(continuations.map(item=>item.atomRef)).size!==continuations.length)throw new Error('duplicate-polymer-continuation');
  if(network&&deficits.length)throw new Error('network-valence-repair-forbidden');
  if(deficits.length!==declared.size||deficits.some(item=>declared.get(item.atomRef)!==item.valence))throw new Error('polymer-continuation-does-not-match-valence');
}

function mapToRoleGraph(fragment,incomingRecord){
  const atoms=[],bonds=[],bindings={fragment:{},incoming:{}};
  fragment.atoms.forEach((atom,index)=>{atoms.push({...atom,id:`fragment:${index}`});bindings.fragment[`a${index}`]=index;});
  fragment.bonds.forEach(bond=>bonds.push({a:`fragment:${bond.a}`,b:`fragment:${bond.b}`,order:bond.order}));
  const incoming=normalizeMoleculeGraph(incomingRecord);
  incoming.atoms.forEach((atom,index)=>{atoms.push({...atom,id:`incoming:${index}`});bindings.incoming[`a${index}`]=index;});
  incoming.bonds.forEach(bond=>bonds.push({a:`incoming:${bond.a}`,b:`incoming:${bond.b}`,order:bond.order}));
  return{source:{atoms,bonds,bindings},incoming};
}
function addEdit(edits,op,roleA,labelA,roleB,labelB,fields={}){const edit={op,a:ref(roleA,labelA),...fields};if(roleB)edit.b=ref(roleB,labelB);edits.push(edit);}
function condensePlan(fragment,incomingRecord,route,patterns,incomingKind){
  const {source}=mapToRoleGraph(fragment,incomingRecord),fragmentRecord=asPatternRecord(fragment),incoming=normalizeMoleculeGraph(incomingRecord),incomingGraph=asPatternRecord(incoming);
  const acidPattern=patterns.get('polymer-carboxylic-acid'),donorPattern=patterns.get(incomingKind==='amine'?'polymer-amine':'polymer-alcohol');
  const acidsInFragment=matchSites(fragment,acidPattern),acidsIncoming=matchSites(incoming,acidPattern);
  const hydroxylFragment=new Set(acidsInFragment.map(site=>site.Ohydroxyl)),hydroxylIncoming=new Set(acidsIncoming.map(site=>site.Ohydroxyl));
  const donorsInFragment=matchSites(fragment,donorPattern).filter(site=>incomingKind==='amine'||!hydroxylFragment.has(site.Oalcohol));
  const donorsIncoming=matchSites(incoming,donorPattern).filter(site=>incomingKind==='amine'||!hydroxylIncoming.has(site.Oalcohol));
  let acidRole,acidSite,donorRole,donorSite;
  if(acidsInFragment.length&&donorsIncoming.length){acidRole='fragment';acidSite=acidsInFragment[0];donorRole='incoming';donorSite=donorsIncoming[0];}
  else if(donorsInFragment.length&&acidsIncoming.length){acidRole='incoming';acidSite=acidsIncoming[0];donorRole='fragment';donorSite=donorsInFragment[0];}
  else throw new Error('polymer-step-reactive-sites-not-found');
  const acidGraph=acidRole==='fragment'?fragment:incoming,donorGraph=donorRole==='fragment'?fragment:incoming;
  const donorO=incomingKind==='amine'?donorSite.Namine:donorSite.Oalcohol;
  const acidHydrogen=neighbors(acidGraph,acidSite.Ohydroxyl,'H')[0]?.index;
  const donorHydrogen=neighbors(donorGraph,donorO,'H')[0]?.index;
  if(!Number.isInteger(acidHydrogen)||!Number.isInteger(donorHydrogen))throw new Error(`polymer-condensation-hydrogen-not-found:${acidRole}:${acidSite.Ohydroxyl}:${acidHydrogen}:${donorRole}:${donorO}:${donorHydrogen}`);
  const bindings={fragment:{},incoming:{}};
  for(const[label,index]of Object.entries(acidSite))bindings[acidRole][label]=index;
  for(const[label,index]of Object.entries(donorSite))bindings[donorRole][label]=index;
  bindings[acidRole].Hacid=acidHydrogen;bindings[donorRole].Hdonor=donorHydrogen;
  const edits=[];
  addEdit(edits,'breakBond',acidRole,'Cacyl',acidRole,'Ohydroxyl',{from:1});
  addEdit(edits,'breakBond',donorRole,incomingKind==='amine'?'Namine':'Oalcohol',donorRole,'Hdonor',{from:1});
  addEdit(edits,'formBond',acidRole,'Ohydroxyl',donorRole,'Hdonor',{from:'absent',order:1});
  addEdit(edits,'formBond',acidRole,'Cacyl',donorRole,incomingKind==='amine'?'Namine':'Oalcohol',{from:'absent',order:1});
  return{source,bindings,edits,expectedByproduct:'water',nextFamily:route.transformFamilies[0]};
}

function vinylPlan(fragment,incomingRecord,patterns,{family,initial=false}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),edits=[],vinylPattern=patterns.get('polymer-vinyl-alkene');
  const incomingSite=firstSite(normalizeMoleculeGraph(incomingRecord),vinylPattern);if(!incomingSite)throw new Error('polymer-vinyl-site-not-found');
  const bindings={fragment:{},incoming:{}};for(const[label,index]of Object.entries(incomingSite))bindings.incoming[label]=index;
  let chainStart=fragment.chainStartAtom??null;
  if(initial){
    const initialSite=firstSite(fragment,vinylPattern);if(!initialSite)throw new Error('polymer-vinyl-site-not-found');
    for(const[label,index]of Object.entries(initialSite))bindings.fragment[label]=index;
    addEdit(edits,'changeBondOrder','fragment','C1','fragment','C2',{from:2,to:1});
    chainStart=initialSite.C2;
  }
  addEdit(edits,'changeBondOrder','incoming','C1','incoming','C2',{from:2,to:1});
  const active=initial?bindings.fragment.C1:fragment.activeEndAtom;
  if(!Number.isInteger(active))throw new Error('polymer-active-end-missing');
  bindings.fragment.active=active;
  addEdit(edits,'formBond','fragment','active','incoming','C1',{from:'absent',order:1});
  return{source,bindings,edits,chainStart:initial?chainStart:null,initialStartOrigin:initial?fragment.atomOrigins[chainStart]:null,nextActive:{role:'incoming',index:incomingSite.C2},expectedByproduct:null};
}

function dienePlan(fragment,incomingRecord,patterns,{initial=false}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),edits=[],pattern=patterns.get('polymer-conjugated-diene-1-4'),incomingSite=firstSite(normalizeMoleculeGraph(incomingRecord),pattern);
  if(!incomingSite)throw new Error('polymer-diene-site-not-found');
  const bindings={fragment:{},incoming:{}};for(const[label,index]of Object.entries(incomingSite))bindings.incoming[label]=index;
  addEdit(edits,'changeBondOrder','incoming','C1','incoming','C2',{from:2,to:1});
  addEdit(edits,'changeBondOrder','incoming','C3','incoming','C4',{from:2,to:1});
  addEdit(edits,'changeBondOrder','incoming','C2','incoming','C3',{from:1,to:2});
  let chainStart=fragment.chainStartAtom??null;
  if(initial){
    const first=firstSite(fragment,pattern);if(!first)throw new Error('polymer-diene-site-not-found');
    for(const[label,index]of Object.entries(first))bindings.fragment[label]=index;
    addEdit(edits,'changeBondOrder','fragment','C1','fragment','C2',{from:2,to:1});
    addEdit(edits,'changeBondOrder','fragment','C3','fragment','C4',{from:2,to:1});
    addEdit(edits,'changeBondOrder','fragment','C2','fragment','C3',{from:1,to:2});
    chainStart=first.C1;
  }
  const active=initial?bindings.fragment.C4:fragment.activeEndAtom;if(!Number.isInteger(active))throw new Error('polymer-active-end-missing');
  bindings.fragment.active=active;
  addEdit(edits,'formBond','fragment','active','incoming','C1',{from:'absent',order:1});
  return{source,bindings,edits,chainStart:initial?chainStart:null,initialStartOrigin:initial?fragment.atomOrigins[chainStart]:null,nextActive:{role:'incoming',index:incomingSite.C4},expectedByproduct:null};
}

function mixedInitialChainPlan(fragment,incomingRecord,patterns,{fragmentFamily,incomingFamily}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),edits=[],bindings={fragment:{},incoming:{}};
  const siteFor=(graph,family)=>firstSite(graph,patterns.get(family==='diene'?'polymer-conjugated-diene-1-4':'polymer-vinyl-alkene'));
  const previous=siteFor(fragment,fragmentFamily),incoming=siteFor(normalizeMoleculeGraph(incomingRecord),incomingFamily);
  if(!previous||!incoming)throw new Error('polymer-copolymer-reactive-site-not-found');
  for(const[label,index]of Object.entries(previous))bindings.fragment[label]=index;
  for(const[label,index]of Object.entries(incoming))bindings.incoming[label]=index;
  const addDiene=role=>{
    addEdit(edits,'changeBondOrder',role,'C1',role,'C2',{from:2,to:1});
    addEdit(edits,'changeBondOrder',role,'C3',role,'C4',{from:2,to:1});
    addEdit(edits,'changeBondOrder',role,'C2',role,'C3',{from:1,to:2});
  };
  let chainStart,activeFragment,activeIncoming;
  if(fragmentFamily==='diene'){addDiene('fragment');chainStart=previous.C1;activeFragment=previous.C4;}
  else{addEdit(edits,'changeBondOrder','fragment','C1','fragment','C2',{from:2,to:1});chainStart=previous.C2;activeFragment=previous.C1;}
  if(incomingFamily==='diene'){addDiene('incoming');activeIncoming=incoming.C4;}
  else{addEdit(edits,'changeBondOrder','incoming','C1','incoming','C2',{from:2,to:1});activeIncoming=incoming.C2;}
  bindings.fragment.active=activeFragment;
  addEdit(edits,'formBond','fragment','active','incoming','C1',{from:'absent',order:1});
  return{source,bindings,edits,chainStart,initialStartOrigin:fragment.atomOrigins[chainStart],nextActive:{role:'incoming',index:activeIncoming},expectedByproduct:null};
}

function epoxidePlan(fragment,incomingRecord,patterns,{initial=false}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),pattern=patterns.get('polymer-epoxide-three-member'),site=firstSite(normalizeMoleculeGraph(incomingRecord),pattern);
  if(!site)throw new Error('polymer-epoxide-site-not-found');
  const edits=[],bindings={fragment:{},incoming:{}};for(const[label,index]of Object.entries(site))bindings.incoming[label]=index;
  addEdit(edits,'breakBond','incoming','C1','incoming','O1',{from:1});
  const active=initial?(firstSite(fragment,pattern)?.O1):fragment.activeOxygenAtom;
  if(!Number.isInteger(active))throw new Error('polymer-active-oxygen-missing');
  if(initial){
    const previous=firstSite(fragment,pattern);for(const[label,index]of Object.entries(previous??{}))bindings.fragment[label]=index;
    addEdit(edits,'breakBond','fragment','C1','fragment','O1',{from:1});
    bindings.fragment.active=active;
  }else bindings.fragment.active=active;
  addEdit(edits,'formBond','fragment','active','incoming','C1',{from:'absent',order:1});
  const chainStart=initial?firstSite(fragment,pattern).C1:null;
  return{source,bindings,edits,chainStart,initialStartOrigin:initial?fragment.atomOrigins[chainStart]:null,nextActive:{role:'incoming',index:site.O1,type:'oxygen'},expectedByproduct:null,ringOpeningDelta:initial?2:1};
}

function freeAromaticCH(graph,allowedOrigins=null){
  const aromatic=graph.atoms.filter(atom=>atom.element==='C').map(atom=>atom.id).sort((a,b)=>a-b);
  for(const atomIndex of aromatic){
    if(allowedOrigins&&!allowedOrigins.has(atomIndex))continue;
    const h=neighbors(graph,atomIndex,'H')[0];if(h)return{carbon:atomIndex,hydrogen:h.index};
  }
  return null;
}
function formaldehydeSite(graph,pattern){return firstSite(graph,pattern);}
function phenolAttachmentSite(graph,instanceId,atomOrigins){
  if(!atomOrigins)return freeAromaticCH(graph);
  const allowed=new Set(atomOrigins.map((origin,index)=>origin.instanceId===instanceId&&graph.atoms[index]?.element==='C'?index:-1).filter(index=>index>=0));
  return freeAromaticCH(graph,allowed);
}
function phenolMethylolationPlan(fragment,incomingRecord,patterns,{phenolInstanceId,atomOrigins}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),incoming=normalizeMoleculeGraph(incomingRecord),formal=formaldehydeSite(incoming,patterns.get('polymer-formaldehyde-carbonyl'));
  const target=phenolAttachmentSite(fragment,phenolInstanceId,fragment.atomOrigins);if(!formal||!target)throw new Error('polymer-resole-site-not-found');
  const bindings={fragment:{CH:target.carbon,Hring:target.hydrogen},incoming:{Cformal:formal.Cformal,Oformal:formal.Oformal}},edits=[];
  addEdit(edits,'breakBond','fragment','CH','fragment','Hring',{from:1});
  addEdit(edits,'changeBondOrder','incoming','Cformal','incoming','Oformal',{from:2,to:1});
  addEdit(edits,'formBond','fragment','CH','incoming','Cformal',{from:'absent',order:1});
  addEdit(edits,'formBond','incoming','Oformal','fragment','Hring',{from:'absent',order:1});
  return{source,bindings,edits,expectedByproduct:null,nextNetworkFeature:'hydroxymethyl-site'};
}
function phenolBridgePlan(fragment,incomingRecord,patterns,{methylolInstanceId,phenolInstanceId}={}){
  const {source}=mapToRoleGraph(fragment,incomingRecord),incoming=normalizeMoleculeGraph(incomingRecord),target=phenolAttachmentSite(incoming,phenolInstanceId,null);
  if(!target)throw new Error('polymer-resole-site-not-found');
  const origins=fragment.atomOrigins,formalCarbon=fragment.atoms.findIndex((atom,index)=>origins[index]?.instanceId===methylolInstanceId&&atom.element==='C'&&neighbors(fragment,index,'O').some(item=>neighbors(fragment,item.index,'H').length>0));
  if(formalCarbon<0)throw new Error('polymer-resole-methylol-not-found');
  const oxygen=neighbors(fragment,formalCarbon,'O').find(item=>neighbors(fragment,item.index,'H').length>0)?.index;
  if(!Number.isInteger(oxygen))throw new Error('polymer-resole-hydroxyl-not-found');
  const hWater=neighbors(fragment,oxygen,'H')[0]?.index;
  const bindings={fragment:{Cformal:formalCarbon,Oformal:oxygen,Hformal:hWater},incoming:{CH:target.carbon,Hring:target.hydrogen}},edits=[];
  addEdit(edits,'breakBond','fragment','Cformal','fragment','Oformal',{from:1});
  addEdit(edits,'breakBond','incoming','CH','incoming','Hring',{from:1});
  addEdit(edits,'formBond','fragment','Cformal','incoming','CH',{from:'absent',order:1});
  addEdit(edits,'formBond','fragment','Oformal','incoming','Hring',{from:'absent',order:1});
  return{source,bindings,edits,expectedByproduct:'water',nextNetworkFeature:'methylene-bridge'};
}
function normalizeComponent(component,fragment,incoming){return graphFromComponent(component,fragment,incoming);}

function applyStepPlan(plan,fragment,incomingInstance,incomingRecord,records,priorByproducts,route){
  const edited=applyGuardedGraphEdits(plan.source,plan.edits,{bindings:plan.bindings});
  const components=graphConnectedComponents(edited.transformedGraph.atoms,edited.transformedGraph.bonds);
  let mainComponent=null;const byproducts=[...priorByproducts];
  for(const component of components){
    const isMain=component.atoms.some(atom=>atom.id==='fragment:0');
    const graph=normalizeComponent(component,fragment,incomingInstance);
    if(isMain){if(mainComponent)throw new Error('multiple-polymer-main-fragments');mainComponent=graph;continue;}
    const product=matchDatabaseProduct({atoms:graph.atoms,bonds:graph.bonds},[...records.values()]);
    if(!product||product.id!==plan.expectedByproduct)throw new Error('polymer-byproduct-not-in-molecule-database');
    const formationIndex=byproducts.length;
    byproducts.push({species:product.id,instanceId:`polymer-byproduct:${incomingInstance.batchGeneration}:${formationIndex+1}`,formationIndex,graph,atomOrigins:graph.atomOrigins});
  }
  if(!mainComponent)throw new Error('polymer-main-fragment-missing');
  if(plan.expectedByproduct&&byproducts.length===priorByproducts.length)throw new Error('polymer-required-byproduct-missing');
  if(!plan.expectedByproduct&&components.length!==1)throw new Error('unexpected-polymer-byproduct');
  const activeRef=plan.nextActive;
  if(activeRef){
    const oldRoleIndex=activeRef.index,newId=`${activeRef.role}:${oldRoleIndex}`;
    const all=graphConnectedComponents(edited.transformedGraph.atoms,edited.transformedGraph.bonds).flatMap(component=>component.atoms);
    const found=all.find(atom=>atom.id===newId);
    if(!found||!mainComponent.atomOrigins.some((origin,index)=>origin.instanceId===incomingInstance.id&&origin.sourceAtomIndex===oldRoleIndex&&mainComponent.atoms[index].element===found.element))throw new Error('polymer-active-site-not-in-main-fragment');
    const originIndex=mainComponent.atomOrigins.findIndex(origin=>origin.instanceId===incomingInstance.id&&origin.sourceAtomIndex===oldRoleIndex);
    if(plan.nextActive.type==='oxygen')mainComponent.activeOxygenAtom=originIndex;else mainComponent.activeEndAtom=originIndex;
  }
  if(plan.chainStart!=null){
    const startOrigin=plan.initialStartOrigin??{instanceId:fragment.atomOrigins.find(origin=>origin.instanceId)?.instanceId,sourceAtomIndex:plan.chainStart};
    const index=mainComponent.atomOrigins.findIndex(origin=>origin.instanceId===startOrigin.instanceId&&origin.sourceAtomIndex===startOrigin.sourceAtomIndex);
    if(index<0)throw new Error('polymer-chain-start-not-in-fragment');mainComponent.chainStartAtom=index;
  }else if(Number.isInteger(fragment.chainStartAtom))mainComponent.chainStartAtom=mainComponent.atomOrigins.findIndex(origin=>origin.instanceId===fragment.atomOrigins[fragment.chainStartAtom]?.instanceId&&origin.sourceAtomIndex===fragment.atomOrigins[fragment.chainStartAtom]?.sourceAtomIndex);
  mainComponent.unitInstanceIds=[...fragment.unitInstanceIds,incomingInstance.id];
  mainComponent.interUnitLinks=(fragment.interUnitLinks??0)+1;
  mainComponent.networkFeatures=[...new Set([...(fragment.networkFeatures??[]),...(plan.nextNetworkFeature?[plan.nextNetworkFeature]:[])])];
  mainComponent.ringOpenings=(fragment.ringOpenings??0)+(plan.ringOpeningDelta??0);
  const consumed=[...route._consumedPreview];
  validateSourcePartition(consumed,mainComponent,byproducts,records);
  const continuations=valenceDeficits(mainComponent);
  validateMainGraph(mainComponent,continuations,{network:route.builder==='network'});
  mainComponent.continuations=continuations;
  return{fragment:mainComponent,byproducts,continuations,edited};
}

function conditionPasses(route,environment){return environmentMatches({requires:route.environment.requires,forbids:route.environment.forbids},environment);}
function exactRoute(slots,routes){
  const active=(slots??[]).filter(Boolean);if(!active.length||new Set(active).size!==active.length)return null;
  const key=[...active].sort().join('|');return routes.find(route=>[...route.feedSpecies].sort().join('|')===key)??null;
}

export function createReactionLabPolymerizationCore({records=[],routes=[],sitePatterns=[]}={}){
  const recordsById=new Map(records.map(record=>[record.id,record])),patternsById=new Map(sitePatterns.map(pattern=>[pattern.id,pattern]));
  let transaction=null,sequence=0;

  function routeFor(slots){return exactRoute(slots,routes);}
  function beginBatch({activeSlots,batchGeneration,instances=[],environment=new Set()}={}){
    if(transaction&&transaction.state!==POLYMERIZATION_STATES.SAMPLE)return{owned:false,reason:'polymer-transaction-active'};
    const route=routeFor(activeSlots);if(!route)return{owned:false,reason:'no-exact-polymer-route'};
    if(!Number.isSafeInteger(batchGeneration)||batchGeneration<0)return{owned:true,ok:false,reason:'invalid-batch-generation',routeId:route.routeId};
    const available=instances.filter(item=>item?.batchGeneration===batchGeneration&&!item.busy&&recordsById.has(item.species));
    const reserved=[];
    for(const species of route.representativeSequence){const used=reserved.filter(item=>item.species===species).length;const candidate=available.filter(item=>item.species===species&&!reserved.some(reservedItem=>reservedItem.id===item.id)).sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0];if(!candidate)return{owned:true,ok:false,reason:'insufficient-feed',routeId:route.routeId,species};reserved.push(candidate);}
    const initial=reserved[0],initialGraph=normalizeMoleculeGraph(recordsById.get(initial.species));
    initialGraph.atomOrigins=initialGraph.atoms.map((_,sourceAtomIndex)=>({instanceId:initial.id,sourceAtomIndex}));
    initialGraph.unitInstanceIds=[initial.id];initialGraph.networkFeatures=[];initialGraph.ringOpenings=0;initialGraph.interUnitLinks=0;
    const tx={routeId:route.routeId,polymerId:route.polymerId,batchGeneration,state:POLYMERIZATION_STATES.WAITING,stepKind:route.transformFamilies[0],waitReason:'player',fragment:initialGraph,reservedInstanceIds:reserved.map(item=>item.id),consumedInstanceIds:[initial.id],byproducts:[],evidence:{},manualStepCount:0,automaticStepCount:0,fallbackManualStepCount:0,sequenceIndex:1,environment:new Set(environment),pending:null,route,unitInstances:[initial],_allReserved:reserved,sample:null};
    tx._sourceInitialInstance=initial;
    transaction=tx;
    if(!conditionPasses(route,tx.environment))tx.waitReason='conditions';
    return{owned:true,ok:true,routeId:route.routeId,polymerId:route.polymerId,reservedInstanceIds:[...tx.reservedInstanceIds],initialInstanceId:initial.id,snapshot:snapshot()};
  }

  function nextInstance(){
    if(!transaction)return null;
    const species=transaction.route.representativeSequence[transaction.sequenceIndex];if(!species)return null;
    return transaction.unitInstances.find(item=>item.species===species&&!transaction.consumedInstanceIds.includes(item.id))??
      transaction._allReserved?.find(item=>item.species===species&&!transaction.consumedInstanceIds.includes(item.id))??null;
  }
  function selectIncoming(instanceId){
    if(!transaction)throw new Error('polymer-sequence-instance-mismatch');
    const species=transaction.route.representativeSequence[transaction.sequenceIndex],wanted=transaction._allReserved?.find(item=>item.id===instanceId);
    if(!species||!wanted||wanted.species!==species||transaction.consumedInstanceIds.includes(instanceId))throw new Error('polymer-sequence-instance-mismatch');return wanted;
  }
  function familyFor(record,route){
    if(route.transformFamilies.includes('diene')&&patternsById.has('polymer-conjugated-diene-1-4')&&firstSite(normalizeMoleculeGraph(record),patternsById.get('polymer-conjugated-diene-1-4')))return'diene';
    if(route.transformFamilies.includes('epoxide'))return'epoxide';
    if(route.transformFamilies.includes('ester-condensation'))return'ester-condensation';
    if(route.transformFamilies.includes('amide-condensation'))return'amide-condensation';
    if(route.builder==='network')return null;
    if(route.transformFamilies.includes('vinyl'))return'vinyl';
    if(route.transformFamilies.includes('phenol-methylolation'))return'phenol-methylolation';
    throw new Error(`unsupported-polymer-family:${route.routeId}`);
  }
function planFor(tx,incoming){
    const route=tx.route,record=recordsById.get(incoming.species),stepIndex=tx.sequenceIndex;
    if(route.builder==='network'){
      if(stepIndex===1)return phenolMethylolationPlan(tx.fragment,record,patternsById,{phenolInstanceId:tx.unitInstances.at(-1).id,atomOrigins:tx.fragment.atomOrigins});
      if(stepIndex===2){const methylol=tx.unitInstances.at(-1);return phenolBridgePlan(tx.fragment,record,patternsById,{methylolInstanceId:methylol.id,phenolInstanceId:incoming.id});}
      return phenolMethylolationPlan(tx.fragment,record,patternsById,{phenolInstanceId:tx.unitInstances.at(-1).id,atomOrigins:tx.fragment.atomOrigins});
    }
    const family=familyFor(record,route);
    if(stepIndex===1&&route.transformFamilies.includes('diene')&&route.transformFamilies.includes('vinyl')){
      const fragmentFamily=familyFor(recordsById.get(tx.unitInstances[0].species),route);
      if(fragmentFamily!==family)return mixedInitialChainPlan(tx.fragment,record,patternsById,{fragmentFamily,incomingFamily:family});
    }
    if(family==='vinyl')return vinylPlan(tx.fragment,record,patternsById,{initial:stepIndex===1});
    if(family==='diene')return dienePlan(tx.fragment,record,patternsById,{initial:stepIndex===1});
    if(family==='epoxide')return epoxidePlan(tx.fragment,record,patternsById,{initial:stepIndex===1});
    if(family==='ester-condensation'){
      const recordHasAmine=!!firstSite(normalizeMoleculeGraph(record),patternsById.get('polymer-amine'));
      return condensePlan(tx.fragment,record,route,patternsById,recordHasAmine?'amine':'alcohol');
    }
    if(family==='amide-condensation')return condensePlan(tx.fragment,record,route,patternsById,'amine');
    throw new Error(`unsupported-polymer-family:${route.routeId}`);
  }
function interactionFor(plan,sequenceIndex){
  const edit=plan.edits.find(item=>item.op==='formBond'&&item.from==='absent'&&((item.a?.startsWith('fragment.')&&item.b?.startsWith('incoming.'))||(item.a?.startsWith('incoming.')&&item.b?.startsWith('fragment.'))));
  if(!edit)return null;
  const fragmentLabel=edit.a.startsWith('fragment.')?edit.a.slice('fragment.'.length):edit.b.slice('fragment.'.length),incomingLabel=edit.a.startsWith('incoming.')?edit.a.slice('incoming.'.length):edit.b.slice('incoming.'.length);
  const fragmentAtomIndex=plan.bindings.fragment?.[fragmentLabel],incomingAtomIndex=plan.bindings.incoming?.[incomingLabel];
  if(!Number.isInteger(fragmentAtomIndex)||!Number.isInteger(incomingAtomIndex))return null;
  const semantic=sequenceIndex===1?'CHAIN START':plan.nextFamily==='ester-condensation'||plan.nextFamily==='amide-condensation'?'REACTIVE END':plan.nextFamily==='phenol-methylolation'||plan.nextFamily==='phenol-methylene-bridge'?'NETWORK SITE':'ACTIVE END';
  return{fragmentAtomIndex,incomingAtomIndex,semantic};
}
  function prepareStep(instanceId,kind){
    const tx=transaction;if(!tx||![POLYMERIZATION_STATES.WAITING,POLYMERIZATION_STATES.AUTO_PENDING].includes(tx.state))throw new Error('polymer-step-not-available');
    if(!conditionPasses(tx.route,tx.environment)){tx.waitReason='conditions';throw new Error('polymer-conditions-not-met');}
    const incoming=selectIncoming(instanceId),plan=planFor(tx,incoming);
    const consumedPreview=[...tx.unitInstances,incoming];
    const route={...tx.route,_consumedPreview:consumedPreview};
    // Preflight uses private graphs. A failed target or byproduct leaves the
    // visible transaction and all source instances unchanged.
    const preflight=applyStepPlan(plan,tx.fragment,incoming,recordsById.get(incoming.species),recordsById,tx.byproducts,route);
    return{incoming,plan,preflight,kind};
  }
  function beginManualStep(instanceId,{geometryValid=true}={}){
    const tx=transaction;if(!tx)return{ok:false,reason:'no-polymer-transaction'};
    if(tx.state!==POLYMERIZATION_STATES.WAITING||tx.pending)return{ok:false,reason:'state-locked'};
    if(!conditionPasses(tx.route,tx.environment)){tx.waitReason='conditions';return{ok:false,reason:'conditions'};}
    if(tx.manualStepCount>=tx.route.interactionCadence.manualSteps&&tx.waitReason!=='auto-fallback')return{ok:false,reason:'manual-cadence-complete'};
    if(!geometryValid)return{ok:false,reason:'geometry-invalid'};
    try{tx.pending=prepareStep(instanceId,'manual');tx.state=POLYMERIZATION_STATES.TRANSFORMING;tx.pending.dwellMs=0;tx.waitReason=null;return{ok:true,routeId:tx.routeId,incomingInstanceId:instanceId};}
    catch(error){return{ok:false,reason:String(error?.message??error)};}
  }
  function previewManualStep(instanceId){
    const tx=transaction;if(!tx||![POLYMERIZATION_STATES.WAITING,POLYMERIZATION_STATES.AUTO_PENDING].includes(tx.state))return{ok:false,reason:'state-locked'};
    try{
      const prepared=prepareStep(instanceId,'preview'),interaction=interactionFor(prepared.plan,tx.sequenceIndex);
      return interaction?{ok:true,instanceId,interaction,stepKind:tx.stepKind}:{ok:false,reason:'interaction-site-unavailable'};
    }catch(error){return{ok:false,reason:String(error?.message??error)};}
  }
  function beginAutomaticStep(instanceId,{geometryValid=true}={}){
    const tx=transaction;if(!tx||tx.state!==POLYMERIZATION_STATES.AUTO_PENDING)return{ok:false,reason:'state-locked'};
    if(!conditionPasses(tx.route,tx.environment)){tx.state=POLYMERIZATION_STATES.WAITING;tx.waitReason='conditions';return{ok:false,reason:'conditions'};}
    if(!geometryValid)return{ok:false,reason:'geometry-invalid'};
    try{tx.pending=prepareStep(instanceId,'automatic');tx.state=POLYMERIZATION_STATES.TRANSFORMING;tx.pending.dwellMs=0;tx.waitReason=null;return{ok:true,routeId:tx.routeId,incomingInstanceId:instanceId};}
    catch(error){tx.state=POLYMERIZATION_STATES.WAITING;tx.waitReason='auto-fallback';return{ok:false,reason:String(error?.message??error)};}
  }
  function autoFallback(){if(!transaction||transaction.state!==POLYMERIZATION_STATES.AUTO_PENDING)return false;transaction.state=POLYMERIZATION_STATES.WAITING;transaction.waitReason='auto-fallback';return true;}
  function rollbackPending(reason='player'){
    if(!transaction||transaction.state!==POLYMERIZATION_STATES.TRANSFORMING)return false;
    transaction.pending=null;transaction.state=POLYMERIZATION_STATES.WAITING;transaction.waitReason=reason;return true;
  }
  function commitPending(){
    const tx=transaction;if(!tx?.pending)throw new Error('missing-polymer-pending-step');
    const {incoming,plan,preflight,kind}=tx.pending;
    // Re-run the deterministic graph guard at the commit boundary.
    const committed=applyStepPlan(plan,tx.fragment,incoming,recordsById.get(incoming.species),recordsById,tx.byproducts,{...tx.route,_consumedPreview:[...tx.unitInstances,incoming]});
    tx.fragment=committed.fragment;tx.byproducts=committed.byproducts;tx.unitInstances.push(incoming);tx.consumedInstanceIds.push(incoming.id);tx.sequenceIndex++;
    if(kind==='manual')tx.manualStepCount++;else tx.automaticStepCount++;
    tx.pending=null;tx.waitReason=null;
    const finished=tx.sequenceIndex>=tx.route.representativeSequence.length;
    if(finished){tx.state=POLYMERIZATION_STATES.COMPLETING;tx.sample=makeSample(tx);tx.state=POLYMERIZATION_STATES.SAMPLE;return{committed:true,finished:true,sample:clone(tx.sample),snapshot:snapshot()};}
    if(tx.manualStepCount>=tx.route.interactionCadence.manualSteps&&tx.automaticStepCount<tx.route.interactionCadence.automaticSteps){tx.state=POLYMERIZATION_STATES.AUTO_PENDING;tx.waitReason=null;}
    else{tx.state=POLYMERIZATION_STATES.WAITING;tx.waitReason='player';}
    return{committed:true,finished:false,automaticPending:tx.state===POLYMERIZATION_STATES.AUTO_PENDING,fragment:clone(tx.fragment),snapshot:snapshot()};
  }
  function advanceFixedStep(deltaMs,{visible=true,labOpen=true,normal=true,conditionsValid=true,geometryValid=true}={}){
    const tx=transaction;if(!tx||tx.state!==POLYMERIZATION_STATES.TRANSFORMING||!tx.pending)return{committed:false,reason:'inactive'};
    if(!visible||!labOpen||!normal)return{committed:false,reason:'paused'};
    if(!conditionsValid||!conditionPasses(tx.route,tx.environment)){rollbackPending('conditions');return{committed:false,reason:'conditions'};}
    if(!geometryValid){rollbackPending(tx.pending.kind==='automatic'?'auto-fallback':'player');return{committed:false,reason:'geometry'};}
    if(!Number.isFinite(deltaMs)||deltaMs<0)throw new TypeError('Polymer dwell requires non-negative fixed-step time.');
    tx.pending.dwellMs+=deltaMs;if(tx.pending.dwellMs+1e-9<POLYMER_COMMIT_DWELL_MS)return{committed:false,reason:'dwell'};
    return commitPending();
  }
  function setEnvironment(environment){
    const tx=transaction;if(!tx||![POLYMERIZATION_STATES.WAITING,POLYMERIZATION_STATES.AUTO_PENDING].includes(tx.state))return{ok:false,reason:'environment-locked'};
    tx.environment=new Set(environment??[]);const valid=conditionPasses(tx.route,tx.environment);
    tx.waitReason=valid?(tx.state===POLYMERIZATION_STATES.AUTO_PENDING?null:'player'):'conditions';return{ok:true,valid};
  }
  function sampleDismiss(){if(!transaction||transaction.state!==POLYMERIZATION_STATES.SAMPLE)return null;const sampleId=transaction.sample.sampleId;transaction=null;return sampleId;}
  function makeSample(tx){
    const expected=tx.route.completionEvidence,fragment=tx.fragment,continuations=valenceDeficits(fragment);
    validateMainGraph(fragment,continuations,{network:tx.route.builder==='network'});
    validateSourcePartition(tx.unitInstances,fragment,tx.byproducts,recordsById);
    const waterCount=tx.byproducts.filter(item=>item.species==='water').length;
    if(fragment.unitInstanceIds.length!==expected.unitCount||fragment.interUnitLinks!==expected.interUnitLinks||fragment.ringOpenings!==expected.ringOpenings||waterCount!==expected.byproducts.water)throw new Error('polymer-completion-evidence-mismatch');
    for(const feature of expected.requiredFeatures)if(!fragment.networkFeatures.includes(feature))throw new Error(`polymer-completion-feature-missing:${feature}`);
    const sampleId=`polymer-sample-${tx.batchGeneration}-${++sequence}`;
    return{
      polymerId:tx.polymerId,routeId:tx.routeId,batchGeneration:tx.batchGeneration,sampleId,
      fragment:{atoms:clone(fragment.atoms),bonds:clone(fragment.bonds),atomOrigins:clone(fragment.atomOrigins)},
      representation:{kind:tx.route.presentation.kind,continuations,activeSites:continuations.map(item=>({atomRef:item.atomRef,semantic:'chain-continuation'})),networkCapabilities:tx.route.builder==='network'?['network-continuation']:[],qualifiers:[...tx.route.presentation.qualifiers]},
      evidence:{unitCount:fragment.unitInstanceIds.length,interUnitLinks:fragment.interUnitLinks,ringOpenings:fragment.ringOpenings,byproducts:tx.byproducts.map(item=>({species:item.species,instanceId:item.instanceId,formationIndex:item.formationIndex})),features:[...(fragment.networkFeatures??[])]},
    };
  }
  function snapshot(){
    if(!transaction)return null;
    const tx=transaction;return{
      routeId:tx.routeId,polymerId:tx.polymerId,batchGeneration:tx.batchGeneration,state:tx.state,stepKind:tx.stepKind,waitReason:tx.waitReason,
      fragment:clone(tx.fragment),reservedInstanceIds:[...tx.reservedInstanceIds],consumedInstanceIds:[...tx.consumedInstanceIds],byproductInstanceIds:tx.byproducts.map(item=>item.instanceId),
      evidence:clone(tx.evidence),manualStepCount:tx.manualStepCount,automaticStepCount:tx.automaticStepCount,sequenceIndex:tx.sequenceIndex,
      sample:tx.sample?clone(tx.sample):null,
    };
  }
  return{routeFor,beginBatch,previewManualStep,beginManualStep,beginAutomaticStep,advanceFixedStep,autoFallback,rollbackPending,setEnvironment,sampleDismiss,snapshot,get state(){return transaction?.state??null;},get routeId(){return transaction?.routeId??null;}};
}
