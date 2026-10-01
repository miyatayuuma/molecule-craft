import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,SCENARIOS} from './helpers/field-particle-fixtures.mjs';
import {clone,spy} from './helpers/field-canvas-spy.mjs';
import {profileRendererSource,createFrameProfile,DUST_ABLATIONS} from './helpers/field-renderer-profile.mjs';
import {animateUniverse} from '../src/veil/universe.js';
const url=new URL('../src/veil/renderer.js',import.meta.url),source=await readFile(url,'utf8');
const load=async s=>import(`data:text/javascript;base64,${Buffer.from(s.replace(/from '(\.\.?\/[^']+)'/g,(_,p)=>`from '${new URL(p,url).href}'`)).toString('base64')}`);
const baseline=await load(source),profile=await load(profileRendererSource(source));
assert.throws(()=>profileRendererSource(source.replace("ctx.fillStyle='#aac5d6';",'')),/anchor drift/);assert.throws(()=>profileRendererSource(source,{ablation:'production'}));
let clock=0;const accounting=createFrameProfile(()=>++clock);accounting.begin();accounting.mark('background');accounting.mark('stars');accounting.end();assert.equal(accounting.total,2);assert.equal(Object.values(accounting.sections).reduce((a,b)=>a+b),2);
for(const name of SCENARIOS)for(const reduced of [false,true]){
  const a=fixture(name),b=clone(a),sa=spy(baseline.createVeilRenderer),sb=spy(profile.createVeilRenderer);
  for(let frame=0;frame<8;frame++){
    for(const run of [a,b]){run.time=(frame+1)*.2;if(frame===2){const c=run.map.clusters[0];Object.assign(run.player,{x:c.x,y:c.y});}run.player.boost=frame===1?1:0;run.player.combustion=frame===2;animateUniverse(run);}
    for(const [run,s]of [[a,sa],[b,sb]]){if(frame===3)s.renderer.beginReturn(run,'stable');if(frame===4)s.renderer.beginWarp(run,'stable');if(frame===5){run.forcedReturn={};s.renderer.beginForcedReturn(run,{lost:{H:7,C:4},insights:['ethane']});}if(frame===6)s.renderer.beginWarp(run,'emergency');if(frame===7){run.returnEffect=null;s.renderer.reset();}}
    const prior=b.particleDiagnostics.rendered;sa.clear();sa.renderer.draw(a,.15,reduced);sb.clear();globalThis.__fieldProfile=createFrameProfile();sb.renderer.draw(b,.15,reduced);assert.deepEqual(sa.calls,sb.calls,'Every Canvas command/state is unchanged');assert.deepEqual(a,b);assert.equal(globalThis.__fieldProfile.rendered,b.particleDiagnostics.rendered-prior);assert.ok(globalThis.__fieldProfile.candidates>=globalThis.__fieldProfile.rendered);delete globalThis.__fieldProfile;
  }
}
const count=(calls,name)=>calls.filter(c=>c[0]===name).length,a=fixture('dynamic-heavy'),original=clone(a),sa=spy(baseline.createVeilRenderer);sa.clear();sa.renderer.draw(a,0,false);
for(const ablation of DUST_ABLATIONS){const m=await load(profileRendererSource(source,{ablation})),b=clone(original),sb=spy(m.createVeilRenderer);sb.clear();globalThis.__fieldProfile=createFrameProfile();sb.renderer.draw(b,0,false);assert.deepEqual(a,b);assert.equal(globalThis.__fieldProfile.rendered,a.particleDiagnostics.rendered);const d=a.particleDiagnostics;assert.equal(count(sa.calls,'drawImage')-count(sb.calls,'drawImage'),['noGlow','cullOnly'].includes(ablation)?d.rendered:0);assert.equal(count(sa.calls,'fill')-count(sb.calls,'fill'),['noCenter','cullOnly'].includes(ablation)?d.rendered:ablation==='noCarbon'?d.carbonDraws:0);assert.equal(count(sa.calls,'stroke')-count(sb.calls,'stroke'),['noFlow','cullOnly'].includes(ablation)?d.flowStrokes:0);}
delete globalThis.__fieldProfile;delete globalThis.document;delete globalThis.window;
console.log('P5 profile PASS: 64 exact Canvas/state comparisons, diagnostic component isolation and section accounting; zero production instrumentation.');
