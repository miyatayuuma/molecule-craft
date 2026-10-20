// Issue352's bounded diagnostic. Ownership/budget: docs/validation/issue352/forensic-audit.md.
// Derives the unchanged profiler in a temporary file; never rewrites served source.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const output=resolve(process.env.ISSUE352_OUTPUT??'test-results/issue352');
const instrument=process.env.ISSUE352_INSTRUMENT==='1';
let source=await readFile(new URL('./profile-reaction-lab-stage-b.mjs',import.meta.url),'utf8');
function replaceOnce(text,old,next){assert.equal(text.split(old).length,2,`Expected exactly one boundary: ${old.slice(0,90)}`);return text.replace(old,next);}

function instrumentViewer(text){
  const replace=(old,next)=>{text=replaceOnce(text,old,next);};
  replace('function atomWorldAngstrom(item,index){', 'function atomWorldAngstrom(item,index){if(globalThis.__issue352?.active)globalThis.__issue352.atomWorldCalls++;');
  replace('const physical=canonicalNonbondedPairGeometry(', 'if(globalThis.__issue352?.active)globalThis.__issue352.pairCalls++;const physical=canonicalNonbondedPairGeometry(');
  replace('const fixedStepStarted=performance.now();', `const fixedStepStarted=performance.now();const diag=globalThis.__issue352,di=diag?.active?diag.index++:-1,off=di*8;if(di>=0)diag.sections[off]=fixedStepStarted;`);
  replace('const started=performance.now();\n    stageAForces=', 'const started=performance.now();if(di>=0)diag.sections[off+1]=started;\n    stageAForces=');
  replace('stageAPerformance.lastInteractionPairCount=', 'if(di>=0)diag.sections[off+2]=performance.now();stageAPerformance.lastInteractionPairCount=');
  replace('if(batch.phase===REACTION_LAB_BATCH_PHASES.ACTIVE){const stepMs=STAGE_A_GAME_STEP_SECONDS*1000;advancePolymerRuntime(stepMs);reactionStep(stepMs);}', `if(di>=0)diag.sections[off+3]=performance.now();if(batch.phase===REACTION_LAB_BATCH_PHASES.ACTIVE){const stepMs=STAGE_A_GAME_STEP_SECONDS*1000;advancePolymerRuntime(stepMs);if(di>=0)diag.sections[off+4]=performance.now();reactionStep(stepMs);}if(di>=0){diag.sections[off+5]=performance.now();diag.sections[off+6]=reactionDiagnostics.length;diag.sections[off+7]=(reactionAnimation?1:0)+(polymerRouteOwned?2:0)+(instances.some(item=>item.busy)?4:0);}`);
  return text;
}
if(instrument){
  // Fail before browser launch if an upstream source boundary is ambiguous.
  instrumentViewer(await readFile(join(resolve(process.env.POLYMER_ROOT??'.'),'src/reaction-lab-viewer.js'),'utf8'));
  // Embed function text only into temporary diagnostic server, not production assets.
  source=replaceOnce(source,"const root=",`const replaceOnce=${replaceOnce.toString()};const instrumentViewer=${instrumentViewer.toString()};\nconst root=`);
  source=replaceOnce(source,'response.end(await readFile(file));',`const bytes=await readFile(file);response.end(file.endsWith('/src/reaction-lab-viewer.js')?instrumentViewer(bytes.toString()):bytes);`);
}
source=replaceOnce(source,"evaluate('window.__reactionLabProbe.measureFixedSteps(180)')", "evaluate('(()=>{const entryState=window.__reactionLabProbe.snapshot();const result=window.__reactionLabProbe.measureFixedSteps(180);return{...result,entryState,exitState:window.__reactionLabProbe.snapshot()}})()')");
source=replaceOnce(source,'return{label,candidateCount:', 'return{entryState:result.entryState,exitState:result.exitState,label,candidateCount:');
source=replaceOnce(source,'const warmup=await measure',`const diagnosticRows=[];
  const originalMeasure=measure;
  const tracedMeasure=async label=>{
    const before=await snapshot();
    ${instrument?`await evaluate('globalThis.__issue352={active:true,index:0,sections:new Float64Array(180*8),atomWorldCalls:0,pairCalls:0}');`:''}
    const result=await originalMeasure(label);
    ${instrument?`const detail=await evaluate('(()=>{const d=globalThis.__issue352;d.active=false;return{index:d.index,sections:Array.from(d.sections),atomWorldCalls:d.atomWorldCalls,pairCalls:d.pairCalls}})()');`:'const detail=null;'}
    diagnosticRows.push({label,before,entryState:result.entryState,exitState:result.exitState,after:await snapshot(),detail});return result;
  };
  ${instrument?`await send('Profiler.enable');await send('Profiler.setSamplingInterval',{interval:1000});await send('Tracing.start',{categories:'toplevel,v8,disabled-by-default-v8.gc,disabled-by-default-v8.compile,devtools.timeline',options:'record-as-much-as-possible',transferMode:'ReturnAsStream'});await send('Profiler.start');`:''}
  const warmup=await tracedMeasure`);
source=replaceOnce(source,'trials.push(await measure(', 'trials.push(await tracedMeasure(');
const finish=instrument?`
  const cpu=await send('Profiler.stop');
  const complete=new Promise(resolve=>socket.addEventListener('message',function listener(event){const m=JSON.parse(event.data);if(m.method==='Tracing.tracingComplete'){socket.removeEventListener('message',listener);resolve(m.params);}}));
  await send('Tracing.end');const completed=await complete;let trace='';
  for(;;){const row=await send('IO.read',{handle:completed.stream});trace+=row.data;if(row.eof)break;}await send('IO.close',{handle:completed.stream});
  await writeFile(${JSON.stringify(join(output,'trace.json'))},trace);await writeFile(${JSON.stringify(join(output,'cpu.json'))},JSON.stringify(cpu));` : '';
source=replaceOnce(source,'await mkdir(dirname(output),{recursive:true});',`${finish}\n await writeFile(${JSON.stringify(join(output,'sections-state.json'))},JSON.stringify(diagnosticRows));await mkdir(dirname(output),{recursive:true});`);
await mkdir(output,{recursive:true});const temp=await mkdtemp(join(tmpdir(),'issue352-'));
try{
  const file=join(temp,'profile.mjs');await writeFile(file,source);
  const result=spawnSync(process.execPath,[file],{env:{...process.env,POLYMER_ROOT:resolve(process.env.POLYMER_ROOT??'.'),STAGE_B_PROFILE_OUTPUT:join(output,'profile.json')},stdio:'inherit',timeout:300000});
  assert.equal(result.status,0,`Diagnostic profile failed: ${result.error??result.status}`);
}finally{await rm(temp,{recursive:true,force:true});}
