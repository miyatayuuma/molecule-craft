import {readFile,writeFile} from 'node:fs/promises';

const schematicURL=new URL('../tests/loadout-schematic.test.mjs',import.meta.url);
let schematic=await readFile(schematicURL,'utf8');
for(const [old,replacement] of [
  ["  assert.match(source,/node.dataset?.sufficient!==undefined/);","  assert.ok(source.includes('node.dataset?.sufficient!==undefined'));"],
  ["  assert.match(source,/chip.dataset.stockState=chip.dataset.sufficient==='false'?'short':'ready'/);","  assert.ok(source.includes(\"chip.dataset.stockState=chip.dataset.sufficient==='false'?'short':'ready'\"));"],
  ["  assert.match(source,/preview.setAttribute('aria-label','必要元素')/);","  assert.ok(source.includes(\"preview.setAttribute('aria-label','必要元素')\"));"],
]){
  if(!schematic.includes(old))throw new Error('Generated schematic assertion target not found: '+old);
  schematic=schematic.replace(old,replacement);
}
await writeFile(schematicURL,schematic);

const routeTest=`import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDeferredExplorationFacade} from '../src/craft-connections.js?v=5';

let current=null;
const ready=Promise.resolve('ready');
const facade=createDeferredExplorationFacade(()=>current,ready);
assert.equal(facade.active,false);
assert.equal(facade.run,null);
assert.equal(facade.returning,null);
assert.equal(facade.anchorLock,null);
assert.equal(facade.lastTelemetry,null);
assert.equal(facade.ready,ready);
assert.equal(facade.requestExpeditionLaunch('oxygen'),false,'DB-not-ready facade must reject launch requests');
assert.equal('launch' in facade,false,'legacy launch alias must not remain on the application facade');
assert.equal(facade.openSupply('hydrogen','propellant'),false);
assert.deepEqual(facade.usesFor('hydrogen'),[]);
assert.equal(facade.tankStatus('propellant','hydrogen'),null);
assert.equal(facade.fillPlan('propellant','hydrogen'),null);
assert.equal(facade.commitFill('propellant','hydrogen',1),false);

const run={id:'run'},anchorLock={elapsed:0.2},telemetry={id:'last'};
const calls=[];
current={
  active:true,run,returning:'locking',anchorLock,lastTelemetry:telemetry,
  updateCraft:(...args)=>calls.push(['updateCraft',...args]),
  requestExpeditionLaunch:(...args)=>{calls.push(['requestExpeditionLaunch',...args]);return true;},
  pause:(...args)=>{calls.push(['pause',...args]);return 'paused';},
  openSupply:(...args)=>{calls.push(['openSupply',...args]);return true;},
  discovered:(...args)=>calls.push(['discovered',...args]),
  usesFor:id=>id==='hydrogen'?['propellant']:[],
  tankStatus:(...args)=>({args}),
  fillPlan:(...args)=>({args}),
  commitFill:(...args)=>{calls.push(['commitFill',...args]);return 'committed';},
};
assert.equal(facade.active,true);
assert.equal(facade.run,run);
assert.equal(facade.returning,'locking');
assert.equal(facade.anchorLock,anchorLock);
assert.equal(facade.lastTelemetry,telemetry);
assert.equal(facade.requestExpeditionLaunch('oxygen'),true);
assert.equal(facade.pause(),'paused');
assert.equal(facade.openSupply('hydrogen','propellant'),true);
facade.updateCraft('refresh');facade.discovered('hydrogen');
assert.deepEqual(facade.usesFor('hydrogen'),['propellant']);
assert.deepEqual(facade.tankStatus('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.deepEqual(facade.fillPlan('propellant','hydrogen'),{args:['propellant','hydrogen']});
assert.equal(facade.commitFill('propellant','hydrogen',1),'committed');
assert.ok(calls.some(call=>call[0]==='requestExpeditionLaunch'&&call[1]==='oxygen'));
assert.equal('launch' in facade,false);

const supply=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
const veil=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
const connections=await readFile(new URL('../src/craft-connections.js',import.meta.url),'utf8');
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const has=(source,text,message)=>assert.ok(source.includes(text),message??('Missing source contract: '+text));
const lacks=(source,text,message)=>assert.equal(source.includes(text),false,message??('Legacy source remains: '+text));

const catalogReady=connections.indexOf('prepareExplorationCatalog(options.resources).then(result=>{');
const readyUI=connections.indexOf('veilUI=createReadyExploration(options)');
assert.ok(catalogReady>=0&&readyUI>catalogReady,'concrete LOADOUT/EXPLORE UI must be created only after the DB-ready promise resolves');
for(const legacy of ['preserveSupplyDuringPrepare','commitEmptyLaunchFill','commitRebalancedLaunchFill','installLoadoutShortageUI','data-launch-shortage-summary','data-launch-shortage-detail','resources.commitLaunchFill='])lacks(connections,legacy);
lacks(connections,'launch(...args){return current()?.launch?.(...args)??false;}','deferred application facade must expose no legacy launch alias');
has(connections,'const veilUI=createVeilUI({resources,canLeave,canSupply,onBeforeLaunch,','pre-launch behavior must be passed directly to the transaction-owning UI');

has(supply,'function requestDestinationLaunch(id){');
has(supply,"button.addEventListener('click',event=>{event.stopPropagation();requestDestinationLaunch(point.id);});",'destination button activation must use the explicit request path');
has(supply,'if(id)requestDestinationLaunch(id);','pointer/touch release must use the same destination request path');
has(supply,"event.key!=='Enter'&&event.key!==' '",'keyboard activation must stay on native destination buttons rather than a launch relay');
has(supply,'isExpeditionDestinationAvailable(resources.state,destinationId)','LOADOUT must share the canonical destination validity contract');
has(supply,'onLaunchReady(destinationId,{partial})','confirmed LOADOUT must hand the explicit destination to the transaction');
lacks(supply,'resources.commitLaunchFill','LOADOUT must not persist supply before transaction commit');
lacks(supply,"dispatchEvent(new window.Event('change'",'launch must not synthesize destination change events');
lacks(supply,"q('launch-veil').click()",'launch must not pseudo-click the fallback launch affordance');

has(veil,'const destinationAvailable=id=>isExpeditionDestinationAvailable(resources.state,id)&&!!REGIONS[launchRegionId(id)]','request, selection and transaction guards must share one destination policy');
has(veil,"return destinationAvailable(id)||'invalid-destination';");
has(veil,'isAvailable:id=>!active&&!launchTransaction.inFlight&&!supply.launchPending&&!resources.blocked&&destinationAvailable(id)','layer-specific active/in-flight/pending guards remain without duplicating destination policy');
has(veil,'function selectLaunchDestination(id){');
has(veil,'if(!destinationAvailable(id))return false;','selection must use the canonical destination policy');
has(veil,"q('launch-veil').addEventListener('click',event=>{event.preventDefault();requestExpeditionLaunch(anchor);});",'normal launch button is a direct application request path, not a relay');
lacks(veil,'function launch(){return requestExpeditionLaunch(anchor);}','legacy launch wrapper must be removed');
assert.equal(veil.split("q('launch-veil').addEventListener").length-1,1,'launch handler is installed once per UI instance');
assert.equal(veil.split('audio=createVeilAudio()').length-1,1,'audio session is created once per UI instance');
has(veil,'renderer??=createVeilRenderer(canvas)','renderer must be reused across same-session relaunches');
has(veil,'if(!active||!run)return;active=false;cancelAnimationFrame(raf);raf=0;resetInput();audio.pause();','normal return must release the active RAF handle');
const rollbackStart=veil.indexOf('function rollbackLaunchTransaction');
assert.ok(rollbackStart>=0&&veil.indexOf('cancelAnimationFrame(raf);',rollbackStart)>rollbackStart&&veil.indexOf('raf=0;',rollbackStart)>rollbackStart,'failed launch rollback must release the active RAF handle');
has(veil,"document.body.dataset.mode='veil'");
has(veil,"document.body.dataset.mode='craft'");
has(app,'onBeforeLaunch:()=>clearField({clearTarget:true,silent:true,recordHistory:false})','CRAFT-to-BASE-STOCK boundary remains the pre-launch application hook');

console.log('Integrated launch route source contract passed: DB gating, explicit input convergence, canonical destination policy, legacy relay removal, reusable instances and return cleanup.');
`;
await writeFile(new URL('../tests/issue-122-launch-route.test.mjs',import.meta.url),routeTest);
