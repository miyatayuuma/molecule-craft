import assert from 'node:assert/strict';
import {fixture,population} from './helpers/field-particle-fixtures.mjs';
import {createVeilRenderer} from '../src/veil/renderer.js';
const counts=()=>({drawImage:0,fill:0,stroke:0,save:0,restore:0,arc:0});
function draw(name,region,reduced,{instrument=true,empty=false}={}){
  let id=0;const calls=[],api=counts();
  const makeCanvas=()=>{const canvas={id:id++,width:0,height:0,getBoundingClientRect:()=>({width:390,height:844})};const ctx=new Proxy({}, {get:(target,key)=>key in target?target[key]:(...args)=>{if(canvas.id===0){calls.push([key,...args.map(a=>typeof a==='object'?`canvas:${a?.id}`:a)]);if(key in api)api[key]++;}if(key==='createRadialGradient'||key==='createLinearGradient')return {addColorStop(){}};},set:(target,key,value)=>{target[key]=value;return true;}});canvas.getContext=()=>ctx;return canvas;};
  globalThis.document={createElement:makeCanvas};globalThis.window={devicePixelRatio:2};const canvas=makeCanvas(),renderer=createVeilRenderer(canvas),run=fixture(name,{instrument});
  const positions={veil:[0,-1200],carbon:[0,-5200],oxygen:[0,-9700],nitrogen:[0,-15180]};if(region){const [x,y]=positions[region];Object.assign(run.player,{x,y});}run.time=2;if(empty)run.map.dust=[];
  renderer.draw(run,0,reduced);return {calls,api,d:run.particleDiagnostics,p:population(run,renderer.screen)};
}
for(const name of ['normal','dense','awakened','dynamic-heavy'])for(const reduced of [false,true])for(const region of ['veil','carbon','oxygen','nitrogen']){
  const a=draw(name,region,reduced),b=draw(name,region,reduced,{instrument:false}),empty=draw(name,region,reduced,{empty:true});assert.deepEqual(a.calls,b.calls,'instrumentation preserves Canvas commands');const d=a.d;
  assert.equal(d.renderScanned,a.p.totalDust);assert.equal(d.renderScanned,d.renderNotReady+d.renderOffscreen+d.rendered);assert.ok(d.rendered>=a.p.visibleReadyDust);
  assert.equal(a.api.drawImage-empty.api.drawImage,d.glowDraws);assert.equal(a.api.fill-empty.api.fill,d.centerDraws);assert.equal(a.api.stroke-empty.api.stroke,d.flowStrokes);assert.equal(a.api.save-empty.api.save,d.carbonDraws);assert.equal(a.api.restore-empty.api.restore,d.carbonDraws);assert.equal(a.api.arc-empty.api.arc,d.centerDraws-d.carbonDraws);
}
delete globalThis.document;delete globalThis.window;console.log('FIELD renderer counters independently match Canvas API spy; instrumentation leaves draw commands identical.');
