import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const fixture=JSON.parse(gunzipSync(await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/5f344-heap-resource-nodes.json.gz',import.meta.url))));
const script=new URL('../scripts/summarize-polymer-task5-heaps.mjs',import.meta.url);
async function grade(mutate){
  const dir=await mkdtemp(join(tmpdir(),'task5-heap-grade-'));
  try{
    const cycles=structuredClone(fixture.cycles);mutate?.(cycles.at(-1));
    for(const cycle of cycles)await writeFile(join(dir,'heap-'+cycle.kind+'.heapsnapshot'),JSON.stringify(cycle));
    const result=spawnSync(process.execPath,[script.pathname,dir],{encoding:'utf8'});
    return{status:result.status,report:JSON.parse(await readFile(join(dir,'heap-summary.json'),'utf8'))};
  }finally{await rm(dir,{recursive:true,force:true});}
}
test('actual PF heap release is preserved as a decrease, not reported as accumulation',async()=>{
  const {status,report}=await grade();assert.equal(status,0);assert.deepEqual(report.resourceGrowth,[]);
  assert.ok(report.resourceDifferences.includes('object|ArrayBuffer'));
  assert.deepEqual(report.cycles.map(c=>c.resources['object|ArrayBuffer'].count),[75,73,73]);
});
test('a new resource after the measured decrease still fails',async()=>{
  const {status,report}=await grade(c=>c.nodes.push(0,c.strings.indexOf('ArrayBuffer'),0));
  assert.notEqual(status,0);assert.equal(report.resourceGrowth[0].from,'water');assert.equal(report.resourceGrowth[0].key,'object|ArrayBuffer');
});
test('increased backing bytes fail even when the resource count is unchanged',async()=>{
  const {status,report}=await grade(c=>{const name=c.strings.indexOf('system / JSArrayBufferData');for(let i=0;i<c.nodes.length;i+=3)if(c.nodes[i+1]===name){c.nodes[i+2]+=8;break;}});
  assert.notEqual(status,0);assert.equal(report.resourceGrowth[0].key,'native|system / JSArrayBufferData');
});
