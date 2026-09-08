const STRUCTURE_ELEMENTS=new Set(['C','N','O','F','Cl']);
const TYPICAL_VALENCE=Object.freeze({H:1,C:4,N:3,O:2,F:1,Cl:1});
const BOND_SYMBOL=Object.freeze({1:'',2:'=',3:'#'});

function conservativeSmiles(graph){
  const atoms=graph?.atoms??[],bonds=graph?.bonds??[];
  if(!atoms.length)return null;
  const byId=new Map();
  for(const atom of atoms){
    if(!atom||byId.has(atom.id)||!(atom.element in TYPICAL_VALENCE))return null;
    byId.set(atom.id,atom);
  }
  const adjacency=new Map(atoms.map(atom=>[atom.id,[]]));
  for(const bond of bonds){
    if(!bond||!byId.has(bond.a)||!byId.has(bond.b)||bond.a===bond.b||!BOND_SYMBOL[bond.order]&&bond.order!==1)return null;
    adjacency.get(bond.a).push({id:bond.b,order:bond.order});
    adjacency.get(bond.b).push({id:bond.a,order:bond.order});
  }
  for(const atom of atoms){
    const edges=adjacency.get(atom.id),used=edges.reduce((sum,edge)=>sum+edge.order,0);
    if(used!==TYPICAL_VALENCE[atom.element])return null;
    if(atom.element==='H'&&(edges.length!==1||edges[0].order!==1))return null;
  }
  const heavy=atoms.filter(atom=>atom.element!=='H');
  if(!heavy.length||heavy.some(atom=>!STRUCTURE_ELEMENTS.has(atom.element)))return null;
  const heavyIds=new Set(heavy.map(atom=>atom.id));
  const heavyBonds=bonds.filter(bond=>heavyIds.has(bond.a)&&heavyIds.has(bond.b));
  if(heavy.length>1&&heavyBonds.length!==heavy.length-1)return null;
  const heavyAdjacency=new Map(heavy.map(atom=>[atom.id,[]]));
  for(const bond of heavyBonds){
    heavyAdjacency.get(bond.a).push({id:bond.b,order:bond.order});
    heavyAdjacency.get(bond.b).push({id:bond.a,order:bond.order});
  }
  if(heavy.length>1){
    const seen=new Set(),queue=[heavy[0].id];
    while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);for(const edge of heavyAdjacency.get(id))queue.push(edge.id);}
    if(seen.size!==heavy.length)return null;
  }
  for(const atom of heavy){
    if((atom.element==='F'||atom.element==='Cl')&&heavyAdjacency.get(atom.id).length===0)return null;
  }
  const atomToken=id=>byId.get(id).element;
  const sortEdges=(left,right)=>atomToken(left.id).localeCompare(atomToken(right.id))||left.order-right.order||left.id-right.id;
  const render=(id,parent=null)=>{
    const children=heavyAdjacency.get(id).filter(edge=>edge.id!==parent).sort(sortEdges);
    let value=atomToken(id);
    if(!children.length)return value;
    const main=children[children.length-1];
    for(const child of children.slice(0,-1))value+=`(${BOND_SYMBOL[child.order]}${render(child.id,id)})`;
    value+=`${BOND_SYMBOL[main.order]}${render(main.id,id)}`;
    return value;
  };
  return render([...heavy].sort((a,b)=>a.id-b.id)[0].id);
}

export function pubchemReferenceFor(structure){
  const formula=typeof structure?.formula==='string'?structure.formula.trim():'';
  if(!formula||formula==='—')return null;
  const smiles=conservativeSmiles(structure?.graph);
  const query=smiles||formula,mode=smiles?'structure':'formula';
  return Object.freeze({mode,query,url:`https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(query)}`});
}

export {conservativeSmiles};
