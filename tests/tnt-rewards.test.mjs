import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createReactionCatalogAuthority} from '../src/reaction-catalog-authority.js';
import {createReactionProgress} from '../src/reaction-progress.js';
import {chooseTntRecipe,TNT_RECIPE_CHANCE} from '../src/veil/reaction-recipe-drop.js';
import {releaseEaterAtoms,rewardRoomUnits} from '../src/veil/tnt-rewards.js';
import {MAX_RESOURCE_VALUE} from '../src/veil/resources-persistence.js';
import {GROWTH} from '../src/veil/growth.js';
import {random} from '../src/veil/map.js';
const records=JSON.parse(readFileSync(new URL('../data/molecules.json',import.meta.url))),routes=JSON.parse(readFileSync(new URL('../data/polymerization-routes.json',import.meta.url))).routes;
const authority=createReactionCatalogAuthority({polymerRoutes:routes}),collection={discoveredCount:records.length,hasMolecule:()=>true};
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}};
test('TNT uses the 55% boundary and a shared per-expedition cap',()=>{
 const progress=createReactionProgress({storage:storage(),authority}),args={authority,progress,records,collection,runId:'r'};
 assert.equal(TNT_RECIPE_CHANCE,.55);assert.ok(chooseTntRecipe({...args,random:()=>.549999}));assert.equal(chooseTntRecipe({...args,random:()=>.55}),null);
 const field=authority.entries()[0].reactionId;assert.ok(progress.claimFieldRecipe(field,'r','field').saved);assert.equal(chooseTntRecipe({...args,random:()=>0}),null);
 assert.ok(chooseTntRecipe({...args,runId:'new',random:()=>0}));
});
test('atom emission reserves capacity across multiple defeats and never emits an overfull element',()=>{
 const max=MAX_RESOURCE_VALUE,state={elements:{H:max-3,C:max,N:max,O:max},dust:{H:0,C:0,O:0}};
 const run={elementDust:{H:0,C:0,N:0,O:0},map:{dust:[{element:'H',value:1}]}};
 let a=releaseEaterAtoms(run,state,{x:0,y:0},()=>0),b=releaseEaterAtoms(run,state,{x:20,y:0},()=>0);
 assert.equal(a.H,3);assert.equal(Object.values(b).reduce((x,y)=>x+y,0),0);assert.equal(run.map.dust.filter(d=>d.tntReward).length,1);
 assert.equal(run.map.dust.at(-1).value,3*GROWTH.dustPerAtom.H);assert.equal(rewardRoomUnits(run,state,'H'),9);
 state.elements.H=max;assert.equal(rewardRoomUnits(run,state,'H'),0);
});
test('two defeats emit 80 atom equivalents before pickup',()=>{
 const state={elements:{H:0,C:0,N:0,O:0},dust:{H:0,C:0,O:0}},run={elementDust:{H:0,C:0,N:0,O:0},map:{dust:[{element:'H'}]}};
 for(let i=0;i<2;i++)releaseEaterAtoms(run,state,{x:i*100,y:0},random(i));
 assert.equal(run.map.dust.filter(x=>x.tntReward).reduce((sum,d)=>sum+d.value/(GROWTH.dustPerAtom[d.element]??1),0),80);
 assert.ok(run.map.dust.filter(x=>x.tntReward).length<=8);assert.deepEqual(run.elementDust,{H:0,C:0,N:0,O:0});
});
