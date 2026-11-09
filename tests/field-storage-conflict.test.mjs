import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const start=source.indexOf('  function updatePauseAction(){');
const end=source.indexOf('  new ResizeObserver(',start);
assert.ok(start>0&&end>start,'Pause and recovery handlers are present in FIELD UI');
const handlers=source.slice(start,end);

function fixture(){
  const events=new Map(),nodes=new Map([
    ['veil-resume',{hidden:true,textContent:'飛行を再開',addEventListener(type,fn){if(type==='click')this.activate=fn;},click(){this.activate();},focus(){context.document.activeElement=this;}}],
    ['veil-conflict-notice',{hidden:true}],
  ]);
  let current='original',blocked=false,reloads=0,pauses=0,starts=0;
  const resources={get blocked(){return blocked;},save(){if(current!=='original'){blocked=true;return false;}return true;}};
  const context={
    resources,active:true,paused:false,last:12,root:{dataset:{},focus(){}},q:id=>nodes.get(id),
    window:{addEventListener:(name,fn)=>events.set(name,fn),location:{reload(){reloads++;}}},
    document:{addEventListener:(name,fn)=>events.set(name,fn),activeElement:null},
    resetInput(){},audio:{pause(){pauses++;},start(){starts++;}},updateCraft(){},
  };
  runInNewContext(handlers,context);
  return{context,events,nodes,setExternalSave(){current='other-tab';},get reloads(){return reloads;},get pauses(){return pauses;},get starts(){return starts;}};
}

test('ordinary FIELD pause still resumes without refreshing the page',()=>{
  const f=fixture();f.events.get('blur')();
  const button=f.nodes.get('veil-resume');assert.equal(button.hidden,false);
  assert.equal(button.textContent,'飛行を再開');assert.equal(f.nodes.get('veil-conflict-notice').hidden,true);
  button.click();assert.equal(f.context.paused,false);assert.equal(f.starts,1);assert.equal(f.reloads,0);
});

test('external resource write stops FIELD, explains the unsaved run and offers an explicit reload',()=>{
  const f=fixture();f.setExternalSave();f.events.get('storage')({key:'molecule-craft.resources.v1'});
  assert.equal(f.context.paused,true);assert.equal(f.context.resources.blocked,true);
  assert.equal(f.nodes.get('veil-conflict-notice').hidden,false);
  assert.equal(f.context.root.dataset.storageConflict,'true');
  const button=f.nodes.get('veil-resume');assert.equal(button.hidden,false);
  assert.equal(button.textContent,'保存済みデータを再読み込み');
  assert.equal(f.reloads,0,'conflict detection never discards the run without confirmation');
  button.click();assert.equal(f.reloads,1);assert.equal(f.starts,0);
});
