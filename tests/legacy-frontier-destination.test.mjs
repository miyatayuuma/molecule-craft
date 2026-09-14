import assert from 'node:assert/strict';
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
