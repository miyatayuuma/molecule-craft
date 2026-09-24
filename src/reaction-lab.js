import {RESOURCE_KEY} from './veil/resources-persistence.js';

const q=id=>document.getElementById(id);
const MAX_INSTANCES=10;
let catalog=[],byId=new Map(),loadPromise=null,instances=[],selectedId=null,nextInstance=1,drag=null,statusText='';

function readResources(){
  try{return JSON.parse(localStorage.getItem(RESOURCE_KEY)||'null')??{recipes:[]};}
  catch{return {recipes:[]};}
}
async function loadCatalog(){
  if(catalog.length)return catalog;
  if(loadPromise)return loadPromise;
  loadPromise=fetch(new URL('../data/molecules.json',import.meta.url),{cache:'no-store'})
    .then(response=>{if(!response.ok)throw new Error(`Molecule catalog HTTP ${response.status}`);return response.json();})
    .then(records=>{catalog=Array.isArray(records)?records:[];byId=new Map(catalog.map(record=>[record.id,record]));return catalog;})
    .finally(()=>{loadPromise=null;});
  return loadPromise;
}
function displayName(record){return record?.commonNameJa??record?.nameJa??record?.nameEn??record?.id??'分子';}
function knownRecords(){
  const state=readResources(),known=new Set(state.recipes??[]);
  return catalog.filter(record=>known.has(record.id)).sort((a,b)=>displayName(a).localeCompare(displayName(b),'ja'));
}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function spawnPoint(index){
  const points=[[.28,.36],[.58,.32],[.40,.62],[.72,.58],[.18,.66],[.80,.28],[.55,.72],[.30,.78],[.68,.74],[.48,.46]];
  const point=points[index%points.length];return {x:point[0],y:point[1]};
}
function selected(){return instances.find(item=>item.instanceId===selectedId)??null;}

function installStyle(){
  if(q('reaction-lab-style'))return;
  const style=document.createElement('style');style.id='reaction-lab-style';style.textContent=`
#open-reaction-lab{min-width:58px;letter-spacing:.08em}
.reaction-lab-sheet{width:min(780px,calc(100vw - 14px));max-height:min(820px,calc(100dvh - 14px));padding:0;border:1px solid #385061;border-radius:18px;background:#07131d;color:#d7e8f1;overflow:hidden}
.reaction-lab-sheet::backdrop{background:#02070cd0}
.reaction-lab-title{display:grid;gap:1px}.reaction-lab-kicker{margin:0;color:#688b9b;font-size:9px;letter-spacing:.13em}
.reaction-lab-body{display:grid;gap:10px;padding:10px;overflow:auto;max-height:calc(100dvh - 70px)}
.reaction-lab-chamber-wrap{display:grid;gap:7px}.reaction-lab-chamber-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.reaction-lab-chamber-head p{margin:0;color:#7392a2;font-size:10px;letter-spacing:.08em}.reaction-lab-chamber-head button{min-height:38px;padding:5px 10px}
.reaction-lab-chamber{position:relative;min-height:390px;overflow:hidden;border:1px solid #294759;border-radius:16px;background:radial-gradient(circle at 50% 42%,#102a3a 0,#091a26 55%,#06111a 100%);touch-action:pan-y}
.reaction-lab-chamber::before{content:'';position:absolute;inset:12px;border:1px solid #29475988;border-radius:13px;pointer-events:none}
.reaction-lab-chamber-empty{position:absolute;inset:0;display:grid;place-items:center;padding:26px;text-align:center;color:#668696;font-size:12px;line-height:1.6;pointer-events:none}
.reaction-lab-molecule{position:absolute;left:0;top:0;width:112px;min-height:86px;transform:translate(-50%,-50%);display:grid;grid-template-rows:64px auto;place-items:center;padding:4px 7px 7px;border:1px solid transparent;border-radius:14px;background:#081723c7;color:#d9e9f1;touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
.reaction-lab-molecule:active{cursor:grabbing}.reaction-lab-molecule[aria-pressed=true]{border-color:#7ecbd7;background:#0c2330;box-shadow:0 0 0 1px #7ecbd744 inset}
.reaction-lab-molecule img{display:block;width:96px;height:64px;object-fit:contain;pointer-events:none}.reaction-lab-molecule small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#90afbd;pointer-events:none}
.reaction-lab-bottom{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.reaction-lab-inspector{min-height:45px;padding:8px 10px;border:1px solid #273f4e;border-radius:11px;background:#0a1822}.reaction-lab-inspector p{margin:0}.reaction-lab-inspector strong{font-size:12px}.reaction-lab-inspector small{display:block;margin-top:2px;color:#7897a7;font-size:10px}.reaction-lab-inspector button{margin-top:7px;min-height:38px}
.reaction-lab-status{margin:0;color:#7594a4;font-size:10px;line-height:1.45}.reaction-lab-tray{display:grid;gap:6px}.reaction-lab-tray>header{display:flex;justify-content:space-between;align-items:center;gap:8px}.reaction-lab-tray h3{margin:0;font-size:11px;letter-spacing:.08em}.reaction-lab-tray header small{color:#6e8c9b}
.reaction-lab-molecules{display:flex;gap:7px;overflow-x:auto;padding:1px 1px 5px;scrollbar-width:thin}.reaction-lab-pick{flex:0 0 112px;min-height:70px;display:grid;grid-template-columns:46px 1fr;gap:6px;align-items:center;padding:7px;border:1px solid #2b4555;border-radius:11px;background:#0a1924;color:#d7e8f1;text-align:left}.reaction-lab-pick img{width:46px;height:46px;object-fit:contain}.reaction-lab-pick span{min-width:0}.reaction-lab-pick strong,.reaction-lab-pick small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reaction-lab-pick strong{font-size:10px}.reaction-lab-pick small{margin-top:2px;color:#7898a8;font-size:9px}.reaction-lab-pick:disabled{opacity:.45}
@media(max-width:560px){.reaction-lab-sheet{width:calc(100vw - 8px);max-height:calc(100dvh - 8px)}.reaction-lab-body{padding:8px;max-height:calc(100dvh - 62px)}.reaction-lab-chamber{min-height:400px}.reaction-lab-molecule{width:98px;min-height:78px;grid-template-rows:57px auto}.reaction-lab-molecule img{width:84px;height:57px}.reaction-lab-bottom{grid-template-columns:1fr auto}.reaction-lab-status{font-size:9px}}
@media(max-width:350px){.reaction-lab-chamber{min-height:360px}.reaction-lab-molecule{width:90px}.reaction-lab-pick{flex-basis:104px}}
`;document.head.append(style);
}

function ensureShell(){
  installStyle();
  let open=q('open-reaction-lab');
  if(!open){
    open=document.createElement('button');open.id='open-reaction-lab';open.type='button';open.textContent='LAB';open.setAttribute('aria-label','Reaction Labを開く');
    q('open-supply')?.after(open);
    open.addEventListener('click',openLab);
  }
  let dialog=q('reaction-lab-dialog');
  if(!dialog){
    dialog=document.createElement('dialog');dialog.id='reaction-lab-dialog';dialog.className='sheet reaction-lab-sheet';dialog.setAttribute('aria-labelledby','reaction-lab-title');
    dialog.innerHTML=`<header class="sheet-header"><div class="reaction-lab-title"><h2 id="reaction-lab-title">REACTION LAB</h2><p class="reaction-lab-kicker">INTERACTION PROTOTYPE · REACTIONS OFF</p></div><button type="button" data-reaction-lab-close aria-label="Reaction Labを閉じる">×</button></header>
    <div class="reaction-lab-body">
      <section class="reaction-lab-chamber-wrap" aria-label="反応槽">
        <div class="reaction-lab-chamber-head"><p><span id="reaction-lab-count">0</span> / ${MAX_INSTANCES} MOLECULES</p><button id="reaction-lab-clear" type="button">槽を空にする</button></div>
        <div id="reaction-lab-chamber" class="reaction-lab-chamber" tabindex="0" aria-label="分子をドラッグして配置する反応槽">
          <p id="reaction-lab-empty" class="reaction-lab-chamber-empty">下のMOLECULE TRAYから発見済み分子を追加してください。<br>このprototypeでは反応・消費・条件判定は起こりません。</p>
        </div>
      </section>
      <div class="reaction-lab-bottom">
        <div id="reaction-lab-inspector" class="reaction-lab-inspector"><p><strong>分子を選択</strong><small>槽内の分子をタップすると選択できます。</small></p></div>
        <p id="reaction-lab-status" class="reaction-lab-status" role="status">複数分子を同じ槽で動かす触感だけを検証します。</p>
      </div>
      <section class="reaction-lab-tray" aria-label="発見済み分子"><header><h3>MOLECULE TRAY</h3><small id="reaction-lab-known-count"></small></header><div id="reaction-lab-molecules" class="reaction-lab-molecules"></div></section>
    </div>`;
    document.body.append(dialog);
    dialog.querySelector('[data-reaction-lab-close]').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
    q('reaction-lab-clear').addEventListener('click',()=>{instances=[];selectedId=null;drag=null;statusText='槽を空にしました';render();});
    q('reaction-lab-chamber').addEventListener('pointerdown',event=>{if(event.target===q('reaction-lab-chamber')){selectedId=null;renderInspector();}});
    q('reaction-lab-chamber').addEventListener('keydown',event=>{
      const item=selected();if(!item)return;
      const delta=event.shiftKey ? 0.06 : 0.025,move={ArrowLeft:[-delta,0],ArrowRight:[delta,0],ArrowUp:[0,-delta],ArrowDown:[0,delta]}[event.key];
      if(!move)return;event.preventDefault();item.x=clamp(item.x+move[0],.08,.92);item.y=clamp(item.y+move[1],.09,.91);renderInstances();statusText='選択中の分子を移動しました';renderStatus();
    });
  }
  return dialog;
}

function renderTray(){
  const host=q('reaction-lab-molecules'),known=knownRecords();host.replaceChildren();q('reaction-lab-known-count').textContent=`${known.length} discovered`;
  if(!known.length){const note=document.createElement('p');note.className='reaction-lab-status';note.textContent='図鑑へ登録した分子がまだありません。';host.append(note);return;}
  for(const record of known){
    const button=document.createElement('button');button.type='button';button.className='reaction-lab-pick';button.dataset.moleculeId=record.id;button.disabled=instances.length>=MAX_INSTANCES;
    const img=document.createElement('img');img.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';
    const label=document.createElement('span'),name=document.createElement('strong'),formula=document.createElement('small');name.textContent=displayName(record);formula.textContent=record.formula??record.nameEn??'';label.append(name,formula);button.append(img,label);
    button.addEventListener('click',()=>addInstance(record.id));host.append(button);
  }
}

function addInstance(moleculeId){
  const record=byId.get(moleculeId);if(!record||instances.length>=MAX_INSTANCES)return false;
  const point=spawnPoint(instances.length),instance={instanceId:`lab-${nextInstance++}`,moleculeId,x:point.x,y:point.y};instances.push(instance);selectedId=instance.instanceId;statusText=`${displayName(record)}を反応槽へ追加しました`;render();return true;
}
function removeSelected(){
  const item=selected();if(!item)return;const record=byId.get(item.moleculeId);instances=instances.filter(row=>row.instanceId!==item.instanceId);selectedId=null;drag=null;statusText=`${displayName(record)}を反応槽から戻しました`;render();
}
function renderStatus(){q('reaction-lab-status').textContent=statusText||'複数分子を同じ槽で動かす触感だけを検証します。';}
function renderInspector(){
  const host=q('reaction-lab-inspector'),item=selected();host.replaceChildren();
  if(!item){const p=document.createElement('p');p.innerHTML='<strong>分子を選択</strong><small>槽内の分子をタップすると選択できます。</small>';host.append(p);return;}
  const record=byId.get(item.moleculeId),p=document.createElement('p'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=displayName(record);small.textContent=`${record?.formula??''} · 槽内位置 ${Math.round(item.x*100)}, ${Math.round(item.y*100)}`;p.append(strong,small);
  const remove=document.createElement('button');remove.type='button';remove.textContent='この分子を戻す';remove.addEventListener('click',removeSelected);host.append(p,remove);
}
function renderInstances(){
  const chamber=q('reaction-lab-chamber'),empty=q('reaction-lab-empty');
  for(const node of [...chamber.querySelectorAll('.reaction-lab-molecule')])node.remove();
  empty.hidden=instances.length>0;
  for(const item of instances){
    const record=byId.get(item.moleculeId);if(!record)continue;
    const node=document.createElement('button');node.type='button';node.className='reaction-lab-molecule';node.dataset.instanceId=item.instanceId;node.dataset.moleculeId=item.moleculeId;node.style.left=`${item.x*100}%`;node.style.top=`${item.y*100}%`;node.setAttribute('aria-pressed',String(item.instanceId===selectedId));node.setAttribute('aria-label',`${displayName(record)}。ドラッグで移動`);
    const img=document.createElement('img');img.src=new URL(`../assets/models/molecule-${record.id}.svg`,import.meta.url).href;img.alt='';img.draggable=false;
    const label=document.createElement('small');label.textContent=record.formula??displayName(record);node.append(img,label);
    node.addEventListener('pointerdown',event=>{
      if(event.button!==0||drag)return;event.preventDefault();selectedId=item.instanceId;
      const rect=chamber.getBoundingClientRect(),px=(event.clientX-rect.left)/Math.max(1,rect.width),py=(event.clientY-rect.top)/Math.max(1,rect.height);
      drag={pointerId:event.pointerId,instanceId:item.instanceId,offsetX:px-item.x,offsetY:py-item.y,node};node.setPointerCapture?.(event.pointerId);renderInspector();
      for(const child of chamber.querySelectorAll('.reaction-lab-molecule'))child.setAttribute('aria-pressed',String(child.dataset.instanceId===selectedId));
    });
    node.addEventListener('pointermove',event=>{
      if(!drag||drag.pointerId!==event.pointerId||drag.instanceId!==item.instanceId)return;event.preventDefault();const rect=chamber.getBoundingClientRect();
      item.x=clamp((event.clientX-rect.left)/Math.max(1,rect.width)-drag.offsetX,.08,.92);item.y=clamp((event.clientY-rect.top)/Math.max(1,rect.height)-drag.offsetY,.09,.91);node.style.left=`${item.x*100}%`;node.style.top=`${item.y*100}%`;renderInspector();
    });
    const release=event=>{if(!drag||drag.pointerId!==event.pointerId||drag.instanceId!==item.instanceId)return;try{node.releasePointerCapture?.(event.pointerId);}catch{}drag=null;statusText=`${displayName(record)}を移動しました`;renderStatus();};
    node.addEventListener('pointerup',release);node.addEventListener('pointercancel',release);node.addEventListener('lostpointercapture',event=>{if(drag?.pointerId===event.pointerId&&drag.instanceId===item.instanceId){drag=null;renderStatus();}});
    chamber.append(node);
  }
}
function render(){
  q('reaction-lab-count').textContent=String(instances.length);renderInstances();renderInspector();renderStatus();renderTray();
}
async function openLab(){
  const dialog=ensureShell();statusText='';
  try{await loadCatalog();render();if(!dialog.open)dialog.showModal();}
  catch(error){statusText='分子DBを読み込めませんでした';renderStatus();console.warn('Reaction Lab molecule catalog unavailable.',error);if(!dialog.open)dialog.showModal();}
}

ensureShell();
