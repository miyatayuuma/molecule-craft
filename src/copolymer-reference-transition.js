// Join the actual finite copolymer to the illustrative tail without
// replacing its real sequence, graph, atom identities, or coordinates.
export function connectCopolymerReference(THREE,finite,reference,units=3){
 const fail=()=>{throw Error('copolymer-reference-graph-mismatch');};
 if(units!==3||reference.unitCount<=units||!Number.isInteger(finite.activeEndAtom)||!Array.isArray(finite.actualSequence)||finite.actualSequence.length!==units)fail();
 const adj=g=>{const rows=g.atoms.map(()=>[]);for(const b of g.bonds){rows[b.a].push({i:b.b,order:b.order});rows[b.b].push({i:b.a,order:b.order});}return rows;};
 const fa=adj(finite),end=finite.activeEndAtom;if(finite.atoms[end]?.element!=='C'||fa[end].reduce((s,n)=>s+n.order,0)!==3)fail();
 const cuts=reference.bonds.filter(b=>reference.atoms[b.a].unit===units-1&&reference.atoms[b.b].unit===units||reference.atoms[b.b].unit===units-1&&reference.atoms[b.a].unit===units);if(cuts.length!==1||cuts[0].order!==1)fail();
 const cut=cuts[0],old=reference.atoms[cut.a].unit===units-1?cut.a:cut.b,next=old===cut.a?cut.b:cut.a;
 const point=(g,i)=>new THREE.Vector3(g.atoms[i].x,g.atoms[i].y,g.atoms[i].z),origin=point(finite,end),out=new THREE.Vector3();
 for(const n of fa[end])out.sub(point(finite,n.i).sub(origin).normalize().multiplyScalar(n.order));if(out.lengthSq()<1e-8)fail();out.normalize();
 const referenceOrigin=point(reference,old),axis=point(reference,next).sub(referenceOrigin).normalize(),first=reference.atoms.map((a,i)=>a.unit===units?i:-1).filter(i=>i>=0);let best=null;
 const tryDirection=direction=>{const base=new THREE.Quaternion().setFromUnitVectors(axis,direction);for(let step=0;step<48;step++){
  const q=new THREE.Quaternion().setFromAxisAngle(direction,step*Math.PI/24).multiply(base),transform=i=>point(reference,i).sub(referenceOrigin).applyQuaternion(q).add(origin);let gap=Infinity;
  for(const i of first){const p=transform(i);for(let f=0;f<finite.atoms.length;f++)if(!(i===next&&f===end))gap=Math.min(gap,p.distanceTo(point(finite,f)));}
  if(!best||gap>best.gap)best={gap,transform};
 }};
 tryDirection(out);if(!best||best.gap<.7){const side=new THREE.Vector3(0,1,0);if(Math.abs(side.dot(out))>.9)side.set(1,0,0);side.cross(out).normalize();const other=new THREE.Vector3().crossVectors(out,side).normalize();for(const angle of [10,20,30]){for(let i=0;i<12;i++){const a=i*Math.PI/6,t=angle*Math.PI/180;tryDirection(out.clone().multiplyScalar(Math.cos(t)).addScaledVector(side,Math.sin(t)*Math.cos(a)).addScaledVector(other,Math.sin(t)*Math.sin(a)).normalize());}if(best?.gap>=.7)break;}}
 if(!best||best.gap<.7)fail();
 const atoms=finite.atoms.map((a,i)=>({...a,id:i,unit:units-1})),bonds=finite.bonds.map(b=>({...b})),map=new Map();
 for(let i=0;i<reference.atoms.length;i++)if(reference.atoms[i].unit>=units){const p=best.transform(i);map.set(i,atoms.length);atoms.push({...reference.atoms[i],id:atoms.length,x:p.x,y:p.y,z:p.z});}
 for(const b of reference.bonds)if(map.has(b.a)&&map.has(b.b))bonds.push({...b,a:map.get(b.a),b:map.get(b.b)});
 const bridge={a:end,b:map.get(next)};bonds.push({...bridge,order:1});
 const aromaticCycles=[...(finite.aromaticCycles??[]).map(c=>[...c]),...(reference.aromaticCycles??[]).filter(c=>c.every(i=>map.has(i))).map(c=>c.map(i=>map.get(i)))];
 const sequence=[...finite.actualSequence,...reference.sequence.slice(units)],componentCounts=Object.fromEntries([...new Set(sequence)].map(k=>[k,sequence.filter(x=>x===k).length]));
 return{plan:{...reference,atoms,bonds,aromaticCycles,sequence,componentCounts},matched:finite.atoms.map((_,i)=>({finite:i,reference:i})),bridge};
}
