// Minimal formal-charge/resonance authority for explicitly supported motifs.
// This is intentionally not a general ionic-chemistry or formal-charge solver.
const pairKey=(a,b)=>String(a)<String(b)?`${a}:${b}`:`${b}:${a}`;

function graphOf(source){
  const atoms=(source?.atoms??[]).map((atom,index)=>({id:typeof atom==='string'?index:(atom?.id??index),element:typeof atom==='string'?atom:atom?.element}));
  const byIndex=atoms,byId=new Map(atoms.map(atom=>[atom.id,atom])),adjacency=new Map(atoms.map(atom=>[atom.id,[]])),bonds=[];
  for(const raw of source?.bonds??[]){
    let a,b,order;if(Array.isArray(raw)){a=byIndex[raw[0]]?.id;b=byIndex[raw[1]]?.id;order=raw[2];}else{a=raw?.a;b=raw?.b;order=raw?.order;}
    if(!byId.has(a)||!byId.has(b)||a===b||![1,2,3].includes(order))continue;
    bonds.push({a,b,order});adjacency.get(a).push({id:b,order});adjacency.get(b).push({id:a,order});
  }
  return{atoms,byId,adjacency,bonds};
}
const terminalO=(graph,id)=>graph.byId.get(id)?.element==='O'&&(graph.adjacency.get(id)?.length??0)===1;

export function supportedResonanceGroups(source){
  const graph=graphOf(source),groups=[];
  for(const center of graph.atoms){
    const ns=graph.adjacency.get(center.id)??[];
    if(center.element==='N'&&ns.length===3){
      const oxo=ns.filter(n=>terminalO(graph,n.id)),other=ns.filter(n=>!oxo.includes(n));
      const orders=oxo.map(n=>n.order).sort((a,b)=>a-b);
      if(oxo.length===2&&other.length===1&&graph.byId.get(other[0].id)?.element==='C'&&other[0].order===1&&orders[0]===1&&orders[1]===2){
        const negative=oxo.find(n=>n.order===1).id;
        groups.push({kind:'nitro',center:center.id,ends:oxo.map(n=>n.id),negative,charges:new Map([[center.id,1],[negative,-1]])});
      }
    }
    if(center.element==='O'&&ns.length===2&&ns.every(n=>terminalO(graph,n.id))){
      const orders=ns.map(n=>n.order).sort((a,b)=>a-b);
      if(orders[0]===1&&orders[1]===2){
        const negative=ns.find(n=>n.order===1).id;
        groups.push({kind:'ozone',center:center.id,ends:ns.map(n=>n.id),negative,charges:new Map([[center.id,1],[negative,-1]])});
      }
    }
  }
  return groups;
}

export function supportedAtomState(source,id){
  for(const group of supportedResonanceGroups(source)){
    if(group.center===id)return group.kind==='ozone'?{charge:1,singles:0,pairs:1,kind:group.kind}:{charge:1,singles:0,pairs:0,kind:group.kind};
    if(group.negative===id)return{charge:-1,singles:0,pairs:3,kind:group.kind};
  }
  return null;
}

export function supportsResonanceBondUpgrade(source,a,b){
  const graph=graphOf(source),key=pairKey(a,b),bond=graph.bonds.find(item=>pairKey(item.a,item.b)===key);
  if(!bond||bond.order!==1)return false;
  const projected={atoms:graph.atoms,bonds:graph.bonds.map(item=>({a:item.a,b:item.b,order:item===bond?2:item.order}))};
  return supportedResonanceGroups(projected).some(group=>(group.center===a&&group.ends.includes(b))||(group.center===b&&group.ends.includes(a)));
}
