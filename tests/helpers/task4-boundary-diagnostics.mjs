import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';

// Opt-in, localhost fixture observers. These files are never production assets.
export const boundaryDiagnostic = process.env.TASK4_BOUNDARY_DIAGNOSTIC === '1';

export async function beginBoundaryTrace({send,socket,evaluate,artifactDir,motion,trialIndex,roundtrips}) {
  await evaluate('window.__task4BoundaryRows.length=0;true');
  roundtrips.length=0;
  const traceEvents=[];
  const availableCategories=(await send('Tracing.getCategories')).categories;
  const requestedCategories=['toplevel','devtools.timeline','renderer.scheduler','v8','blink.user_timing','cc','gpu','viz','disabled-by-default-devtools.timeline','disabled-by-default-gpu.service','disabled-by-default-v8.gc'];
  const enabledCategories=requestedCategories.filter(category=>availableCategories.includes(category));
  assert.ok(enabledCategories.includes('toplevel')&&enabledCategories.includes('devtools.timeline'),'Required diagnostic trace categories must exist');
  let tracingComplete;
  const listener=event=>{const message=JSON.parse(event.data);if(message.method==='Tracing.dataCollected')traceEvents.push(...message.params.value);if(message.method==='Tracing.tracingComplete')tracingComplete?.();};
  socket.addEventListener('message',listener);
  try { await send('Tracing.start',{categories:enabledCategories.join(','),transferMode:'ReportEvents'}); }
  catch(error) { socket.removeEventListener('message',listener);throw error; }
  return {async save({measurement,primaryError}) {
    const errors=[];
    let timer,rows=[];
    try {
      const complete=new Promise((ok,fail)=>{timer=setTimeout(()=>fail(Error('Diagnostic trace stop timeout')),15000);tracingComplete=ok;});
      await Promise.all([send('Tracing.end'),complete]);
    } catch(error) { errors.push(error); }
    finally {clearTimeout(timer);socket.removeEventListener('message',listener);}
    try {rows=await evaluate('window.__task4BoundaryRows.slice()');}catch(error){errors.push(error);}
    const errorRecord=error=>error?{name:error.name,message:error.message,stack:error.stack}:null;
    const actualMeasurement=measurement?.motion===motion&&measurement?.trialIndex===trialIndex?measurement:null;
    await mkdir(artifactDir,{recursive:true});
    await writeFile(join(artifactDir,`boundary-trace-${motion}-${trialIndex}.json`),JSON.stringify({availableCategories,enabledCategories,traceEvents}));
    await writeFile(join(artifactDir,`boundary-observation-${motion}-${trialIndex}.json`),JSON.stringify({sourceSha:process.env.POLYMER_SOURCE_SHA,trialIndex,warmup:trialIndex===0,motion,rows,roundtrips,measurement:actualMeasurement,primaryError:errorRecord(primaryError),diagnosticErrors:errors.map(errorRecord)},null,2));
    const start=rows.filter(row=>row.name==='molecule-craft:reaction-lab-polymer-sample').at(-1)?.start,early=rows.filter(row=>Number.isFinite(start)&&row.start>=start&&row.start<start+150);
    console.log('TASK4_FINITE_BOUNDARY_DIAGNOSTIC',JSON.stringify({sourceSha:process.env.POLYMER_SOURCE_SHA,trialIndex,start,primaryError:errorRecord(primaryError),diagnosticErrors:errors.map(errorRecord),early:early.filter(row=>row.durationMs>1||row.name==='tick'||row.name.startsWith('molecule-craft:')),frameIntervalsMs:actualMeasurement?.frameIntervalsMs}));
    if(errors.length)throw new AggregateError(errors,'Diagnostic capture incomplete');
  }};
}

export function instrumentViewer(source) {
  if (!boundaryDiagnostic) return source;
  const size='renderer.setSize(rect.width,rect.height,false);';
  assert.ok(source.includes(size),'Missing setSize diagnostic boundary');
  source=source.replace(size,`const __sizeBefore={width:canvas.width,height:canvas.height,pixelRatio:renderer.getPixelRatio()},__sizeStarted=performance.now();try{${size}}finally{globalThis.__task4BoundaryRecord?.('renderer.setSize',__sizeStarted,performance.now(),{before:__sizeBefore,requested:{width:rect.width,height:rect.height},after:{width:canvas.width,height:canvas.height}});}`);
  for (const name of ['resize', 'tick']) {
    const marker = name === 'resize' ? 'function resize(){' : 'function tick(now){';
    const start = source.indexOf(marker);
    assert.ok(start >= 0, `Missing ${name} diagnostic boundary`);
    const body = start + marker.length;
    let depth = 1, end = body;
    // Both bounded bodies contain balanced JS blocks and no brace literals.
    for (; end < source.length && depth; end++) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}') depth--;
    }
    assert.equal(depth, 0);
    source = source.slice(0, body) + `const __boundaryStarted=performance.now();try{` + source.slice(body, end - 1) + `}finally{globalThis.__task4BoundaryRecord?.('${name}',__boundaryStarted,performance.now(),${name === 'tick' ? '{rafTimestamp:now}' : '{}'});}` + source.slice(end - 1);
  }
  const render = 'renderer.render(scene,camera);';
  assert.ok(source.includes(render));
  return source.replaceAll(render, `{const __renderStarted=performance.now();try{${render}}finally{globalThis.__task4BoundaryRecord?.('renderer.render',__renderStarted,performance.now(),{});}}`);
}

export function instrumentSupply(source) {
  if (!boundaryDiagnostic) return source;
  for (const [marker, label, details] of [
    ['function requestDestinationLaunch(id){', 'destination-request', '{id}'],
    ['function requestLaunch(destinationId){', 'request-launch', '{destinationId,launchBusy,requestedDestinationId,blocked:resources.blocked,canOpen:canOpen(),plan:resources.launchFillPlan().status}'],
    ['function showPartialConfirm(plan){', 'show-partial', '{plan:plan.status}'],
    ['async function commitAndContinue(partial){', 'commit-entry', '{partial,requestedDestinationId,launchBusy,blocked:resources.blocked,canOpen:canOpen()}'],
    ["partialGo.addEventListener('click',()=>{", 'partial-click', '{}'],
  ]) {
    assert.ok(source.includes(marker), `Missing ${label} diagnostic boundary`);
    source = source.replace(marker, marker + `globalThis.__task4LaunchRecord?.('${label}',${details});`);
  }
  return source;
}

export const boundaryPageSource = `(${function () {
  const rows = [];
  globalThis.__task4BoundaryRows = rows;
  globalThis.__task4BoundaryRecord = (name, start, end, details) => {
    if (rows.length >= 30000) throw Error('Task4 diagnostic record budget exhausted');
    rows.push({name,start,end,durationMs:end-start,requestId:globalThis.__task4EvaluateRequestId??null,...details});
    performance.measure('task4:'+name,{start,end});
  };
  for(const key of ['width','height']) {
    const descriptor=Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype,key);
    Object.defineProperty(HTMLCanvasElement.prototype,key,{...descriptor,set(value){
      if(!this.closest('#reaction-lab'))return descriptor.set.call(this,value);
      const before={width:this.width,height:this.height},start=performance.now();
      try{return descriptor.set.call(this,value);}
      finally{globalThis.__task4BoundaryRecord('canvas.'+key,start,performance.now(),{value,before,after:{width:this.width,height:this.height}});}
    }});
  }
  globalThis.__task4WrapProbe = () => {
    const probe = window.__reactionLabProbe;
    if (probe.__task4Wrapped) return;
    for (const key of ['snapshot','polymerDisplayBounds']) {
      const original = probe[key];
      probe[key] = function (...args) {
        const start = performance.now();
        try { return original.apply(this,args); }
        finally { globalThis.__task4BoundaryRecord('probe.'+key,start,performance.now(),{}); }
      };
    }
    probe.__task4Wrapped = true;
  };
  const nativeRAF = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => nativeRAF(timestamp => {
    const start = performance.now();
    try { return callback.call(window,timestamp); }
    finally { globalThis.__task4BoundaryRecord('raf.callback',start,performance.now(),{rafTimestamp:timestamp,callbackName:callback.name}); }
  });
  for (const type of ['molecule-craft:reaction-lab-polymer-sample','molecule-craft:reaction-lab-polymer-sample-present']) {
    window.addEventListener(type,event => globalThis.__task4BoundaryRecord(type,performance.now(),performance.now(),{sampleId:event.detail.sampleId}),{capture:true});
  }
}})();`;

export const launchPageSource = `(${function () {
  const rows = [];
  globalThis.__task4LaunchRows = rows;
  const describe = node => node ? {tag:node.tagName,id:node.id,className:String(node.className??''),region:node.dataset?.region} : null;
  const rect = node => {const r=node?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
  globalThis.__task4LaunchRecord = (name,details={}) => {
    if (rows.length >= 256) throw Error('Task4 launch diagnostic record budget exhausted');
    const button=document.querySelector('#partial-fill-confirm .primary'),r=button?.getBoundingClientRect();
    rows.push({name,at:performance.now(),...details,partialHidden:document.querySelector('#partial-fill-confirm')?.hidden,partialButton:rect(button),partialHit:r?describe(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)):null,supplyOpen:document.querySelector('#supply-dialog')?.open,fieldHidden:document.querySelector('#veil-view')?.hidden,selectorHidden:document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')});
  };
  for (const type of ['pointerdown','pointerup','click']) document.addEventListener(type,event=>{
    if(!document.querySelector('#supply-dialog')?.open&&!document.querySelector('#collector-applications-dialog')?.open)return;
    const details={eventType:type,eventTimestamp:event.timeStamp,target:describe(event.target),x:event.clientX,y:event.clientY,pointerId:event.pointerId,isTrusted:event.isTrusted};
    globalThis.__task4LaunchRecord('event-capture',details);
    queueMicrotask(()=>globalThis.__task4LaunchRecord('event-after',details));
  },{capture:true,passive:true});
}})();`;
