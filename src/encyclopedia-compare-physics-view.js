import {buildComparisonRows,COMPARISON_AXES,comparisonValueLabel,layoutComparisonRows,nearestComparisonIndex} from './encyclopedia-compare.js';
import {appendMoleculeNameFurigana} from './molecule-name-furigana.js?v=2';
import {moleculeDisplayName} from './collection-catalog.js';
import {ComparisonRopePhysics} from './compare-rope-physics.js';
import {ComparisonRopeScene,ComparisonRopeCanvas} from './compare-rope-scene.js';
import {ensureMoleculeBeadStyles} from './encyclopedia-bead-material.js';
import {ComparisonBoilingCycle,boilingHeatLevel} from './compare-boiling-cycle.js';
import {phaseAppearanceFor} from './molecule-phase-appearance.js';

const STYLE_ID='molecule-craft-compare-physics-style';
const STYLE=`
.compare-graph{position:relative}.compare-axis{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;padding:0 4px}.compare-axis button{min-height:38px;padding:6px 12px;border:1px solid #456979;border-radius:12px;background:#132e3e;color:#a9cbd3;font-size:12px}.compare-axis button[aria-pressed=true]{border-color:#76d9c8;background:#285550;color:#f2fffb}
.compare-stage{position:relative;touch-action:pan-y;user-select:none;cursor:grab;background:radial-gradient(ellipse at 50% 43%,#23445a 0,#102a3c 34%,#071724 78%,#06111d 100%)}.compare-stage.is-dragging{cursor:grabbing}.compare-stage.is-bead-dragging{touch-action:none}.compare-physics-canvas{position:absolute;inset:0;display:block;z-index:1;width:100%;height:100%;pointer-events:none}.compare-pedestal-fallback{position:absolute;z-index:0;left:50%;top:calc(43% + 60px);transform:translate(-50%,-50%);width:min(95%,480px);height:auto;pointer-events:none;filter:drop-shadow(0 8px 16px #000a)}
.compare-instrument{position:absolute;z-index:7;top:min(calc(43% + 128px),calc(100% - 112px));left:50%;transform:translateX(-50%);display:grid;gap:4px;width:clamp(208px,24vw,260px);padding:12px 16px;border:1px solid #8db6c33b;border-radius:12px;background:linear-gradient(155deg,#152b3bdd,#081b2aea);box-shadow:inset 0 1px 0 #dfffff13,0 9px 24px #0006;pointer-events:none;color:#e5ffff;text-align:left}.compare-instrument-name{font-size:12px;font-weight:600;color:#a9c8ce;letter-spacing:.02em}.compare-instrument-reading{display:flex;align-items:baseline;gap:8px;min-height:40px}.compare-instrument-value{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-weight:640;font-size:clamp(29px,3.2vw,40px);line-height:1.12;letter-spacing:-.035em;white-space:nowrap;font-variant-numeric:tabular-nums}.compare-instrument-unit{font-size:12px;font-weight:600;color:#9cc4ce;white-space:nowrap}.compare-instrument-value.undiscovered{letter-spacing:.06em;color:#7097ab}
.compare-docking{position:absolute;left:50%;top:43%;z-index:3;width:100px;height:100px;transform:translate(-50%,-50%);border:1px solid #75e9d500;border-radius:50%;opacity:0;pointer-events:none}.compare-stage.is-docking .compare-docking{opacity:.38;border-color:#8de9d366;box-shadow:0 0 20px #65dec329}.compare-stage.is-dock-locked .compare-docking{animation:compare-dock-pulse 430ms ease-out}@keyframes compare-dock-pulse{from{opacity:.75;transform:translate(-50%,-50%) scale(.88);border-color:#b8fff2}to{opacity:0;transform:translate(-50%,-50%) scale(1.25)}}
.compare-bead.graph-node{z-index:4;width:56px;height:56px;min-height:56px;padding:2px;overflow:visible;touch-action:none;transition:box-shadow 160ms ease}.compare-bead.graph-node.focus{width:82px;height:82px;min-height:82px;padding:3px;z-index:5}.compare-bead.graph-node .graph-focus-thumbnail{inset:2px;width:calc(100% - 4px);height:calc(100% - 4px)}.compare-bead.graph-node.focus .graph-focus-thumbnail{inset:3px;width:calc(100% - 6px);height:calc(100% - 6px)}.compare-bead.graph-node.unknown{color:#afc7d5}.compare-bead.graph-node.unknown:before{display:none}.compare-bead.graph-node.unknown .compare-question{font-size:24px;line-height:1;color:#a6bfd0;font-weight:550}.compare-bead.graph-node.unknown.focus .compare-question{font-size:34px;color:#d1e1ed}
.compare-summary{display:grid;justify-items:center;gap:4px;min-height:60px;padding:5px 9px;text-align:center}.compare-summary strong{font-size:15px;line-height:1.5}.compare-summary small{font-size:12px;color:#c8e7e3}.compare-summary ruby rt{font-size:.57em}.compare-summary-unknown{color:#b7c4cd}.compare-empty{display:grid;place-items:center;height:100%;color:#97afbc;text-align:center;padding:28px}
.compare-bead.graph-node.compare-boiling-3d{opacity:0;box-shadow:none;pointer-events:auto}.compare-boiling-label{color:#9fead9}.compare-stage.is-boiling .compare-docking{opacity:.28;border-color:#80ede744;box-shadow:0 0 23px #71e3db24}
@media(min-width:1024px) and (min-height:640px){#collection-dialog .compare-graph{grid-template-rows:minmax(0,1fr) auto}#collection-dialog .compare-axis{position:absolute;top:18px;left:12px;z-index:8;background:#0b1e2bdc;border-radius:13px;padding:4px;max-width:44%}#collection-dialog .compare-graph .compare-stage{grid-row:1}#collection-dialog .compare-summary{grid-row:2}}
@media(max-width:650px){.compare-axis{padding:0 5px}.compare-axis button{min-height:36px}.compare-stage{min-height:320px;height:min(49dvh,470px)}.compare-bead.graph-node.focus{width:76px;height:76px;min-height:76px}.compare-instrument{top:min(calc(43% + 112px),calc(100% - 92px));width:min(232px,69vw);gap:3px;padding:9px 12px}.compare-instrument-name{font-size:11px}.compare-instrument-reading{min-height:28px;gap:5px}.compare-instrument-value{font-size:clamp(25px,7vw,32px)}.compare-instrument-unit{font-size:10px}}
@media(prefers-reduced-motion:reduce){.compare-bead.graph-node{transition:none}}
`;

function ensureStyles(doc){if(doc.getElementById(STYLE_ID))return;const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=STYLE;doc.head?.append(style);}
const elem=(doc,tag,className,text)=>{const node=doc.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const COMPARISON_MODE_LABELS=Object.freeze({graph:'樹形図',compare:'くらべる'});
export const COMPARISON_MODE_ACCESSIBLE_LABEL='分子図鑑の表示';
const ruby=(doc,text,reading)=>{const node=doc.createElement('ruby'),rt=doc.createElement('rt');node.append(doc.createTextNode(text));rt.textContent=reading;node.append(rt);return node;};
export function appendComparisonModeLabel(button,mode){
  button.replaceChildren();if(mode==='graph')button.append(ruby(button.ownerDocument,'樹形図','じゅけいず'));
  else button.textContent=COMPARISON_MODE_LABELS[mode];
  return button;
}
function appendAxisLabel(button,axis){
  if(axis==='molarMass')button.append('モル',ruby(button.ownerDocument,'質量','しつりょう'));
  else if(axis==='atomCount')button.append(ruby(button.ownerDocument,'原子数','げんしすう'));
  else button.append(ruby(button.ownerDocument,'沸点','ふってん'));
}

export function renderEncyclopediaComparison({
  host,records,discoveredIds=new Set(),axis='molarMass',focusId=null,
  onFocus=()=>{},onDetail=()=>{},onAxis=()=>{},transitionRects=new Map(),win=globalThis.window,
}={}){
  const doc=host.ownerDocument??globalThis.document;ensureStyles(doc);ensureMoleculeBeadStyles(doc);
  const boilingEnabled=axis==='boilingPoint';
  const {rows}=buildComparisonRows(records,{axis,discoveredIds}),{positions}=layoutComparisonRows(rows,axis);
  const indexById=new Map(rows.map((row,index)=>[row.id,index]));
  // Never feed hidden records' appearance data to an observable renderer.
  const phaseAppearanceById=new Map(rows.filter(row=>row.discovered).map(row=>[row.id,{
    liquid:phaseAppearanceFor(row.record,'liquid'),gas:phaseAppearanceFor(row.record,'gas'),
  }]));
  const reduced=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const wrapper=elem(doc,'div','encyclopedia-graph compare-graph'),controls=elem(doc,'div','compare-axis');
  for(const [key,definition] of Object.entries(COMPARISON_AXES)){
    const button=elem(doc,'button');button.type='button';button.dataset.compareAxis=key;appendAxisLabel(button,key);
    button.setAttribute('aria-pressed',String(axis===key));button.addEventListener('click',()=>{if(key!==axis)onAxis(key);});controls.append(button);
  }
  wrapper.append(controls);
  const stage=elem(doc,'div','graph-stage compare-stage');stage.tabIndex=0;stage.setAttribute('role','group');stage.setAttribute('aria-label','くらべる図鑑。左右に動かして分子を比較');
  const instrument=elem(doc,'div','compare-instrument');
  const instrumentName=elem(doc,'span','compare-instrument-name',boilingEnabled?'温度 · 1気圧':'モル質量');
  const reading=elem(doc,'div','compare-instrument-reading');reading.setAttribute('aria-live','polite');
  const instrumentValue=elem(doc,'strong','compare-instrument-value','— —');
  const instrumentUnit=elem(doc,'span','compare-instrument-unit','g/mol');
  reading.append(instrumentValue,instrumentUnit);
  instrument.append(instrumentName,reading);
  const docking=elem(doc,'div','compare-docking');docking.setAttribute('aria-hidden','true');
  stage.append(instrument,docking);
  wrapper.append(stage);
  const summary=elem(doc,'div','compare-summary');
  wrapper.append(summary);host.className='encyclopedia-graph-host encyclopedia-compare-host';host.replaceChildren(wrapper);
  const visible=new Map();
  let currentIndex=indexById.get(focusId)??0,center=positions[currentIndex]??0,drag=null,animation=0,disposed=false,lastDragAt=0,hasTransition=!!transitionRects.size;
  const stageWidth=()=>Math.max(240,stage.clientWidth||host.clientWidth||360);
  const stageHeight=()=>Math.max(320,stage.clientHeight||460);
  const physics=rows.length?new ComparisonRopePhysics(positions,{width:stageWidth(),height:stageHeight(),center}):null;
  // Motion-sensitive users keep a stable numerical boiling-point readout.
  const boilingCycle=boilingEnabled&&!reduced?new ComparisonBoilingCycle():null;
  let scene=null,physicsFrame=0,lastPhysicsAt=0;
  let boilingVisualReady=false;
  if(physics){
    try{
      scene=new ComparisonRopeScene(stage);scene.resize(stageWidth(),stageHeight());
      if(boilingCycle){
        scene.enableBoiling().then(ready=>{boilingVisualReady=!!ready&&!disposed;}).catch(error=>{
          console.info('Boiling VFX unavailable; keeping readable instrument',error);
        });
      }
      // Preferred pedestal was converted from the author's BlendSwap source.
      scene.loadPlatform(new URL('../assets/compare/scifi-pedestal.glb',import.meta.url).href,
        new URL('../assets/compare/hologram-projector-cc0.glb',import.meta.url).href)
        .catch(error=>{console.info('Compare analyzer model not yet available',error);});
    }catch(error){
      console.info('Using physical Canvas rope because WebGL is unavailable',error);
      scene=new ComparisonRopeCanvas(stage);scene.resize(stageWidth(),stageHeight());
    }
  }
  const nearest=()=>nearestComparisonIndex(positions,center);
  const updateSummary=()=>{
    summary.replaceChildren();if(!rows.length){summary.textContent='この軸で比較できる分子はありません。';return;}
    const row=rows[currentIndex];
    instrumentName.textContent=boilingEnabled?'温度 · 1気圧':axis==='molarMass'?'モル質量':'原子数';
    instrumentValue.textContent=row.discovered?(axis==='molarMass'?row.value.toFixed(2):boilingEnabled?row.value.toFixed(1):String(row.value)):'— —';
    instrumentUnit.textContent=axis==='molarMass'?'g/mol':boilingEnabled?'°C':'個';
    instrumentValue.classList.toggle('undiscovered',!row.discovered);
    if(!row.discovered){summary.append(elem(doc,'strong','compare-summary-unknown','？ 未知の分子'));}
    else{
      const heading=elem(doc,'strong');appendMoleculeNameFurigana(heading,moleculeDisplayName(row.record));
      summary.append(heading);
    }
  };
  const showFocus=()=>{
    const next=nearest();if(next<0||next===currentIndex)return;
    boilingCycle?.focus(null);
    currentIndex=next;updateSummary();onFocus(rows[next].id);
  };
  const startObservation=index=>{
    if(!boilingCycle||!rows[index])return;
    const row=rows[index];boilingCycle.focus(row.id,null,{known:row.discovered,boilingPoint:row.value});
  };
  const bead=(index)=>{
    const row=rows[index],button=elem(doc,'button',`graph-node compare-bead ${row.discovered?'registered':'unknown'}`);button.type='button';
    button.setAttribute('aria-label',row.discovered?`${moleculeDisplayName(row.record)}、${comparisonValueLabel(row.value,axis)}`:'未知の分子');
    button.setAttribute('aria-pressed','false');button.dataset.compareIndex=String(index);
    if(row.discovered){
      button.dataset.graphId=row.id;const img=elem(doc,'img','graph-focus-thumbnail');img.src=new URL(`../assets/models/molecule-${row.id}.svg`,import.meta.url).href;img.alt='';img.decoding='async';img.addEventListener('error',()=>{img.remove();button.classList.add('thumbnail-unavailable');},{once:true});button.append(img);
    }else button.append(elem(doc,'span','compare-question','?'));
    button.addEventListener('click',()=>{if(win.performance.now()-lastDragAt<240)return;if(index===currentIndex&&row.discovered)onDetail(row.id,button);else beginDock(index);});
    stage.append(button);
    return button;
  };
  const draw=()=>{
    if(disposed)return;
    const width=stageWidth(),grabbedIndex=physics?.grabbed?.index??physics?.docking?.index??currentIndex;
    const from=Math.max(0,Math.min(currentIndex,grabbedIndex)-5),to=Math.min(rows.length-1,Math.max(currentIndex,grabbedIndex)+5),used=new Set();
    for(let i=from;i<=to;i++){
      const {x,y}=physics.beadPosition(i);if(x< -110||x>width+110||y>stageHeight()+110)continue;
      let node=visible.get(i);if(!node){node=bead(i);visible.set(i,node);}
      node.style.left=`${x}px`;node.style.top=`${y}px`;node.classList.toggle('focus',i===currentIndex);
      node.classList.toggle('compare-boiling-3d',boilingVisualReady&&!!boilingCycle?.snapshot(rows[i].id));
      node.setAttribute('aria-pressed',String(i===currentIndex));used.add(i);
    }
    for(const [index,node] of visible)if(!used.has(index)){node.remove();visible.delete(index);}
    scene?.draw(physics,currentIndex);
    if(hasTransition&&!reduced)for(const [index,node] of visible){
      const before=transitionRects.get(rows[index].id);if(!before?.width||!node.animate)continue;
      const after=node.getBoundingClientRect();if(!after.width)continue;
      const dx=before.left+before.width/2-after.left-after.width/2,dy=before.top+before.height/2-after.top-after.height/2;
      node.animate([{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${before.width/after.width})`,opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:560,easing:'cubic-bezier(.4,0,.2,1)'});
    }
    hasTransition=false;
  };
  const stop=()=>{if(animation){win.cancelAnimationFrame?.(animation);animation=0;}};
  const setCenter=(value)=>{center=clamp(value,positions[0]??0,positions.at(-1)??0);if(physics?.docking)stage.classList.remove('is-docking');physics?.setCenter(center);showFocus();draw();};
  const focusIndex=(index,{instant=false}={})=>{
    if(index<0||index>=rows.length)return;stop();const target=positions[index];
    if(reduced||instant||Math.abs(center-target)<.5){setCenter(target);return;}
    const start=center,began=win.performance.now(),duration=clamp(Math.abs(target-start)*.7,180,540);
    const frame=now=>{const t=clamp((now-began)/duration,0,1),ease=1-(1-t)**3;setCenter(start+(target-start)*ease);if(t<1)animation=win.requestAnimationFrame(frame);else{animation=0;setCenter(target);}};
    animation=win.requestAnimationFrame(frame);
  };
  const beginDock=index=>{
    if(!physics||index<0||index>=rows.length)return;
    stop();physics.dock(index);
    stage.classList.remove('is-dock-locked');stage.classList.add('is-docking');
  };
  const snap=()=>beginDock(nearest());
  const nearestOnPlatform=(grabbedIndex=currentIndex)=>{
    if(!physics)return -1;
    let chosen=-1,best=Infinity;
    const low=Math.max(0,Math.min(currentIndex,grabbedIndex)-8),high=Math.min(rows.length-1,Math.max(currentIndex,grabbedIndex)+8);
    for(let index=low;index<=high;index++){
      const point=physics.beadPosition(index);
      const distance=Math.hypot(point.x-physics.x,(point.y-physics.y)*1.15);
      if(distance<best){best=distance;chosen=index;}
    }
    return chosen;
  };
  stage.addEventListener('pointerdown',event=>{
    if(event.button!==undefined&&event.button!==0)return;
    stop();physics?.cancelDock();stage.classList.remove('is-dock-locked','is-docking');
    const beadTarget=event.target.closest?.('.compare-bead');
    const index=beadTarget?Number(beadTarget.dataset.compareIndex):null;
    const rect=stage.getBoundingClientRect(),point=index!==null?physics?.beadPosition(index):null;
    drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,travel:0,time:win.performance.now(),vx:0,vy:0,
      offsetX:point?point.x-(event.clientX-rect.left):0,offsetY:point?point.y-(event.clientY-rect.top):0,index};
    stage.classList.add('is-dragging');
    try{(beadTarget??stage).setPointerCapture(event.pointerId);}catch{}
  });
  stage.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    const now=win.performance.now(),dt=Math.max(8,now-drag.time);
    drag.vx=drag.vx*.35+(dx*1000/dt)*.65;
    drag.vy=drag.vy*.35+(dy*1000/dt)*.65;
    drag.x=event.clientX;drag.y=event.clientY;drag.time=now;drag.travel+=Math.hypot(dx,dy);
    if(drag.travel<=6)return;
    if(drag.index!==null&&physics){
      const rect=stage.getBoundingClientRect();
      physics.grab(drag.index,event.clientX-rect.left+drag.offsetX,event.clientY-rect.top+drag.offsetY);
      stage.classList.add('is-bead-dragging');
      draw();
    }else setCenter(center-dx);
  });
  const endDrag=event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const moved=drag.travel>6;
    const wasBead=drag.index!==null;
    const target=moved&&wasBead?nearestOnPlatform(drag.index):-1;
    if(moved)lastDragAt=win.performance.now();
    physics?.release({vx:drag.vx,vy:drag.vy});
    if(moved&&!wasBead){
      // Flicking the empty stage moves the material coordinate under the
      // sensor; a small capped coast adds tactile continuity to the swipe.
      const coast=clamp(-drag.vx*.13,-140,140);
      beginDock(nearestComparisonIndex(positions,clamp(center+coast,positions[0],positions.at(-1))));
    }
    drag=null;
    stage.classList.remove('is-dragging','is-bead-dragging');
    if(moved&&target>=0)beginDock(target);
  };
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
  stage.addEventListener('keydown',event=>{if(event.target!==stage)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();focusIndex(clamp(currentIndex+(event.key==='ArrowRight'?1:-1),0,rows.length-1));}else if(event.key==='Enter'&&rows[currentIndex]?.discovered){event.preventDefault();onDetail(rows[currentIndex].id,visible.get(currentIndex));}});
  let lastStickTime=0;
  const gamepadStick=(x,now)=>{
    if(Math.abs(x)<.23){if(lastStickTime){lastStickTime=0;snap();}return;}
    const elapsed=lastStickTime?clamp((now-lastStickTime)/1000,0,.05):.016;lastStickTime=now;stop();setCenter(center+Math.sign(x)*(125+280*Math.abs(x))*elapsed);
  };
  const resize=()=>{if(!physics)return;physics.resize(stageWidth(),stageHeight());scene?.resize(stageWidth(),stageHeight());draw();};
  const observer=typeof win?.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(stage);win?.addEventListener?.('resize',resize);
  updateSummary();if(boilingEnabled&&rows.length)startObservation(currentIndex);draw();
  // Physics and rendering are deliberately independent from selection easing;
  // dragging can stop while the chain still swings and settles by gravity.
  const physicsTick=now=>{
    if(disposed)return;
    const elapsed=lastPhysicsAt?Math.min((now-lastPhysicsAt)/1000,.05):1/60;
    lastPhysicsAt=now;physics?.advance(elapsed);
    boilingCycle?.advance(elapsed);
    if(physics?.completedDock!==null&&physics?.completedDock!==undefined){
      const index=physics.completedDock;physics.completedDock=null;
      center=positions[index];showFocus();
      startObservation(index);
      stage.classList.remove('is-docking');stage.classList.add('is-dock-locked');
    }
    if(boilingCycle){
      const temperature=boilingCycle.reading(),row=rows[currentIndex];
      if(row?.discovered&&Number.isFinite(temperature))instrumentValue.textContent=temperature.toFixed(1);
      const activeSnapshot=boilingCycle.snapshot(row?.id);
      stage.classList.toggle('is-boiling',activeSnapshot?.phase==='boiling');
      scene?.setBoilingHeat?.({
        temperature,
        phase:activeSnapshot?.phase,
        progress:boilingHeatLevel(activeSnapshot),
      },elapsed);
      if(boilingVisualReady){
        const snapshots=new Map([...boilingCycle.entries].map(([id])=>[id,boilingCycle.snapshot(id)]));
        try{scene?.updateBoiling?.(physics,snapshots,indexById,elapsed,boilingCycle.activeId,phaseAppearanceById);}
        catch(error){
          console.error('Boiling VFX stopped; restoring accessible bead controls',error);
          boilingVisualReady=false;
          scene?.boilingVisual?.dispose();scene.boilingVisual=null;
        }
      }
    }
    draw();
    physicsFrame=win.requestAnimationFrame(physicsTick);
  };
  if(physics)physicsFrame=win.requestAnimationFrame(physicsTick);
  return {
    focusId:()=>rows[currentIndex]?.id??null,
    move:delta=>focusIndex(clamp(currentIndex+delta,0,rows.length-1)),
    focusIdDirect:id=>{const index=indexById.get(id);if(index!==undefined)focusIndex(index,{instant:true});},
    axis,gamepadStick,
    openFocused:()=>{const row=rows[currentIndex];if(row?.discovered)onDetail(row.id,visible.get(currentIndex));},
    rectsForVisible:()=>new Map([...visible].map(([index,node])=>[rows[index].id,node.getBoundingClientRect()])),
    positionsForGraph:()=>new Map([...visible].map(([index,node])=>[rows[index].id,{x:parseFloat(node.style.left),y:parseFloat(node.style.top),kind:index===currentIndex?'focus':'neighbor'}])),
    destroy:()=>{disposed=true;stop();if(physicsFrame)win.cancelAnimationFrame?.(physicsFrame);observer?.disconnect();win?.removeEventListener?.('resize',resize);scene?.dispose();},
  };
}
