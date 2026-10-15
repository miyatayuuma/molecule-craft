import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {connectBrowserProcessMetadata,captureChromiumProcessAuthority} from '../scripts/chromium-renderer-identity.mjs';
import {attributeSlowIntervals} from '../scripts/stage-b-trace-attribution.mjs';

class Socket extends EventTarget{
  static instances=[];
  constructor(url){super();this.url=url;this.closed=false;Socket.instances.push(this);queueMicrotask(()=>this.dispatchEvent(new Event(url.includes('fail')?'error':'open')));}
  send(data){this.sent=JSON.parse(data);}
  reply(result,error){const event=new Event('message');event.data=JSON.stringify({id:this.sent.id,result,error});this.dispatchEvent(event);}
  close(){if(this.closed)return;this.closed=true;this.dispatchEvent(new Event('close'));}
}

test('Browser transport success, unsupported metadata, in-flight close and late sends are bounded',async()=>{
  const connection=await connectBrowserProcessMetadata('ws://instance/browser/one',{WebSocketImpl:Socket,timeoutMs:50});
  const page={available:true,identity:{pid:2,tid:2,browserPid:1,processName:'Renderer',source:'browser-performance-marker-trace-pid-tid'},markerIds:['this-page']};
  const metadata=captureChromiumProcessAuthority(connection.send,page);
  assert.equal(connection.socket.sent.method,'SystemInfo.getProcessInfo');
  connection.socket.reply({processInfo:[{id:1,type:'browser'},{id:2,type:'renderer'}]});
  assert.equal((await metadata).available,true);
  const unsupported=captureChromiumProcessAuthority(connection.send,page);connection.socket.reply(null,{message:'unsupported'});
  assert.equal((await unsupported).reason,'system-info-process-metadata-unavailable');
  const pending=connection.send('SystemInfo.getProcessInfo');const rejection=assert.rejects(pending,/browser-cdp-closed/);connection.close();await rejection;
  await assert.rejects(connection.send('SystemInfo.getProcessInfo'),/browser-cdp-closed/);assert.equal(connection.socket.closed,true);
});

test('connection failure and timeout close the socket; request timeout rejects without false authority',async()=>{
  await assert.rejects(connectBrowserProcessMetadata('ws://fail',{WebSocketImpl:Socket,timeoutMs:10}),/connect-failed/);assert.equal(Socket.instances.at(-1).closed,true);
  class SilentSocket extends Socket{constructor(url){super(url);}addEventListener(type,...args){if(type==='open')return;return super.addEventListener(type,...args);}}
  await assert.rejects(connectBrowserProcessMetadata('ws://silent',{WebSocketImpl:SilentSocket,timeoutMs:10}),/connect-timeout/);assert.equal(Socket.instances.at(-1).closed,true);
  const connection=await connectBrowserProcessMetadata('ws://ok',{WebSocketImpl:Socket,timeoutMs:10});
  await assert.rejects(connection.send('SystemInfo.getProcessInfo'),/request-timeout/);connection.close();
});

test('both diagnostic callers supply Browser authority, retain failures, and close the transport',()=>{
  for(const path of ['scripts/profile-reaction-lab-stage-b.mjs','tests/reaction-lab-polymer-browser.test.mjs']){
    const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
    assert.match(source,/capturePageRendererIdentity\(\{socket,send,evaluate,browserSend:browserCdp\?\.send,/);
    assert.match(source,/127\.0\.0\.1:\$\{debugPort\}\/json\/version/);
    assert.match(source,/browserTransport=|browserTransport:/);
    assert.match(source,/browserCdp\?\.close\(\)/);
    assert.match(source,/processAuthority\?\.available,true/);
    assert.match(source,/Measured root must match declared source SHA/);
  }
});

test('large or missing clock uncertainty cannot authorize a classification from coincident CPU and GC',()=>{
  const options={durationsMs:[10],stepWindowsMs:[[0,10]],traceEvents:[{pid:2,tid:2,name:'V8.GC_SCAVENGER',ts:0,dur:10000}],traceClockMapping:{available:true,slope:1,offset:0,uncertaintyMs:.01},schedulerPerStep:[{available:true,adequate:true,pid:2,tid:2,runtimeMs:8,runQueueWaitMs:0,clockMappingUncertaintyMs:2}]};
  assert.equal(attributeSlowIntervals(options)[0].attributionClassification,'UNATTRIBUTED');
  options.schedulerPerStep[0].clockMappingUncertaintyMs=.01;
  assert.equal(attributeSlowIntervals(options)[0].attributionClassification,'V8_GC');
});

test('C7 campaigns require exact-head title opt-in and cannot use acceptance jobs on sync/title restore',()=>{
  const workflow=readFileSync(new URL('../.github/workflows/reaction-lab-finite-polymer-validation.yml',import.meta.url),'utf8');
  for(const job of ['finite-validation','stage-b-performance-comparison']){
    const condition=workflow.split(`  ${job}:\n`)[1].split('\n')[0];assert.match(condition,/!contains\(github.event.pull_request.labels.\*\.name, 'task12c-diagnostic-only'\)/);
  }
  const gates=workflow.split('  c7-diagnostic-gates:\n')[1].split('    runs-on:')[0];
  assert.match(gates,/github.event.action == 'edited'/);assert.match(gates,/github.event.changes.title != null/);assert.match(gates,/title == format\('\[TASK12C7-RUN\] \{0\}', github.event.pull_request.head.sha\)/);
  for(const job of ['c7-stage-b-diagnostic','c7-finite-diagnostic'])assert.match(workflow.split(`  ${job}:\n`)[1].split('    steps:')[0],/needs: c7-diagnostic-gates/);
});
