// Construct a display-only reference whose first four repeat units retain the
// actual sample's atom positions. Never modify either input graph or coordinates.
export function connectPolyethyleneReference(THREE,finite,reference,units=4){
  const fail=()=>{throw new Error('polyethylene-reference-graph-mismatch');};
  if(units!==4||reference.polymerId!=='polyethylene'||reference.unitCount<5)fail();
  function adjacency(graph){
    const adj=graph.atoms.map(()=>[]);
    for(const b of graph.bonds){if(b.order!==1||!adj[b.a]||!adj[b.b]||b.a===b.b)fail();adj[b.a].push(b.b);adj[b.b].push(b.a);}
    return adj;
  }
  const fa=adjacency(finite),ra=adjacency(reference);
  function carbonPath(graph,adj,start){
    const carbon=graph.atoms.map((a,i)=>a.element==='C'?i:-1).filter(i=>i>=0);
    const ends=carbon.filter(i=>adj[i].filter(j=>graph.atoms[j].element==='C').length===1);
    if(ends.length!==2||carbon.some(i=>adj[i].filter(j=>graph.atoms[j].element==='C').length>2))fail();
    let cur=start??ends[0],prev=-1;const path=[];
    while(cur!==undefined){if(path.includes(cur))fail();path.push(cur);const next=adj[cur].filter(j=>j!==prev&&graph.atoms[j].element==='C');if(next.length>1)fail();prev=cur;cur=next[0];}
    if(path.length!==carbon.length)fail();return path;
  }
  const fp=carbonPath(finite,fa),start=reference.atoms.findIndex(a=>a.element==='C'&&a.unit===0&&ra[a.id].filter(i=>reference.atoms[i].element==='C').length===1),rp=carbonPath(reference,ra,start);
  if(fp.length!==8||rp.length!==reference.unitCount*2||finite.atoms.length!==24||finite.bonds.length!==23||start<0)fail();
  const hs=(graph,adj,i)=>adj[i].filter(j=>graph.atoms[j].element==='H');
  if(fp.some(i=>hs(finite,fa,i).length!==2)||finite.atoms.some(a=>!['C','H'].includes(a.element)))fail();
  if(rp.slice(0,8).some((i,k)=>hs(reference,ra,i).length!==(k===0?3:2)))fail();
  const p=(graph,i)=>new THREE.Vector3(graph.atoms[i].x,graph.atoms[i].y,graph.atoms[i].z);
  const last=fp[7],end=p(finite,last),prev=p(finite,fp[6]),hydrogens=hs(finite,fa,last);
  const out=prev.clone().sub(end).normalize();for(const h of hydrogens)out.add(p(finite,h).sub(end).normalize());out.negate();if(out.lengthSq()<1e-8)fail();out.normalize();
  const refEnd=p(reference,rp[7]),refNext=p(reference,rp[8]);
  const q=new THREE.Quaternion().setFromUnitVectors(refNext.clone().sub(refEnd).normalize(),out);
  // Rotate about the outgoing bond so the previous backbone bond has the same azimuth.
  const projected=v=>v.addScaledVector(out,-v.dot(out));
  const u=projected(p(reference,rp[6]).sub(refEnd).applyQuaternion(q)),v=projected(prev.clone().sub(end));
  if(u.lengthSq()>1e-8&&v.lengthSq()>1e-8){u.normalize();v.normalize();const angle=Math.atan2(out.dot(new THREE.Vector3().crossVectors(u,v)),u.dot(v));q.premultiply(new THREE.Quaternion().setFromAxisAngle(out,angle));}
  // Twist only around the new bond, retaining its endpoint and length. Choose
  // the least crowded placement for unit five against the actual sample.
  let bestQ=null,bestGap=-Infinity;
  const fifth=reference.atoms.filter(a=>a.unit===4);
  for(let step=0;step<16;step++){
    const candidate=new THREE.Quaternion().setFromAxisAngle(out,step*Math.PI/8).multiply(q),points=fifth.map(a=>new THREE.Vector3(a.x,a.y,a.z).sub(refEnd).applyQuaternion(candidate).add(end));let gap=Infinity;
    for(let i=0;i<fifth.length;i++)for(let f=0;f<finite.atoms.length;f++){
      if(fifth[i].id===rp[8]&&f===last)continue;
      gap=Math.min(gap,points[i].distanceTo(p(finite,f)));
    }
    if(gap>bestGap){bestGap=gap;bestQ=candidate;}
  }
  if(bestGap<.7)fail();
  const transformed=reference.atoms.map(a=>new THREE.Vector3(a.x,a.y,a.z).sub(refEnd).applyQuaternion(bestQ).add(end));
  const map=new Map();for(let k=0;k<8;k++){
    map.set(rp[k],fp[k]);const rh=hs(reference,ra,rp[k]),fh=hs(finite,fa,fp[k]);
    // At the first end the reference includes an illustrative extra cap. Pick
    // the two hydrogens which best match the actual pair, then omit the cap.
    let best=null;for(const a of rh)for(const b of rh)if(a!==b){const score=transformed[a].distanceToSquared(p(finite,fh[0]))+transformed[b].distanceToSquared(p(finite,fh[1]));if(!best||score<best.score)best={a,b,score};}
    if(!best)fail();map.set(best.a,fh[0]);map.set(best.b,fh[1]);
  }
  const omitted=hs(reference,ra,rp[0]).find(i=>!map.has(i));if(omitted===undefined)fail();
  const oldToNew=new Map(),atoms=[];for(const a of reference.atoms){if(a.id===omitted)continue;const point=map.has(a.id)?p(finite,map.get(a.id)):transformed[a.id];if(!Number.isFinite(point.x+point.y+point.z))fail();oldToNew.set(a.id,atoms.length);atoms.push({...a,id:atoms.length,x:point.x,y:point.y,z:point.z});}
  const bonds=reference.bonds.filter(b=>b.a!==omitted&&b.b!==omitted).map(b=>({...b,a:oldToNew.get(b.a),b:oldToNew.get(b.b)}));
  const matched=[...map].map(([r,f])=>({reference:oldToNew.get(r),finite:f}));
  return {plan:{...reference,atoms,bonds,aromaticCycles:[]},matched,bridge:{a:oldToNew.get(rp[7]),b:oldToNew.get(rp[8])}};
}
