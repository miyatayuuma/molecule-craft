import assert from 'node:assert/strict';
import {clone,spy} from './helpers/field-canvas-spy.mjs';
import {readFile} from 'node:fs/promises';
import {rendererDustCandidates,DUST_CULL_MARGIN} from '../src/veil/renderer.js';
import {dustSpatialIndex,updateDustSpatialMembership} from '../src/veil/dust-spatial-index.js';
import {animateUniverse} from '../src/veil/universe.js';
import {fixture,SCENARIOS,diagnostics} from './helpers/field-particle-fixtures.mjs';
assert.equal(DUST_CULL_MARGIN,35);

// Independent P3 predicate: literal margin and original arithmetic/order.
const visible=(dust,time,screen,w,h)=>dust.filter(d=>{if(d.ready>time)return false;const q=screen(d.x,d.y);return !(q.x<-35||q.x>w+35||q.y<-35||q.y>h+35);});
for(const scale of [.48,390/660,.53,1,1.15])for(const camera of [{x:0,y:0},{x:-128,y:-17792},{x:128+1e-10,y:-128-1e-10},{x:-102,y:-329}]){
  const w=390,h=844,points=[[w/2,h/2],[0,h/2],[w,h/2],[w/2,0],[w/2,h]];
  for(const delta of [-1e-8,0,1e-8])points.push([-35+delta,h/2],[w+35+delta,h/2],[w/2,-35+delta],[w/2,h+35+delta]);
  const dust=points.map(([x,y],i)=>({id:100-i,x:camera.x+(x-w/2)/scale,y:camera.y+(y-h/2)/scale,ready:0,element:i%2?'C':'H'}));
  dust.push({id:500,x:-128,y:-128,ready:0},{id:501,x:camera.x,y:camera.y,ready:Infinity},{id:502,x:camera.x,y:camera.y,ready:1});
  const map={dust},screen=(x,y)=>({x:(x-camera.x)*scale+w/2,y:(y-camera.y)*scale+h/2});
  for(const time of [1-1e-10,1,1+1e-10]){
    const candidates=rendererDustCandidates(map,camera,scale,w,h,diagnostics());assert.equal(new Set(candidates).size,candidates.length);
    assert.deepEqual(visible(candidates,time,screen,w,h),visible(dust,time,screen,w,h),'closed margin/grid boundaries and respawn exact');
  }
  const grid=dustSpatialIndex(map);dust[0].x+=1000;dust[0].y-=1000;updateDustSpatialMembership(map,dust[0]);
  assert.deepEqual(visible(rendererDustCandidates(map,camera,scale,w,h),1,screen,w,h),visible(dust,1,screen,w,h));assert.equal(grid,dustSpatialIndex(map),'single canonical index');
}
// After one-time canonical grid construction, discovering visible candidates
// must not read even ready/position metadata from remote static records.
let remoteReads=0,guard=false;
const remote=new Proxy({x:100000,y:-100000,ready:0},{get(target,key){if(guard&&['x','y','ready'].includes(key))remoteReads++;return target[key];}});
const local={x:0,y:0,ready:0},probe={dust:[remote,local]};dustSpatialIndex(probe);guard=true;
assert.deepEqual(rendererDustCandidates(probe,{x:0,y:0},1,390,844),[local]);assert.equal(remoteReads,0);

// Transient production renderer adapters: observe final dust references, and
// swap only broadphase provider for the full-array oracle. No runtime fallback.
const rendererUrl=new URL('../src/veil/renderer.js',import.meta.url);
let source=await readFile(rendererUrl,'utf8');source=source.replace(/from '(\.\.?\/[^']+)'/g,(_,path)=>`from '${new URL(path,rendererUrl).href}'`);
source=source.replace('if(diagnostics){diagnostics.rendered++;','globalThis.__renderDust?.(dust);if(diagnostics){diagnostics.rendered++;');
const load=async code=>import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const spatial=await load(source),full=await load(source.replace(new URL('./dust-spatial-index.js',rendererUrl).href,new URL('./helpers/full-scan-renderer-oracle.mjs',import.meta.url).href));
let draws=0;
for(const name of SCENARIOS)for(let seed=1;seed<=24;seed++)for(const reduced of [false,true]){
  const a=fixture(name,{seed}),b=clone(a),sa=spy(spatial.createVeilRenderer),sb=spy(full.createVeilRenderer);
  for(let frame=0;frame<8;frame++){
    for(const run of [a,b]){
      run.time=(frame+1)*.2;const cluster=run.map.clusters[0];
      if(frame===2)Object.assign(run.player,{x:cluster.x,y:cluster.y});
      if(frame===7)Object.assign(run.player,{x:-128,y:-15180});
      run.player.boost=frame===1?1:0;run.player.combustion=frame===2;
      animateUniverse(run);
    }
    for(const [run,s]of [[a,sa],[b,sb]]){
      if(frame===3)s.renderer.beginReturn(run,'stable');
      if(frame===4)s.renderer.beginWarp(run,'stable');
      if(frame===5){run.forcedReturn={};s.renderer.beginForcedReturn(run,{lost:{H:7,C:4},insights:['ethane']});}
      if(frame===6)s.renderer.beginWarp(run,'emergency');
      if(frame===7){run.returnEffect=null;s.renderer.reset();}
    }
    const emitted=[],expected=[];sa.clear();globalThis.__renderDust=d=>emitted.push(d);sa.renderer.draw(a,frame===0?0:.15,reduced);
    sb.clear();globalThis.__renderDust=d=>expected.push(d);sb.renderer.draw(b,frame===0?0:.15,reduced);
    const {w,h}=sa.renderer.size;assert.deepEqual(emitted,visible(a.map.dust,a.time,sa.renderer.screen,w,h),'actual final canonical references/order');
    assert.deepEqual(emitted,expected,'identity/element/kind/Rare/flow/position');
    assert.deepEqual(sa.calls,sb.calls,'complete Canvas command, color/alpha and compositing order');draws++;
  }
}
delete globalThis.__renderDust;delete globalThis.document;delete globalThis.window;
console.log(`Renderer query PASS: 24 seeds × 4 fixtures × both motion settings; ${draws} exact full-scan command/identity/order comparisons, margin/respawn/grid boundaries, camera/zoom/return and moving/cluster/Rare states.`);
