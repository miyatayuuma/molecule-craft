import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../vendor/three/three.module.min.js';
import { createPreviewModel } from '../src/preview-model.js';
import {
  compileReactionCatalog, reactionCandidates, matchReactionSitePattern,
  environmentsOverlap, environmentMatches, supplementalSelectionCenter, resolveSupplementalParticipants,
  planVisiblePopulation, planReactionExecution,
  REACTION_CATALOG,
} from '../src/reaction-lab-core.js';
import { REACTION_FAMILIES, REACTION_SITE_PATTERNS } from '../src/reaction-lab-authority.js';
import { enumerateCanonicalReactionLabEnvironments } from '../src/reaction-lab-environment.js';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const patternById=new Map(REACTION_SITE_PATTERNS.map(item=>[item.id,item]));
const completeAuthority={patterns:REACTION_SITE_PATTERNS,families:REACTION_FAMILIES,reactions:REACTION_CATALOG};
const compiled=compileReactionCatalog(records);
const pathwayRows=reaction=>compiled.pathways.filter(pathway=>pathway.reaction.id===reaction.id);
const sortedRoleInstances=candidate=>Object.fromEntries(Object.entries(candidate.participantInstances).sort(([a],[b])=>a.localeCompare(b)));

test('the production authority compiles 24 patterns, 11 families and all 29 definitions',()=>{
  assert.equal(REACTION_SITE_PATTERNS.length,24);
  assert.equal(REACTION_FAMILIES.length,11);
  assert.equal(REACTION_CATALOG.length,29);
  assert.equal(compiled.reactions.size,29);
  assert.equal(compiled.pathways.length,198);
  assert.equal(new Set(compiled.pathways.map(item=>item.symmetryClassId)).size,29);
  assert.equal(new Set(compiled.pathways.map(item=>`${item.reaction.reactants.map(row=>row.species).sort().join('|')}=>${item.reaction.products.slice().sort().join('|')}`)).size,28);
  assert.equal(Math.max(...REACTION_CATALOG.map(rule=>pathwayRows(rule).length)),96);
  assert.equal(pathwayRows(REACTION_CATALOG[27]).length,96);
  for(const rule of REACTION_CATALOG){
    const rows=pathwayRows(rule);
    assert.ok(rows.length>0,`${rule.id} has a compiled labelled mapping`);
    assert.equal(new Set(rows.map(item=>item.symmetryClassId)).size,1,`${rule.id} has one source-graph symmetry class`);
    for(const pathway of rows){
      assert.equal(pathway.graphTransition.ok,true,`${rule.id} source guard, atom/element/charge conservation and strict product graphs compile`);
      assert.equal(pathway.geometryConstraints.length,1,`${rule.id} has one canonical hard geometry anchor`);
      assert.ok(pathway.geometryConstraints[0].min>=pathway.geometryConstraints[0].referenceSigmaAngstrom*.75,`${rule.id} hard minimum stays outside soft core`);
    }
  }
  assert.ok(REACTION_FAMILIES.every(family=>family.edits.every(edit=>['breakBond','formBond','changeBondOrder'].includes(edit.op))));
  assert.deepEqual(REACTION_CATALOG.map(item=>item.id),[
    'complete-01-anhydride-hydrolysis','complete-02-anhydride-alcoholysis','complete-03-aspirin-synthesis',
    'complete-04-aspirin-hydrolysis','complete-05-amide-alcoholysis','complete-06-ethene-halogenation',
    'complete-07-sulfur-trioxide-hydration','complete-08-phosphorus-pentachloride-formation',
    'complete-09-ethylene-oxide-acid-cleavage','complete-10-ethylene-oxide-basic-cleavage',
    'complete-11-propene-hydration','complete-12-1-butene-hydration','complete-13-2-butene-hydration',
    'complete-14-isobutene-hydration','complete-15-cyclohexene-hydration','complete-16-methane-chlorination',
    'complete-17-chloromethane-chlorination','complete-18-dichloromethane-chlorination',
    'complete-19-chloroform-chlorination','complete-20-hydrogen-chlorination',
    'complete-21-cyclobutane-dimerization','complete-22-dimethyl-sulfide-oxidation',
    'complete-23-methanol-dehydration','complete-24-urea-hydrolysis','complete-25-carbonyl-sulfide-hydrolysis',
    'complete-26-hydrogen-combustion','complete-27-carbon-monoxide-oxidation',
    'complete-28-methane-combustion','complete-29-difluoromethane-combustion',
  ]);
  assert.equal(compiled.byEncounterSpecies.size,28,'the full production catalog is exposed to the player-facing lookup');
});

test('every production rule produces a complete execution plan through the generic participant and product path',()=>{
  for(const rule of REACTION_CATALOG){
    const family=REACTION_FAMILIES.find(item=>item.id===rule.familyId),encounterRows=rule.reactants.filter(row=>family.roles[row.role].participation==='encounter').sort((a,b)=>a.role.localeCompare(b.role));
    const encounter=encounterRows.map(row=>({species:row.species,id:`${rule.id}:${row.role}`}));
    const candidate=reactionCandidates(encounter,compiled).find(row=>row.reactionId===rule.id);
    assert.ok(candidate,`${rule.id} yields a production lookup candidate`);
    const active=rule.reactants.map(row=>({id:`${rule.id}:${row.role}`,species:row.species,busy:false}));
    const supplemental=resolveSupplementalParticipants(candidate.reaction,candidate,active,()=>0);
    assert.equal(supplemental.ok,true,`${rule.id} resolves only real feed instances`);
    const plan=planReactionExecution({...candidate,...supplemental},records);
    assert.equal(plan.ok,true,`${rule.id} execution compiles`);
    assert.deepEqual(plan.products.map(row=>row.id),rule.products,`${rule.id} preserves ordered and duplicate product instances`);
    assert.equal(new Set(plan.consumedInstanceIds).size,rule.reactants.length,`${rule.id} consumes each stoichiometric role once`);
    assert.equal(plan.atomOrigins.reduce((sum,row)=>sum+row.origins.length,0),rule.reactants.reduce((sum,row)=>sum+byId.get(row.species).atoms.length,0));
    assert.ok(plan.graphTransition.ok&&plan.graphDiff&&plan.matchedSites);
  }
});

test('every unique production product builds finite canonical preview geometry for the shared handoff pipeline',()=>{
  const products=[...new Set(REACTION_CATALOG.flatMap(rule=>rule.products))];
  for(const id of products){
    const record=byId.get(id);assert.ok(record,`${id} resolves through its canonical species ID`);
    const model=createPreviewModel(THREE,record);for(let step=0;step<190;step++)model.step();
    const atoms=model.snapshot().atoms;
    assert.equal(atoms.length,record.atoms.length,`${id} retains every canonical atom`);
    assert.ok(atoms.every(atom=>atom.point.toArray().every(Number.isFinite)),`${id} receives finite shared preview geometry`);
  }
});

test('every production reactant is database-backed and feedable at its authored quantity',()=>{
  for(const rule of REACTION_CATALOG){
    const species=[...new Set(rule.reactants.map(row=>row.species))];
    assert.ok(species.length<=3,`${rule.id} fits the three Feed Rack slots`);
    const population=planVisiblePopulation(species);
    const available=new Map();for(const row of population)available.set(row.species,(available.get(row.species)??0)+1);
    for(const row of rule.reactants)assert.ok(byId.has(row.species),`${rule.id} reactant ${row.species} exists in the canonical molecule DB`);
    for(const product of rule.products)assert.ok(byId.has(product),`${rule.id} product ${product} exists in the canonical molecule DB`);
    for(const [id,count] of Object.entries(rule.reactants.reduce((counts,row)=>({...counts,[row.species]:(counts[row.species]??0)+1}),{})))
      assert.ok(count<=(available.get(id)??0),`${rule.id} can feed ${count} instances of ${id}`);
  }
});

test('all 29 activation gates match the twelve canonical Chamber states, including the BASIC anhydride block',()=>{
  const states=enumerateCanonicalReactionLabEnvironments();assert.equal(states.length,12);
  for(const rule of REACTION_CATALOG)for(const {tokens,snapshot} of states){
    const expected=rule.requires.every(token=>tokens.includes(token))&&!rule.forbids.some(token=>tokens.includes(token));
    assert.equal(environmentMatches(rule,new Set(tokens)),expected,`${rule.id} in ${JSON.stringify(snapshot)}`);
  }
  for(const rule of REACTION_CATALOG.slice(0,2)){
    assert.deepEqual(rule.requires,[]);
    assert.deepEqual(rule.forbids,['basic'],'⑦A blocks BASIC for the two existing anhydride reactions');
    assert.equal(environmentMatches(rule,new Set(['basic'])),false);
    assert.equal(environmentMatches(rule,new Set(['acidic','heat','light'])),true,'Extra active conditions do not block the intended reaction');
  }
});

test('the two shared encounter species have disjoint eligible conditions and no catalog-order winner',()=>{
  const byEncounter=new Map();
  for(const rule of REACTION_CATALOG){
    const family=REACTION_FAMILIES.find(item=>item.id===rule.familyId);
    const key=rule.reactants.filter(row=>family.roles[row.role].participation==='encounter').map(row=>row.species).sort().join('|');
    byEncounter.set(key,[...(byEncounter.get(key)??[]),rule]);
  }
  const overlaps=[...byEncounter.values()].filter(rows=>rows.length>1);
  assert.equal(overlaps.length,1);
  assert.deepEqual(overlaps[0].map(row=>row.id),['complete-09-ethylene-oxide-acid-cleavage','complete-10-ethylene-oxide-basic-cleavage']);
  for(const {tokens} of enumerateCanonicalReactionLabEnvironments())
    assert.ok(overlaps[0].filter(rule=>environmentMatches(rule,new Set(tokens))).length<=1,`No player state exposes both cleavage outcomes: ${tokens.join('+')}`);
  assert.equal(environmentsOverlap(...overlaps[0]),false);
});

test('the finite Feed Rack can reach the eight-instance ⑦B-complete state through two ordinary combustion executions',()=>{
  const slots=['2-butene','difluoromethane','oxygen'];
  let instances=planVisiblePopulation(slots).map((row,index)=>({...row,id:`feed-${row.species}-${index}`,busy:false}));
  assert.equal(instances.length,6);
  const rule=REACTION_CATALOG[28],family=REACTION_FAMILIES.find(item=>item.id===rule.familyId);
  for(let execution=0;execution<2;execution++){
    const encounterRows=rule.reactants.filter(row=>family.roles[row.role].participation==='encounter'),used=new Set();
    const encounter=encounterRows.map(row=>{const instance=instances.find(item=>item.species===row.species&&!used.has(item.id));assert.ok(instance,`Execution ${execution+1} has a real ${row.species} instance`);used.add(instance.id);return{species:instance.species,id:instance.id};});
    const candidate=reactionCandidates(encounter,compiled).find(row=>row.reactionId===rule.id);
    const supplemental=resolveSupplementalParticipants(candidate.reaction,candidate,instances,()=>0);
    const plan=planReactionExecution({...candidate,...supplemental},records);
    assert.equal(supplemental.ok,true);assert.equal(plan.ok,true);
    const consumed=new Set(plan.consumedInstanceIds);assert.equal(consumed.size,rule.reactants.length);
    instances=instances.filter(item=>!consumed.has(item.id));
    instances.push(...plan.products.map((product,index)=>({id:`product-${execution}-${index}`,species:product.id,busy:false})));
    assert.equal(instances.length,6+execution+1,'Products stay in the Chamber; only the actual participants leave');
  }
  const counts=new Map();for(const instance of instances)counts.set(instance.species,(counts.get(instance.species)??0)+1);
  assert.equal(instances.length,8);
  assert.deepEqual(Object.fromEntries([...counts].filter(([,count])=>count>0).sort(([a],[b])=>a.localeCompare(b)),),{
    '2-butene':2,'carbon-dioxide':2,'hydrogen-fluoride':4,
  });
});

test('the per-rule pathway report preserves graph mappings and exposes the frozen manifest arithmetic mismatch',()=>{
  const requested=[4,2,2,2,3,4,4,2,4,4,2,2,4,2,4,8,6,4,2,4,4,2,2,4,2,8,2,96,8];
  const graphAuthority=[4,2,2,2,3,4,6,2,4,4,2,2,4,2,4,8,6,4,2,4,4,2,1,4,2,8,2,96,8];
  assert.equal(requested.reduce((sum,count)=>sum+count,0),197,'⑦A per-rule entries add to 197, not its stated total of 198');
  assert.deepEqual(REACTION_CATALOG.map(rule=>pathwayRows(rule).length),graphAuthority);
  assert.equal(graphAuthority.reduce((sum,count)=>sum+count,0),198);
  const so3=pathwayRows(REACTION_CATALOG[6]);
  assert.equal(so3.length,6,'SO3 has three graph-equivalent S=O sites and water has two explicit H mappings');
  assert.equal(new Set(so3.map(item=>item.symmetryClassId)).size,1,'all six labelled pathways remain and are grouped by complete graph automorphism');
  assert.equal(pathwayRows(REACTION_CATALOG[22]).length,1,'the role labels and atom graph define one methanol dehydration pathway');
});

test('exact-zero neighbor constraints match absent neighbors and exclude chemically incompatible sites',()=>{
  const halo=patternById.get('sigma-halomethane-c-h');
  for(const [species,count] of [['methane',4],['chloromethane',3],['dichloromethane',2],['chloroform',1]])
    assert.equal(matchReactionSitePattern(byId.get(species),halo).length,count,species);
  assert.equal(matchReactionSitePattern(byId.get('carbon-tetrachloride'),halo).length,0,'exact H:0 rejects the CCl4 center');
  assert.equal(matchReactionSitePattern(byId.get('difluoromethane'),halo).length,0,'exact F:0 rejects CH2F2');
  assert.equal(matchReactionSitePattern(byId.get('isobutene'),patternById.get('pi-terminal-disub')).length,1,'H:0 now matches the one disubstituted carbon exactly');
  assert.equal(matchReactionSitePattern(byId.get('vinyl-chloride'),patternById.get('pi-terminal-disub')).length,0,'exact Cl:0 blocks a false positive');
  assert.equal(matchReactionSitePattern(byId.get('methane'),patternById.get('methane-full')).length,24,'four separately labelled H atoms retain 4! mappings');
  assert.equal(matchReactionSitePattern(byId.get('difluoromethane'),patternById.get('ch2f2-full')).length,4,'two H and two F labels retain 2! × 2! mappings');
});

test('alkene patterns share aromatic authority and distinguish terminal substitution by zero counts',()=>{
  const nonAromatic=['pi-ethene','pi-terminal-monosub','pi-terminal-disub','pi-internal-symmetric'];
  for(const id of ['benzene','pyridine','furan'])for(const patternId of nonAromatic)
    assert.deepEqual(matchReactionSitePattern(byId.get(id),patternById.get(patternId)),[],`${patternId} excludes aromatic ${id}`);
  assert.equal(matchReactionSitePattern(byId.get('ethene'),patternById.get('pi-ethene')).length,2);
  const phenolic=matchReactionSitePattern(byId.get('salicylic-acid'),patternById.get('phenolic-oh-transfer'));
  assert.equal(phenolic.length,1,'only the aromatic OH maps; the carboxyl OH does not');
});

test('same-species encounter roles use role-name order and stable instance IDs',()=>{
  for(const rule of [REACTION_CATALOG[20],REACTION_CATALOG[22]]){
    const species=rule.reactants[0].species;
    const pair=[{species,id:'instance-z'},{species,id:'instance-a'}];
    const forward=reactionCandidates(pair,compiled),reverse=reactionCandidates([...pair].reverse(),compiled);
    const relevant=rows=>rows.filter(item=>item.reactionId===rule.id);
    assert.deepEqual(relevant(forward).map(sortedRoleInstances),relevant(reverse).map(sortedRoleInstances),`${rule.id} is input-order invariant`);
    assert.ok(relevant(forward).every(item=>Object.values(item.participantInstances).includes('instance-a')));
    const reorderedReaction={...rule,reactants:[...rule.reactants].reverse()};
    const reorderedCatalog=compileReactionCatalog(records,{...completeAuthority,reactions:REACTION_CATALOG.map(item=>item.id===rule.id?reorderedReaction:item)});
    const after=reactionCandidates(pair,reorderedCatalog).filter(item=>item.reactionId===rule.id);
    assert.deepEqual(after.map(sortedRoleInstances),relevant(forward).map(sortedRoleInstances),`${rule.id} ignores reactant declaration order`);
  }
  const production=reactionCandidates([{species:'ethanol',id:'ethanol'},{species:'acetic-anhydride',id:'anhydride'}],compileReactionCatalog(records));
  assert.ok(production.length>0&&production.every(item=>item.participantInstances.primary==='anhydride'&&item.participantInstances.transferPair==='ethanol'));
});

test('supplemental selection uses the order-independent centroid of unique encounter endpoints',()=>{
  const candidate={participantInstances:{left:'left-1',right:'right-1'},geometryConstraints:[
    {from:{role:'left',atomIndex:0},to:{role:'right',atomIndex:0}},
    {from:{role:'left',atomIndex:1},to:{role:'right',atomIndex:0}},
  ]};
  const positionFor=(role,index)=>role==='left'?(index===0?[0,0,0]:[2,0,0]):[4,0,0];
  const center=supplementalSelectionCenter(candidate,positionFor);
  const reversed=supplementalSelectionCenter({...candidate,geometryConstraints:[...candidate.geometryConstraints].reverse()},positionFor);
  assert.deepEqual(center,[2,0,0]);
  assert.deepEqual(reversed,center,'a repeated endpoint counts once and array order cannot affect the result');
  const reaction={id:'synthetic',reactants:[
    {role:'left',species:'A',participation:'encounter'},{role:'right',species:'B',participation:'encounter'},
    {role:'extra',species:'X',participation:'supplemental'},
  ]};
  const instances=[{id:'z-near',species:'X',busy:false,position:[2.2,0,0]},{id:'a-far',species:'X',busy:false,position:[8,0,0]}];
  const resolve=geometryConstraints=>resolveSupplementalParticipants(reaction,{...candidate,geometryConstraints},instances,item=>Math.hypot(...item.position.map((value,axis)=>value-center[axis])));
  assert.deepEqual(resolve(candidate.geometryConstraints).participantInstances,resolve([...candidate.geometryConstraints].reverse()).participantInstances);
  assert.equal(resolve(candidate.geometryConstraints).participantInstances.extra,'z-near');
});

test('only #9/#10 share a reactant signature and their canonical environments do not overlap',()=>{
  const duplicateReactants=new Map();
  for(const rule of REACTION_CATALOG){const key=rule.reactants.map(item=>`${item.role}:${item.species}`).sort().join('|');duplicateReactants.set(key,[...(duplicateReactants.get(key)??[]),rule]);}
  const duplicates=[...duplicateReactants.values()].filter(rows=>rows.length>1);
  assert.equal(duplicates.length,1);
  assert.deepEqual(duplicates[0].map(item=>item.id),[REACTION_CATALOG[8].id,REACTION_CATALOG[9].id]);
  assert.equal(environmentsOverlap(...duplicates[0]),false);
  const broken=REACTION_CATALOG.map(item=>item.id===REACTION_CATALOG[9].id?{...item,requires:['heat'],forbids:[]}:item);
  assert.throws(()=>compileReactionCatalog(records,{...completeAuthority,reactions:broken}),/duplicate-reaction-definition/);
});

test('different products at the same encounter anchor and environment fail as ambiguous',()=>{
  const base=REACTION_CATALOG[11],pi=REACTION_FAMILIES.find(item=>item.id==='pi-pair-addition');
  const reverse={...pi,id:'pi-pair-addition-reverse-outcome',edits:pi.edits.map(edit=>{
    if(edit.op==='formBond'&&edit.a==='substrate.left'&&edit.b==='transferPair.incoming')return{...edit,a:'substrate.right'};
    if(edit.op==='formBond'&&edit.a==='substrate.right'&&edit.b==='transferPair.transfer')return{...edit,a:'substrate.left'};
    return edit;
  })};
  const alternate={...base,id:'negative-1-butene-hydration-regioisomer',familyId:reverse.id,products:['1-butanol']};
  assert.throws(()=>compileReactionCatalog(records,{...completeAuthority,families:[...REACTION_FAMILIES,reverse],reactions:[base,alternate]}),/ambiguous-reaction-definition/);
});

test('pattern enumeration throws at the safety cap without silently truncating labelled mappings',()=>{
  assert.throws(()=>matchReactionSitePattern(byId.get('methane'),patternById.get('methane-full'),{limit:23}),/pattern-match-overflow/);
  assert.throws(()=>compileReactionCatalog(records,{...completeAuthority,maxMatches:3}),/pattern-match-overflow/);
});
