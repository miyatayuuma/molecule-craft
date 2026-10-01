import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDustSpatialIndex,dustSpatialIndex,updateDustSpatialMembership} from '../src/veil/dust-spatial-index.js';
import {createUniverse,animateUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {fixture,diagnostics,inputAt} from './helpers/field-particle-fixtures.mjs';
import {VEIL} from '../src/veil/config.js';

// Same production physics, independent full-population candidate traversal.
// Load source transiently, overriding ONLY its query provider. Never persist an
// old engine copy or expose this alternative in a production module.
const engineUrl=new URL('../src/veil/engine.js',import.meta.url);
let oracleSource=await readFile(engineUrl,'utf8');
oracleSource=oracleSource.replace(/from '(\.\/[^']+)'/g,(_,path)=>`from '${new URL(path,engineUrl).href}'`);
oracleSource=oracleSource.replace(new URL('./dust-spatial-index.js',engineUrl).href,new URL('./helpers/full-scan-dust-oracle.mjs',import.meta.url).href);
const oracle=await import(`data:text/javascript;base64,${Buffer.from(oracleSource).toString('base64')}`);
const dust=[{id:9,x:-64,y:-64},{id:1,x:0,y:0},{id:5,x:64,y:64},{id:3,x:-.000001,y:64}];
const index=createDustSpatialIndex(dust,{cellSize:64});
assert.deepEqual(index.queryCircle(0,0,90),dust,'negative, closed cell edges, original order rather than IDs');
assert.deepEqual(index.querySegment({x:-200,y:-200},{x:200,y:200},1),dust,'multi-cell swept query');
assert.equal(new Set(index.queryCircle(0,0,100).map(d=>d.id)).size,4);
dust[0].x=192;dust[0].y=0;assert.equal(index.update(dust[0]),true);assert.equal(index.update(dust[0]),false);assert.ok(!index.queryCircle(-64,-64,1).includes(dust[0]));assert.ok(index.queryCircle(192,0,1).includes(dust[0]));
assert.throws(()=>createDustSpatialIndex(dust,{cellSize:0}));

function compare(a,b,input,frames){
  for(let frame=0;frame<frames;frame++){
    const ea=stepRun(a,input(frame),1/60),eb=oracle.stepRun(b,input(frame),1/60);
    assert.deepEqual(ea,eb,'event payload/order');
    assert.deepEqual(a.player,b.player,'assist and flight exact equivalence');
    assert.deepEqual(a.effects,b.effects,'pickup effect order/limits');
    assert.deepEqual(a.particleDiagnostics.pickups,b.particleDiagnostics.pickups,'identity/order/time');
    assert.deepEqual(a.elementDust,b.elementDust);assert.equal(a.chain,b.chain);assert.equal(a.best,b.best);
  }
  assert.deepEqual(a.map.dust,b.map.dust,'positions/respawn/Rare state');
}
function clone(value,seen=new Map()){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const copy=Array.isArray(value)?[]:{};seen.set(value,copy);for(const [key,item]of Object.entries(value))copy[key]=clone(item,seen);return copy;}
function pair(map,config=VEIL){const a=createRun(clone(map),config,{predators:false}),b=oracle.createRun(clone(map),config,{predators:false});a.particleDiagnostics=diagnostics();b.particleDiagnostics=diagnostics();return [a,b];}
const base={universe:false,dust:[],fields:[],clusters:[],signals:[],routes:[]};
// Exact ties, near-ties, simultaneous pickup with deliberately nonordinal IDs,
// ready boundaries and Infinity are exercised on the same-cell/multi-cell path.
const custom={...base,dust:[{id:30,x:-20,y:160,angle:-1.3,value:1,ready:0},{id:2,x:20,y:160,angle:-1.8,value:2,ready:0},{id:1,x:-20+1e-10,y:160,angle:-1.5,value:3,ready:0},{id:4,x:0,y:180,angle:0,value:1,ready:1/60},{id:5,x:0,y:180,angle:0,value:1,ready:Infinity}]};
compare(...pair({...custom,dust:custom.dust.filter(d=>d.id!==1)}),()=>({x:0,y:-1}),120);
compare(...pair(custom),()=>({x:0,y:-1}),120);
for(const near of [false,true]){
  const entries=[{id:30,x:-20,y:130,angle:-1.3,value:1,ready:0},{id:2,x:20,y:130,angle:-1.8,value:1,ready:0}];
  if(near)entries.push({id:1,x:-20+1e-10,y:130,angle:-1.5,value:1,ready:0});
  const [a,b]=pair({...base,dust:entries});compare(a,b,()=>({x:0,y:-1}),1);
  assert.ok(near?a.player.bank<0:a.player.bank>0,'active assist resolves exact tie by array order and nearer record by exact distance');
  assert.equal(a.particleDiagnostics.pickupHits,0,'assist tie is not masked by a zero-distance pickup');
  compare(a,b,()=>({x:0,y:-1}),119);
}
for(const mode of ['burst','drive']){
  const map={...base,dust:Array.from({length:81},(_,i)=>({id:100-i,x:(i%3-1)*8,y:200-i*8,angle:-Math.PI/2,value:1,ready:0}))};
  const [a,b]=pair(map,{...VEIL,bounds:{left:-10000,right:10000,top:-10000,bottom:10000}});
  for(const run of [a,b]){Object.assign(run.player,{x:-65,y:180,vx:15000,vy:-15000,speed:Math.hypot(15000,15000)});run.fuel.propellant.amount=500;run.fuel.fuel.amount=500;run.fuel.oxidizer.amount=500;if(mode==='burst')beginBurst(run,()=>true);else setCombustionHeld(run,true);}
  compare(a,b,()=>({x:1,y:-1}),120);assert.ok(a.particleDiagnostics.pickupHits>0,'high-speed swept trace actually collects particles');
}
for(let seed=1;seed<=24;seed++){
  const awakened=seed%2===0,map=createUniverse(seed,{}, {capabilities:{combustionDrive:true,nitrogenField:true,worldAwakened:awakened,rareEcologyEligible:awakened,coreFractured:awakened}}),[a,b]=pair(map,{...VEIL,bounds:{left:-2000,right:2000,top:-19000,bottom:1000},worldAwakened:awakened});
  const target=map.dust.find(d=>awakened?d.rareEcology:d.vortex);
  for(const run of [a,b])Object.assign(run.player,{x:target.x,y:target.y});
  compare(a,b,inputAt,240);
}
// All moving records and cluster expansion are independently checked against
// geometric cell inclusion after crossing boundaries, without querying ready.
const run=fixture('dynamic-heavy');const grid=dustSpatialIndex(run.map);
for(let frame=0;frame<360;frame++){
  run.time=frame/30;const cluster=run.map.clusters[0];Object.assign(run.player,{x:cluster.x,y:cluster.y});animateUniverse(run);
  for(const d of run.map.dust.filter(d=>d.flow||d.vortex||d.cluster!==undefined))assert.ok(grid.queryCircle(d.x,d.y,0).includes(d),'moving cell membership');
}
// External composition invalidation uses array replacement and rebuilds order.
run.map.dust=[...run.map.dust].reverse();const newGrid=dustSpatialIndex(run.map);assert.notEqual(grid,newGrid);assert.deepEqual(newGrid.queryCircle(0,-8500,20000),run.map.dust);


for(const suppressed of [false,true]){
  const universe=createUniverse(77,{}, {capabilities:{worldAwakened:true,rareEcologyEligible:true}}),rare=universe.dust.find(d=>d.rareEcology),map={...base,worldState:'awakened',dust:[rare]};
  if(suppressed){rare.rareEcologyBaseStock=100000;rare.rareEcologyRank=100000;}
  const [a,b]=pair(map,{...VEIL,driftSpeed:0});
  for(const run of [a,b])Object.assign(run.player,{x:rare.x,y:rare.y,vx:0,vy:0,speed:0});
  compare(a,b,()=>({x:0,y:0}),3000);
  const hits=a.particleDiagnostics.pickups.filter(p=>p.id===rare.id);
  assert.ok(suppressed?hits.length===1:hits.length>=2,'Rare availability restores or suppresses using original ready authority');
}

console.log('Spatial index PASS: 24-seed full-scan assist/pickup/physics equivalence, active ties/order, swept high-speed, moving/cluster cells and Rare respawn/suppression.');
