import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';import {createReactionProgress,REACTION_PROGRESS_KEY} from '../src/reaction-progress.js';import {recipeCandidatePool,chooseFieldRecipe,REACTION_RECIPE_FIELD_CONFIG,placeFieldRecipe,recipeSegmentDistance} from '../src/veil/reaction-recipe-drop.js';import {createUniverse} from '../src/veil/universe.js';import {random} from '../src/veil/map.js';import {REGIONS} from '../src/veil/growth.js';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url))),records=read('../data/molecules.json'),routes=read('../data/polymerization-routes.json').routes,authority=createReactionCatalogAuthority({polymerRoutes:routes});
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
const collection=(count,known=()=>true)=>({discoveredCount:count,hasMolecule:known});
test('discovered inputs determine candidates; hints and verified reactions are excluded',()=>{
 const store=memory(),progress=createReactionProgress({storage:store,authority});assert.equal(recipeCandidatePool({authority,progress,records,collection:collection(0,()=>false)}).length,0);
 const args={authority,progress,records,collection:collection(43)},pool=recipeCandidatePool(args);assert.equal(pool.length,54);assert.equal(pool.filter(x=>x.entry.kind==='normal').length,29);assert.equal(pool.filter(x=>x.entry.kind==='polymer').length,25);
 const a=pool[0].entry.reactionId,b=pool[1].entry.reactionId;assert.equal(progress.claimFieldRecipe(a,'0:1').saved,true);assert.equal(progress.getState(a),'hinted');assert.equal(progress.claimFieldRecipe(b,'0:1').reason,'cap');
 const inputs=new Set(pool[1].guide.species),partial=collection(0,id=>inputs.has(id));assert.ok(recipeCandidatePool({...args,collection:partial}).some(x=>x.entry.reactionId===b));inputs.delete(pool[1].guide.species[0]);assert.ok(!recipeCandidatePool({...args,collection:partial}).some(x=>x.entry.reactionId===b));assert.ok(!recipeCandidatePool({...args,collection:collection(0)}).some(x=>x.entry.reactionId===a));
 const restored=createReactionProgress({storage:store,authority});assert.equal(restored.getState(a),'hinted');assert.equal(restored.fieldRecipeCount('0:1'),1);assert.equal(restored.claimFieldRecipe(a,'0:2').reason,'already-known');assert.equal(restored.claimFieldRecipe(b,'0:2').saved,true);
 for(const e of authority.entries())restored.verify(e.reactionId);assert.equal(recipeCandidatePool({...args,progress:restored}).length,0);assert.ok(store.getItem(REACTION_PROGRESS_KEY));
});
test('one 5% roll per eligible expedition uses existing nearby pickup points',()=>{
 assert.equal(REACTION_RECIPE_FIELD_CONFIG.spawnChance,.05);
 const boundary={authority,progress:createReactionProgress({storage:memory(),authority}),records,collection:collection(43),runId:'boundary',dust:[],player:{x:0,y:0}};
 assert.ok(chooseFieldRecipe({...boundary,random:()=>.049999}));assert.equal(chooseFieldRecipe({...boundary,random:()=>.05}),null);
 const progress=createReactionProgress({storage:memory(),authority}),p=REGIONS.veil,args={authority,progress,records,collection:collection(43),runId:'0:1',dust:createUniverse(42,{}).dust,player:p};let hits=0;for(let seed=1;seed<=1000;seed++)if(chooseFieldRecipe({...args,random:random(seed)}))hits++;assert.ok(hits>25&&hits<75,`1000 seeded runs: ${hits}`);assert.equal(recipeSegmentDistance({x:5,y:0},{x:0,y:0},{x:10,y:0}),0);console.log(`FIELD_RECIPE_SEEDED_HITS ${hits}/1000`);
});

test('successful roll without nearby points stays pending until an existing point is nearby',()=>{const progress=createReactionProgress({storage:memory(),authority}),drop=chooseFieldRecipe({authority,progress,records,collection:collection(43),runId:'0:1',dust:[],player:{x:0,y:0},random:()=>0});assert.equal(drop.pending,true);assert.equal(placeFieldRecipe(drop,[],{x:0,y:0}),null);assert.deepEqual(placeFieldRecipe(drop,[{x:120,y:0,ready:0}],{x:0,y:0}),{reactionId:drop.reactionId,source:'field',x:120,y:0});});
