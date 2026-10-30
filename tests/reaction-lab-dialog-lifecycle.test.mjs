import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const source=await readFile(new URL('../src/reaction-lab-viewer.js',import.meta.url),'utf8');
function body(name){const start=source.indexOf(`  function ${name}(`),brace=source.indexOf('{',start);assert.ok(start>=0);let end=brace+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(start,end);}
function harness(){const events=[],scope={dialogOpenState:true,dialog:{open:false,showModal(){this.open=true;}},renderSlotTiles(){},restorePolymerVisual(){events.push('restore');},suspendPolymerVisual(){events.push('suspend');},polymerVisualRevision:0,setDialogOpen(v){events.push(v?'open':'closed');},last:0,performance:{now:()=>1},resize(){},observation:{resume(){}},clearGuide(){},closePicker(){},cancelMediumDrag(){},updateEnvironmentControls(){},cancelAllPointers(){},finiteReferenceView:true,polymerSamplePresentation:{ready:true},closeWaiters:new Set([()=>events.push('waiter')])};
 const api=runInNewContext(`${body('open')};${body('handleDialogClose')};({open,close:handleDialogClose})`,scope);return{api,scope,events};}
test('rapid close/reopen finalizes the old ownership before restoring; delayed native event is inert',()=>{
 const h=harness();h.api.open();assert.deepEqual(h.events,['suspend','closed','waiter','restore','open']);h.api.close();assert.deepEqual(h.events,['suspend','closed','waiter','restore','open']);assert.equal(h.scope.dialogOpenState,true);
});
test('native close finalizes once and resolves waiters exactly once',()=>{
 const h=harness();h.api.close();h.api.close();assert.deepEqual(h.events,['suspend','closed','waiter']);assert.equal(h.scope.dialogOpenState,false);assert.equal(h.scope.closeWaiters.size,0);
});
