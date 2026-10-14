import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {captureRunnerSnapshot,compareRunnerSnapshots,parseProcStat} from '../scripts/stage-b-runner-telemetry.mjs';

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

test('runner snapshot records available Linux host and process-tree context',{skip:process.platform!=='linux'||visibleProcSelfPid!==process.pid},async()=>{
  const result=await captureRunnerSnapshot(process.pid);
  assert.equal(result.browserProcesses.rootPid,process.pid);
  assert.equal(result.browserProcesses.available,true);
  assert.ok(result.logicalCpuCount>0);
  assert.ok(Array.isArray(result.loadAverage));
});
