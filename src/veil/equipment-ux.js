import {moleculesForRole,performanceFor} from './molecule-roles.js';

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,value));
const range=(values,value,invert=false)=>{
  const finite=values.filter(Number.isFinite);
  const min=Math.min(...finite),max=Math.max(...finite);
  const ratio=max>min?(value-min)/(max-min):.5;
  return clamp(invert?1-ratio:ratio);
};
const allFor=role=>moleculesForRole(role).map(id=>performanceFor(id,role)).filter(Boolean);
const ratioFromMeter=node=>{
  const now=Number(node?.getAttribute('aria-valuenow')),max=Number(node?.getAttribute('aria-valuemax'));
  return Number.isFinite(now)&&Number.isFinite(max)&&max>0?clamp(now/max):0;
};

export function behaviorProfile(id,role){
  const performance=performanceFor(id,role);if(!performance)return null;
  const all=allFor(role);
  if(role==='fuel'){
    const endurance=performance.capacity*performance.energy/Math.max(.25,performance.oxygenPerFuel);
    return Object.freeze({
      response:range(all.map(p=>p.response),performance.response),
      drive:range(all.map(p=>p.energy*p.response),performance.energy*performance.response),
      endurance:range(all.map(p=>p.capacity*p.energy/Math.max(.25,p.oxygenPerFuel)),endurance),
      heat:range(all.map(p=>p.heatFactor),performance.heatFactor),
      oxygen:range(all.map(p=>p.oxygenPerFuel),performance.oxygenPerFuel),
    });
  }
  if(role==='coolant')return Object.freeze({
    response:range(all.map(p=>p.coolingPower),performance.coolingPower),
    drive:range(all.map(p=>p.coolingPower),performance.coolingPower),
    endurance:range(all.map(p=>p.capacity*p.durationFactor),performance.capacity*performance.durationFactor),
    heat:range(all.map(p=>p.environmentTolerance),performance.environmentTolerance,true),
    tolerance:range(all.map(p=>p.environmentTolerance),performance.environmentTolerance),
  });
  if(role==='propellant'){
    const shots=Math.floor(performance.capacity/performance.moleculesPerBurst);
    return Object.freeze({
      response:1,
      drive:range(all.map(p=>p.burstPower),performance.burstPower),
      endurance:range(all.map(p=>Math.floor(p.capacity/p.moleculesPerBurst)),shots),
      heat:0,
      shots,
    });
  }
  if(role==='oxidizer')return Object.freeze({
    response:.55,
    drive:range(all.map(p=>p.oxidizingPower),performance.oxidizingPower),
    endurance:range(all.map(p=>p.capacity),performance.capacity),
    heat:0,
  });
  return null;
}

export function bottleneckFor(id,role,{oxidizerRatio=1,coolantRatio=1}={}){
  const p=behaviorProfile(id,role);if(!p)return null;
  if(role==='fuel'){
    const heatPressure=p.heat*(1-.55*coolantRatio),oxygenPressure=p.oxygen*(1-.5*oxidizerRatio),rangePressure=1-p.endurance;
    if(heatPressure>=oxygenPressure&&heatPressure>=rangePressure)return {part:'heat',text:'熱が先に限界'};
    if(oxygenPressure>=rangePressure)return {part:'oxygen',text:'O₂が先に限界'};
    return {part:'fuel',text:'航続が先に限界'};
  }
  if(role==='coolant'){
    const durationPressure=1-p.endurance,tolerancePressure=1-(p.tolerance??0),powerPressure=1-p.drive;
    if(tolerancePressure>=durationPressure&&tolerancePressure>=powerPressure)return {part:'heat',text:'高温域が弱点'};
    if(durationPressure>=powerPressure)return {part:'coolant',text:'長時間燃焼が弱点'};
    return {part:'coolant',text:'急加熱が弱点'};
  }
  if(role==='propellant')return p.drive<.48?{part:'burst',text:'強流が弱点'}:p.endurance<.48?{part:'burst',text:'連続噴射が弱点'}:{part:'burst',text:'一噴射を活かす'};
  if(role==='oxidizer')return {part:'oxygen',text:'燃料との釣合い'};
  return null;
}

const STYLES=`
#supply-dialog .tank-explanation{display:none}
.mc-behavior-preview{display:grid;gap:9px;padding:9px;border:1px solid #31505f;border-radius:13px;background:linear-gradient(160deg,#0b2130,#091823);min-height:106px;overflow:hidden}
.mc-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.mc-preview-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:#d6edf4}.mc-preview-limit{display:flex;align-items:center;gap:5px;flex:none;color:#9cb9c5;font-size:8px;white-space:nowrap}.mc-preview-limit:before{content:'';width:7px;height:7px;border-radius:50%;background:#7395a3;box-shadow:0 0 7px #7395a355}.mc-preview-limit[data-part=heat]:before{background:#dc865f;box-shadow:0 0 8px #dc865f66}.mc-preview-limit[data-part=oxygen]:before{background:#8dbcf4;box-shadow:0 0 8px #8dbcf466}.mc-preview-limit[data-part=coolant]:before{background:#87d8cf;box-shadow:0 0 8px #87d8cf66}.mc-preview-limit[data-part=burst]:before{background:#8fdced;box-shadow:0 0 8px #8fdced66}
.mc-flight-compare{position:relative;height:50px;border-radius:10px;background:linear-gradient(90deg,#102735 0 12%,#153344 12% 13%,#0c1c28 13% 100%);overflow:hidden}.mc-flight-compare:after{content:'';position:absolute;left:12%;right:7%;top:50%;height:1px;background:linear-gradient(90deg,#41647555,#41647520)}.mc-run{position:absolute;left:8%;top:50%;width:15px;height:9px;border:1px solid currentColor;border-radius:60% 48% 48% 60%;transform:translateY(-50%);z-index:2}.mc-run:after{content:'';position:absolute;right:100%;top:3px;width:10px;height:2px;background:currentColor;opacity:.55}.mc-run.current{color:#6e8996;opacity:.55;animation:mc-current var(--current-time,1.45s) ease-out infinite}.mc-run.candidate{color:#bceefa;box-shadow:0 0 var(--candidate-glow,5px) rgba(238,130,84,var(--candidate-heat));animation:mc-candidate var(--candidate-time,1.2s) ease-out infinite}.mc-run.candidate:after{width:var(--candidate-tail,10px);opacity:var(--candidate-tail-opacity,.7)}.mc-preview-legend{position:absolute;right:5px;top:4px;display:flex;gap:8px;color:#698895;font-size:7px}.mc-preview-legend span{display:flex;align-items:center;gap:3px}.mc-preview-legend i{display:block;width:8px;height:1px;background:#6e8996}.mc-preview-legend .candidate i{background:#bceefa;box-shadow:0 0 4px #bceefa55}.mc-preview-cells{display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px}.mc-preview-cell{position:relative;height:17px;border:1px solid #294756;border-radius:6px;background:#0b1924;overflow:hidden}.mc-preview-cell:before{content:attr(data-label);position:absolute;inset:0;display:grid;place-items:center;font-size:7px;letter-spacing:.4px;color:#89a9b7;z-index:2}.mc-preview-cell i{position:absolute;inset:auto 0 0;height:100%;transform:scaleX(var(--level));transform-origin:left;background:linear-gradient(90deg,#1b5265,#4fa8bd55);opacity:.5}.mc-preview-cell.load i{background:linear-gradient(90deg,#76412d,#d071454d)}
@keyframes mc-current{0%{left:8%}75%,100%{left:var(--current-travel,72%)}}@keyframes mc-candidate{0%{left:8%}75%,100%{left:var(--candidate-travel,78%)}}
@media(prefers-reduced-motion:reduce){.mc-run.current,.mc-run.candidate{animation:none}.mc-run.current{left:var(--current-travel,72%)}.mc-run.candidate{left:var(--candidate-travel,78%)}}
@media(max-width:370px){.mc-behavior-preview{padding:8px;gap:7px}.mc-preview-head strong{font-size:9px}.mc-flight-compare{height:44px}.mc-preview-limit{font-size:7px}}
/* Flight HUD: keep the meaningful physical stores, remove duplicate abstract bars. */
#veil-combustion>.propulsion-meter,.veil-thermal>i{display:none!important}#veil-combustion{min-height:66px!important}.veil-thermal{padding:5px 8px!important;opacity:.52;transition:opacity .15s ease,border-color .15s ease,box-shadow .15s ease}.veil-thermal[data-state=hot],.veil-thermal[data-state=cooling],.veil-thermal[data-state=overheat]{opacity:1}.veil-thermal>span{justify-content:center!important}.veil-thermal small{text-align:center}.paired-tanks i{height:31px!important}.combustion-link{width:24px;height:24px;display:grid!important;place-items:center;border-radius:50%;background:#241d1a;transition:box-shadow .15s ease,background .15s ease}.driving .combustion-link{background:#4b281d!important;box-shadow:0 0 16px #ef894d88!important}.veil-thermal[data-state=hot]+#veil-combustion .combustion-link,.veil-thermal[data-state=overheat]+#veil-combustion .combustion-link{box-shadow:0 0 16px #e9744f88}.veil-thermal[data-state=cooling]{background:linear-gradient(90deg,#0a1b28c7,#123330c7,#0a1b28c7)}
@media(prefers-reduced-motion:reduce){.veil-thermal,.combustion-link{transition:none}}
`;

function activeRole(){
  const node=document.querySelector('#supply-dialog .shell-port[data-active=true]');return node?.dataset.tankRole??null;
}
function profileVars(profile){
  if(!profile)return {};
  const drive=profile.drive??.5,heat=profile.heat??0;
  return {
    travel:`${Math.round(48+profile.endurance*40)}%`,
    time:`${(1.65-profile.response*.65).toFixed(2)}s`,
    drive:String(drive),
    heat:String(heat),
    glow:`${Math.round(3+heat*10)}px`,
    tail:`${Math.round(7+drive*13)}px`,
    tailOpacity:String(.45+drive*.5),
  };
}
function labelsFor(role){
  if(role==='fuel')return ['応答','航続','熱'];
  if(role==='coolant')return ['冷却','持続','高温'];
  if(role==='propellant')return ['噴射','回数','強さ'];
  return ['反応','容量','O₂'];
}
function renderSelectionPreview(){
  const dialog=document.getElementById('supply-dialog');if(!dialog?.open)return;
  const role=activeRole(),selected=document.querySelector('#tank-molecules button[aria-pressed=true]');if(!role||!selected)return;
  const id=selected.dataset.moleculeId,loaded=document.querySelector('#tank-molecules button[data-loaded=true]'),loadedId=loaded?.dataset.moleculeId??id;
  const candidate=behaviorProfile(id,role),current=behaviorProfile(loadedId,role);if(!candidate)return;
  let host=document.querySelector('.mc-behavior-preview');if(!host){host=document.createElement('section');host.className='mc-behavior-preview';host.setAttribute('aria-live','polite');document.querySelector('#supply-dialog .tank-decision')?.prepend(host);}if(!host)return;
  const oxidizerRatio=ratioFromMeter(document.querySelector('#shell-oxidizer .tank-scale')),coolantRatio=ratioFromMeter(document.querySelector('#shell-coolant .tank-scale')),limit=bottleneckFor(id,role,{oxidizerRatio,coolantRatio}),candidateVars=profileVars(candidate),currentVars=profileVars(current??candidate),formula=selected.querySelector('strong')?.textContent||id,labels=labelsFor(role);
  const load=role==='fuel'?candidate.heat:role==='coolant'?1-(candidate.tolerance??0):role==='propellant'?candidate.drive:candidate.endurance;
  host.style.setProperty('--candidate-travel',candidateVars.travel);host.style.setProperty('--candidate-time',candidateVars.time);host.style.setProperty('--candidate-drive',candidateVars.drive);host.style.setProperty('--candidate-heat',candidateVars.heat);host.style.setProperty('--candidate-glow',candidateVars.glow);host.style.setProperty('--candidate-tail',candidateVars.tail);host.style.setProperty('--candidate-tail-opacity',candidateVars.tailOpacity);host.style.setProperty('--current-travel',currentVars.travel);host.style.setProperty('--current-time',currentVars.time);
  host.innerHTML=`<div class="mc-preview-head"><strong>${formula}</strong><span class="mc-preview-limit" data-part="${limit?.part??''}">${limit?.text??''}</span></div><div class="mc-flight-compare" aria-hidden="true"><span class="mc-preview-legend"><span><i></i>現在</span><span class="candidate"><i></i>候補</span></span><i class="mc-run current"></i><i class="mc-run candidate"></i></div><div class="mc-preview-cells" aria-hidden="true"><span class="mc-preview-cell response" data-label="${labels[0]}"><i style="--level:${candidate.drive}"></i></span><span class="mc-preview-cell endurance" data-label="${labels[1]}"><i style="--level:${candidate.endurance}"></i></span><span class="mc-preview-cell load" data-label="${labels[2]}"><i style="--level:${load}"></i></span></div>`;
  host.setAttribute('aria-label',`${formula}。現在装備との挙動比較。${limit?.text??''}`);
}
function schedulePreview(){queueMicrotask(renderSelectionPreview);}
function install(){
  if(document.getElementById('mc-equipment-ux-style'))return;
  const style=document.createElement('style');style.id='mc-equipment-ux-style';style.textContent=STYLES;document.head.append(style);
  const dialog=document.getElementById('supply-dialog');if(dialog){dialog.addEventListener('click',schedulePreview);new MutationObserver(schedulePreview).observe(dialog,{attributes:true,attributeFilter:['open']});}
  schedulePreview();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
