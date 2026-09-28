import {presentFirstRegistration} from './collection-registration-reveal.js?v=2';

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

export function createReactionLabDiscoveryCoordinator({
  records,
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
  let eventSequence=0,scheduled=false,session=null;
  const queue=[];

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
      speciesId:current.speciesId,index:session.displayIndex,total:Math.max(total,session.displayIndex),ready:!!ready,hasNext,
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
      try{started=!!present({collection,id:item.speciesId,root,onSettled:result=>settlePresentation(item,result)});}
      catch(error){diagnostic('presentation-threw','Canonical Collection presentation failed to start.',{speciesId:item.speciesId,error:String(error?.message??error)});}
      if(!started){item.status='failed';item.presentationResult={status:'failed',reason:'collection-unavailable'};session.current=null;abortSession('presentation-failed');return;}
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
      const item={eventSequence:sequence,status:'pending',speciesId,reactionId:payload.reactionId,pathwayId:payload.pathwayId,batchGeneration:payload.batchGeneration,firstProductIndex:validated.firstIndexBySpecies.get(speciesId),registrationEvent,registrationResult:result,productIds:[...payload.products]};
      queue.push(item);newItems.push(item);
      if(session&&['suspending','presenting'].includes(session.state))session.items.push(item);
    }
    if(newItems.length){
      if(session?.state==='presenting')updateSessionControl(session.current?.status==='presented');
      scheduleSession();
    }
    return {accepted:true,eventSequence:sequence,species:[...validated.species],newSpecies:newItems.map(item=>item.speciesId),timestamp:at};
  }
  function snapshot(){return {eventSequence,sessionState:session?.state??null,queue:queue.map(item=>({...item,productIds:[...item.productIds]}))};}

  return {handleProductEvent,onCollectionClosed,snapshot};
}
