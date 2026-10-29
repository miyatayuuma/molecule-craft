// Own a single worker job. A cancelled job always settles and cannot publish
// a late response, even if the browser delivers an already queued event.
export function createReferencePreparation(createWorker){
  let active=null;
  function cancel(){
    if(!active)return;
    const job=active;active=null;job.worker.onmessage=null;job.worker.onerror=null;
    job.worker.terminate();job.resolve(null);
  }
  function start(polymerId,units,generation){
    cancel();
    const preparation={polymerId,units,generation,promise:null};
    preparation.promise=new Promise(resolve=>{
      let worker;
      try{worker=createWorker();}catch{resolve(null);return;}
      const job={worker,resolve};active=job;
      const finish=value=>{
        if(active!==job)return;
        active=null;worker.onmessage=null;worker.onerror=null;worker.terminate();resolve(value);
      };
      worker.onmessage=event=>finish(event.data?.error?null:event.data?.plan??null);
      worker.onerror=()=>finish(null);
      try{worker.postMessage({polymerId,units});}catch{finish(null);}
    });
    return preparation;
  }
  return {start,cancel};
}
