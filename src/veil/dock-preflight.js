import {migrateDockStorage} from './dock-migration.js';

try{migrateDockStorage(globalThis.localStorage);}catch{}

if(typeof document!=='undefined'){
  const boot=()=>import('./dock.js').catch(error=>console.warn('DOCK UI unavailable.',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
}
