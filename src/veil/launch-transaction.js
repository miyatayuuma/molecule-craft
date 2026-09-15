const copy=value=>JSON.parse(JSON.stringify(value));

export const LAUNCH_TRANSACTION_STATUS=Object.freeze({SUCCESS:'success',BLOCKED:'blocked',CANCELLED:'cancelled',FAILED:'failed'});

export class LaunchTransactionError extends Error{
  constructor(reason,message=reason){super(message);this.name='LaunchTransactionError';this.reason=reason;}
}

export function captureLaunchRollbackState(resources){
  const state=resources?.state;if(!state)return null;
  return {elements:copy(state.elements),tanks:copy(state.tanks),runs:state.progress?.runs??0};
}

export function restoreLaunchRollbackState(resources,snapshot){
  const state=resources?.state;if(!state||!snapshot)return false;
  state.elements=copy(snapshot.elements);state.tanks=copy(snapshot.tanks);
  if(state.progress)state.progress.runs=snapshot.runs;
  return true;
}

export function stageLaunchSupply(resources,{partial=false}={}){
  if(!resources||resources.blocked)return false;
  const preview=resources.launchFillPlan({includeWorkspace:false});
  if(!preview||preview.status==='IMPOSSIBLE'||preview.status==='PARTIAL'&&!partial)return false;
  const plan=preview.status==='FULL'?preview.full:preview.partial;
  if(!plan?.entries||!plan.cost)return false;
  const beforeElements=copy(resources.state.elements),beforeTanks=copy(resources.state.tanks);
  try{
    for(const entry of plan.entries)if(!resources.state.tanks?.[entry.use])throw new LaunchTransactionError('supply-invalid','Launch supply references an unknown tank.');
    if(!resources.spend(plan.cost))return false;
    for(const entry of plan.entries){
      const tank=resources.state.tanks[entry.use];
      if(!entry.molecule){tank.molecule=null;tank.amount=0;}
      else{tank.molecule=entry.molecule;tank.amount=entry.target;}
    }
    return {committed:true,status:preview.status,plan:copy(plan),required:copy(preview.required??{}),missing:copy(preview.missing??{}),emptyDeparture:preview.emptyDeparture===true};
  }catch(error){
    resources.state.elements=beforeElements;resources.state.tanks=beforeTanks;
    throw error;
  }
}

export function createLaunchTransaction({validate,beforeLaunch,snapshot,commitSupply,prepareExpedition,createRun,initializeExplore,stageSuccess,persist,rollback}){
  for(const [name,fn]of Object.entries({validate,beforeLaunch,snapshot,commitSupply,prepareExpedition,createRun,initializeExplore,stageSuccess,persist,rollback}))if(typeof fn!=='function')throw new TypeError(`Launch transaction requires ${name}.`);
  let inFlight=false;
  async function execute(destinationId,{partial=false,presentSupply=null}={}){
    if(inFlight)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'in-flight'};
    let validation;
    try{validation=validate(destinationId);}catch(error){return {status:LAUNCH_TRANSACTION_STATUS.FAILED,reason:'validate',error};}
    if(validation!==true)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:typeof validation==='string'?validation:'invalid-destination'};
    inFlight=true;
    let checkpoint=null,stage='before-launch',supply=null,prepared=null,run=null;
    try{
      if(await beforeLaunch(destinationId)===false)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'before-launch'};
      checkpoint=await snapshot(destinationId);
      stage='supply';supply=await commitSupply({destinationId,partial});
      if(!supply)return {status:LAUNCH_TRANSACTION_STATUS.BLOCKED,reason:'supply-unavailable'};
      if(typeof presentSupply==='function')try{await presentSupply(supply);}catch(error){console.warn('Launch supply presentation failed; continuing committed transaction.',error);}
      stage='prepare-expedition';prepared=await prepareExpedition({destinationId,supply});
      if(prepared===false||prepared==null)throw new LaunchTransactionError('prepare-expedition');
      stage='create-run';run=await createRun({destinationId,supply,prepared});
      if(!run)throw new LaunchTransactionError('create-run');
      stage='initialize-explore';if(await initializeExplore({destinationId,supply,prepared,run})===false)throw new LaunchTransactionError('initialize-explore');
      stage='stage-success';if(await stageSuccess({destinationId,supply,prepared,run})===false)throw new LaunchTransactionError('stage-success');
      stage='save';if(await persist({destinationId,supply,prepared,run})===false)throw new LaunchTransactionError('save');
      return {status:LAUNCH_TRANSACTION_STATUS.SUCCESS,destinationId,supply,run};
    }catch(error){
      let rollbackError=null;
      if(checkpoint!==null)try{await rollback({destinationId,checkpoint,stage,error,supply,prepared,run});}catch(failure){rollbackError=failure;}
      return {status:LAUNCH_TRANSACTION_STATUS.FAILED,reason:error?.reason??stage,error,...(rollbackError?{rollbackError}:{})};
    }finally{inFlight=false;}
  }
  return {execute,get inFlight(){return inFlight;}};
}
