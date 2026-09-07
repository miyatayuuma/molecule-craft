// Pure exact cover of explicit-atom graphs (the craft template/record format).
// Atom indices in each result follow the template's atom order. Repeated copies
// of an available template are allowed; availability is not a part inventory.
function graph(record){
  if(!Array.isArray(record?.atoms)||!Array.isArray(record.bonds))throw Error('Invalid part graph');
  const atoms=record.atoms.map(a=>typeof a==='string'?a:a.element),ids=new Map(record.atoms.map((a,i)=>[typeof a==='string'?i:a.id,i]));
  const edges=atoms.map(()=>Array(atoms.length).fill(0));
  for(const bond of record.bonds){
    const [a,b,order]=Array.isArray(bond)?bond:[ids.get(bond.a),ids.get(bond.b),bond.order];
    if(!Number.isInteger(a)||!Number.isInteger(b)||!edges[a]||!edges[b]||a===b||![1,2,3].includes(order)||edges[a][b])throw Error('Invalid part bond');
    edges[a][b]=edges[b][a]=order;
  }
  return {atoms,edges};
}
const compare=(a,b)=>a<b?-1:a>b?1:0;
const rank=(a,b)=>b.atomIndices.length-a.atomIndices.length||compare(a.partId??'',b.partId??'')||compare(a.atomIndices.join(','),b.atomIndices.join(','));
function better(a,b){
  if(!b||a.length!==b.length)return !b||a.length<b.length;
  for(let i=0;i<a.length;i++){const difference=a[i].atomIndices.length-b[i].atomIndices.length;if(difference)return difference>0;}
  for(let i=0;i<a.length;i++){const difference=rank(a[i],b[i]);if(difference)return difference<0;}
  return false;
}

export function decomposeTargetIntoAvailableParts(target,unlockedParts=[]){
  const t=graph(target),n=t.atoms.length,options=Array.from({length:n},(_,i)=>[{partId:null,element:t.atoms[i],atomIndices:[i],mask:1n<<BigInt(i)}]);
  for(const template of [...unlockedParts].sort((a,b)=>compare(a.id,b.id))){
    if(typeof template.id!=='string'||!template.id)throw Error('Part id required');
    const p=graph(template),size=p.atoms.length;
    if(size<2||size>=n)continue; // A complete target must never be dispensed as one part.
    const candidates=p.atoms.map((el,i)=>t.atoms.flatMap((other,j)=>el===other&&p.edges[i].filter(Boolean).length<=t.edges[j].filter(Boolean).length?[j]:[]));
    const order=p.atoms.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length||p.edges[b].filter(Boolean).length-p.edges[a].filter(Boolean).length||a-b);
    const mapping=Array(size).fill(-1),seen=new Set();
    function match(depth,mask){
      if(depth===size){
        const key=String(mask);if(seen.has(key))return;seen.add(key);
        const option={partId:template.id,atomIndices:[...mapping],mask};for(const i of mapping)options[i].push(option);return;
      }
      const node=order[depth];
      for(const i of candidates[node]){
        const bit=1n<<BigInt(i);if(mask&bit)continue;
        // Induced matching also rejects extra internal target bonds.
        if(mapping.some((j,k)=>j>=0&&p.edges[node][k]!==t.edges[i][j]))continue;
        mapping[node]=i;match(depth+1,mask|bit);mapping[node]=-1;
      }
    }
    match(0,0n);
  }
  for(const list of options)list.sort(rank);
  const memo=new Map(),full=(1n<<BigInt(n))-1n;
  function solve(remaining){
    if(!remaining)return [];if(memo.has(remaining))return memo.get(remaining);
    let pivot=0;while(!(remaining&(1n<<BigInt(pivot))))pivot++;
    let best=null;
    for(const option of options[pivot]){
      if((remaining&option.mask)!==option.mask)continue;
      const result=[option,...solve(remaining^option.mask)].sort(rank);if(better(result,best))best=result;
    }
    memo.set(remaining,best);return best;
  }
  return solve(full).map(({mask,...part})=>part);
}
