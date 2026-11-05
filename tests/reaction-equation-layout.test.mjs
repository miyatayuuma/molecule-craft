import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {reactionThumbnailModel} from '../src/reaction-book-visual.js';
import {reactionEquationLayout,reactionModelMetric} from '../src/reaction-model-layout.js';
import {modelAtomRadius} from '../src/chemistry.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const entries=createReactionCatalogAuthority({polymerRoutes:JSON.parse(read('data/polymerization-routes.json')).routes}).entries();
test('54 equations share one scale and a stable horizontal symbol axis at narrow/mobile/desktop widths',()=>{
 assert.equal(entries.length,54);
 for(const entry of entries){
  const {inputs,outputs}=reactionThumbnailModel(entry);
  for(const width of [264,304,620]){
   const l=reactionEquationLayout(inputs,outputs,width,100);
   assert.equal(l.symbols.filter(s=>s.kind==='arrow').length,1);
   assert.equal(l.symbols.filter(s=>s.kind==='plus').length,inputs.length+outputs.length-2);
   for(const p of l.placements){
    const m=reactionModelMetric(p.item);
    assert.equal(p.y,50);assert.equal(p.scale,l.scale);
    assert.ok(Math.abs(p.modelWidth/m.width-l.scale)<1e-8);
    assert.ok(Math.abs(p.modelHeight/m.height-l.scale)<1e-8);
    assert.ok(p.x>=0&&p.x+p.width<=width,entry.reactionId);
    assert.match(read(m.src),/^<svg/);
    for(const s of l.symbols)assert.ok(s.x<p.x||s.x>p.x+p.width,'symbol owns a separate slot');
   }
   for(const s of l.symbols)assert.equal(s.y,50);
  }
 }
});
test('normalized molecule projections retain element radii independent of original thumbnail fitting',()=>{
 for(const id of ['water','propene']){
  const svg=read(`assets/reaction-models/molecule-${id}.svg`);
  const scale=Number(svg.match(/transform="scale\(([^)]+)\)/)[1]);
  for(const a of svg.matchAll(/<circle[^>]*r="([\d.]+)" fill="url\(#([A-Za-z]+)\)"/g))
   assert.ok(Math.abs(Number(a[1])*scale-modelAtomRadius(a[2]))<.001,`${id}/${a[2]}`);
 }
});
