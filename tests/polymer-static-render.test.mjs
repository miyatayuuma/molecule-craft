import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
const start=source.indexOf('  function tick('),brace=source.indexOf('{',start);let end=brace+1,depth=1;
while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}
const tickSource=source.slice(start,end);
function harness(){const calls={raf:0,render:0,physics:0,presentation:0},scope={disposed:false,last:0,document:{hidden:false},contextLost:false,dialog:{open:true},pickerOpen:false,animationFrameId:0,devicePixelRatio:1,renderer:{getPixelRatio:()=>1,render:()=>calls.render++},scheduleResize(){throw Error('Unexpected resize');},requestAnimationFrame:()=>++calls.raf,scene:{},camera:{},updateManipulation(){},advanceBatchTransition(){},advanceReactionAnimation(){},advancePolymerPresentation(){calls.presentation++;},chamberTime:{scale:1},scaleSimulationElapsed:x=>x,STAGE_A_GAME_STEP_SECONDS:1/120,STAGE_A_MAX_CATCH_UP_STEPS:6,stageAStepper:{advance(){calls.physics++;return{steps:1,droppedGameSeconds:0};}},simulationClockSeconds:0,stageAPerformance:{},polymerSamplePresentation:{ready:true},polymerGraphVisual:{animation:null},finiteReferenceView:null,growthCameraMotion:null,advanceGrowthCamera(){},polymerReferenceDefinition:()=>({network:true}),batchTransition:null,reactionAnimation:null,instances:[],observation:{comparisonActive:false},polymerVisualRevision:1,lastRenderedPolymerRevision:-1,polymerRuntimeMetrics:{renderSubmissions:0,staticFrameSkips:0}};
  const api=runInNewContext(`${tickSource};({tick,revision:value=>polymerVisualRevision=value,read:()=>({lastRenderedPolymerRevision,simulationClockSeconds})})`,scope);return{scope,calls,...api};}
test('static GPU reuse keeps every RAF, fixed-step and completion update; a changed pose renders immediately',()=>{
  const h=harness();for(let i=1;i<=5;i++)h.tick(i*16.7);assert.deepEqual(h.calls,{raf:5,render:1,physics:5,presentation:5});assert.equal(h.scope.polymerRuntimeMetrics.staticFrameSkips,4);h.revision(2);h.tick(100);assert.equal(h.calls.render,2);assert.equal(h.calls.raf,6);assert.ok(h.read().simulationClockSeconds>0);
});
test('animation, real molecules and comparison views render every live frame',()=>{
  for(const state of ['animation','molecules','comparison']){const h=harness();if(state==='animation')h.scope.polymerGraphVisual.animation={};if(state==='molecules')h.scope.instances=[{id:'real-monomer'}];if(state==='comparison')h.scope.observation.comparisonActive=true;for(let i=0;i<4;i++)h.tick(i*16.7);assert.equal(h.calls.render,4,state);assert.equal(h.calls.raf,4);assert.equal(h.calls.physics,4);}
});
test('hidden, closed and lost contexts cannot submit GPU work; disposing ends RAF ownership',()=>{
  for(const state of ['hidden','closed','contextLost']){const h=harness();if(state==='hidden')h.scope.document.hidden=true;if(state==='closed')h.scope.dialog.open=false;if(state==='contextLost')h.scope.contextLost=true;h.tick(16.7);assert.equal(h.calls.render,0,state);assert.equal(h.calls.raf,1);assert.equal(h.calls.physics,0);}
  const h=harness();h.scope.disposed=true;h.tick(16.7);assert.equal(h.calls.raf,0);assert.equal(h.calls.render,0);
});
test('network reference with hidden actual feeds reuses GPU work; visible feeds keep rendering',()=>{
  const h=harness();h.scope.finiteReferenceView={};h.scope.instances=[{group:{visible:false}}];
  for(let i=1;i<=4;i++)h.tick(i*16.7);
  assert.equal(h.calls.render,1);assert.equal(h.calls.physics,4);assert.equal(h.calls.raf,4);
  h.scope.instances[0].group.visible=true;h.tick(100);assert.equal(h.calls.render,2);
});
