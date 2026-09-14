import {REGIONS} from './growth.js';

export function isExpeditionDestinationAvailable(state,destinationId){
  if(typeof destinationId!=='string'||!destinationId)return false;
  const progress=state?.progress;
  if(!progress)return false;
  if(destinationId==='continue')return typeof progress.checkpoint==='string'&&Object.hasOwn(REGIONS,progress.checkpoint);
  return Object.hasOwn(REGIONS,destinationId)&&Array.isArray(progress.regions)&&progress.regions.includes(destinationId);
}

export function createExpeditionLaunchRequester({isAvailable,selectDestination,prepareLaunch}){
  if(typeof isAvailable!=='function'||typeof selectDestination!=='function'||typeof prepareLaunch!=='function')throw new TypeError('Launch requester requires availability, selection, and preparation callbacks.');
  return function requestExpeditionLaunch(destinationId){
    if(!isAvailable(destinationId))return false;
    if(selectDestination(destinationId)===false)return false;
    return prepareLaunch(destinationId)!==false;
  };
}
