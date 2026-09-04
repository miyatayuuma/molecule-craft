import { ELEMENTS } from './chemistry.js?v=20';
import { TANK_PRESENTATION } from './veil/collector-shell.js';

const clamp=value=>Math.max(0,Math.min(1,value));

function drawStage(stage,{record,use,progress,fillProgress,oldRatio,newRatio,replacing,reduced}){
  const canvas=stage.querySelector('canvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio??1,2),w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,rect.width,rect.height);const width=rect.width,height=rect.height,color=TANK_PRESENTATION[use]?.color??'#78d5e7',tank={x:width-70,y:12,w:44,h:height-24};
  const rounded=(x,y,w,h,r)=>{if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);};
  ctx.strokeStyle=color;ctx.globalAlpha=.75;ctx.lineWidth=2;ctx.beginPath();rounded(tank.x,tank.y,tank.w,tank.h,10);ctx.stroke();ctx.save();ctx.beginPath();rounded(tank.x+4,tank.y+4,tank.w-8,tank.h-8,7);ctx.clip();ctx.fillStyle=color;ctx.globalAlpha=.35;ctx.fillRect(tank.x+4,tank.y+tank.h-4-(tank.h-8)*newRatio,tank.w-8,(tank.h-8)*newRatio);ctx.restore();
  if(reduced)return;
  if(replacing&&progress<.3){for(let i=0;i<7;i++){const phase=clamp(progress/.3-i*.035),x=tank.x+tank.w/2+(phase*65),y=tank.y+tank.h*(.22+(i%4)*.18)-phase*14;ctx.fillStyle='#d99b80';ctx.globalAlpha=(1-phase)*oldRatio;ctx.beginPath();ctx.arc(x,y,2.5+(i%2),0,Math.PI*2);ctx.fill();}}
  const atoms=record?.atoms??[];for(let i=0;i<Math.min(10,Math.max(4,atoms.length*2));i++){
    const local=(fillProgress*2.2+i*.17)%1,symbol=atoms[i%Math.max(1,atoms.length)]??'H',atomColor=ELEMENTS[symbol]?.color??'#d9f7ff';let x,y;
    if(local<.48){const t=local/.48;x=12+(width*.48-12)*t;y=height*(.25+(i%4)*.16)+(Math.sin(t*Math.PI+i)*7);}else{const t=(local-.48)/.52;x=width*.48+(tank.x-width*.48)*t;y=height*(.5+(i%3-1)*.06)*(1-t)+(tank.y+tank.h*.5)*t;}
    ctx.fillStyle=atomColor;ctx.globalAlpha=.45+Math.sin(local*Math.PI)*.5;ctx.beginPath();ctx.arc(x,y,2.2+(i%3)*.45,0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.globalAlpha=.28;ctx.beginPath();ctx.arc(width*.48,height*.5,12+Math.sin(fillProgress*Math.PI*8)*2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
}

export function bindTankChargeAction(button,{stage,use,record,planFor,commit,onStart=()=>{},onFinish=()=>{},clock=()=>performance.now(),raf=requestAnimationFrame,cancelRaf=cancelAnimationFrame,delay=setTimeout,cancelDelay=clearTimeout,reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false}={}){
  let active=null,frame=0,resultTimer=0;const owner=button.ownerDocument,presentation=TANK_PRESENTATION[use];
  button.replaceChildren(Object.assign(owner.createElement('i'),{textContent:presentation.icon}),Object.assign(owner.createElement('span'),{textContent:`${planFor()?.label??'タンク'}へ充填`}));button.style.setProperty('--tank-color',presentation.color);
  function hide(){stage.hidden=true;stage.classList.remove('charging');button.classList.remove('holding');button.style.setProperty('--hold-progress','0%');}
  function cancel(){const previous=active;active=null;cancelRaf(frame);frame=0;hide();if(previous?.pointerId!=null)try{button.releasePointerCapture(previous.pointerId);}catch{}}
  function finish(count){const session=active;if(!session)return false;active=null;cancelRaf(frame);frame=0;let result=false;if(count>0)result=commit(count);stage.classList.remove('charging');button.classList.remove('holding');button.style.setProperty('--hold-progress','0%');qResult(result?result.current>=result.capacity?'満タン':'充填完了':count?'保存できませんでした':'充填なし');cancelDelay(resultTimer);resultTimer=delay(()=>{stage.hidden=true;qResult('');},850);onFinish(result);return result;}
  function qResult(text){stage.querySelector('#tank-charge-result').textContent=text;}
  function tick(){
    if(!active)return;const elapsed=clock()-active.started,total=active.duration,raw=clamp(elapsed/total),afterGuard=clamp((elapsed-180)/Math.max(1,total-180)),fillProgress=active.plan.replacing?clamp((afterGuard-.3)/.7):afterGuard,projected=Math.floor(active.plan.maxAdd*fillProgress),oldRatio=active.plan.loadedCapacity?active.plan.amount/active.plan.loadedCapacity:0,newRatio=active.plan.replacing?projected/active.plan.capacity:(active.plan.current+projected)/active.plan.capacity;
    active.projected=projected;button.style.setProperty('--hold-progress',`${raw*100}%`);drawStage(stage,{record,use,progress:afterGuard,fillProgress,oldRatio,newRatio,replacing:active.plan.replacing,reduced});if(raw>=1){finish(active.plan.maxAdd);return;}frame=raf(tick);
  }
  function begin(input){const plan=planFor();if(active||button.disabled||!plan?.maxAdd)return;onStart();const fraction=plan.maxAdd/Math.max(1,plan.capacity),duration=plan.replacing?Math.max(600,450+1050*fraction):Math.max(360,1500*fraction);active={...input,started:clock(),duration,plan,projected:0};stage.hidden=false;stage.dataset.tankUse=use;stage.style.setProperty('--tank-color',presentation.color);stage.querySelector('#tank-charge-icon').textContent=presentation.icon;stage.querySelector('#tank-charge-label').textContent=`${plan.label}へ充填`;qResult(plan.replacing?'旧内容を廃棄して入れ替え':'BASE STOCKから分子化');stage.classList.add('charging');button.classList.add('holding');drawStage(stage,{record,use,progress:0,fillProgress:0,oldRatio:plan.loadedCapacity?plan.amount/plan.loadedCapacity:0,newRatio:plan.current/Math.max(1,plan.capacity),replacing:plan.replacing,reduced});frame=raf(tick);}
  button.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;event.preventDefault();begin({pointerId:event.pointerId});try{button.setPointerCapture(event.pointerId);}catch{}});
  button.addEventListener('pointermove',event=>{if(active?.pointerId!==event.pointerId)return;const r=button.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)cancel();});
  button.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)finish(active.projected);});for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)cancel();});
  button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)begin({key:event.key});}else if(event.key==='Escape')cancel();});button.addEventListener('keyup',event=>{if(event.key===active?.key)finish(active.projected);});button.addEventListener('click',event=>event.preventDefault());button.addEventListener('contextmenu',event=>event.preventDefault());button.addEventListener('blur',cancel);
  owner.addEventListener('visibilitychange',()=>{if(owner.hidden)cancel();});owner.defaultView?.addEventListener('blur',cancel);
  return {cancel,refresh(){const plan=planFor();button.disabled=!plan?.maxAdd;button.dataset.replacing=String(!!plan?.replacing);button.setAttribute('aria-label',`${plan?.label??'タンク'}へ充填。長押し`);}};
}
