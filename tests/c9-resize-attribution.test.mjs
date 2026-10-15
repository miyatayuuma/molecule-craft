import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeRecordedResize} from '../scripts/analyze-c9-resize-evidence.mjs';
const identity={pid:5,tid:6},traceClock={available:true,slope:1,offset:0,uncertaintyMs:.05},options={identity,traceClock,gpuAuthority:true};
const proxy={name:'CommandBufferProxyImpl::WaitForGetOffset',pid:5,tid:6,ph:'X',ts:100100,dur:99800},wait={name:'GpuChannel::WaitForGetOffsetInRange',pid:5,tid:6,ph:'X',ts:100200,dur:99600},window={startMs:100,endMs:200};
test('anonymous observer callback still attributes explicit nested waits inside recorded production resize',()=>{
 const r=attributeRecordedResize(window,[proxy,wait],options);assert.equal(r.classification,'GPU_OR_WEBGL_SYNCHRONIZATION');assert.ok(Math.abs(r.definiteSyncWaitMs-99.6)<1e-8);
});
test('outside resize, unrelated renderer, missing proxy and missing GPU authority do not prove synchronization',()=>{
 for(const events of [[{...proxy,ts:300000},{...wait,ts:300200}],[{...proxy,pid:7},{...wait,pid:7}],[wait]])assert.equal(attributeRecordedResize(window,events,options).classification,'UNATTRIBUTED');
 assert.equal(attributeRecordedResize(window,[proxy,wait],{...options,gpuAuthority:false}).classification,'UNATTRIBUTED');
});
test('clock uncertainty cannot be used to claim definite boundary containment; nested waits are unioned once',()=>{
 const edge={...wait,ts:100010,dur:99980};const r=attributeRecordedResize(window,[{...proxy,ts:100000,dur:100000},edge],options);assert.equal(r.classification,'UNATTRIBUTED');assert.equal(r.ambiguousBoundaryWaitCount,1);
 const a=attributeRecordedResize(window,[proxy,wait,wait],options);assert.ok(Math.abs(a.definiteSyncWaitMs-99.6)<1e-8);
 assert.equal(attributeRecordedResize(window,[proxy,wait],{...options,traceClock:{...traceClock,uncertaintyMs:2}}).available,false);
});
