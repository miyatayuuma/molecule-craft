import { VEIL, EXPEDITION } from './config.js';
import { createRun, stepRun, beginBurst, setCombustionHeld } from './engine.js';
import { createUniverse } from './universe.js';
import { DRIVES, REGIONS, flightConfig, driveAvailable, growthGoal } from './growth.js';
import { createSupplyUI } from './supply.js';
import { createVeilRenderer } from './renderer.js';
import { createVeilAudio } from './audio.js';
import { completeExpeditionTelemetry, logExpeditionTelemetry } from './telemetry.js';

const DRIVE_COST=DRIVES.combustion.cost;
const LOST_CARGO_ELEMENTS=['H','C','O'];
function previewCaptureLoss(units){
  const rate=EXPEDITION.captureLoss,exact=LOST_CARGO_ELEMENTS.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));
  let remaining=Math.floor(LOST_CARGO_ELEMENTS.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-LOST_CARGO_ELEMENTS.reduce((sum,el)=>sum+lost[el],0);
  for(const item of exact.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index)){if(remaining<=0)break;if(lost[item.el]<(units[item.el]??0)){lost[item.el]++;remaining--;}}
  return lost;
}

export function createVeilUI({resources,canLeave=()=>true,canSupply=canLeave,onCraft=()=>{},onStore=()=>false,onCommit=()=>{}}){
  const q=id=>document.getElementById(id),root=q('veil-view'),canvas=q('veil-canvas'),pad=q('veil-pad'),knob=q('veil-knob'),combustionButton=q('veil-combustion'),audio=createVeilAudio();
  let renderer=null,run=null,lastTelemetry=null,active=false,paused=false,raf=0,last=0,hudAt=0,pointer=null,drivePointer=null,origin=null,messageUntil=0,anchor='continue',captureReturnAt=0;
  const stick={x:0,y:0},keys=new Set(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const has=id=>resources.state.recipes.includes(id);
  const supply=createSupplyUI({resources,canOpen:canLeave,canMake:canSupply,onCommit,onStore,onAnchor:id=>{anchor=id;updateCraft();}});

  function updateCraft(){
    supply.update();q('launch-veil').disabled=resources.blocked;
    const checkpoint=resources.state.progress.checkpoint;
    q('launch-veil').textContent=anchor!=='continue'?`${REGIONS[anchor]?.name??'探索地点'}へ ↗`:checkpoint==='veil'?'H Veilを探索 ↗':`${REGIONS[checkpoint].name}から探索 ↗`;
    updatePrompt();
  }
  function updatePrompt(){
    const goal=growthGoal(resources.state),cost=goal.id&&resources.costFor(goal.id),withCargo=el=>(resources.state.elements[el]??0)+(run?.collectedElements[el]??0);
    const affordable=cost&&Object.entries(cost).every(([el,n])=>withCargo(el)>=n),firstHydrogen=goal.id==='hydrogen'&&(run?.collectedElements.H??0)>=VEIL.firstCraftH;
    const ready=active&&goal.id&&!has(goal.id)&&affordable&&(resources.state.hints.includes(goal.id)||firstHydrogen);
    q('veil-craft-prompt').hidden=!ready;if(ready){const record=resources.record(goal.id);q('veil-to-craft').textContent=`${record?.formula??record?.name??'分子'}を作れそう · 帰還する ↗`;}
  }
  function notice(text,seconds=4){q('veil-message').textContent=text;messageUntil=(run?.time??0)+seconds;q('veil-message').hidden=false;}
  function stopCombustion(){if(run)setCombustionHeld(run,false);const id=drivePointer;drivePointer=null;if(id!==null)try{combustionButton.releasePointerCapture(id);}catch{}combustionButton.classList.remove('driving');}
  function resetInput(){stick.x=stick.y=0;keys.clear();stopCombustion();const id=pointer;pointer=null;if(id!==null)try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}
  function positionAt(id){const at=REGIONS[id]??REGIONS.veil;run.player.x=at.x;run.player.y=at.y;run.player.angle=at.angle;run.player.vx=run.player.vy=0;run.player.trail=[];run.region=id;}
  function launch(){
    if(active||!canLeave()||resources.blocked)return;
    const seed=(Date.now()^((resources.state.progress.runs+1)*7919))>>>0,start=anchor!=='continue'?anchor:resources.state.progress.checkpoint;
    run=createRun(createUniverse(seed),flightConfig(resources.state),{fuel:resources.prepareExpedition()});positionAt(start);resources.state.progress.runs++;
    anchor='continue';q('expedition-anchor').value='continue';active=true;paused=false;captureReturnAt=0;root.hidden=false;document.body.dataset.mode='veil';document.querySelector('.app-shell').inert=true;
    try{renderer??=createVeilRenderer(canvas);renderer.resize();renderer.reset();}catch{active=false;root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;q('craft-resource-hint').textContent='探索画面を開始できません。このブラウザのCanvas対応を確認してください。';return;}
    resetInput();q('veil-resume').hidden=true;audio.mute(resources.state.progress.sound===false);audio.start();supply.clearAnnouncement();
    const first=resources.state.progress.runs===1?'最初は安全だ。塵を集め、気配が増す前に帰還しよう':driveAvailable(resources.state,'combustion')?`COMBUSTION DRIVE · CH₄ ${run.fuel.methane} / O₂ ${run.fuel.oxygen} · 長押しで継続航行`:has('hydrogen')?`H₂ BURST ${run.fuel.hydrogen}回 · 捕食体が迫る瞬間まで残そう`:'通常航行で塵を集め、H₂の材料を持ち帰ろう';
    notice(first,5);root.focus();last=0;hudAt=0;hud();updatePrompt();resources.save();raf=requestAnimationFrame(frame);
  }
  function finish(captured=false){
    if(!active||!run)return;active=false;cancelAnimationFrame(raf);resetInput();audio.pause();
    const completed=run,result=resources.settleExpedition(completed.elementDust,completed.best,captured);lastTelemetry=completeExpeditionTelemetry(completed,{captured,result});logExpeditionTelemetry(lastTelemetry);root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;
    const seconds=Math.round(completed.time),parts=result?Object.entries(result.atoms).filter(([,n])=>n).map(([el,n])=>`${el} +${n}`).join(' · '):'';
    const prefix=captured?`捕獲帰還 · 回収塵${Math.round(EXPEDITION.captureLoss*100)}%散逸`:'自主帰還 · 全回収';
    q('craft-last-run').textContent=result?`${prefix} · ${parts||'原子化なし'} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'帰還しましたが、探索物を保存できませんでした。';
    run=null;captureReturnAt=0;onCraft();updateCraft();q('launch-veil').focus();
  }
  function burst(){
    if(!active||paused||run.captured)return;audio.start();
    if(beginBurst(run,()=>resources.consumeDrive('hydrogen'))){audio.event('burst');vibrate(22);hud();return;}
    if(run.player.boost<=0)notice(!has('hydrogen')?'H₂を作ると緊急噴射が使える':run.fuel.hydrogen<1?'この探索に積んだH₂は空だ · 帰還して再出発しよう':'H₂が不足している',2);
  }
  function startCombustion(event=null){
    if(!active||paused||run.captured||!driveAvailable(resources.state,'combustion'))return;
    if((run.fuel.methane<DRIVE_COST.methane||run.fuel.oxygen<DRIVE_COST.oxygen)&&run.driveBuffer<=0){notice('搭載したCH₄またはO₂が空だ · 帰還して再出発しよう',2);return;}
    audio.start();if(event?.pointerId!==undefined){event.preventDefault();drivePointer=event.pointerId;try{combustionButton.setPointerCapture(drivePointer);}catch{}}
    setCombustionHeld(run,true);combustionButton.classList.add('driving');
  }
  function vibrate(ms){if(!reduced)try{navigator.vibrate?.(ms);}catch{}}
  function hud(){
    if(!run)return;const state=resources.state,region=REGIONS[run.region]??REGIONS.veil;
    q('veil-h').textContent=`H ${run.collectedElements.H}`;q('veil-gained').textContent=`拠点 H ${state.elements.H}`;
    q('veil-minerals').textContent=[['C',run.collectedElements.C],['O',run.collectedElements.O]].filter(([el])=>resources.canUseElement(el)||run.foundElements.includes(el)).map(([el,n])=>`${el} ${n}`).join(' · ');
    q('veil-chain').textContent=run.chain;q('veil-chain-block').dataset.fever=String(run.chain>=40);q('veil-chain-meter').style.transform=`scaleX(${Math.max(0,run.chainTime/run.config.chainSeconds)})`;
    q('veil-fuel').textContent=run.fuel.hydrogen;q('veil-boost').classList.toggle('boosting',run.player.boost>0);q('veil-boost').setAttribute('aria-disabled',String(!driveAvailable(state,'hydrogen')||run.fuel.hydrogen<1||run.player.cooldown>0));
    const combustion=driveAvailable(state,'combustion'),canBurn=run.fuel.methane>=DRIVE_COST.methane&&run.fuel.oxygen>=DRIVE_COST.oxygen;combustionButton.hidden=!combustion;combustionButton.classList.toggle('driving',run.player.combustion);combustionButton.setAttribute('aria-pressed',String(run.player.combustion));combustionButton.setAttribute('aria-disabled',String(!combustion||!canBurn&&run.driveBuffer<=0));q('veil-combustion-fuel').textContent=`CH₄ ${run.fuel.methane} · O₂ ${run.fuel.oxygen}${run.driveBuffer>0?` · ${run.driveBuffer.toFixed(1)}s`:''}`;
    q('veil-region-name').textContent=region.name;q('veil-region-subtitle').textContent=region.subtitle;
    const threat=q('veil-threat');threat.hidden=!run.eaters.length;if(run.eaters.length){q('veil-eater-count').textContent=run.eaters.length;q('veil-eater-distance').textContent=Number.isFinite(run.nearestEater)?`最接近 ${Math.round(run.nearestEater)}`:'追跡中';q('veil-threat-meter').style.transform=`scaleX(${Math.max(0,Math.min(1,1-run.nearestEater/EXPEDITION.eaterWarningRadius))})`;threat.dataset.level=run.danger;}
    q('veil-sound').setAttribute('aria-pressed',String(state.progress.sound!==false));
  }
  function signalText(result){
    if(!result)return '未知信号は消えた';if(result.repeat)return 'この流れの信号は、しばらく静かだ';
    if(result.recipe){const record=resources.record(result.recipe);return `ひらめき：${record?.formula??record?.name??'未知分子'}の構造断片\n進行に必須ではない発見`;}
    return `未知信号から塵がほどけた · ${Object.entries(result.bonus).map(([el,n])=>`${el} +${n}`).join(' · ')}`;
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.15):0;last=now;if(paused||document.hidden)return;
    if(captureReturnAt&&now>=captureReturnAt){finish(true);return;}
    const input={x:stick.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)};
    for(const event of stepRun(run,input,dt,{consumeCombustion:()=>resources.consumeDrive('combustion')})){
      if(event.type!=='danger'||event.level!=='clear')audio.event(event.type,event.chain,event.count);
      if(event.type==='pickup')updatePrompt();
      if(event.type==='element'){
        const first=resources.findElement(event.element);if(first&&event.element!=='H'){notice(event.element==='C'?'Cを発見 · 点の列ではなく、炭素塊へ飛び込もう':'Oを発見 · CH₄と組み合わせる酸化剤が作れる',5);vibrate(24);resources.save();}updatePrompt();
      }
      if(event.type==='dense')vibrate(10);
      if(event.type==='cluster'){notice('炭素塊がほどけた · 散るC塵をまとめて吸おう',2.5);vibrate(18);}
      if(event.type==='rare'){resources.state.progress.special='pure-h';notice(`高純度H塵 +${VEIL.rareValue}`,3);vibrate(16);}
      if(event.type==='gate'){resources.state.progress.cleared=true;run.gateTime=run.time;resources.save();notice('Hの帳を抜けた · BURSTを使うべき瞬間だった',4);}
      if(event.type==='region'){const first=resources.visit(event.region);if(first)notice(event.region==='carbon'?'CARBON DRIFT · 粒子列の先に、塊が脈打つ':event.region==='oxygen'?'OXYGEN SURGE · 高速流と熱の領域':event.region==='frontier'?'INNER HORIZON · さらに奥へ行けそうだ':`${REGIONS[event.region].name}へ戻った`,6);resources.save();}
      if(event.type==='signal'){const result=resources.signal(event.region,event.roll,event.choice);notice(signalText(result),result?.recipe?5:3);supply.update();}
      if(event.type==='lap')notice('流れをひと巡り · 捕食圧は下がらない',3);
      if(event.type==='eaterSpawn'){notice(event.count===1?'DUST EATER · 暗い核が採集の跡を追ってきた':`DUST EATERS × ${event.count} · 包囲される前に帰還を`,4);vibrate(18);}
      if(event.type==='danger'&&event.level==='warning')notice('捕食体が近い · H₂ BURSTを切るか、帰還するか',3);
      if(event.type==='danger'&&event.level==='danger'){notice('接触間近 · H₂ BURST',2);vibrate(28);}
      if(event.type==='driveIgnition'){vibrate(12);}
      if(event.type==='driveEmpty'){notice('COMBUSTION DRIVEの搭載分が空になった',2);stopCombustion();}
      if(event.type==='capture'){renderer.scatterLostCargo(run,previewCaptureLoss(run.elementDust));captureReturnAt=now+650;resetInput();notice(`捕獲された · 今回の回収塵を${Math.round(EXPEDITION.captureLoss*100)}%失って強制帰還`,2);vibrate(55);}
    }
    if(run.time>messageUntil)q('veil-message').hidden=true;
    const propulsion=run.player.boost>0?'burst':run.player.combustion?'combustion':null;audio.update(run.player.speed,run.chain,propulsion);renderer.draw(run,dt,reduced);
    if(now-hudAt>70){hudAt=now;hud();}
  }
  q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',()=>finish(false));q('veil-to-craft').addEventListener('click',()=>finish(false));
  q('veil-boost').addEventListener('pointerdown',event=>{event.preventDefault();burst();});q('veil-boost').addEventListener('click',event=>{if(event.detail===0)burst();});
  combustionButton.addEventListener('pointerdown',startCombustion);for(const type of ['pointerup','pointercancel','lostpointercapture'])combustionButton.addEventListener(type,event=>{if(drivePointer===null||event.pointerId===drivePointer)stopCombustion();});
  q('veil-sound').addEventListener('click',()=>{resources.state.progress.sound=resources.state.progress.sound===false;audio.mute(!resources.state.progress.sound);audio.start();resources.save();hud();});
  pad.addEventListener('pointerdown',event=>{if(pointer!==null||paused)return;event.preventDefault();pointer=event.pointerId;const r=pad.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};try{pad.setPointerCapture(pointer);}catch{}audio.start();move(event);});
  function move(event){if(event.pointerId!==pointer||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y,len=Math.hypot(dx,dy),radius=48;stick.x=len>6?dx/Math.max(radius,len):0;stick.y=len>6?dy/Math.max(radius,len):0;knob.style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
  pad.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer){stick.x=stick.y=0;const id=pointer;pointer=null;try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}});
  window.addEventListener('keydown',event=>{if(!active||paused)return;if(event.key===' '&&event.target.closest?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' ','Shift'].includes(event.key)){event.preventDefault();if(event.key===' '){if(!event.repeat)burst();}else if(event.key==='Shift')startCombustion();else keys.add(event.key);audio.start();}if(event.key==='Escape')finish(false);});
  window.addEventListener('keyup',event=>{keys.delete(event.key);if(event.key==='Shift')stopCombustion();});
  function pause(){if(!active)return;resetInput();paused=true;audio.pause();resources.save();q('veil-resume').hidden=false;}
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=0;});
  window.addEventListener('pagehide',()=>{resources.save();audio.pause();});window.addEventListener('storage',event=>{if(event.key==='molecule-craft.resources.v1'){pause();resources.save();updateCraft();}});
  q('veil-resume').addEventListener('click',()=>{if(resources.blocked)return;paused=false;last=0;q('veil-resume').hidden=true;audio.start();root.focus();});
  new ResizeObserver(()=>renderer?.resize()).observe(root);updateCraft();
  return {get active(){return active;},get run(){return run;},get lastTelemetry(){return lastTelemetry;},updateCraft,launch,pause,discovered:id=>supply.discovered(id)};
}
