import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {createReactionProgress} from '../src/reaction-progress.js';
import {reactionGroups} from '../src/reaction-encyclopedia.js';
const routes=JSON.parse(readFileSync(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
test('registry entries remain unique across categories and unreachable route is separate',()=>{
 const authority=createReactionCatalogAuthority({polymerRoutes:routes});const progress=createReactionProgress({authority});const m=reactionGroups(authority,progress);
 assert.equal(m.entries.length,54);assert.equal(new Set(m.entries.map(e=>e.reactionId)).size,54);
 for(const group of m.groups)assert.equal(new Set(group.items.map(e=>e.reactionId)).size,group.items.length);
 assert.equal(m.groups.flatMap(g=>g.items).filter(e=>e.unavailable).every(e=>e.reactionId==='normal:complete-21-cyclobutane-dimerization'),true);
 assert.equal(m.groups.flatMap(g=>g.items).some(e=>e.unavailable),false);
 const e=m.entries.find(x=>x.categoryTags.length>1);progress.verify(e.reactionId);assert.equal(reactionGroups(authority,progress).verified,1);
});
test('all 54 reviewed route categories match the mapping',()=>{
 const expected=JSON.parse(readFileSync(new URL('./fixtures/reaction-encyclopedia-categories.json',import.meta.url)));
 const entries=createReactionCatalogAuthority({polymerRoutes:routes}).entries();
 assert.equal(Object.keys(expected).length,54);
 assert.deepEqual(Object.fromEntries(entries.map(e=>[e.reactionId,e.categoryTags.length?e.categoryTags:['other']])),expected);
});
