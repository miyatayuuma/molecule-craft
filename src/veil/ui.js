import { VEIL, EXPEDITION, THERMAL } from './config.js';
import { createRun, stepRun, beginBurst, setCombustionHeld } from './engine.js';
import { createUniverse } from './universe.js';
import { DRIVES, MOLECULE_USES, REGIONS, flightConfig, growthGoal, propulsionGauge } from './growth.js';
import { createSupplyUI } from './supply.js';
import { createVeilRenderer } from './renderer.js';
import { createVeilAudio } from './audio.js';
import { completeExpeditionTelemetry, logExpeditionTelemetry } from './telemetry.js';
import { combustionPacketFor,performanceFor } from './molecule-roles.js';
import { renderCraftTargetAtoms } from '../craft-panel.js?v=3';

const LOST_CARGO_ELEMENTS=['H','C','O'];
function previewCaptureLoss(units){
  const rate=EXPEDITION.captureLoss,exact=LOST_CARGO_ELEMENTS.map((el,index)=>({el,index,value:(units[el]??0)*rate})),lost=Object.fromEntries(exact.map(({el,value})=>[el,Math.floor(value)]));
  let remaining=Math.floor(LOST_CARGO_ELEMENTS.reduce((sum,el)=>sum+(units[el]??0),0)*rate)-LOST_CARGO_ELEMENTS.reduce((sum,el)=>sum+lost[el],0);
  for(const item of exact.sort((a,b)=>(b.value-Math.floor(b.value))-(a.value-Math.floor(a.value))||a.index-b.index)){if(remaining<=0)break;if(lost[item.el]<(units[item.el]??0)){lost[item.el]++;remaining--;}}
  return lost;
}

export function createVeilUI({resources,canLeave=()=>true,canSupply=canLeave,onBeforeLaunch=()=>true,onCraft=()=>{},onCommit=()=>{}}){
  const q=id=>document.getElementById(id),root=q('veil-view'),canvas=q('veil-canvas'),pad=q('veil-pad'),knob=q('veil-knob'),combustionButton=q('veil-combustion'),audio=createVeilAudio();
  let renderer=null,run=null,lastTelemetry=null,active=false,paused=false,raf=0,last=0,hudAt=0,pointer=null,drivePointer=null,origin=null,messageUntil=0,anchor='continue',anchorLock=null,returnState=null,pendingCraftId=null;
  const stick={x:0,y:0},keys=new Set(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const has=id=>resources.state.recipes.includes(id);
  const formula=id=>MOLECULE_USES[id]?.formula??resources.record(id)?.formula??id;
  const supply=createSupplyUI({resources,canOpen:canLeave,canMake:canSupply,onCommit,onAnchor:id=>{anchor=id;updateCraft();}});

  function updateCraft(){
    supply.update();q('launch-veil').disabled=resources.blocked;
    const checkpoint=resources.state.progress.checkpoint;
    q('launch-veil').textContent='↗ 出発';
    updatePrompt();q('cho-completion').hidden=!resources.state.progress.choCompleted;
  }
  function updatePrompt(){
    const goal=growthGoal(resources.state,{cargo:run?.collectedElements??{}}),record=goal.id?resources.record(goal.id):null,cost=goal.id&&resources.costFor(goal.id),withCargo=el=>(resources.state.elements[el]??0)+(run?.collectedElements[el]??0);
    const affordable=cost&&Object.entries(cost).every(([el,n])=>withCargo(el)>=n),firstHydrogen=goal.id==='hydrogen'&&(run?.collectedElements.H??0)>=VEIL.firstCraftH;
    q('craft-resource-hint').textContent='';
    const goalAction=q('cho-goal-action');goalAction.hidden=!goal.id;q('cho-goal-label').textContent=goal.id?formula(goal.id):'';goalAction.setAttribute('aria-label',goal.id?`${formula(goal.id)}をクラフト`:'');renderCraftTargetAtoms(q('cho-goal-atoms'),record,[],{size:26});
    const ready=active&&goal.id&&!has(goal.id)&&affordable&&(resources.state.hints.includes(goal.id)||firstHydrogen);
    q('veil-craft-prompt').hidden=!ready;if(ready){const label=record?.formula??'◉';q('veil-to-craft-label').textContent=label;q('veil-to-craft').setAttribute('aria-label',`${label}をクラフトするため戻る`);renderCraftTargetAtoms(q('veil-to-craft-atoms'),record,[],{size:24});}else q('veil-to-craft-atoms')?.replaceChildren();
  }
  function notice(text,seconds=4,icon='✦'){q('veil-message').setAttribute('aria-label',text);q('veil-message').textContent=icon;messageUntil=(run?.time??0)+seconds;q('veil-message').hidden=false;}
  function stopCombustion(){if(run)setCombustionHeld(run,false);const id=drivePointer;drivePointer=null;if(id!==null)try{combustionButton.releasePointerCapture(id);}catch{}combustionButton.classList.remove('driving');}
  function resetInput(){stick.x=stick.y=0;keys.clear();stopCombustion();const id=pointer;pointer=null;if(id!==null)try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}
  function positionAt(id){const at=REGIONS[id]??REGIONS.veil;run.player.x=at.x;run.player.y=at.y;run.player.angle=at.angle;run.player.vx=run.player.vy=0;run.player.trail=[];run.region=id;}
  function launch(){
    if(active||!canLeave()||resources.blocked||onBeforeLaunch()===false)return;
    const seed=(Date.now()^((resources.state.progress.runs+1)*7919))>>>0,start=anchor!=='continue'?anchor:resources.state.progress.checkpoint;
    run=createRun(createUniverse(seed,resources.state.elements),flightConfig(resources.state),{fuel:resources.prepareExpedition()});positionAt(start);resources.state.progress.runs++;
    anchor='continue';q('expedition-anchor').value='continue';active=true;paused=false;anchorLock=null;returnState=null;root.hidden=false;document.body.dataset.mode='veil';document.querySelector('.app-shell').inert=true;
    try{renderer??=createVeilRenderer(canvas);renderer.resize();renderer.reset();}catch{active=false;root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;q('craft-resource-hint').textContent='探索画面を開始できません。このブラウザのCanvas対応を確認してください。';return;}
    resetInput();q('veil-resume').hidden=true;audio.mute(resources.state.progress.sound===false);audio.start();supply.clearAnnouncement();
    const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,propellant=run.fuel.propellant;
    const first=resources.state.progress.runs===1?'採集殻を展開 · ANCHOR RETURNで回収':fuel.molecule&&oxidizer.molecule?'COMBUSTION DRIVE · 長押しで継続航行':propellant.molecule?`${formula(propellant.molecule)} BURST · ANCHOR LOCK前の緊急離脱に残そう`:'通常航行で塵を集め、H₂の材料を持ち帰ろう';
    notice(first,5);root.focus();last=0;hudAt=0;hud();updatePrompt();resources.save();raf=requestAnimationFrame(frame);
  }
  function finish(captured=false){
    if(!active||!run)return;active=false;cancelAnimationFrame(raf);resetInput();audio.pause();
    const completed=run,result=resources.settleExpedition(completed.elementDust,completed.best,captured,{destinationReached:completed.destinationReached});lastTelemetry=completeExpeditionTelemetry(completed,{captured,result});logExpeditionTelemetry(lastTelemetry);root.hidden=true;document.body.dataset.mode='craft';document.querySelector('.app-shell').inert=false;
    const seconds=Math.round(completed.time),parts=result?Object.entries(result.atoms).filter(([,n])=>n).map(([el,n])=>`${el} +${n}`).join(' · '):'';
    q('craft-last-run').textContent=result?`${result.completedNow?'◎ CHO ✓ · ':''}${captured?'⚠':'↩'} ${parts||'—'} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'帰還しましたが、探索物を保存できませんでした。';
    const pending=pendingCraftId;pendingCraftId=null;run=null;anchorLock=null;returnState=null;onCraft();updateCraft();q('launch-veil').focus();if(pending)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:pending,source:'field'}}));
  }
  function beginReturn(captured=false){
    if(!active||!run||paused||returnState)return false;
    if(captured){resetInput();anchorLock=null;const duration=renderer.beginReturn(run,'emergency');returnState={captured:true,duration,elapsed:0};audio.start();hud();return true;}
    if(anchorLock||run.captured)return false;resetInput();renderer.beginReturn(run,'stable');anchorLock={duration:EXPEDITION.anchorLockSeconds,elapsed:0};audio.start();audio.event('returnSafe');notice('ANCHOR LOCK · 保持場を安定収縮',1);hud();
    return true;
  }
  function burst(){
    if(!active||paused||anchorLock||returnState||run.captured)return;audio.start();
    if(beginBurst(run,()=>resources.consumeBoost())){audio.event('burst');vibrate(22);hud();return;}
    const slot=run.fuel.propellant,performance=performanceFor(slot.molecule,'propellant'),label=formula(slot.molecule)??'噴射剤';
    if(run.player.boost<=0)notice(!slot.molecule?'噴射剤を搭載すると緊急噴射が使える':slot.amount<(performance?.moleculesPerBurst??Infinity)?`搭載した${label}ではBURSTできない · 帰還して補給しよう`:`${label}が不足している`,2);
  }
  function startCombustion(event=null){
    if(!active||paused||anchorLock||returnState||run.captured)return;const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});
    if((!packet||oxidizer.molecule!=='oxygen'||fuel.amount<packet.fuelAmount||oxidizer.amount<packet.oxygenAmount)&&run.driveBuffer<=0){notice('搭載した燃料またはO₂が空だ · 帰還して再出発しよう',2);return;}
    audio.start();if(event?.pointerId!==undefined){event.preventDefault();drivePointer=event.pointerId;try{combustionButton.setPointerCapture(drivePointer);}catch{}}
    setCombustionHeld(run,true);combustionButton.classList.add('driving');
  }
  function vibrate(ms){if(!reduced)try{navigator.vibrate?.(ms);}catch{}}
  function returnHud(){
    const button=q('veil-return'),mode=returnState?'emergency':anchorLock?'locking':'idle',transition=returnState??anchorLock,ratio=transition?Math.max(0,Math.min(1,transition.elapsed/transition.duration)):0;
    button.dataset.returnState=mode;button.setAttribute('aria-disabled',String(mode!=='idle'));q('veil-return-label').textContent=mode==='emergency'?'EMERGENCY RETRACT':mode==='locking'?'ANCHOR LOCK':'帰還 · ANCHOR';q('veil-anchor-meter').style.transform=`scaleX(${ratio})`;
  }
  function hud(){
    if(!run)return;const state=resources.state,region=REGIONS[run.region]??REGIONS.veil;
    q('veil-h').textContent=`H ${run.collectedElements.H}`;q('veil-gained').textContent=`BASE STOCK H ${state.elements.H}`;
    q('veil-minerals').textContent=[['C',run.collectedElements.C],['O',run.collectedElements.O]].filter(([el])=>resources.canUseElement(el)||run.foundElements.includes(el)).map(([el,n])=>`${el} ${n}`).join(' · ');
    q('veil-chain').textContent=run.chain;q('veil-chain-block').dataset.fever=String(run.chain>=40);q('veil-chain-meter').style.transform=`scaleX(${Math.max(0,run.chainTime/run.config.chainSeconds)})`;
    const propellant=run.fuel.propellant,burstPerformance=performanceFor(propellant.molecule,'propellant'),burstGauge=propulsionGauge('hydrogen',run.fuel),boostButton=q('veil-boost');boostButton.querySelector('strong').textContent=propellant.molecule?formula(propellant.molecule):'—';q('veil-fuel').textContent='';q('veil-boost').setAttribute('aria-description',`残り噴射 ${burstGauge.remaining}回`);q('veil-burst-meter').style.transform=`scaleX(${burstGauge.ratio})`;boostButton.dataset.fuelState=burstGauge.state;boostButton.classList.toggle('boosting',run.player.boost>0);boostButton.setAttribute('aria-disabled',String(!propellant.molecule||propellant.amount<(burstPerformance?.moleculesPerBurst??Infinity)||run.player.cooldown>0));
    const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds}),combustion=!!packet&&oxidizer.molecule==='oxygen',canBurn=combustion&&fuel.amount>=packet.fuelAmount&&oxidizer.amount>=packet.oxygenAmount,combustionGauge=propulsionGauge('combustion',run.fuel,run.driveBuffer);combustionButton.hidden=!combustion;combustionButton.querySelector('strong').textContent=`${fuel.molecule?formula(fuel.molecule):'FUEL'} + ${oxidizer.molecule?formula(oxidizer.molecule):'O₂'}`;combustionButton.dataset.fuelState=combustionGauge.state;combustionButton.classList.toggle('driving',run.player.combustion);combustionButton.setAttribute('aria-pressed',String(run.player.combustion));combustionButton.setAttribute('aria-disabled',String(!combustion||run.overheated||!canBurn&&run.driveBuffer<=0));q('veil-combustion-remaining').textContent='';q('veil-combustion-meter').style.transform=`scaleX(${combustionGauge.ratio})`;for(const role of ['fuel','oxidizer']){const slot=run.fuel[role],node=q('veil-combustion-fuel').querySelector(`[data-role=${role}]`),capacity=performanceFor(slot.molecule,role)?.capacity||1;node.querySelector('b').textContent=slot.molecule?formula(slot.molecule):'—';node.setAttribute('role','meter');node.setAttribute('aria-label',role==='fuel'?'燃料':'酸化剤');node.setAttribute('aria-valuemin','0');node.setAttribute('aria-valuemax',String(capacity));node.setAttribute('aria-valuenow',String(slot.amount));node.querySelector('em').style.transform=`scaleY(${slot.amount/capacity})`;}
    const thermal=q('veil-thermal'),coolant=run.fuel.coolant,thermalState=run.overheated?'overheat':run.coolantActive?'cooling':run.heat>=THERMAL.hotThreshold?'hot':'normal';thermal.hidden=!combustion;thermal.dataset.state=thermalState;q('veil-thermal-state').textContent={normal:'♨',cooling:'❄ → ♨',hot:'♨',overheat:'♨ !'}[thermalState];q('veil-heat').textContent='';thermal.setAttribute('aria-label',`熱 ${Math.round(run.heat)}%。${run.coolantActive?'自動冷却中':''}`);q('veil-heat-meter').style.transform=`scaleX(${Math.max(0,Math.min(1,run.heat/THERMAL.overheatThreshold))})`;q('veil-coolant').textContent=coolant.molecule?`❄ ${formula(coolant.molecule)}`:'❄ ∅';const coolantCapacity=performanceFor(coolant.molecule,'coolant')?.capacity||1;q('veil-coolant-level').setAttribute('aria-valuemax',String(coolantCapacity));q('veil-coolant-level').setAttribute('aria-valuenow',String(coolant.amount));q('veil-coolant-level').firstElementChild.style.transform=`scaleX(${coolant.amount/coolantCapacity})`;
    q('veil-region-name').textContent=region.name;q('veil-region-subtitle').textContent='';
    q('veil-goal').dataset.reached=String(run.destinationReached);q('veil-goal').textContent=run.destinationReached?'◎ ✓ → ↩':'';q('veil-return').classList.toggle('destination-ready',run.destinationReached);
    const threat=q('veil-threat');threat.hidden=!run.eaters.length;if(run.eaters.length){q('veil-eater-count').textContent=run.eaters.length;q('veil-eater-distance').textContent=Number.isFinite(run.nearestEater)?`最接近 ${Math.round(run.nearestEater)}`:'追跡中';q('veil-threat-meter').style.transform=`scaleX(${Math.max(0,Math.min(1,1-run.nearestEater/EXPEDITION.eaterWarningRadius))})`;threat.dataset.level=run.danger;}
    q('veil-sound').setAttribute('aria-pressed',String(state.progress.sound!==false));returnHud();
  }
  function signalText(result){
    if(!result)return '未知信号は消えた';if(result.repeat)return 'この流れの信号は、しばらく静かだ';
    if(result.recipe){const record=resources.record(result.recipe);return `ひらめき：${record?.formula??record?.name??'未知分子'}の構造断片\n進行に必須ではない発見`;}
    return `未知信号から塵がほどけた · ${Object.entries(result.bonus).map(([el,n])=>`${el} +${n}`).join(' · ')}`;
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.15):0;last=now;if(paused||document.hidden)return;
    if(returnState){returnState.elapsed=Math.min(returnState.duration,returnState.elapsed+dt);audio.update(run.player.speed,run.chain,null);renderer.draw(run,dt,reduced);returnHud();if(returnState.elapsed>=returnState.duration)finish(returnState.captured);return;}
    const input=anchorLock?{x:0,y:0}:{x:stick.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)};
    for(const event of stepRun(run,input,dt,{consumeCombustion:packet=>resources.consumeCombustion(packet),consumeCoolant:(amount,molecule)=>resources.consumeTank('coolant',molecule,amount)})){
      if(event.type!=='danger'||event.level!=='clear')audio.event(event.type,event.chain,event.count);
      if(event.type==='pickup')updatePrompt();
      if(event.type==='choDestination'){notice('CHOの最深部に到達 · 帰還ボタンで記録を持ち帰ろう',8,'◎ ✓ ↩');vibrate(35);}
      if(event.type==='oxygenJunction')notice('酸素の分岐',6,'↖ ↑ ↗');
      if(event.type==='element'){
        const first=resources.findElement(event.element);if(first&&event.element!=='H'){notice(event.element==='C'?'Cを発見 · 点の列ではなく、炭素塊へ飛び込もう':'Oを発見 · CH₄と組み合わせる酸化剤が作れる',5);vibrate(24);resources.save();}updatePrompt();
      }
      if(event.type==='dense')vibrate(10);
      if(event.type==='cluster'){notice('炭素塊がほどけた · 散るC塵をまとめて吸おう',2.5);vibrate(18);}
      if(event.type==='rare'){resources.state.progress.special='pure-h';notice(`高純度H塵 +${VEIL.rareValue}`,3);vibrate(16);}
      if(event.type==='gate'){resources.state.progress.cleared=true;run.gateTime=run.time;resources.save();notice('Hの帳を抜けた · BURSTを使うべき瞬間だった',4);}
      if(event.type==='region'){const first=resources.visit(event.region);if(first)notice(event.region==='carbon'?'CARBON DRIFT · 粒子列の先に、塊が脈打つ':event.region==='oxygen'?'OXYGEN SURGE · 高速流と熱の領域':event.region==='frontier'?'INNER HORIZON · 金色の輪が最終地点。到達後は正常帰還を':`${REGIONS[event.region].name}へ戻った`,6);resources.save();}
      if(event.type==='signal'){const result=resources.signal(event.region,event.roll,event.choice);notice(signalText(result),result?.recipe?5:3);supply.update();}
      if(event.type==='lap')notice('流れをひと巡り · 保持場への干渉は下がらない',3);
      if(event.type==='eaterSpawn'){notice(event.count===1?'DUST EATER · 採集殻の保持場を崩す粒子現象':`DUST EATERS × ${event.count} · 保持場が破綻する前にANCHOR RETURNを`,4);vibrate(18);}
      if(event.type==='danger'&&event.level==='warning')notice('保持場への干渉が近い · H₂ BURSTで距離を作るか帰還',3,'⚠');
      if(event.type==='danger'&&event.level==='danger'){notice('保持場の破綻間近 · H₂ BURST',2,'⚠');vibrate(28);}
      if(event.type==='driveIgnition'){hud();vibrate(12);}
      if(event.type==='driveEmpty'){notice('COMBUSTION DRIVEの搭載分が空になった',2);stopCombustion();}
      if(event.type==='coolantStart'){notice(`AUTO COOLING · ${formula(event.molecule)}`,1.5,'❄ → ♨');vibrate(8);}
      if(event.type==='coolantEmpty'){notice('冷却剤が空になった · 燃焼熱に注意',2.5,'❄ ∅');vibrate(14);}
      if(event.type==='overheat'){notice('OVERHEAT · 安全温度まで燃焼停止',2.5,'♨ !');vibrate(38);}
      if(event.type==='heatRecovered'){notice(run.driveHeld?'THERMAL READY · 燃焼を自動再開':'THERMAL READY',1.5);vibrate(10);}
      if(event.type==='capture'){renderer.scatterLostCargo(run,previewCaptureLoss(run.elementDust));beginReturn(true);notice(`保持場破綻 · 回収塵${Math.round(EXPEDITION.captureLoss*100)}%がこぼれ、緊急RETRACT`,2);vibrate(55);}
    }
    const lockComplete=!!anchorLock&&(anchorLock.elapsed=Math.min(anchorLock.duration,anchorLock.elapsed+dt))>=anchorLock.duration;
    if(run.time>messageUntil)q('veil-message').hidden=true;
    const propulsion=run.player.boost>0?'burst':run.player.combustion?'combustion':null;audio.update(run.player.speed,run.chain,propulsion);renderer.draw(run,dt,reduced);
    if(anchorLock||now-hudAt>70){hudAt=now;hud();}if(lockComplete)finish(false);
  }
  q('cho-goal-action').addEventListener('click',()=>{const goal=growthGoal(resources.state);if(goal.id)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:goal.id}}));});
  q('cho-continue').addEventListener('click',()=>q('open-supply').click());
  q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',()=>beginReturn(false));q('veil-to-craft').addEventListener('click',()=>{const goal=growthGoal(resources.state,{cargo:run?.collectedElements??{}}),id=goal.id??null;if(id&&beginReturn(false))pendingCraftId=id;});
  q('veil-boost').addEventListener('pointerdown',event=>{event.preventDefault();burst();});q('veil-boost').addEventListener('click',event=>{if(event.detail===0)burst();});
  combustionButton.addEventListener('pointerdown',startCombustion);for(const type of ['pointerup','pointercancel','lostpointercapture'])combustionButton.addEventListener(type,event=>{if(drivePointer===null||event.pointerId===drivePointer)stopCombustion();});
  q('veil-sound').addEventListener('click',()=>{resources.state.progress.sound=resources.state.progress.sound===false;audio.mute(!resources.state.progress.sound);audio.start();resources.save();hud();});
  pad.addEventListener('pointerdown',event=>{if(pointer!==null||paused||anchorLock||returnState)return;event.preventDefault();pointer=event.pointerId;const r=pad.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};try{pad.setPointerCapture(pointer);}catch{}audio.start();move(event);});
  function move(event){if(event.pointerId!==pointer||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y,len=Math.hypot(dx,dy),radius=48;stick.x=len>6?dx/Math.max(radius,len):0;stick.y=len>6?dy/Math.max(radius,len):0;knob.style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
  pad.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer){stick.x=stick.y=0;const id=pointer;pointer=null;try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}});
  window.addEventListener('keydown',event=>{if(!active||paused||anchorLock||returnState)return;if(event.key===' '&&event.target.closest?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' ','Shift'].includes(event.key)){event.preventDefault();if(event.key===' '){if(!event.repeat)burst();}else if(event.key==='Shift')startCombustion();else keys.add(event.key);audio.start();}if(event.key==='Escape')beginReturn(false);});
  window.addEventListener('keyup',event=>{keys.delete(event.key);if(event.key==='Shift')stopCombustion();});
  function pause(){if(!active)return;resetInput();paused=true;audio.pause();resources.save();q('veil-resume').hidden=false;}
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=0;});
  window.addEventListener('pagehide',()=>{resources.save();audio.pause();});window.addEventListener('storage',event=>{if(event.key==='molecule-craft.resources.v1'){pause();resources.save();updateCraft();}});
  q('veil-resume').addEventListener('click',()=>{if(resources.blocked)return;paused=false;last=0;q('veil-resume').hidden=true;audio.start();root.focus();});
  new ResizeObserver(()=>renderer?.resize()).observe(root);updateCraft();
  return {get active(){return active;},get run(){return run;},get returning(){return returnState?'emergency':anchorLock?'locking':null;},get anchorLock(){return anchorLock?{...anchorLock}:null;},get lastTelemetry(){return lastTelemetry;},updateCraft,launch,pause,openSupply:(id,use)=>supply.openMolecule(id,use),discovered:id=>supply.discovered(id),usesFor:id=>supply.usesFor(id),tankStatus:(use,id)=>supply.tankStatus(use,id),fillPlan:(use,id)=>supply.fillPlan(use,id),commitFill:(use,id,count)=>supply.commitFill(use,id,count)};
}
