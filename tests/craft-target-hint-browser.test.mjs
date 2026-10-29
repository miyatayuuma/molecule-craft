import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const source=await readFile(new URL('../src/craft-target-hint.js',import.meta.url),'utf8');
const records=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const fixtures=['methylcyclohexane','cyclohexane','benzene','n-hexane'].map(id=>records.find(record=>record.id===id));
assert.ok(fixtures.every(Boolean),'CRAFT repeated-element browser fixtures must exist in molecule DB');
const moduleUrl=`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`,fixtureJson=JSON.stringify(fixtures);
const candidates=['google-chrome','chromium','chromium-browser'];let chrome='';
for(const command of candidates){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}
assert.ok(chrome,'A Chromium browser is required for CRAFT hint regression');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-hint-browser-')),debugPort=9227;
let child=null,socket=null;
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
  let tabs=null;for(let attempt=0;attempt<160;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));}
  assert.ok(tabs?.length,`Chromium DevTools endpoint did not become ready: ${stderr.slice(-1000)}`);
  socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);
  await new Promise((resolveOpen,reject)=>{const timer=setTimeout(()=>reject(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolveOpen();},{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});
  const send=(method,params={})=>new Promise((resolveSend,reject)=>{const id=++sequence;pending.set(id,{resolve:resolveSend,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async(expression,timeout=1500)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,timeout});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};
  await send('Runtime.enable');
  const runScenario=async metrics=>{
    await send('Emulation.setDeviceMetricsOverride',metrics);
    return evaluate(`(async()=>{const {nextCraftBondHint}=await import(${JSON.stringify(moduleUrl)});const records=${fixtureJson};const byId=id=>records.find(record=>record.id===id);const workspace=(atoms,bonds=[])=>({atoms:atoms.map((element,index)=>({id:100+index,element})),bonds:bonds.map(([a,b,order])=>({a:100+a,b:100+b,order}))});const timed=(target,current,stats=null)=>{const start=performance.now(),hint=nextCraftBondHint(target,current,stats?{stats}:undefined);return {elapsed:performance.now()-start,hint};};const target=byId('methylcyclohexane'),timings=[];for(let hydrogen=0;hydrogen<=14;hydrogen++){const result=timed(target,workspace([...Array(7).fill('C'),...Array(hydrogen).fill('H')]));if(!result.hint)throw new Error('missing methylcyclohexane hint at H='+hydrogen);timings.push(result.elapsed);}const full=workspace(target.atoms),first=timed(target,full);const bonded=workspace(target.atoms,[[first.hint.workspaceIndices[0],first.hint.workspaceIndices[1],1]]),afterBond=timed(target,bonded),afterUndo=timed(target,full);const switchedTarget=byId('benzene'),switched=timed(switchedTarget,workspace(switchedTarget.atoms));const peers={};for(const id of ['methylcyclohexane','cyclohexane','benzene','n-hexane']){const record=byId(id),result=timed(record,workspace(record.atoms));if(!result.hint)throw new Error('missing '+id+' hint');peers[id]=result.elapsed;}const alkane=n=>{const atoms=Array(n).fill('C'),bonds=[];for(let i=0;i<n-1;i++)bonds.push([i,i+1,1]);let h=n;for(let i=0;i<n;i++){const count=i===0||i===n-1?3:2;for(let j=0;j<count;j++){atoms.push('H');bonds.push([i,h++,1]);}}return {atoms,bonds};};const largeTarget=alkane(14),largeStats={},large=timed(largeTarget,workspace(largeTarget.atoms,largeTarget.bonds.slice(0,-1)),largeStats);if(!large.hint)throw new Error('missing C14H30 final-bond hint');await new Promise(resolve=>requestAnimationFrame(()=>resolve()));return {maxIncremental:Math.max(...timings),full:first.elapsed,afterBond:afterBond.elapsed,afterUndo:afterUndo.elapsed,switched:switched.elapsed,peers,large:{elapsed:large.elapsed,stats:largeStats,indices:large.hint.workspaceIndices}};})()`);
  };
  const desktop=await runScenario({width:1280,height:800,deviceScaleFactor:1,mobile:false});
  const mobile=await runScenario({width:390,height:844,deviceScaleFactor:2,mobile:true});
  for(const [name,result] of Object.entries({desktop,mobile})){
    const samples=[result.maxIncremental,result.full,result.afterBond,result.afterUndo,result.switched,result.large.elapsed,...Object.values(result.peers)];
    assert.ok(Math.max(...samples)<250,`${name} CRAFT hint refresh exceeded 250ms: ${JSON.stringify(result)}`);
    assert.deepEqual(result.large.indices,[13,43],`${name} C14H30 final missing bond changed`);
    assert.equal(result.large.stats.pairEmbeddingCalls,1,`${name} should run one constrained C14H30 embedding`);
    assert.ok(result.large.stats.recursiveVisits<500,`${name} recursive C14H30 visits regressed: ${JSON.stringify(result.large.stats)}`);
    assert.ok(result.large.stats.candidateAssignments<5000,`${name} C14H30 assignments regressed: ${JSON.stringify(result.large.stats)}`);
  }
  console.log(`CRAFT hint Chromium regression passed: desktop max ${Math.max(desktop.maxIncremental,desktop.full,desktop.large.elapsed).toFixed(2)}ms; mobile-equivalent max ${Math.max(mobile.maxIncremental,mobile.full,mobile.large.elapsed).toFixed(2)}ms.`);
}finally{
  try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(resolveWait=>setTimeout(resolveWait,100));await rm(profile,{recursive:true,force:true});
}
