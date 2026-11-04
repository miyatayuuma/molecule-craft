// Shared sampling primitives. The owner supplies the frame loop and the active
// context; this module never dispatches synthetic pointer or keyboard events.
export const STANDARD_BUTTONS = Object.freeze({accept:0,cancel:1,action:2,lb:4,rb:5,lt:6,rt:7,select:8,start:9,l3:10,up:12,down:13,left:14,right:15});
export function createGamepadSampler({deadzone=.22,repeatDelay=380,repeatInterval=120}={}){
  let index=null,previous=[],repeatAt=new Map(),blocked=true,context=null,threshold=deadzone;
  function reset(){previous=[];repeatAt.clear();blocked=true;}
  function sample(pads,now,nextContext){
    const available=Array.from(pads??[]).filter(p=>p?.connected&&p.mapping==='standard');
    let pad=available.find(p=>p.index===index);
    if(!pad){index=null;reset();pad=available[0];if(pad)index=pad.index;}
    if(nextContext!==context){context=nextContext;reset();}
    if(!pad)return {connected:false,pressed:[],released:[],repeat:[],axes:[0,0,0,0],held:[]};
    const held=pad.buttons.map(b=>!!b?.pressed),pressed=[],released=[],repeat=[];
    const axes=Array.from({length:4},(_,i)=>{const v=Number(pad.axes[i])||0;return Math.abs(v)<threshold?0:Math.max(-1,Math.min(1,v));});
    if(blocked){if(!held.some(Boolean)&&axes.every(v=>v===0))blocked=false;previous=held;return {connected:true,index,pressed,released,repeat,axes:[0,0,0,0],held:[]};}
    for(let i=0;i<Math.max(held.length,previous.length);i++){
      if(held[i]&&!previous[i]){pressed.push(i);repeatAt.set(i,now+repeatDelay);}
      if(!held[i]&&previous[i]){released.push(i);repeatAt.delete(i);}
      if(held[i]&&previous[i]&&repeatAt.has(i)&&now>=repeatAt.get(i)){repeat.push(i);repeatAt.set(i,now+repeatInterval);}
    }
    previous=held;return {connected:true,index,pressed,released,repeat,axes,held};
  }
  function setDeadzone(value){if(Number.isFinite(value)&&value>=.1&&value<=.4){threshold=value;reset();}}
  return {sample,reset,setDeadzone,getDeadzone:()=>threshold};
}

// Initial UI-only adapter. FIELD and 3D input are deliberately left to their
// respective domain owners; no pointer events are fabricated here.
export function startGamepadUi({window,document,onFieldSample=()=>{},onUiSample=()=>false}){
  const sampler=createGamepadSampler();
  try{
    const value=Number(window.localStorage?.getItem('molecule-craft-gamepad-deadzone'));
    if(Number.isFinite(value)&&value>=.1&&value<=.4)sampler.setDeadzone(value);
  }catch{}
  let stopped=false,lastDirection='',nextMove=0,lastScope=null,focusMemory=null,holdTarget=null,keyboardTarget=null;
  const eligible='button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';
  const focusAttributes=['data-molecule-id','data-entry-id','data-species','data-region','data-tank-role','data-lab-slot','data-book-tab','data-palette-tab','data-element','data-part-id'];
  let guide=null,keyboard=null;
  if(document.createElement&&document.body?.append){
    guide=document.createElement('dialog');
    guide.id='gamepad-guide';guide.className='gamepad-guide';
    guide.innerHTML='<h2>ゲームパッド操作</h2><p data-gamepad-guide-copy></p><p>十字キー・左スティック：項目移動　A：決定　B：戻る　LB/RB：タブ切替</p><p>SELECT：このガイド　START：メニュー／探索の一時停止</p><p>スティックの遊び：<button type="button" data-gamepad-deadzone="0.16">小</button> <button type="button" data-gamepad-deadzone="0.22">標準</button> <button type="button" data-gamepad-deadzone="0.30">大</button></p><button type="button" data-gamepad-guide-close>閉じる</button>';
    guide.querySelector('[data-gamepad-guide-close]')?.addEventListener('click',()=>guide.close());
    for(const button of guide.querySelectorAll('[data-gamepad-deadzone]'))button.addEventListener('click',()=>{
      const value=Number(button.dataset.gamepadDeadzone);sampler.setDeadzone(value);
      try{window.localStorage?.setItem('molecule-craft-gamepad-deadzone',String(value));}catch{}
      for(const option of guide.querySelectorAll('[data-gamepad-deadzone]'))option.setAttribute('aria-pressed',String(option===button));
    });
    document.body.append(guide);
    keyboard=document.createElement('dialog');
    keyboard.id='gamepad-keyboard';keyboard.className='gamepad-keyboard';
    keyboard.innerHTML='<h2>分子を検索</h2><p>左スティックで文字を選び、Aで入力します。</p><div class="gamepad-keyboard-keys"></div>';
    const keys=keyboard.querySelector('.gamepad-keyboard-keys');
    for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'){
      const button=document.createElement('button');button.type='button';button.textContent=letter;
      button.addEventListener('click',()=>writeKeyboard(letter));keys.append(button);
    }
    for(const [label,value]of [['空白',' '],['一字消す','BACK'],['消去','CLEAR'],['完了','DONE']]){
      const button=document.createElement('button');button.type='button';button.textContent=label;
      button.addEventListener('click',()=>writeKeyboard(value));keys.append(button);
    }
    keyboard.addEventListener('close',()=>{const target=keyboardTarget;keyboardTarget=null;target?.focus?.({preventScroll:true});});
    document.body.append(keyboard);
  }
  function writeKeyboard(value){
    if(!keyboardTarget)return;
    if(value==='DONE'){keyboard.close();return;}
    if(value==='BACK')keyboardTarget.value=keyboardTarget.value.slice(0,-1);
    else if(value==='CLEAR')keyboardTarget.value='';
    else keyboardTarget.value+=value;
    keyboardTarget.dispatchEvent(new window.Event('input',{bubbles:true}));
  }
  function openKeyboard(target){
    if(!keyboard||keyboard.open)return;
    keyboardTarget=target;keyboard.showModal();
    keyboard.querySelector('button')?.focus({preventScroll:true});
  }
  function focusToken(el){
    if(!el)return null;
    if(el.id)return {name:'id',value:el.id};
    for(const name of focusAttributes)if(el.hasAttribute?.(name))return{name,value:el.getAttribute(name)};
    return null;
  }
  function focusMatches(items,token){
    if(!token)return null;
    return items.find(el=>(token.name==='id'?el.id===token.value:el.getAttribute(token.name)===token.value))??null;
  }
  function closeDialog(dialog){
    if(typeof dialog.requestClose==='function')dialog.requestClose();
    else dialog.close?.();
  }
  function guideCopy(){
    const lab=document.querySelector('#reaction-lab-dialog')?.open;
    const field=document.body.dataset.mode==='veil';
    if(field)return 'FIELD：左スティックで移動　B：BURST　X：SHOCK　RT：推進　停止中にA長押し：帰還';
    if(lab)return 'LAB：Aで3D照準を開始・つかむ／離す　Bで照準終了　右スティック：完成高分子回転　LT/RT：ズーム　pH上で上下：酸性・中性・塩基性';
    return 'CRAFT：L3で3D操作へ／戻る　左スティック：移動　A：つかむ／離す　右スティック：回転　LT/RT：ズーム　B：元に戻す　X長押し：全片付け';
  }
  function frame(now){
    if(stopped)return;
    const dialogs=[...document.querySelectorAll('dialog[open]')],dialog=dialogs.at(-1);
    const partial=dialog?.querySelector('#partial-fill-confirm:not([hidden])');
    const picker=dialog?.querySelector('[data-lab-picker]:not([hidden])');
    const scope=partial??picker??dialog??document.body;
    const field=document.body.dataset.mode==='veil'&&!dialogs.length;
    const context=field?'field':scope;
    if(scope!==lastScope){
      if(holdTarget)holdTarget.gamepadHold?.(false);
      holdTarget=null;lastDirection='';focusMemory=null;lastScope=scope;
    }
    const sample=sampler.sample(document.hidden?[]:window.navigator.getGamepads?.()??[],now,context);
    if(holdTarget&&(!sample.connected||!sample.held[0]||document.activeElement!==holdTarget)){
      holdTarget.gamepadHold?.(false);holdTarget=null;
    }
    if(sample.connected&&sample.pressed.includes(8)&&guide){
      if(guide.open)guide.close();
      else {
        guide.querySelector('[data-gamepad-guide-copy]').textContent=guideCopy();
        for(const option of guide.querySelectorAll('[data-gamepad-deadzone]'))option.setAttribute('aria-pressed',String(Number(option.dataset.gamepadDeadzone)===sampler.getDeadzone()));
        guide.showModal();guide.querySelector('[data-gamepad-guide-close]')?.focus({preventScroll:true});
      }
    }
    if(sample.connected&&!field&&!dialog&&sample.pressed.includes(9))document.getElementById?.('open-menu')?.click();
    onFieldSample(field&&sample.connected?sample:null);
    const consumed=onUiSample(sample.connected&&!field?sample:null,{scope,dialog,now});
    if(sample.connected&&!field&&!consumed){
      const items=[...scope.querySelectorAll(eligible)].filter(el=>!el.closest('[hidden], [inert], [aria-hidden="true"]')&&el.tabIndex>=0&&el.getClientRects().length&&window.getComputedStyle(el).visibility!=='hidden');
      let current=document.activeElement;
      if(items.includes(current))focusMemory=focusToken(current);
      else {
        const restored=focusMatches(items,focusMemory);
        if(restored){restored.focus({preventScroll:true});current=restored;}
      }
      const direction=(sample.held[12]||sample.axes[1]<-.55)?'up':(sample.held[13]||sample.axes[1]>.55)?'down':(sample.held[14]||sample.axes[0]<-.55)?'left':(sample.held[15]||sample.axes[0]>.55)?'right':'';
      if(direction&&(direction!==lastDirection||now>=nextMove)){
        document.body.classList.add('gamepad-focus-active');
        const adjustable=items.includes(current)&&(['up','down'].includes(direction));
        if(adjustable&&typeof current.gamepadAdjust==='function')current.gamepadAdjust(direction);
        else if(adjustable&&current.tagName==='SELECT'){
          const options=[...current.options].filter(option=>!option.disabled&&!option.hidden);
          const next=options.indexOf(current.selectedOptions[0])+(direction==='down'?1:-1);
          if(options[next]){current.value=options[next].value;current.dispatchEvent(new window.Event('change',{bubbles:true}));}
        }else{
          const rect=items.includes(current)?current.getBoundingClientRect():null;
          let best=null,bestScore=Infinity;
          if(rect)for(const el of items){
            if(el===current)continue;
            const r=el.getBoundingClientRect(),dx=(r.left+r.right-rect.left-rect.right)/2,dy=(r.top+r.bottom-rect.top-rect.bottom)/2;
            const primary=direction==='left'?-dx:direction==='right'?dx:direction==='up'?-dy:dy,cross=direction==='left'||direction==='right'?Math.abs(dy):Math.abs(dx);
            if(primary>1){const score=primary+cross*2;if(score<bestScore){best=el;bestScore=score;}}
          }
          const chosen=best??(!items.includes(current)?items[0]:null);
          chosen?.focus({preventScroll:false});if(chosen)focusMemory=focusToken(chosen);
        }
        nextMove=now+(direction===lastDirection?120:380);
      }
      lastDirection=direction;
      if(sample.pressed.includes(4)||sample.pressed.includes(5)){
        const active=scope.querySelector('[role="tablist"] [role="tab"][aria-selected="true"]');
        const group=active?.closest('[role="tablist"]'),tabs=group?[...group.querySelectorAll('[role="tab"]')].filter(el=>!el.disabled&&el.getClientRects().length):[];
        if(tabs.length){
          const next=(tabs.indexOf(active)+(sample.pressed.includes(5)?1:-1)+tabs.length)%tabs.length;
          tabs[next].click();tabs[next].focus();focusMemory=focusToken(tabs[next]);document.body.classList.add('gamepad-focus-active');
        }
      }
      if(sample.pressed.includes(0)){
        const target=document.activeElement;
        if(dialog?.gamepadAdvance){dialog.gamepadAdvance();}
        else if(items.includes(target)&&typeof target.gamepadHold==='function'){
          target.gamepadHold(true);holdTarget=target;
        }else if(items.includes(target)&&target.matches('input[type="search"], input[type="text"]'))openKeyboard(target);
        else if(items.includes(target)&&target.matches('button:not(.hold-clear), a[href], summary'))target.click();
      }
      if(sample.pressed.includes(1)){
        if(partial)partial.querySelector('button')?.click();
        else if(dialog?.id==='collection-dialog'&&!dialog.querySelector('#collection-detail')?.hidden){
          const back=dialog.querySelector('#detail-back, #motif-detail-back');
          if(back)back.click();else closeDialog(dialog);
        }
        else if(dialog)closeDialog(dialog);
      }
    }
    window.requestAnimationFrame(frame);
  }
  const reset=()=>{
    sampler.reset();
    if(holdTarget)holdTarget.gamepadHold?.(false);
    holdTarget=null;onFieldSample(null);onUiSample(null,{});
  };
  const clearFocusStyle=()=>document.body.classList.remove('gamepad-focus-active');
  document.addEventListener('pointerdown',clearFocusStyle);
  document.addEventListener('keydown',clearFocusStyle);
  window.addEventListener('blur',reset);
  document.addEventListener('visibilitychange',reset);
  window.requestAnimationFrame(frame);
  return ()=>{
    stopped=true;reset();guide?.remove();keyboard?.remove();
    window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',reset);
    document.removeEventListener('pointerdown',clearFocusStyle);document.removeEventListener('keydown',clearFocusStyle);
  };
}
