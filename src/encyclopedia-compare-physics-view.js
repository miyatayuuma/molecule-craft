import {buildComparisonRows,COMPARISON_AXES,comparisonValueLabel,layoutComparisonRows,nearestComparisonIndex} from './encyclopedia-compare.js';
import {appendMoleculeNameFurigana} from './molecule-name-furigana.js?v=2';
import {moleculeDisplayName} from './collection-catalog.js';
import {ComparisonRopePhysics} from './compare-rope-physics.js';
import {ComparisonRopeScene,ComparisonRopeCanvas} from './compare-rope-scene.js';

const STYLE_ID='molecule-craft-compare-physics-style';
const STYLE=`
.compare-graph{position:relative}.compare-axis{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;padding:0 4px}.compare-axis button{min-height:38px;padding:6px 12px;border:1px solid #456979;border-radius:12px;background:#132e3e;color:#a9cbd3;font-size:12px}.compare-axis button[aria-pressed=true]{border-color:#76d9c8;background:#285550;color:#f2fffb}.compare-axis-note{font-size:10px;color:#8daebd}
.compare-stage{position:relative;touch-action:pan-y;user-select:none;cursor:grab;background:radial-gradient(ellipse at 50% 43%,#23445a 0,#102a3c 34%,#071724 78%,#06111d 100%)}.compare-stage.is-dragging{cursor:grabbing}.compare-physics-canvas{position:absolute;inset:0;display:block;z-index:1;width:100%;height:100%;pointer-events:none}.compare-pedestal-fallback{position:absolute;z-index:0;left:50%;top:calc(43% + 60px);transform:translate(-50%,-50%);width:min(95%,440px);height:auto;pointer-events:none;filter:drop-shadow(0 8px 16px #000a)}
.compare-instrument{position:absolute;z-index:6;left:50%;top:calc(43% + 85px);transform:translateX(-50%);display:grid;justify-items:center;gap:1px;min-width:146px;padding:5px 12px 7px;border:1px solid #54abb9a8;border-radius:8px;background:linear-gradient(165deg,#16394af5,#091e2aef);box-shadow:inset 0 0 14px #61d1df1c,0 5px 18px #0008;pointer-events:none;color:#dcfbfb}.compare-instrument::before{content:'MOLECULAR ANALYZER';font-size:7px;letter-spacing:.2em;color:#83c7d2}.compare-instrument-name{font-size:9px;color:#a9dbe0}.compare-instrument-value{font-family:ui-monospace,SFMono-Regular,monospace;font-weight:750;font-size:18px;letter-spacing:.015em;white-space:nowrap;font-variant-numeric:tabular-nums;text-shadow:0 0 12px #6ae1e577}.compare-instrument-value.undiscovered{font-size:15px;color:#8ca9bd}.compare-platform-waiting{position:absolute;z-index:2;left:50%;top:calc(43% + 43px);transform:translateX(-50%);color:#718f9f;font-size:9px;pointer-events:none}.compare-platform-waiting.provisional{top:calc(43% + 156px);color:#8bafc0}
.compare-bead.graph-node{z-index:4;width:56px;height:56px;min-height:56px;padding:3px;overflow:visible;touch-action:pan-y;transition:border-color 140ms ease;background:radial-gradient(circle at 29% 20%,#3e8390 0,#205263 40%,#0c2335 83%);border:2px solid #8bc9d4;box-shadow:inset -8px -9px 12px #0815269c,inset 3px 3px 7px #d5fff02f,0 8px 19px #0008}.compare-bead.graph-node.focus{width:82px;height:82px;min-height:82px;padding:6px;z-index:5;box-shadow:inset -10px -10px 14px #09192999,inset 4px 4px 9px #d5fff04c,0 0 22px #65e4d73c,0 13px 28px #000b}.compare-bead.graph-node .graph-focus-thumbnail{inset:3px;width:calc(100% - 6px);height:calc(100% - 6px)}.compare-bead.graph-node.focus .graph-focus-thumbnail{inset:5px;width:calc(100% - 10px);height:calc(100% - 10px)}.compare-bead.graph-node.unknown{background:radial-gradient(circle at 29% 20%,#376075 0,#172e45 54%,#081724 100%);border:2px dashed #769db3;color:#9ab4c4}.compare-bead.graph-node.unknown:before{display:none}.compare-bead.graph-node.unknown .compare-question{font-size:26px;line-height:1;color:#9fc3d5;font-weight:700}.compare-bead.graph-node.unknown.focus .compare-question{font-size:37px;color:#c0dce8}
.compare-summary{display:grid;justify-items:center;gap:4px;min-height:60px;padding:5px 9px;text-align:center}.compare-summary strong{font-size:15px;line-height:1.5}.compare-summary small{font-size:12px;color:#c8e7e3}.compare-summary ruby rt{font-size:.57em}.compare-summary-unknown{color:#b7c4cd}.compare-tip{margin:0;text-align:center;color:#8ba5b6;font-size:10px}.compare-count{color:#85a7b6;font-size:10px}.compare-empty{display:grid;place-items:center;height:100%;color:#97afbc;text-align:center;padding:28px}
@media(min-width:1024px) and (min-height:640px){#collection-dialog .compare-graph{grid-template-rows:minmax(0,1fr) auto auto}#collection-dialog .compare-axis{position:absolute;top:18px;left:12px;z-index:8;background:#0b1e2bdc;border-radius:13px;padding:4px;max-width:44%}#collection-dialog .compare-graph .compare-stage{grid-row:1}#collection-dialog .compare-summary{grid-row:2}#collection-dialog .compare-tip{grid-row:3}}
@media(max-width:650px){.compare-axis{padding:0 5px}.compare-axis button{min-height:36px}.compare-stage{min-height:320px;height:min(49dvh,470px)}.compare-bead.graph-node.focus{width:76px;height:76px;min-height:76px}.compare-tip{line-height:1.5}}
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
  else button.append(ruby(button.ownerDocument,'原子数','げんしすう'));
}

export function renderEncyclopediaComparison({
  host,records,discoveredIds=new Set(),axis='molarMass',focusId=null,
  onFocus=()=>{},onDetail=()=>{},onAxis=()=>{},transitionRects=new Map(),win=globalThis.window,
}={}){
  const doc=host.ownerDocument??globalThis.document;ensureStyles(doc);
  const {rows,missing}=buildComparisonRows(records,{axis,discoveredIds}),{positions}=layoutComparisonRows(rows,axis);
  const indexById=new Map(rows.map((row,index)=>[row.id,index]));
  const reduced=!!win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const wrapper=elem(doc,'div','encyclopedia-graph compare-graph'),controls=elem(doc,'div','compare-axis');
  for(const [key,definition] of Object.entries(COMPARISON_AXES)){
    const button=elem(doc,'button');button.type='button';button.dataset.compareAxis=key;appendAxisLabel(button,key);
    button.setAttribute('aria-pressed',String(axis===key));button.addEventListener('click',()=>{if(key!==axis)onAxis(key);});controls.append(button);
  }
  controls.append(elem(doc,'span','compare-axis-note','間隔は数値差を圧縮して表示'));
  wrapper.append(controls);
  const stage=elem(doc,'div','graph-stage compare-stage');stage.tabIndex=0;stage.setAttribute('role','group');stage.setAttribute('aria-label','くらべる図鑑。左右に動かして分子を比較');
  const instrument=elem(doc,'div','compare-instrument');
  instrument.append(elem(doc,'span','compare-instrument-name','モル質量'));
  const instrumentValue=elem(doc,'strong','compare-instrument-value','???');instrument.append(instrumentValue);
  stage.append(instrument);
  const waiting=elem(doc,'span','compare-platform-waiting','3D台座の素材待ち');stage.append(waiting);
  wrapper.append(stage);
  const summary=elem(doc,'div','compare-summary'),tip=elem(doc,'p','compare-tip','左右へ動かす・珠を選ぶ　／　数値差が紐の長さになります');
  wrapper.append(summary,tip);host.className='encyclopedia-graph-host encyclopedia-compare-host';host.replaceChildren(wrapper);
  const visible=new Map();
  let currentIndex=indexById.get(focusId)??0,center=positions[currentIndex]??0,drag=null,animation=0,disposed=false,lastDragAt=0,hasTransition=!!transitionRects.size;
  const stageWidth=()=>Math.max(240,stage.clientWidth||host.clientWidth||360);
  const stageHeight=()=>Math.max(320,stage.clientHeight||460);
  const physics=rows.length?new ComparisonRopePhysics(positions,{width:stageWidth(),height:stageHeight(),center}):null;
  let scene=null,physicsFrame=0,lastPhysicsAt=0;
  if(physics){
    try{
      scene=new ComparisonRopeScene(stage);scene.resize(stageWidth(),stageHeight());
      // CC-BY pedestal is only loaded when the author-provided blend has been converted.
      scene.loadPlatform(new URL('../assets/compare/scifi-pedestal.glb',import.meta.url).href,
        new URL('../assets/compare/hologram-projector-cc0.glb',import.meta.url).href)
        .then(loaded=>{if(disposed)return;if(loaded==='preferred')waiting.remove();else if(loaded==='provisional'){waiting.textContent='台座は仮素材（CC0）';waiting.classList.add('provisional');}})
        .catch(error=>{console.info('Compare analyzer model not yet available',error);});
    }catch(error){
      console.info('Using physical Canvas rope because WebGL is unavailable',error);
      scene=new ComparisonRopeCanvas(stage);scene.resize(stageWidth(),stageHeight());
      waiting.textContent='台座は仮素材（CC0）';waiting.classList.add('provisional');
    }
  }
  const nearest=()=>nearestComparisonIndex(positions,center);
  const updateSummary=()=>{
    summary.replaceChildren();if(!rows.length){summary.textContent='この軸で比較できる分子はありません。';return;}
    const row=rows[currentIndex];
    instrument.querySelector('.compare-instrument-name').textContent=axis==='molarMass'?'モル質量':'原子数';
    instrumentValue.textContent=row.discovered?comparisonValueLabel(row.value,axis):'???';
    instrumentValue.classList.toggle('undiscovered',!row.discovered);
    if(!row.discovered){summary.append(elem(doc,'strong','compare-summary-unknown','？ 未知の分子'));}
    else{
      const heading=elem(doc,'strong');appendMoleculeNameFurigana(heading,moleculeDisplayName(row.record));
      summary.append(heading);
    }
    summary.append(elem(doc,'span','compare-count',`全${rows.length}珠${missing.length?` ／ 数値なし${missing.length}件`:''}`));
  };
  const showFocus=()=>{
    const next=nearest();if(next<0||next===currentIndex)return;
    currentIndex=next;updateSummary();onFocus(rows[next].id);
  };
  const bead=(index)=>{
    const row=rows[index],button=elem(doc,'button',`graph-node compare-bead ${row.discovered?'registered':'unknown'}`);button.type='button';
    button.setAttribute('aria-label',row.discovered?`${moleculeDisplayName(row.record)}、${comparisonValueLabel(row.value,axis)}`:'未知の分子');
    button.setAttribute('aria-pressed','false');button.dataset.compareIndex=String(index);
    if(row.discovered){
      button.dataset.graphId=row.id;const img=elem(doc,'img','graph-focus-thumbnail');img.src=new URL(`../assets/models/molecule-${row.id}.svg`,import.meta.url).href;img.alt='';img.decoding='async';img.addEventListener('error',()=>{img.remove();button.classList.add('thumbnail-unavailable');},{once:true});button.append(img);
    }else button.append(elem(doc,'span','compare-question','?'));
    button.addEventListener('click',()=>{if(win.performance.now()-lastDragAt<240)return;if(index===currentIndex&&row.discovered)onDetail(row.id,button);else focusIndex(index);});
    stage.append(button);
    return button;
  };
  const draw=()=>{
    if(disposed)return;
    const width=stageWidth(),from=Math.max(0,currentIndex-5),to=Math.min(rows.length-1,currentIndex+5),used=new Set();
    for(let i=from;i<=to;i++){
      const {x,y}=physics.beadPosition(i);if(x< -110||x>width+110||y>stageHeight()+110)continue;
      let node=visible.get(i);if(!node){node=bead(i);visible.set(i,node);}
      node.style.left=`${x}px`;node.style.top=`${y}px`;node.classList.toggle('focus',i===currentIndex);node.setAttribute('aria-pressed',String(i===currentIndex));used.add(i);
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
  const setCenter=(value)=>{center=clamp(value,positions[0]??0,positions.at(-1)??0);physics?.setCenter(center);showFocus();draw();};
  const focusIndex=(index,{instant=false}={})=>{
    if(index<0||index>=rows.length)return;stop();const target=positions[index];
    if(reduced||instant||Math.abs(center-target)<.5){setCenter(target);return;}
    const start=center,began=win.performance.now(),duration=clamp(Math.abs(target-start)*.7,180,540);
    const frame=now=>{const t=clamp((now-began)/duration,0,1),ease=1-(1-t)**3;setCenter(start+(target-start)*ease);if(t<1)animation=win.requestAnimationFrame(frame);else{animation=0;setCenter(target);}};
    animation=win.requestAnimationFrame(frame);
  };
  const snap=()=>focusIndex(nearest());
  stage.addEventListener('pointerdown',event=>{if(event.button!==undefined&&event.button!==0)return;stop();drag={pointerId:event.pointerId,x:event.clientX,travel:0};stage.classList.add('is-dragging');try{stage.setPointerCapture(event.pointerId);}catch{}});
  stage.addEventListener('pointermove',event=>{if(!drag||event.pointerId!==drag.pointerId)return;const dx=event.clientX-drag.x;drag.x=event.clientX;drag.travel+=Math.abs(dx);setCenter(center-dx);});
  const endDrag=event=>{if(!drag||event.pointerId!==drag.pointerId)return;if(drag.travel>6)lastDragAt=win.performance.now();drag=null;stage.classList.remove('is-dragging');snap();};
  stage.addEventListener('pointerup',endDrag);stage.addEventListener('pointercancel',endDrag);
  stage.addEventListener('keydown',event=>{if(event.target!==stage)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();focusIndex(clamp(currentIndex+(event.key==='ArrowRight'?1:-1),0,rows.length-1));}else if(event.key==='Enter'&&rows[currentIndex]?.discovered){event.preventDefault();onDetail(rows[currentIndex].id,visible.get(currentIndex));}});
  let lastStickTime=0;
  const gamepadStick=(x,now)=>{
    if(Math.abs(x)<.23){if(lastStickTime){lastStickTime=0;snap();}return;}
    const elapsed=lastStickTime?clamp((now-lastStickTime)/1000,0,.05):.016;lastStickTime=now;stop();setCenter(center+Math.sign(x)*(125+280*Math.abs(x))*elapsed);
  };
  const resize=()=>{if(!physics)return;physics.resize(stageWidth(),stageHeight());scene?.resize(stageWidth(),stageHeight());draw();};
  const observer=typeof win?.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(stage);win?.addEventListener?.('resize',resize);
  updateSummary();draw();
  // Physics and rendering are deliberately independent from selection easing;
  // dragging can stop while the chain still swings and settles by gravity.
  const physicsTick=now=>{
    if(disposed)return;
    const elapsed=lastPhysicsAt?Math.min((now-lastPhysicsAt)/1000,.05):1/60;
    lastPhysicsAt=now;physics?.advance(elapsed);draw();
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
