import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script=fileURLToPath(new URL('../scripts/compare-polymer-performance.mjs',import.meta.url));
const baselineSha='4bc202c0eb1f51de0350c3a0b4be36c7178cba53';
const candidateSha='a3bfc66b97200e854f4c1611bce1ebeeadf1e569';
const browser={product:'Chrome/154.0.8037.97',revision:'@b510e9d7cd3a2fbd78d0ddc42234103206c5f78d'};
const runtimeFlags=['--headless=new','--use-gl=angle','--use-angle=swiftshader'];
const baselineReduced=[[16.7,116.6],[16.7,99.9],[16.7,83.3],[16.7,99.9]];
const candidateReduced=[[33.4,83.3],[16.7,83.3],[16.6,83.3],[33.4,83.3]];
const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*q)-1)];
const percentileSummary=values=>({count:values.length,p50:quantile(values,.5),p95:quantile(values,.95),max:Math.max(...values),values});

function profile(sourceSha,viewportWidth,isCandidate){
  const measurements=[];
  for(const motion of ['normal','reduced']){
    for(let trialIndex=0;trialIndex<=4;trialIndex++){
      const warmup=trialIndex===0;
      const reducedDesktop=motion==='reduced'&&viewportWidth===1280;
      const sampleSets=reducedDesktop?(isCandidate?candidateReduced:baselineReduced):Array.from({length:4},()=>[16.7,16.8]);
      const intervals=warmup?[16.7,150]:sampleSets[trialIndex-1]??[16.7,150];
      const completionElapsedMs=warmup?430:(isCandidate&&reducedDesktop?[414,267.6,431.6,425.7][trialIndex-1]:[420,422,424,428][trialIndex-1]);
      measurements.push({
        sourceSha,
        routeId:'polyethylene-coordination',
        polymerId:'polyethylene',
        viewport:{width:viewportWidth,height:viewportWidth===390?844:900,deviceScaleFactor:1},
        motion,
        trialIndex,
        warmup,
        targetDurationMs:motion==='reduced'?250:650,
        completionElapsedMs,
        frameIntervalsMs:percentileSummary(intervals),
        jsUpdateTimeMs:'NOT_MEASURED',
        renderSubmissionTimeMs:'NOT_MEASURED',
        gpuExecutionTimeMs:'NOT_MEASURED',
        polymerRuntimeMetrics:{finiteLayoutCalls:(trialIndex+1)*4,bondVisualAllocations:(trialIndex+1)*23,completionFitCalls:trialIndex+1,completionLayoutCallsAfterReady:0,...(isCandidate?{layoutComputationMs:8+(trialIndex*7)}:{})},
        polymerResources:{activeGroupCount:1,objectCount:48,geometryCount:47,materialCount:47,disposals:{geometryDisposals:235,materialDisposals:235}},
        moduleFetchCount:isCandidate?146:145,
        retiredModuleFetchCount:0,
        runtimeFlags,
        browser:browser.product,
      });
    }
  }
  return{schemaVersion:1,sourceSha,browser,viewport:{width:viewportWidth,height:viewportWidth===390?844:900,mobile:viewportWidth===390,deviceScaleFactor:1},warmupPolicy:'First completion for each motion mode is retained but excluded from aggregate regression statistics.',measurements};
}

test('low-sample RAF comparison keeps the existing coarse-resolution floors when candidate P95 improves below 100 ms',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'polymer-performance-comparison-'));
  try{
    const paths=['baseline-390.json','baseline-1280.json','candidate-390.json','candidate-1280.json','comparison.json'].map(name=>join(directory,name));
    const docs=[profile(baselineSha,390,false),profile(baselineSha,1280,false),profile(candidateSha,390,true),profile(candidateSha,1280,true)];
    await Promise.all(docs.map((document,index)=>writeFile(paths[index],JSON.stringify(document))));
    const result=spawnSync(process.execPath,[script,...paths],{encoding:'utf8',env:{...process.env,POLYMER_BASELINE_SHA:baselineSha,POLYMER_CANDIDATE_SHA:candidateSha}});
    assert.equal(result.status,0,result.stderr||result.stdout);
    const report=JSON.parse(await readFile(paths[4],'utf8'));
    const desktopReduced=report.comparisons.find(item=>item.viewport.width===1280&&item.motion==='reduced');
    assert.equal(report.pass,true);
    assert.equal(desktopReduced.baseline.frameIntervalsMs.count,8);
    assert.equal(desktopReduced.candidate.frameIntervalsMs.count,8);
    assert.equal(desktopReduced.baseline.frameIntervalsMs.p50,16.7);
    assert.equal(desktopReduced.candidate.frameIntervalsMs.p50,33.4,'pooled coarse-sample P50 remains visible in the report');
    assert.equal(desktopReduced.baseline.frameIntervalsMs.p95,116.6);
    assert.equal(desktopReduced.candidate.frameIntervalsMs.p95,83.3,'candidate improvement below 100 ms must not change the low-sample resolution class');
    assert.deepEqual(desktopReduced.sampling.frameIntervalsPerTrial,{baseline:[2,2,2,2],candidate:[2,2,2,2]});
    assert.equal(desktopReduced.sampling.coarseFrameSampling,true);
    assert.equal(desktopReduced.comparisonStatistic.frameP50Ms.baselineMedianOfTrialP50s,16.7);
    assert.ok(Math.abs(desktopReduced.comparisonStatistic.frameP50Ms.candidateMedianOfTrialP50s-25.05)<1e-9);
    assert.equal(desktopReduced.checks.frameP50,true);
    assert.equal(desktopReduced.checks.frameMaximum,true);
    assert.deepEqual(desktopReduced.layoutGenerationTimingMs,{baselinePerTrial:['NOT_MEASURED','NOT_MEASURED','NOT_MEASURED','NOT_MEASURED'],candidatePerTrial:[7,7,7,7]});
  }finally{
    await rm(directory,{recursive:true,force:true});
  }
});
