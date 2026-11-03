import {presentFirstRegistration} from './collection-registration-reveal.js?v=5';

const isNonEmptyString=value=>typeof value==='string'&&value.trim().length>0;

function validateProductEvent(payload,recordsById){
  if(!payload||typeof payload!=='object')return {ok:false,code:'invalid-payload',message:'Reaction Lab product event is not an object.'};
  if(!isNonEmptyString(payload.reactionId)||!isNonEmptyString(payload.pathwayId))return {ok:false,code:'invalid-identity',message:'Reaction Lab product event is missing its reaction or pathway identity.'};
  if(!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return {ok:false,code:'invalid-generation',message:'Reaction Lab product event has an invalid batch generation.'};
  if(!Array.isArray(payload.products)||payload.products.length===0||payload.products.some(id=>!isNonEmptyString(id)))return {ok:false,code:'invalid-products',message:'Reaction Lab product event has an invalid products payload.'};
  if(!Array.isArray(payload.productInstances)||payload.productInstances.length!==payload.products.length)return {ok:false,code:'invalid-instances',message:'Reaction Lab product instances do not match the product payload.'};
  const instanceIds=new Set();
  for(let index=0;index<payload.productInstances.length;index++){
    const instance=payload.productInstances[index];
    if(!instance||instance.productIndex!==index||instance.species!==payload.products[index]||!isNonEmptyString(instance.instanceId)||instanceIds.has(instance.instanceId))return {ok:false,code:'invalid-instances',message:'Reaction Lab product instance identity or order is invalid.'};
    instanceIds.add(instance.instanceId);
  }
  const unknownIds=[...new Set(payload.products.filter(id=>!recordsById.has(id)))];
  if(unknownIds.length)return {ok:false,code:'unknown-product-id',message:`Reaction Lab emitted unknown product ID${unknownIds.length===1?'':'s'}: ${unknownIds.join(', ')}`,unknownIds};
  const species=[],firstIndexBySpecies=new Map();
  for(const [index,id]of payload.products.entries())if(!firstIndexBySpecies.has(id)){firstIndexBySpecies.set(id,index);species.push(id);}
  return {ok:true,species,firstIndexBySpecies};
}

export function validatePolymerSampleEvent(payload,{recordsById,polymerIds,routesById}={}){
  if(!payload||typeof payload!=='object')return{ok:false,code:'invalid-polymer-payload'};
  const route=routesById?.get(payload.routeId);
  if(!route||route.polymerId!==payload.polymerId||!polymerIds?.has(payload.polymerId))return{ok:false,code:'unknown-polymer-route'};
  if(!isNonEmptyString(payload.sampleId)||!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return{ok:false,code:'invalid-polymer-sample-identity'};
  if(!Array.isArray(payload.sourceInstanceIds)||payload.sourceInstanceIds.length!==route.completionEvidence.unitCount||payload.sourceInstanceIds.some(id=>!isNonEmptyString(id))||new Set(payload.sourceInstanceIds).size!==payload.sourceInstanceIds.length)return{ok:false,code:'invalid-polymer-source-instances'};
  if(!Array.isArray(payload.byproducts))return{ok:false,code:'invalid-polymer-byproducts'};
  const instanceIds=new Set(payload.sourceInstanceIds),indices=new Set(),speciesCounts=new Map();
  for(const item of payload.byproducts){
    if(!item||!isNonEmptyString(item.species)||!isNonEmptyString(item.instanceId)||!Number.isSafeInteger(item.formationIndex)||item.formationIndex<0||instanceIds.has(item.instanceId)||indices.has(item.formationIndex)||!recordsById.has(item.species))return{ok:false,code:'invalid-polymer-byproducts'};
    instanceIds.add(item.instanceId);indices.add(item.formationIndex);speciesCounts.set(item.species,(speciesCounts.get(item.species)??0)+1);
  }
  if([...indices].sort((a,b)=>a-b).some((value,index)=>value!==index))return{ok:false,code:'invalid-polymer-byproduct-order'};
  const expected=route.completionEvidence.byproducts??{};
  for(const[species,count]of Object.entries(expected))if((speciesCounts.get(species)??0)!==count)return{ok:false,code:'polymer-byproduct-evidence-mismatch'};
  if([...speciesCounts].some(([species,count])=>count!==(expected[species]??0)))return{ok:false,code:'polymer-byproduct-evidence-mismatch'};
  return{ok:true,route,byproducts:[...payload.byproducts].sort((a,b)=>a.formationIndex-b.formationIndex)};
}

export function createReactionLabDiscoveryCoordinator({
  records,
  reactionProgress=null,
  reactionAuthority=null,
  polymerRoutes=[],
  polymerIds=[],
  collection,
  root=globalThis.document,
  now=Date.now,
  closeLabAndWait=()=>Promise.resolve(),
  openLab=()=>false,
  isLabOpen=()=>false,
  getBatchGeneration=()=>null,
  getFocus=()=>root?.activeElement??null,
  onVibrate=()=>{},
  onDiagnostic=diagnostic=>console.error('[Reaction Lab discovery]',diagnostic.message,diagnostic),
  present=presentFirstRegistration,
  defer=callback=>queueMicrotask(callback),
}={}){
  const recordsById=new Map((records??[]).map(record=>[record.id,record]));
  const routesById=new Map(polymerRoutes.map(route=>[route.routeId,route])),polymerIdSet=new Set(polymerIds);
  let eventSequence=0,scheduled=false,session=null;
  const queue=[];
  const polymerSamples=new Map(),dismissedSampleIds=new Set();

  function diagnostic(code,message,extra={}){onDiagnostic({code,message,...extra});}
  function updateSessionControl(ready=session?.current?.status==='presented'){
    if(!session||session.state!=='presenting'||!session.current)return;
    const current=session.current,hasNext=session.items.some(item=>item.status==='pending');
    const total=session.items.filter(item=>['pending','active','presented'].includes(item.status)).length;
    collection?.setDiscoverySession?.({
      kind:current.kind??'molecules',id:current.id??current.speciesId,speciesId:current.speciesId,
      index:session.displayIndex,total:Math.max(total,session.displayIndex),ready:!!ready,hasNext,
      onNext:advance,onReturn:finishSession,
    });
  }
  function markPending(items,status){for(const item of items)if(item.status==='pending')item.status=status;}
  function scheduleSession(){
    if(scheduled||session||!queue.some(item=>item.status==='pending'))return;
    scheduled=true;defer(()=>{scheduled=false;void startSession();});
  }
  async function startSession(){
    if(session||!queue.some(item=>item.status==='pending'))return;
    const items=queue.filter(item=>item.status==='pending');
    // Check the live generation before closing. Normal close intentionally invalidates it.
    const currentGeneration=getBatchGeneration();
    for(const item of items)if(item.batchGeneration!==currentGeneration)item.status='stale';
    if(!items.some(item=>item.status==='pending'))return;
    session={state:'suspending',items,current:null,displayIndex:0};
    try{await closeLabAndWait();}
    catch(error){markPending(items,'failed');diagnostic('lab-suspend-failed','LAB could not close for discovery presentation.',{error:String(error?.message??error)});session=null;return;}
    if(!session||session.state!=='suspending')return;
    session.state='presenting';beginNextPresentation();
  }
  function beginNextPresentation(){
    if(!session||session.state!=='presenting')return;
    while(session.items.some(item=>item.status==='pending')){
      const item=session.items.find(candidate=>candidate.status==='pending');
      item.status='active';session.current=item;session.displayIndex++;
      updateSessionControl(false);
      let started=false;
      const onSettled=result=>settlePresentation(item,result);
      try{
        if(item.kind==='reactions')started=!!collection?.openReactionAward?.(item.id,{onSettled});
        else if(item.kind==='polymers')started=!!collection?.openPolymerAward?.(item.id,{onSettled});
        else started=!!present({collection,kind:'molecules',id:item.id??item.speciesId,root,onSettled});
      }catch(error){diagnostic('presentation-threw','Discovery presentation failed to start.',{kind:item.kind,id:item.id,error:String(error?.message??error)});}
      if(!started){
        diagnostic('presentation-start-failed','Discovery presentation could not open the Collection entry.',{kind:item.kind,id:item.id});
        item.status='failed';session.current=null;abortSession('presentation-failed');return;
      }
      try{onVibrate();}catch{}
      return;
    }
    finishSession();
  }
  function settlePresentation(item,result={}){
    if(!session||session.state!=='presenting'||session.current!==item||item.status!=='active')return;
    item.presentationResult={status:result.status??'presented',reason:result.reason??null};
    if(result.status==='presented'){
      item.status='presented';updateSessionControl(true);
      // Each presentation calls onSettled only after the player taps its completed reveal.
      // One tap advances one discovery, or releases the final Collection page.
      if(session.items.some(candidate=>candidate.status==='pending'))advance();
      else finishSession();
      return;
    }
    if(result.status==='dismissed'){
      item.status='dismissed';markPending(session.items,'dismissed');finishSession();return;
    }
    item.status='failed';markPending(session.items,'failed');abortSession('presentation-failed');
  }
  function advance(){
    if(!session||session.state!=='presenting'||session.current?.status!=='presented')return false;
    session.current=null;beginNextPresentation();return true;
  }
  function finishSession(){
    if(!session)return false;
    session.state='finished';session=null;
    collection?.setDiscoverySession?.(null);
    // The earned Collection entry remains open. The user chooses what to do next.
    return true;
  }
  function abortSession(reason){
    if(!session)return;
    if(session.current?.status==='active')session.current.status='failed';
    markPending(session.items,'failed');
    finishSession();
    // Keep any successfully opened Collection screen, never silently restart LAB.
    diagnostic('presentation-aborted','Discovery sequence ended without changing saved discoveries.',{reason});
  }
  function onCollectionClosed(){
    if(!session)return;
    if(['active','presented'].includes(session.current?.status))session.current.status='dismissed';
    markPending(session.items,'dismissed');finishSession();
  }
  function handleProductEvent(event){
    const payload=event?.detail??event,validated=validateProductEvent(payload,recordsById);
    if(!validated.ok){diagnostic(validated.code,validated.message,{reactionId:payload?.reactionId??null,unknownIds:validated.unknownIds??[]});return {accepted:false,reason:validated.code};}
    let newlyVerifiedReactionId=null;
    if(reactionProgress&&reactionAuthority){
      const entry=reactionAuthority.get(`normal:${payload.reactionId}`);
      if(entry&&payload.pathwayId.startsWith(`${payload.reactionId}/`)&&JSON.stringify(entry.definition.products)===JSON.stringify(payload.products)){
        const verified=reactionProgress.verify(entry.reactionId);
        if(verified.changed&&verified.saved)newlyVerifiedReactionId=entry.reactionId;
        if(verified.changed)collection?.refreshReactionProgress?.();
      }else diagnostic('unknown-reaction-authority','Reaction identity or products do not match the catalog.',{reactionId:payload.reactionId});
    }
    const sequence=++eventSequence,at=now(),newItems=[];
    if(newlyVerifiedReactionId)newItems.push({kind:'reactions',id:newlyVerifiedReactionId,eventSequence:sequence,status:'pending',batchGeneration:payload.batchGeneration});
    for(const speciesId of validated.species){
      const result=collection.registerDiscoveredMolecule(speciesId,{at}),registrationEvent=result?.event??null;
      if(result?.changed!==true||registrationEvent?.isNew!==true||result.saved===false)continue;
      const duplicate=queue.some(item=>item.speciesId===speciesId&&['pending','active','presented','dismissed'].includes(item.status));
      if(duplicate)continue;
      const item={kind:'molecules',id:speciesId,eventSequence:sequence,status:'pending',speciesId,reactionId:payload.reactionId,pathwayId:payload.pathwayId,batchGeneration:payload.batchGeneration,firstProductIndex:validated.firstIndexBySpecies.get(speciesId),registrationEvent,registrationResult:result,productIds:[...payload.products]};
      newItems.push(item);
    }
    if(newItems.length){
      queue.push(...newItems);
      if(session&&['suspending','presenting'].includes(session.state))session.items.push(...newItems);
      if(session?.state==='presenting')updateSessionControl(session.current?.status==='presented');
      scheduleSession();
    }
    return {accepted:true,eventSequence:sequence,species:[...validated.species],newSpecies:newItems.filter(item=>item.kind==='molecules').map(item=>item.speciesId),newReaction:newlyVerifiedReactionId,timestamp:at};
  }
  function handlePolymerSampleEvent(event){
    const payload=event?.detail??event,validated=validatePolymerSampleEvent(payload,{recordsById,polymerIds:polymerIdSet,routesById});
    if(!validated.ok){diagnostic(validated.code,'Reaction Lab PolymerSample registration was rejected.',{routeId:payload?.routeId??null,polymerId:payload?.polymerId??null});return{accepted:false,reason:validated.code};}
    let newlyVerifiedReactionId=null;
    if(reactionProgress&&reactionAuthority){
      const entry=reactionAuthority.get(`polymer:${payload.routeId}`);
      if(entry&&entry.definition.polymerId===payload.polymerId){
        const verified=reactionProgress.verify(entry.reactionId);
        if(verified.changed&&verified.saved)newlyVerifiedReactionId=entry.reactionId;
        if(verified.changed)collection?.refreshReactionProgress?.();
      }
    }
    const existing=polymerSamples.get(payload.sampleId);
    if(existing)return existing.batchGeneration===payload.batchGeneration?{accepted:true,duplicate:true,eventSequence:existing.eventSequence,newEntries:[]}:{accepted:false,reason:'sample-generation-mismatch'};
    const sequence=++eventSequence,at=now(),items=[];
    if(newlyVerifiedReactionId)items.push({kind:'reactions',id:newlyVerifiedReactionId,eventSequence:sequence,status:'registered',batchGeneration:payload.batchGeneration,sampleId:payload.sampleId});
    try{
      const polymerResult=collection.registerDiscoveredPolymer(payload.polymerId,{at});
      if(polymerResult?.changed===true&&polymerResult?.saved!==false&&polymerResult?.event?.isNew===true)items.push({kind:'polymers',id:payload.polymerId,eventSequence:sequence,status:'awaiting-present',speciesId:payload.polymerId,polymerId:payload.polymerId,routeId:payload.routeId,sampleId:payload.sampleId,batchGeneration:payload.batchGeneration,registrationEvent:polymerResult.event,registrationResult:polymerResult});
      const registeredByproductSpecies=new Set();for(const byproduct of validated.byproducts){
        if(registeredByproductSpecies.has(byproduct.species))continue;registeredByproductSpecies.add(byproduct.species);
        const result=collection.registerDiscoveredMolecule(byproduct.species,{at}),registrationEvent=result?.event??null;
        if(result?.changed!==true||registrationEvent?.isNew!==true||result.saved===false)continue;
        const duplicate=queue.some(item=>item.kind==='molecules'&&item.speciesId===byproduct.species&&['pending','active','presented','dismissed','awaiting-present'].includes(item.status));
        if(duplicate)continue;
        items.push({kind:'molecules',id:byproduct.species,eventSequence:sequence,status:'awaiting-present',speciesId:byproduct.species,routeId:payload.routeId,polymerId:payload.polymerId,sampleId:payload.sampleId,batchGeneration:payload.batchGeneration,firstProductIndex:byproduct.formationIndex,byproduct:{...byproduct},registrationEvent,registrationResult:result});
      }
    }catch(error){diagnostic('polymer-registration-failed','PolymerSample registration could not be persisted.',{sampleId:payload.sampleId,error:String(error?.message??error)});return{accepted:false,reason:'registration-failed'};}
    // Save discoveries now, but wait until growth completes before opening the Collection.
    for(const item of items)item.status='registered';
    polymerSamples.set(payload.sampleId,{batchGeneration:payload.batchGeneration,eventSequence:sequence,items});
    return{accepted:true,eventSequence:sequence,newEntries:items.map(item=>({kind:item.kind,id:item.id})),timestamp:at};
  }
  function handlePolymerSamplePresent(event){
    const payload=event?.detail??event;if(!payload||!isNonEmptyString(payload.sampleId)||!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return{accepted:false,reason:'invalid-presentation-identity'};
    const sample=polymerSamples.get(payload.sampleId);if(!sample||sample.batchGeneration!==payload.batchGeneration||dismissedSampleIds.has(payload.sampleId))return{accepted:false,reason:'stale-or-dismissed-sample'};
    const ready=[
      ...sample.items.filter(item=>item.kind==='reactions'),
      ...sample.items.filter(item=>item.kind==='molecules'),
      ...sample.items.filter(item=>item.kind==='polymers'),
    ].filter(item=>item.status==='registered');
    for(const item of ready){item.status='pending';queue.push(item);}
    // Give the final grown structure a moment on screen before the Collection transition.
    if(ready.length)setTimeout(()=>{if(!dismissedSampleIds.has(payload.sampleId))scheduleSession();},650);
    return{accepted:true,eventSequence:sample.eventSequence,newEntries:ready.map(item=>({kind:item.kind,id:item.id}))};
  }
  function handlePolymerSampleDismiss(event){
    const payload=event?.detail??event;if(!payload||!isNonEmptyString(payload.sampleId)||!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return false;
    const sample=polymerSamples.get(payload.sampleId);if(!sample||sample.batchGeneration!==payload.batchGeneration)return false;
    dismissedSampleIds.add(payload.sampleId);for(const item of sample.items)if(['registered','ready-in-lab','pending'].includes(item.status))item.status='dismissed';
    return true;
  }
  function snapshot(){return {eventSequence,sessionState:session?.state??null,queue:queue.map(item=>({...item,...(item.productIds?{productIds:[...item.productIds]}:{})}))};}

  return {handleProductEvent,handlePolymerSampleEvent,handlePolymerSamplePresent,handlePolymerSampleDismiss,onCollectionClosed,snapshot};
}
