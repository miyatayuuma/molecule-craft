// Display-only continuation. The finite source is never mutated. The graph
// isomorphism establishes every retained atom and bond before a tail is used.
export function connectCondensationDieneReference(THREE,finite,reference,units=4){
 const fail=()=>{throw Error('continuation-reference-graph-mismatch');};
 if(units!==4||reference.unitCount<5)fail();
 const ester=['polylactic-acid','polyglycolic-acid'].includes(reference.polymerId);
 const adjacency=g=>{const a=g.atoms.map(()=>[]);for(const b of g.bonds){a[b.a].push({i:b.b,order:b.order});a[b.b].push({i:b.a,order:b.order});}return a;};
 const fa=adjacency(finite),ra=adjacency(reference),unit=i=>reference.atoms[i].unit;
 const cuts=reference.bonds.filter(b=>unit(b.a)===3&&unit(b.b)===4||unit(b.b)===3&&unit(b.a)===4);
 if(cuts.length!==1||cuts[0].order!==1)fail();
 const cut=cuts[0],old=unit(cut.a)===3?cut.a:cut.b,next=old===cut.a?cut.b:cut.a;
 const prefix=reference.atoms.map((a,i)=>a.unit<4?i:-1).filter(i=>i>=0);
 const candidates=[];
 if(ester){
   for(let i=0;i<finite.atoms.length;i++)if(finite.atoms[i].element==='C'&&fa[i].some(n=>n.order===2&&finite.atoms[n.i].element==='O'))for(const n of fa[i]){
     if(n.order!==1||finite.atoms[n.i].element!=='O')continue;
     const h=fa[n.i].filter(x=>x.order===1&&finite.atoms[x.i].element==='H');
     if(fa[n.i].length===2&&h.length===1)candidates.push({end:i,removeFinite:new Set([n.i,h[0].i]),removeReference:new Set(),water:{finite:[n.i,h[0].i],incomingHydrogen:1}});
   }
 }else{
   const ends=finite.atoms.map((a,i)=>({i,a,degree:fa[i].reduce((s,n)=>s+n.order,0)})).filter(({a,degree})=>degree===({C:4,O:2})[a.element]-1&&a.element===reference.atoms[old].element);
   // The reference is capped at its outer end, while finite addition products
   // have an open valence. Try each first-unit H and prove the whole graph.
   const caps=prefix.filter(i=>reference.atoms[i].element==='H'&&ra[i].length===1&&unit(ra[i][0].i)===0);
   for(const end of ends)for(const h of caps)candidates.push({end:end.i,removeFinite:new Set(),removeReference:new Set([h])});
 }
 function match(c){
   const fs=finite.atoms.map((_,i)=>i).filter(i=>!c.removeFinite.has(i)),rs=prefix.filter(i=>!c.removeReference.has(i));
   if(fs.length!==rs.length)return null;
   const fset=new Set(fs),rset=new Set(rs),fn=i=>fa[i].filter(n=>fset.has(n.i)),rn=i=>ra[i].filter(n=>rset.has(n.i));
   const sig=(g,neighbors,i)=>`${g.atoms[i].element}|${neighbors(i).map(n=>`${g.atoms[n.i].element}:${n.order}`).sort().join(',')}`;
   const fSig=fs.map(i=>sig(finite,fn,i)),rSig=new Map(rs.map(i=>[i,sig(reference,rn,i)]));
   if(fSig[fs.indexOf(c.end)]!==rSig.get(old))return null;
   const map=new Map([[c.end,old]]),used=new Set([old]);
   function visit(){
     if(map.size===fs.length)return true;
     let choice=null,options=null;
     for(const f of fs)if(!map.has(f)){
       const mapped=fn(f).filter(n=>map.has(n.i));if(!mapped.length)continue;
       const opts=rs.filter(r=>!used.has(r)&&rSig.get(r)===fSig[fs.indexOf(f)]&&mapped.every(n=>rn(r).some(x=>x.i===map.get(n.i)&&x.order===n.order)));
       if(!options||opts.length<options.length){choice=f;options=opts;if(!opts.length)break;}
     }
     if(choice===null||!options.length)return false;
     for(const r of options){map.set(choice,r);used.add(r);if(visit())return true;used.delete(r);map.delete(choice);}return false;
   }
   return visit()?map:null;
 }
 const p=(g,i)=>new THREE.Vector3(g.atoms[i].x,g.atoms[i].y,g.atoms[i].z);let best=null;
 for(const c of candidates){const mapping=match(c);if(!mapping)continue;
   const origin=p(finite,c.end),out=new THREE.Vector3();
   for(const n of fa[c.end])if(!c.removeFinite.has(n.i))out.sub(p(finite,n.i).sub(origin).normalize().multiplyScalar(n.order));
   if(out.lengthSq()<1e-8)continue;out.normalize();
   const refOrigin=p(reference,old),base=new THREE.Quaternion().setFromUnitVectors(p(reference,next).sub(refOrigin).normalize(),out);
   for(let step=0;step<48;step++){
     const q=new THREE.Quaternion().setFromAxisAngle(out,step*Math.PI/24).multiply(base),transform=i=>p(reference,i).sub(refOrigin).applyQuaternion(q).add(origin);
     const fifth=reference.atoms.map((a,i)=>a.unit===4?i:-1).filter(i=>i>=0);let gap=Infinity;
     for(const i of fifth){const v=transform(i);for(let f=0;f<finite.atoms.length;f++)if(!c.removeFinite.has(f)&&!(i===next&&f===c.end))gap=Math.min(gap,v.distanceTo(p(finite,f)));}
     if(!best||gap>best.gap)best={...c,mapping,transform,gap};
   }
 }
 if(!best||best.gap<.7)fail();
 const atoms=[],bonds=[],finiteToPlan=new Map(),refToPlan=new Map();
 for(let i=0;i<finite.atoms.length;i++)if(!best.removeFinite.has(i)){finiteToPlan.set(i,atoms.length);atoms.push({...finite.atoms[i],id:atoms.length,unit:3});}
 for(const b of finite.bonds)if(finiteToPlan.has(b.a)&&finiteToPlan.has(b.b))bonds.push({...b,a:finiteToPlan.get(b.a),b:finiteToPlan.get(b.b)});
 for(let i=0;i<reference.atoms.length;i++)if(unit(i)>=4){const v=best.transform(i);refToPlan.set(i,atoms.length);atoms.push({...reference.atoms[i],id:atoms.length,x:v.x,y:v.y,z:v.z});}
 for(const b of reference.bonds)if(refToPlan.has(b.a)&&refToPlan.has(b.b))bonds.push({...b,a:refToPlan.get(b.a),b:refToPlan.get(b.b)});
 const bridge={a:finiteToPlan.get(best.end),b:refToPlan.get(next)};bonds.push({...bridge,order:1});
 const matched=[...best.mapping].map(([f,r])=>({finite:f,reference:finiteToPlan.get(f),prefixReference:r}));
 return{plan:{...reference,atoms,bonds,aromaticCycles:[]},matched,bridge,removedFinite:[...best.removeFinite],water:best.water??null};
}
