// Completion side effects are edge-triggered from forward topology syncs.
// Structure identity is the atom-set key, not the molecular signature, so a
// complete -> complete topology change cannot masquerade as a fresh completion.
export function createCompletionSideEffectGate(){
  let previous=new Map(),suppressNext=false;

  function sync(structures){
    const next=new Map(structures.map(item=>[item.key,{complete:!!item.complete,signature:item.signature}]));
    const changed=structures.filter(item=>{
      const before=previous.get(item.key);
      return !before||before.complete!==!!item.complete||before.signature!==item.signature;
    });
    const completions=changed.filter(item=>item.complete&&previous.get(item.key)?.complete!==true);
    const suppressed=suppressNext;suppressNext=false;previous=next;
    return suppressed?{changed:[],completions:[],suppressed:true}:{changed,completions,suppressed:false};
  }

  // Restore/reset callers use this before their next derived topology sync. The
  // sync still replaces the baseline, but no progression or feedback may emit.
  function suppressNextSync(){suppressNext=true;}
  function reset(){previous=new Map();suppressNext=false;}

  return{sync,suppressNextSync,reset};
}
