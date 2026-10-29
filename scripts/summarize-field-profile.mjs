// Offline deterministic authority. Clock values are evidence, never CI thresholds.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {pathToFileURL} from 'node:url';
export const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
export const EXPECTED={normal:{total:4530,assist:2195,dynamic:38040,render:7324,draw:4837},dense:{total:13590,assist:6495,dynamic:114120,render:21950,draw:14342},awakened:{total:4530,assist:1019,dynamic:37860,render:5790,draw:4643},'dynamic-heavy':{total:4530,assist:12694,dynamic:38040,render:25037,draw:16562}};
export function verifyProfile(report){
  assert.ok(report.smoke||report.runs>=5,'Five runs required');const seen=new Map(),groups=new Map();
  for(const r of report.results){
    const dimensions=r.dimensions??[390,844],key=JSON.stringify([r.name,r.reduced,r.stage,r.variant??'production',dimensions]);groups.set(key,(groups.get(key)??0)+1);
    const e=EXPECTED[r.name];assert.ok(e,'Unknown fixture');assert.equal((r.initialPopulation??r.population).totalDust,e.total);
    const frames=r.frames??r.samples;for(const k of ['cpu','simulation','render']){assert.equal(r.raw[k].length,frames,'Missing frame samples');assert.ok(r.raw[k].every(v=>Number.isFinite(v)&&v>=0),'Invalid frame samples');}
    const stateKey=JSON.stringify(['state',r.name,r.reduced,frames,dimensions]);if(seen.has(stateKey))assert.deepEqual(r.finalPopulation,seen.get(stateKey),'Population drift');else seen.set(stateKey,r.finalPopulation);
    if(report.mode==='history'){
      const c=r.counters,full=e.total*60;assert.equal(c.assistScanned+c.pickupScanned,r.stage==='p1'?full*2:e.assist);assert.equal(c.dynamicScanned,['p1','p2'].includes(r.stage)?full:e.dynamic);assert.equal(c.renderScanned,r.stage==='p4'?e.render:full);assert.equal(c.rendered,e.draw);if(c.dynamicStaticVisited!==undefined)assert.equal(c.dynamicStaticVisited,0);
    }else if(r.sections){
      assert.equal(r.raw.candidates.length,frames);assert.equal(r.raw.rendered.length,frames);assert.equal(r.raw.sortCalls.length,frames);assert.ok(r.raw.sortCalls.every(n=>n===1));assert.ok(r.raw.candidates.every((n,i)=>n>=r.raw.rendered[i]));assert.ok(r.raw.query.every((n,i)=>n+1e-6>=r.raw.sort[i]));
      const discovery=JSON.stringify(['discovery',r.name,r.reduced,frames,dimensions]),value={candidates:r.raw.candidates,rendered:r.raw.rendered};if(seen.has(discovery))assert.deepEqual(value,seen.get(discovery),'Discovery drift');else seen.set(discovery,value);
    }
  }
  for(const [key,count]of groups){const dimensions=JSON.parse(key).at(-1);if(dimensions[0]===390&&dimensions[1]===844)assert.equal(count,report.runs,'Missing repeated condition');}
  for(const name of report.scenarios??Object.keys(EXPECTED))for(const reduced of [false,true])assert.ok(report.results.some(r=>r.name===name&&r.reduced===reduced),'Missing fixture/motion');
  return true;
}
export function summarizeProfile(report){
  verifyProfile(report);const groups=new Map();for(const r of report.results){const key=JSON.stringify([r.name,r.reduced,r.stage,r.variant??'production',r.dimensions??[390,844]]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
  const rows=[];for(const group of groups.values()){
    const r=group[0],timing=key=>Object.fromEntries(['median','p95','max','mean'].filter(k=>group.every(r=>r[key]?.[k]!==undefined)).map(k=>[k,k==='max'?Math.max(...group.map(r=>r[key][k])):median(group.map(r=>r[key][k]))]));
    const sections=r.sections?Object.fromEntries(Object.keys(r.sections).map(k=>[k,Object.fromEntries(['median','p95','mean'].map(stat=>[stat,median(group.map(r=>r.sections[k][stat]))]))])):null;
    const tails=group.filter(r=>r.sections).map(r=>{const a=r.raw.render.map((ms,i)=>({ms,i})).sort((a,b)=>a.ms-b.ms),cohort=a.slice(Math.floor(a.length*.925),Math.ceil(a.length*.975));return {renderer:cohort.reduce((s,x)=>s+x.ms,0)/cohort.length,dust:cohort.reduce((s,x)=>s+r.raw.sections.dust[x.i],0)/cohort.length};});
    rows.push({name:r.name,reduced:r.reduced,stage:r.stage,variant:r.variant??'production',dimensions:r.dimensions??[390,844],runs:group.length,simulation:timing('simulationMs'),renderer:timing('renderMs'),cpu:timing('frameCpuMs'),raf:timing('rafIntervalMs'),sections,query:r.queryMs?timing('queryMs'):null,stableOrder:r.stableOrderMs?timing('stableOrderMs'):null,dustShare:sections?median(group.map(r=>r.sections.dust.mean/r.renderMs.mean)):null,tail:tails.length?{renderer:median(tails.map(t=>t.renderer)),dust:median(tails.map(t=>t.dust))}:null,population:r.initialPopulation??r.population,counters:r.counters??null,rendered:r.renderedSummary?{median:median(group.map(r=>r.renderedSummary.median)),mean:median(group.map(r=>r.renderedSummary.mean))}:null});
  }
  return {...Object.fromEntries(['mode','runs','smoke','browser','viewport','runtimeSourceSha256','profileSourceSha256','stageSources'].map(k=>[k,report[k]])),groups:rows};
}
export function classifyProfile(summary){
  const triggers=[],scaling=[];for(const reduced of [false,true]){
    const find=(name,variant)=>summary.groups.find(g=>g.name===name&&g.reduced===reduced&&g.variant===variant&&g.dimensions[0]===390);
    for(const name of ['dense','dynamic-heavy']){const g=find(name,'complete');if(g?.dustShare>=.4)triggers.push({condition:1,name,reduced,share:g.dustShare});}
    const n=find('normal','baseline'),d=find('dense','baseline'),np=find('normal','complete'),dp=find('dense','complete');if(n&&d&&np?.tail&&dp?.tail){const growth=d.renderer.p95/n.renderer.p95-1,rendererDelta=dp.tail.renderer-np.tail.renderer,dustDelta=dp.tail.dust-np.tail.dust,attribution=rendererDelta>0?dustDelta/rendererDelta:null;scaling.push({reduced,growth,rendererDelta,dustDelta,attribution});if(growth>=.25&&attribution>.5)triggers.push({condition:2,reduced,growth,attribution});}
  }
  const sections={};let total=0;for(const g of summary.groups.filter(g=>g.variant==='complete'&&g.dimensions[0]===390)){total+=g.renderer.mean;for(const [k,v]of Object.entries(g.sections))sections[k]=(sections[k]??0)+v.mean;}const dominant=Object.entries(sections).sort((a,b)=>b[1]-a[1])[0];return {classification:triggers.length?'B':dominant&&dominant[0]!=='dust'&&dominant[1]/total>=.4?'C':'A',triggers,scaling,dominantSection:dominant?.[0],dominantShare:dominant?dominant[1]/total:null};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const bytes=await readFile(process.argv[2]),summary=summarizeProfile(JSON.parse(process.argv[2].endsWith('.gz')?gunzipSync(bytes):bytes));if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary.groups.map(g=>({name:g.name,reduced:g.reduced,stage:g.stage,variant:g.variant,cpu:g.cpu,renderer:g.renderer,dust:g.sections?.dust,share:g.dustShare})),null,2));}
