import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {presentFirstRegistration,REGISTRATION_REVEAL_HOLD_MS} from '../src/collection-registration-reveal.js';

class FakeNode{
  constructor(text=''){this.textContent=text;this.style={};this.dataset={};this.attrs=new Map();this.children=[];this.listeners=new Map();this.removed=false;this.className='';}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}
  removeAttribute(k){this.attrs.delete(k);}
  querySelectorAll(){return[];}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
  emit(type){this.listeners.get(type)?.({target:{closest:()=>null},preventDefault(){},stopImmediatePropagation(){},key:'Enter'});}
  append(...nodes){this.children.push(...nodes);this.textContent+=nodes.map(node=>node.textContent??'').join('');}
  prepend(node){this.children.unshift(node);this.textContent=node.textContent+this.textContent;}
  replaceChildren(...nodes){this.children=[...nodes];this.textContent=nodes.map(node=>node.textContent??'').join('');}
  remove(){this.removed=true;}
  animate(frames,options){this.animations??=[];this.animations.push({frames,options});return{cancel(){}};}
}
function fixture({reduced=false,open=true}={}){
  const dialog=new FakeNode(),detail=new FakeNode(),headingBox=new FakeNode(),name=new FakeNode('水素'),formula=new FakeNode('H₂'),description=new FakeNode('説明'),extras=new FakeNode(),number=new FakeNode('No. 001'),host=new FakeNode('模型を準備しています…'),stage=new FakeNode(),canvas=new FakeNode();dialog.open=true;
  let canvasReady=false,observerCallback=null;let observerDisconnected=false;
  detail.querySelector=selector=>selector.includes('[data-registration-visual]')||selector==='.collection-model'?host:({'.detail-heading > div':headingBox,'.detail-heading h3':name,'.detail-heading .detail-formula':formula,'.detail-heading .dex-number':number}[selector]??null);
  detail.querySelectorAll=()=>[name,formula,description,extras];
  host.querySelector=selector=>selector==='.model-canvas'?(canvasReady?canvas:null):selector==='.model-stage'?stage:null;
  const root={querySelector:selector=>selector==='#collection-dialog'?dialog:selector==='#collection-detail'?detail:null,createElement:()=>new FakeNode(),createTextNode:text=>new FakeNode(String(text))};
  const win={matchMedia:()=>({matches:reduced})};
  const timers=[];const setTimer=(fn,delay)=>{const token={fn,delay,cancelled:false};timers.push(token);return token;};const clearTimer=token=>{token.cancelled=true;};
  const run=delay=>{const batch=timers.filter(t=>!t.cancelled&&!t.ran&&t.delay===delay);for(const t of batch){t.ran=true;t.fn();}};
  const openedEntries=[],collection={openEntry(kind,id){openedEntries.push({kind,id});return open;},openMolecule(){return open;}};
  const observerFactory=callback=>{observerCallback=callback;return{observe(){},disconnect(){observerDisconnected=true;}};};
  const present=(options={})=>presentFirstRegistration({collection,id:'hydrogen',root,win,observerFactory,setTimer,clearTimer,...options});
  return{dialog,detail,headingBox,number,name,formula,description,extras,host,stage,canvas,collection,openedEntries,present,ready(){canvasReady=true;host.textContent='';observerCallback?.();},fail(){host.textContent='立体模型を表示できませんでした。図鑑の説明は引き続き利用できます。';observerCallback?.();},run,tap(){dialog.emit('click');},animations:()=>[...(host.animations??[]),...(stage.animations??[]),...stage.children.flatMap(n=>n.animations??[])],get marker(){return headingBox.children[0];},get observerDisconnected(){return observerDisconnected;}};
}

test('waits for viewer readiness before silhouette reveal and announces once',()=>{
  const f=fixture();assert.equal(f.present(),true);assert.equal(f.name.style.opacity,'0');assert.equal(f.host.style.filter,'grayscale(1) brightness(.2) contrast(1.35)');
  f.run(300);assert.equal(f.name.style.opacity,'0','no phase timer exists before viewer readiness');
  assert.equal(f.number.style.visibility,'hidden');assert.ok(f.marker.className.includes('registration-marker'));assert.doesNotMatch(f.marker.textContent,/No\./);
  f.ready();assert.equal(f.name.style.opacity,'0');f.run(650);assert.ok(f.stage.children.some(n=>n.dataset.registrationScan==='true'));
  f.run(750);assert.equal(f.name.style.opacity,'1');const live=f.detail.children.find(n=>n.attrs.get('role')==='status');assert.equal(live.textContent,'図鑑に H₂ 水素を登録しました');
  f.run(1900);assert.equal(f.host.style.pointerEvents,'');assert.ok(REGISTRATION_REVEAL_HOLD_MS>=2000);
});

test('software viewer uses the same canvas-stage reveal contract',()=>{
  const f=fixture();f.host.dataset.renderMode='software-3d';f.present();f.ready();f.run(650);assert.ok(f.host.animations?.some(a=>a.frames.some(frame=>String(frame.filter).includes('grayscale'))));
});

test('kind-neutral registration opens polymer entries and omits molecular formula',()=>{
  const f=fixture();assert.equal(f.present({kind:'polymers',id:'polyethylene'}),true);assert.deepEqual(f.openedEntries,[{kind:'polymers',id:'polyethylene'}]);
  f.ready();f.run(650);f.run(750);assert.equal(f.detail.children.find(node=>node.attrs.get('role')==='status').textContent,'図鑑に 水素を登録しました');assert.match(f.marker.textContent,/高分子/);
});

test('viewer failure settles identity without rolling registration back',()=>{
  const f=fixture();f.present();f.fail();assert.equal(f.name.style.opacity,'1');assert.match(f.marker.textContent,/図鑑/);assert.equal(f.collection.openMolecule(),true);
});

test('reduced motion omits moving scan and pulse while preserving state change',()=>{
  const f=fixture({reduced:true});f.present();f.ready();f.run(70);f.run(200);assert.equal(f.name.style.opacity,'1');assert.equal(f.stage.children.some(n=>n.dataset.registrationScan==='true'),false);assert.equal((f.stage.animations??[]).length,0);
  const transforms=f.animations().flatMap(a=>a.frames).filter(frame=>'transform'in frame);assert.equal(transforms.length,0,'reduced-motion animations are opacity-only');
});

test('closing mid-reveal cleans timers, observer and presentation state without reopening',()=>{
  const f=fixture();f.present();f.dialog.emit('close');assert.equal(f.observerDisconnected,true);assert.equal(f.name.style.opacity,'');assert.equal(f.host.style.filter,'');assert.equal(f.number.style.visibility,'');assert.ok(f.marker.removed);
});

test('failed auto-open leaves the canonical discovery queued for a later retry',()=>{const f=fixture({open:false});assert.equal(f.present(),false);});

test('tap acknowledges a complete reveal without removing the badge from the open detail',()=>{
  const f=fixture(),settled=[];f.present({onSettled:result=>settled.push(result)});f.ready();f.run(650);f.run(750);f.run(1900);assert.deepEqual(settled,[]);
  f.run(1100);f.tap();assert.deepEqual(settled,[{status:'presented'}]);assert.equal(f.marker.removed,false);assert.equal(f.number.style.visibility,'hidden');
  f.tap();assert.equal(settled.length,1,'repeated taps cannot re-award a discovery');
  f.dialog.emit('close');assert.equal(f.marker.removed,true);assert.equal(f.number.style.visibility,'');
});

test('reduced-motion and viewer-failure paths settle the same shared reveal callback',()=>{
  const reduced=fixture({reduced:true}),reducedSettled=[];reduced.present({onSettled:result=>reducedSettled.push(result)});reduced.ready();reduced.run(70);reduced.run(200);reduced.run(90);reduced.tap();assert.deepEqual(reducedSettled,[{status:'presented'}]);
  const failed=fixture(),failedSettled=[];failed.present({onSettled:result=>failedSettled.push(result)});failed.fail();failed.run(600);failed.tap();assert.deepEqual(failedSettled,[{status:'presented'}]);
});

test('close and open failures report presentation outcomes without changing registration',()=>{
  const dismissed=fixture(),dismissedSettled=[];dismissed.present({onSettled:result=>dismissedSettled.push(result)});dismissed.dialog.emit('close');assert.deepEqual(dismissedSettled,[{status:'dismissed'}]);
  const unavailable=fixture({open:false}),unavailableSettled=[];assert.equal(unavailable.present({onSettled:result=>unavailableSettled.push(result)}),false);assert.deepEqual(unavailableSettled,[{status:'failed',reason:'collection-unavailable'}]);
});

test('new-registration badge reserves a stable identity slot and uses ruby-aligned wrapping rather than flex',async()=>{
  const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
  const marker=css.slice(css.indexOf('#collection-dialog .collection-registration-marker{'),css.indexOf('#collection-dialog .collection-registration-marker ruby{'));
  assert.match(css,/#collection-dialog \.detail-heading \.dex-number\{display:block;min-height:40px/);
  assert.match(marker,/display:inline-block/);
  assert.match(marker,/max-width:100%/);
  assert.match(marker,/white-space:normal;overflow-wrap:anywhere/);
  assert.doesNotMatch(marker,/display:inline-flex|white-space:nowrap/);
  assert.match(css,/\.detail-model-frame>\.detail-heading\{[^\n]*max-height:60%;[^\n]*overflow:visible/);
});

const craft=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
assert.match(craft,/const isNew=!!event\.gameEvent\?\.isNew&&event\.gameEvent\?\.saved!==false,recordId=/);
assert.match(craft,/if\(isNew&&recordId\)[\s\S]*presentRegistration\(\{collection,id:recordId\}\)/);
assert.match(craft,/if\(discovery\?\.learned\)[\s\S]*collection\.refreshProgress\(\)/);
assert.doesNotMatch(craft,/discovery\?\.learned[^\n]*presentRegistration/,'resources learned is not the reveal trigger');
assert.match(craft,/queue\.shift\(\);active=item\.signature;until=now\+1300;onPresent\(\{item,isNew\}\)/,'repeat CRAFT keeps the existing completion presentation');
