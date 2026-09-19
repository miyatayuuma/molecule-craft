import { VEIL, EXPEDITION, THERMAL } from './config.js';
import { createRun, stepRun, beginBurst, beginShock, setCombustionHeld, triggerInsight, discardActiveInsight, discardRunInsights, runInsightLossSnapshot } from './expedition-run.js';
import { createUniverse } from './universe.js';
import { DRIVES, MOLECULE_USES, REGIONS, driveAvailable, flightConfig, growthGoal, propulsionGauge, propulsionSpeedMax } from './growth.js';
import { createSupplyUI } from './supply.js';
import { createExpeditionLaunchRequester,isExpeditionDestinationAvailable } from './launch-request.js';
import { captureLaunchRollbackState,createLaunchTransaction,restoreLaunchRollbackState,stageLaunchSupply } from './launch-transaction.js';
import { createVeilRenderer } from './renderer.js';
import { createVeilAudio } from './audio.js';
import { createInsightPresentation } from './insight-presentation.js';
import { syncFieldInsightMarkerClaimability } from './signal-claimability.js';
import { completeExpeditionTelemetry, logExpeditionTelemetry } from './telemetry.js';
import { combustionChargeFor,combustionPacketFor,performanceFor } from './molecule-roles.js';
import { renderCraftTargetAtoms } from '../craft-panel.js?v=3';
import { expeditionLoss } from './resources.js';
import {RARE_ECOLOGY_ELEMENTS} from './rare-ecology.js';
import {HAZARD_TREATMENT_IDS,HAZARD_TREATMENTS} from './hazard-treatments.js';

export function createVeilUI({resources,canLeave=()=>true,canSupply=canLeave,onBeforeLaunch=()=>true,onCraft=()=>{},onCommit=()=>{}}){
  const q=id=>document.getElementById(id),root=q('veil-view'),canvas=q('veil-canvas'),pad=q('veil-pad'),knob=q('veil-knob'),shockButton=q('veil-shock'),combustionButton=q('veil-combustion'),thermal=q('veil-thermal'),outputMeterFill=q('veil-heat-meter'),outputMeter=outputMeterFill?.parentElement,audio=createVeilAudio(),appShell=document.querySelector('.app-shell');
  if(outputMeter){outputMeter.id='veil-output-meter';outputMeter.removeAttribute('aria-hidden');outputMeter.setAttribute('role','meter');outputMeter.setAttribute('aria-label','推進出力');outputMeter.setAttribute('aria-valuemin','0');outputMeter.setAttribute('aria-valuemax','100');}
  if(outputMeterFill)outputMeterFill.id='veil-output-meter-fill';
  let renderer=null,run=null,lastTelemetry=null,active=false,paused=false,raf=0,last=0,hudAt=0,treatmentSavedRevision=0,treatmentPersistAt=0,pointer=null,drivePointer=null,origin=null,messageUntil=0,thermalNotice=null,thermalNoticeUntil=0,anchorLock=null,returnState=null,pendingCraftId=null,requestExpeditionLaunch=()=>false,launchTransaction=null;
  const stick={x:0,y:0},keys=new Set(),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false;
  const has=id=>resources.state.recipes.includes(id);
  const formula=id=>MOLECULE_USES[id]?.formula??resources.record(id)?.formula??id;
  const insightPresentation=createInsightPresentation({root,resources,formula,audio,reduced});
  const launchRegionId=id=>id==='continue'?resources.state.progress.checkpoint:id;
  const destinationAvailable=id=>isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[launchRegionId(id)];
  const supply=createSupplyUI({resources,canOpen:canLeave,canMake:canSupply,onCommit,onRequestLaunch:id=>requestExpeditionLaunch(id),onLaunchReady:(id,options)=>launchTransaction?.execute(id,options)??Promise.resolve({status:'blocked',reason:'transaction-unavailable'})});
  launchTransaction=createLaunchTransaction({
    validate:id=>{
      if(active||resources.blocked)return 'blocked';
      return destinationAvailable(id)||'invalid-destination';
    },
    beforeLaunch:()=>canLeave()&&onBeforeLaunch()!==false,
    snapshot:()=>({resources:captureLaunchRollbackState(resources)}),
    commitSupply:({partial})=>stageLaunchSupply(resources,{partial}),
    prepareExpedition:({destinationId})=>{
      const nextRun=resources.state.progress.runs+1,start=destinationId!=='continue'?destinationId:resources.state.progress.checkpoint,seed=(Date.now()^(nextRun*7919))>>>0;
      return {nextRun,start,seed,fuel:resources.prepareExpedition({region:start})};
    },
    createRun:({prepared})=>{
      const config=flightConfig(resources.state),capabilities={combustionDrive:driveAvailable(resources.state,'combustion'),nitrogenField:config.nitrogenField===true,coreFractured:config.coreFractured===true,worldAwakened:config.worldAwakened===true,rareEcologyEligible:config.rareEcologyEligible===true};
      return createRun(createUniverse(prepared.seed,resources.state.elements,{capabilities}),config,{fuel:prepared.fuel,treatments:resources.state.treatments});
    },
    initializeExplore:({prepared,run:nextRun})=>initializeExploreLaunch(prepared,nextRun),
    stageSuccess:({prepared})=>{resources.state.progress.runs=prepared.nextRun;raf=requestAnimationFrame(frame);return true;},
    persist:()=>resources.save(),
    rollback:context=>rollbackLaunchTransaction(context),
  });
  requestExpeditionLaunch=createExpeditionLaunchRequester({
    isAvailable:id=>!active&&!launchTransaction.inFlight&&!supply.launchPending&&!resources.blocked&&destinationAvailable(id),
    selectDestination:selectLaunchDestination,
    prepareLaunch:id=>supply.requestLaunch(id),
  });

  function selectLaunchDestination(id){
    if(!destinationAvailable(id))return false;
    return true;
  }
  function updateCraft(){
    supply.update();
    updatePrompt();
  }
  function updatePrompt(){
    const goal=run?.inspiration?{id:run.inspiration}:growthGoal(resources.state,{cargo:run?.collectedElements??{}}),record=goal.id?resources.record(goal.id):null,cost=goal.id&&resources.costFor(goal.id),withCargo=el=>(resources.state.elements[el]??0)+(run?.collectedElements[el]??0);
    const affordable=cost&&Object.entries(cost).every(([el,n])=>withCargo(el)>=n);
    q('craft-resource-hint').textContent='';
    const goalAction=q('cho-goal-action');goalAction.hidden=!goal.id;q('cho-goal-label').textContent=goal.id?formula(goal.id):'';goalAction.setAttribute('aria-label',goal.id?`${formula(goal.id)}をクラフト`:'');renderCraftTargetAtoms(q('cho-goal-atoms'),record,[],{size:26});
    const ready=active&&goal.id&&!has(goal.id)&&affordable&&(resources.state.hints.includes(goal.id)||run?.carriedInsights?.includes(goal.id));
    q('veil-craft-prompt').hidden=!ready;if(ready){const label=record?.formula??'◉';q('veil-to-craft-label').textContent=label;q('veil-to-craft').setAttribute('aria-label',`${label}をクラフトするため戻る`);renderCraftTargetAtoms(q('veil-to-craft-atoms'),record,[],{size:24});}else q('veil-to-craft-atoms')?.replaceChildren();
  }
  function notice(text,seconds=4,icon='✦'){q('veil-message').setAttribute('aria-label',text);q('veil-message').textContent=icon;messageUntil=(run?.time??0)+seconds;q('veil-message').hidden=false;}
  function handleInsight(event){
    if(!event||!run)return false;
    if(event.type==='insightAnalysisStart'){insightPresentation.sync(run);return true;}
    if(event.type==='insightReady'){if(!run.inspiration||performanceFor(event.id,'fuel')||performanceFor(event.id,'coolant'))run.inspiration=event.id;updatePrompt();insightPresentation.ready(event,run);insightPresentation.sync(run);return true;}
    return false;
  }
  function currentInsightExcludeIds(){const ids=new Set(run?.carriedInsights??[]);if(run?.analysis?.id)ids.add(run.analysis.id);return ids;}
  function syncInsightMarkers(){if(!run)return null;const excludeIds=currentInsightExcludeIds();return syncFieldInsightMarkerClaimability(run,signal=>resources.signalClaimability(signal.region,signal.roll,signal.choice,{excludeIds,runContext:run}));}
  function offerInsight(id){if(!resources.insightRecipeEligible(id,{runContext:run}))return false;return handleInsight(triggerInsight(run,id,resources.state));}
  function offerProgressionInsights(){if(!run)return;const ids=resources.progressionInsightCandidates({cargo:run.collectedElements,foundElements:run.foundElements}).filter(id=>!run.carriedInsights.includes(id)&&run.analysis?.id!==id);if(ids.length)resources.suppressFrontierInsightForCritical();for(const id of ids)offerInsight(id);}
  function stopCombustion(){if(run)setCombustionHeld(run,false);const id=drivePointer;drivePointer=null;if(id!==null)try{combustionButton.releasePointerCapture(id);}catch{}combustionButton.classList.remove('driving');}
  function resetInput(){stick.x=stick.y=0;keys.clear();stopCombustion();const id=pointer;pointer=null;if(id!==null)try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}
  function positionAt(id){const at=REGIONS[id]??REGIONS.veil;run.player.x=at.x;run.player.y=at.y;run.player.angle=at.angle;run.player.vx=run.player.vy=0;run.player.trail=[];run.region=id;}
  function initializeExploreLaunch(prepared,nextRun){
    run=nextRun;positionAt(prepared.start);thermalNotice=null;thermalNoticeUntil=0;insightPresentation.clear();
    active=true;paused=false;anchorLock=null;returnState=null;root.hidden=false;document.body.dataset.mode='veil';appShell.inert=true;
    renderer??=createVeilRenderer(canvas);renderer.resize();renderer.reset();
    resetInput();q('veil-resume').hidden=true;audio.mute(resources.state.progress.sound===false);audio.start();supply.clearAnnouncement();offerProgressionInsights();syncInsightMarkers();
    const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,propellant=run.fuel.propellant;
    const first=prepared.nextRun===1?'採集殻を展開 · ANCHOR RETURNで回収':fuel.molecule&&oxidizer.molecule?'COMBUSTION DRIVE · 長押しで継続航行':propellant.molecule?`${formula(propellant.molecule)} BURST · ANCHOR LOCK前の緊急離脱に残そう`:'通常航行で塵を集め、H₂の材料を持ち帰ろう';
    notice(first,5);root.focus();last=0;hudAt=0;treatmentSavedRevision=run.treatmentRevision;treatmentPersistAt=run.time;hud();updatePrompt();return true;
  }
  function rollbackLaunchTransaction({checkpoint,error}){
    if(raf)try{cancelAnimationFrame(raf);}catch{}raf=0;
    try{resetInput();}catch{}
    try{audio.pause();}catch{}
    try{renderer?.reset();}catch{}
    insightPresentation.clear();restoreLaunchRollbackState(resources,checkpoint.resources);
    active=false;paused=false;run=null;anchorLock=null;returnState=null;pendingCraftId=null;last=0;hudAt=0;messageUntil=0;thermalNotice=null;thermalNoticeUntil=0;
    root.hidden=true;q('veil-resume').hidden=true;document.body.dataset.mode='craft';appShell.inert=false;supply.clearAnnouncement();updateCraft();
    const status=q('craft-resource-hint');if(status)status.textContent='探索画面を開始できません。LOADOUTに戻りました。再度出発してください。';
    console.error('Expedition launch transaction failed and was rolled back.',error);return true;
  }
  function finish(captured=false){
    if(!active||!run)return;active=false;cancelAnimationFrame(raf);raf=0;resetInput();audio.pause();
    const completed=run,result=resources.settleExpedition(completed.elementDust,completed.best,captured,{destinationReached:completed.destinationReached,insights:captured?[]:completed.carriedInsights});lastTelemetry=completeExpeditionTelemetry(completed,{captured,result});logExpeditionTelemetry(lastTelemetry);discardRunInsights(completed);insightPresentation.clear();root.hidden=true;document.body.dataset.mode='craft';appShell.inert=false;
    const seconds=Math.round(completed.time),parts=result?Object.entries(result.atoms).filter(([,n])=>n).map(([el,n])=>`${el} +${n}`).join(' · '):'';
    q('craft-last-run').textContent=result?`${result.worldAwakenedNow?'WORLD AWAKENED · ':''}${result.completedNow?'◎ CHO ✓ · ':''}${captured?'⚠':'↩'} ${parts||'—'} · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'帰還しましたが、探索物を保存できませんでした。';
    const pending=pendingCraftId;pendingCraftId=null;run=null;anchorLock=null;returnState=null;thermalNotice=null;thermalNoticeUntil=0;onCraft();updateCraft();q('open-supply')?.focus();if(pending)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:pending,source:'field'}}));
  }
  function beginReturn(captured=false){
    if(!active||!run||paused||returnState)return false;
    if(captured){
      const lossSnapshot={lost:expeditionLoss(run.elementDust,EXPEDITION.captureLoss),insights:runInsightLossSnapshot(run)};
      resetInput();anchorLock=null;const duration=renderer.beginForcedReturn(run,lossSnapshot);if(!duration)return false;
      discardRunInsights(run);insightPresentation.clear();returnState={captured:true,duration,elapsed:0,lossSnapshot};audio.start();hud();return true;
    }
    if(anchorLock||run.captured)return false;discardActiveInsight(run);insightPresentation.sync(run);resetInput();renderer.beginReturn(run,'stable');anchorLock={duration:EXPEDITION.anchorLockSeconds,elapsed:0};audio.start();audio.event('returnSafe');notice('ANCHOR LOCK · 保持場を安定収縮',1);hud();
    return true;
  }
  function burst(){
    if(!active||paused||anchorLock||returnState||run.captured)return;audio.start();
    if(beginBurst(run,()=>resources.consumeBoost())){audio.event('burst');vibrate(22);hud();return;}
    const slot=run.fuel.propellant,performance=performanceFor(slot.molecule,'propellant'),label=formula(slot.molecule)??'噴射剤';
    if(run.player.boost<=0)notice(!slot.molecule?'噴射剤を搭載すると緊急噴射が使える':slot.amount<(performance?.moleculesPerBurst??Infinity)?`搭載した${label}ではBURSTできない · 帰還して補給しよう`:`${label}が不足している`,2);
  }
  function shock(){
    if(!active||paused||anchorLock||returnState||run.captured)return false;const core=run.map?.nitrogenCore,nearIntactCore=!!core&&!core.fractured&&Math.hypot(run.player.x-core.x,run.player.y-core.y)<=core.fractureRadius;audio.start();const event=beginShock(run,(material,amount)=>resources.consumeTank('shock',material,amount));
    if(event){shockButton.classList.add('shocking');setTimeout(()=>shockButton.classList.remove('shocking'),180);vibrate(event.material==='2-4-6-trinitrotoluene'?30:18);if(event.coreFractured){const world=resources.recordCoreFracture();notice(world?'CORE FRACTURED · WORLD AWAKENING PENDING · 安全帰還で確定':'CORE FRACTURED · 保存を確認して帰還',4,'◉');}hud();return true;}
    const slot=run.fuel.shock;if(nearIntactCore)notice('CORE intact · SHOCK CHARGEが必要 · ANCHOR RETURNで帰還可能',3,'○');else if(slot?.molecule&&slot.amount<=0)notice('SHOCK CHARGE EMPTY · 帰還して補給',2,'○');return false;
  }
  function startCombustion(event=null){
    if(!active||paused||anchorLock||returnState||run.captured)return;const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,charge=oxidizer.molecule==='oxygen'?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null;
    if(!charge&&run.driveBuffer<=0){notice('燃焼に必要な燃料またはO₂が不足 · 帰還して再出発しよう',2);return;}
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
    q('veil-minerals').textContent=['C','N','O',...RARE_ECOLOGY_ELEMENTS].map(el=>[el,run.collectedElements[el]??0]).filter(([el])=>resources.canUseElement(el)||run.foundElements.includes(el)).map(([el,n])=>`${el} ${n}`).join(' · ');
    const treatments=q('veil-treatments');let treatmentCount=0;for(const id of HAZARD_TREATMENT_IDS){const row=treatments?.querySelector(`[data-treatment="${id}"]`),charge=Math.max(0,Math.min(1,run.treatments?.[id]??0));if(!row)continue;row.hidden=charge<=0;if(charge<=0)continue;treatmentCount++;row.querySelector('em').style.transform=`scaleX(${charge})`;row.querySelector('small').textContent=`${Math.ceil(charge*100)}%`;row.setAttribute('aria-label',`${HAZARD_TREATMENTS[id].label} treatment ${Math.ceil(charge*100)}%`);}if(treatments)treatments.hidden=treatmentCount===0;
    q('veil-chain').textContent=run.chain;q('veil-chain-block').dataset.fever=String(run.chain>=40);q('veil-chain-meter').style.transform=`scaleX(${Math.max(0,run.chainTime/run.config.chainSeconds)})`;
    const propellant=run.fuel.propellant,burstPerformance=performanceFor(propellant.molecule,'propellant'),burstGauge=propulsionGauge('hydrogen',run.fuel),boostButton=q('veil-boost');boostButton.querySelector('strong').textContent=propellant.molecule?formula(propellant.molecule):'—';q('veil-fuel').textContent='';q('veil-boost').setAttribute('aria-description',`残り噴射 ${burstGauge.remaining}回`);q('veil-burst-meter').style.transform=`scaleX(${burstGauge.ratio})`;boostButton.dataset.fuelState=burstGauge.state;boostButton.classList.toggle('boosting',run.player.boost>0);boostButton.setAttribute('aria-disabled',String(!propellant.molecule||propellant.amount<(burstPerformance?.moleculesPerBurst??Infinity)||run.player.cooldown>0));
    const shockSlot=run.fuel.shock,shockPerformance=performanceFor(shockSlot.molecule,'shock'),shockCapacity=shockSlot.capacity||shockPerformance?.capacity||0;shockButton.hidden=!shockSlot.molecule;shockButton.querySelector('strong').textContent=shockSlot.molecule?formula(shockSlot.molecule):'—';q('veil-shock-count').textContent=`${shockSlot.amount} / ${shockCapacity}`;shockButton.dataset.material=shockSlot.molecule??'';shockButton.setAttribute('aria-disabled',String(!shockSlot.molecule||shockSlot.amount<1));shockButton.setAttribute('aria-description',shockSlot.molecule?`${formula(shockSlot.molecule)} pressure pulse。残り${shockSlot.amount}回`:'SHOCK charge未搭載');
    const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds}),combustion=!!packet&&oxidizer.molecule==='oxygen',charge=combustion?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null,canBurn=!!charge,combustionGauge=propulsionGauge('combustion',run.fuel,run.driveBuffer);combustionButton.hidden=!combustion;combustionButton.querySelector('strong').textContent=`${fuel.molecule?formula(fuel.molecule):'FUEL'} + ${oxidizer.molecule?formula(oxidizer.molecule):'O₂'}`;combustionButton.dataset.fuelState=combustionGauge.state;combustionButton.classList.toggle('driving',run.player.combustion);combustionButton.setAttribute('aria-pressed',String(run.player.combustion));combustionButton.setAttribute('aria-disabled',String(!combustion||run.overheated||!canBurn&&run.driveBuffer<=0));q('veil-combustion-remaining').textContent='HOLD DRIVE';q('veil-combustion-meter').style.transform=`scaleX(${combustionGauge.ratio})`;for(const role of ['fuel','oxidizer']){const slot=run.fuel[role],node=q('veil-combustion-fuel').querySelector(`[data-role=${role}]`),capacity=slot.capacity||performanceFor(slot.molecule,role)?.capacity||1;node.querySelector('b').textContent=slot.molecule?formula(slot.molecule):'—';node.setAttribute('role','meter');node.setAttribute('aria-label',role==='fuel'?'燃料':'酸化剤');node.setAttribute('aria-valuemin','0');node.setAttribute('aria-valuemax',String(capacity));node.setAttribute('aria-valuenow',String(slot.amount));node.querySelector('em').style.transform=`scaleY(${slot.amount/capacity})`;}
    const thermalState=run.overheated?'overheat':run.coolantActive?'cooling':run.heat>=THERMAL.hotThreshold?'hot':'normal',thermalLabels={normal:'通常',cooling:'自動冷却中',hot:'高温',overheat:'過熱停止'},thermalIndicators={normal:'',cooling:'❄ COOLING',hot:'♨ HOT',overheat:'♨ OVERHEAT'},heatRatio=Math.max(0,Math.min(1,run.heat/THERMAL.overheatThreshold)),thermalHue=Math.round(190-185*heatRatio),outputMax=propulsionSpeedMax(run.config),output=Math.max(0,run.player.speed),outputRatio=outputMax?Math.max(0,Math.min(1,output/outputMax)):0,activeThermalNotice=thermalNotice&&run.time<thermalNoticeUntil;thermal.hidden=false;thermal.dataset.state=thermalState;thermal.style.setProperty('--thermal-hue',String(thermalHue));thermal.style.setProperty('--thermal-intensity',heatRatio.toFixed(3));q('veil-thermal-state').textContent=thermalState==='overheat'?thermalIndicators.overheat:activeThermalNotice?thermalNotice:thermalIndicators[thermalState];q('veil-heat').textContent='OUTPUT';thermal.setAttribute('aria-label',`熱状態 ${thermalLabels[thermalState]}。熱 ${Math.round(run.heat)}%。`);if(outputMeter){const percent=Math.round(outputRatio*100);outputMeter.setAttribute('aria-valuenow',String(percent));outputMeter.setAttribute('aria-valuetext',`${percent}%`);}if(outputMeterFill)outputMeterFill.style.transform=`scaleX(${outputRatio})`;
    q('veil-region-name').textContent=region.name;q('veil-region-subtitle').textContent='';
    q('veil-goal').dataset.reached=String(run.destinationReached);q('veil-goal').textContent=run.destinationReached?'◎ ✓ → ↩':'';q('veil-return').classList.toggle('destination-ready',run.destinationReached);
    const threat=q('veil-threat');threat.hidden=!run.eaters.length;if(run.eaters.length){q('veil-eater-count').textContent=run.eaters.length;q('veil-eater-distance').textContent=Number.isFinite(run.nearestEater)?`最接近 ${Math.round(run.nearestEater)}`:'追跡中';q('veil-threat-meter').style.transform=`scaleX(${Math.max(0,Math.min(1,1-run.nearestEater/EXPEDITION.eaterWarningRadius))})`;threat.dataset.level=run.danger;}
    q('veil-sound').setAttribute('aria-pressed',String(state.progress.sound!==false));returnHud();
  }
  function signalText(result){
    if(!result)return '未知信号は消えた';if(result.repeat)return 'この流れの信号は、しばらく静かだ';
    if(result.recipe)return '未知分子の構造信号を捕捉\n構造解析を開始';
    return `未知信号から塵がほどけた · ${Object.entries(result.bonus).map(([el,n])=>`${el} +${n}`).join(' · ')}`;
  }
  function frame(now){
    if(!active)return;raf=requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.15):0;last=now;if(paused||document.hidden)return;
    if(returnState){if(returnState.captured)stepRun(run,{x:0,y:0},dt);returnState.elapsed=Math.min(returnState.duration,returnState.elapsed+dt);audio.update(run.player.speed,run.chain,null);renderer.draw(run,dt,reduced);returnHud();if(returnState.elapsed>=returnState.duration)finish(returnState.captured);return;}
    const input=anchorLock?{x:0,y:0}:{x:stick.x+(keys.has('ArrowRight')||keys.has('d')?1:0)-(keys.has('ArrowLeft')||keys.has('a')?1:0),y:stick.y+(keys.has('ArrowDown')||keys.has('s')?1:0)-(keys.has('ArrowUp')||keys.has('w')?1:0)};
    syncInsightMarkers();const frameEvents=stepRun(run,input,dt,{consumeCombustion:packet=>resources.consumeCombustion(packet),consumeCoolant:(amount,molecule)=>resources.consumeTank('coolant',molecule,amount)});if(run.treatmentRevision!==treatmentSavedRevision&&run.time-treatmentPersistAt>=2&&resources.save()){treatmentSavedRevision=run.treatmentRevision;treatmentPersistAt=run.time;}for(const event of frameEvents){
      if(event.type!=='insightReady'&&(event.type!=='danger'||event.level!=='clear'))audio.event(event.type,event.chain,event.count);
      if(event.type==='pickup'){offerProgressionInsights();updatePrompt();}
      if(event.type==='choDestination'){notice('CHOの最深部に到達 · 帰還ボタンで記録を持ち帰ろう',8,'◎ ✓ ↩');vibrate(35);}
      if(event.type==='oxygenJunction')notice('酸素の分岐',6,'↖ ↑ ↗');
      if(event.type==='element'){
        const first=resources.findElementForExpedition(event.element);offerProgressionInsights();if(first&&event.element!=='H'){const rare=RARE_ECOLOGY_ELEMENTS.includes(event.element),message=event.element==='C'?'Cを発見 · 点の列ではなく、炭素塊へ飛び込もう':event.element==='N'?'Nを発見 · Nitrogen FIELDの主要資源を回収した':event.element==='O'?'Oを発見 · CH₄と組み合わせる酸化剤が作れる':rare?`${event.element} trace resourceを発見`:`${event.element}を発見`;notice(message,rare?3:5);vibrate(rare?16:24);resources.save();}updatePrompt();
      }
      if(event.type==='dense')vibrate(10);
      if(event.type==='cluster'){notice('炭素塊がほどけた · 散るC塵をまとめて吸おう',2.5);vibrate(18);}
      if(event.type==='rare'){resources.state.progress.special='pure-h';notice(`高純度H塵 +${VEIL.rareValue}`,3);vibrate(16);}
      if(event.type==='gate'){resources.state.progress.cleared=true;run.gateTime=run.time;resources.save();notice('Hの帳を抜けた · BURSTを使うべき瞬間だった',4);}
      if(event.type==='region'){const first=resources.visit(event.region);if(first)notice(event.region==='carbon'?'CARBON DRIFT · 粒子列の先に、塊が脈打つ':event.region==='oxygen'?'OXYGEN SURGE · 高速流と熱の領域':event.region==='frontier'?'INNER HORIZON · 金色の輪が最終地点。到達後は正常帰還を':`${REGIONS[event.region].name}へ戻った`,6);resources.save();}
      if(event.type==='inspiration')for(const id of event.rewards)offerInsight(id);
      if(event.type==='signal'){const excludeIds=currentInsightExcludeIds(),result=resources.signal(event.region,event.roll,event.choice,{excludeIds,runContext:run,claimableOnly:true});if(!result?.deferred)notice(signalText(result),result?.recipe?3:3);if(result?.recipe)offerInsight(result.recipe);supply.update();}
      if(event.type==='insightReady')handleInsight(event);
      if(event.type==='lap')notice('流れをひと巡り · 保持場への干渉は下がらない',3);
      if(event.type==='eaterSpawn'){notice(event.count===1?'DUST EATER · 採集殻の保持場を崩す粒子現象':`DUST EATERS × ${event.count} · 保持場が破綻する前にANCHOR RETURNを`,4);vibrate(18);}
      if(event.type==='danger'&&event.level==='warning')notice('保持場への干渉が近い · H₂ BURSTで距離を作るか帰還',3,'⚠');
      if(event.type==='danger'&&event.level==='danger'){notice('保持場の破綻間近 · H₂ BURST',2,'⚠');vibrate(28);}
      if(event.type==='coreApproach'){notice(event.shockAvailable?'CORE · SHOCK 1 CHARGEでfracture':'CORE intact · SHOCK CHARGEが必要 · ANCHOR RETURNで安全に帰還可能',4,event.shockAvailable?'◉':'○');vibrate(event.shockAvailable?20:10);}
      if(event.type==='driveIgnition'){hud();vibrate(12);}
      if(event.type==='driveEmpty'){notice('COMBUSTION DRIVEの燃焼可能分を使い切った',2);stopCombustion();}
      if(event.type==='thermalStrain'){resources.recordThermalStrain();updatePrompt();}
      if(event.type==='coolantNeed'){resources.recordCoolantNeedExperience();offerProgressionInsights();updatePrompt();notice('THERMAL LIMIT · 冷却なしでは高熱流で連続燃焼できない',2.5,'♨');}
      if(event.type==='coolantStart'){notice(`AUTO COOLING · ${formula(event.molecule)}`,1.5,'❄ → ♨');vibrate(8);}
      if(event.type==='coolantEmpty'){thermalNotice='❄ EMPTY';thermalNoticeUntil=run.time+2.5;hud();notice('冷却剤が空になった · 燃焼熱に注意',2.5,'❄ ∅');vibrate(14);}
      if(event.type==='overheat'){if(event.driveInterrupted){resources.recordDriveThermalInterruption();offerProgressionInsights();updatePrompt();}notice('OVERHEAT · 安全温度まで燃焼停止',2.5,'♨ !');vibrate(38);}
      if(event.type==='heatRecovered'){notice(run.driveHeld?'THERMAL READY · 燃焼を自動再開':'THERMAL READY',1.5);vibrate(10);}
      if(event.type==='treatmentExpired'){const label=HAZARD_TREATMENTS[event.id]?.label??'HAZARD';notice(`${label} TREATMENT · EXPIRED`,2,'△');vibrate(12);hud();}
      if(event.type==='capture'){beginReturn(true);vibrate(55);}
    }
    if(!run.captured){
      offerProgressionInsights();const deferredFrontier=resources.pollFrontierInsight(run);if(deferredFrontier?.recipe)offerInsight(deferredFrontier.recipe);
      insightPresentation.sync(run);syncInsightMarkers();
    }
    const lockComplete=!!anchorLock&&(anchorLock.elapsed=Math.min(anchorLock.duration,anchorLock.elapsed+dt))>=anchorLock.duration;
    if(run.time>messageUntil)q('veil-message').hidden=true;
    const propulsion=run.player.boost>0?'burst':run.player.combustion?'combustion':null;audio.update(run.player.speed,run.chain,propulsion);renderer.draw(run,dt,reduced);
    if(anchorLock||now-hudAt>70){hudAt=now;hud();}if(lockComplete)finish(false);
  }
  q('cho-goal-action').addEventListener('click',()=>{const goal=growthGoal(resources.state);if(goal.id)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:goal.id}}));});
  q('veil-return').addEventListener('click',()=>beginReturn(false));q('veil-to-craft').addEventListener('click',()=>{const goal=run?.inspiration?{id:run.inspiration}:growthGoal(resources.state,{cargo:run?.collectedElements??{}}),id=goal.id??null;if(id&&beginReturn(false))pendingCraftId=id;});
  q('veil-boost').addEventListener('pointerdown',event=>{event.preventDefault();burst();});q('veil-boost').addEventListener('click',event=>{if(event.detail===0)burst();});shockButton.addEventListener('pointerdown',event=>{event.preventDefault();shock();});shockButton.addEventListener('click',event=>{if(event.detail===0)shock();});
  combustionButton.addEventListener('pointerdown',startCombustion);for(const type of ['pointerup','pointercancel','lostpointercapture'])combustionButton.addEventListener(type,event=>{if(drivePointer===null||event.pointerId===drivePointer)stopCombustion();});
  q('veil-sound').addEventListener('click',()=>{resources.state.progress.sound=resources.state.progress.sound===false;audio.mute(!resources.state.progress.sound);audio.start();resources.save();hud();});
  pad.addEventListener('pointerdown',event=>{if(pointer!==null||paused||anchorLock||returnState)return;event.preventDefault();pointer=event.pointerId;const r=pad.getBoundingClientRect();origin={x:r.left+r.width/2,y:r.top+r.height/2};try{pad.setPointerCapture(pointer);}catch{}audio.start();move(event);});
  function move(event){if(event.pointerId!==pointer||!origin)return;const dx=event.clientX-origin.x,dy=event.clientY-origin.y,len=Math.hypot(dx,dy),radius=48;stick.x=len>6?dx/Math.max(radius,len):0;stick.y=len>6?dy/Math.max(radius,len):0;knob.style.transform=`translate(${stick.x*34}px,${stick.y*34}px)`;}
  pad.addEventListener('pointermove',move);for(const type of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(type,event=>{if(event.pointerId===pointer){stick.x=stick.y=0;const id=pointer;pointer=null;try{pad.releasePointerCapture(id);}catch{}origin=null;knob.style.transform='translate(0px,0px)';}});
  window.addEventListener('keydown',event=>{if(!active||paused||anchorLock||returnState)return;if(event.key===' '&&event.target.closest?.('button'))return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d',' ','Shift','e','E'].includes(event.key)){event.preventDefault();if(event.key===' '){if(!event.repeat)burst();}else if(event.key==='Shift')startCombustion();else if(event.key==='e'||event.key==='E'){if(!event.repeat)shock();}else keys.add(event.key);audio.start();}if(event.key==='Escape')beginReturn(false);});
  window.addEventListener('keyup',event=>{keys.delete(event.key);if(event.key==='Shift')stopCombustion();});
  function pause(){if(!active)return;resetInput();paused=true;audio.pause();resources.save();q('veil-resume').hidden=false;}
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();last=0;});
  window.addEventListener('pagehide',()=>{resources.save();audio.pause();});window.addEventListener('storage',event=>{if(event.key==='molecule-craft.resources.v1'){pause();resources.save();updateCraft();}});
  q('veil-resume').addEventListener('click',()=>{if(resources.blocked)return;paused=false;last=0;q('veil-resume').hidden=true;audio.start();root.focus();});
  new ResizeObserver(()=>renderer?.resize()).observe(root);updateCraft();
  return {get active(){return active;},get run(){return run;},get returning(){return returnState?'emergency':anchorLock?'locking':null;},get anchorLock(){return anchorLock?{...anchorLock}:null;},get lastTelemetry(){return lastTelemetry;},updateCraft,requestExpeditionLaunch,pause,openSupply:(id,use)=>supply.openMolecule(id,use),discovered:id=>supply.discovered(id),usesFor:id=>supply.usesFor(id),tankStatus:(use,id)=>supply.tankStatus(use,id),fillPlan:(use,id)=>supply.fillPlan(use,id),commitFill:(use,id,count)=>supply.commitFill(use,id,count)};
}
