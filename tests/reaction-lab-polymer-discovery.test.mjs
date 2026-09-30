import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createReactionLabDiscoveryCoordinator,validatePolymerSampleEvent} from '../src/reaction-lab-discovery.js?v=1';

const read=async path=>JSON.parse(await readFile(new URL(`../${path}`,import.meta.url),'utf8'));
const records=await read('data/molecules.json'),authority=await read('data/polymerization-routes.json'),pet=authority.routes.find(route=>route.routeId==='polyethylene-terephthalate-direct-polycondensation');
const product=({sampleId='sample-1',batchGeneration=7,route=pet}={})=>({routeId:route.routeId,polymerId:route.polymerId,sampleId,batchGeneration,sourceInstanceIds:Array.from({length:route.completionEvidence.unitCount},(_,index)=>`source-${index}`),byproducts:Array.from({length:route.completionEvidence.byproducts.water},(_,formationIndex)=>({species:'water',instanceId:`water-byproduct-${formationIndex}`,formationIndex}))});
function harness(knownPolymers=[],knownMolecules=[]){
  const polymers=new Set(knownPolymers),molecules=new Set(knownMolecules),registrations=[],presentations=[],diagnostics=[];let view=null,labOpen=true,collectionOpen=false;
  const collection={
    registerDiscoveredPolymer(id,{at}){const changed=!polymers.has(id);polymers.add(id);const result={changed,event:{isNew:changed,at}};registrations.push({kind:'polymers',id,at,result});return result;},
    registerDiscoveredMolecule(id,{at}){const changed=!molecules.has(id);molecules.add(id);const result={changed,event:{isNew:changed,at}};registrations.push({kind:'molecules',id,at,result});return result;},
    setDiscoverySession(value){view=value;},isOpen:()=>collectionOpen,closeAndWait(){collectionOpen=false;return Promise.resolve();},
  };
  const coordinator=createReactionLabDiscoveryCoordinator({records,polymerRoutes:authority.routes,polymerIds:(awaitlessPolymers()),collection,now:()=>1700,isLabOpen:()=>labOpen,getBatchGeneration:()=>7,
    closeLabAndWait:async()=>{labOpen=false;},openLab:()=>{labOpen=true;return true;},present:options=>{presentations.push(options);collectionOpen=true;return true;},onDiagnostic:item=>diagnostics.push(item)});
  return{coordinator,collection,polymers,molecules,registrations,presentations,diagnostics,get view(){return view;},get collectionOpen(){return collectionOpen;},set collectionOpen(value){collectionOpen=value;}};
}
function awaitlessPolymers(){return authority.routes.map(route=>route.polymerId);}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('PolymerSample preflight validates route, identity, source partition, and complete byproduct evidence',()=>{
  const valid=product();assert.equal(validatePolymerSampleEvent(valid,{recordsById:new Map(records.map(record=>[record.id,record])),polymerIds:new Set(authority.routes.map(route=>route.polymerId)),routesById:new Map(authority.routes.map(route=>[route.routeId,route]))}).ok,true);
  const bad={...valid,byproducts:[...valid.byproducts.slice(0,2),{...valid.byproducts[2],species:'not-in-db'}]};
  assert.equal(validatePolymerSampleEvent(bad,{recordsById:new Map(records.map(record=>[record.id,record])),polymerIds:new Set(authority.routes.map(route=>route.polymerId)),routesById:new Map(authority.routes.map(route=>[route.routeId,route]))}).ok,false);
});

test('registration persists polymer and byproducts immediately, then reveals polymer before new molecule products',async()=>{
  const h=harness(),payload=product();
  const registered=h.coordinator.handlePolymerSampleEvent(payload);
  assert.equal(registered.accepted,true);assert.deepEqual(h.registrations.map(row=>[row.kind,row.id]),[['polymers','polyethylene-terephthalate'],['molecules','water']]);
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>[item.kind,item.id,item.status]),[['polymers','polyethylene-terephthalate','awaiting-present'],['molecules','water','awaiting-present']]);
  assert.equal(h.presentations.length,0);
  h.coordinator.handlePolymerSamplePresent({sampleId:payload.sampleId,batchGeneration:payload.batchGeneration});await flush();
  assert.deepEqual(h.presentations.map(item=>[item.kind,item.id]),[['polymers','polyethylene-terephthalate']]);
  h.presentations[0].onSettled({status:'presented'});assert.equal(h.view.hasNext,true);h.view.onNext();
  assert.deepEqual(h.presentations.map(item=>[item.kind,item.id]),[['polymers','polyethylene-terephthalate'],['molecules','water']]);
  h.presentations[1].onSettled({status:'presented'});assert.equal(h.view.hasNext,false);
});

test('known entries are omitted and all-known samples never open Collection',async()=>{
  const payload=product(),polymerKnown=harness([pet.polymerId],[]);polymerKnown.coordinator.handlePolymerSampleEvent(payload);polymerKnown.coordinator.handlePolymerSamplePresent({sampleId:payload.sampleId,batchGeneration:7});await flush();
  assert.deepEqual(polymerKnown.coordinator.snapshot().queue.map(item=>[item.kind,item.id]),[['molecules','water']]);
  const allKnown=harness([pet.polymerId],['water']);allKnown.coordinator.handlePolymerSampleEvent(payload);allKnown.coordinator.handlePolymerSamplePresent({sampleId:payload.sampleId,batchGeneration:7});await flush();
  assert.deepEqual(allKnown.coordinator.snapshot().queue,[]);assert.equal(allKnown.presentations.length,0);
});

test('manual Lab close dismisses a registered sample before visible hold without undoing registration',()=>{
  const h=harness(),payload=product();h.coordinator.handlePolymerSampleEvent(payload);
  assert.equal(h.coordinator.handlePolymerSampleDismiss({sampleId:payload.sampleId,batchGeneration:7}),true);
  assert.equal(h.coordinator.handlePolymerSamplePresent({sampleId:payload.sampleId,batchGeneration:7}).accepted,false);
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>item.status),['dismissed','dismissed']);
  assert.ok(h.polymers.has(pet.polymerId)&&h.molecules.has('water'));assert.equal(h.presentations.length,0);
});

test('unknown routes reject the whole event before either collection mutates',()=>{
  const h=harness(),payload=product();payload.polymerId='unknown-polymer';
  assert.equal(h.coordinator.handlePolymerSampleEvent(payload).accepted,false);assert.deepEqual(h.registrations,[]);
});
