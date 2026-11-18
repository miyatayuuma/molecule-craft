import { createGas, advanceGas } from './water-gas.js';
import { clamp, LOW, HIGH, REST } from './water-phase.js';
const phaseLabels={
  gas:'<ruby>気体<rt>きたい</rt></ruby>',liquid:'<ruby>液体<rt>えきたい</rt></ruby>',
  ice:'<ruby>固体<rt>こたい</rt></ruby>（こおり）',freezing:'こおっている',melting:'とけている',
  boiling:'<ruby>気体<rt>きたい</rt></ruby>になっている',condensing:'しずくになっている',
  mixed:'<ruby>液体<rt>えきたい</rt></ruby>と<ruby>気体<rt>きたい</rt></ruby>',
  slush:'こおりと<ruby>水<rt>みず</rt></ruby>'
};
export const waterPistonTitle='<ruby>状態<rt>じょうたい</rt></ruby>のへんか';

const style = `
.water-piston[open]{display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(560px,100vw);height:min(900px,100dvh);max-height:100dvh;max-width:100vw;margin:auto;padding:0;box-sizing:border-box;overflow:hidden;background:#eff5ef;color:#153738;border:1px solid #7c9994;border-radius:22px;font-family:system-ui,sans-serif}
.water-piston::backdrop{background:#102b30e8;backdrop-filter:none}
.water-piston *{box-sizing:border-box}
.water-piston header,.water-piston footer{padding:16px 22px}
.water-piston header{display:flex;align-items:center;border-bottom:1px solid #a7bdb4;gap:12px}
.water-piston h2{font-size:clamp(18px,5vw,24px);margin:0;letter-spacing:.05em}
.water-piston ruby rt{font-size:.5em;letter-spacing:0}
.water-piston .water-identity{display:flex;align-items:center;gap:7px;margin-top:4px;font-size:14px;font-weight:700}
.water-identity img{width:34px;height:28px;object-fit:contain}
.water-identity small{font-weight:600;color:#376668;border-left:1px solid #9ab1aa;padding-left:9px}
.water-piston button{border:1px solid #a2b9ae;background:#f5faf5;color:#234647;cursor:pointer;box-shadow:none;min-height:44px}
.water-piston .water-close{margin-left:auto;width:44px;border-radius:50%;font:26px/1 sans-serif;padding:0}
.water-stage{position:relative;overflow:hidden;isolation:isolate;touch-action:none;background-color:#153438;background-image:radial-gradient(ellipse at 44% 55%,#33696b88,transparent 68%),radial-gradient(#91c5b92e .8px,transparent 1px);background-size:auto,17px 17px}
.water-stage canvas{display:block;position:absolute;inset:0;width:100%;height:100%;touch-action:none}
.water-stage .water-grip{position:absolute;transform:translate(-50%,-50%);touch-action:none;user-select:none;width:46px;height:58px;min-height:44px;border:2px solid #ffe2a8;border-radius:15px;padding:0;cursor:ns-resize;color:#533317;background:linear-gradient(100deg,#ffc96e,#f2a348);box-shadow:0 3px 0 #915a32,0 5px 13px #001c2266;display:grid;place-content:center;gap:4px}
.water-grip::before,.water-grip::after{content:"";width:7px;height:7px;margin:auto;border:solid #78532b;border-width:1.5px 1.5px 0 0;transform:rotate(-45deg)}
.water-grip::after{transform:rotate(135deg)}
.water-grip i{display:block;width:20px;height:2px;border-radius:2px;background:#805221}
.water-grip:active{filter:brightness(1.09)}
.water-piston footer{display:grid;grid-template-columns:1fr auto;gap:9px 12px;border-top:1px solid #8fa99c;padding-bottom:max(16px,env(safe-area-inset-bottom))}
.water-reading{display:flex;align-items:baseline;gap:8px;color:#48645e;font-size:13px}
.water-reading output{color:#183e3d;font:650 25px/1.2 system-ui;font-variant-numeric:tabular-nums}
.water-reading small{font-size:13px;font-weight:600;margin-left:2px}
.water-piston input{width:100%;margin:0;height:36px;touch-action:none;accent-color:#20776e;cursor:pointer}
.water-piston .water-reset{justify-self:end;border-radius:12px;padding:4px 12px;font-size:13px}
.water-stage p{position:absolute;inset:40% 10% auto;text-align:center;color:white}
@media(max-width:580px){.water-piston[open]{border-radius:0;border:0}.water-piston header,.water-piston footer{padding-left:17px;padding-right:17px}}
`;
export function openWaterPiston(record,createPistonScene,onClose) {
  const gas=createGas(record);
  const dialog=document.createElement('dialog');
  dialog.className='water-piston';
  dialog.setAttribute('aria-labelledby','water-title');
  dialog.innerHTML=`<style>${style}</style><header><div><h2 id="water-title">${waterPistonTitle}</h2>
    <div class="water-identity"><img src="./assets/models/molecule-water.svg" alt=""><ruby>水<rt>みず</rt></ruby> H₂O <small><ruby>気体<rt>きたい</rt></ruby></small></div></div>
    <button type="button" class="water-close" aria-label="とじる">×</button></header>
    <div class="water-stage"><button type="button" class="water-grip" aria-label="ピストンを上下にうごかす" role="slider" aria-orientation="vertical" aria-valuemin="0" aria-valuemax="100"><i></i><i></i><i></i></button></div>
    <footer><label class="water-reading" for="water-temp"><ruby>温度<rt>おんど</rt></ruby><span><output class="water-degrees">160</output><small>℃</small></span></label>
    <div class="water-reading"><ruby>圧力<rt>あつりょく</rt></ruby><span><output class="water-pressure">1.00</output><small>atm</small></span></div>
    <input id="water-temp" type="range" min="-30" max="200" value="160" step="1"><button class="water-reset" type="button">↺ もとにもどす</button></footer>`;
  document.body.append(dialog); dialog.showModal();
  const stage=dialog.querySelector('.water-stage'), grip=dialog.querySelector('.water-grip');
  const temp=dialog.querySelector('input'), degrees=dialog.querySelector('.water-degrees'), gauge=dialog.querySelector('.water-pressure');
  let angle=0, frame=0, previous=0, scene, observer, closed=false;
  const close=()=>{
    if(closed)return;
    closed=true; cancelAnimationFrame(frame); observer?.disconnect();
    document.removeEventListener('visibilitychange',visibility);
    scene?.dispose(); dialog.close(); dialog.remove(); onClose();
  };
  dialog.querySelector('.water-close').onclick=close;
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  function unavailable(){
    cancelAnimationFrame(frame); grip.hidden=true; grip.style.display='none';
    temp.disabled=true; dialog.querySelector('.water-reset').disabled=true;
    const message=document.createElement('p'); message.textContent='模型を表示できません。画面をとじて、もう一度ひらいてください。';
    stage.append(message);
  }
  try {scene=createPistonScene(stage);} catch {unavailable();return {close};}
  const badge=dialog.querySelector('.water-identity small');
  let lastIce=0,lastVapor=1,resetting=false;
  function draw(){
    scene.draw(gas,angle,grip);
    const value=gas.pressure.toFixed(2);
    const reading=String(Math.round(gas.temperature));
    if(degrees.value!==reading)degrees.value=reading;
    let phase;
    if(gas.ice>.999)phase='ice';
    else if(gas.ice>.001)phase=gas.ice>lastIce?'freezing':gas.ice<lastIce?'melting':'slush';
    else if(gas.vapor>.999)phase='gas';
    else if(gas.vapor<.001)phase='liquid';
    else phase=gas.vapor>lastVapor?'boiling':gas.vapor<lastVapor?'condensing':'mixed';
    if(badge.dataset.phase!==phase){badge.dataset.phase=phase;badge.innerHTML=phaseLabels[phase];}
    lastIce=gas.ice;lastVapor=gas.vapor;
    if(gauge.value!==value)gauge.value=value;
    grip.setAttribute('aria-valuenow',String(Math.round(100*(gas.height-LOW)/(HIGH-LOW))));
  }
  function animate(now){
    let elapsed=Math.min((now-(previous||now))/1000,.05);
    previous=now;
    while(elapsed>.000001){
      const dt=Math.min(1/120,elapsed);
      if(resetting&&gas.temperature===160){
        gas.stroke=REST-gas.height;
        if(Math.abs(gas.stroke)<.0001)resetting=false;
      }
      advanceGas(gas,dt);elapsed-=dt;
    }
    draw(); frame=requestAnimationFrame(animate);
  }
  function visibility(){
    cancelAnimationFrame(frame); previous=0;
    if(!document.hidden&&!closed)frame=requestAnimationFrame(animate);
  }
  stage.querySelector('canvas').addEventListener('webglcontextlost',()=>{
    if(closed)return;
    document.removeEventListener('visibilitychange',visibility);observer.disconnect();unavailable();
  });
  document.addEventListener('visibilitychange',visibility);
  observer=new ResizeObserver(()=>{scene.resize();draw();});observer.observe(stage);
  draw();visibility();
  temp.oninput=()=>{resetting=false;gas.setting=Number(temp.value);};
  // Native range dragging may ignore the second finger while the piston holds the first.
  let heatPointer=null;
  function slideHeat(e){
    const rect=temp.getBoundingClientRect();
    temp.value=String(Math.round(-30+230*clamp((e.clientX-rect.left-8)/(rect.width-16),0,1)));
    temp.oninput();
  }
  temp.onpointerdown=e=>{
    if(e.pointerType!=='touch'||heatPointer!==null)return;
    e.preventDefault(); heatPointer=e.pointerId; temp.setPointerCapture(heatPointer); slideHeat(e);
  };
  temp.onpointermove=e=>{if(e.pointerId===heatPointer)slideHeat(e);};
  temp.onlostpointercapture=()=>{heatPointer=null;};
  function drag(node, axis, apply) {
    let pointer=null, last;
    node.onpointerdown=e=>{
      if(pointer!==null||e.button!==0)return;
      e.stopPropagation(); node.setPointerCapture(e.pointerId); pointer=e.pointerId;last=e[axis];
    };
    node.onpointermove=e=>{
      if(e.pointerId!==pointer)return;
      apply(e[axis]-last); last=e[axis];
    };
    node.onlostpointercapture=e=>{if(e.pointerId===pointer)pointer=null;};
  }
  drag(grip,'clientY',dy=>{resetting=false;gas.stroke=clamp(gas.stroke-dy*scene.unitsPerPixel(),-HIGH,HIGH);});
  drag(stage,'clientX',dx=>{angle+=dx*.011;});
  grip.onkeydown=e=>{
    const direction={ArrowUp:1,ArrowDown:-1}[e.key];
    if(direction){e.preventDefault();resetting=false;gas.stroke+=direction*.4;}
  };
  dialog.querySelector('.water-reset').onclick=()=>{
    gas.stroke=0;gas.velocity=0;gas.setting=160;temp.value='160';angle=0;
    // Once warm, return the same particles and piston to the initial volume.
    resetting=true;
  };
  return {close};
}
