// The immutable finite Sample is retained by the caller. This display plan
// consumes its methylol OH and one incoming aromatic H as water.
export function connectPhenolicReference(THREE,finite,reference,units=2){
 const fail=()=>{throw Error('phenolic-reference-graph-mismatch');};
 if(units!==2||reference.ringCount!==reference.unitCount||!Array.isArray(reference.bridges)||reference.unitCount<10||finite.aromaticCycles?.length!==2)fail();
 const adjacency=g=>{const a=g.atoms.map(()=>[]);for(const b of g.bonds){a[b.a].push({i:b.b,order:b.order});a[b.b].push({i:b.a,order:b.order});}return a;};
 const fa=adjacency(finite),ra=adjacency(reference),point=(g,i)=>new THREE.Vector3(g.atoms[i].x,g.atoms[i].y,g.atoms[i].z);
 const methylols=[];for(let c=0;c<finite.atoms.length;c++)if(finite.atoms[c].element==='C'&&finite.formaldehydeOrigins?.includes(finite.atomOrigins[c]?.instanceId))for(const v of fa[c])if(v.order===1&&finite.atoms[v.i].element==='O'){const h=fa[v.i].find(x=>x.order===1&&finite.atoms[x.i].element==='H');if(h&&fa[v.i].length===2)methylols.push({carbon:c,oxygen:v.i,hydrogen:h.i});}
 if(methylols.length!==1)fail();const m=methylols[0];if(fa[m.carbon].reduce((s,n)=>s+n.order,0)!==4)fail();
 const rings=reference.aromaticCycles,tree=rings.map(()=>[]);for(const b of reference.bridges){const [a,c]=b.rings;tree[a].push(c);tree[c].push(a);}
 if(rings.length!==reference.unitCount||reference.bridges.length!==rings.length-1)fail();
 // The originally selected leaf can collide with the real finite pose.
 // Keep the chemical and steric gates, but search other reference leaves.
 const eligibleRoots=tree.map((edges,i)=>edges.length===1&&[1,3,5].some(k=>ra[rings[i][k]].some(n=>reference.atoms[n.i].element==='H'))?i:-1).filter(i=>i>=0);
 if(!eligibleRoots.length)fail();
 const rootCandidates=[...new Set([0,.25,.5,.75,1].map(q=>eligibleRoots[Math.floor(q*(eligibleRoots.length-1))]))];
 let selected=null;
 for(const root of rootCandidates){
 const order=[root],seen=new Set(order);for(let i=0;i<order.length;i++)for(const child of tree[order[i]])if(!seen.has(child)){seen.add(child);order.push(child);}
 if(order.length!==rings.length)fail();const keep=order.slice(0,reference.unitCount-units),kept=new Set(keep),rank=new Map(keep.map((id,i)=>[id,i+units]));
 let port=null;for(const k of [1,3,5]){const carbon=rings[root][k],h=ra[carbon].find(n=>n.order===1&&reference.atoms[n.i].element==='H');if(h){port={carbon,hydrogen:h.i};break;}}if(!port)fail();
 const removedReference=new Set([port.hydrogen]),bridgeUnit=new Map(),caps=[];
 for(const b of reference.bridges){const [a,c]=b.rings,ka=kept.has(a),kc=kept.has(c);const hydrogens=ra[b.atom].filter(n=>reference.atoms[n.i].element==='H').map(n=>n.i);
  if(ka&&kc){const u=Math.max(rank.get(a),rank.get(c));bridgeUnit.set(b.atom,u);for(const h of hydrogens)bridgeUnit.set(h,u);}
  else if(ka||kc){removedReference.add(b.atom);for(const h of hydrogens)removedReference.add(h);const ring=ka?a:c,site=ka?b.sites[0]:b.sites[1];caps.push({ring,carbon:rings[ring][site],toward:b.atom});}
 }
 const origin=point(finite,m.carbon),axis=point(finite,m.oxygen).sub(origin).normalize(),refPoint=point(reference,port.carbon),refOut=point(reference,port.hydrogen).sub(refPoint).normalize();if(axis.lengthSq()<.9||refOut.lengthSq()<.9)fail();
 const destination=origin.clone().addScaledVector(axis,1.51*.78),base=new THREE.Quaternion().setFromUnitVectors(refOut,axis.clone().negate());let best=null;
 const rootAtoms=reference.atoms.map((a,i)=>a.unit===root&&!removedReference.has(i)?i:-1).filter(i=>i>=0),tailHeavy=reference.atoms.map((a,i)=>kept.has(a.unit)&&!removedReference.has(i)&&a.element!=='H'?i:-1).filter(i=>i>=0),finiteHeavy=finite.atoms.map((a,i)=>a.element!=='H'&&!removedFiniteCandidate(i)?i:-1).filter(i=>i>=0);function removedFiniteCandidate(i){return i===m.oxygen||i===m.hydrogen;}
 for(let step=0;step<72;step++){const q=new THREE.Quaternion().setFromAxisAngle(axis,step*Math.PI/36).multiply(base),transform=i=>point(reference,i).sub(refPoint).applyQuaternion(q).add(destination);let gap=Infinity;
  for(const i of rootAtoms){const p=transform(i);for(let f=0;f<finite.atoms.length;f++)if(f!==m.oxygen&&f!==m.hydrogen&&!(i===port.carbon&&f===m.carbon))gap=Math.min(gap,p.distanceTo(point(finite,f)));}
  let penalty=0;for(const i of tailHeavy){const p=transform(i);for(const f of finiteHeavy)if(!(i===port.carbon&&f===m.carbon)){const d=p.distanceTo(point(finite,f));if(d<1.05)penalty+=(1.05-d)**2;}}
  if(!best||penalty<best.penalty-1e-9||(Math.abs(penalty-best.penalty)<1e-9&&gap>best.gap))best={gap,penalty,transform};
 }
 if(best&&best.gap>=.7&&best.penalty<=.1){selected={keep,kept,rank,port,removedReference,bridgeUnit,caps,best};break;}
 }
 if(!selected)fail();
 const {keep,kept,rank,port,removedReference,bridgeUnit,caps,best}=selected;
 const removedFinite=[m.oxygen,m.hydrogen],atoms=[],bonds=[],fm=new Map(),rm=new Map();
 for(let i=0;i<finite.atoms.length;i++)if(!removedFinite.includes(i)){fm.set(i,atoms.length);atoms.push({...finite.atoms[i],id:atoms.length,unit:units-1});}
 for(const b of finite.bonds)if(fm.has(b.a)&&fm.has(b.b))bonds.push({...b,a:fm.get(b.a),b:fm.get(b.b)});
 for(let i=0;i<reference.atoms.length;i++){const a=reference.atoms[i];if(!kept.has(a.unit)||removedReference.has(i))continue;const p=best.transform(i);rm.set(i,atoms.length);atoms.push({...a,id:atoms.length,unit:bridgeUnit.get(i)??rank.get(a.unit),x:p.x,y:p.y,z:p.z});}
 for(const b of reference.bonds)if(rm.has(b.a)&&rm.has(b.b))bonds.push({...b,a:rm.get(b.a),b:rm.get(b.b)});
 for(const cap of caps){if(!rm.has(cap.carbon))fail();const p=best.transform(cap.carbon),dir=best.transform(cap.toward).sub(p).normalize(),h=atoms.length,v=p.clone().addScaledVector(dir,1.09*.78);atoms.push({id:h,element:'H',unit:rank.get(cap.ring),x:v.x,y:v.y,z:v.z});bonds.push({a:rm.get(cap.carbon),b:h,order:1});}
 const bridge={a:fm.get(m.carbon),b:rm.get(port.carbon)};bonds.push({...bridge,order:1});
 const aromaticCycles=[...finite.aromaticCycles.map(c=>c.map(i=>fm.get(i))),...keep.map(i=>rings[i].map(j=>rm.get(j)))];
 if(aromaticCycles.some(c=>c.some(i=>!Number.isInteger(i))))fail();
 const ringByAtom=new Map();aromaticCycles.forEach((cycle,i)=>cycle.forEach(j=>ringByAtom.set(j,i)));const graph={atoms,bonds},ga=adjacency(graph),bridges=[];
 for(let i=0;i<atoms.length;i++)if(atoms[i].element==='C'&&!ringByAtom.has(i)){const ringNeighbors=ga[i].filter(n=>n.order===1&&ringByAtom.has(n.i));if(ringNeighbors.length===2)bridges.push({atom:i,rings:ringNeighbors.map(n=>ringByAtom.get(n.i)),sites:ringNeighbors.map(n=>n.i)});}
 if(bridges.length!==reference.unitCount-1||new Set(bridges.flatMap(b=>b.sites)).size!==bridges.length*2)fail();
 return {plan:{...reference,atoms,bonds,aromaticCycles,bridges,initialFiniteUnits:units,ringCount:reference.unitCount},matched:[...fm].map(([finite,reference])=>({finite,reference})),bridge,removedFinite,water:{finite:[m.oxygen,m.hydrogen],incoming:[port.hydrogen]},reactionPreview:{carbon:fm.get(m.carbon),oxygen:{...finite.atoms[m.oxygen]},hydrogen:{...finite.atoms[m.hydrogen]},disappearAt:units+1}};
}
