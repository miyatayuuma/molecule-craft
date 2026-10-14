import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureRunnerSnapshot,compareRunnerSnapshots,parseProcStat,summarizeSlowIntervals} from '../scripts/stage-b-runner-telemetry.mjs';

const visibleProcSelfPid=process.platform==='linux'?Number(readFileSync('/proc/self/stat','utf8').split(' ')[0]):null;

test('Linux proc stat parsing preserves process names containing closing parentheses',()=>{
  const fields=['R','7','0','0','0','0','0','0','0','0','0','120','30',...Array(20).fill('0')];
  const result=parseProcStat(`123 (chrome ) renderer) ${fields.join(' ')}`,123,100);
  assert.deepEqual(result,{pid:123,state:'R',parentPid:7,cpuMs:1500});
});

test('runner snapshot comparison distinguishes browser CPU time, host pressure, and cgroup throttling',()=>{
  const snapshot=(cpuMs,totalTicks,idleTicks,usage,throttled,load)=>({
    browserProcesses:{available:true,processes:[{pid:10,state:'R',cpuMs}]},
    systemCpu:{totalTicks,idleTicks},cgroupCpu:{usage_usec:usage,throttled_usec:throttled},
    loadAverage:[load,load,load],cpuPressure:`some avg10=${load} avg60=0 avg300=0 total=1`,cgroupCpuMax:'100000 100000'
  });
  const result=compareRunnerSnapshots(snapshot(100,1000,600,100000,10000,1),snapshot(145,1200,700,135000,17000,2),100);
  assert.equal(result.browserCpuMs,45);
  assert.equal(result.browserCpuToWallRatio,.45);
  assert.equal(result.hostCpuBusyPercent,50);
  assert.equal(result.cgroupCpuUsageDeltaMs,35);
  assert.equal(result.cgroupThrottledDeltaMs,7);
  assert.equal(result.processTreeAvailable,true);
});

test('diagnostic slow-interval analysis keeps sample positions and contiguous runs aligned with timestamp windows',()=>{
  const result=summarizeSlowIntervals([5,9,10,7,11,12],[[100,105],[105,114],[114,124],[124,131],[131,142],[142,154]],8.333333333333334,100);
  assert.equal(result.measuredSampleCount,6);
  assert.deepEqual(result.slowSamples.map(sample=>sample.stepIndex),[1,2,4,5]);
  assert.deepEqual(result.slowSamples.map(sample=>sample.elapsedFromTrialStartMs),[5,14,31,42]);
  assert.deepEqual(result.consecutiveSlowRuns.map(run=>({first:run.firstStepIndex,last:run.lastStepIndex,count:run.count})),[{first:1,last:2,count:2},{first:4,last:5,count:2}]);
  assert.equal(result.maximumConsecutiveSlowCount,2);
});

test('runner snapshot records available Linux host and process-tree context',{skip:process.platform!=='linux'||visibleProcSelfPid!==process.pid},async()=>{
  const result=await captureRunnerSnapshot(process.pid);
  assert.equal(result.browserProcesses.rootPid,process.pid);
  assert.equal(result.browserProcesses.available,true);
  assert.ok(result.logicalCpuCount>0);
  assert.ok(Array.isArray(result.loadAverage));
});
