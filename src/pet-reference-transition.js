// Connect a four-monomer alternating condensation Sample to a display-only tail.
// Reference repeats contain an acid and a donor; growth steps are monomers.
export function connectPetReference(THREE, finite, reference, units=4) {
  const amide=['polyethylene-adipamide','nylon-6-6'].includes(reference.polymerId);
  const donor=amide?'N':'O';
  const growthUnits=reference.unitCount*2;
  const fail=()=>{throw Error('pet-continuation-graph-mismatch');};
  if(units!==4||!['polyethylene-terephthalate','polyethylene-adipate','polyethylene-adipamide','nylon-6-6'].includes(reference.polymerId)||reference.unitCount<5)fail();
  const adjacency=g=>{const a=g.atoms.map(()=>[]);for(const b of g.bonds){a[b.a].push({i:b.b,order:b.order});a[b.b].push({i:b.a,order:b.order});}return a;};
  const fa=adjacency(finite),ra=adjacency(reference),element=(g,i)=>g.atoms[i].element;
  const carbonyl=(g,adj,i)=>element(g,i)==='C'&&adj[i].some(n=>n.order===2&&element(g,n.i)==='O');
  // Cutting each acyl-donor bond separates the reference into monomer-derived
  // components. The first component is glycol; start at the following acid.
  const ester=reference.bonds.filter(b=>b.order===1&&((carbonyl(reference,ra,b.a)&&element(reference,b.b)===donor&&ra[b.b].some(n=>n.i!==b.a&&element(reference,n.i)==='C'))||(carbonyl(reference,ra,b.b)&&element(reference,b.a)===donor&&ra[b.a].some(n=>n.i!==b.b&&element(reference,n.i)==='C'))));
  const key=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`,cuts=new Set(ester.map(b=>key(b.a,b.b))),component=reference.atoms.map(()=>-1),groups=[];
  for(let i=0;i<component.length;i++)if(component[i]<0){const id=groups.length,q=[i];component[i]=id;for(let j=0;j<q.length;j++)for(const n of ra[q[j]])if(!cuts.has(key(q[j],n.i))&&component[n.i]<0){component[n.i]=id;q.push(n.i);}groups.push(q);}
  const links=groups.map(()=>[]);for(const b of ester){const a=component[b.a],c=component[b.b];links[a].push({group:c,from:b.a,to:b.b});links[c].push({group:a,from:b.b,to:b.a});}
  const first=component[0],ordered=[first];let previous=-1;
  while(true){const next=links[ordered.at(-1)].filter(x=>x.group!==previous);if(!next.length)break;if(next.length!==1)fail();previous=ordered.at(-1);ordered.push(next[0].group);}
  if(ordered.length<growthUnits+2)fail();
  const selected=ordered.slice(1,growthUnits+1),prefix=new Set(selected.slice(0,4).flatMap(i=>groups[i])),tail=new Set(selected.slice(4).flatMap(i=>groups[i]));
  const boundary=ester.find(b=>prefix.has(b.a)&&tail.has(b.b)||prefix.has(b.b)&&tail.has(b.a));if(!boundary)fail();
  const old=prefix.has(boundary.a)?boundary.a:boundary.b,next=old===boundary.a?boundary.b:boundary.a;
  if(element(reference,old)!==donor||!carbonyl(reference,ra,next))fail();
  const candidates=[];
  for(let o=0;o<finite.atoms.length;o++)if(element(finite,o)==='O'){
    const h=fa[o].filter(n=>n.order===1&&element(finite,n.i)==='H'),c=fa[o].filter(n=>n.order===1&&carbonyl(finite,fa,n.i));
    if(h.length===1&&c.length===1)candidates.push({acidO:o,acidH:h[0].i});
  }
  const ends=[];for(let o=0;o<finite.atoms.length;o++)if(element(finite,o)===donor){
    const h=fa[o].filter(n=>n.order===1&&element(finite,n.i)==='H');
    if(h.length===(amide?2:1)&&fa[o].some(n=>n.order===1&&element(finite,n.i)==='C'&&!carbonyl(finite,fa,n.i)))for(const hydrogen of h)ends.push({end:o,hydrogen:hydrogen.i});
  }
  function match(c){
    const omit=new Set([c.acidO,c.acidH,c.hydrogen]),fs=finite.atoms.map((_,i)=>i).filter(i=>!omit.has(i)),rs=[...prefix],fset=new Set(fs),rset=prefix;
    if(fs.length!==rs.length)return null;
    const fn=i=>fa[i].filter(n=>fset.has(n.i)),rn=i=>ra[i].filter(n=>rset.has(n.i));
    const sig=(g,neighbors,i)=>`${element(g,i)}|${neighbors(i).map(n=>`${element(g,n.i)}:${n.order}`).sort().join(',')}`;
    const fSig=new Map(fs.map(i=>[i,sig(finite,fn,i)])),rSig=new Map(rs.map(i=>[i,sig(reference,rn,i)]));
    if(fSig.get(c.end)!==rSig.get(old))return null;
    const map=new Map([[c.end,old]]),used=new Set([old]);
    function visit(){if(map.size===fs.length)return true;let choice=null,options=null;
      for(const f of fs)if(!map.has(f)){const known=fn(f).filter(n=>map.has(n.i));if(!known.length)continue;const opts=rs.filter(r=>!used.has(r)&&rSig.get(r)===fSig.get(f)&&known.every(n=>rn(r).some(x=>x.i===map.get(n.i)&&x.order===n.order)));if(!options||opts.length<options.length){choice=f;options=opts;if(!opts.length)break;}}
      if(choice===null||!options.length)return false;for(const r of options){map.set(choice,r);used.add(r);if(visit())return true;map.delete(choice);used.delete(r);}return false;
    }
    return visit()?map:null;
  }
  const p=(g,i)=>new THREE.Vector3(g.atoms[i].x,g.atoms[i].y,g.atoms[i].z);let best=null;
  for(const acid of candidates)for(const end of ends){const c={...acid,...end},mapping=match(c);if(!mapping)continue;
    // Continue from the terminal donor in the direction of the departing H.
    const origin=p(finite,c.end),out=p(finite,c.hydrogen).sub(origin).normalize(),refOrigin=p(reference,old);
    function tryDirection(direction){const alignment=new THREE.Quaternion().setFromUnitVectors(p(reference,next).sub(refOrigin).normalize(),direction);
      for(let step=0;step<48;step++){const q=new THREE.Quaternion().setFromAxisAngle(direction,step*Math.PI/24).multiply(alignment),transform=i=>p(reference,i).sub(refOrigin).applyQuaternion(q).add(origin);let gap=Infinity;
        for(const i of groups[selected[4]])for(let f=0;f<finite.atoms.length;f++)if(f!==c.hydrogen&&!(i===next&&f===c.end))gap=Math.min(gap,transform(i).distanceTo(p(finite,f)));
        if(!best||gap>best.gap)best={...c,mapping,transform,gap};
      }
    }
    tryDirection(out);
    // A strained departing H direction may point into the finite fragment.
    // Search a small cone only when the original axis cannot clear it.
    if(!best||best.gap<.7){const side=new THREE.Vector3(0,1,0);if(Math.abs(side.dot(out))>.9)side.set(1,0,0);side.cross(out).normalize();const other=new THREE.Vector3().crossVectors(out,side).normalize();
      for(const angle of [10,20,30]){for(let i=0;i<12;i++){const azimuth=i*Math.PI/6,rad=angle*Math.PI/180,direction=out.clone().multiplyScalar(Math.cos(rad)).addScaledVector(side,Math.sin(rad)*Math.cos(azimuth)).addScaledVector(other,Math.sin(rad)*Math.sin(azimuth)).normalize();tryDirection(direction);}if(best?.gap>=.7)break;}
    }
  }
  if(!best||best.gap<.7)fail();
  const atoms=[],bonds=[],finiteToPlan=new Map(),refToPlan=new Map();
  for(let i=0;i<finite.atoms.length;i++)if(i!==best.hydrogen){finiteToPlan.set(i,atoms.length);atoms.push({...finite.atoms[i],id:atoms.length,unit:3});}
  for(const b of finite.bonds)if(finiteToPlan.has(b.a)&&finiteToPlan.has(b.b))bonds.push({...b,a:finiteToPlan.get(b.a),b:finiteToPlan.get(b.b)});
  for(let u=4;u<selected.length;u++)for(const i of groups[selected[u]]){const v=best.transform(i);refToPlan.set(i,atoms.length);atoms.push({...reference.atoms[i],id:atoms.length,x:v.x,y:v.y,z:v.z,unit:u});}
  for(const b of reference.bonds)if(refToPlan.has(b.a)&&refToPlan.has(b.b))bonds.push({...b,a:refToPlan.get(b.a),b:refToPlan.get(b.b)});
  const bridge={a:finiteToPlan.get(best.end),b:refToPlan.get(next)};bonds.push({...bridge,order:1});
  // Restore the donor terminal H after cutting the following acid.
  const lastGroup=selected.at(-1),terminal=ester.find(b=>component[b.a]===lastGroup&&component[b.b]===ordered[growthUnits+1]||component[b.b]===lastGroup&&component[b.a]===ordered[growthUnits+1]);
  if(!terminal)fail();const last=component[terminal.a]===lastGroup?terminal.a:terminal.b,after=last===terminal.a?terminal.b:terminal.a;
  if(element(reference,last)!==donor)fail();const hpos=best.transform(last).add(best.transform(after).sub(best.transform(last)).normalize().multiplyScalar(.97*.78)),h=atoms.length;
  atoms.push({id:h,element:'H',x:hpos.x,y:hpos.y,z:hpos.z,unit:growthUnits-1});bonds.push({a:refToPlan.get(last),b:h,order:1});
  const reversePrefix=new Map([...best.mapping].map(([f,r])=>[r,finiteToPlan.get(f)]));
  const aromaticCycles=(reference.aromaticCycles??[]).filter(c=>c.every(i=>reversePrefix.has(i)||refToPlan.has(i))).map(c=>c.map(i=>reversePrefix.get(i)??refToPlan.get(i)));
  const matched=[...finiteToPlan].map(([f,r])=>({finite:f,reference:r,prefixReference:best.mapping.get(f)??null}));
  return {plan:{...reference,unitCount:growthUnits,atoms,bonds,aromaticCycles},matched,bridge,removedFinite:[best.hydrogen],water:{finite:[best.hydrogen],incoming:['O','H']}};
}
