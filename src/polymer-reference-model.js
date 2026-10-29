// Display-only reference chains. Repeat graphs have two backbone ports;
// Adjacent units consume the ports; only the outer ports receive display caps.
// Authority IDs/repeat chemistry: data/polymers.json, data/polymerization-routes.json.
// No PolymerSample, reaction, Collection or persistence dependency.
const methyl=()=>({element:'C',children:[{element:'H'},{element:'H'},{element:'H'}]});
// Local functional-group coordinates in the same display scale as the sp3 chain.
// The x axis points from the backbone into the substituent; y is its local plane.
const SCALE=.78;
function phenyl(){
  const r=1.40*SCALE,attachment=1.50*SCALE,atoms=[],bonds=[];
  for(let k=0;k<6;k++){const angle=Math.PI+k*Math.PI/3;atoms.push({element:'C',point:[attachment+r+r*Math.cos(angle),r*Math.sin(angle),0]});}
  for(let k=0;k<6;k++)bonds.push({a:k,b:(k+1)%6,order:k%2?1:2});
  for(let k=1;k<6;k++){const angle=Math.PI+k*Math.PI/3,id=atoms.length;atoms.push({element:'H',point:[attachment+r+(r+1.08*SCALE)*Math.cos(angle),(r+1.08*SCALE)*Math.sin(angle),0]});bonds.push({a:k,b:id,order:1});}
  return{atoms,bonds,aromaticCycles:[[0,1,2,3,4,5]]};
}
const cyano=()=>({atoms:[{element:'C',point:[1.47*SCALE,0,0]},{element:'N',point:[(1.47+1.16)*SCALE,0,0]}],bonds:[{a:0,b:1,order:3}]});
function carboxyl(){
  const c=1.52*SCALE,co=1.23*SCALE,oh=1.36*SCALE,h=.97*SCALE;
  const oxygen=[c+oh*.5,-oh*Math.sqrt(3)/2,0],angle=-132*Math.PI/180;
  return{atoms:[{element:'C',point:[c,0,0]},{element:'O',point:[c+co*.5,co*Math.sqrt(3)/2,0]},{element:'O',point:oxygen},{element:'H',point:[oxygen[0]+h*Math.cos(angle),oxygen[1]+h*Math.sin(angle),0]}],bonds:[{a:0,b:1,order:2},{a:0,b:2,order:1},{a:2,b:3,order:1}]};
}
function repeatGraph(sides){
  const atoms=[{element:'C'},{element:'C'}],bonds=[{a:0,b:1,order:1}],groups=[];
  function branch(parent,node){
    if(node.fragment){
      const fragment=node.fragment,offset=atoms.length,ids=fragment.atoms.map((atom,i)=>offset+i);
      atoms.push(...fragment.atoms.map(({element})=>({element})));
      bonds.push({a:parent,b:offset,order:1},...fragment.bonds.map(b=>({...b,a:b.a+offset,b:b.b+offset})));
      groups.push(Object.freeze({root:offset,ids:Object.freeze(ids),fragment}));return;
    }
    const id=atoms.length;atoms.push({element:node.element});bonds.push({a:parent,b:id,order:1});for(const child of node.children??[])branch(id,child);}
  sides.forEach((items,parent)=>items.forEach(node=>branch(parent,typeof node==='string'?{element:node}:node)));
  return Object.freeze({atoms:Object.freeze(atoms.map(Object.freeze)),bonds:Object.freeze(bonds.map(Object.freeze)),ports:Object.freeze([0,1]),groups:Object.freeze(groups)});
}
// Display composition is deliberately illustrative, independent of the finite
// reaction's representativeSequence. A fixed non-alternating motif A,A,B,A,B,B
// is repeated and truncated to the requested total monomer-derived unit count.
const COPOLYMER_NOTE='立体・位置規則性未指定';
const DEFINITIONS=Object.freeze({
  'phenol-formaldehyde-resin':{label:'フェノール樹脂',network:true},
  'ethylene-propylene-copolymer':{label:'EP',components:['polyethylene','polypropylene'],stereoNote:COPOLYMER_NOTE},
  'styrene-butadiene-copolymer':{label:'SBR',components:['polystyrene','polybutadiene'],stereoNote:COPOLYMER_NOTE+'・1,4付加/C=C配置は例示・微細構造未指定'},
  'nitrile-butadiene-rubber':{label:'NBR',components:['polyacrylonitrile','polybutadiene'],stereoNote:COPOLYMER_NOTE+'・1,4付加/C=C配置は例示・微細構造未指定'},
  'butyl-rubber':{label:'IIR',components:['polyisobutylene','polyisoprene'],minorEvery:10,stereoNote:COPOLYMER_NOTE+'・1,4付加/C=C配置は例示・微細構造未指定'},
  'vinylidene-fluoride-hexafluoropropylene-copolymer':{label:'VDF-HFP',components:['polyvinylidene-fluoride','hfp-display-unit'],stereoNote:COPOLYMER_NOTE+'・結合方向は例示'},

  'polybutadiene':{label:'PB',diene:true,stereoNote:'1,4付加の例示配座・二重結合配置は例示・cis/trans比と立体規則性は未指定'},
  'polyisoprene':{label:'PI',diene:true,methyl:true,stereoNote:'1,4付加の例示配座・二重結合配置は例示・cis/trans比と立体規則性は未指定'},
  'polyethylene-adipamide':{label:'ポリエチレンアジパミド',amide:true,backboneRepeat:['amide-n','methylene','methylene','amide-n','carbonyl','methylene','methylene','methylene','methylene','carbonyl'],terminalNote:'参考用NH₂／COOH末端'},
  'nylon-6-6':{label:'ナイロン66',amide:true,backboneRepeat:['amide-n',...Array(6).fill('methylene'),'amide-n','carbonyl',...Array(4).fill('methylene'),'carbonyl'],terminalNote:'参考用NH₂／COOH末端'},
  'polyethylene-oxide':{label:'PEO',backboneRepeat:['methylene','methylene','ether'],ports:[0,2],terminalNote:'便宜的なH末端'},
  'polylactic-acid':{label:'PLA',backboneRepeat:['ester-oxygen','methine','carbonyl'],ports:[0,2],terminalNote:'参考模型用のOH／COOH末端',stereoNote:'L/D配置・立体規則性は未指定・立体配置は例示'},
  'polyglycolic-acid':{label:'PGA',backboneRepeat:['ester-oxygen','methylene','carbonyl'],ports:[0,2],terminalNote:'参考模型用のOH／COOH末端'},
  'polyethylene-terephthalate':{label:'PET',backboneRepeat:['ester-oxygen','methylene','methylene','ester-oxygen','terephthaloyl'],ports:[0,4],terminalNote:'参考模型用のOH／COOH末端'},
  'polyethylene-adipate':{label:'PEA',backboneRepeat:['ester-oxygen','methylene','methylene','ester-oxygen','carbonyl','methylene','methylene','methylene','methylene','carbonyl'],ports:[0,9],terminalNote:'参考模型用のOH／COOH末端'},
  'polyethylene':{label:'PE',graph:repeatGraph([['H','H'],['H','H']])},
  'polypropylene':{label:'PP',graph:repeatGraph([['H','H'],[methyl(),'H']]),stereoNote:'立体配置は例示・タクチシティ未指定'},
  'polyvinyl-chloride':{label:'PVC',graph:repeatGraph([['H','H'],['Cl','H']]),stereoNote:'立体配置は例示'},
  'polychlorotrifluoroethylene':{label:'PCTFE',graph:repeatGraph([['F','F'],['F','Cl']])},
  'polyvinylidene-fluoride':{label:'PVDF',graph:repeatGraph([['H','H'],['F','F']])},
  'polytetrafluoroethylene':{label:'PTFE',graph:repeatGraph([['F','F'],['F','F']])},
  'polystyrene':{label:'PS',graph:repeatGraph([['H','H'],[{fragment:phenyl()},'H']]),stereoNote:'立体配置は例示・タクチシティ未指定'},
  'polyacrylonitrile':{label:'PAN',graph:repeatGraph([['H','H'],[{fragment:cyano()},'H']]),stereoNote:'立体配置は例示・タクチシティ未指定'},
  'polyacrylic-acid':{label:'PAA',graph:repeatGraph([['H','H'],[{fragment:carboxyl()},'H']]),stereoNote:'非イオン化のCOOH・立体配置は例示・タクチシティ未指定'},
  'polyisobutylene':{label:'PIB',graph:repeatGraph([['H','H'],[methyl(),methyl()]])},
});
export function polymerReferenceDefinition(polymerId){return DEFINITIONS[polymerId]??null;}
export function referenceModelFormula(plan){
  const counts={};for(const atom of plan.atoms)counts[atom.element]=(counts[atom.element]??0)+1;
  return ['C','H',...Object.keys(counts).filter(e=>e!=='C'&&e!=='H').sort()].filter(e=>counts[e]).map(e=>e+(counts[e]===1?'':counts[e])).join('');
}
// Oxygen- and amide-containing repeats use explicit variable-length backbone blocks.
// All distances below are illustrative bond lengths in Angstrom, scaled like
// the existing vinyl models. No reaction graph or stereochemical authority is read.
function createOxygenReferenceModel(THREE,polymerId,unitCount,definition,extraRepeat=false){
  if(![10,30,100].includes(unitCount))throw new RangeError('Reference units must be 10, 30, or 100.');
  const V=THREE.Vector3,atoms=[],bonds=[],aromaticCycles=[],sites=[];
  const add=(element,p,unit)=>{const id=atoms.length;atoms.push({id,element,x:p.x,y:p.y,z:p.z,unit});return id;};
  const pos=id=>new V(atoms[id].x,atoms[id].y,atoms[id].z);
  const connect=(a,b,order=1)=>bonds.push({a,b,order});
  const element=kind=>kind==='amide-n'||kind==='amine'?'N':kind==='ether'||kind==='ester-oxygen'?'O':'C';
  const angle=kind=>kind==='carbonyl'||kind==='amide-n'?120:kind==='ether'?112:kind==='ester-oxygen'?116:Math.acos(-1/3)*180/Math.PI;
  const length=(a,b)=>element(a)==='N'||element(b)==='N'?((a==='carbonyl'||b==='carbonyl')?1.33:1.47):((a==='carbonyl'&&element(b)==='O')||((b==='carbonyl'||b==='terephthaloyl')&&element(a)==='O'))?1.36:element(a)==='O'||element(b)==='O'?1.43:1.52;
  let seed=37019;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const normalFor=axis=>new V().crossVectors(axis,Math.abs(axis.z)<.8?new V(0,0,1):new V(0,1,0)).normalize();
  const planeNormal=()=>{
    const b=sites.at(-1),a=sites.at(-2),c=sites.at(-3);
    if(b?.plane)return b.plane.clone();
    if(!a)return new V(0,0,1);
    const axis=pos(b.id).sub(pos(a.id)).normalize();
    const normal=c?new V().crossVectors(pos(a.id).sub(pos(c.id)),axis):new V(0,0,1);
    return normal.lengthSq()>1e-8?normal.normalize():normalFor(axis);
  };
  // Fixed finite torsion choices, with a local collision preference. This is
  // construction of one example conformation, not relaxation or a physical model.
  function nextDirection(nextKind){
    const b=sites.at(-1),a=sites.at(-2);
    if(b.outgoing)return b.outgoing.clone();
    if(!a)return new V(1,0,0);
    const axis=pos(b.id).sub(pos(a.id)).normalize(),normal=planeNormal(),side=new V().crossVectors(normal,axis).normalize();
    const turn=Math.PI-angle(b.kind)*Math.PI/180;
    // Keep O=C-N-H and both N/C substituents in the same local plane.
    // Alkyl single bonds retain the existing deterministic torsion choices.
    const locked=b.kind==='carbonyl'||((b.kind==='ester-oxygen'||b.kind==='amide-n')&&a.kind==='carbonyl');
    const torsions=locked?[Math.PI]:[Math.PI,Math.PI/3,-Math.PI/3];
    let best=null;const phase=random()*Math.PI*2;
    for(const torsion of torsions){
      const direction=axis.clone().multiplyScalar(Math.cos(turn)).addScaledVector(side,Math.sin(turn)*Math.cos(torsion)).addScaledVector(normal,Math.sin(turn)*Math.sin(torsion));
      const point=pos(b.id).addScaledVector(direction,length(b.kind,nextKind)*SCALE);
      let score=.15*(1-Math.cos(torsion-phase));
      for(const atom of atoms){
        if(atom.id===b.id||atom.id===a.id)continue;
        const gap=point.distanceTo(new V(atom.x,atom.y,atom.z));score+=Math.max(0,(atom.element==='H'?1.25:1.85)-gap)**2*100;
      }
      if(!best||score<best.score)best={direction,score};
    }
    return best.direction;
  }
  function append(kind,unit){
    const previous=sites.at(-1),p=previous?pos(previous.id).addScaledVector(nextDirection(kind),length(previous.kind,kind)*SCALE):new V();
    const id=add(element(kind),p,unit);if(previous)connect(previous.id,id);
    const site={id,kind,unit};sites.push(site);return site;
  }
  function terephthaloyl(unit){
    const entry=append('carbonyl',unit),p=pos(entry.id),previous=sites.at(-2);
    const incoming=pos(previous.id).sub(p).normalize(),normal=planeNormal();
    // Local incoming port (-1/2,+sqrt(3)/2,0). The block plane
    // includes the preceding C-O bond, preserving the ester plane.
    const axis=incoming.clone().multiplyScalar(-.5).addScaledVector(new V().crossVectors(normal,incoming),-Math.sqrt(3)/2);
    const side=new V().crossVectors(normal,axis).normalize();
    const point=(x,y)=>p.clone().addScaledVector(axis,x*SCALE).addScaledVector(side,y*SCALE);
    const ring=[],r=1.40,ar=1.49;
    for(let k=0;k<6;k++){
      const t=Math.PI-k*Math.PI/3;ring.push(add('C',point(ar+r+r*Math.cos(t),r*Math.sin(t)),unit));
    }
    connect(entry.id,ring[0]);
    for(let k=0;k<6;k++)connect(ring[k],ring[(k+1)%6],k%2?1:2);
    aromaticCycles.push(ring);
    for(const k of [1,2,4,5]){
      const t=Math.PI-k*Math.PI/3,h=add('H',point(ar+r+(r+1.08)*Math.cos(t),(r+1.08)*Math.sin(t)),unit);connect(ring[k],h);
    }
    const d=ar*2+r*2,exit=add('C',point(d,0),unit);connect(ring[3],exit);
    const o1=add('O',point(-1.23*.5,-1.23*Math.sqrt(3)/2),unit),o2=add('O',point(d+1.23*.5,1.23*Math.sqrt(3)/2),unit);
    connect(entry.id,o1,2);connect(exit,o2,2);
    entry.decorated=true;
    // Ring atoms are a rigid, para-connected block, not sp3 path nodes.
    sites.push({id:exit,kind:'carbonyl',unit,decorated:true,plane:normal,outgoing:axis.clone().multiplyScalar(.5).addScaledVector(side,-Math.sqrt(3)/2)});
  }
  for(let unit=0;unit<unitCount+(extraRepeat?1:0);unit++)for(const kind of definition.backboneRepeat){
    if(kind==='terephthaloyl')terephthaloyl(unit);else append(definition.amide&&unit===0&&sites.length===0?'amine':kind,unit);
  }
  // Virtual port directions are used only to complete the two display termini.
  const first=sites[0],last=sites.at(-1),firstForward=pos(sites[1].id).sub(pos(first.id)).normalize();
  const incoming=firstForward.clone().multiplyScalar(Math.cos(angle(first.kind)*Math.PI/180)).addScaledVector(normalFor(firstForward),Math.sin(angle(first.kind)*Math.PI/180));
  const outgoing=nextDirection(first.kind),cap=(site,direction)=>{
    const p=pos(site.id);
    if(site.kind==='carbonyl'){
      const o=add('O',p.addScaledVector(direction,1.36*SCALE),site.unit);connect(site.id,o);
      const hdir=direction.clone().multiplyScalar(Math.cos(64*Math.PI/180)).addScaledVector(normalFor(direction),Math.sin(64*Math.PI/180));
      connect(o,add('H',pos(o).addScaledVector(hdir,.97*SCALE),site.unit));
    }else connect(site.id,add('H',p.addScaledVector(direction,(element(site.kind)==='O'?.97:element(site.kind)==='N'?1.01:1.09)*SCALE),site.unit));
  };
  cap(first,incoming);cap(last,outgoing);
  const complement=(u,v)=>{
    const middle=u.clone().add(v).multiplyScalar(-.5),side=new V().crossVectors(u,v).normalize().multiplyScalar(Math.sqrt(2/3));
    return[middle.clone().add(side).normalize(),middle.clone().sub(side).normalize()];
  };
  for(let i=0;i<sites.length;i++){
    const site=sites[i];if(site.decorated||element(site.kind)==='O')continue;
    const p=pos(site.id),back=i?pos(sites[i-1].id).sub(p).normalize():incoming,forward=i===sites.length-1?outgoing:pos(sites[i+1].id).sub(p).normalize();
    if(site.kind==='carbonyl'){
      const dir=back.clone().add(forward).negate().normalize();connect(site.id,add('O',p.clone().addScaledVector(dir,1.23*SCALE),site.unit),2);continue;
    }
    if(element(site.kind)==='N'){
      // Internal amide N is trigonal and shares the carbonyl plane. The
      // first neutral NH2 uses three tetrahedral directions (one lone pair).
      const dir=site.kind==='amine'?complement(back,forward)[0]:back.clone().add(forward).negate().normalize();
      connect(site.id,add('H',p.clone().addScaledVector(dir,1.01*SCALE),site.unit));continue;
    }
    const directions=complement(back,forward);
    // A deterministic example sequence, without a claim of L/D or tacticity.
    if(site.kind==='methine'&&site.unit%3===1)directions.reverse();
    directions.forEach((dir,k)=>{
      const methylBranch=site.kind==='methine'&&k===0,id=add(methylBranch?'C':'H',p.clone().addScaledVector(dir,(methylBranch?1.52:1.09)*SCALE),site.unit);connect(site.id,id);
      if(methylBranch){
        const u=normalFor(dir),v=new V().crossVectors(dir,u);
        for(let j=0;j<3;j++){
          const t=j*2*Math.PI/3,hdir=dir.clone().multiplyScalar(1/3).addScaledVector(u,Math.sqrt(8/9)*Math.cos(t)).addScaledVector(v,Math.sqrt(8/9)*Math.sin(t));
          connect(id,add('H',pos(id).addScaledVector(hdir,1.09*SCALE),site.unit));
        }
      }
    });
  }
  const min=new V(Infinity,Infinity,Infinity),max=new V(-Infinity,-Infinity,-Infinity);
  for(const atom of atoms){const p=pos(atom.id);min.min(p);max.max(p);}
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const atom of atoms){atom.x-=center.x;atom.y-=center.y;atom.z-=center.z;}
  return{presentationOnly:true,polymerId,atoms,bonds,unitCount,aromaticCycles,continuations:[],bounds:{width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}};
}
// 1,4-addition display chains: four main-chain carbons per repeat.
// The illustrative trans local alkene geometry is not a microstructure claim.
// Single bonds sample a fixed finite torsion set; C=C never rotates.
function createDieneReferenceModel(THREE,polymerId,unitCount,definition){
  if(![10,30,100].includes(unitCount))throw new RangeError('Reference units must be 10, 30, or 100.');
  const V=THREE.Vector3,atoms=[],bonds=[],backbone=[];
  const add=(element,p,unit)=>{const id=atoms.length;atoms.push({id,element,x:p.x,y:p.y,z:p.z,unit});return id;};
  const pos=id=>new V(atoms[id].x,atoms[id].y,atoms[id].z);
  const connect=(a,b,order=1)=>bonds.push({a,b,order});
  const normalFor=axis=>new V().crossVectors(axis,Math.abs(axis.z)<.8?new V(0,0,1):new V(0,1,0)).normalize();
  const sp2=i=>i%4===1||i%4===2;
  let seed=52027;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function direction(i){
    if(i===0)return new V(1,0,0);
    const b=pos(backbone[i]),a=pos(backbone[i-1]),axis=b.clone().sub(a).normalize();
    let normal=i>1?new V().crossVectors(a.clone().sub(pos(backbone[i-2])),axis):normalFor(axis);
    if(normal.lengthSq()<1e-8)normal=normalFor(axis);else normal.normalize();
    const side=new V().crossVectors(normal,axis).normalize(),turn=sp2(i)?Math.PI/3:Math.acos(1/3);
    const torsions=i%4===2?[Math.PI]:[Math.PI,Math.PI/3,-Math.PI/3];
    let best=null;const phase=random()*2*Math.PI;
    const length=(i%4===1?1.34:sp2(i)||sp2(i+1)?1.50:1.52)*SCALE;
    for(const torsion of torsions){
      const dir=axis.clone().multiplyScalar(Math.cos(turn)).addScaledVector(side,Math.sin(turn)*Math.cos(torsion)).addScaledVector(normal,Math.sin(turn)*Math.sin(torsion));
      const point=b.clone().addScaledVector(dir,length);let score=.2*(1-Math.cos(torsion-phase));
      for(let j=0;j<i-1;j++)score+=100*Math.max(0,1.9-point.distanceTo(pos(backbone[j])))**2;
      if(!best||score<best.score)best={dir,score};
    }
    return best.dir;
  }
  for(let i=0;i<4*unitCount;i++){
    const length=(i%4===2?1.34:sp2(i)||sp2(i-1)?1.50:1.52)*SCALE;
    const p=i?pos(backbone[i-1]).addScaledVector(direction(i-1),length):new V();
    backbone.push(add('C',p,Math.floor(i/4)));if(i)connect(backbone[i-1],backbone[i],i%4===2?2:1);
  }
  for(let i=0;i<backbone.length;i++){
    const id=backbone[i],p=pos(id),unit=Math.floor(i/4),previous=i?pos(backbone[i-1]).sub(p).normalize():null,forward=i+1<backbone.length?pos(backbone[i+1]).sub(p).normalize():null;
    let directions;
    if(previous&&forward){
      const middle=previous.clone().add(forward).negate();
      if(sp2(i))directions=[middle.normalize()];
      else{middle.multiplyScalar(.5);const side=new V().crossVectors(previous,forward).normalize().multiplyScalar(Math.sqrt(2/3));directions=[middle.clone().add(side).normalize(),middle.clone().sub(side).normalize()];}
    }else{
      const axis=previous??forward,u=normalFor(axis),v=new V().crossVectors(axis,u);
      directions=[0,1,2].map(k=>axis.clone().multiplyScalar(-1/3).addScaledVector(u,Math.sqrt(8/9)*Math.cos(k*2*Math.PI/3)).addScaledVector(v,Math.sqrt(8/9)*Math.sin(k*2*Math.PI/3)));
    }
    for(const dir of directions){
      const methylBranch=definition.methyl&&i%4===1,child=add(methylBranch?'C':'H',p.clone().addScaledVector(dir,(methylBranch?1.50:sp2(i)?1.08:1.09)*SCALE),unit);connect(id,child);
      if(methylBranch){
        const u=normalFor(dir),v=new V().crossVectors(dir,u);
        for(let k=0;k<3;k++){
          const hdir=dir.clone().multiplyScalar(1/3).addScaledVector(u,Math.sqrt(8/9)*Math.cos(k*2*Math.PI/3)).addScaledVector(v,Math.sqrt(8/9)*Math.sin(k*2*Math.PI/3));
          connect(child,add('H',pos(child).addScaledVector(hdir,1.09*SCALE),unit));
        }
      }
    }
  }
  const min=new V(Infinity,Infinity,Infinity),max=new V(-Infinity,-Infinity,-Infinity);
  for(const atom of atoms){min.min(pos(atom.id));max.max(pos(atom.id));}
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const atom of atoms){atom.x-=center.x;atom.y-=center.y;atom.z-=center.z;}
  return{presentationOnly:true,polymerId,atoms,bonds,unitCount,aromaticCycles:[],continuations:[],bounds:{width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}};
}
// Heterogeneous backbone: each unit contributes its own ordered backbone
// sites and side graph. Cross-unit bonds consume one port on each neighbour.
// There are only two H caps, never caps at internal heterogeneous boundaries.
function createCopolymerReferenceModel(THREE,polymerId,unitCount,definition){
  if(![10,30,100].includes(unitCount))throw new RangeError('Reference units must be 10, 30, or 100.');
  const sequence=Array.from({length:unitCount},(_,i)=>definition.components[definition.minorEvery?(i%definition.minorEvery===definition.minorEvery-1?1:0):[0,0,1,0,1,1][i%6]]);
  const V=THREE.Vector3,atoms=[],bonds=[],backbone=[],sites=[],aromaticCycles=[];
  const add=(element,p,unit)=>{const id=atoms.length;atoms.push({id,element,x:p.x,y:p.y,z:p.z,unit});return id;};
  const pos=i=>new V(atoms[i].x,atoms[i].y,atoms[i].z);
  const connect=(a,b,order=1)=>bonds.push({a,b,order});
  const normalFor=axis=>new V().crossVectors(axis,Math.abs(axis.z)<.8?new V(0,0,1):new V(0,1,0)).normalize();
  const sideLength=element=>({C:1.52,H:1.09,F:1.35,Cl:1.77}[element])*SCALE;
  const complement=(u,v)=>{
    const middle=u.clone().add(v).multiplyScalar(-.5),side=new V().crossVectors(u,v).normalize().multiplyScalar(Math.sqrt(2/3));
    return[middle.clone().add(side).normalize(),middle.clone().sub(side).normalize()];
  };
  const tripod=axis=>{const u=normalFor(axis),v=new V().crossVectors(axis,u);return[0,1,2].map(k=>axis.clone().multiplyScalar(-1/3).addScaledVector(u,Math.sqrt(8/9)*Math.cos(k*2*Math.PI/3)).addScaledVector(v,Math.sqrt(8/9)*Math.sin(k*2*Math.PI/3)));};
  sequence.forEach((component,unit)=>{
    const d=DEFINITIONS[component];
    if(d?.diene){
      for(let k=0;k<4;k++)sites.push({unit,sp2:k===1||k===2,order:k===2?2:1,branches:k===1&&d.methyl?[methyl()]:k===1||k===2?['H']:['H','H']});
    }else{
      const graph=component==='hfp-display-unit'?repeatGraph([['F','F'],[{element:'C',children:[{element:'F'},{element:'F'},{element:'F'}]},'F']]):d.graph;
      const neighbors=id=>graph.bonds.flatMap(b=>b.a===id?[b.b]:b.b===id?[b.a]:[]);
      graph.ports.forEach(parent=>sites.push({unit,sp2:false,order:1,branches:neighbors(parent).filter(n=>!graph.ports.includes(n)).map(id=>{
        const group=graph.groups.find(g=>g.root===id);if(group)return{group};
        return{element:graph.atoms[id].element,children:neighbors(id).filter(n=>!graph.ports.includes(n)).map(n=>({element:graph.atoms[n].element}))};
      })}));
    }
  });
  const groupAt=(group,center,direction,phase)=>{
    const helper=Math.abs(direction.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const u=new THREE.Vector3().crossVectors(direction,helper).normalize(),v=new THREE.Vector3().crossVectors(direction,u);
    const plane=u.multiplyScalar(Math.cos(phase)).addScaledVector(v,Math.sin(phase));
    return group.fragment.atoms.map(({point:[x,y,z]})=>center.clone().addScaledVector(direction,x).addScaledVector(plane,y).addScaledVector(new THREE.Vector3().crossVectors(direction,plane),z));
  };
  const placeGroup=(group,center,direction,unit,parent)=>{
    let best=null;
    for(let k=0;k<12;k++){
      const points=groupAt(group,center,direction,(k+unit*.381966)*Math.PI/6);let score=0;
      for(let j=0;j<points.length;j++)for(const atom of atoms){
        if(atom.id===parent)continue;
        const limit=(group.fragment.atoms[j].element==='H'?.55:.85)+(atom.element==='H'?.55:.85);
        score+=Math.max(0,limit-points[j].distanceTo(new THREE.Vector3(atom.x,atom.y,atom.z)))**2;
      }
      if(!best||score<best.score)best={points,score};
    }
    const ids=group.fragment.atoms.map((atom,j)=>add(atom.element,best.points[j],unit));connect(parent,ids[0]);
    for(const bond of group.fragment.bonds)connect(ids[bond.a],ids[bond.b],bond.order);
    for(const cycle of group.fragment.aromaticCycles??[])aromaticCycles.push(cycle.map(id=>ids[id]));
  };

  function decorate(i,next){
    const site=sites[i],unit=site.unit,center=pos(backbone[i]),back=i?pos(backbone[i-1]).sub(center).normalize():null,forward=next?.clone().sub(center).normalize();
    const directions=back&&forward?(site.sp2?[back.clone().add(forward).negate().normalize()]:complement(back,forward)):tripod(back??forward);
    const branches=[...site.branches];if(!site.sp2&&unit%3===1)branches.reverse();
    directions.forEach((dir,k)=>{
      const node=branches[k]??'H';
      if(node.group){placeGroup(node.group,center,dir,unit,backbone[i]);return;}
      const element=typeof node==='string'?node:node.element;
      const id=add(element,center.clone().addScaledVector(dir,site.sp2?(element==='H'?1.08:1.50)*SCALE:sideLength(element)),unit);connect(backbone[i],id);
      const children=typeof node==='string'?[]:node.children??[];
      const ds=tripod(dir.clone().negate());children.forEach((child,j)=>connect(id,add(child.element,pos(id).addScaledVector(ds[j],sideLength(child.element)),unit)));
    });
  }
  let seed=63031;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<sites.length;i++){
    let p=new V();
    if(i===1)p=pos(backbone[0]).add(new V(1.52*SCALE,0,0));
    else if(i>1){
      const b=pos(backbone[i-1]),a=pos(backbone[i-2]),axis=b.clone().sub(a).normalize();
      let normal=i>2?new V().crossVectors(a.clone().sub(pos(backbone[i-3])),axis):normalFor(axis);
      if(normal.lengthSq()<1e-8)normal=normalFor(axis);else normal.normalize();
      const side=new V().crossVectors(normal,axis).normalize(),turn=sites[i-1].sp2?Math.PI/3:Math.acos(1/3);
      const torsions=sites[i-1].order===2?[Math.PI]:[Math.PI,Math.PI/3,-Math.PI/3];
      const length=(sites[i].order===2?1.34:sites[i].sp2||sites[i-1].sp2?1.50:1.52)*SCALE,phase=random()*2*Math.PI;
      let best=null;
      for(const torsion of torsions){
        const dir=axis.clone().multiplyScalar(Math.cos(turn)).addScaledVector(side,Math.sin(turn)*Math.cos(torsion)).addScaledVector(normal,Math.sin(turn)*Math.sin(torsion));
        const point=b.clone().addScaledVector(dir,length);let score=.12*(1-Math.cos(torsion-phase));
        for(const atom of atoms){if(atom.id===backbone[i-1]||atom.id===backbone[i-2])continue;score+=100*Math.max(0,(atom.element==='H'?1.35:2.1)-point.distanceTo(new V(atom.x,atom.y,atom.z)))**2;}
        if(!best||score<best.score)best={point,score};
      }
      p=best.point;
    }
    const id=add('C',p,sites[i].unit);backbone.push(id);
    if(i){connect(backbone[i-1],id,sites[i].order);decorate(i-1,p);}
  }
  decorate(sites.length-1,null);
  const min=new V(Infinity,Infinity,Infinity),max=new V(-Infinity,-Infinity,-Infinity);
  for(const atom of atoms){min.min(pos(atom.id));max.max(pos(atom.id));}
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const atom of atoms){atom.x-=center.x;atom.y-=center.y;atom.z-=center.z;}
  const componentCounts=Object.fromEntries(definition.components.map(id=>[id,sequence.filter(v=>v===id).length]));
  return{presentationOnly:true,polymerId,atoms,bonds,unitCount,aromaticCycles,continuations:[],sequence,componentCounts,sequenceRule:definition.minorEvery?'A x 9, B; repeat and truncate':'A,A,B,A,B,B; repeat and truncate',bounds:{width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}};
}
// Ideal sp3 internal coordinates with staggered torsions; an illustrative,
// deterministic conformation, not an experimentally determined chain structure.
// This module never reads or writes PolymerSample, reactions, or saved state.
export function createPolymerReferenceModel(THREE,polymerId,unitCount,{extraRepeat=false}={}){
  const definition=polymerReferenceDefinition(polymerId);
  if(!definition)throw new RangeError('Unsupported polymer reference model.');
  if(definition.network)return createPhenolicNetwork(THREE,polymerId,unitCount);
  if(definition.components)return createCopolymerReferenceModel(THREE,polymerId,unitCount,definition);
  if(definition.diene)return createDieneReferenceModel(THREE,polymerId,unitCount,definition);
  if(definition.backboneRepeat)return createOxygenReferenceModel(THREE,polymerId,unitCount,definition,extraRepeat);
  const graph=definition.graph,legacyPib=polymerId==='polyisobutylene';
  const neighbors=id=>graph.bonds.flatMap(b=>b.a===id?[b.b]:b.b===id?[b.a]:[]);
  const sideIds=graph.ports.map(id=>neighbors(id).filter(n=>!graph.ports.includes(n)));
  const sideLength=element=>({C:1.52,H:1.09,F:1.35,Cl:1.77}[element])*.78;
  if(![10,30,100].includes(unitCount))throw new RangeError('Reference units must be 10, 30, or 100.');
  const CC=1.52*.78,CH=1.09*.78,atoms=[],bonds=[],backbone=[];
  let seed=19423;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const add=(element,p,unit)=>{const id=atoms.length;atoms.push({id,element,x:p.x,y:p.y,z:p.z,unit});return id;};
  const pos=i=>new THREE.Vector3(atoms[i].x,atoms[i].y,atoms[i].z);
  const aromaticCycles=[];
  const connect=(a,b,order=1)=>bonds.push({a,b,order});
  const complement=(u,v)=>{
    const middle=u.clone().add(v).multiplyScalar(-.5),side=new THREE.Vector3().crossVectors(u,v).normalize().multiplyScalar(Math.sqrt(2/3));
    return[middle.clone().add(side).normalize(),middle.clone().sub(side).normalize()];
  };
  const tripod=(axis,phase=0)=>{
    const helper=Math.abs(axis.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0),u=new THREE.Vector3().crossVectors(axis,helper).normalize(),v=new THREE.Vector3().crossVectors(axis,u);
    return[0,1,2].map(k=>axis.clone().multiplyScalar(-1/3).addScaledVector(u,Math.sqrt(8/9)*Math.cos(phase+k*2*Math.PI/3)).addScaledVector(v,Math.sqrt(8/9)*Math.sin(phase+k*2*Math.PI/3)));
  };
  const groupAt=(group,center,direction,phase)=>{
    const helper=Math.abs(direction.z)<.8?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const u=new THREE.Vector3().crossVectors(direction,helper).normalize(),v=new THREE.Vector3().crossVectors(direction,u);
    const plane=u.multiplyScalar(Math.cos(phase)).addScaledVector(v,Math.sin(phase));
    return group.fragment.atoms.map(({point:[x,y,z]})=>center.clone().addScaledVector(direction,x).addScaledVector(plane,y).addScaledVector(new THREE.Vector3().crossVectors(direction,plane),z));
  };
  const placeGroup=(group,center,direction,unit,parent)=>{
    let best=null;
    for(let k=0;k<12;k++){
      const points=groupAt(group,center,direction,(k+unit*.381966)*Math.PI/6);let score=0;
      for(let j=0;j<points.length;j++)for(const atom of atoms){
        if(atom.id===parent)continue;
        const limit=(group.fragment.atoms[j].element==='H'?.55:.85)+(atom.element==='H'?.55:.85);
        score+=Math.max(0,limit-points[j].distanceTo(new THREE.Vector3(atom.x,atom.y,atom.z)))**2;
      }
      if(!best||score<best.score)best={points,score};
    }
    const ids=group.fragment.atoms.map((atom,j)=>add(atom.element,best.points[j],unit));connect(parent,ids[0]);
    for(const bond of group.fragment.bonds)connect(ids[bond.a],ids[bond.b],bond.order);
    for(const cycle of group.fragment.aromaticCycles??[])aromaticCycles.push(cycle.map(id=>ids[id]));
  };
  const decorate=(index,next)=>{
    const center=pos(backbone[index]),prev=index?pos(backbone[index-1]).sub(center).normalize():null,forward=next?.clone().sub(center).normalize(),unit=Math.floor(index/2);
    let directions=prev&&forward?complement(prev,forward):tripod(prev??forward);
    // All repeat-graph branches are retained. The third terminal direction
    // is an illustrative H cap, never an unconsumed internal connection point.
    const branches=[...sideIds[index%2]];
    // Deterministic illustrative stereocenters, not a claim about synthesis.
    if(!legacyPib&&unit%3===1)branches.reverse();
    directions.forEach((direction,k)=>{
      const branchId=branches[k];
      if(branchId===undefined){const hid=add('H',center.clone().addScaledVector(direction,CH),unit);connect(backbone[index],hid);return;}
      const group=graph.groups.find(group=>group.root===branchId);
      if(group){placeGroup(group,center,direction,unit,backbone[index]);return;}
      const element=graph.atoms[branchId].element,p=center.clone().addScaledVector(direction,sideLength(element)),id=add(element,p,unit);connect(backbone[index],id);
      const children=neighbors(branchId).filter(n=>!graph.ports.includes(n));
      if(children.length){const hs=tripod(direction.clone().negate(),Math.PI/3);children.forEach((child,j)=>{const e=graph.atoms[child].element,hid=add(e,p.clone().addScaledVector(hs[j],sideLength(e)),unit);connect(id,hid);});}
    });
  };
  backbone.push(add('C',new THREE.Vector3(),0));
  backbone.push(add('C',new THREE.Vector3(CC,0,0),0));connect(backbone[0],backbone[1]);decorate(0,pos(backbone[1]));
  for(let i=2;i<unitCount*2;i++){
    const b=pos(backbone[i-1]),a=pos(backbone[i-2]),axis=b.clone().sub(a).normalize();
    const prior=i>2?pos(backbone[i-3]):new THREE.Vector3(0,1,0),normal=new THREE.Vector3().crossVectors(a.clone().sub(prior),axis).normalize(),side=new THREE.Vector3().crossVectors(normal,axis).normalize();
    let best=null;
    const phase=random()*Math.PI*2,candidates=[Math.PI,Math.PI/3,-Math.PI/3];
    for(let k=0;k<9;k++){
      const torsion=candidates[k%3]+(random()-.5)*.36,dir=axis.clone().multiplyScalar(1/3).addScaledVector(side,Math.sqrt(8/9)*Math.cos(torsion)).addScaledVector(normal,Math.sqrt(8/9)*Math.sin(torsion)),p=b.clone().addScaledVector(dir,CC);
      // Include the next side groups in the local steric choice. Coordinates
      // are chosen once for display; no simulation or energy claim is made.
      const probes=[p];
      if(legacyPib){if((i-1)%2===1)for(const d of complement(axis.clone().negate(),dir))probes.push(b.clone().addScaledVector(d,CC));}
      else{const directions=complement(axis.clone().negate(),dir);sideIds[(i-1)%2].forEach((id,j)=>{const element=graph.atoms[id].element;if(element!=='H')probes.push(b.clone().addScaledVector(directions[j],sideLength(element)));});}
      if(graph.groups.length){
        const branches=[...sideIds[(i-1)%2]],unit=Math.floor((i-1)/2);if(unit%3===1)branches.reverse();
        const directions=complement(axis.clone().negate(),dir);
        branches.forEach((id,j)=>{const group=graph.groups.find(group=>group.root===id);if(group)probes.push(...groupAt(group,b,directions[j],unit*.2));});
      }
      let score=.12*(1-Math.cos(torsion-phase));
      for(const q of probes)for(const atom of atoms){if(atom.id===backbone[i-1]||atom.id===backbone[i-2])continue;const gap=q.distanceTo(new THREE.Vector3(atom.x,atom.y,atom.z)),limit=atom.element==='H'?1.35:2.1;score+=Math.max(0,limit-gap)**2*100;}
      if(!best||score<best.score)best={p,score};
    }
    const id=add('C',best.p,Math.floor(i/2));connect(backbone[i-1],id);decorate(i-1,best.p);backbone.push(id);
  }
  decorate(backbone.length-1,null);
  const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
  for(const a of atoms){const p=new THREE.Vector3(a.x,a.y,a.z);min.min(p);max.max(p);}
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const a of atoms){a.x-=center.x;a.y-=center.y;a.z-=center.z;}
  return{presentationOnly:true,polymerId,atoms,bonds,unitCount,aromaticCycles,continuations:[],bounds:{width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}};
}

// Display-only finite branched portion of a possible phenolic network.
// It is a connected tree of rings (no claim of a cured material's cycle count,
// crosslink density or conversion). The three reactive sites are ortho/para
// to OH. All atoms and bridges are explicit; no continuation/fake bonds.
function createPhenolicNetwork(THREE,polymerId,unitCount){
  if(![10,30,100].includes(unitCount))throw new RangeError('Reference ring count must be 10, 30, or 100.');
  const V=THREE.Vector3,atoms=[],bonds=[],aromaticCycles=[],rings=[],bridges=[];
  const r=1.40*SCALE,cc=1.51*SCALE,co=1.36*SCALE,ch=1.09*SCALE,oh=.97*SCALE;
  let seed=53041;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const pos=id=>new V(atoms[id].x,atoms[id].y,atoms[id].z);
  const add=(element,p,unit)=>{const id=atoms.length;atoms.push({id,element,x:p.x,y:p.y,z:p.z,unit});return id;};
  const connect=(a,b,order=1)=>bonds.push({a,b,order});
  const perpendicular=axis=>new V().crossVectors(axis,Math.abs(axis.z)<.8?new V(0,0,1):new V(0,1,0)).normalize();
  const radial=(ring,k)=>ring.u.clone().multiplyScalar(Math.cos(k*Math.PI/3)).addScaledVector(ring.v,Math.sin(k*Math.PI/3));
  function ringAt(center,u,v,depth){
    const ring={center,u,v,depth,ids:[],used:new Set()},unit=rings.length;
    for(let k=0;k<6;k++)ring.ids.push(add('C',center.clone().addScaledVector(radial(ring,k),r),unit));
    for(let k=0;k<6;k++)connect(ring.ids[k],ring.ids[(k+1)%6],k%2?1:2);
    const o=add('O',pos(ring.ids[0]).addScaledVector(u,co),unit);
    const h=add('H',pos(o).addScaledVector(u,oh*Math.cos(71*Math.PI/180)).addScaledVector(v,oh*Math.sin(71*Math.PI/180)),unit);
    connect(ring.ids[0],o);connect(o,h);aromaticCycles.push(ring.ids);rings.push(ring);return ring;
  }
  ringAt(new V(),new V(1,0,0),new V(0,1,0),0);
  // Breadth-first branching guarantees a 3-connected central ring and a
  // multi-arm graph rather than a folded linear chain. Each new ring uses
  // its para site as an incoming port; its two ortho sites can branch again.
  for(let unit=1;unit<unitCount;unit++){
    let chosen=null;
    for(const parent of rings){for(const site of [1,3,5]){
    if(parent.used.has(site))continue;
    const out=radial(parent,site),p=pos(parent.ids[site]),bridge=p.clone().addScaledVector(out,cc);
    const side=perpendicular(out),normal=new V().crossVectors(out,side),phase=random()*Math.PI*2;
    const obstacles=atoms.map(atom=>({element:atom.element,p:new V(atom.x,atom.y,atom.z)}));
    for(const ring of rings)for(let k=1;k<6;k++)if(!ring.used.has(k)&&!(ring===parent&&k===site))obstacles.push({element:'H',p:pos(ring.ids[k]).addScaledVector(radial(ring,k),ch)});
    let best=null;
    let bridgePenalty=0;
    for(const atom of atoms)if(atom.element!=='H'&&atom.id!==parent.ids[site])bridgePenalty+=Math.max(0,1.7*SCALE-bridge.distanceTo(new V(atom.x,atom.y,atom.z)))**2*100;
    if(bridgePenalty>1e-8)continue;
    for(let j=0;j<18;j++){
      const t=phase+j*Math.PI/9;
      // Angle C_ar-CH2-C_ar = tetrahedral; aryl substituents are in plane.
      const direction=out.clone().multiplyScalar(1/3).addScaledVector(side,Math.sqrt(8/9)*Math.cos(t)).addScaledVector(normal,Math.sqrt(8/9)*Math.sin(t));
      const attachment=bridge.clone().addScaledVector(direction,cc),u=direction.clone(),plane=perpendicular(u),other=new V().crossVectors(u,plane);
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6+phase,v=plane.clone().multiplyScalar(Math.cos(a)).addScaledVector(other,Math.sin(a)),center=attachment.clone().addScaledVector(u,r);
        const points=Array.from({length:6},(_,i)=>center.clone().addScaledVector(u,r*Math.cos(i*Math.PI/3)).addScaledVector(v,r*Math.sin(i*Math.PI/3)));
        const heavyCount=points.length+1;
        points.push(center.clone().addScaledVector(u,r+co));
        points.push(center.clone().addScaledVector(u,r+co+oh*Math.cos(71*Math.PI/180)).addScaledVector(v,oh*Math.sin(71*Math.PI/180)));
        for(const i of [1,2,4,5])points.push(center.clone().addScaledVector(u,(r+ch)*Math.cos(i*Math.PI/3)).addScaledVector(v,(r+ch)*Math.sin(i*Math.PI/3)));
        const back=out.clone().negate(),middle=back.clone().add(direction).multiplyScalar(-.5),cross=new V().crossVectors(back,direction).normalize().multiplyScalar(Math.sqrt(2/3));
        for(const d of [middle.clone().add(cross),middle.clone().sub(cross)])points.push(bridge.clone().addScaledVector(d,ch));
        // Probe future substituent space as well as the ring itself.
        for(const i of [1,5])points.push(center.clone().addScaledVector(u,(r+cc)*Math.cos(i*Math.PI/3)).addScaledVector(v,(r+cc)*Math.sin(i*Math.PI/3)));
        let score=0,minGap=Infinity;
        for(let pointIndex=0;pointIndex<points.length;pointIndex++)for(const atom of obstacles){
          const gap=points[pointIndex].distanceTo(atom.p),limit=(pointIndex>=heavyCount||atom.element==='H'?1.20:2.05)*SCALE;
          minGap=Math.min(minGap,gap/limit);score+=Math.max(0,limit-gap)**2*100;
        }
        // Mild outward preference, subordinate to collision avoidance.
        score-=.03*center.length();
        if(!best||score<best.score)best={score,u,v,center,direction,minGap};
      }
    }
    if(best&&(!chosen||best.score<chosen.best.score))chosen={parent,site,out,bridge,best};
    if(best?.minGap>=.90)break;
    }if(chosen?.best.minGap>=.90)break;}
    if(!chosen)throw new Error('No collision-safe phenolic bridge port.');
    const {parent,site,out,bridge,best}=chosen;
    const child=ringAt(best.center,best.u,best.v,parent.depth+1),b=add('C',bridge,unit);
    connect(parent.ids[site],b);connect(b,child.ids[3]);parent.used.add(site);child.used.add(3);
    const back=out.clone().negate(),forward=best.direction,middle=back.clone().add(forward).multiplyScalar(-.5),cross=new V().crossVectors(back,forward).normalize().multiplyScalar(Math.sqrt(2/3));
    for(const d of [middle.clone().add(cross),middle.clone().sub(cross)])connect(b,add('H',bridge.clone().addScaledVector(d,ch),unit));
    bridges.push({atom:b,rings:[rings.indexOf(parent),unit],sites:[site,3]});
  }
  // Residual positions are explicitly hydrogen-capped, including all unused
  // ortho/para positions. This example contains no residual methylol groups.
  for(let unit=0;unit<rings.length;unit++)for(let k=1;k<6;k++)if(!rings[unit].used.has(k)){
    const ring=rings[unit];connect(ring.ids[k],add('H',pos(ring.ids[k]).addScaledVector(radial(ring,k),ch),unit));
  }
  const min=new V(Infinity,Infinity,Infinity),max=new V(-Infinity,-Infinity,-Infinity);
  for(const atom of atoms){const p=pos(atom.id);min.min(p);max.max(p);}
  const center=min.clone().add(max).multiplyScalar(.5);
  for(const atom of atoms){atom.x-=center.x;atom.y-=center.y;atom.z-=center.z;}
  return{presentationOnly:true,polymerId,atoms,bonds,unitCount,ringCount:unitCount,aromaticCycles,bridges,networkKind:'branched-finite-example',seed:53041,continuations:[],bounds:{width:max.x-min.x,height:max.y-min.y,depth:max.z-min.z}};
}
