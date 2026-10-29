import assert from 'node:assert/strict';

// Invoked only after the ordinary FEED / pointer path has completed a real sample.
export async function exercisePolymerReference({evaluate,send,pause,snapshot,route,viewport,openLab,capture}){
  const actual=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().graph'),before=await snapshot(),rows=[];
  let renderReadyMs=0;
  const choose=async(selector,value)=>{
    const started=Date.now();
    const ms=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Reference UI unavailable');e.value=${JSON.stringify(value)};const t=performance.now();e.dispatchEvent(new Event('change',{bubbles:true}));return performance.now()-t;})()`);
    let loading=true;for(let i=0;i<300;i++){loading=await evaluate("document.querySelector('[data-polymer-reference-display]').dataset.loading==='true'");if(!loading)break;await pause(20);}assert.equal(loading,false,'reference asynchronous load settles');
    // GPU counters describe rendered resources, not the synchronous JS graph.
    // Wait for the production RAF submission before comparing live plateaus.
    await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');renderReadyMs=Date.now()-started;return ms;
  };
  const display='[data-polymer-reference-display]',units='[data-polymer-reference-units]';
  const initialDispatchMs=await choose(display,'reference'),initialRenderReadyMs=renderReadyMs;
  for(const n of [10,30,100]){
    const switchMs=await choose(units,String(n)),v=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()');
    assert.ok(v.graph.presentationOnly);assert.equal(v.atoms.length,v.graph.atoms.length);assert.ok(v.atoms.every(a=>a.visible));
    assert.equal(new Set(v.lanes.map(l=>l.bondIndex)).size,v.graph.bonds.length,'all reference bonds have rendered lanes');
    assert.ok((await evaluate('window.__reactionLabProbe.polymerDisplayBounds()')).insideSafeRegion,`${route.polymerId} ${n} reference fit`);
    const initial=await snapshot(),rect=await evaluate("(()=>{const r=document.querySelector('#reaction-lab canvas').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()");
    await send('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',buttons:1,clickCount:1});
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+40,y:rect.y+18,button:'left',buttons:1});
    await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+40,y:rect.y+18,button:'left',buttons:0});
    await pause(50);const orbited=await snapshot();
    if(JSON.stringify(orbited.polymerView.rotation)===JSON.stringify(initial.polymerView.rotation)){
      if(capture)await capture(`reference-orbit-failure-${route.polymerId}-${n}`);
      const hit=await evaluate(`document.elementFromPoint(${rect.x},${rect.y})?.outerHTML?.slice(0,1000)`);
      assert.fail(`reference pointer orbit ${JSON.stringify({route:route.routeId,n,rect,hit,initial:initial.polymerView,after:orbited.polymerView,pointerActive:orbited.pointerActive})}`);
    }
    await send('Input.dispatchMouseEvent',{type:'mouseWheel',...rect,deltaY:-70,deltaX:0});await pause(50);
    assert.ok((await snapshot()).polymerView.zoomFactor>1,'reference zoom');
    await evaluate("document.querySelector('[data-polymer-view-reset]').click()");await pause(60);assert.equal((await snapshot()).polymerView.zoomFactor,1);
    if(n===100&&viewport.mobile){
      await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:31,x:rect.x-20,y:rect.y},{id:32,x:rect.x+20,y:rect.y}]});
      await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:31,x:rect.x-38,y:rect.y},{id:32,x:rect.x+38,y:rect.y}]});
      await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok((await snapshot()).polymerView.zoomFactor>1,'reference pinch');
      await evaluate("document.querySelector('[data-polymer-view-reset]').click()");
    }
    let frameIntervalsMs=[];
    if(n===100){
      await evaluate('window.__referenceFrames=[];window.__referenceMeasuring=true;requestAnimationFrame(function frame(t){window.__referenceFrames.push(t);if(window.__referenceMeasuring)requestAnimationFrame(frame);});');
      await send('Input.dispatchMouseEvent',{type:'mousePressed',...rect,button:'left',buttons:1,clickCount:1});
      for(let i=0;i<24;i++){await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+Math.sin(i*.3)*45,y:rect.y+Math.cos(i*.3)*20,button:'left',buttons:1});await pause(16);}
      await send('Input.dispatchMouseEvent',{type:'mouseReleased',...rect,button:'left',buttons:0});
      frameIntervalsMs=await evaluate('window.__referenceMeasuring=false;window.__referenceFrames.slice(1).map((t,i)=>t-window.__referenceFrames[i])');
      assert.ok(frameIntervalsMs.length>0,'real RAF samples during pointer orbit');
      await evaluate("document.querySelector('[data-polymer-view-reset]').click()");await pause(60);
    }
    rows.push({n,switchMs,renderReadyMs,atoms:v.graph.atoms.length,bonds:v.graph.bonds.length,gpuResources:v.gpuResources,frameIntervalsMs});
    if(n===100&&['polyisobutylene','phenol-formaldehyde-resin','nylon-6-6','polystyrene','polytetrafluoroethylene'].includes(route.polymerId))await capture(`reference-${route.polymerId}`);
  }
  if(route.polymerId==='polyethylene'){
    const referenceGraph=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().graph');
    for(const deviceScaleFactor of [2,1]){
      await send('Emulation.setDeviceMetricsOverride',{width:viewport.width-20,height:viewport.height-30,deviceScaleFactor,mobile:viewport.mobile});await pause(150);
      await evaluate("document.querySelector('[data-polymer-view-reset]').click()");await pause(60);
      assert.ok((await evaluate('window.__reactionLabProbe.polymerDisplayBounds()')).insideSafeRegion,'reference resize/DPR fit');
    }
    await send('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1});await pause(150);
    const available=await evaluate("(()=>{const gl=document.querySelector('#reaction-lab canvas').getContext('webgl2');window.__referenceContextLoss=gl.getExtension('WEBGL_lose_context');if(!window.__referenceContextLoss)return false;window.__referenceContextLoss.loseContext();return true;})()");
    assert.ok(available,'context-loss extension available for formal lifecycle check');await pause(150);
    assert.equal((await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()')).contextLost,true);
    await evaluate('window.__referenceContextLoss.restoreContext()');
    let restored=false;for(let i=0;i<60;i++){await pause(50);if(!(await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()')).contextLost){restored=true;break;}}
    assert.ok(restored,'context restores');assert.deepEqual(await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().graph'),referenceGraph,'context preserves reference graph');
    await evaluate("document.querySelector('[data-polymer-view-reset]').click()");await pause(100);
  }
  const referenceMemory=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().gpuResources');
  // Repeated 100/10 swaps must return to the same live GPU resource plateau.
  for(let i=0;i<3;i++){await choose(units,'10');await choose(units,'100');}
  const repeatedMemory=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().gpuResources');
  for(const key of ['geometries','textures'])assert.equal(repeatedMemory[key],referenceMemory[key],`reference repeated ${key}`);
  await choose(display,'actual');assert.deepEqual(await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().graph'),actual,'reference never mutates actual graph or origin');
  const after=await snapshot();assert.equal(after.polymerization.sampleId,before.polymerization.sampleId);assert.deepEqual(after.polymerization.sampleEvidence,before.polymerization.sampleEvidence);
  await choose(display,'reference');await evaluate("document.querySelector('[data-lab-close]').click()");await pause(150);await openLab();
  let reopened=null;for(let i=0;i<60;i++){reopened=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()');if(reopened)break;await pause(50);}
  assert.ok(reopened,`reference reopen failed: ${JSON.stringify(await snapshot())}`);
  assert.deepEqual(await evaluate('window.__reactionLabProbe.polymerVisualSnapshot().graph'),actual,'close/reopen restores actual ownership');
  return{routeId:route.routeId,viewport,initialDispatchMs,initialRenderReadyMs,rows,referenceMemory,repeatedMemory,graphUnchanged:true};
}
