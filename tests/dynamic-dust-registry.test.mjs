import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dynamicDustRegistry,resetDynamicDustRegistry} from '../src/veil/dynamic-dust-registry.js';
import {dustSpatialIndex} from '../src/veil/dust-spatial-index.js';
import {animateUniverse} from '../src/veil/universe.js';
import {createRun} from '../src/veil/expedition-run.js';
import {VEIL} from '../src/veil/config.js';
import {fixture,SCENARIOS,diagnostics,inputAt} from './helpers/field-particle-fixtures.mjs';
import {stepRun} from '../src/veil/expedition-run.js';
import {animateUniverse as fullScan} from './helpers/full-scan-animation-oracle.mjs';

// The oracle is a frozen P2 function, not derived from today's implementation.
const frozen=await readFile(new URL('./helpers/full-scan-animation-oracle.mjs',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(frozen.slice(frozen.indexOf('export function animateUniverse(run)'))).digest('hex'),frozen.match(/SHA256: (\w+)/)[1]);
function clone(value,seen=new Map()){if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);const copy=Array.isArray(value)?[]:{};seen.set(value,copy);for(const [key,item]of Object.entries(value))copy[key]=clone(item,seen);return copy;}
function cell(grid,d){assert.deepEqual(grid.cellOf(d),{x:Math.floor(d.x/128),y:Math.floor(d.y/128)});assert.ok(grid.queryCircle(d.x,d.y,0).includes(d),'new position query before subsequent assist/pickup');}

for(const scenario of SCENARIOS)for(let seed=1;seed<=24;seed++){
  const run=fixture(scenario,{seed}),reference=clone(run);delete reference.particleDiagnostics;
  const expected=run.map.dust.filter(d=>d.vortex||d.flow),registry=dynamicDustRegistry(run.map),grid=dustSpatialIndex(run.map);
  assert.deepEqual(registry,expected);assert.equal(new Set(registry).size,registry.length);
  assert.ok(registry.every((d,i)=>d===expected[i]),'canonical references, stable order');
  assert.ok(run.map.clusters.every(c=>c.particles.every(d=>!registry.includes(d))),'production cluster ownership disjoint');
  const moving=run.map.dust.filter(d=>d.vortex||d.flow||d.cluster!==undefined),byId=new Map(reference.map.dust.map(d=>[d.id,d]));
  for(let frame=0;frame<180;frame++){
    // Include normal progression and large phase/wrap jumps, not just one cell.
    run.time=reference.time=frame<120?frame/60:frame*7.25;
    const cluster=run.map.clusters[frame%run.map.clusters.length];
    for(const r of [run,reference]){Object.assign(r.player,{x:cluster.x,y:cluster.y});r.events=[];}
    animateUniverse(run);fullScan(reference);
    assert.deepEqual(run.events,reference.events,'cluster/signal event order');
    for(const d of moving){const other=byId.get(d.id);assert.equal(d.x,other.x);assert.equal(d.y,other.y);assert.equal(d.angle,other.angle);assert.equal(d.ready,other.ready);cell(grid,d);}
  }
  assert.deepEqual(run.map.dust,reference.map.dust,'all dust states exact');
  assert.deepEqual(run.map.clusters,reference.map.clusters,'cluster state exact');
  assert.equal(run.particleDiagnostics.clusterSameCellMoves+run.particleDiagnostics.clusterCellRelocations,run.particleDiagnostics.clusterUpdated);
  assert.equal(run.particleDiagnostics.dynamicScanned,registry.length*180);
  assert.equal(run.particleDiagnostics.dynamicSameCellMoves+run.particleDiagnostics.dynamicCellRelocations,registry.length*180);
}

// Instrument actual static property reads, rather than trusting a zero counter.
let staticReads=0;
const staticDust=new Proxy({id:1,x:0,y:0,ready:0},{get(target,key){if(['flow','vortex','x','y','angle'].includes(key))staticReads++;return target[key];}});
const flow={id:2,x:-129,y:-129,baseX:-129,baseY:-129,angle:0,ready:0,flow:{span:2000,speed:1500,phase:.5}};
const dual={id:3,x:0,y:0,angle:0,ready:0,flow:{span:999,speed:999,phase:0},vortex:{phase:0,angularSpeed:1,radius:200}};
const map={universe:true,dust:[staticDust,flow,dual],clusters:[],signals:[]};
assert.deepEqual(dynamicDustRegistry({dust:[flow,staticDust,flow,dual]}),[flow,dual],'duplicate references occur once');
const run={map,time:0,player:{x:0,y:0,boost:0},config:VEIL,events:[],particleDiagnostics:diagnostics()};
assert.deepEqual(dynamicDustRegistry(map),[flow,dual]);const grid=dustSpatialIndex(map);staticReads=0;
const reference=clone(run);delete reference.particleDiagnostics;staticReads=0;
const writes=[];for(const d of [flow,dual]){let x=d.x;Object.defineProperty(d,'x',{enumerable:true,get:()=>x,set:value=>{writes.push(d.id);x=value;}});}
for(const time of [0,.001,.09,.5,4,12]){run.time=reference.time=time;animateUniverse(run);fullScan(reference);cell(grid,flow);cell(grid,dual);for(let i=1;i<3;i++){const a=map.dust[i],b=reference.map.dust[i];assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.angle,b.angle);}}
assert.deepEqual(writes,Array.from({length:6},()=>[2,3]).flat(),'position writes preserve map order');
assert.equal(staticReads,0,'static dust has no branch, position read or visit after finalization');
assert.equal(run.particleDiagnostics.dynamicStaticVisited,0);
assert.equal(run.particleDiagnostics.vortexUpdated,6);assert.equal(run.particleDiagnostics.flowUpdated,6,'vortex wins for dual-property dust');
assert.ok(run.particleDiagnostics.dynamicSameCellMoves>0);assert.ok(run.particleDiagnostics.dynamicCellRelocations>0);

// Membership geometry: x, y, diagonal, negative, multi-cell jumps and phase wrap.
for(const angle of [0,Math.PI/2,Math.PI/4]){
  const d={...flow,angle,flow:{...flow.flow}},m={universe:true,dust:[d],clusters:[],signals:[]},r={...run,map:m,particleDiagnostics:diagnostics()},g=dustSpatialIndex(m);
  dynamicDustRegistry(m);let crossings=0;
  for(const time of [0,.001,.09,.5,1.32,1.34,4]){const before=g.cellOf(d);r.time=time;animateUniverse(r);cell(g,d);if(JSON.stringify(before)!==JSON.stringify(g.cellOf(d)))crossings++;}
  assert.ok(crossings>=2);
}

// Rare dynamic metadata is conditional in production; exercise retained-flow
// canonical replacement explicitly without changing production Rare placement.
const rareRun=fixture('awakened'),rare=rareRun.map.dust.find(d=>d.rareEcology),replacement={...rare,...flow,id:rare.id,rareEcology:true};
rareRun.map.dust=rareRun.map.dust.map(d=>d===rare?replacement:d);
const final=createRun(rareRun.map,rareRun.config,{predators:false});
assert.ok(dynamicDustRegistry(final.map).includes(replacement));assert.ok(!dynamicDustRegistry(final.map).includes(rare));
const rareGrid=dustSpatialIndex(final.map);final.time=4;animateUniverse(final);cell(rareGrid,replacement);
const first=dynamicDustRegistry(final.map);final.map.dust=[...final.map.dust].reverse();assert.notEqual(dynamicDustRegistry(final.map),first);assert.deepEqual(dynamicDustRegistry(final.map),final.map.dust.filter(d=>d.vortex||d.flow));
final.map.dust.push({...flow,id:900000});assert.ok(dynamicDustRegistry(final.map).includes(final.map.dust.at(-1)));
resetDynamicDustRegistry(final.map);assert.deepEqual(dynamicDustRegistry(final.map),final.map.dust.filter(d=>d.vortex||d.flow));

// Frozen P2 one-second candidate counts stay identical for every P1 fixture.
const expectedCandidates={normal:2195,dense:6495,awakened:1019,'dynamic-heavy':12694};
for(const scenario of SCENARIOS){const r=fixture(scenario);for(let frame=0;frame<60;frame++)stepRun(r,inputAt(frame),1/60);assert.equal(r.particleDiagnostics.assistScanned+r.particleDiagnostics.pickupScanned,expectedCandidates[scenario]);}
console.log('Dynamic registry PASS: 24 seeds × 4 fixtures exact frozen-P2 animation, static reads zero, canonical/order, moving/cluster/Rare grid cells and unchanged P2 candidates.');
