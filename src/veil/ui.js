import { VEIL } from './config.js';
import { createRun, stepRun, beginBoost } from './engine.js';
import { createUniverse } from './universe.js';
import { DRIVES, REGIONS, flightConfig, driveAvailable, growthGoal } from './growth.js';
import { createSupplyUI } from './supply.js';
import { createVeilRenderer } from './renderer.js';
import { createVeilAudio } from './audio.js';

export function createVeilUI({resources,canLeave=()=>true,canSupply=canLeave,onCraft=()=>{},onStore=()=>false,onCommit=()=>{}}){
  const q=id=>document.getElementById(id),root=q('veil-view'),canvas=q('veil-canvas'),pad=q('veil-pad'),knob=q('veil-knob'),audio=createVeilAudio();
  let renderer=null,run=null,active=false,paused=false,raf=0,last=0,hudAt=0,saveAt=0,pointer=null,origin=null,messageUntil=0,anchor='continue';
  const stick={x:0,y:0},keys=new Set(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const has=id=>resources.state.recipes.includes(id);
  const supply=createSupplyUI({resources,canOpen:canLeave,canMake:canSupply,onCommit,onStore,onAnchor:id=>{anchor=id;updateCraft();}});

  function updateCraft(){
    supply.update();
    q('launch-veil').disabled=resources.blocked;
    q('launch-veil').textContent=anchor!=='continue'?`${REGIONS[anchor]?.name??'探索地点'}へ ↗`:run?'探索を再開 ↗':resources.state.progress.checkpoint==='veil'?'Hを採集 ↗':`${REGIONS[resources.state.progress.checkpoint].name}から再開 ↗`;
    updatePrompt();
  }
  function updatePrompt(){
    const goal=growthGoal(resources.state),cost=goal.id&&resources.costFor(goal.id),ready=goal.id&&!has(goal.id)&&resources.state.hints.includes(goal.id)&&resources.canAfford(cost)&&(goal.id!=='hydrogen'||resources.state.elements.H>=VEIL.firstCraftH);
    q('veil-craft-prompt').hidden=!active||!ready;
    if(ready){const record=resources.record(goal.id);q('veil-to-craft').textContent=`${record?.formula??record?.name??'分子'}を作れそう · 制作へ ↗`;}
  }
  function notice(text,seconds=4){q('veil-message').textContent=text;messageUntil=(run?.time??0)+seconds;q('veil-message').hidden=false;}
  function resetInput(){stick.x=stick.y=0;keys.clear();if(pointer!==null)try{pad.releasePointerCapture(pointer);}catch{}pointer=null;origin=null;knob.style.transform='translate(0px,0px)';}
  function positionAt(id){const at=REGIONS[id]??REGIONS.veil;run.player.x=at.x;run.player.y=at.y;run.player.angle=at.angle;run.player.vx=run.player.vy=0;run.player.trail=[];run.region=id;}
  function launch(){
    if(active||!canLeave()||resources.blocked)return;
    if(anchor!=='continue')run=null;
    if(!run){
      const seed=(Date.now()^((resources.state.progress.runs+1)*7919))>>>0,start=anchor!=='continue'?anchor:resources.state.progress.checkpoint;
      run=createRun(createUniverse(seed),flightConfig(resources.state));positionAt(start);resources.state.progress.runs++;
    }else run.config=flightConfig(resources.state);
    anchor='continue';q('expedition-anchor').value='continue';active=true;paused=false;root.hidden=false;document.body.dataset.mode='veil';document.querySelector('.app-shell').inert=true;
    try{renderer??=createVeilRenderer(canvas);renderer.resize();renderer.reset();}catch{active=false;root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;q('craft-resource-hint').textContent='探索画面を開始できません。このブラウザのCanvas対応を確認してください。';return;}
    resetInput();q('veil-resume').hidden=true;audio.mute(resources.state.progress.sound===false);audio.start();supply.clearAnnouncement();
    const first=resources.state.progress.runs===1?'左のパッドで流れを操る · 光の列をたどろう':has('hydrogen')?'H₂は巡航も吸引も強くする · 空白でブースト':'細い吸引で流れの芯を追おう · H₂で景色が変わる';
    notice(first,4);root.focus();last=0;hudAt=0;saveAt=run.time;hud();updatePrompt();resources.save();raf=requestAnimationFrame(frame);
  }
  function leave(){
    if(!active)return;active=false;cancelAnimationFrame(raf);resetInput();audio.pause();resources.state.progress.bestChain=Math.max(resources.state.progress.bestChain,run.best);resources.save();
    root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;
    const seconds=Math.round(run.time),parts=Object.entries(run.collectedElements).filter(([,n])=>n).map(([el,n])=>`${el} ${n}`).join(' · ');
    q('craft-last-run').textContent=`回収 ${parts||'—'} · 最大 ${run.best} CHAIN · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
    onCraft();updateCraft();q('launch-veil').focus();
  }
  function selectedDrive(){const id=resources.state.loadout.drive;return driveAvailable(resources.state,id)?id:'hydrogen';}
  function boost(){
    if(!active||paused)return;audio.start();
    const id=selectedDrive(),drive=DRIVES[id];
    if(run.overheated){notice('過熱で出力が落ちている · 冷たい流れかH₂Oで冷やそう',2);return;}
    if(beginBoost(run.player,()=>resources.consumeDrive(id),drive)){audio.event('boost');vibrate(id==='combustion'?28:18);hud();}
    else if(run.player.boost<=0)notice(id==='combustion'?'CH₄ 1個とO₂ 2個を補給すると燃焼できる':has('hydrogen')?'H₂が空です · 帰還して生成できます':'H₂を作るとブーストが使えます',2);
  }
  function vibrate(ms){if(!reduced)try{navigator.vibrate?.(ms);}catch{}}
  function hud(){
    const state=resources.state,region=REGIONS[run.region]??REGIONS.veil,driveId=selectedDrive(),drive=DRIVES[driveId];
    q('veil-h').textContent=state.elements.H;q('veil-gained').textContent=`+${run.collectedElements.H}`;
    q('veil-minerals').textContent=[['C',state.elements.C,run.collectedElements.C],['O',state.elements.O,run.collectedElements.O]].filter(([el])=>resources.canUseElement(el)).map(([el,n,g])=>`${el} ${n} +${g}`).join(' · ');
    q('veil-chain').textContent=run.chain;q('veil-chain-block').dataset.fever=String(run.chain>=50);
    q('veil-chain-meter').style.transform=`scaleX(${Math.max(0,run.chainTime/run.config.chainSeconds)})`;
    const fuel=driveId==='combustion'?Math.min(state.molecules.methane??0,Math.floor((state.molecules.oxygen??0)/2)):state.molecules.hydrogen??0;
    q('veil-fuel').textContent=fuel;q('veil-drive-label').textContent=drive.label;q('veil-boost').dataset.drive=driveId;q('veil-boost').setAttribute('aria-label',`${drive.name}ブースト。${Object.entries(drive.cost).map(([id,n])=>`${resources.record(id)?.formula??id} ${n}`).join('、')}消費。キーボードはスペース`);q('veil-boost').classList.toggle('boosting',run.player.boost>0);
    q('veil-boost').setAttribute('aria-disabled',String(!driveAvailable(state,driveId)||fuel<1||run.player.cooldown>0||run.overheated));
    q('veil-drive-switch').hidden=!driveAvailable(state,'combustion');q('veil-drive-switch').textContent=driveId==='hydrogen'?'燃焼推進へ':'水素推進へ';
    q('veil-region-name').textContent=region.name;q('veil-region-subtitle').textContent=region.subtitle;
    const thermal=q('veil-thermal');thermal.hidden=run.region==='veil'&&run.heat<1;q('veil-heat-label').textContent=`熱 ${Math.round(run.heat)}%`;q('veil-heat-meter').style.transform=`scaleX(${run.heat/100})`;q('veil-cooling-status').textContent=run.cooling>0?`H₂O 冷却 ${run.cooling.toFixed(1)}s`:has('water')?`H₂O ${state.molecules.water??0}`:'冷却材なし';thermal.dataset.hot=String(run.heat>=78);
    q('veil-sound').setAttribute('aria-pressed',String(state.progress.sound!==false));
  }
  function signalText(result){
    if(!result)return '未知信号は消えた';if(result.repeat)return 'この流れの信号は、しばらく静かだ';
    if(result.recipe){const record=resources.record(result.recipe);return `ひらめき：${record?.formula??record?.name??'未知分子'}の構造断片\n進行に必須ではない発見`;}
    return `未知信号から塵がほどけた · ${Object.entries(result.bonus).map(([el,n])=>`${el} +${n}`).join(' · ')}`;
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.15):0;last=now;if(paused||document.hidden)return;
    const input={x:stick.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)};
    for(const event of stepRun(run,input,dt,{consumeCoolant:()=>resources.consumeCoolant()})){
      audio.event(event.type,event.chain,event.count);
      if(event.type==='pickup'){
        const found=resources.collectDust(event.units,run.best);for(const el of found)if(el!=='H'){notice(el==='C'?'Cを発見 · 点の列ではなく、炭素塊へ飛び込もう':'Oを発見 · 高速の流れと熱が、推進と冷却を要求している',5);vibrate(24);}
        updatePrompt();
      }
      if(event.type==='dense')vibrate(10);
      if(event.type==='cluster'){notice('炭素塊がほどけた · 散るC塵をまとめて吸おう',2.5);vibrate(18);}
      if(event.type==='rare'){resources.state.progress.special='pure-h';notice(`高純度H塵 +${VEIL.rareValue}`,3);vibrate(16);}
      if(event.type==='gate'){resources.state.progress.cleared=true;run.gateTime=run.time;resources.save();notice('Hの帳を抜けた · 流れの色と密度が変わっていく',4);}
      if(event.type==='region'){
        const first=resources.visit(event.region);if(first)notice(event.region==='carbon'?'CARBON DRIFT · 粒子列の先に、塊が脈打つ':event.region==='oxygen'?'OXYGEN SURGE · 高速流と熱の領域':event.region==='frontier'?'INNER HORIZON · さらに奥へ行けそうだ':`${REGIONS[event.region].name}へ戻った`,6);
        resources.save();
      }
      if(event.type==='cooling'){audio.event('cooling');notice('H₂O 冷却 · 熱が引き、推力が戻る',2);}
      if(event.type==='overheat')notice('過熱 · 推力低下\n冷たい渦へ逃げるか、H₂Oを補給しよう',4);
      if(event.type==='signal'){const result=resources.signal(event.region,event.roll,event.choice);notice(signalText(result),result?.recipe?5:3);supply.update();}
      if(event.type==='lap'){notice('流れをひと巡り · そのまま次の列へ',3);resources.save();}
    }
    if(run.time>messageUntil)q('veil-message').hidden=true;
    audio.update(run.player.speed,run.chain,run.player.boost>0);renderer.draw(run,dt,reduced);
    if(now-hudAt>70){hudAt=now;hud();}if(run.time-saveAt>1){saveAt=run.time;resources.save();}
  }
  q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',leave);q('veil-to-craft').addEventListener('click',leave);
  q('veil-boost').addEventListener('pointerdown',event=>{event.preventDefault();boost();});q('veil-boost').addEventListener('click',event=>{if(event.detail===0)boost();});
  q('veil-drive-switch').addEventListener('click',()=>{const next=selectedDrive()==='hydrogen'?'combustion':'hydrogen';if(driveAvailable(resources.state,next)){resources.state.loadout.drive=next;resources.save();hud();supply.update();}});
  q('veil-sound').addEventListener('click',()=>{resources.state.progress.sound=resources.state.progress.sound===false;audio.mute(!resources.state.progress.sound);audio.start();resources.save();hud();});
  pad.addEventListener('pointerdown',event=>{if(pointer!==null||paused)return;event.preventDefault();pointer=event.pointerId;const r=pad.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};try{pad.setPointerCapture(pointer);}catch{}audio.start();move(event);});
  function move(event){if(event.pointerId!==pointer||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y,len=Math.hypot(dx,dy),radius=48;stick.x=len>6?dx/Math.max(radius,len):0;stick.y=len>6?dy/Math.max(radius,len):0;knob.style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
  pad.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer)resetInput();});
  window.addEventListener('keydown',event=>{if(!active||paused)return;if(event.key===' '&&event.target.closest?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' '].includes(event.key)){event.preventDefault();if(event.key===' '){if(!event.repeat)boost();}else keys.add(event.key);audio.start();}if(event.key==='Escape')leave();});
  window.addEventListener('keyup',event=>keys.delete(event.key));
  function pause(){if(!active)return;resetInput();paused=true;audio.pause();resources.save();q('veil-resume').hidden=false;}
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=0;});
  window.addEventListener('pagehide',()=>{resources.save();audio.pause();});window.addEventListener('storage',event=>{if(event.key==='molecule-craft.resources.v1'){pause();resources.save();updateCraft();}});
  q('veil-resume').addEventListener('click',()=>{if(resources.blocked)return;paused=false;last=0;q('veil-resume').hidden=true;audio.start();root.focus();});
  new ResizeObserver(()=>renderer?.resize()).observe(root);updateCraft();
  return {get active(){return active;},updateCraft,launch,pause,discovered:id=>supply.discovered(id)};
}
