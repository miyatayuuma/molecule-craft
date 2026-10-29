import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {compileReactionGuide,evaluateReactionGuide} from '../src/reaction-lab-guidance.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const records=read('../data/molecules.json'),routes=read('../data/polymerization-routes.json').routes,authority=createReactionCatalogAuthority({polymerRoutes:routes});
test('all 54 definitions have viable rack counts and recognized environment metadata',()=>{
 const entries=authority.entries();assert.equal(entries.length,54);
 for(const e of entries){const g=compileReactionGuide(e,records);assert.equal(g.ok,true,e.reactionId);assert.ok([...g.requires,...g.forbids].every(t=>['light','heat','acidic','basic'].includes(t)),e.reactionId);if(e.kind==='polymer')assert.equal(routes.filter(r=>[...r.feedSpecies].sort().join('|')===[...g.species].sort().join('|')).length,1,e.reactionId);}
});
test('steps respond to rack and environment, including repeated molecules and forbidden values',()=>{
 const guide=compileReactionGuide(authority.get('normal:complete-21-cyclobutane-dimerization'),records);
 assert.equal(guide.counts.ethene,2);assert.equal(evaluateReactionGuide(guide,{}).stage,'material');
 assert.equal(evaluateReactionGuide(guide,{slots:['ethene'],isKnown:()=>false}).stage,'blocked');
 assert.equal(evaluateReactionGuide(guide,{slots:['ethene'],environment:{}}).token,'light');
 assert.equal(evaluateReactionGuide(guide,{slots:['ethene'],environment:{light:true}}).stage,'feed');
 assert.equal(evaluateReactionGuide(guide,{slots:['ethene'],activeSlots:['ethene'],phase:'ACTIVE',environment:{light:true}}).stage,'react');
 const acid=compileReactionGuide(authority.get('normal:complete-05-amide-alcoholysis'),records);
 assert.deepEqual(evaluateReactionGuide(acid,{slots:acid.species,environment:{medium:'basic'}}),{stage:'condition',token:'basic',enable:false});
 assert.equal(evaluateReactionGuide(guide,{slots:['water']}).stage,'remove');
});
