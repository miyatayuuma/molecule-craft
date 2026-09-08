import {moleculesForRole,performanceFor} from './molecule-roles.js';
import {COLLECTOR_SHELL_SPRITE_URL} from './collector-shell.js';

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

export function rolePreviewModel(id,role){
  const profile=behaviorProfile(id,role);if(!profile)return null;
  if(role==='propellant')return Object.freeze({kind:'burst',kick:.26+.62*profile.drive,shots:profile.shots});
  if(role==='fuel')return Object.freeze({kind:'fuel',response:profile.response,drive:profile.drive,endurance:profile.endurance,heat:profile.heat,oxygen:profile.oxygen});
  if(role==='coolant')return Object.freeze({kind:'coolant',cooling:profile.drive,endurance:profile.endurance,tolerance:profile.tolerance??0});
  return Object.freeze({kind:'oxidizer',capacity:profile.endurance,power:profile.drive});
}

const STYLES=`
#supply-dialog .tank-explanation,#supply-dialog .tank-replacement{display:none!important}
.mc-behavior-preview{display:grid;gap:8px;padding:9px;border:1px solid #31505f;border-radius:13px;background:linear-gradient(160deg,#0b2130,#091823);overflow:hidden}
.mc-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.mc-preview-head strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;color:#d6edf4}.mc-preview-limit{display:flex;align-items:center;gap:5px;flex:none;color:#9cb9c5;font-size:8px;white-space:nowrap}.mc-preview-limit:before{content:'';width:7px;height:7px;border-radius:50%;background:#7395a3}.mc-preview-limit[data-part=heat]:before{background:#dc865f}.mc-preview-limit[data-part=oxygen]:before{background:#8dbcf4}.mc-preview-limit[data-part=coolant]:before{background:#87d8cf}.mc-preview-limit[data-part=burst]:before{background:#8fdced}
.mc-role-compare{display:grid;grid-template-columns:1fr 1fr;gap:6px}.mc-role-card{position:relative;min-width:0;height:72px;border:1px solid #294756;border-radius:9px;background:#0a1924;overflow:hidden}.mc-role-tag{position:absolute;z-index:5;left:6px;top:5px;font-size:7px;color:#7393a0}.mc-role-card.candidate .mc-role-tag{color:#bceefa}.mc-role-card.current{opacity:.58}
.mc-shell{position:absolute;width:var(--shell-width,13px);height:var(--shell-height,20px);object-fit:contain;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center}
/* Propellant: one impulse, then the actual number of available impulses. */
.mc-burst-stage{position:absolute;inset:0}.mc-burst-stage:after{content:'';position:absolute;left:16%;right:10%;top:39px;height:1px;background:#35536155}.mc-burst-shell{left:20%;top:39px;animation:mc-burst 1.55s cubic-bezier(.12,.78,.2,1) infinite}.mc-burst-plume{position:absolute;left:15%;top:38px;width:var(--plume,16px);height:4px;transform:translate(-100%,-50%);background:linear-gradient(90deg,transparent,#80d8ebbb);filter:blur(.4px);animation:mc-plume 1.55s ease-out infinite}.mc-shot-row{position:absolute;left:7px;right:7px;bottom:6px;display:flex;gap:3px;align-items:center}.mc-shot-row i{width:4px;height:4px;border-radius:50%;background:#73bbcb;box-shadow:0 0 4px #73bbcb44}.mc-shot-row i:nth-child(n+10){display:none}
@keyframes mc-burst{0%,12%{left:20%}38%,70%{left:var(--kick,70%)}100%{left:20%}}@keyframes mc-plume{0%,10%,55%,100%{opacity:0}14%,30%{opacity:1}}
/* Fuel: a short throttle pulse. Response is expressed directly as motion; stores/heat move independently. */
.mc-fuel-lane{position:absolute;left:8px;right:8px;top:24px;height:27px;border-bottom:1px solid #35536155}.mc-fuel-shell{left:12%;top:13px;animation:mc-fuel-pulse 1.8s var(--fuel-ease,ease-out) infinite}.mc-fuel-exhaust{position:absolute;left:10%;top:13px;width:var(--fuel-tail,12px);height:3px;transform:translate(-100%,-50%);background:linear-gradient(90deg,transparent,#e89b6fb7);animation:mc-fuel-flame 1.8s ease-out infinite}.mc-fuel-heat{position:absolute;width:22px;height:22px;border-radius:50%;left:var(--fuel-end,72%);top:13px;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(239,122,75,var(--fuel-heat)) 0,transparent 70%);animation:mc-heat-pulse 1.8s ease-out infinite}.mc-resource-strip{position:absolute;left:7px;right:7px;bottom:6px;display:grid;grid-template-columns:1fr 1fr;gap:5px}.mc-resource-strip span{height:5px;border-radius:4px;background:#142a35;overflow:hidden}.mc-resource-strip i{display:block;height:100%;transform-origin:left;background:#64aabb}.mc-resource-strip .oxygen i{background:#779fd0}
@keyframes mc-fuel-pulse{0%,8%{left:12%}62%,76%{left:var(--fuel-end,72%)}100%{left:12%}}@keyframes mc-fuel-flame{0%,8%,72%,100%{opacity:0}12%,58%{opacity:.95}}@keyframes mc-heat-pulse{0%,8%,100%{opacity:0}42%,72%{opacity:1}}
/* Coolant: same hot core, different cooling rate and remaining reserve. */
.mc-coolant-core{position:absolute;left:50%;top:36px;width:28px;height:28px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#f18a61 0 22%,#8e3b2d 40%,#192b33 72%);box-shadow:0 0 18px #e9784d99;animation:mc-cool var(--cool-time,1.4s) ease-out infinite}.mc-coolant-ring{position:absolute;left:50%;top:36px;width:38px;height:38px;border:1px solid rgba(125,216,209,var(--tolerance,.5));border-radius:50%;transform:translate(-50%,-50%)}.mc-coolant-reserve{position:absolute;left:9px;right:9px;bottom:7px;height:5px;border-radius:4px;background:#142a35;overflow:hidden}.mc-coolant-reserve i{display:block;height:100%;transform:scaleX(var(--reserve,.5));transform-origin:left;background:#63b8b0}
@keyframes mc-cool{0%,10%{filter:saturate(1.3);box-shadow:0 0 18px #e9784d99}58%,76%{filter:saturate(.25) brightness(.75);box-shadow:0 0 8px #78d9d055}100%{filter:saturate(1.3);box-shadow:0 0 18px #e9784d99}}
/* Oxidizer stays deliberately simple: its useful distinction is support amount, not vehicle motion. */
.mc-oxygen-cell{position:absolute;left:12px;right:12px;top:27px;height:15px;border:1px solid #31505f;border-radius:9px;overflow:hidden}.mc-oxygen-cell i{display:block;height:100%;transform:scaleX(var(--oxygen-cap,.5));transform-origin:left;background:linear-gradient(90deg,#5b86ba,#91c3f2)}.mc-oxygen-core{position:absolute;left:50%;top:51px;width:8px;height:8px;border-radius:50%;background:#8dbcf4;box-shadow:0 0 var(--oxygen-glow,8px) #8dbcf4aa}
@media(prefers-reduced-motion:reduce){.mc-burst-shell,.mc-burst-plume,.mc-fuel-shell,.mc-fuel-exhaust,.mc-fuel-heat,.mc-coolant-core{animation:none}.mc-burst-shell{left:var(--kick,70%)}.mc-fuel-shell{left:var(--fuel-end,72%)}.mc-fuel-heat{opacity:1}.mc-coolant-core{filter:saturate(.3) brightness(.78);box-shadow:0 0 8px #78d9d055}}
@media(max-width:370px){.mc-behavior-preview{padding:8px;gap:7px}.mc-preview-head strong{font-size:9px}.mc-role-card{height:68px}.mc-preview-limit{font-size:7px}}
/* Flight HUD: keep meaningful physical stores, remove duplicate abstract bars. */
#veil-combustion>.propulsion-meter,.veil-thermal>i{display:none!important}#veil-combustion{min-height:66px!important}.veil-thermal{padding:5px 8px!important;opacity:.52;transition:opacity .15s ease,border-color .15s ease,box-shadow .15s ease}.veil-thermal[data-state=hot],.veil-thermal[data-state=cooling],.veil-thermal[data-state=overheat]{opacity:1}.veil-thermal>span{justify-content:center!important}.veil-thermal small{text-align:center}.paired-tanks i{height:31px!important}.combustion-link{width:24px;height:24px;display:grid!important;place-items:center;border-radius:50%;background:#241d1a;transition:box-shadow .15s ease,background .15s ease}.driving .combustion-link{background:#4b281d!important;box-shadow:0 0 16px #ef894d88!important}.veil-thermal[data-state=hot]+#veil-combustion .combustion-link,.veil-thermal[data-state=overheat]+#veil-combustion .combustion-link{box-shadow:0 0 16px #e9744f88}.veil-thermal[data-state=cooling]{background:linear-gradient(90deg,#0a1b28c7,#123330c7,#0a1b28c7)}
@media(prefers-reduced-motion:reduce){.veil-thermal,.combustion-link{transition:none}}
`;

function activeRole(){
  const node=document.querySelector('#supply-dialog .shell-port[data-active=true]');return node?.dataset.tankRole??null;
}
function shellScale(){return clamp(Math.min((window.innerWidth||390)/660,(window.innerHeight||844)/950),.48,1.15);}
function fuelEase(response){
  const r=clamp(response??.5);
  if(r>.7)return 'cubic-bezier(.08,.8,.15,1)';
  if(r<.3)return 'cubic-bezier(.52,.02,.82,.62)';
  return 'cubic-bezier(.28,.35,.42,.92)';
}
function shotDots(shots){return Array.from({length:Math.min(10,Math.max(1,shots??1))},()=>'<i></i>').join('');}
function cardTag(candidate){return candidate?'候補':'現在';}
function burstCard(model,candidate){
  const kick=`${Math.round(30+model.kick*55)}%`,plume=`${Math.round(8+model.kick*16)}px`;
  return `<div class="mc-role-card ${candidate?'candidate':'current'}" style="--kick:${kick};--plume:${plume}"><span class="mc-role-tag">${cardTag(candidate)}</span><div class="mc-burst-stage"><span class="mc-burst-plume"></span><img class="mc-shell mc-burst-shell" src="${COLLECTOR_SHELL_SPRITE_URL}" alt=""></div><div class="mc-shot-row">${shotDots(model.shots)}</div></div>`;
}
function fuelCard(model,candidate){
  const end=`${Math.round(48+model.drive*34)}%`,tail=`${Math.round(8+model.drive*15)}px`,fuelRemain=.18+.72*model.endurance,oxygenRemain=.82-.62*model.oxygen;
  return `<div class="mc-role-card ${candidate?'candidate':'current'}" style="--fuel-ease:${fuelEase(model.response)};--fuel-end:${end};--fuel-tail:${tail};--fuel-heat:${(.15+.7*model.heat).toFixed(2)}"><span class="mc-role-tag">${cardTag(candidate)}</span><div class="mc-fuel-lane"><span class="mc-fuel-exhaust"></span><span class="mc-fuel-heat"></span><img class="mc-shell mc-fuel-shell" src="${COLLECTOR_SHELL_SPRITE_URL}" alt=""></div><div class="mc-resource-strip"><span><i style="transform:scaleX(${fuelRemain.toFixed(2)})"></i></span><span class="oxygen"><i style="transform:scaleX(${clamp(oxygenRemain,.12,.9).toFixed(2)})"></i></span></div></div>`;
}
function coolantCard(model,candidate){
  const coolTime=(1.9-model.cooling*.95).toFixed(2),reserve=(.18+.76*model.endurance).toFixed(2),tolerance=(.2+.75*model.tolerance).toFixed(2);
  return `<div class="mc-role-card ${candidate?'candidate':'current'}" style="--cool-time:${coolTime}s;--reserve:${reserve};--tolerance:${tolerance}"><span class="mc-role-tag">${cardTag(candidate)}</span><span class="mc-coolant-ring"></span><span class="mc-coolant-core"></span><span class="mc-coolant-reserve"><i></i></span></div>`;
}
function oxidizerCard(model,candidate){
  return `<div class="mc-role-card ${candidate?'candidate':'current'}" style="--oxygen-cap:${(.2+.75*model.capacity).toFixed(2)};--oxygen-glow:${Math.round(5+model.power*11)}px"><span class="mc-role-tag">${cardTag(candidate)}</span><span class="mc-oxygen-cell"><i></i></span><span class="mc-oxygen-core"></span></div>`;
}
function renderRoleCard(model,candidate){
  if(model.kind==='burst')return burstCard(model,candidate);
  if(model.kind==='fuel')return fuelCard(model,candidate);
  if(model.kind==='coolant')return coolantCard(model,candidate);
  return oxidizerCard(model,candidate);
}
function renderSelectionPreview(){
  const dialog=document.getElementById('supply-dialog');if(!dialog?.open)return;
  const role=activeRole(),selected=document.querySelector('#tank-molecules button[aria-pressed=true]');if(!role||!selected)return;
  const id=selected.dataset.moleculeId,loaded=document.querySelector('#tank-molecules button[data-loaded=true]'),loadedId=loaded?.dataset.moleculeId??id;
  const candidate=rolePreviewModel(id,role),current=rolePreviewModel(loadedId,role);if(!candidate)return;
  let host=document.querySelector('.mc-behavior-preview');if(!host){host=document.createElement('section');host.className='mc-behavior-preview';host.setAttribute('aria-live','polite');document.querySelector('#supply-dialog .tank-decision')?.prepend(host);}if(!host)return;
  const oxidizerRatio=ratioFromMeter(document.querySelector('#shell-oxidizer .tank-scale')),coolantRatio=ratioFromMeter(document.querySelector('#shell-coolant .tank-scale')),limit=bottleneckFor(id,role,{oxidizerRatio,coolantRatio}),formula=selected.querySelector('strong')?.textContent||id,scale=shellScale();
  host.style.setProperty('--shell-width',`${(21*scale).toFixed(1)}px`);host.style.setProperty('--shell-height',`${(34*scale).toFixed(1)}px`);
  host.innerHTML=`<div class="mc-preview-head"><strong>${formula}</strong><span class="mc-preview-limit" data-part="${limit?.part??''}">${limit?.text??''}</span></div><div class="mc-role-compare" aria-hidden="true">${renderRoleCard(current??candidate,false)}${renderRoleCard(candidate,true)}</div>`;
  host.setAttribute('aria-label',`${formula}。現在装備との挙動比較。${limit?.text??''}`);
}
function schedulePreview(){queueMicrotask(renderSelectionPreview);}
function install(){
  if(document.getElementById('mc-equipment-ux-style'))return;
  const style=document.createElement('style');style.id='mc-equipment-ux-style';style.textContent=STYLES;document.head.append(style);
  const dialog=document.getElementById('supply-dialog');if(dialog){dialog.addEventListener('click',schedulePreview);new MutationObserver(schedulePreview).observe(dialog,{attributes:true,attributeFilter:['open']});}
  window.addEventListener('resize',schedulePreview,{passive:true});
  schedulePreview();
}
if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
}
