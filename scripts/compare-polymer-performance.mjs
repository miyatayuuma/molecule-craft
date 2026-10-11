import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';

const [baseline390Path,baseline1280Path,candidate390Path,candidate1280Path,outputPath]=process.argv.slice(2);
assert.ok(baseline390Path&&baseline1280Path&&candidate390Path&&candidate1280Path&&outputPath,'Usage: node scripts/compare-polymer-performance.mjs baseline-390.json baseline-1280.json candidate-390.json candidate-1280.json output.json');
const expectedBaseline=process.env.POLYMER_BASELINE_SHA??null,expectedCandidate=process.env.POLYMER_CANDIDATE_SHA??null;
const oneRefreshQuantumMs=1000/60;
const read=async path=>JSON.parse(await readFile(resolve(path),'utf8'));
const median=values=>{
  assert.ok(values.length,'Cannot calculate a median from an empty sample.');
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};
function quantile(values,q){
  assert.ok(values.length,`Cannot calculate q${q} from an empty sample.`);
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.max(0,Math.ceil(q*sorted.length)-1)];
}
function mad(values){const center=median(values);return median(values.map(value=>Math.abs(value-center)));}
function stats(values){return{count:values.length,p50:quantile(values,.5),p95:quantile(values,.95),max:Math.max(...values)};}
function validateDocument(document,label,expectedSha){
  assert.equal(document.schemaVersion,1,`${label}: unexpected profile schema`);
  assert.ok(document.sourceSha,`${label}: source commit is required`);
  if(expectedSha)assert.equal(document.sourceSha,expectedSha,`${label}: source commit does not match requested ref`);
  assert.ok(document.browser?.product&&document.browser?.revision,`${label}: Chromium version is missing`);
  assert.ok([390,1280].includes(document.viewport?.width),`${label}: unsupported viewport`);
  assert.equal(document.viewport.deviceScaleFactor,1,`${label}: device scale factor must be 1`);
  assert.deepEqual(document.warmupPolicy,'First completion for each motion mode is retained but excluded from aggregate regression statistics.');
  assert.ok(document.measurements?.length,`${label}: no performance samples were recorded`);
  for(const sample of document.measurements){
    assert.equal(sample.browser,document.browser.product,`${label}: sample browser differs from document browser`);
    assert.equal(sample.viewport.width,document.viewport.width,`${label}: sample viewport differs from document viewport`);
    assert.equal(sample.viewport.height,document.viewport.height,`${label}: sample viewport differs from document viewport`);
    assert.ok(['normal','reduced'].includes(sample.motion),`${label}: unknown motion mode`);
    assert.ok(Array.isArray(sample.frameIntervalsMs.values)&&sample.frameIntervalsMs.values.length===sample.frameIntervalsMs.count,`${label}: raw frame intervals are needed for aggregate percentiles`);
    assert.equal(sample.retiredModuleFetchCount,0,`${label}: retired module fetch observed`);
    assert.equal(sample.jsUpdateTimeMs,'NOT_MEASURED');
    assert.equal(sample.renderSubmissionTimeMs,'NOT_MEASURED');
    assert.equal(sample.gpuExecutionTimeMs,'NOT_MEASURED');
    assert.equal(sample.polymerRuntimeMetrics.completionLayoutCallsAfterReady,0,`${label}: post-ready layout ran`);
  }
}
function selectMeasured(document,motion){
  const rows=document.measurements.filter(item=>item.motion===motion&&!item.warmup);
  assert.equal(rows.length,4,`${document.viewport.width}×${document.viewport.height} ${motion}: expected one warm-up plus four measured trials`);
  assert.equal(document.measurements.filter(item=>item.motion===motion&&item.warmup).length,1,`${motion}: exactly one warm-up trial is required`);
  assert.deepEqual(rows.map(item=>item.trialIndex),[1,2,3,4],`${motion}: measured trial indices must be deterministic`);
  assert.ok(rows.every(item=>item.routeId==='polyethylene-coordination'&&item.polymerId==='polyethylene'),`${motion}: profile must use the representative polyethylene route`);
  return rows;
}
function compareDocuments(baseline,candidate){
  validateDocument(baseline,'baseline',expectedBaseline);validateDocument(candidate,'candidate',expectedCandidate);
  assert.equal(baseline.browser.product,candidate.browser.product,'Chromium product/version differs between runs');
  assert.equal(baseline.browser.revision,candidate.browser.revision,'Chromium revision differs between runs');
  assert.deepEqual(baseline.viewport,candidate.viewport,'Viewport/device scale factor differs');
  const report=[];
  for(const motion of ['normal','reduced']){
    const before=selectMeasured(baseline,motion),after=selectMeasured(candidate,motion);
    for(let index=0;index<4;index++){
      const b=before[index],c=after[index];assert.equal(b.routeId,c.routeId);assert.equal(b.motion,c.motion);assert.equal(b.trialIndex,c.trialIndex);
      assert.deepEqual(b.runtimeFlags,c.runtimeFlags,'Browser runtime flags differ');
      assert.equal(b.targetDurationMs,c.targetDurationMs,'Completion feedback contract differs');
      assert.equal(b.moduleFetchCount,c.moduleFetchCount,'Unique JavaScript module resource count differs');
      for(const metric of ['activeGroupCount','geometryCount','materialCount'])assert.equal(c.polymerResources[metric],b.polymerResources[metric],`${motion} trial ${index+1}: ${metric} differs`);
      for(const metric of ['geometryDisposals','materialDisposals'])assert.equal(c.polymerResources.disposals[metric],b.polymerResources.disposals[metric],`${motion} trial ${index+1}: ${metric} differs`);
      for(const metric of ['finiteLayoutCalls','bondVisualAllocations','completionFitCalls','completionLayoutCallsAfterReady'])assert.equal(c.polymerRuntimeMetrics[metric],b.polymerRuntimeMetrics[metric],`${motion} trial ${index+1}: ${metric} differs`);
    }
    const beforeFrames=before.flatMap(item=>item.frameIntervalsMs.values),afterFrames=after.flatMap(item=>item.frameIntervalsMs.values);
    const baselineFrameStats=stats(beforeFrames),candidateFrameStats=stats(afterFrames),baselineCompletion=stats(before.map(item=>item.completionElapsedMs)),candidateCompletion=stats(after.map(item=>item.completionElapsedMs));
    const trialP50=before.map(item=>item.frameIntervalsMs.p50),trialP95=before.map(item=>item.frameIntervalsMs.p95),trialMax=before.map(item=>item.frameIntervalsMs.max),trialCompletion=before.map(item=>item.completionElapsedMs);
    const coarseFrameSampling=baselineFrameStats.count<=32&&candidateFrameStats.count<=32&&baselineFrameStats.p95>=100&&candidateFrameStats.p95>=100;
    const coarseFrameResolutionMs=Math.ceil((oneRefreshQuantumMs+.1)*10)/10;
    const tolerances={frameP50Ms:Math.max(coarseFrameSampling?coarseFrameResolutionMs:.5,3*mad(trialP50)),frameP95Ms:Math.max(coarseFrameSampling?coarseFrameResolutionMs:1,3*mad(trialP95)),frameMaximumMs:Math.max(coarseFrameSampling?coarseFrameResolutionMs:4,3*mad(trialMax)),completionP95Ms:Math.max(15,3*mad(trialCompletion))};
    const checks={
      frameP50: candidateFrameStats.p50<=baselineFrameStats.p50+tolerances.frameP50Ms,
      frameP95: candidateFrameStats.p95<=baselineFrameStats.p95+tolerances.frameP95Ms,
      frameMaximum: candidateFrameStats.max<=baselineFrameStats.max+tolerances.frameMaximumMs,
      completionElapsedP95: candidateCompletion.p95<=baselineCompletion.p95+tolerances.completionP95Ms,
    };
    report.push({viewport:baseline.viewport,motion,measuredTrials:before.length,warmupTrialsExcluded:1,baseline:{frameIntervalsMs:baselineFrameStats,completionElapsedMs:baselineCompletion,trialFrameP50Ms:trialP50,trialFrameP95Ms:trialP95,trialFrameMaximumMs:trialMax,trialCompletionElapsedMs:trialCompletion},candidate:{frameIntervalsMs:candidateFrameStats,completionElapsedMs:candidateCompletion},sampling:{coarseFrameSampling,frameIntervalsPerTrial:before.map(item=>item.frameIntervalsMs.count),completionP95SampleCount:before.length,completionP95EqualsTrialMaximum:baselineCompletion.p95===baselineCompletion.max},tolerances,checks,pass:Object.values(checks).every(Boolean)});
  }
  return report;
}

const inputs=await Promise.all([baseline390Path,baseline1280Path,candidate390Path,candidate1280Path].map(read));
const [baseline390,baseline1280,candidate390,candidate1280]=inputs;
assert.equal(baseline390.viewport.width,390);assert.equal(baseline1280.viewport.width,1280);assert.equal(candidate390.viewport.width,390);assert.equal(candidate1280.viewport.width,1280);
const comparisons=[...compareDocuments(baseline390,candidate390),...compareDocuments(baseline1280,candidate1280)];
const result={schemaVersion:1,baselineSha:baseline390.sourceSha,candidateSha:candidate390.sourceSha,browser:{product:baseline390.browser.product,revision:baseline390.browser.revision},conditions:{deviceScaleFactor:1,webgl:'SwiftShader via ANGLE',dataset:'Current production polyethylene route; five actual pointer trials per motion mode, first trial warm-up.'},methodology:{frameInterval:'Intervals between requestAnimationFrame callback timestamps while the finite completion is active.',completionElapsed:'molecule-craft:reaction-lab-polymer-sample to molecule-craft:reaction-lab-polymer-sample-present.',jsUpdateTimeMs:'NOT_MEASURED',renderSubmissionTimeMs:'NOT_MEASURED',gpuExecutionTimeMs:'NOT_MEASURED',regressionRule:'P50/P95/max frame interval and P95 completion latency must remain within the corresponding baseline statistic plus max(floor, 3×MAD across the four baseline trial summaries). Median and MAD use the conventional midpoint for even-sized samples. When both baseline and candidate frame sampling are coarse (≤32 intervals each and pooled P95 ≥100 ms), P50/P95/max floors use one 60 Hz refresh quantum plus 0.1 ms, rounded upward to the 0.1 ms interval reporting resolution. This accounts for a single quantized callback controlling the statistic; every raw interval remains reported. The four-trial completion P95 is the trial maximum and uses the baseline trial MAD. Resource counts, layout/allocation counts, module resource count, browser revision, and test conditions must match exactly.',thresholdFloors:{frameP50Ms:.5,frameP95Ms:1,frameMaximumMs:4,coarseFrameP50Ms:Math.ceil((oneRefreshQuantumMs+.1)*10)/10,coarseFrameP95Ms:Math.ceil((oneRefreshQuantumMs+.1)*10)/10,coarseFrameMaximumMs:Math.ceil((oneRefreshQuantumMs+.1)*10)/10,completionP95Ms:15}},comparisons,pass:comparisons.every(item=>item.pass)};
await mkdir(dirname(resolve(outputPath)),{recursive:true});await writeFile(resolve(outputPath),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
if(!result.pass)process.exitCode=1;
