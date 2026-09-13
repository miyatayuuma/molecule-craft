export const TEAR_POLICY=Object.freeze({
  armDistance:.82,
  feedbackRatio:.58,
  releaseRatio:.78,
  holdMs:300,
  orderMultiplier:Object.freeze({1:1,2:1.2,3:1.4}),
});

const keyFor=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
const subtract=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const length=v=>Math.hypot(v.x,v.y,v.z);
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const normalize=v=>{const size=length(v);return size>1e-9?{x:v.x/size,y:v.y/size,z:v.z/size}:null;};

function adjacencyFor(molecule,scope=null){
  const ids=scope??new Set(molecule.atoms.map(atom=>atom.id)),adjacency=new Map([...ids].map(id=>[id,[]]));
  for(const bond of molecule.bonds){
    if(!ids.has(bond.a)||!ids.has(bond.b))continue;
    adjacency.get(bond.a).push({id:bond.b,bond});adjacency.get(bond.b).push({id:bond.a,bond});
  }
  return adjacency;
}

function component(adjacency,start,skipKey=null){
  if(!adjacency.has(start))return new Set();
  const seen=new Set([start]),queue=[start];
  for(let index=0;index<queue.length;index++){
    const id=queue[index];
    for(const edge of adjacency.get(id)??[]){
      if(skipKey&&keyFor(id,edge.id)===skipKey)continue;
      if(!seen.has(edge.id)){seen.add(edge.id);queue.push(edge.id);}
    }
  }
  return seen;
}

function metric(ids,atoms){
  let heavy=0,total=0;
  for(const id of ids){const atom=atoms.get(id);if(!atom)continue;total++;if(atom.element!=='H')heavy++;}
  return{heavy,total};
}

function compareMetric(a,b){return a.heavy-b.heavy||a.total-b.total;}

function candidateDirection(candidate,{grabbedAtomId,positionFor}){
  if(typeof positionFor!=='function')return null;
  const grabbed=positionFor(grabbedAtomId),body=positionFor(candidate.bodySideId),attachment=positionFor(candidate.grabSideId);
  if(grabbed&&body){const direct=normalize(subtract(grabbed,body));if(direct)return direct;}
  return attachment&&body?normalize(subtract(attachment,body)):null;
}

export function tearCandidates(molecule,grabbedAtomId,{positionFor=null,pullVector=null}={}){
  if(!molecule?.atoms?.some(atom=>atom.id===grabbedAtomId))return[];
  const atoms=new Map(molecule.atoms.map(atom=>[atom.id,atom])),fullAdjacency=adjacencyFor(molecule),scope=component(fullAdjacency,grabbedAtomId),adjacency=adjacencyFor(molecule,scope),candidates=[];
  for(const bond of molecule.bonds){
    if(!scope.has(bond.a)||!scope.has(bond.b))continue;
    const key=keyFor(bond.a,bond.b),grabFragment=component(adjacency,grabbedAtomId,key);
    if(grabFragment.size===scope.size)continue; // ring/internal edge: removing it does not detach a component.
    const bodyFragment=new Set([...scope].filter(id=>!grabFragment.has(id)));
    if(!bodyFragment.size)continue;
    const grabMetric=metric(grabFragment,atoms),bodyMetric=metric(bodyFragment,atoms);
    if(compareMetric(grabMetric,bodyMetric)>0)continue;
    const grabSideId=grabFragment.has(bond.a)?bond.a:bond.b,bodySideId=grabSideId===bond.a?bond.b:bond.a;
    const candidate={key,bond,grabbedAtomId,grabSideId,bodySideId,grabFragment,bodyFragment,grabMetric,bodyMetric,directionScore:0};
    const direction=candidateDirection(candidate,{grabbedAtomId,positionFor});candidate.direction=direction;
    const normalizedPull=pullVector?normalize(pullVector):null;if(direction&&normalizedPull)candidate.directionScore=dot(direction,normalizedPull);
    candidates.push(candidate);
  }
  return candidates.sort((a,b)=>compareMetric(a.grabMetric,b.grabMetric)||b.directionScore-a.directionScore||a.key.localeCompare(b.key));
}

export function findTearCandidate(molecule,grabbedAtomId,options={}){return tearCandidates(molecule,grabbedAtomId,options)[0]??null;}

export function projectedTearPull(candidate,pullVector){
  if(!candidate?.direction||!pullVector)return 0;
  return Math.max(0,dot(candidate.direction,pullVector));
}

export function createTearGesture(policy=TEAR_POLICY){
  let key=null,holding=false,holdMs=0,lastNow=null;
  const reset=()=>{key=null;holding=false;holdMs=0;lastNow=null;};
  function update({candidate,tension=0,now=0}={}){
    if(!candidate||!Number.isFinite(tension)||!Number.isFinite(now)){reset();return{candidate:null,feedback:0,progress:0,armed:false,shouldTear:false};}
    if(candidate.key!==key){key=candidate.key;holding=false;holdMs=0;lastNow=now;}
    const multiplier=policy.orderMultiplier[candidate.bond.order]??1,threshold=policy.armDistance*multiplier,release=threshold*policy.releaseRatio,feedbackStart=threshold*policy.feedbackRatio;
    const previousHolding=holding,delta=Math.max(0,Math.min(50,now-(lastNow??now)));lastNow=now;
    if(tension>=threshold){holding=true;if(previousHolding)holdMs+=delta;}
    else if(holding&&tension>=release){/* hysteresis band: preserve accumulated hold without advancing it. */}
    else {holding=false;holdMs=0;}
    const feedback=tension<=feedbackStart?0:Math.min(1,(tension-feedbackStart)/Math.max(.001,threshold-feedbackStart));
    const progress=Math.min(1,holdMs/policy.holdMs),shouldTear=holding&&progress>=1;
    return{candidate,tension,threshold,release,feedback,progress,armed:holding,armedJustNow:holding&&!previousHolding,shouldTear};
  }
  return{update,reset,get activeKey(){return key;}};
}
