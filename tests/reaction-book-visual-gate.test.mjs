import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {createReactionProgress} from '../src/reaction-progress.js';
import {reactionGroups} from '../src/reaction-encyclopedia.js';
import {GROUP_PREVIEW_SPECS,REACTION_THUMBNAIL_SPECS,reactionThumbnailModel} from '../src/reaction-book-visual.js';

const routes=JSON.parse(readFileSync(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
const authority=createReactionCatalogAuthority({polymerRoutes:routes});
const groupIds=['hydrolysis','esterification','addition','halogenation','ring-opening','hydration','substitution','cycloaddition','oxidation','dehydration','condensation','combustion','polymerization','other'];
const reactionIds=[
 'normal:complete-01-anhydride-hydrolysis',
 'normal:complete-06-ethene-halogenation',
 'normal:complete-21-cyclobutane-dimerization',
 'polymer:polyethylene-coordination',
 'polymer:polyethylene-terephthalate-direct-polycondensation'
];

test('G01: 54 unique reactions in 13 populated groups, verified counted once',()=>{
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
 const progress=createReactionProgress({authority,storage}),model=reactionGroups(authority,progress);
 assert.equal(model.entries.length,54);
 assert.equal(model.groups.length,13);
 assert.equal(new Set(model.entries.map(e=>e.reactionId)).size,54);
 const shared=model.entries.find(e=>e.categoryTags.length>1);
 progress.verify(shared.reactionId);
 assert.equal(reactionGroups(authority,progress).verified,1);
});
test('G02: 14 bounded category SVG animations with distinct scene ownership',()=>{
 assert.deepEqual(Object.keys(GROUP_PREVIEW_SPECS).sort(),groupIds.sort());
 assert.equal(new Set(Object.values(GROUP_PREVIEW_SPECS).map(s=>s.motion)).size,14);
 for(const spec of Object.values(GROUP_PREVIEW_SPECS)){
  assert.equal(spec.renderer,'svg');
  assert.ok(spec.durationMs>=5000&&spec.durationMs<=6000);
  assert.ok(spec.caption.length>0);
 }
});
test('G03b: all 54 authority routes resolve to extant structural drawings',()=>{
 const records=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url)));
 const polymers=JSON.parse(readFileSync(new URL('../data/polymers.json',import.meta.url)));
 const visualKeys=new Set();
 for(const entry of authority.entries()){
  const spec=reactionThumbnailModel(entry,{records,polymerRecords:polymers});
  assert.ok(spec&&spec.inputs.length&&spec.outputs.length,entry.reactionId);
  assert.ok(spec.feature.length>5&&spec.before.length&&spec.after.length,entry.reactionId);
  for(const drawing of [...spec.inputs,...spec.outputs]){
   if(drawing.polymerUnit){assert.equal(entry.kind,'polymer');assert.equal(drawing.src,null);}
   else {assert.ok(drawing.src.startsWith('assets/models/molecule-'),entry.reactionId);assert.ok(readFileSync(new URL('../'+drawing.src,import.meta.url),'utf8').startsWith('<svg'),drawing.src);}
  }
  visualKeys.add(JSON.stringify([spec.inputs.map(x=>x.src),spec.outputs.map(x=>x.src),entry.definition.requires??entry.definition.environment?.requires??[]]));
 }
 assert.equal(authority.entries().length,54);
 assert.equal(visualKeys.size,54,'reaction drawings and conditions must distinguish all routes');
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

test('G3: all category graphics contain no visible text and use the shared cycle',async()=>{
 const {createReactionGroupPreview}=await import('../src/reaction-book-visual.js');
 const original=globalThis.document;
 const make=()=>({classList:{add(){}},dataset:{},setAttribute(){},append(child){this.child=child;},innerHTML:''});
 globalThis.document={createElement:make,createElementNS:make};
 try{for(const id of groupIds){const node=createReactionGroupPreview(id);assert.ok(node.child.innerHTML,id);assert.doesNotMatch(node.child.innerHTML,/<\s*(text|foreignObject)\b/i,id);}}
 finally{globalThis.document=original;}
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/--rb-cycle:\s*5\.6s/);assert.doesNotMatch(css,/--rb-cycle:\s*[23]\./);
 assert.match(css,/\.rb-group-preview:not\(\.rb-visible\)/);assert.match(css,/prefers-reduced-motion:\s*reduce/);
});

test('G2: all polymer products use unit viewer identifiers',()=>{
 const polymers=authority.entries().filter(e=>e.kind==='polymer');assert.equal(polymers.length,25);
 for(const entry of polymers){const output=reactionThumbnailModel(entry).outputs[0];assert.equal(output.polymerUnit,true);assert.equal(output.id,entry.definition.polymerId);assert.equal(output.src,null);}
 const source=readFileSync(new URL('../src/reaction-polymer-thumbnail.js',import.meta.url),'utf8');
 assert.match(source,/mountPolymerUnitPreview/);assert.doesNotMatch(source,/assets\/models\/polymer-/);
});
