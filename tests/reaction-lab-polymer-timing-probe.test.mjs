import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');

test('finite completion timing probe is localhost-test-only and exposes the exact timer origin',()=>{
  const guardStart=source.indexOf('if(localhostPhysicsTest){'),probeExposure=source.indexOf('window.__reactionLabProbe=probe;');
  assert.ok(guardStart>=0&&probeExposure>guardStart,'the Reaction Lab probe remains inside its localhost physics-test guard');
  const guardedSource=source.slice(guardStart,probeExposure);
  assert.match(guardedSource,/polymerCompletionTiming\(\)\{const presentation=polymerSamplePresentation;return presentation\?\{sampleId:presentation\.sampleId,timerStartedAtMs:presentation\.startedAt,durationMs:presentation\.durationMs,elapsedMs:presentation\.elapsedMs,ready:presentation\.ready,dismissed:presentation\.dismissed\}:null;\}/);
});

test('completion timer origin is set immediately before sample registration dispatch',()=>{
  const sampleFunction=source.slice(source.indexOf('function finishPolymerSample(result){'),source.indexOf('function advancePolymerCompletion(){'));
  const start=sampleFunction.indexOf('polymerSamplePresentation.startedAt=performance.now();'),registration=sampleFunction.indexOf("dispatchPolymerEvent('molecule-craft:reaction-lab-polymer-sample'");
  assert.ok(start>=0&&registration>start,'timer start precedes sample-registration event');
  assert.ok(registration-start<150,'timer and registration remain adjacent in the same function');
});

test('a real RAF timestamp may precede readiness while its callback executes after readiness',async()=>{
  const {runInNewContext}=await import('node:vm');
  const browserSource=await readFile(new URL('./reaction-lab-polymer-browser.test.mjs',import.meta.url),'utf8');
  const start=browserSource.indexOf('    const requestSampleFrame=record=>{'),end=browserSource.indexOf('    const summarize=',start);
  const record={awaitingTailFrame:true,samplerStoppedAt:null,frameRequestCount:0,frameCallbackCount:0,firstFrameRequestAt:null,firstFrameCallbackAt:null,frames:[]};let callback,stopped;
  const context={active:record,record,performance:{now:()=>120},window:{__polymerPauseTraceEnabled:false},nativeRequestAnimationFrame:fn=>{callback=fn;},stopSampler:(row,reason)=>{stopped=reason;}};
  runInNewContext(browserSource.slice(start,end)+'requestSampleFrame(record);',context);callback(100);
  assert.equal(record.tailFrameAt,100);assert.equal(record.tailFrameCallbackReceivedAt,120);assert.deepEqual(record.frames,[100]);assert.equal(record.frameCallbackCount,1);assert.equal(stopped,'post-ready-frame');
  assert.match(browserSource,/firstPostReadyFrameAtMs:record.tailFrameCallbackReceivedAt\?\?null/);
});
