const clone=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
const keyOf=value=>JSON.stringify(value);

// Session-local undo history for semantic CRAFT mutations. Snapshots are owned
// by the integration layer so workspace graph and BASE STOCK can be restored
// atomically without operation-specific inverse logic.
export function createCraftHistory({capture,restore,onChange=()=>{}}={}){
  if(typeof capture!=='function'||typeof restore!=='function')throw new TypeError('capture and restore are required');
  const past=[];let pending=null,pendingKey='',restoring=false;
  const notify=()=>onChange({canUndo:past.length>0,depth:past.length,pending:pending!==null});

  function begin(){
    if(restoring||pending!==null)return false;
    pending=clone(capture());pendingKey=keyOf(pending);return true;
  }
  function commit(){
    if(pending===null)return false;
    const before=pending,beforeKey=pendingKey,after=clone(capture());pending=null;pendingKey='';
    if(keyOf(after)===beforeKey)return false;
    past.push(before);notify();return true;
  }
  function cancel(){const had=pending!==null;pending=null;pendingKey='';return had;}
  function reset(){past.length=0;cancel();notify();}
  function undo(){
    if(restoring||!past.length)return false;
    cancel();const snapshot=past.pop();restoring=true;let restored=false;
    try{restored=restore(clone(snapshot))!==false;}
    catch(error){past.push(snapshot);throw error;}
    finally{restoring=false;}
    if(!restored)past.push(snapshot);notify();return restored;
  }
  function record(mutate){
    if(typeof mutate!=='function')throw new TypeError('mutate must be a function');
    if(!begin())return mutate();
    try{const result=mutate();if(result===false||result===null){cancel();return result;}commit();return result;}
    catch(error){cancel();throw error;}
  }

  notify();
  return{begin,commit,cancel,reset,undo,record,get canUndo(){return past.length>0;},get depth(){return past.length;},get pending(){return pending!==null;}};
}
