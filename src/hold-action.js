// Pointer/keyboard confirmation with visible progress. A click alone never acts.
export function bindHoldAction(button, action, { duration = 1000, clock = () => performance.now(), raf = requestAnimationFrame, cancelRaf = cancelAnimationFrame } = {}) {
  let active = null, frame = 0;
  const owner = button.ownerDocument;
  function cancel() {
    const previous = active; active = null; cancelRaf(frame); frame = 0;
    button.style.setProperty('--hold-progress', '0%'); button.classList.remove('holding');
    if (previous?.pointerId != null) try { button.releasePointerCapture(previous.pointerId); } catch {}
  }
  function tick() {
    if (!active) return;
    const progress = Math.min(1, (clock() - active.started) / duration);
    button.style.setProperty('--hold-progress', `${progress * 100}%`);
    if (progress >= 1) { cancel(); action(); } else frame = raf(tick);
  }
  function begin(input) { if (active || button.disabled) return; active = { ...input, started: clock() }; button.classList.add('holding'); frame = raf(tick); }
  button.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault(); begin({ pointerId: event.pointerId });
    try { button.setPointerCapture(event.pointerId); } catch {}
  });
  button.addEventListener('pointermove', event => {
    if (active?.pointerId !== event.pointerId) return;
    const r = button.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) cancel();
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(type, event => { if (active?.pointerId === event.pointerId) cancel(); });
  button.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) begin({ key: event.key }); } else if (event.key === 'Escape') cancel(); });
  button.addEventListener('keyup', event => { if (event.key === active?.key) cancel(); });
  button.addEventListener('click', event => event.preventDefault());
  button.addEventListener('contextmenu', event => event.preventDefault());
  button.addEventListener('blur', cancel);
  owner.addEventListener('visibilitychange', () => { if (owner.hidden) cancel(); });
  owner.defaultView?.addEventListener('blur', cancel);
  return { cancel };
}

// A short press is inert. Once the hold threshold is crossed, action repeats
// until release or until the action reports that production cannot continue.
export function bindRepeatHoldAction(button, action, { delay = 520, interval = 150, clock = () => performance.now(), raf = requestAnimationFrame, cancelRaf = cancelAnimationFrame } = {}) {
  let active=null,frame=0;const owner=button.ownerDocument;
  function cancel(){const previous=active;active=null;cancelRaf(frame);frame=0;button.style.setProperty('--hold-progress','0%');button.classList.remove('holding');if(previous?.pointerId!=null)try{button.releasePointerCapture(previous.pointerId);}catch{}}
  function tick(){
    if(!active)return;const elapsed=clock()-active.started;button.style.setProperty('--hold-progress',`${Math.min(100,elapsed/delay*100)}%`);
    if(elapsed>=active.nextAt){active.nextAt+=interval;if(action()===false){cancel();return;}}
    frame=raf(tick);
  }
  function begin(input){if(active||button.disabled)return;active={...input,started:clock(),nextAt:delay};button.classList.add('holding');frame=raf(tick);}
  button.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false)return;event.preventDefault();begin({pointerId:event.pointerId});try{button.setPointerCapture(event.pointerId);}catch{}});
  button.addEventListener('pointermove',event=>{if(active?.pointerId!==event.pointerId)return;const r=button.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)cancel();});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,event=>{if(active?.pointerId===event.pointerId)cancel();});
  button.addEventListener('keydown',event=>{if([' ','Enter'].includes(event.key)){event.preventDefault();if(!event.repeat)begin({key:event.key});}else if(event.key==='Escape')cancel();});
  button.addEventListener('keyup',event=>{if(event.key===active?.key)cancel();});button.addEventListener('click',event=>event.preventDefault());button.addEventListener('contextmenu',event=>event.preventDefault());button.addEventListener('blur',cancel);
  owner.addEventListener('visibilitychange',()=>{if(owner.hidden)cancel();});owner.defaultView?.addEventListener('blur',cancel);return {cancel};
}
