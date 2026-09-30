import {ELEMENTS,modelAtomRadius} from './chemistry.js?v=20';

const round=value=>Number(value.toFixed(3));
const pointOf=value=>Array.isArray(value)?value:{x:value?.x??0,y:value?.y??0,z:value?.z??0};
const elementOf=atom=>typeof atom==='string'?atom:atom.element;
const bondKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
const bondLength=(left,right)=>left==='H'||right==='H'?1.08:left==='O'||right==='N'?1.36:1.48;

// This one topology-derived layout is shared by live samples and generated SVGs.
// Coordinates are presentation-only and never become chemistry or Stage B data.
export function createPolymerPresentationPlan(sample,{sourceRecordsByInstanceId={}}={}){
  if(!sample?.fragment||!Array.isArray(sample.fragment.atoms)||!Array.isArray(sample.fragment.bonds)||!Array.isArray(sample.fragment.atomOrigins))throw new TypeError('A finite PolymerSample graph is required.');
  const graph=sample.fragment,units=[];
  for(const origin of graph.atomOrigins){if(!units.includes(origin.instanceId))units.push(origin.instanceId);}
  const unitIndex=new Map(units.map((id,index)=>[id,index]));
  const raw=graph.atoms.map((atom,index)=>{
    const origin=graph.atomOrigins[index],record=sourceRecordsByInstanceId[origin?.instanceId],sourceAtom=record?.atoms?.[origin?.sourceAtomIndex];
    const sourcePoint=pointOf(sourceAtom?.point),indexOffset=origin?.sourceAtomIndex??index,angle=indexOffset*2.399963229728653;
    return{x:sourceAtom?.point?sourcePoint.x:Math.cos(angle)*.8,y:sourceAtom?.point?sourcePoint.y:Math.sin(angle)*.8,z:sourceAtom?.point?sourcePoint.z:0,unit:unitIndex.get(origin?.instanceId)??0,element:atom.element??elementOf(sourceAtom??'C'),formalCharge:atom.formalCharge??0,initial:null,id:index};
  });
  const groupBounds=new Map();
  for(const atom of raw){const bounds=groupBounds.get(atom.unit)??{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity};bounds.minX=Math.min(bounds.minX,atom.x);bounds.maxX=Math.max(bounds.maxX,atom.x);bounds.minY=Math.min(bounds.minY,atom.y);bounds.maxY=Math.max(bounds.maxY,atom.y);groupBounds.set(atom.unit,bounds);}
  let cursor=0;
  for(const unit of units.map((_,index)=>index)){
    const bounds=groupBounds.get(unit)??{minX:0,maxX:0,minY:0,maxY:0},width=bounds.maxX-bounds.minX;
    if(unit>0)cursor+=Math.max(1.65,width*.42+1.15);
    const center=(bounds.minX+bounds.maxX)*.5;
    for(const atom of raw.filter(item=>item.unit===unit)){atom.x=atom.x-center+cursor;atom.initial={x:atom.x,y:atom.y,z:atom.z};}
  }
  const bonds=graph.bonds.map(bond=>Array.isArray(bond)?{a:bond[0],b:bond[1],order:bond[2]}:bond),bondSet=new Set(bonds.map(bond=>bondKey(bond.a,bond.b)));
  const links=bonds.filter(bond=>graph.atomOrigins[bond.a]?.instanceId!==graph.atomOrigins[bond.b]?.instanceId);
  // Tether each monomer to its canonical conformation while resolving authored
  // inter-unit bonds and severe screen-plane overlap deterministically.
  for(let step=0;step<180;step++){
    const fx=raw.map(()=>0),fy=raw.map(()=>0);
    for(const bond of bonds){const a=raw[bond.a],b=raw[bond.b],dx=b.x-a.x,dy=b.y-a.y,distance=Math.max(.001,Math.hypot(dx,dy)),target=bondLength(a.element,b.element),strength=links.includes(bond)?.16:.075,force=(distance-target)*strength*(bond.order===1?1:.85),x=dx/distance*force,y=dy/distance*force;fx[bond.a]+=x;fy[bond.a]+=y;fx[bond.b]-=x;fy[bond.b]-=y;}
    for(let a=0;a<raw.length;a++)for(let b=a+1;b<raw.length;b++){
      if(bondSet.has(bondKey(a,b)))continue;const dx=raw[b].x-raw[a].x,dy=raw[b].y-raw[a].y,distance=Math.max(.001,Math.hypot(dx,dy)),cutoff=(modelAtomRadius(raw[a].element)+modelAtomRadius(raw[b].element))*.82;
      if(distance>=cutoff)continue;const force=(cutoff-distance)*.035,x=dx/distance*force,y=dy/distance*force;fx[a]-=x;fy[a]-=y;fx[b]+=x;fy[b]+=y;
    }
    const damping=.22;
    for(let index=0;index<raw.length;index++){const atom=raw[index];atom.x+=(fx[index]+(atom.initial.x-atom.x)*.018)*damping;atom.y+=(fy[index]+(atom.initial.y-atom.y)*.018)*damping;}
  }
  const minX=Math.min(...raw.map(atom=>atom.x)),maxX=Math.max(...raw.map(atom=>atom.x)),minY=Math.min(...raw.map(atom=>atom.y)),maxY=Math.max(...raw.map(atom=>atom.y)),centerX=(minX+maxX)*.5,centerY=(minY+maxY)*.5;
  const atoms=raw.map(atom=>({...atom,x:atom.x-centerX,y:atom.y-centerY}));
  const continuations=(sample.representation?.continuations??[]).map((item,index)=>{
    const atomIndex=Number.isInteger(item.atomRef)?item.atomRef:Number.parseInt(String(item.atomRef).split(':').at(-1),10),atom=atoms[atomIndex];
    const direction=index%2===0?1:-1;return{...item,atomIndex,x:atom?.x??0,y:(atom?.y??0)+direction*.95};
  });
  return{polymerId:sample.polymerId,routeId:sample.routeId,atoms,bonds,continuations,qualifiers:[...(sample.representation?.qualifiers??[])],bounds:{minX:minX-centerX,maxX:maxX-centerX,minY:minY-centerY,maxY:maxY-centerY,width:maxX-minX,height:maxY-minY},unitCount:units.length};
}

export function polymerPresentationSvg(sample,{sourceRecordsByInstanceId={},title='Representative polymer segment'}={}){
  const plan=createPolymerPresentationPlan(sample,{sourceRecordsByInstanceId}),padding=1.25,width=plan.bounds.width+padding*2,height=plan.bounds.height+padding*2+Math.min(1.25,plan.qualifiers.length*.3),scale=Math.min(140/Math.max(width,1),82/Math.max(height,1)),cx=96,cy=55;
  const project=atom=>({x:cx+atom.x*scale,y:cy-atom.y*scale}),shapes=[];
  for(const bond of plan.bonds){const a=project(plan.atoms[bond.a]),b=project(plan.atoms[bond.b]);shapes.push(`<path d="M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}" stroke="#91aebd" stroke-width="${Math.max(1.2,round(scale*.085))}" stroke-linecap="round"/>`);}
  for(const continuation of plan.continuations){const at=plan.atoms[continuation.atomIndex];if(!at)continue;const a=project(at),b={x:cx+continuation.x*scale,y:cy-continuation.y*scale};shapes.push(`<path data-polymer-continuation="true" d="M${round(a.x)} ${round(a.y)}L${round(b.x)} ${round(b.y)}" stroke="#83d7cd" stroke-width="1.6" stroke-dasharray="3 3"/><circle cx="${round(b.x)}" cy="${round(b.y)}" r="2.2" fill="none" stroke="#83d7cd"/>`);}
  for(const atom of plan.atoms){const {x,y}=project(atom),radius=Math.max(2,modelAtomRadius(atom.element)*scale*.68),color=ELEMENTS[atom.element]?.color??'#cbd5e1';shapes.push(`<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}" fill="${color}" stroke="#102433" stroke-opacity=".55" stroke-width=".55"/>`);}
  const qualifier=plan.qualifiers.length?`<text x="96" y="118" text-anchor="middle" fill="#a9c3cf" font-size="5.1" font-family="sans-serif">${escapeXml(plan.qualifiers.join(' · '))}</text>`:'';
  return`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 128" role="img" aria-label="${escapeXml(title)}" data-polymer-id="${escapeXml(plan.polymerId)}"><rect width="192" height="128" fill="#0b1924"/><g>${shapes.join('')}</g>${qualifier}</svg>\n`;
}
function escapeXml(value){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));}
