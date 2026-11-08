import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
function body(name){const start=source.indexOf(`  function ${name}(`),brace=source.indexOf('{',start);assert.ok(start>=0);let end=brace+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
function harness(){const events=[],scope={dialogOpenState:true,preserveOnClose:true,dialog:{open:false,showModal(){this.open=true;}},renderSlotTiles(){},restorePolymerVisual(){events.push('restore');},suspendPolymerVisual(){events.push('suspend');},polymerVisualRevision:0,setDialogOpen(v){events.push(v?'open':'closed');},last:0,performance:{now:()=>1},resize(){},observation:{resume(){}},clearGuide(){},closePicker(){},cancelMediumDrag(){},updateEnvironmentControls(){},cancelAllPointers(){},resetLabPad(){},finiteReferenceView:true,polymerSamplePresentation:{ready:true},closeWaiters:new Set([()=>events.push('waiter')])};
 const api=runInNewContext(`${body('open')};${body('handleDialogClose')};({open,close:handleDialogClose})`,scope);return{api,scope,events};}
test('rapid close/reopen finalizes the old ownership before restoring; delayed native event is inert',()=>{
 const h=harness();h.api.open();assert.deepEqual(h.events,['suspend','closed','waiter','restore','open']);h.api.close();assert.deepEqual(h.events,['suspend','closed','waiter','restore','open']);assert.equal(h.scope.dialogOpenState,true);
});
test('native close finalizes once and resolves waiters exactly once',()=>{
 const h=harness();h.api.close();h.api.close();assert.deepEqual(h.events,['suspend','closed','waiter']);assert.equal(h.scope.dialogOpenState,false);assert.equal(h.scope.closeWaiters.size,0);
});
test('reopening a preserved polymer after the award restores its 100-unit growth view',()=>{
 const h=harness();h.scope.dialogOpenState=false;h.scope.finiteReferenceView=null;
 h.scope.polymerSamplePresentation={ready:true,sampleId:'sample-1',batchGeneration:4};
 h.scope.presentedPolymerSampleIds=new Set(['4:sample-1']);
 h.scope.referenceUnits={value:'10'};h.scope.referenceDisplay={value:'actual'};
 h.scope.showPolymerReference=()=>{h.events.push('reference');};
 h.api.open();
 assert.equal(h.scope.referenceUnits.value,'100');assert.equal(h.scope.referenceDisplay.value,'reference');
 assert.deepEqual(h.events,['restore','open','reference']);
});
test('temporary suspension remembers reference growth progress before releasing the model',()=>{
 const presentation={},atomMeshesByOrigin=new Map([['a',{}]]),finiteVisual={group:{position:{clone:()=>({})},quaternion:{clone:()=>({})},scale:{clone:()=>({})}},atomMeshesByOrigin,atomByGraphIndex:new Map(),bondMeshes:[{}]};
 const scope={finiteReferenceView:{presentation},referenceDisplay:{value:'reference'},polymerGraphVisual:{growthUnits:28},restoreFiniteReferenceView(){scope.polymerGraphVisual=finiteVisual;},observation:{suspend(){}},disposePolymerResources(){},THREE:{Group:class {}}};
 // The production helper releases its GPU owners but preserves the resume point.
 const suspend=runInNewContext(`${body('suspendPolymerVisual')};suspendPolymerVisual`,scope);
 assert.equal(suspend(),true);assert.equal(presentation.resumeReferenceUnits,28);
 assert.equal(finiteVisual.suspended,true);
});
