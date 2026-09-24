if(typeof document!=='undefined'){
  const boot=()=>import('./reaction-lab.js').catch(error=>console.warn('Reaction Lab unavailable.',error));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else queueMicrotask(boot);
}
