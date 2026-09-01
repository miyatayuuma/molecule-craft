import { VEIL } from './config.js';

const ELEMENTS=['H','C','O'],FUELS=['hydrogen','methane','oxygen'];
const counts=(keys,source={})=>Object.fromEntries(keys.map(key=>[key,source[key]??0]));

export function createExpeditionTelemetry(fuel={}){
  return {duration:0,maxDepth:0,collected:counts(ELEMENTS),fuelStart:counts(FUELS,fuel),fuelUsed:counts(FUELS),burstUses:0,combustionSeconds:0,maxEaters:0,minEaterDistance:Infinity,dangerContacts:0,returnType:null,loss:counts(ELEMENTS)};
}

export function recordFuelUse(telemetry,key,amount=1){
  if(telemetry&&Object.hasOwn(telemetry.fuelUsed,key))telemetry.fuelUsed[key]+=amount;
}

export function recordExpeditionFrame(run,dt){
  const t=run.telemetry;if(!t)return;
  t.duration=run.time;t.maxDepth=Math.max(t.maxDepth,VEIL.spawn.y-run.player.y);
  for(const element of ELEMENTS)t.collected[element]=run.collectedElements[element]??0;
  if(run.player.combustion)t.combustionSeconds+=dt;
  t.maxEaters=Math.max(t.maxEaters,run.eaters.length);
  if(Number.isFinite(run.nearestEater))t.minEaterDistance=Math.min(t.minEaterDistance,run.nearestEater);
}

export function completeExpeditionTelemetry(run,{captured=false,result=null}={}){
  recordExpeditionFrame(run,0);const t=run.telemetry;t.returnType=captured?'forced':'voluntary';
  for(const element of ELEMENTS)t.loss[element]=result?.lost?.[element]??0;
  return {
    duration:+t.duration.toFixed(2),maxDepth:Math.round(t.maxDepth),collected:{...t.collected},fuelStart:{...t.fuelStart},fuelUsed:{...t.fuelUsed},burstUses:t.burstUses,combustionSeconds:+t.combustionSeconds.toFixed(2),maxEaters:t.maxEaters,minEaterDistance:Number.isFinite(t.minEaterDistance)?Math.round(t.minEaterDistance):null,dangerContacts:t.dangerContacts,returnType:t.returnType,loss:{...t.loss},
  };
}

export function logExpeditionTelemetry(report,{location=globalThis.location,logger=globalThis.console?.info}={}){
  let enabled=false;try{enabled=new URLSearchParams(location?.search??'').get('expeditionDebug')==='1';}catch{}
  if(enabled&&typeof logger==='function')logger('[Expedition telemetry]',report);
  return enabled;
}
