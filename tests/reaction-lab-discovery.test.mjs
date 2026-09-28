import assert from 'node:assert/strict';
import {createReactionLabDiscoveryCoordinator} from '../src/reaction-lab-discovery.js';

const records=['C','D','E'].map(id=>({id}));
const payload=(products,reactionId='reaction-a',batchGeneration=4)=>({reactionId,pathwayId:`${reactionId}-path`,batchGeneration,products,productInstances:products.map((species,productIndex)=>({productIndex,species,instanceId:`${reactionId}-instance-${productIndex}`}))});

function harness({known=[],generation=4,persist=()=>{}}={}){
  const collectionState=new Set(known),registrations=[],presentations=[],diagnostics=[];
  let generationNow=generation,labOpen=true,collectionOpen=false,closeCalls=0,openCalls=0,vibrationCount=0,sessionView=null;
  const collection={
    registerDiscoveredMolecule(id,{at}){
      const changed=!collectionState.has(id);if(changed)collectionState.add(id);
      try{persist(id,at);}catch{}
      const result={changed,event:{record:records.find(record=>record.id===id),isNew:changed,at}};registrations.push({id,at,result});return result;
    },
    setDiscoverySession(value){sessionView=value;},
    isOpen:()=>collectionOpen,
    closeAndWait(){closeCalls++;collectionOpen=false;return Promise.resolve();},
  };
  const coordinator=createReactionLabDiscoveryCoordinator({records,collection,now:()=>12345,
    closeLabAndWait:async()=>{closeCalls++;labOpen=false;},openLab:()=>{openCalls++;labOpen=true;return true;},isLabOpen:()=>labOpen,getBatchGeneration:()=>generationNow,
    onVibrate:()=>vibrationCount++,onDiagnostic:item=>diagnostics.push(item),present:options=>{assert.ok(collectionState.has(options.id),'All new products must be registered before presentation begins.');presentations.push(options);collectionOpen=true;return true;}});
  return {coordinator,collectionState,registrations,presentations,diagnostics,collection,get generation(){return generationNow;},set generation(value){generationNow=value;},get labOpen(){return labOpen;},get collectionOpen(){return collectionOpen;},set collectionOpen(value){collectionOpen=value;},get closeCalls(){return closeCalls;},get openCalls(){return openCalls;},get vibrationCount(){return vibrationCount;},get sessionView(){return sessionView;}};
}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

// The queue is generic beyond the historical left/right two-product reactions.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['E','C','D'],'three-product'));
  assert.deepEqual(h.registrations.map(row=>row.id),['E','C','D']);
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>item.speciesId),['E','C','D']);
  await flush();assert.equal(h.presentations[0].id,'E');
  h.presentations[0].onSettled({status:'presented'});h.sessionView.onNext();
  assert.equal(h.presentations[1].id,'C');
  h.presentations[1].onSettled({status:'presented'});h.sessionView.onNext();
  assert.equal(h.presentations[2].id,'D');
}

// Whole-event preflight happens before even the first valid species is registered.
{
  const h=harness();
  const result=h.coordinator.handleProductEvent(payload(['C','missing','D']));
  assert.equal(result.accepted,false);assert.equal(result.reason,'unknown-product-id');
  assert.deepEqual(h.registrations,[]);assert.equal(h.coordinator.snapshot().queue.length,0);assert.equal(h.diagnostics.length,1);
}

// Core product multiplicity is preserved while Discovery processes unique species in first occurrence order.
{
  const h=harness();const source=payload(['C','C','D','C']);
  const result=h.coordinator.handleProductEvent(source);
  assert.deepEqual(result.species,['C','D']);assert.deepEqual(result.newSpecies,['C','D']);
  assert.deepEqual(h.registrations.map(row=>row.id),['C','D']);assert.deepEqual(h.registrations.map(row=>row.at),[12345,12345]);
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>[item.speciesId,item.firstProductIndex,item.productIds]),[
    ['C',0,['C','C','D','C']],['D',2,['C','C','D','C']],
  ]);
  assert.equal(h.presentations.length,0,'No reveal starts until all species in the event are registered.');
  await flush();
  assert.deepEqual(h.presentations.map(item=>item.id),['C']);assert.deepEqual(h.registrations.map(row=>row.id),['C','D']);
  h.presentations[0].onSettled({status:'presented'});assert.equal(h.sessionView.ready,true);assert.equal(h.sessionView.hasNext,true);
  assert.equal(h.sessionView.onNext(),true);assert.deepEqual(h.presentations.map(item=>item.id),['C','D']);
  h.presentations[1].onSettled({status:'presented'});assert.equal(h.sessionView.hasNext,false);
  h.sessionView.onReturn();await flush();
  const queue=h.coordinator.snapshot().queue;assert.deepEqual(queue.map(item=>item.status),['presented','presented']);
  assert.equal(h.closeCalls,2,'One Lab close and one Collection close end the single queue session.');assert.equal(h.openCalls,1);assert.equal(h.vibrationCount,2);
}

// Repeated products and later reactions use Collection as their duplicate gate.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['C','C'],'hydrolysis'));h.coordinator.handleProductEvent(payload(['C','D'],'secondary'));
  assert.deepEqual(h.registrations.map(row=>row.id),['C','C','D']);
  assert.deepEqual(h.registrations.map(row=>row.result.changed),[true,false,true]);
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>item.speciesId),['C','D']);
  assert.equal(h.coordinator.snapshot().queue[1].reactionId,'secondary');assert.equal(h.coordinator.snapshot().queue[1].eventSequence,2);
}

// Known / new mixtures enqueue only the new species; a fully-known event never takes over either dialog.
{
  const mixed=harness({known:['D']});mixed.coordinator.handleProductEvent(payload(['C','D']));
  assert.deepEqual(mixed.coordinator.snapshot().queue.map(item=>item.speciesId),['C']);assert.deepEqual(mixed.registrations.map(row=>row.id),['C','D']);
  await flush();mixed.presentations[0].onSettled({status:'presented'});mixed.sessionView.onReturn();await flush();
  const known=harness({known:['C','D']});known.coordinator.handleProductEvent(payload(['C','D']));await flush();
  assert.deepEqual(known.coordinator.snapshot().queue,[]);assert.equal(known.closeCalls,0);assert.equal(known.openCalls,0);assert.equal(known.presentations.length,0);
}

// Persistence errors do not roll back in-memory Collection registration or the first-registration queue.
{
  const h=harness({persist(){throw new Error('quota');}});h.coordinator.handleProductEvent(payload(['E']));
  assert.equal(h.collectionState.has('E'),true);assert.equal(h.coordinator.snapshot().queue[0].status,'pending');
}

// A later event joins the active session in event-receive order, and queue-level dedupe is defensive.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['C'],'first-event'));await flush();
  h.coordinator.handleProductEvent(payload(['D'],'second-event'));
  h.coordinator.handleProductEvent(payload(['D'],'third-event'));
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>[item.speciesId,item.eventSequence]),[['C',1],['D',2]]);
  h.presentations[0].onSettled({status:'presented'});assert.equal(h.sessionView.hasNext,true);
  h.sessionView.onNext();assert.equal(h.presentations[1].id,'D');
}

// A changed batch generation only invalidates the visual item; registration stays committed.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['C']));h.generation=5;await flush();
  assert.equal(h.collectionState.has('C'),true);assert.equal(h.coordinator.snapshot().queue[0].status,'stale');
  assert.equal(h.presentations.length,0);assert.equal(h.openCalls,1);assert.equal(h.closeCalls,1);
}

// Dismissal keeps registration, marks every not-yet-presented item dismissed, and never replays it.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['C','D']));await flush();
  h.collectionOpen=false;h.presentations[0].onSettled({status:'dismissed'});await flush();
  assert.deepEqual(h.coordinator.snapshot().queue.map(item=>item.status),['dismissed','dismissed']);
  assert.ok(h.collectionState.has('C')&&h.collectionState.has('D'));assert.equal(h.openCalls,1);
}

// Closing after the visible reveal still dismisses its active item and the remaining queue.
{
  const h=harness();h.coordinator.handleProductEvent(payload(['C','D']));await flush();h.presentations[0].onSettled({status:'presented'});
  h.coordinator.onCollectionClosed();await flush();assert.deepEqual(h.coordinator.snapshot().queue.map(item=>item.status),['dismissed','dismissed']);assert.equal(h.openCalls,1);
}

// Presentation startup failure aborts the visual queue, leaves registrations, and safely restores the Lab.
{
  const known=new Set(),diagnostics=[],registrations=[];let labOpen=true,opened=0;
  const collection={registerDiscoveredMolecule(id,{at}){const changed=!known.has(id);if(changed)known.add(id);const result={changed,event:{isNew:changed,at}};registrations.push(id);return result;},setDiscoverySession(){},isOpen:()=>false};
  const failed=createReactionLabDiscoveryCoordinator({records,collection,isLabOpen:()=>labOpen,getBatchGeneration:()=>4,closeLabAndWait:()=>{labOpen=false;},openLab:()=>{labOpen=true;opened++;return true;},present:()=>false,onDiagnostic:item=>diagnostics.push(item)});
  failed.handleProductEvent(payload(['C','D']));await flush();
  assert.deepEqual(registrations,['C','D']);assert.deepEqual(failed.snapshot().queue.map(item=>item.status),['failed','failed']);assert.deepEqual([...known],['C','D']);assert.equal(opened,1);assert.equal(diagnostics.some(item=>item.code==='presentation-threw'),false);
}

// Invalid instance identity is rejected before any registration.
{
  const h=harness(),invalid=payload(['C']);invalid.productInstances[0].productIndex=1;
  assert.equal(h.coordinator.handleProductEvent(invalid).accepted,false);assert.deepEqual(h.registrations,[]);
}

console.log('reaction-lab-discovery.test.mjs: all assertions passed');
