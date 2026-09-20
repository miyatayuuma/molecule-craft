import {combustionBurnPlanFor,performanceFor} from './molecule-roles.js';
import {OXYGEN_UPGRADES,oxygenCapacity} from './tank-upgrades.js';
import {installLoadoutWorkstation} from './loadout-workstation.js';

installLoadoutWorkstation();

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));

export function propellantPreviewValues(id,{amount=null}={}){
  const performance=performanceFor(id,'propellant');
  if(!performance)return null;
  const available=amount==null?performance.capacity:Math.max(0,amount);
  return Object.freeze({burstPower:performance.burstPower,burstVisual:clamp01(performance.burstPower),shots:Math.floor(available/performance.moleculesPerBurst),fullShots:Math.floor(performance.capacity/performance.moleculesPerBurst)});
}

export function fuelPreviewValues(id,{fuelAmount=null,oxygenAmount=0,coolantId=null}={}){
  const fuel=performanceFor(id,'fuel');if(!fuel)return null;const coolant=performanceFor(coolantId,'coolant'),amount=fuelAmount==null?fuel.capacity:fuelAmount,burnPlan=combustionBurnPlanFor(id,{fuelAmount:amount,oxygenAmount}),limitingSeconds=burnPlan.seconds,coolingRelief=coolant?clamp01(coolant.coolingPower*.22*coolant.environmentTolerance):0,heatRise=clamp01(.18+fuel.heatFactor*.46-coolingRelief*.34);
  return Object.freeze({response:fuel.response,responseVisual:clamp01((fuel.response-.45)/1.2),endurance:clamp01(limitingSeconds/60),thermalMargin:clamp01(1-heatRise),limitingSeconds,oxygenLimited:burnPlan.fuelRemaining>0});
}

export function oxidizerPreviewValues(id,{capacity,level,nextCapacity=null}={}){
  if(!performanceFor(id,'oxidizer')||!Number.isInteger(level)||level<0||level>OXYGEN_UPGRADES.length||!Number.isInteger(capacity)||capacity!==oxygenCapacity(level))return null;
  const expectedNext=OXYGEN_UPGRADES[level]?.capacity??null;if(nextCapacity!==expectedNext)return null;
  const stages=Array.from({length:OXYGEN_UPGRADES.length+1},(_,index)=>Object.freeze({capacity:oxygenCapacity(index),state:index<level?'complete':index===level?'current':index===level+1&&nextCapacity!==null?'next':'upcoming'}));
  return Object.freeze({capacity,level,nextCapacity,isMax:nextCapacity===null,stages:Object.freeze(stages)});
}
export function coolantPreviewValues(id){const coolant=performanceFor(id,'coolant');if(!coolant)return null;return Object.freeze({cooling:clamp01(coolant.coolingPower/1.9),endurance:clamp01(coolant.durationFactor/3.2),thermalMargin:clamp01(coolant.environmentTolerance/1.75),coolingPower:coolant.coolingPower,durationFactor:coolant.durationFactor,environmentTolerance:coolant.environmentTolerance});}
export function shockPreviewValues(id){const shock=performanceFor(id,'shock');if(!shock)return null;return Object.freeze({charges:shock.capacity,range:clamp01(shock.radiusScale/1.45),repel:clamp01(shock.knockbackScale/1.6),interrupt:clamp01(shock.interruptScale/1.45),radiusScale:shock.radiusScale,knockbackScale:shock.knockbackScale,interruptScale:shock.interruptScale});}
export function loadoutPreviewValues(use,id,context={}){if(use==='propellant')return propellantPreviewValues(id,{amount:context.amount});if(use==='fuel')return fuelPreviewValues(id,{fuelAmount:context.amount,oxygenAmount:context.oxygenAmount,coolantId:context.coolantId});if(use==='oxidizer')return oxidizerPreviewValues(id,context.oxygenTankCapacity);if(use==='coolant')return coolantPreviewValues(id);if(use==='shock')return shockPreviewValues(id);return null;}

function statRow(label,candidate,current=NaN){const row=document.createElement('div');row.className='loadout-stat';const caption=document.createElement('span');caption.textContent=label;const track=document.createElement('i'),fill=document.createElement('b'),marker=document.createElement('em');fill.style.transform=`scaleX(${clamp01(candidate)})`;if(Number.isFinite(current))marker.style.left=`${clamp01(current)*100}%`;else marker.hidden=true;track.append(fill,marker);row.append(caption,track);return row;}
function chargeRow(count,{label='PULSE'}={}){const row=document.createElement('div');row.className='loadout-charges';const caption=document.createElement('span'),dots=document.createElement('div');caption.textContent=label;for(let i=0;i<Math.max(0,count);i++)dots.append(document.createElement('i'));row.append(caption,dots);return row;}
function renderPropellant(host,candidate,current){const stats=document.createElement('div');stats.append(statRow('BURST',candidate.burstVisual,current?.burstVisual));const charges=document.createElement('div');charges.append(chargeRow(candidate.fullShots));host.append(stats,charges);}
function renderFuel(host,candidate,current){const stats=document.createElement('div');stats.append(statRow('加速',candidate.responseVisual,current?.responseVisual),statRow('持続',candidate.endurance,current?.endurance),statRow('熱余裕',candidate.thermalMargin,current?.thermalMargin));host.append(stats);}
function renderOxidizer(host,candidate){
  const panel=document.createElement('section');panel.className='loadout-oxygen-capacity';panel.dataset.capacity=String(candidate.capacity);panel.dataset.level=String(candidate.level);
  const header=document.createElement('header'),label=document.createElement('span'),value=document.createElement('strong');label.textContent='O₂ TANK · CAPACITY';value.textContent=String(candidate.capacity);header.append(label,value);
  const stages=document.createElement('ol');stages.className='loadout-oxygen-stages';
  for(const stage of candidate.stages){const item=document.createElement('li'),number=document.createElement('strong'),state=document.createElement('small');item.dataset.stage=String(stage.capacity);item.dataset.state=stage.state;if(stage.state==='current')item.setAttribute('aria-current','step');number.textContent=String(stage.capacity);state.textContent=stage.state==='complete'?'✓':stage.state==='current'?(candidate.isMax?'MAX':'CURRENT'):stage.state==='next'?'NEXT':'';item.append(number,state);stages.append(item);}
  panel.append(header,stages);
  const next=document.createElement('p');next.className='loadout-oxygen-next';if(candidate.nextCapacity===null){next.dataset.nextCapacity='';next.textContent='MAXIMUM CAPACITY';}else{next.dataset.nextCapacity=String(candidate.nextCapacity);next.textContent=`NEXT ${candidate.capacity} → ${candidate.nextCapacity}  (+${candidate.nextCapacity-candidate.capacity})`;}panel.append(next);host.append(panel);
}
function renderCoolant(host,candidate,current){const stats=document.createElement('div');stats.append(statRow('冷却',candidate.cooling,current?.cooling),statRow('持続',candidate.endurance,current?.endurance),statRow('熱余裕',candidate.thermalMargin,current?.thermalMargin));host.append(stats);}
function renderShock(host,candidate,current){const stats=document.createElement('div');stats.append(statRow('範囲',candidate.range,current?.range),statRow('反発',candidate.repel,current?.repel),statRow('中断',candidate.interrupt,current?.interrupt));const charges=document.createElement('div');charges.append(chargeRow(candidate.charges,{label:'CHARGE'}));const cue=document.createElement('p');cue.className='loadout-role-cue';cue.textContent='急速分解 → PRESSURE PULSE';host.append(stats,charges,cue);}

export function renderLoadoutPreview(host,{use,candidateId,currentId=null,candidateAmount=null,currentAmount=null,oxygenAmount=0,currentOxygenAmount=0,coolantId=null,oxygenTankCapacity=null}={}){host._loadoutPreviewToken?.cancel?.();host._loadoutPreviewToken={cancel(){}};host.replaceChildren();const details=host.closest?.('details');if(details)details.open=true;const context={amount:candidateAmount,oxygenAmount,coolantId,oxygenTankCapacity},candidate=loadoutPreviewValues(use,candidateId,context),current=currentId?loadoutPreviewValues(use,currentId,{...context,amount:currentAmount,oxygenAmount:currentOxygenAmount}):null;if(!candidate){host.hidden=true;return null;}host.hidden=false;host.dataset.previewKind=use;if(use==='propellant')renderPropellant(host,candidate,current);else if(use==='fuel')renderFuel(host,candidate,current);else if(use==='oxidizer')renderOxidizer(host,candidate);else if(use==='coolant')renderCoolant(host,candidate,current);else if(use==='shock')renderShock(host,candidate,current);return {candidate,current};}
