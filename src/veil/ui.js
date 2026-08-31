import { VEIL } from './config.js';
import { createMap } from './map.js';
import { createRun, stepRun, beginBoost, clamp } from './engine.js';
import { createVeilRenderer } from './renderer.js';
import { createVeilAudio } from './audio.js';
export function createVeilUI({resources,canLeave=()=>true,onCraft=()=>{},onStore=()=>false,onCommit=()=>{}}){
  const q=id=>document.getElementById(id),root=q('veil-view'),canvas=q('veil-canvas'),pad=q('veil-pad'),knob=q('veil-knob'),audio=createVeilAudio();
  let renderer=null,run=null,active=false,paused=false,raf=0,last=0,hudAt=0,saveAt=0,pointer=null,origin=null,messageUntil=0;
  const stick={x:0,y:0},keys=new Set(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const unlocked=()=>resources.state.recipes.includes('hydrogen');
  function updateCraft(){
    q('resource-h').textContent=resources.state.elements.H;
    q('resource-h2').textContent=resources.state.molecules.hydrogen;
    q('make-h2').hidden=!unlocked()||!q('store-h2').hidden;q('make-h2').disabled=resources.blocked||resources.state.elements.H<2;
    const count=Math.min(VEIL.defaultFuelBatch,Math.floor(resources.state.elements.H/2));q('make-h2').textContent=`H₂ ×${Math.max(1,count)} 生成`;
    q('launch-veil').disabled=resources.blocked;
    q('launch-veil').textContent=run?'採集を再開 ↗':'Hを採集 ↗';
    q('craft-resource-hint').textContent=!unlocked()?(resources.state.elements.H>=2?'Hを2つ置き、光る電子をつないでH₂を作ろう。':'H Veilで素材を集めよう。'):resources.state.molecules.hydrogen===0?'H₂を生成して、同じ流れの先へ。':'';
  }
  function notice(text,seconds=4){q('veil-message').textContent=text;messageUntil=(run?.time??0)+seconds;q('veil-message').hidden=false;}
  function resetInput(){stick.x=stick.y=0;keys.clear();if(pointer!==null)try{pad.releasePointerCapture(pointer);}catch{}pointer=null;origin=null;knob.style.transform='translate(0px,0px)';}
  function launch(){
    if(active||!canLeave()||resources.blocked)return;
    if(!run){const seed=(Date.now()^((resources.state.progress.runs+1)*7919))>>>0;run=createRun(createMap(seed));resources.state.progress.runs++;}
    active=true;paused=false;root.hidden=false;document.body.dataset.mode='veil';document.querySelector('.app-shell').inert=true;
    try{renderer??=createVeilRenderer(canvas);renderer.resize();renderer.reset();}catch{active=false;root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;q('craft-resource-hint').textContent='採集画面を開始できません。このブラウザのCanvas対応を確認してください。';return;}
    resetInput();q('veil-resume').hidden=true;audio.mute(resources.state.progress.sound===false);audio.start();
    notice(resources.state.progress.runs===1?'左のパッドで飛ぶ · 光の列をたどろう':unlocked()?'H₂で空白をつなぐ · 外縁は流れの先':'光の列をたどってHを集めよう',4);
    q('veil-craft-prompt').hidden=unlocked()||resources.state.elements.H<VEIL.firstCraftH;
    root.focus();last=0;hudAt=0;saveAt=run.time;hud();resources.save();raf=requestAnimationFrame(frame);
  }
  function leave(preserve=false){
    if(!active)return;active=false;cancelAnimationFrame(raf);resetInput();audio.pause();resources.state.progress.bestChain=Math.max(resources.state.progress.bestChain,run.best);resources.save();
    root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;q('veil-result').hidden=true;
    if(!preserve){const amount=run.collected,best=run.best,seconds=Math.round(run.time);q('craft-last-run').textContent=`回収 H ${amount} · 最大 ${best} CHAIN · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;run=null;}
    onCraft();updateCraft();q('launch-veil').focus();
  }
  function boost(){
    if(!active||paused)return;audio.start();
    if(beginBoost(run.player,()=>resources.consumeBoost())){audio.event('boost');vibrate(18);hud();}
    else if(run.player.boost<=0)notice(unlocked()?'H₂が空です · 帰還して生成できます':'H₂を作るとブーストが使えます',2);
  }
  function vibrate(ms){if(!reduced)try{navigator.vibrate?.(ms);}catch{}}
  function hud(){
    q('veil-h').textContent=resources.state.elements.H;q('veil-gained').textContent=`+${run.collected}`;
    q('veil-chain').textContent=run.chain;q('veil-chain-block').dataset.fever=String(run.chain>=50);
    q('veil-chain-meter').style.transform=`scaleX(${Math.max(0,run.chainTime/VEIL.chainSeconds)})`;
    q('veil-fuel').textContent=resources.state.molecules.hydrogen;q('veil-boost').classList.toggle('boosting',run.player.boost>0);
    q('veil-boost').setAttribute('aria-disabled',String(!unlocked()||resources.state.molecules.hydrogen<1||run.player.cooldown>0));
    q('veil-sound').setAttribute('aria-pressed',String(resources.state.progress.sound!==false));
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.15):0;last=now;if(paused||document.hidden)return;
    const input={x:stick.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)};
    for(const event of stepRun(run,input,dt)){
      audio.event(event.type,event.chain);
      if(event.type==='pickup'){resources.collect(event.amount,run.best);if(!unlocked()&&resources.state.elements.H>=VEIL.firstCraftH){resources.state.progress.craftPrompt=true;q('veil-craft-prompt').hidden=false;}}
      if(event.type==='dense')vibrate(10);
      if(event.type==='rare'){resources.state.progress.special='pure-h';notice('高純度H塵 +8',3);vibrate(16);}
      if(event.type==='gate'){resources.state.progress.cleared=true;run.gateTime=run.time;resources.save();notice('帳の向こうに、まだ知らない粒子の光。\n流れを記録した。いまはH Veilへ戻ろう。',7);}
      if(event.type==='lap'){paused=true;resetInput();audio.pause();q('veil-result').hidden=false;q('veil-result-stats').textContent=`H ${run.collected} / 最大 ${run.best} CHAIN / ${Math.round(run.time)}秒`;q('veil-next').focus();resources.save();}
    }
    if(run.time>messageUntil)q('veil-message').hidden=true;
    audio.update(run.player.speed,run.chain,run.player.boost>0);renderer.draw(run,dt,reduced);
    if(now-hudAt>70){hudAt=now;hud();}if(run.time-saveAt>1){saveAt=run.time;resources.save();}
  }
  q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',()=>leave());q('veil-to-craft').addEventListener('click',()=>leave(true));
  q('veil-result-return').addEventListener('click',()=>leave());q('veil-next').addEventListener('click',()=>{leave();launch();});
  q('veil-boost').addEventListener('pointerdown',event=>{event.preventDefault();boost();});
  q('veil-boost').addEventListener('click',event=>{if(event.detail===0)boost();});
  q('make-h2').addEventListener('click',()=>{if(!canLeave())return;const n=Math.min(VEIL.defaultFuelBatch,Math.floor(resources.state.elements.H/2));if(resources.makeHydrogen(n)){onCommit();resources.save();updateCraft();}});
  q('store-h2').addEventListener('click',()=>{if(onStore()){updateCraft();q('craft-resource-hint').textContent='H₂を保管しました。採集を再開してブーストを試そう。';}});
  q('veil-sound').addEventListener('click',()=>{resources.state.progress.sound=resources.state.progress.sound===false;audio.mute(!resources.state.progress.sound);audio.start();resources.save();hud();});
  pad.addEventListener('pointerdown',event=>{if(pointer!==null||paused)return;event.preventDefault();pointer=event.pointerId;const r=pad.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};try{pad.setPointerCapture(pointer);}catch{}audio.start();move(event);});
  function move(event){if(event.pointerId!==pointer||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y,len=Math.hypot(dx,dy),radius=48;stick.x=len>6?dx/Math.max(radius,len):0;stick.y=len>6?dy/Math.max(radius,len):0;knob.style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
  pad.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer)resetInput();});
  window.addEventListener('keydown',event=>{if(!active||paused)return;if(event.key===' '&&event.target.closest?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(event.key)){event.preventDefault();if(event.key===' '){if(!event.repeat)boost();}else keys.add(event.key);audio.start();}if(event.key==='Escape')leave();});
  window.addEventListener('keyup',event=>keys.delete(event.key));
  function pause(){if(!active)return;resetInput();paused=true;audio.pause();resources.save();if(q('veil-result').hidden)q('veil-resume').hidden=false;}
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=0;});
  window.addEventListener('pagehide',()=>{resources.save();audio.pause();});window.addEventListener('storage',event=>{if(event.key==='molecule-craft.resources.v1'){pause();resources.save();updateCraft();}});
  q('veil-resume').addEventListener('click',()=>{if(resources.blocked)return;paused=false;last=0;q('veil-resume').hidden=true;audio.start();root.focus();});
  new ResizeObserver(()=>renderer?.resize()).observe(root);updateCraft();
  return {get active(){return active;},updateCraft,launch,pause};
}
