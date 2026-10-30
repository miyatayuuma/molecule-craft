import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {createReactionProgress} from '../src/reaction-progress.js';
import {reactionGroups,reactionDetailInfo} from '../src/reaction-encyclopedia.js';
const routes=JSON.parse(readFileSync(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
test('registry entries remain unique across categories and unreachable route is separate',()=>{
 const authority=createReactionCatalogAuthority({polymerRoutes:routes});const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v))};const progress=createReactionProgress({authority,storage});const m=reactionGroups(authority,progress);
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

test('54 route details show formulas, bond change, and required process conditions',()=>{
 const records=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url)));
 const polymerRecords=JSON.parse(readFileSync(new URL('../data/polymers.json',import.meta.url)));
 const authority=createReactionCatalogAuthority({polymerRoutes:routes}),ctx={records,polymerRecords};
 for(const entry of authority.entries()){
   const detail=reactionDetailInfo(entry,ctx);
   assert.ok(detail?.before&&detail.after&&detail.bondChange&&detail.conditions.length,entry.reactionId);
 }
 const pet=reactionDetailInfo(authority.get('polymer:polyethylene-terephthalate-direct-polycondensation'),ctx);
 assert.match(pet.before,/C2H6O2/);assert.match(pet.before,/C8H6O4/);
 assert.match(pet.after,/CH₂/);assert.match(pet.after,/H₂O/);
 assert.ok(pet.conditions.some(x=>x.includes('水の除去')));
 const phenol=reactionDetailInfo(authority.get('polymer:phenol-formaldehyde-resole'),ctx);
 assert.match(phenol.before,/CH2O/);assert.match(phenol.before,/C6H6O/);
 assert.match(phenol.after,/H₂O/);assert.ok(phenol.conditions.some(x=>x.includes('塩基')));
 const pe=reactionDetailInfo(authority.get('polymer:polyethylene-coordination'),ctx);
 assert.doesNotMatch(pe.after,/H₂O/);
});
