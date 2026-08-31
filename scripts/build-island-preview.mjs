// Optional, isolated visual QA when a local HTTP preview is unavailable.
// The delivered application remains direct ES modules. Only this temporary
// preview bundles source, embeds local resources and uses in-memory storage.
// Usage: node scripts/build-island-preview.mjs /path/to/esbuild/lib/main.js output.html
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createIslandState,unlockSample,applySample,ignite,advanceIsland} from '../src/island-engine.js?v=33';
import {ISLAND_SAMPLES} from '../src/island-data.js?v=33';
import {islandSnapshot,ISLAND_STORAGE_KEY} from '../src/island-save.js?v=33';

if(!process.argv[2]||!process.argv[3])throw new Error('Pass esbuild module path and temporary output path');
const {build}=await import(pathToFileURL(process.argv[2]));
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const result=await build({entryPoints:[fileURLToPath(new URL('src/app-v14.js',root))],bundle:true,write:false,minify:true,format:'iife',target:'es2022',define:{'import.meta.url':JSON.stringify('https://island-preview.invalid/src/app-v14.js')},plugins:[{
  name:'embedded-thumbnails',setup(builder){builder.onLoad({filter:/collection-ui\.js$/},async args=>{
    const source=await readFile(args.path,'utf8');
    return{contents:source.replace(/new URL\((`\.\.\/assets\/models\/[^;]+?),import\.meta\.url\)\.href/,'window.previewAsset($1)'),loader:'js'};
  });},
}]});
const files={};for(const name of ['molecules.json','functional-groups.json','craft-structures.json','encyclopedia.json'])files[`/data/${name}`]=await read(`data/${name}`);
const assets={};for(const name of ['icon.svg',...(await readdir(new URL('assets/models/',root))).map(n=>`models/${n}`)])assets[`/assets/${name}`]=`data:image/svg+xml;base64,${Buffer.from(await read(`assets/${name}`)).toString('base64')}`;
const scripts=result.outputFiles[0].text.replaceAll('</script','<\\/script');
const html=(await read('index.html')).replace(/<link rel="stylesheet"[^>]*>/g,'').replace(/<link rel="(?:icon|apple-touch-icon|manifest)"[^>]*>/g,'').replace(/<script type="module"[^>]*><\/script>/g,'').replace('./assets/icon.svg',assets['/assets/icon.svg']);
const styles=`${await read('styles.css')}\n${await read('island.css')}`;
const json=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const ready=createIslandState();for(const s of ISLAND_SAMPLES)unlockSample(ready,s.id);
const lively=structuredClone(ready);
for(const [id,target,dose]of [['water','pond',3],['water','pond',3],['water','garden',3],['carbon-dioxide','garden',1],['ammonia','garden',1],['water','cell',1],['salt','cell',1],['acetone','resin',1],['hydrogen','flask',1],['methane','burner',3],['oxygen','burner',3]])applySample(lively,id,target,dose);
ignite(lively);advanceIsland(lively,7);lively.preferences.selected='water';
const scenarios={fresh:null,ready:islandSnapshot(ready),lively:islandSnapshot(lively)};
const wrapper=`<!doctype html><html lang="ja"><meta charset="utf-8"><title>Discovery Island · isolated visual QA</title><style>body{margin:0;padding:12px;background:#e8eee8;font:13px system-ui;color:#38584b}header{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin:0 0 12px}button,select{padding:8px;border:1px solid #a1b5a7;border-radius:7px;background:#fff;color:#38584b}iframe{display:block;border:0;box-shadow:0 4px 24px #60746630;background:#fff;margin:auto}small{color:#738676}output{font-size:11px}</style><header><b>Discovery Island · 検証用</b><select id="size" aria-label="検証する画面サイズ"><option value="390,844">スマホ縦 390 × 844</option><option value="360,740">スマホ縦 360 × 740</option><option value="844,390">スマホ横 844 × 390</option><option value="1280,800">デスクトップ 1280 × 800</option></select><select id="fixture" aria-label="検証シナリオ"><option value="fresh">初回</option><option value="ready">組立済み標本あり</option><option value="lively">連鎖後の島</option></select><button id="reload">保存して再読み込み</button><small>本番ソースの隔離プレビュー。保存はこのページのメモリ内。</small><output id="diagnostic"></output></header><iframe id="game" title="スマホ画面のMolecule Craft" width="390" height="844"></iframe><script>
const files=${json(files)},assets=${json(assets)},source=${json(html)},styles=${json(styles)},code=${json(scripts)},scenarios=${json(scenarios)};
let saved=null;
function boot(preserve=false){
 const which=document.querySelector('#fixture').value;const initial=preserve?saved:scenarios[which];
 const seeds={};if(initial)seeds[${json(ISLAND_STORAGE_KEY)}]=JSON.stringify(initial);
 if(which!=='fresh')seeds['molecule-craft.collection.v1']=JSON.stringify({schemaVersion:2,discoveredMolecules:${json(ISLAND_SAMPLES.filter(s=>s.source==='craft').map((s,i)=>({id:s.id,at:1000+i,order:i+1})))},milestones:[],legacyElements:[]});
 if(preserve&&window.previewWorkspace)seeds['molecule-craft.workspace.v1']=window.previewWorkspace;
 const setup='const embedded='+JSON.stringify(files)+';const assetMap='+JSON.stringify(assets)+';const store=new Map(Object.entries('+JSON.stringify(seeds)+'));Object.defineProperty(window,"localStorage",{value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>{store.set(k,String(v));if(k==="molecule-craft.discovery-island.v1")parent.postMessage({island:JSON.parse(v)},"*");if(k==="molecule-craft.workspace.v1")parent.postMessage({workspace:v},"*");},removeItem:k=>store.delete(k)}});window.fetch=async input=>{const key=new URL(String(input),"https://island-preview.invalid/").pathname;return new Response(embedded[key]??"not found",{status:embedded[key]?200:404,headers:{"content-type":"application/json"}})};window.previewAsset=path=>assetMap[new URL(path,"https://island-preview.invalid/src/").pathname];';
 document.querySelector('#game').srcdoc=source.replace('</head>','<style>'+styles+'</style></head>').replace('</body>','<script>'+setup+'<\\/script><script>'+code+'<\\/script></body>');
}
window.addEventListener('message',event=>{if(event.source!==document.querySelector('#game').contentWindow)return;if(event.data?.island){saved=event.data.island;document.querySelector('#diagnostic').textContent='投入 '+saved.experiments+' · 現象 '+saved.discoveries.length+' · 生物 '+saved.encounters.length;}if(event.data?.workspace)window.previewWorkspace=event.data.workspace;});
document.querySelector('#size').onchange=()=>{const [w,h]=document.querySelector('#size').value.split(',');const f=document.querySelector('#game');f.width=w;f.height=h;};document.querySelector('#fixture').onchange=()=>boot();document.querySelector('#reload').onclick=()=>boot(true);boot();
</script></html>`;
await writeFile(process.argv[3],wrapper);console.log(`Isolated QA preview: ${Buffer.byteLength(wrapper)} bytes (no network, mock storage only).`);
