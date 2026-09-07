import { ELEMENTS } from './chemistry.js?v=20';
import { TANK_PRESENTATION } from './veil/collector-shell.js';
import { getCraftTransferEffects } from './craft-transfer-effects.js';

const stageOwners=new WeakMap();
const clamp=value=>Math.max(0,Math.min(1,value));
const bondTuple=bond=>Array.isArray(bond)?[bond[0],bond[1],bond[2]??1]:[bond?.a??bond?.from,bond?.b??bond?.to,bond?.order??1];
export const TANK_CHARGE_TIMING=Object.freeze({guardMs:260,minMs:1400,fullMs:3200,replaceMinMs:1800,replaceFullMs:3600,fadeMs:420});

export function moleculeChargeLayout(record,radius=14){
  const atoms=record?.atoms??[],count=atoms.length;if(!count)return[];
  if(count===1)return[{x:0,y:0}];
  if(count===2)return[{x:-radius*.72,y:0},{x:radius*.72,y:0}];
  const degree=Array(count).fill(0);
  for(const bond of record?.bonds??[]){const[a,b]=bondTuple(bond);if(Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<count&&b<count){degree[a]++;degree[b]++;}}
  const max=Math.max(...degree),center=max>=2?degree.indexOf(max):-1,positions=Array(count);
  if(center>=0){
    positions[center]={x:0,y:0};const others=[...Array(count).keys()].filter(index=>index!==center);
    for(const[index,atomIndex]of others.entries()){const ring=Math.floor(index/6),slot=index%6,slots=Math.min(6,others.length-ring*6),angle=-Math.PI/2+slot*Math.PI*2/Math.max(1,slots),r=radius+ring*7;positions[atomIndex]={x:Math.cos(angle)*r,y:Math.sin(angle)*r};}
  }else{
    const r=radius+Math.max(0,count-4)*.7;for(let index=0;index<count;index++){const angle=-Math.PI/2+index*Math.PI*2/count;positions[index]={x:Math.cos(angle)*r,y:Math.sin(angle)*r};}
  }
  return positions;
}

function measureStage(stage){
  const canvas=stage.querySelector('canvas'),rect=canvas.getBoundingClientRect(),dpr=Math.min(globalThis.devicePixelRatio??1,2),width=Math.max(1,rect.width),height=Math.max(1,rect.height),w=Math.max(1,Math.round(width*dpr)),h=Math.max(1,Math.round(height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  return{canvas,dpr,width,height,reactionPoint:{x:rect.left+width*.48,y:rect.top+height*.57}};
}

function drawMolecule(ctx,record,layout,{cx,cy,scale=1,alpha=1}){
  if(!layout.length||alpha<=0)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.lineCap='round';
  for(const bond of record?.bonds??[]){const[a,b,order]=bondTuple(bond),pa=layout[a],pb=layout[b];if(!pa||!pb)continue;const dx=(pb.x-pa.x)*scale,dy=(pb.y-pa.y)*scale,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,copies=Math.max(1,Math.min(3,Math.round(order)||1));ctx.strokeStyle='#b8d5dc';ctx.lineWidth=1.5;for(let copy=0;copy<copies;copy++){const offset=(copy-(copies-1)/2)*2.2;ctx.beginPath();ctx.moveTo(cx+pa.x*scale+nx*offset,cy+pa.y*scale+ny*offset);ctx.lineTo(cx+pb.x*scale+nx*offset,cy+pb.y*scale+ny*offset);ctx.stroke();}}
  for(const[index,symbol]of(record?.atoms??[]).entries()){const p=layout[index];if(!p)continue;ctx.fillStyle=ELEMENTS[symbol]?.color??'#d9f7ff';ctx.beginPath();ctx.arc(cx+p.x*scale,cy+p.y*scale,Math.max(1.5,(symbol==='H'?3.1:4.2)*scale),0,Math.PI*2);ctx.fill();}
  ctx.restore();
}

function drawStage(stage,{record,use,progress,fillProgress,oldRatio,newRatio,replacing,reduced,visualCycles=1,fade=1},metrics){
  const{canvas,dpr,width,height}=metrics,ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const color=TANK_PRESENTATION[use]?.color??'#78d5e7',tank={x:width-70,y:12,w:44,h:height-24};
  const rounded=(x,y,w,h,r)=>{if(ctx.roundRect)ctx.roundRect(x,y,w,h,r);else ctx.rect(x,y,w,h);};
  ctx.strokeStyle=color;ctx.globalAlpha=.75;ctx.lineWidth=2;ctx.beginPath();rounded(tank.x,tank.y,tank.w,tank.h,10);ctx.stroke();ctx.save();ctx.beginPath();rounded(tank.x+4,tank.y+4,tank.w-8,tank.h-8,7);ctx.clip();ctx.fillStyle=color;ctx.globalAlpha=.35;ctx.fillRect(tank.x+4,tank.y+tank.h-4-(tank.h-8)*newRatio,tank.w-8,(tank.h-8)*newRatio);ctx.restore();
  if(reduced)return;
  if(replacing&&progress<.3){for(let i=0;i<7;i++){const phase=clamp(progress/.3-i*.035),x=tank.x+tank.w/2+(phase*65),y=tank.y+tank.h*(.22+(i%4)*.18)-phase*14;ctx.fillStyle='#d99b80';ctx.globalAlpha=(1-phase)*oldRatio;ctx.beginPath();ctx.arc(x,y,2.5+(i%2),0,Math.PI*2);ctx.fill();}}
  const atoms=record?.atoms??[],layout=moleculeChargeLayout(record),center={x:width*.48,y:height*.58},capped=clamp(fillProgress),phase=(Math.min(.9999,capped)*Math.max(1,visualCycles))%1;
  if(atoms.length&&fillProgress>0){
    if(phase<.46){
      const t=phase/.46;
      for(let i=0;i<Math.min(10,atoms.length);i++){const angle=i*2.399+phase*7.2,radius=19-(t*7)+(i%3)*2,x=center.x+Math.cos(angle)*radius,y=center.y+Math.sin(angle)*radius*.65;ctx.fillStyle=ELEMENTS[atoms[i]]?.color??'#d9f7ff';ctx.globalAlpha=(.55+.4*t)*fade;ctx.beginPath();ctx.arc(x,y,2.5+(atoms[i]==='H'?0:1),0,Math.PI*2);ctx.fill();}
    }else if(phase<.70){
      const t=(phase-.46)/.24,eased=1-Math.pow(1-t,3);
      for(let i=0;i<Math.min(layout.length,10);i++){const p=layout[i],jitter=(1-eased)*6,x=center.x+p.x*eased+Math.sin(i*2.1+phase*12)*jitter,y=center.y+p.y*eased+Math.cos(i*1.7+phase*11)*jitter;ctx.fillStyle=ELEMENTS[atoms[i]]?.color??'#d9f7ff';ctx.globalAlpha=(.7+.3*eased)*fade;ctx.beginPath();ctx.arc(x,y,atoms[i]==='H'?3:4,0,Math.PI*2);ctx.fill();}
      if(t>.42)drawMolecule(ctx,record,layout,{cx:center.x,cy:center.y,scale:eased,alpha:(t-.42)/.58*.65*fade});
    }else if(phase<.86){
      const pulse=1+Math.sin((phase-.70)/.16*Math.PI)*.06;drawMolecule(ctx,record,layout,{cx:center.x,cy:center.y,scale:pulse,alpha:fade});
    }else{
      const t=(phase-.86)/.14,eased=t*t*(3-2*t),tankCenter={x:tank.x+tank.w/2,y:tank.y+tank.h*.5},cx=center.x+(tankCenter.x-center.x)*eased,cy=center.y+(tankCenter.y-center.y)*eased,scale=1-eased*.78;drawMolecule(ctx,record,layout,{cx,cy,scale,alpha:(1-eased*.78)*fade});
    }
  }
  ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.globalAlpha=.28*fade;ctx.beginPath();ctx.arc(center.x,center.y,12+Math.sin(fillProgress*Math.PI*6)*2,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
}

function visualCycleCount(plan,duration){return plan.maxAdd>1&&duration>=2600?2:1;}

export function bindTankChargeAction(button,{stage,use,record,planFor,commit,onStart=()=>{},onFinish=()=>{},clock=()=>performance.now(),raf=requestAnimationFrame,cancelRaf=cancelAnimationFrame,reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false,transferEffects=null}={}){
  let active=null,frame=0,lastDrawing=null,lastMetrics=null;const token={};const owner=button.ownerDocument,presentation=TANK_PRESENTATION[use],transfers=transferEffects??getCraftTransferEffects(owner,{reduced});
  button.replaceChildren(Object.assign(owner.createElement('i'),{textContent:presentation.icon}),Object.assign(owner.createElement('span'),{textContent:`${planFor()?.label??'タンク'}へ充填`}));button.style.setProperty('--tank-color',presentation.color);
  function ownsStage(){return stageOwners.get(stage)===token;}
  function hide(){if(!ownsStage())return;stage.hidden=true;stage.classList.remove('charging','fading');stageOwners.delete(stage);}
  function fadeOut(){
    cancelRaf(frame);frame=0;button.classList.remove('holding');button.style.setProperty('--hold-progress','0%');
    if(!ownsStage())return;
    stage.classList.remove('charging');stage.classList.add('fading');
    const started=clock(),drawing=lastDrawing,metrics=lastMetrics;
    function drain(){if(!ownsStage())return;const progress=clamp((clock()-started)/TANK_CHARGE_TIMING.fadeMs);if(progress>=1){hide();return;}if(drawing&&metrics)drawStage(stage,{...drawing,fillProgress:drawing.fillProgress+progress*.12,fade:1-progress},metrics);frame=raf(drain);}
    if(reduced)hide();else frame=raf(drain);
  }
  function cancel(){const previous=active;active=null;if(previous)fadeOut();if(previous?.pointerId!=null)try{button.releasePointerCapture(previous.pointerId);}catch{}}
  function finish(count){const session=active;if(!session)return false;active=null;let result=false;if(count>0)result=commit(count);qResult(result?result.current>=result.capacity?'満タン':'充填完了':count?'保存できませんでした':'充填なし');fadeOut();onFinish(result);return result;}
  function qResult(text){stage.querySelector('#tank-charge-result').textContent=text;}
  function tick(){
    if(!active)return;const elapsed=clock()-active.started,total=active.duration,raw=clamp(elapsed/total),afterGuard=clamp((elapsed-TANK_CHARGE_TIMING.guardMs)/Math.max(1,total-TANK_CHARGE_TIMING.guardMs)),fillProgress=active.plan.replacing?clamp((afterGuard-.3)/.7):afterGuard,projected=Math.floor(active.plan.maxAdd*fillProgress),oldRatio=active.plan.loadedCapacity?active.plan.amount/active.plan.loadedCapacity:0,newRatio=active.plan.replacing?projected/active.plan.capacity:(active.plan.current+projected)/active.plan.capacity,visualCycles=active.visualCycles,visualStep=fillProgress>0?Math.floor(Math.min(.9999,fillProgress)*visualCycles):-1;
    active.projected=projected;if(visualStep>active.visualStep){for(let step=active.visualStep+1;step<=visualStep;step++)transfers?.chargeFromStock?.(record,active.metrics.reactionPoint);active.visualStep=visualStep;}
    button.style.setProperty('--hold-progress',`${raw*100}%`);lastDrawing={record,use,progress:afterGuard,fillProgress,oldRatio,newRatio,replacing:active.plan.replacing,reduced,visualCycles};lastMetrics=active.metrics;drawStage(stage,lastDrawing,active.metrics);if(raw>=1){finish(active.plan.maxAdd);return;}frame=raf(tick);
  }
  function begin(input){const plan=planFor();if(active||button.disabled||!plan?.maxAdd)return;onStart();cancelRaf(frame);stageOwners.set(stage,token);stage.classList.remove('fading');const fraction=plan.maxAdd/Math.max(1,plan.capacity),duration=plan.replacing?Math.max(TANK_CHARGE_TIMING.replaceMinMs,TANK_CHARGE_TIMING.replaceFullMs*fraction):Math.max(TANK_CHARGE_TIMING.minMs,TANK_CHARGE_TIMING.fullMs*fraction);stage.hidden=false;const metrics=measureStage(stage),visualCycles=visualCycleCount(plan,duration);active={...input,started:clock(),duration,plan,projected:0,visualStep:-1,visualCycles,metrics};stage.dataset.tankUse=use;stage.style.setProperty('--tank-color',presentation.color);stage.querySelector('#tank-charge-icon').textContent=presentation.icon;stage.querySelector('#tank-charge-label').textContent=`${plan.label}へ充填`;qResult(plan.replacing?'✕ → ◉':'● → ◉');stage.setAttribute('aria-label',plan.replacing?'旧内容を廃棄して入れ替え':'原子から分子を組み立ててタンクへ充填');stage.classList.add('charging');button.classList.add('holding');lastDrawing={record,use,progress:0,fillProgress:0,oldRatio:plan.loadedCapacity?plan.amount/plan.loadedCapacity:0,newRatio:plan.current/Math.max(1,plan.capacity),replacing:plan.replacing,reduced,visualCycles};lastMetrics=metrics;drawStage(stage,lastDrawing,metrics);frame=raf(tick);}
  button.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;event.preventDefault();begin({pointerId:event.pointerId});try{button.setPointerCapture(event.pointerId);}catch{}});
  button.addEventListener('pointermove',event=>{if(active?.pointerId!==event.pointerId)return;const r=button.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)cancel();});
  button.addEventListener('pointerup',event=>{if(active?.pointerId===event.pointerId)finish(active.projected);});for(const type of ['pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)cancel();});
  button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)begin({key:event.key});}else if(event.key==='Escape')cancel();});button.addEventListener('keyup',event=>{if(event.key===active?.key)finish(active.projected);});button.addEventListener('click',event=>event.preventDefault());button.addEventListener('contextmenu',event=>event.preventDefault());button.addEventListener('blur',cancel);
  owner.addEventListener('visibilitychange',()=>{if(owner.hidden)cancel();});owner.defaultView?.addEventListener('blur',cancel);
  return {cancel,refresh(){const plan=planFor();button.disabled=!plan?.maxAdd;button.dataset.replacing=String(!!plan?.replacing);button.setAttribute('aria-label',`${plan?.label??'タンク'}へ充填。長押し`);}};
}
