import assert from 'node:assert/strict';
import {commitEmptyLaunchFill,createDiscoveryConnection,criticalPrimaryLoadoutUse,normalizeLaunchFillPlan,preserveSupplyDuringPrepare} from '../src/craft-connections.js?v=2';

assert.deepEqual(Object.fromEntries(['hydrogen','methane','oxygen','water'].map(id=>[id,criticalPrimaryLoadoutUse(id)])),{hydrogen:'propellant',methane:'fuel',oxygen:'oxidizer',water:'coolant'});
assert.equal(criticalPrimaryLoadoutUse('methanol'),null,'Non-critical molecules do not request an automatic loadout assignment');

const emptyPreview={status:'IMPOSSIBLE',invalid:[],partial:{entries:[{use:'propellant',molecule:'hydrogen',target:0}],cost:{}},required:{H:2},missing:{H:{have:0,need:2}}};
const normalized=normalizeLaunchFillPlan(emptyPreview);assert.equal(normalized.status,'PARTIAL');assert.equal(normalized.emptyDeparture,true);
const launchResources={blocked:false,state:{tanks:{propellant:{molecule:null,amount:0}}},save:()=>true};
const emptyCommit=commitEmptyLaunchFill(launchResources,emptyPreview);assert.equal(emptyCommit.status,'PARTIAL');assert.equal(launchResources.state.tanks.propellant.molecule,'hydrogen');assert.equal(launchResources.state.tanks.propellant.amount,0);
const invalidPreview={...emptyPreview,invalid:[{use:'propellant',molecule:'missing'}]};assert.equal(normalizeLaunchFillPlan(invalidPreview).status,'IMPOSSIBLE');assert.equal(commitEmptyLaunchFill(launchResources,invalidPreview),false);

{
  const dialog={open:true,showModal(){this.open=true;}};
  const root={getElementById:id=>id==='supply-dialog'?dialog:null};
  let prepared=0;
  const prepare=preserveSupplyDuringPrepare(()=>{prepared++;dialog.open=false;return true;},root);
  assert.equal(prepare(),true);assert.equal(prepared,1);assert.equal(dialog.open,true,'launch preparation must not strand the app on the craft screen by closing LOADOUT');
}

function connectionFixture(){
  const calls={discover:0,save:0,veil:0,refresh:0,observe:0,observed:[],present:[],dismiss:0,vibrate:0,uses:[],discoveries:[]};
  const learned=new Set();
  const resources={discoverWithLoadout:(id,use)=>{calls.discover++;calls.uses.push(use);if(learned.has(id))return false;learned.add(id);calls.save++;return{learned:true,assignedUse:use};}};
  const collection={
    refreshProgress:()=>{calls.refresh++;},
    observeStructures:structures=>{calls.observe++;calls.observed.push(structures);return{events:structures.filter(item=>item.record).map(item=>({signature:item.signature,isNew:!item.signature.includes('known')}))};},
    describeEvent:()=>'',
  };
  const bridge=createDiscoveryConnection({resources,getVeilUI:()=>({discovered:(id,outcome)=>{calls.veil++;calls.discoveries.push({id,outcome});}}),getCollection:()=>collection,onPresent:event=>calls.present.push(event),onDismiss:()=>{calls.dismiss++;},onVibrate:()=>{calls.vibrate++;}});
  return{calls,bridge};
}

{
  const {calls,bridge}=connectionFixture(),item={key:'1,2',signature:'hydrogen-graph',complete:true,record:{id:'hydrogen'},graph:{}};
  bridge.sync([item]);bridge.check([item],{now:1000});
  assert.equal(calls.discover,1);assert.equal(calls.save,1);assert.equal(calls.uses[0],'propellant');assert.equal(calls.veil,1);assert.deepEqual(calls.discoveries[0],{id:'hydrogen',outcome:{autoAssignedUse:'propellant'}});assert.equal(calls.refresh,1);assert.equal(calls.observe,1);assert.equal(calls.present.length,1);assert.equal(calls.present[0].isNew,true);assert.equal(calls.vibrate,1);
  bridge.check([item],{now:1100});assert.equal(calls.discover,1);assert.equal(calls.observe,1);assert.equal(calls.present.length,1,'Completion side effects are edge-triggered, not rescanned every frame');
  bridge.sync([]);assert.equal(calls.dismiss,1,'Removing the active structure dismisses its completion feedback');

  bridge.clear();bridge.sync([item]);bridge.check([item],{now:5000});
  assert.equal(calls.discover,1);assert.equal(calls.observe,1);assert.equal(calls.present.length,1,'Undo/restore baselines do not replay completion progress or feedback');

  const incomplete={...item,signature:'hydrogen-incomplete',complete:false,record:null};
  bridge.sync([incomplete]);bridge.check([incomplete],{now:5100});
  const observeAfterIncomplete=calls.observe;
  bridge.sync([{...item,signature:'hydrogen-rebuilt'}]);bridge.check([{...item,signature:'hydrogen-rebuilt'}],{now:5200});
  assert.equal(calls.discover,2,'A later forward incomplete -> complete edge is processed');
  assert.equal(calls.save,1,'Repeat CRAFT does not persist or re-emit an unlock');
  assert.equal(calls.veil,1,'Repeat CRAFT does not re-fire capability presentation');
  assert.equal(calls.observe,observeAfterIncomplete+1);
}

{
  const {calls,bridge}=connectionFixture(),saved={key:'7,8',signature:'saved-complete',complete:true,record:{id:'hydrogen'},graph:{}};
  bridge.sync([saved]);bridge.discardQueued();bridge.collectionReady();bridge.check([saved],{now:1000});
  assert.equal(calls.discover,0);assert.equal(calls.observe,0);assert.equal(calls.present.length,0,'Hydrate/reload discard prevents discovery, collection registration, reward and completion feedback');
}

{
  const {calls,bridge}=connectionFixture();
  const before={key:'9,10',signature:'complete-a',complete:true,record:{id:'hydrogen'},graph:{}};
  bridge.sync([before]);bridge.discardQueued();
  const after={...before,signature:'complete-b',record:{id:'oxygen'}};
  bridge.sync([after]);bridge.check([after],{now:1000});
  assert.equal(calls.discover,0,'Complete -> complete topology changes are not completion discoveries');
  assert.equal(calls.present.length,0);
  assert.equal(calls.observe,1,'Forward structural changes still reach milestone observation');
  assert.equal(calls.observed[0][0].record,null,'Non-completion structural observation cannot register a molecule');
}

console.log('Craft connections passed: critical primary-role assignment, launch fallback, LOADOUT preservation, forward-only completion side effects, passive restore/hydrate suppression and structural milestone isolation.');
