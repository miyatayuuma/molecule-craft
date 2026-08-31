// Immediate one-shot, then a deliberate hold. Never catch up missed timers.
export function bindRepeatAction(button,{action,delay=360,interval=140,clock=globalThis,onActive=()=>{}}){
  let timer=null,pointer=null,key=null;
  const win=button.ownerDocument.defaultView,doc=button.ownerDocument;
  function stop(){if(timer!==null)clock.clearTimeout(timer);timer=null;const held=pointer;pointer=null;key=null;button.classList.remove('is-making');onActive(false);if(held!==null)try{button.releasePointerCapture(held);}catch{}}
  function repeat(){timer=null;if(button.disabled||button.hidden||!button.isConnected||doc.hidden||action()===false){stop();return;}timer=clock.setTimeout(repeat,interval);}
  function start(){if(button.disabled||button.hidden||action()===false){stop();return;}button.classList.add('is-making');onActive(true);timer=clock.setTimeout(repeat,delay);}
  button.addEventListener('pointerdown',e=>{if(e.button!==0||pointer!==null||key!==null)return;e.preventDefault();pointer=e.pointerId;button.focus({preventScroll:true});try{button.setPointerCapture(pointer);}catch{}start();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])win.addEventListener(type,e=>{if(pointer!==null&&e.pointerId===pointer)stop();});
  button.addEventListener('keydown',e=>{if(![' ','Enter'].includes(e.key))return;e.preventDefault();if(e.repeat||key!==null||pointer!==null)return;key=e.key;start();});
  win.addEventListener('keyup',e=>{if(e.key===key)stop();});
  // Screen-reader / programmatic activation has no preceding pointer or key hold.
  button.addEventListener('click',e=>{if(e.detail===0&&pointer===null&&key===null&&!button.disabled&&!button.hidden)action();});
  button.addEventListener('contextmenu',e=>e.preventDefault());button.addEventListener('blur',stop);win.addEventListener('blur',stop);win.addEventListener('pagehide',stop);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop();});
  return {stop};
}
