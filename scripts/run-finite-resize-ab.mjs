// One predeclared campaign: AB then DC, one retained warm-up + four measured
// reduced-motion PE completions per condition. No outcome-based reruns.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {analyzeFiniteEvidence} from './analyze-c7-finite-evidence.mjs';
const baselineSha='da4a0f529ceb4ca0fc5303e6e768d82945b4f934',candidateSha=spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
const baseline=resolve(process.env.C9_BASELINE_ROOT),candidate=resolve('.'),out=resolve(process.env.C9_EVIDENCE_DIR??'test-results/c9-ab');
const plan=[['A',baseline,baselineSha,false],['B',candidate,candidateSha,false],['D',candidate,candidateSha,true],['C',baseline,baselineSha,true]];
await mkdir(out,{recursive:true});await writeFile(join(out,'plan.json'),JSON.stringify({baselineSha,candidateSha,harnessSha:candidateSha,order:plan.map(x=>x[0]),trialsPerCondition:5,warmupIndex:0,measuredIndices:[1,2,3,4],viewport:{width:1280,height:900,dpr:1},motion:'reduced',feedbackMs:250,route:'polyethylene-coordination',flags:'existing SwiftShader harness flags unchanged',instrumentation:'Common RAF/lifecycle/native setters/page wrappers. Full additionally enables browser CDP identity, trace and Linux sampler.',reruns:0,interpretation:'Block-order effects remain possible. Minimal/full differences are observational, not an exact causal overhead estimate.'},null,2));
const results=[];
for(const [condition,root,sha,full] of plan){
  const dir=join(out,condition);await mkdir(dir,{recursive:true});
  console.log(`C9 CONDITION ${condition} START ${sha} ${full?'full':'minimal'}`);
  const run=spawnSync(process.execPath,['tests/reaction-lab-polymer-browser.test.mjs'],{env:{...process.env,POLYMER_ROOT:root,POLYMER_SOURCE_SHA:sha,POLYMER_C9_AB:'1',POLYMER_PROFILE_ONLY:'1',POLYMER_DESKTOP:'1',POLYMER_PAUSE_DIAGNOSTIC:full?'1':'0',POLYMER_EVIDENCE_DIR:dir},encoding:'utf8',timeout:20*60*1000,maxBuffer:30*1024*1024});
  await writeFile(join(dir,'browser.log'),(run.stdout??'')+'\n'+(run.stderr??''));
  let evidence=null,analysis=null,error=null;try{evidence=JSON.parse(await readFile(join(dir,'performance-1280.json')));if(full){const report=JSON.parse(await readFile(join(dir,'finite-pause-diagnostic-1280.json'))),trace=JSON.parse(await readFile(join(dir,'finite-pause-trace-1280.json')));analysis=analyzeFiniteEvidence(report,trace);await writeFile(join(dir,'analysis.json'),JSON.stringify(analysis,null,2));}}catch(e){error=e.message;}
  results.push({condition,sourceSha:sha,full,exitCode:run.status,signal:run.signal,error:run.error?.message??error,browser:evidence?.browser??null,evidence,analysis});
  await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));console.log(`C9 CONDITION ${condition} END ${run.status}`);
}
assert.ok(results.every(r=>r.exitCode===0&&!r.error),'Every condition must complete; partial raw evidence is retained');
const reference=results[0].browser;
for(const r of results){assert.deepEqual(r.browser,reference,'Same exact browser product/revision/protocol across all conditions');assert.equal(r.evidence.c9.harnessSha,candidateSha);assert.equal(r.evidence.sourceSha,r.sourceSha);assert.equal(r.evidence.measurements.length,5);assert.deepEqual(r.evidence.measurements.map(m=>m.trialIndex),[0,1,2,3,4]);assert.ok(r.evidence.measurements.every(m=>m.targetDurationMs===250&&m.motion==='reduced'));}
const median=values=>{const a=[...values].sort((x,y)=>x-y);return(a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2;};
const summary=results.map(r=>({condition:r.condition,sourceSha:r.sourceSha,instrumentation:r.full?'full':'minimal',browser:r.browser,trials:r.evidence.measurements.map(m=>{
  const work=r.evidence.c9.resizeWork,finish=work.find(w=>w.kind==='finishPolymerSample'&&w.sampleId===m.sampleId),start=finish?.startMs??m.sampleRegistrationAtMs,end=m.completionLifecycle.samplerStoppedAtMs;
  const during=work.filter(w=>w.startMs>=start&&w.startMs<=end),writes=r.evidence.c9.nativeProbes.filter(p=>/canvas\.(width|height)=/.test(p.label)&&p.startMs>=start&&p.startMs<=end);
  return{trialIndex:m.trialIndex,warmup:m.warmup,completionElapsedMs:m.completionElapsedMs,firstPostReadyFrameAtMs:m.completionLifecycle.firstPostReadyFrameAtMs,frameIntervals:m.frameIntervalsMs,finish,resizeCalls:during.filter(w=>w.kind==='resize'),observerCallbacks:during.filter(w=>w.kind==='ResizeObserver').length,rendererUpdates:during.filter(w=>['setSize','setDrawingBufferSize'].includes(w.kind)),nativeAssignments:writes,registrationCallbackMs:m.sampleRegistrationCallbackDurationMs,graphCallbackMs:m.graphEvidenceCallbackDurationMs};
}),medianMeasuredCompletionMs:median(r.evidence.measurements.filter(m=>!m.warmup).map(m=>m.completionElapsedMs)),schedulerSampling:r.analysis?.schedulerSampling??null,clockEvidence:r.analysis?.clockEvidence??null,gpuWaitAttributions:r.analysis?.longTaskAttributions.filter(t=>t.gpuBrowserEvidence.syncWaitMs>0)??null}));
await writeFile(join(out,'summary.json'),JSON.stringify({classification:'CONTROLLED_AB_EVIDENCE_ONLY',acceptanceResult:false,summary,instrumentationCaution:'Full-minus-minimal trial differences are observational. Shared page probes have no unprobed control, so their exact overhead is not identified. Full adds tracing, counter reads and browser CDP as a bundle; individual causal overhead cannot be isolated by a 2x2 design.'},null,2));
console.log('C9 complete. Evaluate structural resize elimination, native waits, minimal timing, RAF and UX jointly. No strict acceptance is inferred.');
