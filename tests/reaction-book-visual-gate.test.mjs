import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {createReactionProgress} from '../src/reaction-progress.js';
import {reactionGroups} from '../src/reaction-encyclopedia.js';
import {GROUP_PREVIEW_SPECS,REACTION_THUMBNAIL_SPECS} from '../src/reaction-book-visual.js';

const routes=JSON.parse(readFileSync(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
const authority=createReactionCatalogAuthority({polymerRoutes:routes});
const groupIds=['hydrolysis','addition','cycloaddition','polymerization'];
const reactionIds=[
 'normal:complete-01-anhydride-hydrolysis',
 'normal:complete-06-ethene-halogenation',
 'normal:complete-21-cyclobutane-dimerization',
 'polymer:polyethylene-coordination',
 'polymer:polyethylene-terephthalate-direct-polycondensation'
];

test('G01: 54 unique reactions in 14 groups, verified counted once',()=>{
 const progress=createReactionProgress({authority}),model=reactionGroups(authority,progress);
 assert.equal(model.entries.length,54);
 assert.equal(model.groups.length,14);
 assert.equal(new Set(model.entries.map(e=>e.reactionId)).size,54);
 const shared=model.entries.find(e=>e.categoryTags.length>1);
 progress.verify(shared.reactionId);
 assert.equal(reactionGroups(authority,progress).verified,1);
});
test('G02: four distinguishable, bounded group SVG animations',()=>{
 assert.deepEqual(Object.keys(GROUP_PREVIEW_SPECS).sort(),groupIds.sort());
 assert.equal(new Set(Object.values(GROUP_PREVIEW_SPECS).map(s=>s.motion)).size,4);
 for(const spec of Object.values(GROUP_PREVIEW_SPECS)){
  assert.equal(spec.renderer,'svg');
  assert.ok(spec.durationMs>=1800&&spec.durationMs<=3000);
  assert.ok(spec.caption.length>0);
 }
});
test('G03: five distinct previews refer only to real reaction IDs',()=>{
 assert.deepEqual(Object.keys(REACTION_THUMBNAIL_SPECS).sort(),reactionIds.sort());
 for(const [id,spec] of Object.entries(REACTION_THUMBNAIL_SPECS)){
  assert.ok(authority.get(id),id);
  assert.ok(spec.before.length&&spec.after.length&&spec.feature.length,id);
  assert.equal(spec.kind,authority.get(id).kind);
 }
 assert.match(REACTION_THUMBNAIL_SPECS['normal:complete-01-anhydride-hydrolysis'].after,/CH3COOH/);
 assert.match(REACTION_THUMBNAIL_SPECS['normal:complete-06-ethene-halogenation'].after,/ClCH2/);
 assert.match(REACTION_THUMBNAIL_SPECS['normal:complete-21-cyclobutane-dimerization'].feature,/四員環/);
 assert.match(REACTION_THUMBNAIL_SPECS['polymer:polyethylene-coordination'].after,/CH2/);
 assert.match(REACTION_THUMBNAIL_SPECS['polymer:polyethylene-terephthalate-direct-polycondensation'].feature,/エステル/);
});
test('G03: previews cannot own progress or mutate chemical authority',()=>{
 const progress=createReactionProgress({authority});
 for(const id of reactionIds){
  assert.equal(progress.getState(id),'notFound');
  const spec=REACTION_THUMBNAIL_SPECS[id];
  assert.ok(!Object.hasOwn(spec,'state'));
  assert.ok(!Object.hasOwn(spec,'definition'));
 }
});
