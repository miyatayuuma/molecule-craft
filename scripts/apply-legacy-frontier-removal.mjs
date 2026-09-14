import {readFile,writeFile} from 'node:fs/promises';

async function patch(path,replacements){
  let source=await readFile(path,'utf8');
  for(const [before,after] of replacements){
    if(!source.includes(before))throw new Error(`${path}: expected source fragment not found:\n${before}`);
    source=source.replace(before,after);
  }
  await writeFile(path,source);
}

await patch('src/veil/growth.js',[[
  "export const REGION_ORDER=Object.freeze(['veil','carbon','oxygen','frontier','nitrogen']);\n",
  "export const REGION_ORDER=Object.freeze(['veil','carbon','oxygen','frontier','nitrogen']);\nexport const EXPEDITION_DESTINATION_REGION_IDS=Object.freeze(['veil','carbon','oxygen','nitrogen']);\nconst EXPEDITION_DESTINATION_REGION_SET=new Set(EXPEDITION_DESTINATION_REGION_IDS);\nexport const isExpeditionRegionDestination=id=>EXPEDITION_DESTINATION_REGION_SET.has(id);\n"
]]);

await patch('src/veil/supply.js',[
  ["import { MOLECULE_USES,REGIONS,TANK_USES } from './growth.js';","import { MOLECULE_USES,REGIONS,TANK_USES,isExpeditionRegionDestination } from './growth.js';"],
  ["const REGION_CUES=Object.freeze({veil:{glyph:'H',color:'#bfefff'},carbon:{glyph:'C',color:'#aeb8c4'},oxygen:{glyph:'O',color:'#8dbcf4'},frontier:{glyph:'',color:'#f5d584'},nitrogen:{glyph:'N',color:'#a8a8ff'}});","const REGION_CUES=Object.freeze({veil:{glyph:'H',color:'#bfefff'},carbon:{glyph:'C',color:'#aeb8c4'},oxygen:{glyph:'O',color:'#8dbcf4'},nitrogen:{glyph:'N',color:'#a8a8ff'}});"],
  ["const availableLaunchRegionIds=progress=>{const ids=[...(progress?.regions??[])];if(progress?.choCompleted===true&&!ids.includes(NITROGEN_REGION_ID))ids.push(NITROGEN_REGION_ID);return ids;};","const availableLaunchRegionIds=progress=>{const ids=[...(progress?.regions??[])].filter(isExpeditionRegionDestination);if(progress?.choCompleted===true&&!ids.includes(NITROGEN_REGION_ID))ids.push(NITROGEN_REGION_ID);return ids;};"],
  ["  const visible=ids.filter(id=>REGIONS[id]).slice(0,5),count=visible.length;","  const visible=ids.filter(id=>REGIONS[id]&&isExpeditionRegionDestination(id)).slice(0,5),count=visible.length;"]
]);

await patch('src/veil/launch-request.js',[
  ["import {REGIONS} from './growth.js';","import {REGIONS,isExpeditionRegionDestination} from './growth.js';"],
  ["    if(typeof checkpoint!=='string'||!Object.hasOwn(REGIONS,checkpoint))return false;","    if(typeof checkpoint!=='string'||!isExpeditionRegionDestination(checkpoint)||!Object.hasOwn(REGIONS,checkpoint))return false;"],
  ["  if(destinationId===NITROGEN_REGION_ID)return NITROGEN_REGION_AVAILABLE&&nitrogenChapterEligible(progress)&&Object.hasOwn(REGIONS,NITROGEN_REGION_ID);\n  return Object.hasOwn(REGIONS,destinationId)&&Array.isArray(progress.regions)&&progress.regions.includes(destinationId);","  if(!isExpeditionRegionDestination(destinationId))return false;\n  if(destinationId===NITROGEN_REGION_ID)return NITROGEN_REGION_AVAILABLE&&nitrogenChapterEligible(progress)&&Object.hasOwn(REGIONS,NITROGEN_REGION_ID);\n  return Object.hasOwn(REGIONS,destinationId)&&Array.isArray(progress.regions)&&progress.regions.includes(destinationId);" ]
]);

await patch('src/veil/resources.js',[
  ["import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,REGION_ORDER,TANK_USES,tankCapacity,tankUsesFor } from './growth.js';","import { GROWTH,MOLECULE_USES,DRIVES,REGIONS,REGION_ORDER,TANK_USES,isExpeditionRegionDestination,tankCapacity,tankUsesFor } from './growth.js';"],
  ["    visit(region){if(blocked||!Object.hasOwn(REGIONS,region))return false;const first=!state.progress.regions.includes(region);if(first)state.progress.regions.push(region);state.progress.checkpoint=region;if(region==='frontier')state.progress.frontier=true;if(region!=='veil')state.progress.cleared=true;return first;},","    visit(region){if(blocked||!Object.hasOwn(REGIONS,region))return false;const first=!state.progress.regions.includes(region);if(first)state.progress.regions.push(region);if(isExpeditionRegionDestination(region))state.progress.checkpoint=region;if(region==='frontier')state.progress.frontier=true;if(region!=='veil')state.progress.cleared=true;return first;},"
  ]
]);

await patch('src/veil/resources-persistence.js',[
  ["import { GROWTH,DRIVES,REGIONS,TANK_USES,tankCapacity } from './growth.js';","import { GROWTH,DRIVES,REGIONS,EXPEDITION_DESTINATION_REGION_IDS,TANK_USES,tankCapacity } from './growth.js';"],
  ["function parseResourceEnvelope(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object')throw Error('Invalid resources');return parsed;}\nfunction parsePersistedResources(raw){return validatePersistedState(parseResourceEnvelope(raw));}\nexport function migrateResourcesSave(raw){try{const persisted=parseResourceEnvelope(raw);return persisted.schemaVersion===SCHEMA_VERSION?validatePersistedState(persisted):createInitialResourcesState();}catch{return createInitialResourcesState();}}",
   "function parseResourceEnvelope(raw){if(typeof raw!=='string'||raw.length>3e6)throw Error('Invalid resources');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object')throw Error('Invalid resources');return parsed;}\nfunction parsePersistedResources(raw){return validatePersistedState(parseResourceEnvelope(raw));}\nexport function normalizeLegacyExpeditionDestination(state){\n  const progress=state?.progress;if(!progress||progress.checkpoint!=='frontier')return false;const visited=Array.isArray(progress.regions)?progress.regions:[],eligible=EXPEDITION_DESTINATION_REGION_IDS.filter(id=>id!=='nitrogen'||progress.choCompleted===true),fallback=eligible.filter(id=>visited.includes(id)).at(-1)??'veil';progress.checkpoint=fallback;return true;\n}\nexport function migrateResourcesSave(raw){try{const persisted=parseResourceEnvelope(raw);if(persisted.schemaVersion!==SCHEMA_VERSION)return createInitialResourcesState();const state=validatePersistedState(persisted);normalizeLegacyExpeditionDestination(state);return state;}catch{return createInitialResourcesState();}}"],
  ["if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);persisted=parsePersistedResources(previous);}return {state:persisted,previous};}",
   "if(persisted.pendingReset){finishPendingResourcesReset(storage,persisted);previous=storage.getItem(RESOURCE_KEY);persisted=parsePersistedResources(previous);}if(normalizeLegacyExpeditionDestination(persisted)){const normalized=serializeResourcesState(persisted);try{storage?.setItem(RESOURCE_KEY,normalized);previous=storage?.getItem(RESOURCE_KEY)??normalized;}catch{}}return {state:persisted,previous};}"
  ]
]);

await patch('tests/launch-selector.test.mjs',[
  ["const ids=['veil','carbon','oxygen','frontier','veil','carbon'];\nfor(let count=1;count<=5;count++){\n  const layout=launchDestinationLayout(ids.slice(0,count));\n  assert.equal(layout.length,count);\n  assert.equal(new Set(layout.map(({x,y})=>`${x.toFixed(6)},${y.toFixed(6)}`)).size,count);\n  for(const point of layout)assert.ok(Math.abs(Math.hypot(point.x,point.y)-66)<1e-8);\n}\nassert.equal(launchDestinationLayout(ids).length,5,'Destination fan stays readable when more regions are added');\nassert.deepEqual(launchDestinationLayout(['unknown','veil']).map(({id})=>id),['veil']);\nconsole.log('Explorer launch selector passed: radial inputs share the explicit launch request API without DOM event relays.');",
   "const ids=['veil','carbon','oxygen','frontier','nitrogen'];\nconst layout=launchDestinationLayout(ids);\nassert.deepEqual(layout.map(({id})=>id),['veil','carbon','oxygen','nitrogen'],'Legacy Inner Horizon/frontier is not a LOADOUT destination candidate');\nassert.equal(new Set(layout.map(({x,y})=>`${x.toFixed(6)},${y.toFixed(6)}`)).size,layout.length);\nfor(const point of layout)assert.ok(Math.abs(Math.hypot(point.x,point.y)-66)<1e-8);\nassert.deepEqual(launchDestinationLayout(['frontier','unknown','veil']).map(({id})=>id),['veil']);\nawait import('./legacy-frontier-destination.test.mjs');\nconsole.log('Explorer launch selector passed: radial inputs share the explicit launch request API without DOM event relays, and legacy frontier is absent.');"
  ]
]);

await patch('tests/launch-request.test.mjs',[[
  "const state={progress:{checkpoint:'carbon',regions:['veil','carbon','oxygen']}};",
  "const state={progress:{checkpoint:'carbon',regions:['veil','carbon','oxygen','frontier']}};"
]]);

await patch('tests/ui-symbols.test.mjs',[
  ["assert.match(supply,/frontier:\\{glyph:'',color:'#f5d584'\\}/,'Frontier destination must not render the ambiguous ◎ glyph');\nassert.doesNotMatch(supply,/frontier:\\{glyph:'◎'/,'LOADOUT destination selection must not display ◎');",
   "assert.doesNotMatch(supply,/frontier:\\{glyph:/,'Legacy frontier cue must be removed rather than rendered without a glyph');\nassert.match(supply,/filter\\(isExpeditionRegionDestination\\)/,'LOADOUT region candidates must be filtered by the canonical launch-region contract');"
  ],
  ["console.log('UI symbol contracts passed: semantic propulsion/idea cues, glyph-free frontier destination selection, preserved launch highlighting, and behavioral FIELD signal/reward signifiers.');",
   "console.log('UI symbol contracts passed: semantic propulsion/idea cues, legacy frontier destination removal, preserved launch highlighting, and behavioral FIELD signal/reward signifiers.');"
  ]
]);

await patch('tests/resources-persistence.test.mjs',[[
  "const malformedStorage=memory([[RESOURCE_KEY,'{broken']]);",
  "const legacyFrontier={...current,progress:{...current.progress,regions:['veil','carbon','oxygen','frontier'],checkpoint:'frontier'}};\nconst legacyFrontierStorage=memory([[RESOURCE_KEY,serializeResourcesState(legacyFrontier)]]),legacyFrontierLoaded=loadPersistedResources(legacyFrontierStorage);\nassert.equal(legacyFrontierLoaded.state.progress.checkpoint,'oxygen','legacy frontier checkpoint must fall back to the most advanced valid launch region');\nassert.ok(legacyFrontierLoaded.state.progress.regions.includes('frontier'),'historical frontier visit state remains available to progression logic');\nassert.equal(JSON.parse(legacyFrontierStorage.raw(RESOURCE_KEY)).progress.checkpoint,'oxygen','legacy fallback must be persisted without a schema bump');\nassert.equal(migrateResourcesSave(serializeResourcesState(legacyFrontier)).progress.checkpoint,'oxygen','current-schema migration helper normalizes the legacy destination too');\n\nconst malformedStorage=memory([[RESOURCE_KEY,'{broken']]);"
]]);

await writeFile('tests/legacy-frontier-destination.test.mjs',`import assert from 'node:assert/strict';
import {createResources} from '../src/veil/resources.js';
import {createUniverse} from '../src/veil/universe.js';
import {EXPEDITION_DESTINATION_REGION_IDS,REGIONS,flightConfig,isExpeditionRegionDestination,regionAt} from '../src/veil/growth.js';
import {isExpeditionDestinationAvailable} from '../src/veil/launch-request.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
assert.deepEqual(EXPEDITION_DESTINATION_REGION_IDS,['veil','carbon','oxygen','nitrogen']);
assert.equal(isExpeditionRegionDestination('frontier'),false);
assert.equal(isExpeditionRegionDestination('oxygen'),true);
assert.equal(regionAt(REGIONS.frontier.y),'frontier','Inner Horizon remains a spatial/progression region, not a launch destination');
const state={progress:{checkpoint:'oxygen',regions:['veil','carbon','oxygen','frontier'],choCompleted:false}};
assert.equal(isExpeditionDestinationAvailable(state,'frontier'),false,'legacy frontier id cannot enter the launch request contract even when an old progress.regions entry exists');
assert.equal(isExpeditionDestinationAvailable({...state,progress:{...state.progress,checkpoint:'frontier'}},'continue'),false,'raw legacy checkpoint is never treated as a valid launch target');

const resources=createResources({storage:memory()});
resources.visit('carbon');resources.visit('oxygen');
assert.equal(resources.state.progress.checkpoint,'oxygen');
resources.visit('frontier');
assert.equal(resources.state.progress.frontier,true,'frontier visit still records CHO progression');
assert.equal(resources.state.progress.checkpoint,'oxygen','crossing Inner Horizon does not create a warp/relaunch checkpoint');
resources.state.progress.choCompleted=true;resources.visit('nitrogen');
assert.equal(resources.state.progress.checkpoint,'nitrogen','Nitrogen remains a legitimate launch checkpoint');

const postCho={...resources.state,progress:{...resources.state.progress,choCompleted:true}},config=flightConfig(postCho),map=createUniverse(19,postCho.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});
assert.ok(config.bounds.top<-12750,'Nitrogen dynamic bounds remain expanded');
assert.ok(map.routes.some(route=>route.id==='horizon'),'continuous Deep Oxygen -> CHO horizon geometry remains present');
assert.ok(map.routes.some(route=>route.id==='nitrogen-main'),'continuous Nitrogen geometry remains present');
assert.equal(map.signals.find(signal=>signal.region==='veil')?.id,'veil','H-area ring-like marker is the current FIELD Insight signal, not a legacy warp entity');
assert.equal(map.signals.some(signal=>Object.hasOwn(signal,'warp')||Object.hasOwn(signal,'destination')),false,'FIELD signals do not contain hidden warp/destination behavior');
console.log('Legacy frontier destination passed: Inner Horizon is progression-only, H marker is Insight, launch checkpoints stay veil/carbon/oxygen/nitrogen, and continuous Nitrogen FIELD geometry remains intact.');
`);

await writeFile('tests/legacy-frontier-browser.test.mjs',`import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {spawn,spawnSync} from 'node:child_process';
import {extname,join,normalize,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url))),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),relative=pathname==='/'?'index.html':pathname.replace(/^\\/+/,''),file=normalize(join(root,relative));if(!file.startsWith(root)){res.writeHead(403).end();return;}let body=await readFile(file);if(relative==='src/veil/ui.js'){let source=body.toString('utf8');source=source.replace('function frame(now){',"function frame(now){globalThis.__legacyFrontierRun=run;globalThis.__legacyFrontierResources=resources;");body=Buffer.from(source);}res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','cache-control':'no-store'});res.end(body);}catch{res.writeHead(404).end('not found');}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const {port}=server.address(),origin=\`http://127.0.0.1:\${port}\`;
let chrome='';for(const command of ['google-chrome','chromium','chromium-browser']){const found=spawnSync('which',[command],{encoding:'utf8'});if(found.status===0&&found.stdout.trim()){chrome=found.stdout.trim();break;}}assert.ok(chrome,'A Chromium browser is required for legacy frontier regression');
const profile=await mkdtemp(join(tmpdir(),'molecule-craft-legacy-frontier-')),debugPort=9226;let child=null,socket=null;
try{
 child=spawn(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-background-networking',\`--user-data-dir=\${profile}\`,\`--remote-debugging-port=\${debugPort}\`,'about:blank'],{stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.setEncoding('utf8');child.stderr.on('data',chunk=>stderr+=chunk);
 let tabs=null;for(let i=0;i<160;i++){try{const response=await fetch(\`http://127.0.0.1:\${debugPort}/json/list\`);if(response.ok){tabs=await response.json();if(tabs.length)break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(tabs?.length,\`Chromium DevTools endpoint did not become ready: \${stderr.slice(-1000)}\`);
 socket=new WebSocket(tabs.find(tab=>tab.type==='page')?.webSocketDebuggerUrl??tabs[0].webSocketDebuggerUrl);await new Promise((resolveOpen,reject)=>{const timer=setTimeout(()=>reject(new Error('DevTools websocket open timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolveOpen();},{once:true});socket.addEventListener('error',reject,{once:true});});
 let sequence=0;const pending=new Map(),exceptions=[];socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(message.id&&pending.has(message.id)){const task=pending.get(message.id);pending.delete(message.id);message.error?task.reject(new Error(message.error.message)):task.resolve(message.result);return;}if(message.method==='Runtime.exceptionThrown')exceptions.push(message.params.exceptionDetails);});
 const send=(method,params={})=>new Promise((resolveSend,reject)=>{const id=++sequence;pending.set(id,{resolve:resolveSend,reject});socket.send(JSON.stringify({id,method,params}));});const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description??result.exceptionDetails.text);return result.result?.value;};const waitFor=async(expression,message,attempts=120)=>{for(let i=0;i<attempts;i++){try{if(await evaluate(expression))return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(message);};
 await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:origin+'/'});await waitFor("document.querySelector('#open-collection')?.textContent?.includes('0/129')",'Application did not initialize');
 const seeded=await evaluate(\`(async()=>{const {createResources}=await import('/src/veil/resources.js');const records=await fetch('/data/molecules.json').then(r=>r.json());const r=createResources({storage:localStorage});r.setCatalog(records);r.state.progress.choCompleted=true;r.state.progress.regions=['veil','carbon','oxygen','frontier'];r.state.progress.checkpoint='frontier';r.state.progress.frontier=true;r.state.progress.foundElements=['H','C','O'];r.state.recipes=['hydrogen','methane','oxygen','water'];Object.assign(r.state.elements,{H:500,C:500,O:500,N:0});return r.save();})()\`);assert.equal(seeded,true);
 await send('Page.reload',{ignoreCache:true});await waitFor("document.querySelector('#open-supply')",'Application did not reload');
 const normalized=await evaluate("JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).progress.checkpoint");assert.equal(normalized,'oxygen','legacy frontier save must normalize at load');
 await evaluate("document.querySelector('#open-supply').click()");await waitFor("document.querySelectorAll('#expedition-destinations [data-region]').length>=4",'LOADOUT destinations did not render');
 const destinations=await evaluate("[...document.querySelectorAll('#expedition-destinations [data-region]')].map(node=>({id:node.dataset.region,tabIndex:node.tabIndex,label:node.getAttribute('aria-label')}))");assert.deepEqual(destinations.map(row=>row.id),['veil','carbon','oxygen','nitrogen']);assert.equal(destinations.some(row=>row.id==='frontier'||/Inner Horizon/i.test(row.label??'')),false,'swipe/pointer/keyboard/a11y candidates must exclude legacy frontier');
 const keyboard=await evaluate("(()=>{const handle=document.querySelector('#collector-launch-handle');handle.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return [...document.querySelectorAll('#expedition-destinations [data-region]')].filter(node=>node.tabIndex===0).map(node=>node.dataset.region);})()");assert.deepEqual(keyboard,['veil','carbon','oxygen','nitrogen']);
 await evaluate("document.querySelector('#expedition-destinations [data-region=veil]').click()");await waitFor("document.querySelector('#veil-view')?.hidden===false&&!!globalThis.__legacyFrontierRun",'H FIELD did not launch');exceptions.length=0;
 const hSignal=await evaluate("(()=>{const s=globalThis.__legacyFrontierRun.map.signals.find(signal=>signal.region==='veil');return s&&{id:s.id,region:s.region,hasWarp:Object.hasOwn(s,'warp'),hasDestination:Object.hasOwn(s,'destination')};})()");assert.deepEqual(hSignal,{id:'veil',region:'veil',hasWarp:false,hasDestination:false},'H-area ring-like entity is the current Insight signal, not a warp point');
 const hBehavior=await evaluate("(()=>{const run=globalThis.__legacyFrontierRun,s=run.map.signals.find(signal=>signal.region==='veil');run.predators=false;for(const signal of run.map.signals)signal.claimable=false;s.claimable=true;Object.assign(run.player,{x:s.x,y:s.y,angle:-Math.PI/2,vx:0,vy:0,speed:0});return {x:s.x,y:s.y};})()");await waitFor("globalThis.__legacyFrontierRun.map.signals.find(signal=>signal.region==='veil')?.ready===true",'H Insight signal did not execute its pickup behavior',80);const afterH=await evaluate(\`(()=>{const p=globalThis.__legacyFrontierRun.player;return Math.hypot(p.x-\${hBehavior.x},p.y-\${hBehavior.y});})()\`);assert.ok(afterH<180,'H Insight contact must not teleport the player');
 const frontierProbe=await evaluate("(()=>{const run=globalThis.__legacyFrontierRun;for(const signal of run.map.signals){signal.claimable=false;signal.ready=true;}Object.assign(run.player,{x:100,y:-11920,angle:-Math.PI/2,vx:0,vy:0,speed:0});return true;})()");assert.equal(frontierProbe,true);await waitFor("globalThis.__legacyFrontierRun.region==='frontier'",'Continuous traversal did not enter Inner Horizon spatial region',80);const noWarp=await evaluate("(()=>{const run=globalThis.__legacyFrontierRun,p=run.player,r=globalThis.__legacyFrontierResources;return {distance:Math.hypot(p.x-100,p.y+11920),checkpoint:r.state.progress.checkpoint,frontier:r.state.progress.frontier,boundsTop:run.config.bounds.top,nitrogenRoute:run.map.routes.some(route=>route.id==='nitrogen-main'),warpKeys:Object.keys(run.map).filter(key=>/warp|teleport/i.test(key))};})()");assert.ok(noWarp.distance<220,'old frontier launch coordinate must be ordinary traversable FIELD space with no teleport');assert.equal(noWarp.checkpoint,'veil','crossing frontier from a veil launch must not create a hidden relaunch checkpoint');assert.equal(noWarp.frontier,true);assert.ok(noWarp.boundsTop<-12750);assert.equal(noWarp.nitrogenRoute,true);assert.deepEqual(noWarp.warpKeys,[]);
 assert.equal(exceptions.length,0,\`legacy frontier Chromium flow must not throw: \${JSON.stringify(exceptions)}\`);
}finally{try{socket?.close();}catch{}try{child?.kill('SIGKILL');}catch{}await new Promise(r=>setTimeout(r,100));server.close();await rm(profile,{recursive:true,force:true});}
console.log('Legacy frontier Chromium regression passed: LOADOUT has no frontier candidate, legacy saves fall back safely, H marker is Insight, and old frontier coordinates are ordinary continuous FIELD space.');
`);

await patch('tests/nitrogen-field-pickup-browser.test.mjs',[[
  "console.log('Nitrogen Chromium regression passed: production launch contains visible FIELD canvas/N dust, overlap collects N into run cargo, N2 marker becomes claimable, and normal return settles final N cargo into BASE STOCK.');",
  "console.log('Nitrogen Chromium regression passed: production launch contains visible FIELD canvas/N dust, overlap collects N into run cargo, N2 marker becomes claimable, and normal return settles final N cargo into BASE STOCK.');\nawait import('./legacy-frontier-browser.test.mjs');"
]]);

console.log('Applied legacy frontier destination/warp removal patches.');
