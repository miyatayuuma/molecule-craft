import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  compileReactionCatalog, reactionCandidates, matchReactionSitePattern,
  environmentsOverlap, supplementalSelectionCenter, resolveSupplementalParticipants,
  REACTION_CATALOG,
} from '../src/reaction-lab-core.js';
import { REACTION_FAMILIES, REACTION_SITE_PATTERNS } from '../src/reaction-lab-authority.js';
import { COMPLETE_REACTION_FIXTURE, COMPLETE_REACTION_AUTHORITY } from './fixtures/reaction-lab-complete-catalog.mjs';

const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const byId=new Map(records.map(record=>[record.id,record]));
const patternById=new Map(REACTION_SITE_PATTERNS.map(item=>[item.id,item]));
const compiled=compileReactionCatalog(records,COMPLETE_REACTION_AUTHORITY);
const pathwayRows=reaction=>compiled.pathways.filter(pathway=>pathway.reaction.id===reaction.id);
const sortedRoleInstances=candidate=>Object.fromEntries(Object.entries(candidate.participantInstances).sort(([a],[b])=>a.localeCompare(b)));

test('the complete test-only authority compiles 24 patterns, 11 families and all 29 definitions',()=>{
  assert.equal(REACTION_SITE_PATTERNS.length,24);
  assert.equal(REACTION_FAMILIES.length,11);
  assert.equal(COMPLETE_REACTION_FIXTURE.length,29);
  assert.equal(compiled.reactions.size,29);
  assert.equal(compiled.pathways.length,198);
  assert.equal(new Set(compiled.pathways.map(item=>item.symmetryClassId)).size,29);
  assert.equal(new Set(compiled.pathways.map(item=>`${item.reaction.reactants.map(row=>row.species).sort().join('|')}=>${item.reaction.products.slice().sort().join('|')}`)).size,28);
  assert.equal(Math.max(...COMPLETE_REACTION_FIXTURE.map(rule=>pathwayRows(rule).length)),96);
  assert.equal(pathwayRows(COMPLETE_REACTION_FIXTURE[27]).length,96);
  for(const rule of COMPLETE_REACTION_FIXTURE){
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
  assert.deepEqual(REACTION_CATALOG.map(item=>item.id).sort(),['anhydride-alcoholysis','anhydride-hydrolysis']);
  assert.equal(compiled.byEncounterSpecies.size,28,'the complete fixture is compiled separately from the player-facing lookup');
});

test('the per-rule pathway report preserves graph mappings and exposes the frozen manifest arithmetic mismatch',()=>{
  const requested=[4,2,2,2,3,4,4,2,4,4,2,2,4,2,4,8,6,4,2,4,4,2,2,4,2,8,2,96,8];
  const graphAuthority=[4,2,2,2,3,4,6,2,4,4,2,2,4,2,4,8,6,4,2,4,4,2,1,4,2,8,2,96,8];
  assert.equal(requested.reduce((sum,count)=>sum+count,0),197,'⑦A per-rule entries add to 197, not its stated total of 198');
  assert.deepEqual(COMPLETE_REACTION_FIXTURE.map(rule=>pathwayRows(rule).length),graphAuthority);
  assert.equal(graphAuthority.reduce((sum,count)=>sum+count,0),198);
  const so3=pathwayRows(COMPLETE_REACTION_FIXTURE[6]);
  assert.equal(so3.length,6,'SO3 has three graph-equivalent S=O sites and water has two explicit H mappings');
  assert.equal(new Set(so3.map(item=>item.symmetryClassId)).size,1,'all six labelled pathways remain and are grouped by complete graph automorphism');
  assert.equal(pathwayRows(COMPLETE_REACTION_FIXTURE[22]).length,1,'the role labels and atom graph define one methanol dehydration pathway');
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
  for(const rule of [COMPLETE_REACTION_FIXTURE[20],COMPLETE_REACTION_FIXTURE[22]]){
    const species=rule.reactants[0].species;
    const pair=[{species,id:'instance-z'},{species,id:'instance-a'}];
    const forward=reactionCandidates(pair,compiled),reverse=reactionCandidates([...pair].reverse(),compiled);
    const relevant=rows=>rows.filter(item=>item.reactionId===rule.id);
    assert.deepEqual(relevant(forward).map(sortedRoleInstances),relevant(reverse).map(sortedRoleInstances),`${rule.id} is input-order invariant`);
    assert.ok(relevant(forward).every(item=>Object.values(item.participantInstances).includes('instance-a')));
    const reorderedReaction={...rule,reactants:[...rule.reactants].reverse()};
    const reorderedCatalog=compileReactionCatalog(records,{...COMPLETE_REACTION_AUTHORITY,reactions:COMPLETE_REACTION_FIXTURE.map(item=>item.id===rule.id?reorderedReaction:item)});
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
  for(const rule of COMPLETE_REACTION_FIXTURE){const key=rule.reactants.map(item=>`${item.role}:${item.species}`).sort().join('|');duplicateReactants.set(key,[...(duplicateReactants.get(key)??[]),rule]);}
  const duplicates=[...duplicateReactants.values()].filter(rows=>rows.length>1);
  assert.equal(duplicates.length,1);
  assert.deepEqual(duplicates[0].map(item=>item.id),[COMPLETE_REACTION_FIXTURE[8].id,COMPLETE_REACTION_FIXTURE[9].id]);
  assert.equal(environmentsOverlap(...duplicates[0]),false);
  const broken=COMPLETE_REACTION_FIXTURE.map(item=>item.id===COMPLETE_REACTION_FIXTURE[9].id?{...item,requires:['heat'],forbids:[]}:item);
  assert.throws(()=>compileReactionCatalog(records,{...COMPLETE_REACTION_AUTHORITY,reactions:broken}),/duplicate-reaction-definition/);
});

test('different products at the same encounter anchor and environment fail as ambiguous',()=>{
  const base=COMPLETE_REACTION_FIXTURE[11],pi=REACTION_FAMILIES.find(item=>item.id==='pi-pair-addition');
  const reverse={...pi,id:'pi-pair-addition-reverse-outcome',edits:pi.edits.map(edit=>{
    if(edit.op==='formBond'&&edit.a==='substrate.left'&&edit.b==='transferPair.incoming')return{...edit,a:'substrate.right'};
    if(edit.op==='formBond'&&edit.a==='substrate.right'&&edit.b==='transferPair.transfer')return{...edit,a:'substrate.left'};
    return edit;
  })};
  const alternate={...base,id:'negative-1-butene-hydration-regioisomer',familyId:reverse.id,products:['1-butanol']};
  assert.throws(()=>compileReactionCatalog(records,{...COMPLETE_REACTION_AUTHORITY,families:[...REACTION_FAMILIES,reverse],reactions:[base,alternate]}),/ambiguous-reaction-definition/);
});

test('pattern enumeration throws at the safety cap without silently truncating labelled mappings',()=>{
  assert.throws(()=>matchReactionSitePattern(byId.get('methane'),patternById.get('methane-full'),{limit:23}),/pattern-match-overflow/);
  assert.throws(()=>compileReactionCatalog(records,{...COMPLETE_REACTION_AUTHORITY,maxMatches:3}),/pattern-match-overflow/);
});
