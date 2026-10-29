// Preserve the finite graph verbatim; extend its open backbone valence using
// the corresponding cut in the illustrative reference chain.
export function connectVinylPolymerReference(THREE,finite,reference,units=4){
  const fail=()=>{throw Error('vinyl-reference-graph-mismatch');};
  if(units!==4||reference.unitCount<5)fail();
  const adjacency=g=>{const a=g.atoms.map(()=>[]);for(const b of g.bonds){if(!a[b.a]||!a[b.b])fail();a[b.a].push({i:b.b,order:b.order});a[b.b].push({i:b.a,order:b.order});}return a;};
  const fa=adjacency(finite),ra=adjacency(reference),point=(g,i)=>new THREE.Vector3(g.atoms[i].x,g.atoms[i].y,g.atoms[i].z);
  const signature=(g,adj,i,exclude=-1)=>adj[i].filter(n=>n.i!==exclude).map(n=>`${g.atoms[n.i].element}:${n.order}`).sort().join(',');
  const ends=finite.atoms.map((a,i)=>a.element==='C'&&fa[i].reduce((s,n)=>s+n.order,0)===3?i:-1).filter(i=>i>=0);
  let best=null;
  for(const reverse of [false,true]){
    const unit=i=>reverse?reference.unitCount-1-reference.atoms[i].unit:reference.atoms[i].unit;
    const cuts=reference.bonds.filter(b=>(unit(b.a)===3&&unit(b.b)===4)||(unit(b.b)===3&&unit(b.a)===4));
    if(cuts.length!==1||cuts[0].order!==1)continue;
    const cut=cuts[0],old=unit(cut.a)===3?cut.a:cut.b,next=old===cut.a?cut.b:cut.a;
    for(const end of ends){
      if(signature(finite,fa,end)!==signature(reference,ra,old,next))continue;
      const origin=point(finite,end),out=new THREE.Vector3();for(const n of fa[end])out.sub(point(finite,n.i).sub(origin).normalize().multiplyScalar(n.order));
      if(out.lengthSq()<1e-8)continue;out.normalize();
      const refOrigin=point(reference,old),axis=point(reference,next).sub(refOrigin).normalize(),base=new THREE.Quaternion().setFromUnitVectors(axis,out);
      for(let step=0;step<48;step++){
        const q=new THREE.Quaternion().setFromAxisAngle(out,step*Math.PI/24).multiply(base);
        const transform=i=>point(reference,i).sub(refOrigin).applyQuaternion(q).add(origin);
        const fifth=reference.atoms.map((a,i)=>unit(i)===4?i:-1).filter(i=>i>=0),positions=fifth.map(transform);let gap=Infinity;
        for(let i=0;i<fifth.length;i++)for(let j=0;j<finite.atoms.length;j++)if(!(fifth[i]===next&&j===end))gap=Math.min(gap,positions[i].distanceTo(point(finite,j)));
        if(!best||gap>best.gap)best={gap,end,next,unit,transform};
      }
    }
  }
  if(!best||best.gap<.7)fail();
  const atoms=finite.atoms.map((a,i)=>({...a,id:i,unit:3})),bonds=finite.bonds.map(b=>({...b})),map=new Map();
  for(let i=0;i<reference.atoms.length;i++)if(best.unit(i)>=4){const p=best.transform(i);map.set(i,atoms.length);atoms.push({...reference.atoms[i],id:atoms.length,unit:best.unit(i),x:p.x,y:p.y,z:p.z});}
  for(const b of reference.bonds)if(map.has(b.a)&&map.has(b.b))bonds.push({...b,a:map.get(b.a),b:map.get(b.b)});
  const bridge={a:best.end,b:map.get(best.next)};bonds.push({...bridge,order:1});
  const aromaticCycles=(reference.aromaticCycles??[]).filter(c=>c.every(i=>map.has(i))).map(c=>c.map(i=>map.get(i)));
  return{plan:{...reference,atoms,bonds,aromaticCycles},matched:finite.atoms.map((_,i)=>({finite:i,reference:i})),bridge};
}
