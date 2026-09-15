from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT/path).read_text()

def write(path,text):
    (ROOT/path).write_text(text)

def replace_exact(path,old,new,count=1):
    text=read(path)
    actual=text.count(old)
    if actual!=count:
        raise SystemExit(f'{path}: expected {count} exact matches, found {actual}: {old[:100]!r}')
    write(path,text.replace(old,new,count))

def replace_regex(path,pattern,repl,count=1):
    text=read(path)
    updated,n=re.subn(pattern,repl,text,count=count,flags=re.S)
    if n!=count:
        raise SystemExit(f'{path}: expected {count} regex matches, found {n}: {pattern[:100]!r}')
    write(path,updated)

# Shared element presentation metadata: CRAFT and LOADOUT use the same atom colour source.
colors={
    "{symbol:'H', name:'水素'},":"{symbol:'H', name:'水素', color:'#f8fafc'},",
    "{symbol:'C', name:'炭素'},":"{symbol:'C', name:'炭素', color:'#64748b'},",
    "{symbol:'O', name:'酸素'},":"{symbol:'O', name:'酸素', color:'#ef4444'},",
    "{symbol:'N', name:'窒素'},":"{symbol:'N', name:'窒素', color:'#3b82f6'},",
    "{symbol:'Cl', name:'塩素'},":"{symbol:'Cl', name:'塩素', color:'#16a34a'},",
    "{symbol:'S', name:'硫黄'},":"{symbol:'S', name:'硫黄', color:'#eab308'},",
    "{symbol:'P', name:'リン'},":"{symbol:'P', name:'リン', color:'#f97316'},",
    "{symbol:'F', name:'フッ素'},":"{symbol:'F', name:'フッ素', color:'#22c55e'},",
}
for old,new in colors.items(): replace_exact(Path('src/element-progression.js'),old,new)
replace_exact(Path('src/element-progression.js'),
"      const item=ELEMENT_PRESENTATION.find(item=>item.symbol===button.dataset.element);\n      if(!item)continue;",
"      const item=ELEMENT_PRESENTATION.find(item=>item.symbol===button.dataset.element);\n      if(!item)continue;button.style.setProperty('--element-color',item.color);")

workstation=Path('src/veil/loadout-workstation.js')
replace_exact(workstation,
"import { RESOURCE_KEY } from './resources.js';",
"import { RESOURCE_KEY } from './resources.js';\nimport { ELEMENT_PRESENTATION } from '../element-progression.js?v=39';")

stock_block=r'''function installLoadoutElementStock(map){
  if(!map)return null;
  let stock=document.getElementById('loadout-element-stock');
  if(stock)return stock;
  stock=document.createElement('section');stock.id='loadout-element-stock';stock.className='loadout-element-stock';stock.setAttribute('aria-label','BASE STOCK');
  const heading=document.createElement('span');heading.className='loadout-element-stock-title';heading.textContent='BASE STOCK';
  const elements=document.createElement('div');elements.className='loadout-stock-elements';
  for(const item of ELEMENT_PRESENTATION){
    const token=document.createElement('div');token.className='loadout-element-token';token.dataset.loadoutStockElement=item.symbol;token.dataset.stockCount='0';token.hidden=true;token.style.setProperty('--element-color',item.color);token.setAttribute('role','img');
    const atom=document.createElement('span');atom.className='atom-preview';atom.setAttribute('aria-hidden','true');
    const symbol=document.createElement('strong');symbol.textContent=item.symbol;const count=document.createElement('small');count.dataset.loadoutElementStock=item.symbol;count.textContent='0';
    token.append(atom,symbol,count);elements.append(token);
  }
  stock.append(heading,elements);map.after(stock);return stock;
}

export function syncLoadoutElementStock(resources,root=document){
  const stock=root.querySelector?.('#loadout-element-stock');if(!stock||!resources?.state?.elements)return false;let visible=0;
  for(const token of stock.querySelectorAll('[data-loadout-stock-element]')){
    const symbol=token.dataset.loadoutStockElement,item=ELEMENT_PRESENTATION.find(candidate=>candidate.symbol===symbol),unlocked=resources.canUseElement?.(symbol)===true,count=Math.max(0,Number(resources.state.elements[symbol]??0));
    token.hidden=!unlocked;token.dataset.stockCount=String(count);token.querySelector('[data-loadout-element-stock]')?.replaceChildren(String(count));
    if(item)token.setAttribute('aria-label',`${item.name}（${symbol}） BASE STOCK ${count}`);if(unlocked)visible++;
  }
  stock.hidden=visible===0;return true;
}

function ensureLaunchIntakeAnchor(map){
  if(!map)return null;let anchor=map.querySelector('[data-launch-intake-anchor]');if(anchor)return anchor;
  anchor=document.createElement('span');anchor.className='loadout-synthesis-intake';anchor.dataset.launchIntakeAnchor='true';anchor.setAttribute('aria-hidden','true');map.append(anchor);return anchor;
}

export function syncLaunchIntakeAnchor(map=document.querySelector?.('#supply-dialog .collector-shell-map')){
  if(!map)return false;const anchor=ensureLaunchIntakeAnchor(map),canvas=map.querySelector('#collector-shell-preview'),movement=canvas?.style.transform?.trim()??'';
  anchor.style.transform=`translate(-50%,-50%)${movement?` ${movement}`:''}`;return true;
}

function observeLaunchIntakeAnchor(map){
  const canvas=map?.querySelector('#collector-shell-preview');if(!canvas||canvas._loadoutIntakeObserver)return;
  const observer=new MutationObserver(()=>syncLaunchIntakeAnchor(map));observer.observe(canvas,{attributes:true,attributeFilter:['style']});canvas._loadoutIntakeObserver=observer;syncLaunchIntakeAnchor(map);
}

export async function animateLoadoutElementTransfer({cost={},root=document,reduced=false}={}){
  const dialog=root.querySelector?.('#supply-dialog'),map=root.querySelector?.('#supply-dialog .collector-shell-map');if(!dialog||!map)return {animated:false,reason:'missing-loadout'};
  const entries=Object.entries(cost??{}).filter(([,amount])=>Number(amount)>0);if(!entries.length)return {animated:false,reason:'no-cost'};
  if(reduced)return {animated:false,reason:'reduced-motion'};
  const canvas=map.querySelector('#collector-shell-preview');for(const animation of canvas?.getAnimations?.()??[])try{await animation.finished;}catch{}
  syncLaunchIntakeAnchor(map);const intake=map.querySelector('[data-launch-intake-anchor]'),targetRect=intake?.getBoundingClientRect();
  if(!targetRect||targetRect.width<=0||targetRect.height<=0)return {animated:false,reason:'missing-intake'};
  const doc=root.ownerDocument??root,layer=doc.createElement('div');layer.className='loadout-transfer-layer';layer.setAttribute('aria-hidden','true');dialog.append(layer);map.dataset.synthesisActive='true';
  const targetX=targetRect.left+targetRect.width/2,targetY=targetRect.top+targetRect.height/2,finished=[];let sequence=0;
  try{
    for(const [element,amount] of entries){
      const token=map.parentElement?.querySelector(`[data-loadout-stock-element="${element}"]`)??root.querySelector?.(`[data-loadout-stock-element="${element}"]`),source=token?.querySelector('.atom-preview'),sourceRect=source?.getBoundingClientRect();if(token?.hidden||!sourceRect||sourceRect.width<=0||sourceRect.height<=0)continue;
      const startX=sourceRect.left+sourceRect.width/2,startY=sourceRect.top+sourceRect.height/2,copies=Math.min(4,Math.max(1,Math.floor(Number(amount))));
      for(let index=0;index<copies;index++){
        const dot=doc.createElement('span'),meta=ELEMENT_PRESENTATION.find(item=>item.symbol===element),size=22,dx=targetX-startX,dy=targetY-startY,bend=((sequence%3)-1)*14;
        dot.className='loadout-transfer-atom atom-preview';dot.dataset.element=element;dot.dataset.startX=String(startX);dot.dataset.startY=String(startY);dot.dataset.targetX=String(targetX);dot.dataset.targetY=String(targetY);dot.textContent=element;dot.style.setProperty('--element-color',meta?.color??'#bfefff');Object.assign(dot.style,{left:`${startX-size/2}px`,top:`${startY-size/2}px`});layer.append(dot);
        const animation=dot.animate?.([
          {transform:'translate(0px,0px) scale(.72)',opacity:.28},
          {transform:`translate(${dx*.54+bend}px,${dy*.42}px) scale(1)`,opacity:1,offset:.56},
          {transform:`translate(${dx}px,${dy}px) scale(.2)`,opacity:0},
        ],{duration:430,delay:sequence*26,easing:'cubic-bezier(.3,.75,.25,1)',fill:'forwards'});if(animation?.finished)finished.push(animation.finished.catch(()=>{}));sequence++;
      }
    }
    if(!sequence)return {animated:false,reason:'missing-source'};if(finished.length)await Promise.all(finished);return {animated:true,elements:entries.map(([element])=>element),target:{x:targetX,y:targetY}};
  }finally{delete map.dataset.synthesisActive;layer.remove();}
}

function installLabels'''
replace_regex(workstation,r"function syncStockPreview\(preview\)\{.*?\n\}\n\nfunction observeStockPreview\(\)\{.*?\n\}\n\nfunction installLabels",stock_block)
replace_exact(workstation,"  observeStockPreview();","  installLoadoutElementStock(map);ensureLaunchIntakeAnchor(map);observeLaunchIntakeAnchor(map);")

old_css="""#supply-dialog #loadout-stock-preview{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px;width:min(330px,calc(100% - 44px));min-height:0!important;margin:8px auto 0;padding:0!important}\n#supply-dialog #loadout-stock-preview[hidden]{display:none!important}\n#supply-dialog #loadout-stock-preview>[data-sufficient]{min-width:0;padding:6px 8px;border:1px solid #34505d;border-radius:9px;background:#0b202b;color:#c9d8dd;font-variant-numeric:tabular-nums;text-align:center}\n#supply-dialog #loadout-stock-preview>[data-sufficient='true']{opacity:.42}\n#supply-dialog #loadout-stock-preview>[data-sufficient='false']{border-color:#b97856;box-shadow:inset 0 0 0 1px #b9785633,0 0 9px #b9785622;color:#f0d2bf}\n"""
new_css="""#supply-dialog .loadout-synthesis-intake{position:absolute;z-index:7;left:var(--loadout-ship-x);top:52%;width:10px;height:10px;border-radius:50%;opacity:0;pointer-events:none;box-shadow:0 0 0 0 #bff7ff00;transition:opacity .12s ease,box-shadow .12s ease}\n#supply-dialog .collector-shell-map[data-synthesis-active='true'] .loadout-synthesis-intake{opacity:.92;box-shadow:0 0 6px 2px #d9fbff,0 0 18px 8px #75dbe877}\n#supply-dialog .loadout-element-stock{display:grid;gap:6px;margin:8px 0 0;padding:8px 10px;border:1px solid #294656;border-radius:13px;background:#091b27;pointer-events:none;user-select:none}\n#supply-dialog .loadout-element-stock-title{color:#8ea9b5;font-size:9px;font-weight:800;letter-spacing:.16em}\n#supply-dialog .loadout-stock-elements{display:grid;grid-template-columns:repeat(auto-fit,minmax(54px,1fr));gap:7px}\n#supply-dialog .loadout-element-token{min-width:0;min-height:50px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:1fr 1fr;align-items:center;column-gap:7px;padding:5px 7px;border:1px solid color-mix(in srgb,var(--element-color) 55%,#294656);border-radius:11px;background:color-mix(in srgb,var(--element-color) 10%,#0b202b);font-variant-numeric:tabular-nums;cursor:default}\n#supply-dialog .loadout-element-token>.atom-preview{grid-row:1 / 3;width:24px;height:24px}\n#supply-dialog .loadout-element-token[data-loadout-stock-element='H']>.atom-preview{width:20px;height:20px}\n#supply-dialog .loadout-element-token>strong{align-self:end;font-size:13px;line-height:1}\n#supply-dialog .loadout-element-token>small{align-self:start;color:#b6c9d8;font-size:10px;font-weight:700;line-height:1.2}\n#supply-dialog .loadout-element-token[data-stock-count='0']>small{opacity:.52}\n#supply-dialog .loadout-transfer-layer{position:fixed;inset:0;z-index:30;pointer-events:none;overflow:visible}\n#supply-dialog .loadout-transfer-atom{position:absolute!important;width:22px!important;height:22px!important;display:grid!important;place-items:center!important;color:#07141f;font-size:8px;font-weight:900;line-height:1;will-change:transform,opacity;text-shadow:0 1px 1px #fff8}\n"""
replace_exact(workstation,old_css,new_css)
replace_exact(workstation,"#supply-dialog #collector-launch-handle{left:var(--loadout-ship-x)!important;top:52%!important;width:76px!important;height:76px!important}","#supply-dialog #collector-launch-handle{left:var(--loadout-ship-x)!important;top:52%!important;width:76px!important;height:76px!important}")
replace_exact(workstation,"#supply-dialog #loadout-stock-preview{grid-template-columns:repeat(2,minmax(0,1fr))!important}","#supply-dialog .loadout-stock-elements{grid-template-columns:repeat(4,minmax(0,1fr))!important}")
replace_exact(workstation,"#supply-dialog .loadout-callout-label{transition:none}","#supply-dialog .loadout-callout-label,#supply-dialog .loadout-synthesis-intake{transition:none}")

# Keep the modal visible only while the committed transfer presentation is running.
replace_exact(Path('src/game-shell.js'),
"  return {close:()=>dialogs.forEach(dialog=>{if(dialog.open)dialog.close();}),isOpen:()=>dialogs.some(dialog=>dialog.open),closeMenu:()=>q('menu-dialog')?.close()};",
"  return {close:()=>dialogs.forEach(dialog=>{if(dialog.open&&dialog.dataset.preserveShellClose!=='true')dialog.close();}),isOpen:()=>dialogs.some(dialog=>dialog.open),closeMenu:()=>q('menu-dialog')?.close()};")

# Transaction remains authoritative; presentation is an optional non-failing observer after supply commit.
replace_exact(Path('src/veil/launch-transaction.js'),
"  async function execute(destinationId,{partial=false}={}){",
"  async function execute(destinationId,{partial=false,presentSupply=null}={}){")
replace_exact(Path('src/veil/launch-transaction.js'),
"      stage='supply';supply=await commitSupply({destinationId,partial});\n      if(!supply)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'supply-unavailable'};\n      stage='prepare-expedition';prepared=await prepareExpedition({destinationId,supply});",
"      stage='supply';supply=await commitSupply({destinationId,partial});\n      if(!supply)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'supply-unavailable'};\n      if(typeof presentSupply==='function')try{await presentSupply(supply);}catch(error){console.warn('Launch supply presentation failed; continuing committed transaction.',error);}\n      stage='prepare-expedition';prepared=await prepareExpedition({destinationId,supply});")

# Supply UI renders authoritative stock, and only animates the plan returned by committed supply staging.
supply=Path('src/veil/supply.js')
replace_exact(supply,
"import { renderLoadoutPreview } from './loadout-preview.js';",
"import { renderLoadoutPreview } from './loadout-preview.js';\nimport { animateLoadoutElementTransfer,syncLoadoutElementStock } from './loadout-workstation.js';")
replace_exact(supply,
"  const synthesisLayer=document.createElement('div');synthesisLayer.setAttribute('aria-hidden','true');Object.assign(synthesisLayer.style,{position:'absolute',inset:'0',zIndex:'8',pointerEvents:'none',overflow:'hidden'});shellMap.append(synthesisLayer);\n",
"")
replace_regex(supply,r"  async function playSynthesis\(plan\)\{.*?\n  \}\n  async function commitAndContinue\(partial\)\{.*?\n  \}\n\n  q\('open-supply'\)",r'''  async function playSynthesis(supply){
    syncElementStocks(document,resources.state.elements);syncLoadoutElementStock(resources,document);
    return animateLoadoutElementTransfer({cost:supply?.plan?.cost??{},root:document,reduced});
  }
  async function commitAndContinue(partial){
    const destinationId=requestedDestinationId;if(!destinationId||launchBusy||resources.blocked||!canOpen())return false;
    launchBusy=true;dialog.dataset.preserveShellClose='true';
    try{
      const preview=renderLaunchPlan();
      if(preview.status==='IMPOSSIBLE'||preview.status==='PARTIAL'&&!partial){requestedDestinationId=null;update();return false;}
      let outcome;
      try{
        outcome=await onLaunchReady(destinationId,{partial,presentSupply:async supply=>{
          try{await playSynthesis(supply);}finally{delete dialog.dataset.preserveShellClose;if(dialog.open)dialog.close();}
        }});
      }catch(error){console.error('Expedition launch transaction failed unexpectedly.',error);outcome={status:'failed',reason:'unexpected',error};}
      if(outcome===true||outcome?.status==='success'){requestedDestinationId=null;if(dialog.open)dialog.close();return true;}
      requestedDestinationId=null;
      if(!resources.blocked&&canOpen()&&!dialog.open)dialog.showModal();
      update();
      return false;
    }finally{
      delete dialog.dataset.preserveShellClose;launchBusy=false;
    }
  }

  q('open-supply')''')
replace_exact(supply,
"    const state=resources.state,destinations=availableLaunchRegionIds(state.progress);syncElementStocks(document,state.elements);",
"    const state=resources.state,destinations=availableLaunchRegionIds(state.progress);syncElementStocks(document,state.elements);syncLoadoutElementStock(resources,document);")

# Regression tests for responsibility separation and presentation geometry.
loadout_test=Path('tests/loadout-workstation.test.mjs')
replace_regex(loadout_test,r"test\('LOADOUT stock preview exposes element state without an explanatory shortage banner'.*?\n\}\);",r'''test('LOADOUT BASE STOCK is read-only, shares the CRAFT atom primitive and owns a machine intake anchor',async()=>{
  const [source,progression,supply,transaction,shell]=await Promise.all([
    readFile(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8'),
    readFile(new URL('../src/element-progression.js',import.meta.url),'utf8'),
    readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8'),
    readFile(new URL('../src/veil/launch-transaction.js',import.meta.url),'utf8'),
    readFile(new URL('../src/game-shell.js',import.meta.url),'utf8'),
  ]);
  assert.match(source,/createElement\('div'\);token\.className='loadout-element-token'/,'LOADOUT stock uses non-interactive containers rather than buttons');
  assert.match(source,/atom\.className='atom-preview'/,'LOADOUT reuses the CRAFT atom visual primitive');
  assert.match(source,/token\.hidden=!unlocked/,'locked elements are not exposed while zero stock remains representable');
  assert.match(progression,/symbol:'N'.*color:'#3b82f6'/,'shared element presentation metadata owns atom colour');
  assert.match(source,/dataset\.launchIntakeAnchor='true'/,'machine visual owns an explicit synthesis intake anchor');
  assert.match(source,/movement=canvas\?\.style\.transform/,'intake anchor follows the visible collector-shell canvas translation');
  assert.match(source,/source\?\.getBoundingClientRect\(\)/,'transfer starts from the rendered element atom');
  assert.match(source,/targetRect\.left\+targetRect\.width\/2/,'transfer ends at the rendered intake anchor');
  assert.match(supply,/cost:supply\?\.plan\?\.cost/,'presentation consumes the committed supply plan rather than a pre-transaction preview');
  assert.match(supply,/syncLoadoutElementStock\(resources,document\)/,'LOADOUT stock reads authoritative resource state');
  assert.match(transaction,/await presentSupply\(supply\)/,'presentation occurs only after supply staging succeeds');
  assert.match(shell,/preserveShellClose/,'machine remains visible through the committed transfer presentation');
  assert.doesNotMatch(supply,/24\+\(index%4\)\*18|rect\.width\*\(\.52/,'legacy pseudo-position synthesis animation is removed');
});''')

launch_test=Path('tests/launch-transaction.test.mjs')
replace_exact(launch_test,"\nconsole.log('Launch transaction passed: bounded supply staging, commit-point save, rollback/retry across injected failures, exact-once success and application-level reentrancy protection.');\n",r'''
{
  const harness=createHarness(),seen=[];
  const result=await harness.transaction.execute('oxygen',{presentSupply:async supply=>{seen.push({stock:harness.resources.state.elements.H,cost:supply.plan.cost.H,prepared:harness.ui.prepared});}});
  assert.equal(result.status,LAUNCH_TRANSACTION_STATUS.SUCCESS);assert.deepEqual(seen,[{stock:12,cost:8,prepared:0}],'presentation must observe the already-committed supply before expedition preparation');assert.equal(harness.ui.rollbacks,0);
}

{
  const harness=createHarness();let warned=false;const originalWarn=console.warn;console.warn=()=>{warned=true;};let result;
  try{result=await harness.transaction.execute('oxygen',{presentSupply:async()=>{throw new Error('visual-only failure');}});}finally{console.warn=originalWarn;}
  assert.equal(result.status,LAUNCH_TRANSACTION_STATUS.SUCCESS,'presentation failure must not become a resource/launch failure');assert.equal(warned,true);assert.equal(harness.ui.rollbacks,0);assert.equal(harness.resources.state.elements.H,12);
}

console.log('Launch transaction passed: bounded supply staging, commit-point save, rollback/retry, post-commit presentation isolation, exact-once success and application-level reentrancy protection.');
''')

browser_test=r'''import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const indexHtml=await readFile(join(root,'index.html'),'utf8');
const fixtureHtml=indexHtml.replace(/\s*<script type="module" src="\.\/src\/(?:app|pwa)\.js[^\"]*"><\/script>/g,'');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__loadout_transfer_fixture__'){res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(fixtureHtml);return;}const relative=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}const body=await readFile(file);res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address();
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}assert.ok(chrome,'Chromium is required for LOADOUT transfer validation');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-loadout-transfer-')),debugPort=9231;let child=null,socket=null;const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
try{
  child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',`--user-data-dir=${profile}`,`--remote-debugging-port=${debugPort}`,'about:blank'],{stdio:['ignore','ignore','pipe']});let tabs=null;
  for(let attempt=0;attempt<120;attempt++){try{const response=await fetch(`http://127.0.0.1:${debugPort}/json/list`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await pause(100);}assert.ok(tabs?.length,'DevTools endpoint did not become ready');socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(new Error('DevTools websocket timeout')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);ok();},{once:true});socket.addEventListener('error',fail,{once:true});});
  let sequence=0;const pending=new Map();socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);}});const send=(method,params={})=>new Promise((ok,fail)=>{const id=++sequence;pending.set(id,{resolve:ok,reject:fail});socket.send(JSON.stringify({id,method,params}));});const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw new Error(response.exceptionDetails.text);return response.result?.value;};
  await send('Runtime.enable');await send('Page.enable');await send('Emulation.setDeviceMetricsOverride',{width:900,height:760,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:`http://127.0.0.1:${port}/__loadout_transfer_fixture__`});await pause(120);
  const initialized=await evaluate(`(async()=>{const mod=await import('/src/veil/loadout-workstation.js');const shell=await import('/src/veil/collector-shell.js');document.querySelector('#supply-dialog').showModal();const resources={state:{elements:{H:12,C:0,O:7,N:3,Cl:9,S:0,P:0,F:0}},canUseElement:symbol=>['H','C','O','N'].includes(symbol)};mod.syncLoadoutElementStock(resources,document);shell.drawCollectorShellPreview(document.querySelector('#collector-shell-preview'));mod.syncLaunchIntakeAnchor(document.querySelector('#supply-dialog .collector-shell-map'));window.__loadoutTransfer={mod,resources};return true;})()`);assert.equal(initialized,true);
  const inspect=()=>evaluate(`(()=>{const rect=node=>{const r=node?.getBoundingClientRect();return r&&{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,x:r.left+r.width/2,y:r.top+r.height/2}};const map=document.querySelector('#supply-dialog .collector-shell-map'),canvas=document.querySelector('#collector-shell-preview'),intake=document.querySelector('[data-launch-intake-anchor]'),stock=document.querySelector('#loadout-element-stock'),tokens=Object.fromEntries([...document.querySelectorAll('[data-loadout-stock-element]')].map(node=>[node.dataset.loadoutStockElement,{hidden:node.hidden,count:node.dataset.stockCount,tag:node.tagName,pointer:getComputedStyle(node).pointerEvents,rect:rect(node),atom:rect(node.querySelector('.atom-preview'))}]));const cr=rect(canvas),ir=rect(intake);return{viewport:{w:innerWidth,h:innerHeight},map:rect(map),canvas:cr,intake:ir,expected:{x:cr.left+cr.width*.39,y:cr.top+cr.height*.52},stock:rect(stock),tokens};})()`);
  let desktop=await inspect();assert.deepEqual([desktop.tokens.H.count,desktop.tokens.C.count,desktop.tokens.O.count,desktop.tokens.N.count],['12','0','7','3']);assert.equal(desktop.tokens.C.hidden,false,'unlocked zero-stock C remains visible');assert.equal(desktop.tokens.N.hidden,false,'unlocked N is visible');assert.equal(desktop.tokens.Cl.hidden,true,'locked rare element stays hidden');assert.equal(desktop.tokens.H.tag,'DIV');assert.equal(desktop.tokens.H.pointer,'none');assert(Math.abs(desktop.intake.x-desktop.expected.x)<1.5&&Math.abs(desktop.intake.y-desktop.expected.y)<1.5,'intake anchor must sit on the rendered machine center');
  await evaluate(`window.__loadoutTransfer.promise=window.__loadoutTransfer.mod.animateLoadoutElementTransfer({cost:{H:8,O:2},root:document,reduced:false})`);await pause(55);const flight=await evaluate(`(()=>{const atoms=[...document.querySelectorAll('.loadout-transfer-atom')];return atoms.map(atom=>({element:atom.dataset.element,startX:+atom.dataset.startX,startY:+atom.dataset.startY,targetX:+atom.dataset.targetX,targetY:+atom.dataset.targetY,left:parseFloat(atom.style.left),top:parseFloat(atom.style.top)}));})()`);assert.equal(flight.length,6,'actual committed element kinds determine the visible transfer particles');assert.deepEqual([...new Set(flight.map(item=>item.element))].sort(),['H','O']);for(const atom of flight){const source=desktop.tokens[atom.element].atom;assert(Math.abs(atom.startX-source.x)<1&&Math.abs(atom.startY-source.y)<1,'atom starts at its rendered BASE STOCK atom');assert(Math.abs(atom.targetX-desktop.intake.x)<1&&Math.abs(atom.targetY-desktop.intake.y)<1,'atom ends at the rendered machine intake');assert(Math.abs(atom.left+11-atom.startX)<1&&Math.abs(atom.top+11-atom.startY)<1);}await evaluate(`window.__loadoutTransfer.promise`);
  const reduced=await evaluate(`window.__loadoutTransfer.mod.animateLoadoutElementTransfer({cost:{H:2},root:document,reduced:true})`);assert.equal(reduced.animated,false);assert.equal(reduced.reason,'reduced-motion');assert.equal(await evaluate(`document.querySelectorAll('.loadout-transfer-layer').length`),0);
  await send('Emulation.setDeviceMetricsOverride',{width:320,height:640,deviceScaleFactor:1,mobile:true});await pause(120);await evaluate(`window.__loadoutTransfer.mod.syncLaunchIntakeAnchor(document.querySelector('#supply-dialog .collector-shell-map'));(async()=>{const shell=await import('/src/veil/collector-shell.js');shell.drawCollectorShellPreview(document.querySelector('#collector-shell-preview'));window.__loadoutTransfer.mod.syncLaunchIntakeAnchor(document.querySelector('#supply-dialog .collector-shell-map'));})()`);await pause(40);const mobile=await inspect();assert.equal(mobile.viewport.w,320);assert(mobile.stock.left>=-1&&mobile.stock.right<=321,'BASE STOCK stays inside portrait viewport');assert(Math.abs(mobile.intake.x-mobile.expected.x)<1.5&&Math.abs(mobile.intake.y-mobile.expected.y)<1.5,'portrait intake follows responsive machine geometry');for(const symbol of ['H','C','O','N'])assert(mobile.tokens[symbol].rect.left>=mobile.stock.left-1&&mobile.tokens[symbol].rect.right<=mobile.stock.right+1,'visible stock tokens remain within LOADOUT stock panel');
  await send('Emulation.setDeviceMetricsOverride',{width:1000,height:520,deviceScaleFactor:1,mobile:false});await pause(100);await evaluate(`window.__loadoutTransfer.mod.syncLaunchIntakeAnchor(document.querySelector('#supply-dialog .collector-shell-map'))`);const wide=await inspect();assert.equal(wide.viewport.w,1000);assert(Math.abs(wide.intake.x-wide.expected.x)<1.5&&Math.abs(wide.intake.y-wide.expected.y)<1.5,'wide viewport intake remains bound to machine geometry');
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await pause(100);server.close();await rm(profile,{recursive:true,force:true});}
console.log('LOADOUT transfer browser validation passed: read-only H/C/O/N stock, zero stock, actual H/O transfer origins, machine intake endpoint, portrait/wide responsiveness and reduced motion.');
'''
write(Path('tests/loadout-transfer-browser.test.mjs'),browser_test)

# Make the real CI execute the browser-level regression.
replace_exact(Path('.github/workflows/repository-validation.yml'),
"          node tests/loadout-workstation.test.mjs\n          node tests/loadout-launch-regression.test.mjs",
"          node tests/loadout-workstation.test.mjs\n          node tests/loadout-transfer-browser.test.mjs\n          node tests/loadout-launch-regression.test.mjs")

print('LOADOUT transfer task patch applied')
