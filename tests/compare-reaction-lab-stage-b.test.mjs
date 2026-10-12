import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';

const script=fileURLToPath(new URL('../scripts/compare-reaction-lab-stage-b.mjs',import.meta.url));
const makeProfile=(sourceSha,trialP95Ms,pooledP95Ms)=>({
  sourceSha,
  browser:{product:'Chrome/154.0.8037.97',revision:'@test',protocolVersion:'1.3'},
  viewport:{width:390,height:844,deviceScaleFactor:1,mobile:true},
  motion:'normal',
  workload:{instances:6,chemistry:'methane + oxygen + 2-butene',fullMatcherRules:29,candidateCountPerFixedStep:[384,384,384,384],assertedMinimumCandidates:384},
  trials:trialP95Ms.map((p95Ms,index)=>({label:`measured-${index+1}`,candidateCount:384,reactionIds:['complete-methane-combustion'],stepCount:150,p95Ms,frameIntervalsMs:Array(150).fill(p95Ms)})),
  pooled:{stepCount:600,p95Ms:pooledP95Ms},
});

async function runComparison({baselineP95=[8,8,8.1,8.1],candidateP95=[8,8.1,8.1,8.1],baselinePooled=8.1,candidatePooled=8.1,baselineSha='task10-main',candidateSha='task11-head'}={}){
  const directory=await mkdtemp(join(tmpdir(),'stage-b-comparison-'));
  try{
    const paths={baseline:join(directory,'baseline.json'),candidate:join(directory,'candidate.json'),output:join(directory,'comparison.json')};
    await Promise.all([
      writeFile(paths.baseline,JSON.stringify(makeProfile(baselineSha,baselineP95,baselinePooled))),
      writeFile(paths.candidate,JSON.stringify(makeProfile(candidateSha,candidateP95,candidatePooled))),
    ]);
    const result=spawnSync(process.execPath,[script,paths.baseline,paths.candidate,paths.output],{encoding:'utf8',env:{...process.env,POLYMER_BASELINE_SHA:'task10-main',POLYMER_CANDIDATE_SHA:'task11-head'}});
    let report=null;try{report=JSON.parse(await readFile(paths.output,'utf8'));}catch{}
    return{result,report};
  }finally{await rm(directory,{recursive:true,force:true});}
}

test('Stage B comparison passes only with the Task ⑩ baseline, Task ⑪ source, hard gates, and no significant delta',async()=>{
  const {result,report}=await runComparison();
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(report.pass,true);
  assert.equal(report.baseline.sourceSha,'task10-main');
  assert.equal(report.candidate.sourceSha,'task11-head');
  assert.equal(report.budgetMs,1000/120);
});

test('Stage B comparison accepts P95 values exactly at the unchanged 8.333 ms boundary',async()=>{
  const boundary=1000/120,{result,report}=await runComparison({baselineP95:[8.3,8.3,8.2,8.3],baselinePooled:8.3,candidateP95:[boundary,boundary,boundary,boundary],candidatePooled:boundary});
  assert.equal(result.status,0,result.stderr||result.stdout);
  assert.equal(report.checks.candidateEveryTrialHardGate,true);
  assert.equal(report.checks.candidatePooledHardGate,true);
});

test('Stage B comparison fails when one trial exceeds 8.333 ms even if pooled P95 passes',async()=>{
  const {result,report}=await runComparison({candidateP95:[8,8.4,7.9,8.1],candidatePooled:8.1});
  assert.equal(result.status,1);
  assert.equal(report.checks.candidateEveryTrialHardGate,false);
  assert.equal(report.checks.candidatePooledHardGate,true);
});

test('Stage B comparison fails a significant baseline-relative delta below the absolute budget',async()=>{
  const {result,report}=await runComparison({baselineP95:[7.3,7.3,7.3,7.3],baselinePooled:7.3,candidateP95:[7.6,7.6,7.6,7.6],candidatePooled:7.6});
  assert.equal(result.status,1);
  assert.equal(report.checks.candidateEveryTrialHardGate,true);
  assert.equal(report.checks.candidatePooledHardGate,true);
  assert.equal(report.checks.candidateMedianNoSignificantRegression,false);
});

test('Stage B comparison rejects a non-Task-⑩ baseline identity',async()=>{
  const {result}=await runComparison({baselineSha:'task9-main'});
  assert.equal(result.status,1);
  assert.match(result.stderr,/immutable Task ⑩ main SHA/);
});
