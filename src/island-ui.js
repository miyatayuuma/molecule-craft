import {ISLAND_SAMPLES,SAMPLE_BY_ID,ISLAND_TARGETS,TARGET_BY_ID,SALT_ROCK,ISLAND_DISCOVERIES,DISCOVERY_BY_ID,ISLAND_SPECIES} from './island-data.js?v=33';
import {unlockSample,collectSalt,applySample,ignite,drain,stepIsland,takeIslandEvents,resetIsland,describeTarget} from './island-engine.js?v=33';
import {createIslandStorage,islandSnapshot} from './island-save.js?v=33';
import {createIslandScene} from './island-scene.js?v=33';
import {createIslandAudio} from './island-audio.js?v=33';

export function createIslandController({THREE,records=[],craftedIds=[],getCurrent=()=>null,canTravel=()=>true,beforeTravel=()=>{},onScene=()=>{}}) {
  const doc=document,win=window,q=id=>doc.getElementById(id),view=q('island-view');
  if(!view)return null;
  const host=q('island-canvas'),tray=q('island-samples'),workspace=doc.querySelector('.workspace');
  const storage=createIslandStorage({onStatus:text=>{q('island-save-status').textContent=text;q('island-save-status').hidden=!text;}});
  let world=storage.read(),active=false,scene=null,raf=0,lastTime=0,accumulator=0,lastSave=0,lastInspector=0;
  let selectedTarget=null,drag=null,suppressClick=false,multi=null,toastUntil=0,noticeQueue=[],pendingThrows=[];
  let currentCraft=null,carryBusy=false;
  const pointers=new Map(),pins=new Map(),audio=createIslandAudio({muted:world.preferences.muted});
  const shortNames={pond:'池',garden:'庭',cell:'装置',burner:'コンロ',cave:'洞窟',resin:'レンズ',crystal:'結晶',flask:'風船',soil:'砂地','salt-rock':'白い粒'};
  const glyphs={pond:'≈',garden:'❧',cell:'ϟ',burner:'♨',cave:'✦',resin:'◇',crystal:'◈',flask:'◍',soil:'·','salt-rock':'⬡'};
  const el=(tag,text,className)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;};
  const button=(text,fn,className)=>{const b=el('button',text,className);b.type='button';b.addEventListener('click',fn);return b;};
  for(const id of craftedIds)if(SAMPLE_BY_ID.get(id)?.source==='craft')unlockSample(world,id);

  function save(){return storage.write(world);}
  function busy(){return !!doc.querySelector('dialog[open]');}
  function ensureScene() {
    if(scene)return;
    scene=createIslandScene({THREE,host,records,onUnavailable:text=>{
      q('island-unavailable').textContent=text||'3D表示を開始できません。WebGL対応ブラウザで開いてください。クラフトと図鑑には戻れます。';q('island-unavailable').hidden=false;
    }});
    if(scene)bindCamera(scene.canvas);
  }
  function flushThrows() {
    for(const drop of pendingThrows)applySample(world,drop.id,drop.target,drop.dose);
    pendingThrows=[];scene?.finishThrows();processEvents();
  }
  function chooseScene(next,{initial=false}={}) {
    const wantsIsland=next==='island';
    if(!initial&&!canTravel())return false;
    if(!initial&&active===wantsIsland)return true;
    cancelDrag();cancelCamera();flushThrows();beforeTravel();
    active=wantsIsland;world.preferences.scene=next;
    doc.body.dataset.scene=next;view.hidden=!active;workspace.hidden=active;
    q('scene-island').setAttribute('aria-pressed',String(active));q('scene-craft').setAttribute('aria-pressed',String(!active));
    q('island-mini-progress').hidden=!active;
    onScene(active);audio.pause();lastTime=0;accumulator=0;
    if(active){audio.resume();ensureScene();scene?.resize();renderTray();renderInspector();startFrames();}
    else{cancelAnimationFrame(raf);raf=0;}
    if(!initial) {try{win.history.replaceState(null,'',`#${next}`);}catch{}save();}
    refreshCarry();return true;
  }
  function chooseSample(id) {
    if(!world.samples.includes(id))return;
    audio.unlock();world.preferences.selected=world.preferences.selected===id?null:id;
    renderSelection();save();
  }
  function renderTray() {
    tray.replaceChildren();
    const samples=ISLAND_SAMPLES.filter(s=>world.samples.includes(s.id));
    for(const sample of samples) {
      const b=button('',()=>{if(suppressClick){suppressClick=false;return;}chooseSample(sample.id);},'sample-bottle');
      b.dataset.sample=sample.id;b.style.setProperty('--sample-color',sample.color);
      b.setAttribute('aria-label',`${sample.name} ${sample.formula}を持つ`);
      const icon=el('span',undefined,'bottle-art');icon.append(el('span',undefined,'bottle-liquid'));
      b.append(icon,el('strong',sample.formula),el('small',sample.name));tray.append(b);
    }
    if(!samples.length) {
      const empty=el('div',undefined,'island-empty');
      empty.append(el('span','◌','empty-orbit'),el('p','つくった分子を、ここへ。'));tray.append(empty);
    }
    const make=button('＋',()=>chooseScene('craft'),'sample-new');make.setAttribute('aria-label','新しい分子をクラフトする');make.append(el('small','つくる'));tray.append(make);
    q('island-sample-count').textContent=`標本 ${samples.length} / ${ISLAND_SAMPLES.length}`;
    renderSelection();
  }
  function renderSelection() {
    const id=world.preferences.selected,sample=SAMPLE_BY_ID.get(id);
    for(const b of tray.querySelectorAll('[data-sample]'))b.setAttribute('aria-pressed',String(b.dataset.sample===id));
    q('island-held-name').textContent=sample?`${sample.formula} を持っている`:'まずは、島をさわってみよう';
    q('island-held-hint').textContent=sample?'場所をタップ、またはボトルをドラッグ':'分子をつくると、ここへ持ってこられます';
    q('island-cancel-sample').hidden=!sample;q('island-dose').hidden=!sample;
    view.classList.toggle('holding-sample',!!sample);
    for(const [targetId,pin]of pins) {
      pin.hidden=!sample&&!['salt-rock','burner'].includes(targetId);
      pin.setAttribute('aria-label',targetId==='salt-rock'?'白い粒の岩から塩を採る':`${shortNames[targetId]}${sample?'に'+sample.formula+'を投入':'を調べる'}`);
    }
    for(const b of q('island-dose').querySelectorAll('[data-dose]'))b.setAttribute('aria-pressed',String(Number(b.dataset.dose)===world.preferences.dose));
  }
  function refreshCarry() {
    const item=getCurrent();currentCraft=item?.complete&&item.record&&SAMPLE_BY_ID.get(item.record.id)?.source==='craft'?item.record:null;
    const carry=q('world-use');carry.hidden=!currentCraft;carry.disabled=!canTravel()||carryBusy;
    if(currentCraft){q('world-use-formula').textContent=SAMPLE_BY_ID.get(currentCraft.id).formula;carry.setAttribute('aria-label',`${currentCraft.nameJa}を世界で使う`);}
  }
  function observeStructures(structures) {
    let changed=false;
    for(const item of structures)if(item.complete&&item.record&&SAMPLE_BY_ID.get(item.record.id)?.source==='craft')changed=unlockSample(world,item.record.id)||changed;
    if(changed){renderTray();save();}refreshCarry();
  }
  function inspect(id) {
    selectedTarget=id;scene?.highlight(id);renderInspector();
  }
  function renderInspector() {
    const panel=q('island-inspector');panel.hidden=!selectedTarget;
    if(!selectedTarget)return;
    q('island-target-name').textContent=TARGET_BY_ID.get(selectedTarget)?.name||SALT_ROCK.name;
    q('island-target-note').textContent=selectedTarget==='salt-rock'?'白い結晶を標本ボトルに集められる。':describeTarget(world,selectedTarget);
    const actions=q('island-target-actions');actions.replaceChildren();
    if(selectedTarget==='burner')actions.append(button('✧ 火花',()=>{audio.unlock();ignite(world);processEvents();save();renderInspector();},'island-spark'));
    if(['pond','cell','crystal'].includes(selectedTarget))actions.append(button('水を流す',()=>{audio.unlock();drain(world,selectedTarget);processEvents();save();renderInspector();},'island-drain'));
    if(selectedTarget==='salt-rock')actions.append(button('結晶を採る',takeSalt));
  }
  function takeSalt() {
    audio.unlock();const added=collectSalt(world);world.preferences.selected='salt';renderTray();processEvents();save();
    if(added)showToast('白い粒をひろった','NaCl · 塩の結晶','mineral');
  }
  function activateTarget(id,point=null) {
    if(!active||busy()||!scene)return;
    if(id==='salt-rock'){takeSalt();inspect(id);return;}
    const sample=world.preferences.selected;inspect(id);
    if(!sample)return;
    if(pendingThrows.length>=8)return;
    audio.unlock();audio.play('drop');
    scene.throwSample(sample,id,world.preferences.dose,point);
    pendingThrows.push({id:sample,target:id,dose:world.preferences.dose,remaining:.56});
  }
  function showToast(title,note,kind='phenomenon') {
    q('island-discovery-title').textContent=title;q('island-discovery-note').textContent=note;
    q('island-discovery').dataset.kind=kind;q('island-discovery').hidden=false;toastUntil=world.clock+3.1;
  }
  function processEvents() {
    for(const event of takeIslandEvents(world)) {
      if(event.type==='discovery') {
        noticeQueue.push(event);
        q('island-mini-progress').textContent=`発見 ${world.discoveries.length} · 生物 ${world.encounters.length}`;
      } else {scene?.burst(event.type,event.target,event.amount||1);audio.play(event.type);}
    }
  }
  function showNextNotice() {
    if(world.clock<toastUntil)return;
    const event=noticeQueue.shift();
    if(!event){q('island-discovery').hidden=true;return;}
    const record=event.kind==='creature'?ISLAND_SPECIES.find(s=>s.id===event.discovery):DISCOVERY_BY_ID.get(event.discovery);
    if(!record)return;
    showToast(record.name,event.kind==='creature'?'あたらしい生物を図鑑に記録した':'いま見つけた現象を、図鑑に記録した',event.kind);
    audio.play('discovery');scene?.burst('grow',event.target);save();
  }
  for(const target of [...ISLAND_TARGETS,SALT_ROCK]) {
    const pin=button('',()=>activateTarget(target.id),'island-target-pin');pin.dataset.target=target.id;
    pin.append(el('span',glyphs[target.id],'island-pin-glyph'),el('small',shortNames[target.id]));
    q('island-targets').append(pin);pins.set(target.id,pin);
  }
  function positionPins() {
    for(const [id,pin]of pins) {
      const p=scene?.project(id);if(!p)continue;
      pin.style.left=`${p.x}px`;pin.style.top=`${p.y}px`;pin.style.visibility=p.visible?'visible':'hidden';
    }
  }
  function frame(now) {
    raf=0;if(!active||doc.hidden)return;
    raf=requestAnimationFrame(frame);
    if(busy()){if(drag)cancelDrag();if(pointers.size)cancelCamera();lastTime=now;return;}
    if(lastTime&&now-lastTime<30)return;
    const dt=lastTime?Math.min(.1,(now-lastTime)/1000):0;lastTime=now;
    for(const drop of pendingThrows)drop.remaining-=dt;
    const landed=pendingThrows.filter(drop=>drop.remaining<=0);pendingThrows=pendingThrows.filter(drop=>drop.remaining>0);
    for(const drop of landed)applySample(world,drop.id,drop.target,drop.dose);
    accumulator+=dt;
    while(accumulator>=1/30){stepIsland(world,1/30);accumulator-=1/30;}
    processEvents();showNextNotice();scene?.render(world,dt);positionPins();
    if(now-lastInspector>750){lastInspector=now;if(selectedTarget)q('island-target-note').textContent=selectedTarget==='salt-rock'?'白い結晶を標本ボトルに集められる。':describeTarget(world,selectedTarget);}
    if(landed.length||now-lastSave>2500){lastSave=now;save();}
  }
  function startFrames(){if(active&&!doc.hidden&&!raf){lastTime=0;raf=requestAnimationFrame(frame);}}

  function cancelDrag() {
    if(drag?.captured)try{tray.releasePointerCapture(drag.pointerId);}catch{}
    drag=null;q('island-drag-ghost').hidden=true;view.classList.remove('sample-dragging');scene?.highlight(selectedTarget);
  }
  tray.addEventListener('pointerdown',e=>{
    const b=e.target.closest('[data-sample]');if(!b||e.button>0||pointers.size)return;
    if(drag&&drag.pointerId!==e.pointerId){cancelDrag();suppressClick=true;return;}
    drag={id:b.dataset.sample,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moving:false,captured:false};suppressClick=false;audio.unlock();
  });
  tray.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    // Horizontal gestures still scroll a long shelf. Upward drags carry a bottle.
    if(!drag.moving) {
      if(dy>-10||Math.abs(dx)>Math.abs(dy)*1.25)return;
      drag.moving=true;try{tray.setPointerCapture(e.pointerId);drag.captured=true;}catch{}
      world.preferences.selected=drag.id;renderSelection();view.classList.add('sample-dragging');
    }
    e.preventDefault();const ghost=q('island-drag-ghost');ghost.hidden=false;ghost.textContent=SAMPLE_BY_ID.get(drag.id).formula;ghost.style.left=`${e.clientX}px`;ghost.style.top=`${e.clientY-40}px`;
    const hit=scene?.hitTest(e.clientX,e.clientY);scene?.highlight(hit?.id);
  });
  tray.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.pointerId)return;
    const moved=drag.moving;
    if(moved){e.preventDefault();suppressClick=true;const hit=scene?.hitTest(e.clientX,e.clientY);if(hit)activateTarget(hit.id,hit.point);}
    cancelDrag();
  });
  tray.addEventListener('pointercancel',cancelDrag);tray.addEventListener('lostpointercapture',cancelDrag);
  function cancelCamera(){pointers.clear();multi=null;}
  function bindCamera(canvas) {
    canvas.addEventListener('contextmenu',e=>e.preventDefault());
    canvas.addEventListener('pointerdown',e=>{
      if(!active||busy())return;
      if(drag){cancelDrag();return;}audio.unlock();
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
      try{canvas.setPointerCapture(e.pointerId);}catch{}
      if(pointers.size===2){for(const p of pointers.values())p.moved=true;multi=twoPoints();}
    });
    canvas.addEventListener('pointermove',e=>{
      const p=pointers.get(e.pointerId);if(!p)return;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
      if(pointers.size>=2){const next=twoPoints();if(multi){scene.zoomBy(next.distance/multi.distance);scene.pan(next.x-multi.x,next.y-multi.y);}multi=next;positionPins();return;}
      if(Math.hypot(p.x-p.startX,p.y-p.startY)>9)p.moved=true;
      if(p.moved){scene.orbit(dx,dy);positionPins();}
    });
    canvas.addEventListener('pointerup',e=>{
      const p=pointers.get(e.pointerId);if(!p)return;
      pointers.delete(e.pointerId);multi=null;try{canvas.releasePointerCapture(e.pointerId);}catch{}
      if(!p.moved&&!pointers.size){const hit=scene.hitTest(e.clientX,e.clientY);if(hit)activateTarget(hit.id,hit.point);else{selectedTarget=null;scene.highlight(null);renderInspector();}}
    });
    canvas.addEventListener('pointercancel',cancelCamera);canvas.addEventListener('lostpointercapture',e=>{pointers.delete(e.pointerId);multi=null;});
    canvas.addEventListener('wheel',e=>{e.preventDefault();if(active&&!busy()){scene.zoomBy(Math.exp(-e.deltaY*.001));positionPins();}},{passive:false});
  }
  function twoPoints(){const [a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(12,Math.hypot(a.x-b.x,a.y-b.y))};}

  q('scene-island').addEventListener('click',()=>chooseScene('island'));
  q('scene-craft').addEventListener('click',()=>chooseScene('craft'));
  q('island-make').addEventListener('click',()=>chooseScene('craft'));
  q('world-use').addEventListener('click',()=>{
    refreshCarry();if(!currentCraft||!canTravel()||carryBusy)return;
    carryBusy=true;unlockSample(world,currentCraft.id);world.preferences.selected=currentCraft.id;
    chooseScene('island');carryBusy=false;refreshCarry();
  });
  q('island-cancel-sample').addEventListener('click',()=>{world.preferences.selected=null;renderSelection();save();});
  q('island-inspector-close').addEventListener('click',()=>{selectedTarget=null;scene?.highlight(null);renderInspector();});
  q('island-zoom-in').addEventListener('click',()=>{scene?.zoomBy(1.17);positionPins();});
  q('island-zoom-out').addEventListener('click',()=>{scene?.zoomBy(1/1.17);positionPins();});
  q('island-frame').addEventListener('click',()=>{scene?.frame();positionPins();});
  const sound=q('island-sound');
  function soundLabel(){sound.setAttribute('aria-pressed',String(!world.preferences.muted));sound.setAttribute('aria-label',world.preferences.muted?'島の音をオンにする':'島の音を消す');sound.textContent=world.preferences.muted?'♪̸':'♪';}
  sound.addEventListener('click',()=>{world.preferences.muted=!world.preferences.muted;audio.setMuted(world.preferences.muted);soundLabel();save();});soundLabel();
  for(const b of q('island-dose').querySelectorAll('[data-dose]'))b.addEventListener('click',()=>{world.preferences.dose=Number(b.dataset.dose);renderSelection();save();});
  q('island-discovery').addEventListener('click',()=>{
    const tab=q('island-discovery').dataset.kind==='creature'?'creatures':'phenomena';
    q('open-collection').click();doc.querySelector(`[data-book-tab="${tab}"]`).click();
  });
  q('island-reset').addEventListener('click',()=>{q('menu-dialog').close();q('island-reset-dialog').showModal();});
  q('island-reset-cancel').addEventListener('click',()=>q('island-reset-dialog').close());
  q('island-reset-confirm').addEventListener('click',()=>{
    if(!storage.allowReset()){q('island-reset-dialog').close();return;}
    pendingThrows=[];noticeQueue=[];toastUntil=0;world=resetIsland(world);selectedTarget=null;
    scene?.clearEffects?.();q('island-discovery').hidden=true;scene?.highlight(null);renderTray();renderInspector();save();q('island-reset-dialog').close();
  });
  doc.addEventListener('visibilitychange',()=>{
    cancelDrag();cancelCamera();lastTime=0;
    if(doc.hidden){flushThrows();save();audio.pause();cancelAnimationFrame(raf);raf=0;}
    else if(active){audio.resume();startFrames();}
  });
  win.addEventListener('pagehide',()=>{flushThrows();save();audio.pause();});
  win.addEventListener('molecule-craft:prepare-update',e=>{flushThrows();if(!save()&&(world.experiments>0||world.samples.length))e.preventDefault();});
  win.addEventListener('hashchange',()=>{const next=win.location.hash==='#craft'?'craft':'island';if(!chooseScene(next))win.history.replaceState(null,'',`#${active?'island':'craft'}`);});
  q('island-mini-progress').textContent=`発見 ${world.discoveries.length} · 生物 ${world.encounters.length}`;
  const preferred=win.location.hash==='#craft'?'craft':win.location.hash==='#island'?'island':world.preferences.scene;
  chooseScene(canTravel()?preferred:'craft',{initial:true});renderTray();
  return {
    observeStructures,refreshCarry,showCraft:()=>chooseScene('craft'),
    get active(){return active;},
    journalCount:kind=>kind==='creatures'?world.encounters.length:world.discoveries.length,
    journalTotal:kind=>kind==='creatures'?ISLAND_SPECIES.length:ISLAND_DISCOVERIES.length,
    renderJournal(kind,container) {
      container.replaceChildren();
      const entries=kind==='creatures'?world.encounters:world.discoveries,catalog=kind==='creatures'?ISLAND_SPECIES:ISLAND_DISCOVERIES;
      const intro=el('p',kind==='creatures'?'島で出会った生き物。環境を変えると、行き先も変わる。':'世界で起きたことだけが、このページに残ります。','island-journal-intro');container.append(intro);
      for(const [i,record]of catalog.entries()) {
        const found=entries.some(e=>e.id===record.id),card=el('article',undefined,`island-journal-card ${found?'found':'unknown'}`);
        card.append(el('small',`${kind==='creatures'?'LIFE':'NOTE'} ${String(i+1).padStart(2,'0')}`));
        const icon=el('div',found?record.glyph||'✦':'?','journal-glyph');
        if(found&&kind==='creatures'){icon.className=`journal-critter ${record.id}`;icon.style.setProperty('--critter-color',record.color);icon.textContent='';icon.append(el('i'),el('i'));}
        card.append(icon,el('h3',found?record.name:'まだ見ぬ発見'));
        if(found)card.append(el('p',record.note));
        container.append(card);
      }
    },
    // Read-only snapshot for diagnostics/tests; no hidden inventory/debug unlock UI.
    snapshot:()=>islandSnapshot(world),
    stats:()=>scene?.stats()??null,
  };
}
