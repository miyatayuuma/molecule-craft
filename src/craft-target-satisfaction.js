// Current explicit atoms/bonds only. No provenance or completion recognition.
// A selected workspace component must embed into the target: existing edges
// must agree, while missing edges BETWEEN pieces are allowed during crafting.
// Score: covered target atoms, then satisfied pieces; stable IDs break ties.
function index(graph){
  const atoms=graph.atoms.map((a,i)=>typeof a==='string'?{id:i,element:a}:{id:a.id??i,element:a.element});
  const byId=new Map(atoms.map((a,i)=>[a.id,i])),edges=atoms.map(()=>new Map());
  for(const bond of graph.bonds){const [a,b,o]=Array.isArray(bond)?bond:[byId.get(bond.a),byId.get(bond.b),bond.order];edges[a].set(b,o);edges[b].set(a,o);}
  return {atoms,edges};
}
const compare=(a,b)=>a<b?-1:a>b?1:0;
const bit=i=>1n<<BigInt(i);
export function matchCraftTarget(target,pieces,workspace){
  const t=index(target),w=index(workspace),n=t.atoms.length,seen=new Set(),components=[];
  for(const start of w.atoms.map((_,i)=>i).sort((a,b)=>compare(w.atoms[a].id,w.atoms[b].id))){
    if(seen.has(start))continue;const component=[start];seen.add(start);
    for(let k=0;k<component.length;k++)for(const j of w.edges[component[k]].keys())if(!seen.has(j)){seen.add(j);component.push(j);}
    if(component.length>n)continue;
    const candidates=new Map(component.map(i=>[i,t.atoms.flatMap((a,j)=>a.element===w.atoms[i].element&&t.edges[j].size>=w.edges[i].size?[j]:[])]));
    const order=[...component].sort((a,b)=>candidates.get(a).length-candidates.get(b).length||w.edges[b].size-w.edges[a].size||compare(w.atoms[a].id,w.atoms[b].id));
    if(order.some(i=>!candidates.get(i).length))continue;
    const mapping=new Map(),inverse=Array(n).fill(-1),options=new Map();
    // Identical leaves are interchangeable; don't enumerate their factorial
    // permutations (the lowest workspace ID gets the lowest target index).
    const twin=(a,b)=>w.atoms[a].element===w.atoms[b].element&&w.edges[a].size===w.edges[b].size&&[...w.edges[a]].every(([j,o])=>w.edges[b].get(j)===o);
    function embed(depth,mask){
      if(depth===order.length){
        const satisfied=[];let coverage=0;
        pieces.forEach((p,i)=>{if(p.atomIndices.every(a=>inverse[a]>=0&&p.atomIndices.every(b=>(t.edges[a].get(b)??0)===(w.edges[inverse[a]].get(inverse[b])??0)))){satisfied.push(i);coverage+=p.atomIndices.length;}});
        if(!coverage)return;
        const key=`${mask}:${satisfied.join(',')}`;if(!options.has(key))options.set(key,{mask,satisfied,coverage,assignments:[...mapping].map(([wi,ti])=>({targetIndex:ti,workspaceAtomId:w.atoms[wi].id})).sort((a,b)=>a.targetIndex-b.targetIndex)});return;
      }
      const wi=order[depth];
      for(const ti of candidates.get(wi)){
        if(mask&bit(ti))continue;
        if([...mapping].some(([wj,tj])=>(w.edges[wi].has(wj)&&w.edges[wi].get(wj)!==t.edges[ti].get(tj))||(twin(wi,wj)&&ti<tj)))continue;
        mapping.set(wi,ti);inverse[ti]=wi;embed(depth+1,mask|bit(ti));mapping.delete(wi);inverse[ti]=-1;
      }
    }
    embed(0,0n);
    const choices=[...options.values()].sort((a,b)=>b.coverage-a.coverage||b.satisfied.length-a.satisfied.length||compare(String(a.mask),String(b.mask)));
    if(choices.length)components.push(choices);
  }
  components.sort((a,b)=>b[0].coverage-a[0].coverage);
  const remaining=Array(components.length+1).fill(0),remainingCount=[...remaining];for(let i=components.length-1;i>=0;i--){remaining[i]=remaining[i+1]+components[i][0].coverage;remainingCount[i]=remainingCount[i+1]+Math.max(...components[i].map(o=>o.satisfied.length));}
  let best={coverage:0,satisfied:[],assignments:[]};const memo=new Map();
  function search(i,mask,coverage,satisfied,assignments){
    if(coverage>best.coverage||coverage===best.coverage&&satisfied.length>best.satisfied.length)best={coverage,satisfied,assignments};
    if(best.coverage===n||i===components.length||coverage+remaining[i]<best.coverage||coverage+remaining[i]===best.coverage&&satisfied.length+remainingCount[i]<=best.satisfied.length)return;
    const key=`${i}:${mask}`,score=memo.get(key);if(score&&(score[0]>coverage||score[0]===coverage&&score[1]>=satisfied.length))return;memo.set(key,[coverage,satisfied.length]);
    for(const option of components[i])if(!(mask&option.mask))search(i+1,mask|option.mask,coverage+option.coverage,[...satisfied,...option.satisfied],[...assignments,...option.assignments]);
    search(i+1,mask,coverage,satisfied,assignments);
  }
  search(0,0n,0,[],[]);
  const satisfiedSet=new Set(best.satisfied);
  return {satisfiedPieces:pieces.filter((_,i)=>satisfiedSet.has(i)),unsatisfiedPieces:pieces.filter((_,i)=>!satisfiedSet.has(i)),assignments:best.assignments.sort((a,b)=>a.targetIndex-b.targetIndex)};
}
