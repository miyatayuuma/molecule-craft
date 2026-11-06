import {buildComparisonRows,COMPARISON_AXES,comparisonValueLabel,layoutComparisonRows,nearestComparisonIndex} from './encyclopedia-compare.js';
import {appendMoleculeNameFurigana} from './molecule-name-furigana.js?v=2';
import {moleculeDisplayName} from './collection-catalog.js';

const STYLE_ID='molecule-craft-compare-style';
const STYLE=`
.compare-graph{position:relative}.compare-axis{display:flex;align-items:center;justify-content:center;gap:5px;flex-wrap:wrap;padding:0 4px}.compare-axis button{min-height:38px;padding:6px 12px;border:1px solid #456979;border-radius:12px;background:#132e3e;color:#a9cbd3;font-size:12px}.compare-axis button[aria-pressed=true]{border-color:#76d9c8;background:#285550;color:#f2fffb}.compare-axis-note{font-size:10px;color:#8daebd}.compare-stage{position:relative;touch-action:pan-y;user-select:none;cursor:grab}.compare-stage.is-dragging{cursor:grabbing}.compare-stage svg{width:100%;height:100%;inset:0;pointer-events:none}.compare-rope{stroke:#90c6c2;stroke-width:3;stroke-linecap:round;fill:none;opacity:.78}.compare-center-line{position:absolute;z-index:2;left:50%;top:11%;bottom:9%;border-left:1px dashed #8ce1d099;pointer-events:none}.compare-center-label{position:absolute;z-index:6;top:10px;left:50%;transform:translateX(-50%);padding:4px 10px;border:1px solid #3f6d72;border-radius:10px;background:#0e2639ed;color:#b6e8df;font-size:11px;pointer-events:none}.compare-bead.graph-node{z-index:4;width:56px;height:56px;min-height:56px;padding:3px;overflow:visible;touch-action:pan-y;transition:border-color 140ms ease;background:#183846}.compare-bead.graph-node.focus{width:82px;height:82px;min-height:82px;padding:6px;z-index:5}.compare-bead.graph-node .graph-focus-thumbnail{inset:3px;width:calc(100% - 6px);height:calc(100% - 6px)}.compare-bead.graph-node.focus .graph-focus-thumbnail{inset:5px;width:calc(100% - 10px);height:calc(100% - 10px)}.compare-bead.graph-node.unknown{background:#102838;border:2px dashed #5f8599;color:#9ab4c4;box-shadow:0 4px 16px #0005}.compare-bead.graph-node.unknown:before{display:none}.compare-bead.graph-node.unknown .compare-question{font-size:26px;line-height:1;color:#7d9bb0;font-weight:700}.compare-bead.graph-node.unknown.focus .compare-question{font-size:37px;color:#9ebed1}.compare-bead.graph-node.known{border-style:solid}.compare-bead.graph-node.focus{box-shadow:0 0 0 6px #63ded01c,0 9px 28px #0008}.compare-summary{display:grid;justify-items:center;gap:4px;min-height:60px;padding:5px 9px;text-align:center}.compare-summary strong{font-size:15px;line-height:1.5}.compare-summary small{font-size:12px;color:#c8e7e3}.compare-summary ruby rt{font-size:.57em}.compare-summary-unknown{color:#b7c4cd}.compare-tip{margin:0;text-align:center;color:#8ba5b6;font-size:10px}.compare-count{color:#85a7b6;font-size:10px}.compare-empty{display:grid;place-items:center;height:100%;color:#97afbc;text-align:center;padding:28px}
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
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');stage.append(svg);
  stage.append(elem(doc,'div','compare-center-line'),elem(doc,'div','compare-center-label','比較地点'));
  wrapper.append(stage);
  const summary=elem(doc,'div','compare-summary'),tip=elem(doc,'p','compare-tip','左右へ動かす・珠を選ぶ　／　数値差が紐の長さになります');
  wrapper.append(summary,tip);host.className='encyclopedia-graph-host encyclopedia-compare-host';host.replaceChildren(wrapper);
  const visible=new Map();
  let currentIndex=indexById.get(focusId)??0,center=positions[currentIndex]??0,drag=null,animation=0,disposed=false,previousFocus=-1,lastDragAt=0,hasTransition=!!transitionRects.size;
  const stageWidth=()=>Math.max(240,stage.clientWidth||host.clientWidth||360);
  const stageHeight=()=>Math.max(320,stage.clientHeight||460);
  const nearest=()=>nearestComparisonIndex(positions,center);
  const updateSummary=()=>{
    summary.replaceChildren();if(!rows.length){summary.textContent='この軸で比較できる分子はありません。';return;}
    const row=rows[currentIndex];
    if(!row.discovered){summary.append(elem(doc,'strong','compare-summary-unknown','？ 未知の分子'));}
    else{
      const heading=elem(doc,'strong');appendMoleculeNameFurigana(heading,moleculeDisplayName(row.record));
      summary.append(heading,elem(doc,'small',null,comparisonValueLabel(row.value,axis)));
      const ties=rows.filter(item=>item.value===row.value).length;
      if(ties>1)summary.append(elem(doc,'small',null,`同じ値の分子：${ties}個`));
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
    const width=stageWidth(),height=stageHeight(),y=height*.49;
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const from=Math.max(0,nearestComparisonIndex(positions,center-width/2-110)-1),to=Math.min(rows.length-1,nearestComparisonIndex(positions,center+width/2+110)+1),used=new Set();
    for(let i=from;i<=to;i++){
      const x=width/2+positions[i]-center;if(x< -120||x>width+120)continue;
      let node=visible.get(i);if(!node){node=bead(i);visible.set(i,node);}
      node.style.left=`${x}px`;node.style.top=`${y}px`;node.classList.toggle('focus',i===currentIndex);node.setAttribute('aria-pressed',String(i===currentIndex));used.add(i);
    }
    for(const [index,node] of visible)if(!used.has(index)){node.remove();visible.delete(index);}
    const paths=[];
    for(let i=Math.max(0,from);i<Math.min(rows.length-1,to);i++){
      const x1=width/2+positions[i]-center,x2=width/2+positions[i+1]-center;
      if(x2< -130||x1>width+130)continue;
      const sag=clamp((x2-x1)*.065,4,17);paths.push(`M${x1.toFixed(1)},${y.toFixed(1)} Q${((x1+x2)/2).toFixed(1)},${(y+sag).toFixed(1)} ${x2.toFixed(1)},${y.toFixed(1)}`);
    }
    svg.replaceChildren();const rope=doc.createElementNS('http://www.w3.org/2000/svg','path');rope.setAttribute('class','compare-rope');rope.setAttribute('d',paths.join(' '));svg.append(rope);
    if(hasTransition&&!reduced)for(const [index,node] of visible){
      const before=transitionRects.get(rows[index].id);if(!before?.width||!node.animate)continue;
      const after=node.getBoundingClientRect();if(!after.width)continue;
      const dx=before.left+before.width/2-after.left-after.width/2,dy=before.top+before.height/2-after.top-after.height/2;
      node.animate([{transform:`translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${before.width/after.width})`,opacity:1},{transform:'translate(-50%,-50%) scale(1)',opacity:1}],{duration:560,easing:'cubic-bezier(.4,0,.2,1)'});
    }
    hasTransition=false;
  };
  const stop=()=>{if(animation){win.cancelAnimationFrame?.(animation);animation=0;}};
  const setCenter=(value)=>{center=clamp(value,positions[0]??0,positions.at(-1)??0);showFocus();draw();};
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
  const resize=()=>{draw();};
  const observer=typeof win?.ResizeObserver==='function'?new win.ResizeObserver(resize):null;observer?.observe(stage);win?.addEventListener?.('resize',resize);
  updateSummary();draw();
  return {
    focusId:()=>rows[currentIndex]?.id??null,
    move:delta=>focusIndex(clamp(currentIndex+delta,0,rows.length-1)),
    focusIdDirect:id=>{const index=indexById.get(id);if(index!==undefined)focusIndex(index,{instant:true});},
    axis,gamepadStick,
    openFocused:()=>{const row=rows[currentIndex];if(row?.discovered)onDetail(row.id,visible.get(currentIndex));},
    rectsForVisible:()=>new Map([...visible].map(([index,node])=>[rows[index].id,node.getBoundingClientRect()])),
    positionsForGraph:()=>new Map([...visible].map(([index,node])=>[rows[index].id,{x:parseFloat(node.style.left),y:parseFloat(node.style.top),kind:index===currentIndex?'focus':'neighbor'}])),
    destroy:()=>{disposed=true;stop();observer?.disconnect();win?.removeEventListener?.('resize',resize);},
  };
}
