const clone=value=>globalThis.structuredClone?globalThis.structuredClone(value):JSON.parse(JSON.stringify(value));
const bondKey=([a,b,order])=>[Math.min(a,b),Math.max(a,b),order].join(':');
const keyOf=value=>JSON.stringify({
  atoms:value.workspace.atoms.map(atom=>atom.element),
  bonds:value.workspace.bonds.map(bondKey).sort()
});

// Atom indices are stable within an Undo segment: additions append, and any
// atom removal clears the segment. Keep the live pose of every surviving atom.
export function prepareAssemblyUndo(before,current){
  const restored=clone(before), workspace=restored.workspace, live=current.workspace;
  for(let i=0;i<workspace.atoms.length;i++){
    const atom=live.atoms[i];
    if(atom?.element===workspace.atoms[i].element&&Array.isArray(atom.position))
      workspace.atoms[i].position=clone(atom.position);
  }
  const valid=index=>Number.isInteger(index)&&index>=0&&index<workspace.atoms.length;
  if(live.camera)workspace.camera=clone(live.camera);
  if(Object.hasOwn(live,'selected'))workspace.selected=valid(live.selected)?live.selected:null;
  if(Object.hasOwn(live,'focus'))workspace.focus=valid(live.focus)?live.focus:(valid(workspace.focus)?workspace.focus:null);
  if(Object.hasOwn(live,'pivot'))workspace.pivot=null; // recompute from the live pose and restored graph
  if(Object.hasOwn(live,'targetMoleculeId'))workspace.targetMoleculeId=live.targetMoleculeId;
  const oldKeys=new Set(workspace.bonds.map(bondKey)),liveKeys=new Set(live.bonds.map(bondKey));
  const changedAtomIndices=[...new Set([
    ...workspace.bonds.filter(b=>!liveKeys.has(bondKey(b))),
    ...live.bonds.filter(b=>!oldKeys.has(bondKey(b)))
  ].flatMap(([a,b])=>[a,b]).filter(valid))];
  return {snapshot:restored,changedAtomIndices};
}

const workspaceAtomCount=snapshot=>Array.isArray(snapshot?.workspace?.atoms)?snapshot.workspace.atoms.length:null;

// CRAFT deletes return atoms to BASE STOCK, so a decrease in workspace atoms is
// the shared destructive boundary. The mutation itself succeeds, but history
// before that boundary is intentionally discarded instead of becoming Undoable.
export function isDestructiveCraftChange(before,after){
  const beforeCount=workspaceAtomCount(before),afterCount=workspaceAtomCount(after);
  return beforeCount!==null&&afterCount!==null&&afterCount<beforeCount;
}

// Session-local undo history for semantic CRAFT mutations. Snapshots are owned
// by the integration layer so workspace graph and BASE STOCK can be restored
// atomically without operation-specific inverse logic. User Undo records only
// graph mutations; pending rollback still restores the full pre-gesture pose.
// Progression/discovery is
// deliberately outside these snapshots and therefore remains monotonic.
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
    if(isDestructiveCraftChange(before,after)){past.length=0;notify();return true;}
    past.push(before);notify();return true;
  }
  function cancel(){const had=pending!==null;pending=null;pendingKey='';return had;}
  function rollback(){
    if(restoring||pending===null)return false;
    const snapshot=pending,snapshotKey=pendingKey;pending=null;pendingKey='';restoring=true;let restored=false;
    try{restored=restore(clone(snapshot))!==false;}
    catch(error){pending=snapshot;pendingKey=snapshotKey;throw error;}
    finally{restoring=false;}
    if(!restored){pending=snapshot;pendingKey=snapshotKey;}
    notify();return restored;
  }
  function reset(){past.length=0;cancel();notify();}
  function undo(){
    if(restoring||!past.length)return false;
    cancel();const snapshot=past.pop();restoring=true;let restored=false;
    try{
      const prepared=prepareAssemblyUndo(snapshot,capture());
      restored=restore(prepared.snapshot,{reason:'undo',changedAtomIndices:prepared.changedAtomIndices})!==false;
    }
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
  return{begin,commit,cancel,rollback,reset,undo,record,get canUndo(){return past.length>0;},get depth(){return past.length;},get pending(){return pending!==null;}};
}
