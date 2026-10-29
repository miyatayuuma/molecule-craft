import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {auditPolymerTask5Dom} from './polymer-task5-dom.mjs';

// V04R-6: exactly one completed route per viewport. No raster campaign, resource loop, or performance comparison.
export async function runLimitedPolymerAcceptance({evaluate,send,pause,snapshot,waitFor,capture,artifactDir,kind,route,browserErrors}){
  const result={sourceSha:process.env.POLYMER_SOURCE_SHA,kind,routeId:route.routeId,checks:[]};
  const stable=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
  const rendered=async label=>{
    await stable();const v=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()'),s=await snapshot(),bounds=await evaluate('window.__reactionLabProbe.polymerDisplayBounds()');
    assert.ok(v?.graph&&v.atoms.length>0,label+': actual visible graph');assert.equal(v.atoms.length,v.graph.atoms.length);assert.ok(v.atoms.every(a=>a.visible));
    assert.equal(new Set(v.lanes.map(l=>l.bondIndex)).size,v.graph.bonds.length,label+': every bond rendered');
    assert.ok(v.gpuResources.renderCalls>0,label+': submitted draw');assert.equal(v.fitError,null);assert.ok(bounds.safeRegion&&bounds.insideSafeRegion&&bounds.depthVisible,label+': protected safe fit');
    result.checks.push({label,bounds,fit:v.activeFit,atomCount:v.atoms.length,bondCount:v.graph.bonds.length,view:s.polymerView});return v;
  };
  const touch=async(type,points)=>send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  const tap=async selector=>{
    const p=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);return{x,y,hit:!!h&&(h===e||e.contains(h)),disabled:e.disabled}})()`);
    assert.ok(p.hit&&!p.disabled,selector+': real hit target');await touch('touchStart',[{id:71,x:p.x,y:p.y}]);await touch('touchEnd',[]);await stable();return p;
  };
  const orbit=async label=>{
    const v=await evaluate('window.__reactionLabProbe.polymerVisualSnapshot()'),b=await evaluate('window.__reactionLabProbe.polymerDisplayBounds()'),S=b.safeRegion,c=v.canvas;
    // Ordinary byproducts retain their own drag hit area. Choose unobstructed canvas for Sample orbit.
    const state=await snapshot(),live=new Set(state.instances.filter(i=>!i.busy).map(i=>i.id)),world=await evaluate('window.__reactionLabProbe.projectedBounds()'),atoms=world.filter(i=>live.has(i.id)).flatMap(i=>i.atoms);
    const candidates=[];for(const x of [.15,.5,.85])for(const y of [.15,.5,.85]){const p={x:c.left+S.left+S.width*x,y:c.top+S.top+S.height*y};if(await evaluate(`document.elementFromPoint(${p.x},${p.y})===document.querySelector('#reaction-lab canvas')`))candidates.push({...p,clearance:Math.min(Infinity,...atoms.map(a=>Math.hypot(a.x-p.x,a.y-p.y)-a.radius))});}
    const p=candidates.sort((a,b)=>b.clearance-a.clearance)[0];assert.ok(p&&p.clearance>35,label+': canvas clear of byproduct grab areas');const before=state.polymerView.rotation;
    await touch('touchStart',[{id:73,x:p.x,y:p.y}]);await pause(20);const held=await snapshot();result.checks.push({label:label+' pointer ownership',point:p,held:held.polymerView,draggedInstanceId:held.draggedInstanceId});assert.equal(held.polymerView.orbitPointerIds.length,1,label+': Sample owns touch');await touch('touchMove',[{id:73,x:p.x+35,y:p.y+18}]);await touch('touchEnd',[]);await pause(80);
    assert.notDeepEqual((await snapshot()).polymerView.rotation,before,label+': touch rotation');await tap('[data-polymer-view-reset]');
    const reset=await snapshot();assert.equal(reset.polymerView.zoomFactor,1);return p;
  };
  const initial=await rendered('initial actual'),identity=(await snapshot()).polymerization.sampleId;
  await capture('limited-actual-initial');
  if(kind==='360'){
    result.closedMenuDom=await auditPolymerTask5Dom(evaluate);
    result.menuTap=await tap('[data-observation-menu]');await waitFor("!document.querySelector('[data-observation-panel]').hidden",'Real observation tap opens menu');
    result.openMenuDom=await auditPolymerTask5Dom(evaluate);await capture('limited-observation-menu');
    await tap('[data-observation-close]');await waitFor("document.querySelector('[data-observation-panel]').hidden",'Real close tap closes menu');
    const p=await orbit('360');
    await touch('touchStart',[{id:81,x:p.x-18,y:p.y},{id:82,x:p.x+18,y:p.y}]);await touch('touchMove',[{id:81,x:p.x-32,y:p.y},{id:82,x:p.x+32,y:p.y}]);await touch('touchEnd',[]);await pause(50);assert.ok((await snapshot()).polymerView.zoomFactor>1,'pinch zoom');
    await tap('[data-polymer-view-reset]');assert.equal((await snapshot()).polymerView.zoomFactor,1);
    for(const width of [390,360]){await send('Emulation.setDeviceMetricsOverride',{width,height:780,deviceScaleFactor:1,mobile:true});await pause(180);await rendered('resize '+width);await orbit('resize '+width);}
    await rendered('final 360');await capture('limited-actual-final');
  }else{
    const choose=async value=>{await evaluate(`(()=>{const e=document.querySelector('[data-polymer-reference-display]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await waitFor("document.querySelector('[data-polymer-reference-display]').dataset.loading!=='true'",'Reference switch settles');await stable();};
    await choose('reference');await rendered('reference');await capture('limited-reference');await orbit('reference');
    await choose('actual');const returned=await rendered('returned actual');assert.deepEqual(returned.graph,initial.graph,'actual atom/bond/origin identity survives reference switch');await orbit('returned actual');await capture('limited-returned-actual');
  }
  assert.equal((await snapshot()).polymerization.sampleId,identity);assert.deepEqual(browserErrors,[]);
  result.status='PASS';await writeFile(join(artifactDir,'limited-result.json'),JSON.stringify(result,null,2));
}
