import assert from 'node:assert/strict';
import {verifyProfile} from '../scripts/summarize-field-profile.mjs';
// A bounded recorded-shape fixture tests fail-closed verifier behavior, not clocks.
const row={name:'normal',reduced:false,stage:'p4-runtime',variant:'baseline',dimensions:[390,844],frames:2,initialPopulation:{totalDust:4530},finalPopulation:{totalDust:4530},raw:{cpu:[1,2],simulation:[.2,.3],render:[.8,1.7]}};
const report={mode:'coarse',runs:5,scenarios:['normal'],results:[false,true].flatMap(reduced=>Array.from({length:5},()=>structuredClone({...row,reduced})))};
assert.equal(verifyProfile(report),true);
const edited=fn=>{const r=structuredClone(report);fn(r);return r;};
assert.throws(()=>verifyProfile(edited(r=>r.results.pop())),/Missing repeated condition/);
assert.throws(()=>verifyProfile(edited(r=>r.results[1].finalPopulation.totalDust++)),/Population drift/);
assert.throws(()=>verifyProfile(edited(r=>r.results[0].raw.cpu.pop())),/Missing frame samples/);
assert.throws(()=>verifyProfile(edited(r=>r.results[0].raw.cpu[0]=-1)),/Invalid frame samples/);
assert.equal(verifyProfile(edited(r=>{for(const x of r.results)x.raw.cpu=x.raw.cpu.map(v=>v+1000);})),true,'No clock budget becomes a CI gate');
console.log('P5 authority PASS: complete repeats/raw samples, drift rejection, no timing gate.');
