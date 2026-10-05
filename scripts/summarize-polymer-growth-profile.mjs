import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const directory=process.argv[2]??'test-results/polymer-growth-continuity';
const phases=new Set(['anchored','recognizable-incorporation','extension','long-chain-hold']);
function distribution(values){assert.ok(values.length>=8,'Insufficient actual-browser frame samples');const sorted=[...values].sort((a,b)=>a-b);return{n:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],peak:sorted.at(-1)};}
function summarize(profile){assert.ok(profile?.count>0,'Missing localhost-only profile probe');const indices=profile.phase.flatMap((phase,index)=>phases.has(phase)?[index]:[]);return Object.fromEntries(['update','render','frame'].map(key=>[key,distribution(indices.map(index=>profile[key][index]))]));}
const results=[];
for(const viewport of [390,1280]){
  const rows=JSON.parse(await readFile(`${directory}/browser-${viewport}.json`,'utf8'));
  for(const routeId of ['polyethylene-coordination','polyethylene-reduced-motion']){
    const row=rows.find(item=>item.routeId===routeId);assert.ok(row,`${routeId} missing at ${viewport}px`);
    const metrics=summarize(row.profile);results.push({viewport:`${viewport}x${viewport===390?844:900}`,routeId,scope:'actual-pointer PE growth phases',units:'milliseconds; renderer time is CPU submission, not GPU completion',...metrics});
    console.log(`${viewport} ${routeId}: update p50/p95/peak ${metrics.update.p50.toFixed(3)}/${metrics.update.p95.toFixed(3)}/${metrics.update.peak.toFixed(3)} ms; render ${metrics.render.p50.toFixed(3)}/${metrics.render.p95.toFixed(3)}/${metrics.render.peak.toFixed(3)} ms; frame interval ${metrics.frame.p50.toFixed(2)}/${metrics.frame.p95.toFixed(2)}/${metrics.frame.peak.toFixed(2)} ms`);
  }
}
await mkdir(directory,{recursive:true});await writeFile(`${directory}/performance-summary.json`,JSON.stringify({method:'local production viewer probe; actual pointer chemistry; measured only in the localhost test harness',results},null,2));
