import assert from 'node:assert/strict';
import {createDiscoveryConnection} from '../src/craft-connections.js?v=1';

const calls={discover:0,save:0,veil:0,refresh:0,observe:0,present:[],dismiss:0,vibrate:0};let eventIsNew=true;
const resources={discover:id=>{calls.discover++;return id==='hydrogen'&&calls.discover===1;},save:()=>{calls.save++;}};
const collection={refreshProgress:()=>{calls.refresh++;},observeStructures:structures=>{calls.observe++;const events=structures.map(item=>({signature:item.signature,isNew:eventIsNew}));eventIsNew=false;return{events};},describeEvent:()=>''};
const bridge=createDiscoveryConnection({resources,getVeilUI:()=>({discovered:()=>{calls.veil++;}}),getCollection:()=>collection,onPresent:event=>calls.present.push(event),onDismiss:()=>{calls.dismiss++;},onVibrate:()=>{calls.vibrate++;}});
const item={key:'1,2',signature:'hydrogen-graph',complete:true,record:{id:'hydrogen'}};

bridge.sync([item]);bridge.check([item],{now:1000});
assert.equal(calls.discover,1);assert.equal(calls.save,1);assert.equal(calls.veil,1);assert.equal(calls.refresh,1);assert.equal(calls.observe,1);assert.equal(calls.present.length,1);assert.equal(calls.present[0].isNew,true);assert.equal(calls.vibrate,1);
bridge.check([item],{now:1100});assert.equal(calls.present.length,1,'Completion feedback is not duplicated while its timer is active');
bridge.sync([]);assert.equal(calls.dismiss,1,'Removing the active structure dismisses its completion feedback');
bridge.clear();bridge.sync([item]);bridge.discardQueued();bridge.check([item],{now:5000});assert.equal(calls.present.length,1,'Restored workspaces can discard startup completion feedback');

console.log('Craft connections passed: discovery propagation, deduplication, dismissal and restored-workspace suppression.');
