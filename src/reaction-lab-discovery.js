import {presentFirstRegistration} from './collection-registration-reveal.js?v=3';

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
  function sessionItems(){return session?.items??[];}
  function updateSessionControl(ready=session?.current?.status==='presented'){
    if(!session||session.state!=='presenting')return;
    const current=session.current;
    if(!current)return;
    for(const item of session.items)if(item.status==='pending'&&getBatchGeneration()!==item.batchGeneration)item.status='stale';
    const total=session.items.filter(item=>['pending','active','presented'].includes(item.status)).length;
    const hasNext=session.items.some(item=>item.status==='pending');
    collection?.setDiscoverySession?.({
      kind:current.kind??'molecules',id:current.id??current.speciesId,speciesId:current.speciesId,index:session.displayIndex,total:Math.max(total,session.displayIndex),ready:!!ready,hasNext,
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
    session={state:'suspending',items,current:null,displayIndex:0,returnToLab:!!isLabOpen(),focusTarget:getFocus(),resumeScheduled:false};
    try{await closeLabAndWait();}
    catch(error){markPending(session?.items??items,'failed');diagnostic('lab-suspend-failed','Reaction Lab could not be safely suspended for discovery presentation.',{error:String(error?.message??error)});session=null;return;}
    if(!session||session.state!=='suspending')return;
    for(const item of items)if(item.status==='pending'&&getBatchGeneration()!==item.batchGeneration)item.status='stale';
    if(!items.some(item=>item.status==='pending')){await resumeSession();return;}
    session.state='presenting';
    beginNextPresentation();
  }
  function beginNextPresentation(){
    if(!session||session.state!=='presenting')return;
    const currentGeneration=getBatchGeneration();
    while(session.items.some(item=>item.status==='pending')){
      const item=session.items.find(candidate=>candidate.status==='pending');
      if(currentGeneration!==item.batchGeneration){item.status='stale';continue;}
      item.status='active';session.current=item;session.displayIndex++;
      updateSessionControl(false);
      let started=false;
      try{started=!!present({collection,kind:item.kind??'molecules',id:item.id??item.speciesId,root,onSettled:result=>settlePresentation(item,result)});}
      catch(error){diagnostic('presentation-threw','Canonical Collection presentation failed to start.',{speciesId:item.speciesId,error:String(error?.message??error)});}
      if(!started){
        diagnostic('presentation-start-failed','Canonical Collection presentation did not start.',{kind:item.kind??'molecules',id:item.id??item.speciesId,reason:item.presentationResult?.reason??'collection-unavailable'});
        item.status='failed';item.presentationResult={status:'failed',reason:item.presentationResult?.reason??'collection-unavailable'};session.current=null;abortSession('presentation-failed');return;
      }
      try{onVibrate();}catch{}
      return;
    }
    void finishSession();
  }
  function settlePresentation(item,result={}){
    if(!session||session.state!=='presenting'||session.current!==item||item.status!=='active')return;
    item.presentationResult={status:result.status??'presented',reason:result.reason??null};
    if(result.status==='presented'){
      item.status='presented';updateSessionControl(true);return;
    }
    if(result.status==='dismissed'){
      item.status='dismissed';markPending(session.items,'dismissed');session.state='closing';collection?.setDiscoverySession?.(null);scheduleResume();return;
    }
    item.status='failed';markPending(session.items,'failed');abortSession('presentation-failed');
  }
  function advance(){
    if(!session||session.state!=='presenting'||session.current?.status!=='presented')return false;
    session.current=null;beginNextPresentation();return true;
  }
  async function finishSession(){
    if(!session||!['presenting','closing'].includes(session.state))return false;
    const current=session;current.state='finishing';collection?.setDiscoverySession?.(null);
    try{await collection?.closeAndWait?.();}
    catch(error){diagnostic('collection-close-failed','Collection dialog did not finish closing cleanly.',{error:String(error?.message??error)});if(collection?.isOpen?.())return false;}
    if(collection?.isOpen?.()){diagnostic('collection-close-failed','Collection dialog remains open; Reaction Lab will stay suspended.');return false;}
    if(session===current)await resumeSession();
    return true;
  }
  function abortSession(reason){
    if(!session)return;
    session.state='closing';if(session.current?.status==='active')session.current.status='failed';markPending(session.items,'failed');collection?.setDiscoverySession?.(null);
    const current=session;
    if(collection?.isOpen?.()){
      void collection.closeAndWait?.().catch?.(error=>diagnostic('collection-close-failed','Collection dialog did not finish closing cleanly.',{reason,error:String(error?.message??error)})).finally(()=>{if(session===current)void resumeSession();});
    }else scheduleResume();
  }
  function scheduleResume(){
    if(!session||session.resumeScheduled)return;
    session.resumeScheduled=true;
    defer(()=>{if(session)void resumeSession();});
  }
  async function resumeSession(){
    const current=session;if(!current)return;
    current.state='resuming';session=null;
    if(!current.returnToLab)return;
    try{
      const opened=await openLab();
      const focusTarget=current.focusTarget;
      defer(()=>{
        const valid=focusTarget?.isConnected&&!focusTarget.disabled&&!focusTarget.closest?.('[inert]');
        const fallback=root?.querySelector?.('#reaction-lab-dialog [data-lab-close]')??root?.querySelector?.('#open-reaction-lab');
        const target=valid?focusTarget:fallback;
        if(target?.isConnected&&!target.disabled)target.focus?.({preventScroll:true});
        if(valid&&root?.activeElement!==focusTarget&&fallback?.isConnected&&!fallback.disabled)fallback.focus?.({preventScroll:true});
      });
      if(!opened)diagnostic('lab-resume-failed','Reaction Lab could not be reopened after Collection presentation.');
    }catch(error){diagnostic('lab-resume-failed','Reaction Lab could not be reopened after Collection presentation.',{error:String(error?.message??error)});}
  }
  function onCollectionClosed(){
    if(session?.state==='finishing'){scheduleResume();return;}
    if(!session||!['presenting','suspending'].includes(session.state))return;
    if(session.state==='suspending')return;
    if(['active','presented'].includes(session.current?.status))session.current.status='dismissed';
    markPending(session.items,'dismissed');session.state='closing';collection?.setDiscoverySession?.(null);scheduleResume();
  }
  function handleProductEvent(event){
    const payload=event?.detail??event,validated=validateProductEvent(payload,recordsById);
    if(!validated.ok){diagnostic(validated.code,validated.message,{reactionId:payload?.reactionId??null,unknownIds:validated.unknownIds??[]});return {accepted:false,reason:validated.code};}
    const sequence=++eventSequence,at=now(),newItems=[];
    for(const speciesId of validated.species){
      const result=collection.registerDiscoveredMolecule(speciesId,{at}),registrationEvent=result?.event??null;
      if(result?.changed!==true||registrationEvent?.isNew!==true)continue;
      const duplicate=queue.some(item=>item.speciesId===speciesId&&['pending','active','presented','dismissed'].includes(item.status));
      if(duplicate)continue;
      const item={kind:'molecules',id:speciesId,eventSequence:sequence,status:'pending',speciesId,reactionId:payload.reactionId,pathwayId:payload.pathwayId,batchGeneration:payload.batchGeneration,firstProductIndex:validated.firstIndexBySpecies.get(speciesId),registrationEvent,registrationResult:result,productIds:[...payload.products]};
      queue.push(item);newItems.push(item);
      if(session&&['suspending','presenting'].includes(session.state))session.items.push(item);
    }
    if(newItems.length){
      if(session?.state==='presenting')updateSessionControl(session.current?.status==='presented');
      scheduleSession();
    }
    return {accepted:true,eventSequence:sequence,species:[...validated.species],newSpecies:newItems.map(item=>item.speciesId),timestamp:at};
  }
  function handlePolymerSampleEvent(event){
    const payload=event?.detail??event,validated=validatePolymerSampleEvent(payload,{recordsById,polymerIds:polymerIdSet,routesById});
    if(!validated.ok){diagnostic(validated.code,'Reaction Lab PolymerSample registration was rejected.',{routeId:payload?.routeId??null,polymerId:payload?.polymerId??null});return{accepted:false,reason:validated.code};}
    const existing=polymerSamples.get(payload.sampleId);
    if(existing)return existing.batchGeneration===payload.batchGeneration?{accepted:true,duplicate:true,eventSequence:existing.eventSequence,newEntries:[]}:{accepted:false,reason:'sample-generation-mismatch'};
    const sequence=++eventSequence,at=now(),items=[];
    try{
      const polymerResult=collection.registerDiscoveredPolymer(payload.polymerId,{at});
      if(polymerResult?.changed===true&&polymerResult?.event?.isNew===true)items.push({kind:'polymers',id:payload.polymerId,eventSequence:sequence,status:'awaiting-present',speciesId:payload.polymerId,polymerId:payload.polymerId,routeId:payload.routeId,sampleId:payload.sampleId,batchGeneration:payload.batchGeneration,registrationEvent:polymerResult.event,registrationResult:polymerResult});
      const registeredByproductSpecies=new Set();for(const byproduct of validated.byproducts){
        if(registeredByproductSpecies.has(byproduct.species))continue;registeredByproductSpecies.add(byproduct.species);
        const result=collection.registerDiscoveredMolecule(byproduct.species,{at}),registrationEvent=result?.event??null;
        if(result?.changed!==true||registrationEvent?.isNew!==true)continue;
        const duplicate=queue.some(item=>item.kind==='molecules'&&item.speciesId===byproduct.species&&['pending','active','presented','dismissed','awaiting-present'].includes(item.status));
        if(duplicate)continue;
        items.push({kind:'molecules',id:byproduct.species,eventSequence:sequence,status:'awaiting-present',speciesId:byproduct.species,routeId:payload.routeId,polymerId:payload.polymerId,sampleId:payload.sampleId,batchGeneration:payload.batchGeneration,firstProductIndex:byproduct.formationIndex,byproduct:{...byproduct},registrationEvent,registrationResult:result});
      }
    }catch(error){diagnostic('polymer-registration-failed','PolymerSample registration could not be persisted.',{sampleId:payload.sampleId,error:String(error?.message??error)});return{accepted:false,reason:'registration-failed'};}
    queue.push(...items);polymerSamples.set(payload.sampleId,{batchGeneration:payload.batchGeneration,eventSequence:sequence,items});
    return{accepted:true,eventSequence:sequence,newEntries:items.map(item=>({kind:item.kind,id:item.id})),timestamp:at};
  }
  function handlePolymerSamplePresent(event){
    const payload=event?.detail??event;if(!payload||!isNonEmptyString(payload.sampleId)||!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return{accepted:false,reason:'invalid-presentation-identity'};
    const sample=polymerSamples.get(payload.sampleId);if(!sample||sample.batchGeneration!==payload.batchGeneration||dismissedSampleIds.has(payload.sampleId))return{accepted:false,reason:'stale-or-dismissed-sample'};
    for(const item of sample.items)if(item.status==='awaiting-present')item.status='pending';
    if(sample.items.length){if(session?.state==='presenting')updateSessionControl(session.current?.status==='presented');scheduleSession();}
    return{accepted:true,eventSequence:sample.eventSequence,newEntries:sample.items.filter(item=>item.status==='pending').map(item=>({kind:item.kind,id:item.id}))};
  }
  function handlePolymerSampleDismiss(event){
    const payload=event?.detail??event;if(!payload||!isNonEmptyString(payload.sampleId)||!Number.isSafeInteger(payload.batchGeneration)||payload.batchGeneration<0)return false;
    const sample=polymerSamples.get(payload.sampleId);if(!sample||sample.batchGeneration!==payload.batchGeneration)return false;
    dismissedSampleIds.add(payload.sampleId);for(const item of sample.items)if(['awaiting-present','pending'].includes(item.status))item.status='dismissed';
    return true;
  }
  function snapshot(){return {eventSequence,sessionState:session?.state??null,queue:queue.map(item=>({...item,...(item.productIds?{productIds:[...item.productIds]}:{})}))};}

  return {handleProductEvent,handlePolymerSampleEvent,handlePolymerSamplePresent,handlePolymerSampleDismiss,onCollectionClosed,snapshot};
}
