import {test} from 'node:test';import assert from 'node:assert/strict';
import {createRun,beginShock,stepRun} from '../src/veil/engine.js';import {createUniverse} from '../src/veil/universe.js';import {VEIL,EXPEDITION} from '../src/veil/config.js';import {shockProfileFor} from '../src/veil/shock.js';
const TNT='2-4-6-trinitrotoluene',player={x:0,y:180},enemy=(id,x,y)=>({id,x,y,angle:0,speed:0,targetSpeed:168,vx:0,vy:0,phase:0,flank:0,lead:0,trail:[]});
const make=()=>createRun(createUniverse(51,{}),VEIL,{fuel:{shock:{molecule:TNT,amount:2,capacity:2}}});
test('TNT defeats each in range once; preserves outside, consumes exactly two',()=>{
 const r=make(),radius=shockProfileFor(TNT).radius;assert.equal(radius,377);assert.ok(radius>EXPEDITION.eaterSeparationRadius*2);
 r.eaters=[enemy(10,player.x+70,player.y),enemy(11,player.x-140,player.y),enemy(12,player.x+radius+10,player.y)];let consumed=0;
 const result=beginShock(r,()=>{consumed++;return true});assert.equal(result.affected,2);assert.deepEqual(r.eaters.map(e=>e.id),[12]);assert.equal(result.remaining,1);assert.equal(result.defeats.length,2);assert.equal(new Set(result.defeats.map(e=>e.enemyId)).size,2);assert.ok(result.defeats.every(e=>e.source==='tnt'&&e.blastId===result.blastId&&e.defeatedAt===0));
 const events=stepRun(r,{x:0,y:0},.02);assert.equal(events.filter(e=>e.type==='eaterDefeated').length,2);assert.equal(stepRun(r,{x:0,y:0},.02).filter(e=>e.type==='eaterDefeated').length,0);
 assert.equal(beginShock(r,()=>{consumed++;return true}).remaining,0);assert.equal(beginShock(r,()=>{consumed++;return true}),false);assert.equal(consumed,2);assert.equal(r.fuel.shock.amount,0);
});
test('reserved defeated slots return after 60 seconds, within bounds and able to pursue',()=>{
 const r=make();r.eaters=[enemy(10,100,180),enemy(11,-120,180)];const result=beginShock(r,()=>true);assert.equal(result.affected,2);r.time=59;stepRun(r,{x:0,y:0},.02);assert.ok(!r.eaters.some(e=>e.id===10||e.id===11));assert.equal(r.pendingEaterRespawns.length,2);
 r.time=60;let events=stepRun(r,{x:0,y:0},.02);assert.equal(r.pendingEaterRespawns.length,0);assert.equal(events.filter(e=>e.type==='eaterRespawn').length,2);const respawned=r.eaters.filter(e=>e.id===10||e.id===11);assert.equal(respawned.length,2);assert.ok(respawned.every(e=>e.x>=VEIL.bounds.left&&e.x<=VEIL.bounds.right&&e.y>=VEIL.bounds.top&&e.y<=VEIL.bounds.bottom&&Math.hypot(e.x-r.player.x,e.y-r.player.y)>EXPEDITION.tntEaterRespawnMinDistance-1));
 const e=respawned[0];e.x=r.player.x+39;e.y=r.player.y;e.angle=Math.PI;e.speed=168;e.vx=-168;e.vy=0;stepRun(r,{x:0,y:0},.1);assert.equal(r.captured,true,'respawned enemy can capture again');
});
