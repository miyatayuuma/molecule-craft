const instances=new WeakMap();
const MAX_PARTICLES=12;
const centerOf=node=>{
  if(!node?.getBoundingClientRect)return null;
  const rect=node.getBoundingClientRect();
  if(!rect||(!rect.width&&!rect.height))return null;
  return{x:rect.left+rect.width/2,y:rect.top+rect.height/2};
};
const now=()=>globalThis.performance?.now?.()??Date.now();

export function createCraftTransferEffects(root=document,{reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches??false}={}){
  let layer=null,ready=false,suppressDepletionUntil=0;
  const pool=[],active=new Set(),stockCounts=new Map();
  const view=root.defaultView??globalThis;
  const Mutation=view.MutationObserver??globalThis.MutationObserver;

  function ensureLayer(){
    if(layer?.isConnected)return layer;
    if(!root.body)return null;
    layer=root.createElement('div');
    layer.setAttribute('aria-hidden','true');
    Object.assign(layer.style,{position:'fixed',inset:'0',zIndex:'8',pointerEvents:'none',overflow:'hidden',contain:'strict'});
    root.body.appendChild(layer);
    return layer;
  }
  function acquire(){
    const host=ensureLayer();if(!host||active.size>=MAX_PARTICLES)return null;
    let node=pool.find(item=>!active.has(item));
    if(!node){node=root.createElement('span');pool.push(node);host.appendChild(node);}
    active.add(node);
    Object.assign(node.style,{display:'block',position:'absolute',left:'0',top:'0',width:'12px',height:'12px',borderRadius:'50%',pointerEvents:'none',willChange:'transform,opacity',opacity:'0',backgroundImage:'none',backgroundSize:'contain',backgroundRepeat:'no-repeat',backgroundPosition:'center'});
    return node;
  }
  function release(node){
    active.delete(node);node.getAnimations?.().forEach(animation=>animation.cancel());
    Object.assign(node.style,{display:'none',opacity:'0',backgroundImage:'none',willChange:'auto'});
  }
  function move({from,to,color='#bfeef4',size=12,duration=320,image=null,delay=0}){
    if(reduced||!from||!to)return false;
    const node=acquire();if(!node)return false;
    node.style.width=`${size}px`;node.style.height=`${size}px`;
    if(image){node.style.borderRadius='6px';node.style.background='transparent';node.style.backgroundImage=`url("${String(image).replaceAll('"','%22')}")`;}
    else{
      node.style.borderRadius='50%';
      node.style.background=`radial-gradient(circle at 32% 25%,#fff 0 8%,${color} 42%,color-mix(in srgb,${color} 45%,#07131f) 100%)`;
    }
    const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)||1,arc=Math.min(26,Math.max(10,length*.08));
    const mx=(from.x+to.x)/2+dy/length*arc,my=(from.y+to.y)/2-dx/length*arc;
    const transform=(point,scale)=>`translate3d(${point.x}px,${point.y}px,0) translate(-50%,-50%) scale(${scale})`;
    if(typeof node.animate==='function'){
      const animation=node.animate([
        {transform:transform(from,.58),opacity:0},
        {transform:transform(from,.92),opacity:1,offset:.14},
        {transform:transform({x:mx,y:my},1),opacity:.96,offset:.55},
        {transform:transform(to,.28),opacity:0},
      ],{duration,delay,easing:'cubic-bezier(.22,.72,.24,1)',fill:'forwards'});
      animation.finished.catch(()=>{}).finally(()=>release(node));
    }else{
      node.style.transform=transform(to,.28);node.style.opacity='0';view.setTimeout?.(()=>release(node),duration+delay);
    }
    return true;
  }
  const viewerPoint=()=>centerOf(root.querySelector?.('#viewer'));
  const elementButton=symbol=>root.querySelector?.(`#element-palette [data-element="${symbol}"]`);
  const elementSource=symbol=>{
    const button=elementButton(symbol);
    return{button,point:centerOf(button?.querySelector?.('.atom-preview')??button),color:button?.style?.getPropertyValue?.('--element-color')||'#bfeef4'};
  };
  function atomFromStock(symbol,to=viewerPoint(),options={}){
    const source=elementSource(symbol);return move({from:source.point,to,color:source.color,...options});
  }
  function atomToStock(symbol,from=viewerPoint(),options={}){
    const target=elementSource(symbol);return move({from,to:target.point,color:target.color,...options});
  }
  function chargeFromStock(record,to){
    if(reduced||!record?.atoms?.length||!to)return 0;
    const atoms=record.atoms.slice(0,8),used=new Map();let emitted=0;
    for(const symbol of atoms){
      const source=elementSource(symbol);if(!source.point)continue;
      const index=used.get(symbol)??0;used.set(symbol,index+1);
      const angle=index*1.9+emitted*.72,offset={x:to.x+Math.cos(angle)*7,y:to.y+Math.sin(angle)*7};
      if(move({from:source.point,to:offset,color:source.color,size:10,duration:300+emitted*18,delay:Math.min(90,emitted*14)}))emitted++;
      if(active.size>=MAX_PARTICLES)break;
    }
    return emitted;
  }
  function partFromPalette(button,to=viewerPoint()){
    const source=centerOf(button?.querySelector?.('.collection-thumbnail')??button),image=button?.querySelector?.('.collection-thumbnail')?.src;
    return move({from:source,to,image,size:image?32:16,color:'#8fe0df',duration:360});
  }
  function cancelAll(){for(const node of [...active])release(node);}

  function snapshotStocks(){
    for(const node of root.querySelectorAll?.('#element-palette [data-element-stock]')??[]){
      stockCounts.set(node.dataset.elementStock,Math.max(0,Number(node.textContent??0)));
    }
  }
  function onStocksChanged(){
    const charging=root.querySelector?.('#tank-charge-stage');
    const suppressDepletion=now()<suppressDepletionUntil||!!(charging&&!charging.hidden);
    for(const node of root.querySelectorAll?.('#element-palette [data-element-stock]')??[]){
      const symbol=node.dataset.elementStock,next=Math.max(0,Number(node.textContent??0)),previous=stockCounts.get(symbol);
      stockCounts.set(symbol,next);if(previous==null||next===previous||!ready)continue;
      const delta=next-previous,count=Math.min(3,Math.abs(delta));
      if(delta<0&&!suppressDepletion)for(let i=0;i<count;i++)atomFromStock(symbol,viewerPoint(),{delay:i*28});
      if(delta>0)for(let i=0;i<count;i++)atomToStock(symbol,viewerPoint(),{delay:i*28});
    }
  }
  const palette=root.querySelector?.('#element-palette');
  const observer=Mutation&&palette?new Mutation(onStocksChanged):null;
  observer?.observe(palette,{subtree:true,childList:true,characterData:true});
  root.addEventListener?.('click',event=>{
    const part=event.target?.closest?.('.craft-part.unlocked');if(!part)return;
    suppressDepletionUntil=now()+180;partFromPalette(part);
  },true);
  root.addEventListener?.('visibilitychange',()=>{if(root.hidden)cancelAll();});
  view.addEventListener?.('pagehide',cancelAll);
  view.setTimeout?.(()=>{snapshotStocks();ready=true;},0);

  return{atomFromStock,atomToStock,chargeFromStock,partFromPalette,cancelAll,_activeCount:()=>active.size};
}

export function getCraftTransferEffects(root=document,options){
  if(!root?.querySelector)return null;
  let instance=instances.get(root);
  if(!instance){instance=createCraftTransferEffects(root,options);instances.set(root,instance);}
  return instance;
}

if(typeof document!=='undefined')globalThis.setTimeout?.(()=>getCraftTransferEffects(document),0);
