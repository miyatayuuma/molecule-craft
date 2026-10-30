// Shared sampling primitives. The owner supplies the frame loop and the active
// context; this module never dispatches synthetic pointer or keyboard events.
export const STANDARD_BUTTONS = Object.freeze({accept:0,cancel:1,action:2,lb:4,rb:5,lt:6,rt:7,select:8,start:9,l3:10,up:12,down:13,left:14,right:15});
export function createGamepadSampler({deadzone=.22,repeatDelay=380,repeatInterval=120}={}){
  let index=null,previous=[],repeatAt=new Map(),blocked=true,context=null;
  function reset(){previous=[];repeatAt.clear();blocked=true;}
  function sample(pads,now,nextContext){
    const available=Array.from(pads??[]).filter(p=>p?.connected&&p.mapping==='standard');
    let pad=available.find(p=>p.index===index);
    if(!pad){index=null;reset();pad=available[0];if(pad)index=pad.index;}
    if(nextContext!==context){context=nextContext;reset();}
    if(!pad)return {connected:false,pressed:[],released:[],repeat:[],axes:[0,0,0,0],held:[]};
    const held=pad.buttons.map(b=>!!b?.pressed),pressed=[],released=[],repeat=[];
    const axes=Array.from({length:4},(_,i)=>{const v=Number(pad.axes[i])||0;return Math.abs(v)<deadzone?0:Math.max(-1,Math.min(1,v));});
    if(blocked){if(!held.some(Boolean)&&axes.every(v=>v===0))blocked=false;previous=held;return {connected:true,index,pressed,released,repeat,axes:[0,0,0,0],held:[]};}
    for(let i=0;i<Math.max(held.length,previous.length);i++){
      if(held[i]&&!previous[i]){pressed.push(i);repeatAt.set(i,now+repeatDelay);}
      if(!held[i]&&previous[i]){released.push(i);repeatAt.delete(i);}
      if(held[i]&&previous[i]&&repeatAt.has(i)&&now>=repeatAt.get(i)){repeat.push(i);repeatAt.set(i,now+repeatInterval);}
    }
    previous=held;return {connected:true,index,pressed,released,repeat,axes,held};
  }
  return {sample,reset};
}

// Initial UI-only adapter. FIELD and 3D input are deliberately left to their
// respective domain owners; no pointer events are fabricated here.
export function startGamepadUi({window,document}){
  const sampler=createGamepadSampler();let stopped=false,lastDirection='',nextMove=0,lastScope=null;
  const eligible='button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
  function frame(now){
    if(stopped)return;
    const dialogs=[...document.querySelectorAll('dialog[open]')];
    const scope=dialogs.at(-1)??document.body;
    const field=document.body.dataset.mode==='veil'&&!dialogs.length;
    const context=field?'field':scope;
    if(scope!==lastScope){lastDirection='';lastScope=scope;}
    const sample=sampler.sample(document.hidden?[]:window.navigator.getGamepads?.()??[],now,context);
    if(sample.connected&&!field){
      const items=[...scope.querySelectorAll(eligible)].filter(el=>!el.closest('[hidden], [inert]')&&el.getClientRects().length&&window.getComputedStyle(el).visibility!=='hidden');
      const direction=(sample.held[12]||sample.axes[1]<-.55)?'up':(sample.held[13]||sample.axes[1]>.55)?'down':(sample.held[14]||sample.axes[0]<-.55)?'left':(sample.held[15]||sample.axes[0]>.55)?'right':'';
      if(direction&&(direction!==lastDirection||now>=nextMove)){
        const current=document.activeElement,rect=current?.getBoundingClientRect?.();let best=null,bestScore=Infinity;
        if(rect&&items.includes(current))for(const el of items){if(el===current)continue;const r=el.getBoundingClientRect(),dx=(r.left+r.right-rect.left-rect.right)/2,dy=(r.top+r.bottom-rect.top-rect.bottom)/2,primary=direction==='left'?-dx:direction==='right'?dx:direction==='up'?-dy:dy,cross=direction==='left'||direction==='right'?Math.abs(dy):Math.abs(dx);if(primary>1){const score=primary+cross*2;if(score<bestScore){best=el;bestScore=score;}}}
        (best??(!items.includes(current)?items[0]:null))?.focus({preventScroll:false});nextMove=now+(direction===lastDirection?120:380);
      }
      lastDirection=direction;
      if(sample.pressed.includes(0)){
        const target=document.activeElement;
        // Hold actions, text fields, sliders and selects need dedicated adapters.
        if(items.includes(target)&&target.matches('button:not(.hold-clear), a[href], summary'))target.click();
      }
      if(sample.pressed.includes(1)&&scope.tagName==='DIALOG')scope.requestClose?.();
    }
    window.requestAnimationFrame(frame);
  }
  const reset=()=>sampler.reset();window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);window.requestAnimationFrame(frame);
  return ()=>{stopped=true;reset();window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);};
}
