import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {presentFirstRegistration,REGISTRATION_REVEAL_HOLD_MS} from '../src/collection-registration-reveal.js';

class FakeNode{
  constructor(text=''){this.textContent=text;this.style={};this.dataset={};this.attrs=new Map();this.children=[];this.listeners=new Map();this.removed=false;this.className='';}
  setAttribute(k,v){this.attrs.set(k,String(v));}
  getAttribute(k){return this.attrs.has(k)?this.attrs.get(k):null;}
  removeAttribute(k){this.attrs.delete(k);}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
  emit(type){this.listeners.get(type)?.();}
  append(node){this.children.push(node);}
  prepend(node){this.children.unshift(node);}
  after(node){this.afterNode=node;}
  remove(){this.removed=true;}
  animate(frames,options){this.animations??=[];this.animations.push({frames,options});return{cancel(){}};}
}
function fixture({reduced=false,open=true}={}){
  const dialog=new FakeNode(),detail=new FakeNode(),nav=new FakeNode(),name=new FakeNode('水素'),formula=new FakeNode('H₂'),description=new FakeNode('説明'),extras=new FakeNode(),number=new FakeNode('No. 001'),host=new FakeNode('模型を準備しています…'),stage=new FakeNode(),canvas=new FakeNode();dialog.open=true;
  let canvasReady=false,observerCallback=null;let observerDisconnected=false;
  detail.querySelector=selector=>({'.collection-model':host,'.detail-heading h3':name,'.detail-heading .detail-formula':formula,'.detail-heading .dex-number':number,'.detail-navigation':nav}[selector]??null);
  detail.querySelectorAll=()=>[name,formula,description,extras];
  host.querySelector=selector=>selector==='.model-canvas'?(canvasReady?canvas:null):selector==='.model-stage'?stage:null;
  const root={querySelector:selector=>selector==='#collection-dialog'?dialog:selector==='#collection-detail'?detail:null,createElement:()=>new FakeNode()};
  const win={matchMedia:()=>({matches:reduced})};
  const timers=[];const setTimer=(fn,delay)=>{const token={fn,delay,cancelled:false};timers.push(token);return token;};const clearTimer=token=>{token.cancelled=true;};
  const run=delay=>{const batch=timers.filter(t=>!t.cancelled&&!t.ran&&t.delay===delay);for(const t of batch){t.ran=true;t.fn();}};
  const collection={openMolecule(){return open;}};
  const observerFactory=callback=>{observerCallback=callback;return{observe(){},disconnect(){observerDisconnected=true;}};};
  const present=()=>presentFirstRegistration({collection,id:'hydrogen',root,win,observerFactory,setTimer,clearTimer});
  return{dialog,detail,nav,name,formula,description,extras,host,stage,canvas,collection,present,ready(){canvasReady=true;host.textContent='';observerCallback?.();},fail(){host.textContent='立体模型を表示できませんでした。図鑑の説明は引き続き利用できます。';observerCallback?.();},run,animations:()=>[...(host.animations??[]),...(stage.animations??[]),...stage.children.flatMap(n=>n.animations??[])],get observerDisconnected(){return observerDisconnected;}};
}

test('waits for viewer readiness before silhouette reveal and announces once',()=>{
  const f=fixture();assert.equal(f.present(),true);assert.equal(f.name.style.opacity,'0');assert.equal(f.host.style.filter,'grayscale(1) brightness(.2) contrast(1.35)');
  f.run(300);assert.equal(f.name.style.opacity,'0','no phase timer exists before viewer readiness');
  f.ready();assert.equal(f.name.style.opacity,'0');f.run(300);assert.ok(f.stage.children.some(n=>n.dataset.registrationScan==='true'));
  f.run(320);assert.equal(f.name.style.opacity,'1');const live=f.detail.children.find(n=>n.attrs.get('role')==='status');assert.equal(live.textContent,'図鑑に H₂ 水素を登録しました');
  f.run(620);assert.equal(f.host.style.pointerEvents,'');assert.ok(REGISTRATION_REVEAL_HOLD_MS>=2000);
});

test('software viewer uses the same canvas-stage reveal contract',()=>{
  const f=fixture();f.host.dataset.renderMode='software-3d';f.present();f.ready();f.run(300);assert.ok(f.host.animations?.some(a=>a.frames.some(frame=>String(frame.filter).includes('grayscale'))));
});

test('viewer failure settles identity without rolling registration back',()=>{
  const f=fixture();f.present();f.fail();assert.equal(f.name.style.opacity,'1');assert.match(f.nav.afterNode.textContent,/REGISTERED/);assert.equal(f.collection.openMolecule(),true);
});

test('reduced motion omits moving scan and pulse while preserving state change',()=>{
  const f=fixture({reduced:true});f.present();f.ready();f.run(70);assert.equal(f.name.style.opacity,'1');assert.equal(f.stage.children.some(n=>n.dataset.registrationScan==='true'),false);assert.equal((f.stage.animations??[]).length,0);
  const transforms=f.animations().flatMap(a=>a.frames).filter(frame=>'transform'in frame);assert.equal(transforms.length,0,'reduced-motion animations are opacity-only');
});

test('closing mid-reveal cleans timers, observer and presentation state without reopening',()=>{
  const f=fixture();f.present();f.dialog.emit('close');assert.equal(f.observerDisconnected,true);assert.equal(f.name.style.opacity,'');assert.equal(f.host.style.filter,'');assert.ok(f.nav.afterNode.removed);
});

test('failed auto-open leaves the canonical discovery queued for a later retry',()=>{const f=fixture({open:false});assert.equal(f.present(),false);});

const craft=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
assert.match(craft,/const isNew=!!event\.gameEvent\?\.isNew,recordId=/);
assert.match(craft,/if\(isNew&&recordId\)[\s\S]*presentRegistration\(\{collection,id:recordId\}\)/);
assert.match(craft,/if\(discovery\?\.learned\)[\s\S]*collection\.refreshProgress\(\)/);
assert.doesNotMatch(craft,/discovery\?\.learned[^\n]*presentRegistration/,'resources learned is not the reveal trigger');
assert.match(craft,/queue\.shift\(\);active=item\.signature;until=now\+1300;onPresent\(\{item,isNew\}\)/,'repeat CRAFT keeps the existing completion presentation');
