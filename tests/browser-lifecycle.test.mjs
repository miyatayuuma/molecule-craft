import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile, writeFile, rm, access} from 'node:fs/promises';
import {join} from 'node:path';
import {createBrowserLifecycle} from './helpers/browser-lifecycle.mjs';

const options=records=>({name:'lifecycle-test',report:record=>records.push(record)});
const start=async(lease,code)=>{
  const child=lease.launch(process.execPath,['-e',code,'--',`--user-data-dir=${lease.profile}`],{stdio:['ignore','pipe','pipe']});
  await once(child.stdout,'data');
  return child;
};

test('a failed body is recorded before cleanup and its original exception survives',async()=>{
  const records=[],primary=new Error('actual assertion failed'),lease=await createBrowserLifecycle(options(records));
  await assert.rejects(lease.run(async()=>{throw primary;}),error=>error===primary);
  assert.deepEqual(records.map(r=>[r.phase,r.status]),[['body','FAIL'],['cleanup','PASS']]);
  await assert.rejects(access(lease.profile),{code:'ENOENT'});
});

test('cleanup failure cannot turn a passing body into a passing test',async()=>{
  const records=[],cleanup=Object.assign(new Error('directory busy'),{code:'ENOTEMPTY'});
  const lease=await createBrowserLifecycle({...options(records),removeProfile:async()=>{throw cleanup;}});
  try{
    await assert.rejects(lease.run(async()=>{}),error=>error instanceof AggregateError&&error.errors[0]===cleanup);
    assert.deepEqual(records.map(r=>[r.phase,r.status]),[['body','PASS'],['cleanup','FAIL']]);
  }finally{await rm(lease.profile,{recursive:true,force:true});}
});

test('simultaneous body and cleanup errors are both retained with primary cause',async()=>{
  const records=[],primary=new Error('underlying timeout'),cleanup=new Error('cleanup failure');
  const lease=await createBrowserLifecycle({...options(records),removeProfile:async()=>{throw cleanup;}});
  try{
    await assert.rejects(lease.run(async()=>{throw primary;}),error=>error instanceof AggregateError&&error.cause===primary&&error.errors[0]===primary&&error.errors[1]===cleanup);
    assert.deepEqual(records.map(r=>[r.phase,r.status]),[['body','FAIL'],['cleanup','FAIL']]);
  }finally{await rm(lease.profile,{recursive:true,force:true});}
});

test('even a falsy thrown value remains a body failure',async()=>{
  const records=[],lease=await createBrowserLifecycle(options(records));
  let caught=false;
  try{await lease.run(async()=>{throw undefined;});}catch(error){caught=true;assert.equal(error,undefined);}
  assert.equal(caught,true);assert.equal(records[0].status,'FAIL');
});

test('profile removal waits for actual child close, including delayed exit work',async()=>{
  const records=[];let child;
  const lease=await createBrowserLifecycle({...options(records),removeProfile:async(path,settings)=>{
    assert.equal(child.exitCode,0);
    assert.equal(await readFile(join(path,'exit-completed'),'utf8'),'finished');
    assert.equal(settings.maxRetries,8);
    await rm(path,settings);
  }});
  await lease.run(async()=>{
    child=await start(lease,`const fs=require('node:fs');const p=process.argv.find(s=>s.startsWith('--user-data-dir=')).split('=')[1];process.on('SIGTERM',()=>setTimeout(()=>{fs.writeFileSync(p+'/exit-completed','finished');process.exit(0)},120));console.log('ready');setInterval(()=>{},1000);`);
  });
  assert.equal(records.at(-1).process.code,0);assert.equal(records.at(-1).status,'PASS');
});

test('an owned child that ignores graceful termination is killed within a bound',async()=>{
  const records=[],lease=await createBrowserLifecycle({...options(records),exitTimeoutMs:100});
  await lease.run(async()=>{await start(lease,"process.on('SIGTERM',()=>{});console.log('ready');setInterval(()=>{},1000);");});
  assert.equal(records.at(-1).process.forced,true);
  assert.equal(records.at(-1).process.signal,'SIGKILL');
});

test('ownership marker replacement refuses recursive removal and preserves failure',async()=>{
  const records=[],lease=await createBrowserLifecycle(options(records));
  try{
    await assert.rejects(lease.run(async()=>{await writeFile(join(lease.profile,'.test-profile-owner'),'another owner');}),/cleanup failed/);
    await access(lease.profile);
    assert.match(records.at(-1).errors[0].message,/ownership changed/);
  }finally{await rm(lease.profile,{recursive:true,force:true});}
});

test('leases are private, cannot adopt another profile, and cannot be reused',async()=>{
  const records=[],a=await createBrowserLifecycle(options(records)),b=await createBrowserLifecycle(options(records));
  assert.notEqual(a.profile,b.profile);
  await a.run(async()=>{assert.throws(()=>a.launch(process.execPath,[`--user-data-dir=${b.profile}`]),/lease/);});
  await access(b.profile);
  await assert.rejects(a.run(async()=>{}),/already run/);
  await b.run(async()=>{});
});
