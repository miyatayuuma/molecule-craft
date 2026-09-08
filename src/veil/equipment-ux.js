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
.mc-behavior-preview{padding:0;border:1px solid #31505f;border-radius:15px;background:linear-gradient(160deg,#0b2130,#091823);overflow:hidden;min-height:154px}
.mc-role-stage{position:relative;height:154px;overflow:hidden;background:radial-gradient(circle at 50% 42%,#123040 0,#0a1a25 64%,#07131d 100%)}
.mc-behavior-layer{position:absolute;inset:0;pointer-events:none}.mc-behavior-layer.current{z-index:1;opacity:.52;filter:grayscale(.8) brightness(1.12)}.mc-behavior-layer.candidate{z-index:2}.mc-behavior-layer.candidate .mc-shell{filter:drop-shadow(0 0 6px #8ee8f077)}
.mc-shell{position:absolute;width:var(--shell-width,24px);height:var(--shell-height,39px);object-fit:contain;transform:translate(-50%,-50%) rotate(90deg);transform-origin:center}
/* Propellant: one shared launch point, one synchronized impulse. Distance is intentionally exaggerated for readability. */
.mc-burst-axis{position:absolute;left:12%;right:8%;top:69px;height:1px;background:#35536166}.mc-burst-shell{left:18%;top:69px;animation:mc-burst 1.65s cubic-bezier(.12,.78,.2,1) infinite}.mc-burst-plume{position:absolute;left:15%;top:69px;width:var(--plume,24px);height:7px;transform:translate(-100%,-50%);background:linear-gradient(90deg,transparent,#80d8ebd0);filter:blur(.6px);animation:mc-plume 1.65s ease-out infinite}.mc-shot-row{position:absolute;left:14px;right:14px;bottom:14px;display:flex;gap:5px;align-items:center}.mc-shot-row i{width:7px;height:7px;border-radius:50%;background:#73bbcb;box-shadow:0 0 6px #73bbcb66}.current .mc-shot-row i{background:transparent;border:1px solid #9eb6bf;box-sizing:border-box}.mc-shot-row i:nth-child(n+11){display:none}
@keyframes mc-burst{0%,12%{left:18%}38%,70%{left:var(--kick,72%)}100%{left:18%}}@keyframes mc-plume{0%,10%,55%,100%{opacity:0}14%,30%{opacity:1}}
/* Fuel: same throttle-on moment; easing carries response while final travel is not used as endurance. */
.mc-fuel-axis{position:absolute;left:9%;right:8%;top:70px;height:1px;background:#35536166}.mc-fuel-shell{left:14%;top:70px;animation:mc-fuel-pulse 2s var(--fuel-ease,ease-out) infinite}.mc-fuel-exhaust{position:absolute;left:11%;top:70px;width:var(--fuel-tail,20px);height:6px;transform:translate(-100%,-50%);background:linear-gradient(90deg,transparent,#e89b6fc9);animation:mc-fuel-flame 2s ease-out infinite}.mc-fuel-heat{position:absolute;width:46px;height:46px;border-radius:50%;left:var(--fuel-end,68%);top:70px;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(239,122,75,var(--fuel-heat)) 0,transparent 70%);animation:mc-heat-pulse 2s ease-out infinite}.mc-resource-strip{position:absolute;left:14px;right:14px;bottom:14px;display:grid;grid-template-columns:1fr 1fr;gap:10px}.mc-resource-strip span{height:8px;border-radius:5px;background:#142a35;overflow:hidden}.mc-resource-strip i{display:block;height:100%;transform-origin:left;background:#64aabb}.mc-resource-strip .oxygen i{background:#779fd0}.current .mc-resource-strip span{background:transparent;border:1px solid #526873;box-sizing:border-box}.current .mc-resource-strip i{opacity:.45}
@keyframes mc-fuel-pulse{0%,8%{left:14%}62%,76%{left:var(--fuel-end,68%)}100%{left:14%}}@keyframes mc-fuel-flame{0%,8%,72%,100%{opacity:0}12%,58%{opacity:.95}}@keyframes mc-heat-pulse{0%,8%,100%{opacity:0}42%,72%{opacity:1}}
/* Coolant: both samples start equally hot and share a cycle; cooling power changes the decay curve. */
.mc-coolant-core{position:absolute;left:50%;top:67px;width:58px;height:58px;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,#f18a61 0 22%,#8e3b2d 40%,#192b33 72%);box-shadow:0 0 28px #e9784daa;animation:mc-cool 2.4s var(--cool-ease,ease-out) infinite}.mc-coolant-ring{position:absolute;left:50%;top:67px;width:78px;height:78px;border:2px solid rgba(125,216,209,var(--tolerance,.5));border-radius:50%;transform:translate(-50%,-50%)}.mc-coolant-reserve{position:absolute;left:18px;right:18px;bottom:14px;height:8px;border-radius:5px;background:#142a35;overflow:hidden}.mc-coolant-reserve i{display:block;height:100%;transform:scaleX(var(--reserve,.5));transform-origin:left;background:#63b8b0}.current .mc-coolant-reserve{background:transparent;border:1px solid #526873;box-sizing:border-box}.current .mc-coolant-reserve i{opacity:.45}
@keyframes mc-cool{0%,10%{filter:saturate(1.35);box-shadow:0 0 28px #e9784daa}58%,78%{filter:saturate(.22) brightness(.72);box-shadow:0 0 10px #78d9d066}100%{filter:saturate(1.35);box-shadow:0 0 28px #e9784daa}}
/* Oxidizer remains deliberately simple because there is currently little selection value beyond support amount. */
.mc-oxygen-cell{position:absolute;left:18px;right:18px;top:54px;height:24px;border:1px solid #31505f;border-radius:12px;overflow:hidden}.mc-oxygen-cell i{display:block;height:100%;transform:scaleX(var(--oxygen-cap,.5));transform-origin:left;background:linear-gradient(90deg,#5b86ba,#91c3f2)}.mc-oxygen-core{position:absolute;left:50%;top:103px;width:13px;height:13px;border-radius:50%;background:#8dbcf4;box-shadow:0 0 var(--oxygen-glow,12px) #8dbcf4aa}.current .mc-oxygen-cell i{opacity:.38}
@media(prefers-reduced-motion:reduce){.mc-burst-shell,.mc-burst-plume,.mc-fuel-shell,.mc-fuel-exhaust,.mc-fuel-heat,.mc-coolant-core{animation:none}.mc-burst-shell{left:var(--kick,72%)}.mc-fuel-shell{left:var(--fuel-end,68%)}.mc-fuel-heat{opacity:1}.mc-coolant-core{filter:saturate(.25) brightness(.75);box-shadow:0 0 10px #78d9d066}}
@media(max-width:370px){.mc-behavior-preview{min-height:144px}.mc-role-stage{height:144px}.mc-burst-axis,.mc-burst-shell,.mc-burst-plume{top:64px}.mc-fuel-axis,.mc-fuel-shell,.mc-fuel-exhaust,.mc-fuel-heat{top:65px}.mc-coolant-core,.mc-coolant-ring{top:63px}}
/* Flight HUD: keep meaningful physical stores, remove duplicate abstract bars. */
#veil-combustion>.propulsion-meter,.veil-thermal>i{display:none!important}#veil-combustion{min-height:66px!important}.veil-thermal{padding:5px 8px!important;opacity:.52;transition:opacity .15s ease,border-color .15s ease,box-shadow .15s ease}.veil-thermal[data-state=hot],.veil-thermal[data-state=cooling],.veil-thermal[data-state=overheat]{opacity:1}.veil-thermal>span{justify-content:center!important}.veil-thermal small{text-align:center}.paired-tanks i{height:31px!important}.combustion-link{width:24px;height:24px;display:grid!important;place-items:center;border-radius:50%;background:#241d1a;transition:box-shadow .15s ease,background .15s ease}.driving .combustion-link{background:#4b281d!important;box-shadow:0 0 16px #ef894d88!important}.veil-thermal[data-state=hot]+#veil-combustion .combustion-link,.veil-thermal[data-state=overheat]+#veil-combustion .combustion-link{box-shadow:0 0 16px #e9744f88}.veil-thermal[data-state=cooling]{background:linear-gradient(90deg,#0a1b28c7,#123330c7,#0a1b28c7)}
@media(prefers-reduced-motion:reduce){.veil-thermal,.combustion-link{transition:none}}
`;

function activeRole(){
  const node=document.querySelector('#supply-dialog .shell-port[data-active=true]');return node?.dataset.tankRole??null;
}
function shellScale(){return clamp(Math.min((window.innerWidth||390)/660,(window.innerHeight||844)/950),.75,1.2);}
function fuelEase(response){
  const r=clamp(response??.5);
  if(r>.7)return 'cubic-bezier(.06,.82,.14,1)';
  if(r<.3)return 'cubic-bezier(.56,.02,.84,.58)';
  return 'cubic-bezier(.28,.35,.42,.92)';
}
function coolantEase(cooling){
  const r=clamp(cooling??.5);
  if(r>.7)return 'cubic-bezier(.05,.9,.14,1)';
  if(r<.3)return 'cubic-bezier(.48,.04,.78,.72)';
  return 'cubic-bezier(.24,.38,.4,.94)';
}
function shotDots(shots){return Array.from({length:Math.min(10,Math.max(1,shots??1))},()=>'<i></i>').join('');}
function layerClass(candidate){return `mc-behavior-layer ${candidate?'candidate':'current'}`;}
function burstLayer(model,candidate){
  const kick=`${Math.round(28+model.kick*64)}%`,plume=`${Math.round(14+model.kick*24)}px`;
  return `<div class="${layerClass(candidate)}" style="--kick:${kick};--plume:${plume}"><span class="mc-burst-axis"></span><span class="mc-burst-plume"></span><img class="mc-shell mc-burst-shell" src="${COLLECTOR_SHELL_SPRITE_URL}" alt=""><div class="mc-shot-row">${shotDots(model.shots)}</div></div>`;
}
function fuelLayer(model,candidate){
  const end=`${Math.round(56+model.drive*22)}%`,tail=`${Math.round(14+model.drive*24)}px`,fuelRemain=.18+.72*model.endurance,oxygenRemain=.82-.62*model.oxygen;
  return `<div class="${layerClass(candidate)}" style="--fuel-ease:${fuelEase(model.response)};--fuel-end:${end};--fuel-tail:${tail};--fuel-heat:${(.18+.72*model.heat).toFixed(2)}"><span class="mc-fuel-axis"></span><span class="mc-fuel-exhaust"></span><span class="mc-fuel-heat"></span><img class="mc-shell mc-fuel-shell" src="${COLLECTOR_SHELL_SPRITE_URL}" alt=""><div class="mc-resource-strip"><span><i style="transform:scaleX(${fuelRemain.toFixed(2)})"></i></span><span class="oxygen"><i style="transform:scaleX(${clamp(oxygenRemain,.12,.9).toFixed(2)})"></i></span></div></div>`;
}
function coolantLayer(model,candidate){
  const reserve=(.18+.76*model.endurance).toFixed(2),tolerance=(.2+.75*model.tolerance).toFixed(2);
  return `<div class="${layerClass(candidate)}" style="--cool-ease:${coolantEase(model.cooling)};--reserve:${reserve};--tolerance:${tolerance}"><span class="mc-coolant-ring"></span><span class="mc-coolant-core"></span><span class="mc-coolant-reserve"><i></i></span></div>`;
}
function oxidizerLayer(model,candidate){
  return `<div class="${layerClass(candidate)}" style="--oxygen-cap:${(.2+.75*model.capacity).toFixed(2)};--oxygen-glow:${Math.round(8+model.power*16)}px"><span class="mc-oxygen-cell"><i></i></span><span class="mc-oxygen-core"></span></div>`;
}
function renderLayer(model,candidate){
  if(model.kind==='burst')return burstLayer(model,candidate);
  if(model.kind==='fuel')return fuelLayer(model,candidate);
  if(model.kind==='coolant')return coolantLayer(model,candidate);
  return oxidizerLayer(model,candidate);
}
function renderSelectionPreview(){
  const dialog=document.getElementById('supply-dialog');if(!dialog?.open)return;
  const role=activeRole(),selected=document.querySelector('#tank-molecules button[aria-pressed=true]');if(!role||!selected)return;
  const id=selected.dataset.moleculeId,loaded=document.querySelector('#tank-molecules button[data-loaded=true]'),loadedId=loaded?.dataset.moleculeId??id;
  const candidate=rolePreviewModel(id,role),current=rolePreviewModel(loadedId,role);if(!candidate)return;
  let host=document.querySelector('.mc-behavior-preview');if(!host){host=document.createElement('section');host.className='mc-behavior-preview';host.setAttribute('aria-live','polite');document.querySelector('#supply-dialog .tank-decision')?.prepend(host);}if(!host)return;
  const formula=selected.querySelector('strong')?.textContent||id,scale=shellScale();
  host.style.setProperty('--shell-width',`${(30*scale).toFixed(1)}px`);host.style.setProperty('--shell-height',`${(48*scale).toFixed(1)}px`);
  host.innerHTML=`<div class="mc-role-stage" aria-hidden="true">${renderLayer(current??candidate,false)}${renderLayer(candidate,true)}</div>`;
  host.setAttribute('aria-label',`${formula}。現在装備との挙動比較。`);
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
