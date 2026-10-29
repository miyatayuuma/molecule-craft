import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileReactionCatalog, reactionCandidates, planReactionExecution, resolveSupplementalParticipants, environmentMatches, createContactMatcher, matchReactionSitePattern, matchDatabaseProduct } from '../src/reaction-lab-core.js';
import { formalChargeForRecordAtom, setMoleculeDatabase, moleculeCatalog } from '../src/chemistry.js?v=23';

const productionRecords=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const productionById=new Map(productionRecords.map(record=>[record.id,record]));
const sigma={H:2.6,C:3.4,N:3.3,O:3.1,S:3.6,Cl:3.5,P:3.6,F:3.0};
function record(id,elements,bonds,{charges={}}={}){
  return{id,atoms:elements.map((element,index)=>charges[index]?{element,formalCharge:charges[index]}:element),bonds,nonbonded:{sigmaAngstrom:elements.map(element=>sigma[element]),epsilonKcalMol:elements.map(()=>0),atomicChargesE:elements.map(()=>0)}};
}
function system(additional,patterns,family,reaction){
  const records=[...productionRecords,...additional];
  const catalog=compileReactionCatalog(records,{patterns,families:[family],reactions:[reaction]});
  return{records,catalog};
}
const atom=(label,element,degree,neighborCounts={},extra={})=>({label,element,degree,neighborCounts,...extra});
const pattern=(id,atoms,bonds=[])=>({id,atoms,bonds});
const encounter=(species,role,patternId)=>({role,species,participation:'encounter',patternId});
const familyRole=(participation,patterns=[])=>({participation,patterns});
const geometry=(from,to)=>({constraints:[{from,to,reference:'canonical-sigma',minRatio:.8,targetRatio:.9,maxRatio:1.1}]});
const family=(id,roles,edits,geometryValue=geometry(`${Object.keys(roles)[0]}.center`,`${Object.keys(roles)[1]}.center`))=>({id,roles,edits,geometry:geometryValue});

test('alkene addition fixture edits three bonds and validates only its declared DB product',()=>{
  const dce=record('fixture-dichloroethane',['C','C','Cl','Cl','H','H','H','H'],[[0,1,1],[0,2,1],[1,3,1],[0,4,1],[0,5,1],[1,6,1],[1,7,1]]);
  const patterns=[
    pattern('ethene-site',[atom('c1','C',3,{H:2},{aromatic:false}),atom('c2','C',3,{H:2},{aromatic:false})],[['c1','c2',2]]),
    pattern('chlorine-pair',[atom('cl1','Cl',1,{Cl:1}),atom('cl2','Cl',1,{Cl:1})],[['cl1','cl2',1]]),
  ];
  const fam=family('alkene-addition',{alkene:familyRole('encounter',['ethene-site']),halogen:familyRole('encounter',['chlorine-pair'])},[
    {op:'changeBondOrder',a:'alkene.c1',b:'alkene.c2',from:2,to:1},{op:'breakBond',a:'halogen.cl1',b:'halogen.cl2',from:1},
    {op:'formBond',a:'alkene.c1',b:'halogen.cl1',from:'absent',order:1},{op:'formBond',a:'alkene.c2',b:'halogen.cl2',from:'absent',order:1},
  ],geometry('alkene.c1','halogen.cl1'));
  const rxn={id:'fixture-alkene-addition',familyId:fam.id,reactants:[{role:'alkene',species:'ethene'},{role:'halogen',species:'chlorine'}],products:[dce.id],requires:[],forbids:[]};
  const{records,catalog}=system([dce],patterns,fam,rxn),candidate=reactionCandidates([{species:'ethene',id:'e'},{species:'chlorine',id:'cl'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);assert.equal(plan.graphDiff.bondOrderChanges.length,1);assert.equal(plan.graphDiff.brokenBonds.length,1);assert.equal(plan.graphDiff.formedBonds.length,2);assert.equal(plan.products[0].id,dce.id);
});

test('generic cleavage fixture maps one source bond break into three ordered product graphs',()=>{
  const cn=record('fixture-cn',['C','N'],[[0,1,1]]),oxygen=record('fixture-o2',['O','O'],[[0,1,1]]),carbon=record('fixture-carbon',['C'],[]),nitrogen=record('fixture-nitrogen',['N'],[]),oxygenProduct=record('fixture-oxygen',['O','O'],[[0,1,1]]),patterns=[
    pattern('fixture-cn-site',[atom('carbon','C',1,{N:1}),atom('nitrogen','N',1,{C:1})],[['carbon','nitrogen',1]]),
    pattern('fixture-o2-site',[atom('left','O',1,{O:1}),atom('right','O',1,{O:1})],[['left','right',1]]),
  ],fam=family('fixture-three-product-cleavage',{cn:familyRole('encounter',['fixture-cn-site']),oxygen:familyRole('encounter',['fixture-o2-site'])},[
    {op:'breakBond',a:'cn.carbon',b:'cn.nitrogen',from:1},
  ],geometry('cn.carbon','oxygen.left'));
  const rxn={id:'fixture-three-product-cleavage',familyId:fam.id,reactants:[{role:'cn',species:cn.id},{role:'oxygen',species:oxygen.id}],products:[carbon.id,nitrogen.id,oxygenProduct.id],requires:[],forbids:[]},
    {records,catalog}=system([cn,oxygen,carbon,nitrogen,oxygenProduct],patterns,fam,rxn),candidate=reactionCandidates([{species:cn.id,id:'cn-1'},{species:oxygen.id,id:'o2-1'}],catalog)[0],execution=planReactionExecution(candidate,records);
  assert.equal(execution.ok,true);assert.deepEqual(execution.products.map(item=>item.id),[carbon.id,nitrogen.id,oxygenProduct.id]);assert.equal(execution.graphDiff.brokenBonds.length,1);assert.equal(execution.atomOrigins.length,3);assert.deepEqual(execution.atomOrigins.map(product=>product.origins.length),[1,1,2]);assert.equal(execution.atomOrigins.flatMap(product=>product.origins).length,4);
});

test('oxidation fixture transfers oxygen and explicit hydrogen into multiple registered products',()=>{
  const patterns=[
    pattern('sulfide-site',[atom('sulfur','S',2,{C:2}),atom('methylLeft','C',4,{H:3,S:1}),atom('methylRight','C',4,{H:3,S:1})],[['sulfur','methylLeft',1],['sulfur','methylRight',1]]),
    pattern('peroxide-site',[atom('oxygenLeft','O',2,{O:1,H:1}),atom('oxygenTransfer','O',2,{O:1,H:1}),atom('hydrogenLeft','H',1,{O:1}),atom('transferH','H',1,{O:1})],[['oxygenLeft','oxygenTransfer',1],['oxygenLeft','hydrogenLeft',1],['oxygenTransfer','transferH',1]]),
  ];
  const fam=family('sulfide-oxidation',{sulfide:familyRole('encounter',['sulfide-site']),peroxide:familyRole('encounter',['peroxide-site'])},[
    {op:'breakBond',a:'peroxide.oxygenLeft',b:'peroxide.oxygenTransfer',from:1},{op:'breakBond',a:'peroxide.oxygenTransfer',b:'peroxide.transferH',from:1},
    {op:'formBond',a:'peroxide.oxygenLeft',b:'peroxide.transferH',from:'absent',order:1},{op:'formBond',a:'sulfide.sulfur',b:'peroxide.oxygenTransfer',from:'absent',order:2},
  ],geometry('sulfide.sulfur','peroxide.oxygenTransfer'));
  const rxn={id:'fixture-sulfide-oxidation',familyId:fam.id,reactants:[{role:'sulfide',species:'dimethyl-sulfide'},{role:'peroxide',species:'hydrogen-peroxide'}],products:['dimethyl-sulfoxide','water'],requires:[],forbids:[]};
  const{records,catalog}=system([],patterns,fam,rxn),candidate=reactionCandidates([{species:'dimethyl-sulfide',id:'s'},{species:'hydrogen-peroxide',id:'p'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);assert.deepEqual(plan.products.map(item=>item.id),['dimethyl-sulfoxide','water']);assert.equal(plan.graphDiff.formedBonds.find(item=>item.order===2)?.b,'peroxide:1');assert.equal(plan.atomOrigins.reduce((sum,item)=>sum+item.origins.length,0),13);
});

test('inorganic hydration fixture captures SO3 symmetry, changes bond order and transfers H explicitly',()=>{
  const patterns=[
    pattern('so3-oxygen-site',[atom('sulfur','S',3,{O:3}),atom('reactiveO','O',1,{S:1})],[['sulfur','reactiveO',2]]),
    pattern('water-site',[atom('oxygen','O',2,{H:2}),atom('transferH','H',1,{O:1}),atom('otherH','H',1,{O:1})],[['oxygen','transferH',1],['oxygen','otherH',1]]),
  ];
  const fam=family('inorganic-hydration',{sulfurTrioxide:familyRole('encounter',['so3-oxygen-site']),water:familyRole('encounter',['water-site'])},[
    {op:'changeBondOrder',a:'sulfurTrioxide.sulfur',b:'sulfurTrioxide.reactiveO',from:2,to:1},{op:'formBond',a:'sulfurTrioxide.sulfur',b:'water.oxygen',from:'absent',order:1},
    {op:'breakBond',a:'water.oxygen',b:'water.transferH',from:1},{op:'formBond',a:'sulfurTrioxide.reactiveO',b:'water.transferH',from:'absent',order:1},
  ],geometry('sulfurTrioxide.sulfur','water.oxygen'));
  const rxn={id:'fixture-inorganic-hydration',familyId:fam.id,reactants:[{role:'sulfurTrioxide',species:'sulfur-trioxide'},{role:'water',species:'water'}],products:['sulfuric-acid'],requires:[],forbids:[]};
  const{records,catalog}=system([],patterns,fam,rxn),candidates=reactionCandidates([{species:'sulfur-trioxide',id:'s'},{species:'water',id:'w'}],catalog);
  assert.equal(candidates.length,6,'three equivalent SO3 oxygens and two explicit water H labels are retained');assert.equal(new Set(candidates.map(item=>item.symmetryClassId)).size,1,'complete graph automorphisms classify every labelled site as equivalent');
  const plan=planReactionExecution(candidates[0],records);assert.equal(plan.ok,true);assert.equal(plan.graphDiff.bondOrderChanges.length,1);assert.equal(plan.graphDiff.formedBonds.length,2);assert.equal(plan.products[0].id,'sulfuric-acid');
});

test('LIGHT methane chlorination remains environment-gated and captures each replaceable H',()=>{
  const patterns=[
    pattern('methane-hydrogen-site',[atom('carbon','C',4,{H:4}),atom('replaceableH','H',1,{C:1})],[['carbon','replaceableH',1]]),
    pattern('chlorine-pair',[atom('cl1','Cl',1,{Cl:1}),atom('cl2','Cl',1,{Cl:1})],[['cl1','cl2',1]]),
  ];
  const fam=family('radical-substitution',{methane:familyRole('encounter',['methane-hydrogen-site']),chlorine:familyRole('encounter',['chlorine-pair'])},[
    {op:'breakBond',a:'methane.carbon',b:'methane.replaceableH',from:1},{op:'breakBond',a:'chlorine.cl1',b:'chlorine.cl2',from:1},
    {op:'formBond',a:'methane.carbon',b:'chlorine.cl1',from:'absent',order:1},{op:'formBond',a:'chlorine.cl2',b:'methane.replaceableH',from:'absent',order:1},
  ],geometry('methane.carbon','chlorine.cl1'));
  const rxn={id:'fixture-light-chlorination',familyId:fam.id,reactants:[{role:'methane',species:'methane'},{role:'chlorine',species:'chlorine'}],products:['chloromethane','hydrogen-chloride'],requires:['light'],forbids:[]};
  const{records,catalog}=system([],patterns,fam,rxn),candidate=reactionCandidates([{species:'methane',id:'m'},{species:'chlorine',id:'cl'}],catalog)[0];
  assert.equal(catalog.pathways.length,8);assert.equal(new Set(catalog.pathways.map(item=>item.symmetryClassId)).size,1,'all explicit methane C–H and chlorine endpoint variants form one exact automorphism class');assert.equal(environmentMatches(rxn,new Set()),false);assert.equal(environmentMatches(rxn,new Set(['light'])),true);
  const plan=planReactionExecution(candidate,records);assert.equal(plan.ok,true);assert.ok(plan.matchedSites.methane.atomBindings.replaceableH>=0);assert.equal(plan.atomOrigins.reduce((sum,item)=>sum+item.origins.length,0),7);
});

test('HEAT Diels–Alder fixture compiles two distance anchors and ring closure from graph edits',()=>{
  const butadiene=record('fixture-butadiene',['C','C','C','C','H','H','H','H','H','H'],[[0,1,2],[1,2,1],[2,3,2],[0,4,1],[0,5,1],[1,6,1],[2,7,1],[3,8,1],[3,9,1]]);
  const patterns=[
    pattern('diene-site',[atom('left','C',3,{H:2},{aromatic:false}),atom('leftInner','C',3,{H:1},{aromatic:false}),atom('rightInner','C',3,{H:1},{aromatic:false}),atom('right','C',3,{H:2},{aromatic:false})],[['left','leftInner',2],['leftInner','rightInner',1],['rightInner','right',2]]),
    pattern('dienophile-site',[atom('left','C',3,{H:2},{aromatic:false}),atom('right','C',3,{H:2},{aromatic:false})],[['left','right',2]]),
  ];
  const fam=family('diels-alder',{diene:familyRole('encounter',['diene-site']),dienophile:familyRole('encounter',['dienophile-site'])},[
    {op:'changeBondOrder',a:'diene.left',b:'diene.leftInner',from:2,to:1},{op:'changeBondOrder',a:'diene.rightInner',b:'diene.right',from:2,to:1},
    {op:'changeBondOrder',a:'diene.leftInner',b:'diene.rightInner',from:1,to:2},{op:'changeBondOrder',a:'dienophile.left',b:'dienophile.right',from:2,to:1},
    {op:'formBond',a:'diene.left',b:'dienophile.left',from:'absent',order:1},{op:'formBond',a:'diene.right',b:'dienophile.right',from:'absent',order:1},
  ],{constraints:[{from:'diene.left',to:'dienophile.left',reference:'canonical-sigma',minRatio:.8,targetRatio:.9,maxRatio:1.1},{from:'diene.right',to:'dienophile.right',reference:'canonical-sigma',minRatio:.8,targetRatio:.9,maxRatio:1.1}]});
  const rxn={id:'fixture-diels-alder',familyId:fam.id,reactants:[{role:'diene',species:butadiene.id},{role:'dienophile',species:'ethene'}],products:['cyclohexene'],requires:['heat'],forbids:[]};
  const{records,catalog}=system([butadiene],patterns,fam,rxn),candidate=reactionCandidates([{species:butadiene.id,id:'d'},{species:'ethene',id:'e'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(candidate.geometryConstraints.length,2);assert.equal(plan.ok,true);assert.equal(plan.graphDiff.bondOrderChanges.length,4);assert.equal(plan.graphDiff.formedBonds.length,2);assert.equal(plan.products[0].id,'cyclohexene');
});

test('acidic esterification fixture moves a source hydrogen and never sources atoms from pH',()=>{
  const patterns=[
    pattern('carboxylic-acid-site',[atom('acylC','C',3,{O:2,C:1}),atom('carbonylO','O',1,{C:1}),atom('hydroxylO','O',2,{C:1,H:1}),atom('acidMethyl','C',4,{H:3,C:1}),atom('acidH','H',1,{O:1})],[['acylC','carbonylO',2],['acylC','hydroxylO',1],['acylC','acidMethyl',1],['hydroxylO','acidH',1]]),
    pattern('alcohol-site',[atom('oxygen','O',2,{C:1,H:1}),atom('ethylC','C',4),atom('transferH','H',1,{O:1})],[['oxygen','ethylC',1],['oxygen','transferH',1]]),
  ];
  const fam=family('acid-catalyzed-esterification',{acid:familyRole('encounter',['carboxylic-acid-site']),alcohol:familyRole('encounter',['alcohol-site'])},[
    {op:'breakBond',a:'acid.acylC',b:'acid.hydroxylO',from:1},{op:'breakBond',a:'alcohol.oxygen',b:'alcohol.transferH',from:1},
    {op:'formBond',a:'acid.acylC',b:'alcohol.oxygen',from:'absent',order:1},{op:'formBond',a:'acid.hydroxylO',b:'alcohol.transferH',from:'absent',order:1},
  ],geometry('acid.acylC','alcohol.oxygen'));
  const rxn={id:'fixture-acidic-esterification',familyId:fam.id,reactants:[{role:'acid',species:'acetic-acid'},{role:'alcohol',species:'ethanol'}],products:['ethyl-acetate','water'],requires:['acidic'],forbids:[]};
  const{records,catalog}=system([],patterns,fam,rxn),candidate=reactionCandidates([{species:'acetic-acid',id:'acid'},{species:'ethanol',id:'eth'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);assert.deepEqual(plan.products.map(item=>item.id),['ethyl-acetate','water']);assert.ok(plan.matchedSites.alcohol.atomBindings.transferH>=0);assert.equal(plan.atomOrigins.reduce((sum,item)=>sum+item.origins.length,0),17);
  assert.equal(rxn.reactants.some(item=>item.species==='hydrogen-ion'),false);
});

test('2A+B supplemental site is matched, transformed and conserved from a real third instance',()=>{
  const A=record('fixture-A',['C'],[]),B=record('fixture-B',['O','O'],[[0,1,1]]),product=record('fixture-C2O2',['C','C','O','O'],[[0,1,1],[1,2,1],[2,3,1]]);
  const patterns=[pattern('A-center',[atom('center','C',0)]),pattern('B-oxygen-pair',[atom('leftO','O',1,{O:1}),atom('rightO','O',1,{O:1})],[['leftO','rightO',1]])];
  const fam=family('multi-stoich',{a1:familyRole('encounter',['A-center']),a2:familyRole('encounter',['A-center']),b:familyRole('supplemental',['B-oxygen-pair'])},[
    {op:'formBond',a:'a1.center',b:'a2.center',from:'absent',order:1},
    {op:'formBond',a:'a2.center',b:'b.leftO',from:'absent',order:1},
  ],geometry('a1.center','a2.center'));
  const rxn={id:'fixture-2A+B',familyId:fam.id,reactants:[{role:'a1',species:A.id},{role:'a2',species:A.id},{role:'b',species:B.id}],products:[product.id],requires:[],forbids:[]};
  const{records,catalog}=system([A,B,product],patterns,fam,rxn),candidates=reactionCandidates([{species:A.id,id:'encounter-1'},{species:A.id,id:'encounter-2'}],catalog);
  assert.equal(candidates.length,2,'Both labelled supplemental oxygen pathways survive compilation');
  assert.ok(candidates.every(candidate=>Number.isInteger(candidate.bindings.b.leftO)&&Number.isInteger(candidate.bindings.b.rightO)),'Supplemental roles receive complete labelled site bindings');
  assert.equal(new Set(candidates.map(candidate=>candidate.symmetryClassId)).size,1,'Supplemental equivalent sites use whole-role automorphism grouping');
  assert.ok(candidates.every(candidate=>candidate.geometryConstraints.every(constraint=>constraint.from.role!=='b'&&constraint.to.role!=='b')),'Supplemental binding does not add a trigger geometry constraint');
  const candidate=candidates[0],real=[{id:'encounter-1',species:A.id,busy:false},{id:'encounter-2',species:A.id,busy:false},{id:'busy-B',species:B.id,busy:true},{id:'z-B',species:B.id,busy:false},{id:'a-B',species:B.id,busy:false}];
  const supplemental=resolveSupplementalParticipants(candidate.reaction,candidate,real,item=>item.id.endsWith('-B')?4:1);
  assert.equal(supplemental.ok,true);assert.equal(supplemental.participantInstances.b,'a-B');
  const execution=planReactionExecution({...candidate,...supplemental},records);assert.deepEqual(execution.consumedInstanceIds,['encounter-1','encounter-2','a-B']);assert.equal(new Set(execution.consumedInstanceIds).size,3);
  assert.equal(execution.products[0].id,product.id);assert.ok(execution.atomOrigins[0].origins.some(origin=>origin.sourceAtom==='b:0'||origin.sourceAtom==='b:1'),'Product atom origins retain the supplemental source atom');
  assert.ok(execution.graphDiff.formedBonds.some(bond=>bond.a.startsWith('b:')||bond.b.startsWith('b:')),'The declarative edit consumes a supplemental binding');
  assert.equal(resolveSupplementalParticipants(candidate.reaction,candidate,real.filter(item=>item.id!=='a-B'&&item.id!=='z-B'),()=>1).reason,'missing-stoichiometric-participant','Without a real supplemental instance no plan can be reserved');
});

test('supplemental participant-set changes clear old fixed-step dwell continuity',()=>{
  const matcher=createContactMatcher({dwellMs:520}),reaction={id:'fixture-2A+B',reactants:[{role:'a1',species:'A',participation:'encounter'},{role:'a2',species:'A',participation:'encounter'},{role:'b',species:'B',participation:'supplemental'}]},candidate={participantInstances:{a1:'a1',a2:'a2'},reaction},instances=[{id:'B1',species:'B',busy:false},{id:'B2',species:'B',busy:false}];
  let distances={B1:1,B2:5};
  const step=()=>{matcher.beginStep();const resolved=resolveSupplementalParticipants(reaction,candidate,instances,item=>distances[item.id]);assert.equal(resolved.ok,true);const ids=Object.values(resolved.participantInstances).sort(),key=`${reaction.id}:path:${ids.join('|')}:g1`;matcher.markActive(key);matcher.update(key,true,100);matcher.endStep();return key;};
  const b1Key=step();step();step();step();assert.equal(matcher.elapsed(b1Key),300);
  distances={B1:5,B2:1};assert.match(step(),/B2/);assert.equal(matcher.elapsed(b1Key),0,'B1 dwell state is discarded when B2 becomes nearest');
  distances={B1:1,B2:5};assert.equal(step(),b1Key);assert.equal(matcher.elapsed(b1Key),0,'Returning to nearest B1 begins a new dwell interval');
  for(let index=0;index<5;index++)step();assert.equal(matcher.elapsed(b1Key),500);assert.equal(matcher.update(b1Key,true,20),true,'Only a continuous B1 participant set reaches the dwell threshold');
});

test('production formalCharges reach Reaction Core matching, strict mapping and conservation',()=>{
  const ozone=productionById.get('ozone');assert.ok(ozone);assert.equal(formalChargeForRecordAtom(ozone,1),1);assert.equal(formalChargeForRecordAtom(ozone,2),-1);
  const positive=pattern('ozone-positive',[atom('charged','O',2,{}, {formalCharge:1})]);
  const negative=pattern('ozone-negative',[atom('charged','O',1,{}, {formalCharge:-1})]);
  assert.deepEqual(matchReactionSitePattern(ozone,positive).map(binding=>binding.charged),[1]);
  assert.deepEqual(matchReactionSitePattern(ozone,negative).map(binding=>binding.charged),[2]);
  const graph={atoms:[{id:'p',element:'O',formalCharge:0},{id:'c',element:'O',formalCharge:1},{id:'n',element:'O',formalCharge:-1}],bonds:[{a:'p',b:'c',order:1},{a:'c',b:'n',order:2}]};
  const exact={id:'fixture-ozone-charge',atoms:['O','O','O'],formalCharges:{1:1,2:-1},bonds:[[0,1,1],[1,2,2]]};
  const misplaced={id:'fixture-ozone-charge-swapped',atoms:['O','O','O'],formalCharges:{0:-1,1:1},bonds:[[0,1,1],[1,2,2]]};
  assert.equal(matchDatabaseProduct(graph,[exact]),exact);assert.equal(matchDatabaseProduct(graph,[misplaced]),null,'Strict mapping does not move charge between atom origins');
  const shifted={...record('fixture-ozone-charge-shift',['O','O','O'],[[0,1,2],[1,2,1]]),formalCharges:{0:1,2:-1}};
  const patterns=[pattern('charged-ozone',[atom('neutralEnd','O',1,{O:1},{formalCharge:0}),atom('center','O',2,{O:2},{formalCharge:1}),atom('negativeEnd','O',1,{O:1},{formalCharge:-1})],[['neutralEnd','center',2],['center','negativeEnd',1]]),pattern('oxygen-pair',[atom('oA','O',1,{O:1}),atom('oB','O',1,{O:1})],[['oA','oB',2]])];
  const familyValue=family('production-charge-migration',{ozone:familyRole('encounter',['charged-ozone']),oxygen:familyRole('encounter',['oxygen-pair'])},[
    {op:'changeFormalCharge',a:'ozone.center',from:1,to:0},{op:'changeFormalCharge',a:'ozone.neutralEnd',from:0,to:1},
  ],geometry('ozone.center','oxygen.oA'));
  const reaction={id:'fixture-production-formal-charge-edit',familyId:familyValue.id,reactants:[{role:'ozone',species:'ozone'},{role:'oxygen',species:'oxygen'}],products:[shifted.id,'oxygen'],requires:[],forbids:[]};
  const{records,catalog}=system([shifted],patterns,familyValue,reaction),candidate=reactionCandidates([{species:'ozone',id:'ozone-instance'},{species:'oxygen',id:'oxygen-instance'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);assert.deepEqual(plan.graphDiff.formalChargeChanges,[{atom:'ozone:0',from:0,to:1},{atom:'ozone:1',from:1,to:0}], 'Source state, changeFormalCharge edits and result diff all read production formalCharges');
});

test('shared aromatic graph authority excludes benzene, pyridine and furan while preserving ethene',()=>{
  const alkene=pattern('nonaromatic-alkene',[atom('c1','C',undefined,{}, {aromatic:false}),atom('c2','C',undefined,{}, {aromatic:false})],[['c1','c2',2]]);
  for(const species of ['benzene','pyridine','furan'])assert.equal(matchReactionSitePattern(productionById.get(species),alkene).length,0,`${species} ring pi bonds are aromatic`);
  assert.ok(matchReactionSitePattern(productionById.get('ethene'),alkene).length>0,'Non-aromatic ethene remains a valid alkene site');
});

test('production molecule formalCharges validate, freeze and remain readable by the shared helper',()=>{
  setMoleculeDatabase(productionRecords);
  const charged=productionRecords.filter(record=>record.formalCharges!=null);assert.equal(charged.length,6,'All six production charge maps are covered');
  for(const record of charged){
    const stored=moleculeCatalog().find(item=>item.id===record.id);assert.ok(Object.isFrozen(stored.formalCharges),`${record.id}.formalCharges is frozen`);
    for(const[index,charge]of Object.entries(record.formalCharges))assert.equal(formalChargeForRecordAtom(stored,Number(index)),charge);
  }
  const ozone=moleculeCatalog().find(item=>item.id==='ozone');assert.equal(formalChargeForRecordAtom(ozone,1),1);assert.equal(formalChargeForRecordAtom(ozone,2),-1);
});

test('molecule database rejects malformed formal charge maps',()=>{
  const invalid=[
    ['not-object',null],['array',[]],['noncanonical-key',{'01':1}],['non-numeric-key',{wat:1}],
    ['out-of-range',{'3':1}],['fractional',{'1':.5}],['non-finite',{'1':Number.POSITIVE_INFINITY}],['string',{'1':'1'}],
  ];
  for(const[name,formalCharges]of invalid){
    const changed=productionRecords.map(record=>record.id==='ozone'?{...record,formalCharges}:record);
    assert.throws(()=>setMoleculeDatabase(changed),/formalCharges/,name);
  }
});

test('charge-edit fixture requires conserved net formal charge and exact charged DB products',()=>{
  const n=record('fixture-N',['N'],[],{charges:{0:1}}),o=record('fixture-O',['O'],[],{charges:{0:-1}}),n0=record('fixture-N-neutral',['N'],[]),o0=record('fixture-O-neutral',['O'],[]);
  const patterns=[pattern('N-site',[atom('center','N',0)]),pattern('O-site',[atom('center','O',0)])];
  const fam=family('formal-charge-transfer',{n:familyRole('encounter',['N-site']),o:familyRole('encounter',['O-site'])},[{op:'changeFormalCharge',a:'n.center',from:1,to:0},{op:'changeFormalCharge',a:'o.center',from:-1,to:0}],geometry('n.center','o.center'));
  const rxn={id:'fixture-charge-edit',familyId:fam.id,reactants:[{role:'n',species:n.id},{role:'o',species:o.id}],products:[n0.id,o0.id],requires:[],forbids:[]};
  const{records,catalog}=system([n,o,n0,o0],patterns,fam,rxn),candidate=reactionCandidates([{species:n.id,id:'n1'},{species:o.id,id:'o1'}],catalog)[0],plan=planReactionExecution(candidate,records);
  assert.equal(plan.ok,true);assert.equal(plan.graphDiff.formalChargeChanges.length,2);assert.deepEqual(plan.graphDiff.formalChargeChanges.map(item=>item.from).sort((a,b)=>a-b),[-1,1]);assert.deepEqual(plan.graphDiff.formalChargeChanges.map(item=>item.to),[0,0]);
  const unbalanced={...fam,edits:fam.edits.slice(0,1)},unbalancedReaction={...rxn,id:'fixture-unbalanced-charge',familyId:unbalanced.id,products:[n0.id,o.id]};
  assert.throws(()=>compileReactionCatalog(records,{patterns,families:[unbalanced],reactions:[unbalancedReaction]}),/formal-charge-conservation-failed/);
});

function ambiguityFixture({secondProducts=['fixture-A','fixture-B'],secondEdits=[],secondRequires=[],secondForbids=[],firstForbids=[]}={}){
  const A=record('fixture-A',['C'],[]),B=record('fixture-B',['O'],[]),AB=record('fixture-AB',['C','O'],[[0,1,1]]),
    pA=pattern('A-site',[atom('center','C',0)]),pB=pattern('B-site',[atom('center','O',0)]),patterns=[pA,pB];
  const familyA=family('join',{a:familyRole('encounter',['A-site']),b:familyRole('encounter',['B-site'])},[{op:'formBond',a:'a.center',b:'b.center',from:'absent',order:1}],geometry('a.center','b.center'));
  const familyB=family('alternate',{a:familyRole('encounter',['A-site']),b:familyRole('encounter',['B-site'])},secondEdits,geometry('a.center','b.center'));
  const reactions=[{id:'fixture-join',familyId:'join',reactants:[{role:'a',species:A.id},{role:'b',species:B.id}],products:[AB.id],requires:[],forbids:firstForbids},{id:'fixture-alt',familyId:'alternate',reactants:[{role:'a',species:A.id},{role:'b',species:B.id}],products:secondProducts,requires:secondRequires,forbids:secondForbids}];
  return()=>compileReactionCatalog([...productionRecords,A,B,AB],{patterns,families:[familyA,familyB],reactions});
}
test('same actual encounter site cannot select distinct outcomes by order; duplicates are separately classified',()=>{
  assert.throws(ambiguityFixture(),/ambiguous-reaction-definition/);
  assert.throws(ambiguityFixture({secondProducts:['fixture-AB'],secondEdits:[{op:'formBond',a:'a.center',b:'b.center',from:'absent',order:1}]}),/duplicate-reaction-definition/);
  assert.throws(ambiguityFixture({secondRequires:['heat']}),/ambiguous-reaction-definition/,'unconditional and HEAT pathways overlap during heating');
  assert.doesNotThrow(ambiguityFixture({secondRequires:['heat'],firstForbids:['heat']}),'disjoint environment domains do not conflict');
});
