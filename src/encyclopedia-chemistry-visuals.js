const SVG_NS='http://www.w3.org/2000/svg';
const VISUAL_CONCEPT={aromaticity:'aromaticity',resonance:'resonance','formal-charge':'formal-charge',polarity:'polarity'};
const RESONANCE_MOTIFS=new Set(['nitro','ozone']);
const FORMAL_MOTIFS=new Set(['carbon-monoxide']);
const POLARITY_MOTIFS=new Set(['water','hydrogen-chloride','alcohol','carbonyl']);
const PARTIAL_VALUES=new Set(['δ+','δ−']);

function svgNode(owner,tag,attrs={},text=null){
  const node=owner.createElementNS(SVG_NS,tag);
  for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
  if(text!=null)node.textContent=text;
  return node;
}
function addText(owner,svg,x,y,text,attrs={}){svg.append(svgNode(owner,'text',{x,y,'text-anchor':'middle',...attrs},text));}
function line(owner,svg,x1,y1,x2,y2,attrs={}){svg.append(svgNode(owner,'line',{x1,y1,x2,y2,...attrs}));}
function circle(owner,svg,cx,cy,r,attrs={}){svg.append(svgNode(owner,'circle',{cx,cy,r,...attrs}));}
function baseSvg(owner,label,viewBox='0 0 420 220'){
  const svg=svgNode(owner,'svg',{viewBox,class:'chemistry-concept-svg',role:'img','aria-label':label,preserveAspectRatio:'xMidYMid meet'});
  svg.dataset.visualGrammar='chemistry-detail';return svg;
}
function figure(owner,type,title,caption,svg){
  const node=owner.createElement('figure');node.className='chemistry-concept-visual';node.dataset.visualType=type;
  const heading=owner.createElement('h6');heading.textContent=title;const text=owner.createElement('figcaption');text.textContent=caption;
  node.append(heading,svg,text);return node;
}
function ringPoints(cx,cy,r){return Array.from({length:6},(_,i)=>{const a=(-90+i*60)*Math.PI/180;return{x:cx+Math.cos(a)*r,y:cy+Math.sin(a)*r};});}
function drawRing(owner,svg,cx,cy,r,{doubleOffset=0,aromatic=false}={}){
  const points=ringPoints(cx,cy,r);svg.append(svgNode(owner,'polygon',{points:points.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:'#9eafc5','stroke-width':3,'stroke-linejoin':'round'}));
  if(aromatic){circle(owner,svg,cx,cy,r*.53,{fill:'none',stroke:'#67e8f9','stroke-width':4,'data-aromatic-circle':'true'});return;}
  for(const edgeIndex of [doubleOffset%2,(doubleOffset+2)%6,(doubleOffset+4)%6]){
    const a=points[edgeIndex],b=points[(edgeIndex+1)%6],toward=point=>({x:point.x+(cx-point.x)*.16,y:point.y+(cy-point.y)*.16});
    const aa=toward(a),bb=toward(b);line(owner,svg,aa.x,aa.y,bb.x,bb.y,{stroke:'#d6e5ee','stroke-width':2.4,'stroke-linecap':'round'});
  }
}
function renderAromaticity(owner){
  const svg=baseSvg(owner,'芳香族性：2つのKekulé共鳴寄与構造と、環全体へ広がるπ電子を表す芳香環内円','0 0 420 245');
  addText(owner,svg,105,22,'寄与構造 A',{class:'chemistry-svg-label'});addText(owner,svg,315,22,'寄与構造 B',{class:'chemistry-svg-label'});
  drawRing(owner,svg,105,78,42,{doubleOffset:0});drawRing(owner,svg,315,78,42,{doubleOffset:1});
  addText(owner,svg,210,83,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,210,137,'↓',{'font-size':24,class:'concept-flow-arrow'});addText(owner,svg,210,158,'実際の電子構造',{class:'chemistry-svg-label'});
  drawRing(owner,svg,210,205,38,{aromatic:true});
  return figure(owner,'aromaticity','Aromaticity / 芳香族性','↔は反応ではなく等価な共鳴寄与構造。水色の内円は、π電子が環全体へ非局在化していることを表します。',svg);
}
function atomLabel(owner,svg,x,y,symbol,charge=null,{partial=false,chargeDx=18,chargeDy=-17,chargeRole=null}={}){
  addText(owner,svg,x,y,symbol,{'font-size':24,'font-weight':700,class:'atom-label'});
  if(charge){
    const attrs={'font-size':partial?14:18,'font-weight':700,class:partial?'partial-charge':'formal-charge','data-charge-kind':partial?'partial':'formal'};
    if(chargeRole)attrs['data-charge-role']=chargeRole;
    if(!partial)Object.assign(attrs,{stroke:'#0b1420','stroke-width':3,'paint-order':'stroke fill','stroke-linejoin':'round'});
    addText(owner,svg,x+chargeDx,y+chargeDy,charge,attrs);
  }
}
function drawDoubleBond(owner,svg,x1,y1,x2,y2,attrs={}){
  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ox=-dy/len*3.2,oy=dx/len*3.2;
  line(owner,svg,x1+ox,y1+oy,x2+ox,y2+oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round',...attrs});
  line(owner,svg,x1-ox,y1-oy,x2-ox,y2-oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round',...attrs});
}
function drawSingleBond(owner,svg,x1,y1,x2,y2,attrs={}){line(owner,svg,x1,y1,x2,y2,{stroke:'#9eafc5','stroke-width':3,'stroke-linecap':'round',...attrs});}
function drawDistributedBondComponent(owner,svg,center,end,other,branch){
  const dx=end.x-center.x,dy=end.y-center.y,len=Math.hypot(dx,dy)||1,otherX=other.x-center.x,otherY=other.y-center.y;
  let ix=-dy/len,iy=dx/len;if(ix*otherX+iy*otherY<0){ix=-ix;iy=-iy;}
  const offset=5.2,start=.29,finish=.71;
  line(owner,svg,center.x+dx*start+ix*offset,center.y+dy*start+iy*offset,center.x+dx*finish+ix*offset,center.y+dy*finish+iy*offset,{stroke:'#9eafc5','stroke-width':1.8,'stroke-opacity':.55,'stroke-linecap':'round','data-delocalization':'distributed-bond','data-resonance-branch':branch,'data-center-role':'center','data-terminal-role':'terminal'});
}
function drawNitroContributor(owner,svg,cx,cy,flip=false){
  const n={x:cx,y:cy},r={x:cx-47,y:cy},top={x:cx+43,y:cy-29},bottom={x:cx+43,y:cy+29},contributor=flip?'B':'A';
  const attrs=branch=>({'data-resonance-contributor':contributor,'data-resonance-branch':branch});
  drawSingleBond(owner,svg,r.x+13,r.y,n.x-14,n.y);
  if(flip){drawSingleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7,attrs('top'));drawDoubleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7,attrs('bottom'));}
  else{drawDoubleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7,attrs('top'));drawSingleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7,attrs('bottom'));}
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N','+',{chargeDx:2,chargeDy:-28,chargeRole:'center'});atomLabel(owner,svg,top.x,top.y+7,'O',flip?'−':null,{chargeDx:18,chargeDy:-17,chargeRole:'terminal'});atomLabel(owner,svg,bottom.x,bottom.y+7,'O',flip?null:'−',{chargeDx:18,chargeDy:-17,chargeRole:'terminal'});
}
function drawOzoneContributor(owner,svg,cx,cy,flip=false){
  const left={x:cx-52,y:cy},mid={x:cx,y:cy},right={x:cx+52,y:cy},contributor=flip?'B':'A';
  const attrs=branch=>({'data-resonance-contributor':contributor,'data-resonance-branch':branch});
  if(flip){drawDoubleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y,attrs('left'));drawSingleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y,attrs('right'));}else{drawSingleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y,attrs('left'));drawDoubleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y,attrs('right'));}
  atomLabel(owner,svg,left.x,left.y+7,'O',flip?null:'−',{chargeDx:-18,chargeDy:-17,chargeRole:'terminal'});atomLabel(owner,svg,mid.x,mid.y+7,'O','+',{chargeDx:0,chargeDy:-28,chargeRole:'center'});atomLabel(owner,svg,right.x,right.y+7,'O',flip?'−':null,{chargeDx:18,chargeDy:-17,chargeRole:'terminal'});
}
function drawNitroHybrid(owner,svg,cx,cy){
  const n={x:cx,y:cy},r={x:cx-52,y:cy},top={x:cx+48,y:cy-31},bottom={x:cx+48,y:cy+31};
  drawSingleBond(owner,svg,r.x+14,r.y,n.x-14,n.y);drawSingleBond(owner,svg,n.x+14,n.y-6,top.x-15,top.y+7);drawSingleBond(owner,svg,n.x+14,n.y+6,bottom.x-15,bottom.y-7);
  drawDistributedBondComponent(owner,svg,n,top,bottom,'top');drawDistributedBondComponent(owner,svg,n,bottom,top,'bottom');
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N');atomLabel(owner,svg,top.x,top.y+7,'O');atomLabel(owner,svg,bottom.x,bottom.y+7,'O');
}
function drawOzoneHybrid(owner,svg,cx,cy){
  const left={x:cx-58,y:cy+16},mid={x:cx,y:cy-8},right={x:cx+58,y:cy+16};
  drawSingleBond(owner,svg,left.x+14,left.y-6,mid.x-14,mid.y+6);drawSingleBond(owner,svg,mid.x+14,mid.y+6,right.x-14,right.y-6);
  drawDistributedBondComponent(owner,svg,mid,left,right,'left');drawDistributedBondComponent(owner,svg,mid,right,left,'right');
  atomLabel(owner,svg,left.x,left.y+7,'O');atomLabel(owner,svg,mid.x,mid.y+7,'O');atomLabel(owner,svg,right.x,right.y+7,'O');
}
function renderResonance(owner,motif){
  const isNitro=motif==='nitro',label=isNitro?'ニトロ基':'オゾン';
  const svg=baseSvg(owner,`${label}の2つのLewis共鳴寄与構造と、2本の中心-末端結合へ分散したπ結合成分のhybrid表現`,'0 0 440 250');
  addText(owner,svg,110,20,'Lewis contributor A',{class:'chemistry-svg-label'});addText(owner,svg,330,20,'Lewis contributor B',{class:'chemistry-svg-label'});
  if(isNitro){drawNitroContributor(owner,svg,110,72,false);drawNitroContributor(owner,svg,330,72,true);}else{drawOzoneContributor(owner,svg,110,72,false);drawOzoneContributor(owner,svg,330,72,true);}
  addText(owner,svg,220,80,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,220,130,'実際には一方へ固定されない',{class:'chemistry-svg-label'});addText(owner,svg,220,151,'↓',{'font-size':22,class:'concept-flow-arrow'});
  if(isNitro)drawNitroHybrid(owner,svg,220,199);else drawOzoneHybrid(owner,svg,220,199);
  addText(owner,svg,220,240,'薄い2本目線 = 2本のbondへ分散したπ結合成分',{'font-size':12,class:'chemistry-svg-caption'});
  return figure(owner,'resonance','Resonance / 共鳴','↔は反応矢印ではありません。上はLewis共鳴寄与構造、下の薄い2本目線は追加のπ結合成分が2本のcenter–terminal bondへ分散したhybridを表します。',svg);
}
function renderFormalCharge(owner){
  const svg=baseSvg(owner,'一酸化炭素の代表的Lewis構造 C−≡O+ と、整数の形式電荷','0 0 420 135');
  addText(owner,svg,210,25,'代表的なLewis構造',{class:'chemistry-svg-label'});
  atomLabel(owner,svg,165,78,'C','−');atomLabel(owner,svg,255,78,'O','+');
  for(const offset of [-6,0,6])line(owner,svg,187,72+offset,233,72+offset,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round'});
  addText(owner,svg,210,118,'− と + は形式電荷（整数）',{class:'chemistry-svg-caption','data-charge-kind':'formal'});
  return figure(owner,'formal-charge','Formal Charge / 形式電荷','COは分子全体では中性でも、代表的Lewis構造ではC⁻≡O⁺と形式電荷を割り当てます。形式電荷は部分電荷δとは別の記号です。',svg);
}
function renderPolarity(owner,motif){
  const labels={water:'水', 'hydrogen-chloride':'塩化水素',alcohol:'アルコールのO–H部分',carbonyl:'カルボニル基'};
  const svg=baseSvg(owner,`${labels[motif]}の部分電荷 δ+ / δ−`,'0 0 420 145');
  addText(owner,svg,210,24,'部分電荷',{class:'chemistry-svg-label'});
  if(motif==='water'){
    const o={x:210,y:74},l={x:150,y:110},r={x:270,y:110};drawSingleBond(owner,svg,l.x+14,l.y-8,o.x-16,o.y+7);drawSingleBond(owner,svg,o.x+16,o.y+7,r.x-14,r.y-8);atomLabel(owner,svg,l.x,l.y,'H','δ+',{partial:true});atomLabel(owner,svg,o.x,o.y,'O','δ−',{partial:true});atomLabel(owner,svg,r.x,r.y,'H','δ+',{partial:true});
  }else if(motif==='hydrogen-chloride'){
    drawSingleBond(owner,svg,165,78,255,78);atomLabel(owner,svg,145,85,'H','δ+',{partial:true});atomLabel(owner,svg,275,85,'Cl','δ−',{partial:true});
  }else if(motif==='alcohol'){
    drawSingleBond(owner,svg,138,79,195,79);drawSingleBond(owner,svg,225,79,282,79);atomLabel(owner,svg,120,86,'R');atomLabel(owner,svg,210,86,'O','δ−',{partial:true});atomLabel(owner,svg,300,86,'H','δ+',{partial:true});
  }else{
    drawDoubleBond(owner,svg,190,79,260,79);addText(owner,svg,150,86,'R₂',{'font-size':22,'font-weight':700,class:'atom-label'});drawSingleBond(owner,svg,166,79,184,79);atomLabel(owner,svg,180,86,'C','δ+',{partial:true});atomLabel(owner,svg,278,86,'O','δ−',{partial:true});
  }
  addText(owner,svg,210,132,'δ+ / δ− = 部分電荷（formal charge の + / − とは別）',{class:'chemistry-svg-caption','data-charge-kind':'partial'});
  return figure(owner,'polarity','Polarity / 極性','δ+ / δ−は結合内の電子の偏りを表す部分電荷です。整数の形式電荷 + / − とは区別して読みます。',svg);
}

export function chemistryVisualSpecs(entry={}){
  const explicit=Array.isArray(entry.visuals)?entry.visuals.map(item=>({...item})):[];
  if(entry.concepts?.includes('aromaticity')&&!explicit.some(item=>item.type==='aromaticity'))explicit.unshift({type:'aromaticity',motif:'benzene-like',target:'aromatic-ring'});
  return explicit;
}
function assertChargeObject(value,label,{partial=false}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||!Object.keys(value).length)throw new Error(`${label}: charge annotation must be a non-empty object`);
  for(const [role,charge] of Object.entries(value)){
    if(!role)throw new Error(`${label}: charge role is required`);
    if(partial){if(!PARTIAL_VALUES.has(charge))throw new Error(`${label}: partial charge must be δ+ or δ−`);}
    else if(!Number.isInteger(charge)||charge===0)throw new Error(`${label}: formal charge must be a non-zero integer`);
  }
}
function recordSupportsMotif(record,motif){
  if(!record)return false;
  if(motif==='carbon-monoxide')return record.atoms?.length===2&&record.atoms?.includes('C')&&record.atoms?.includes('O')&&record.bonds?.some(([, ,order])=>order===3);
  if(RESONANCE_MOTIFS.has(motif))return (record.resonanceGroups??[]).some(group=>{
    const center=record.atoms?.[group.center],ends=(group.ends??[]).map(index=>record.atoms?.[index]);
    return ends.length===2&&ends.every(element=>element==='O')&&(motif==='nitro'?center==='N':center==='O');
  });
  return true;
}
export function validateChemistryVisualSpecs(encyclopedia,records=[]){
  const byId=new Map(records.map(record=>[record.id,record]));
  for(const [id,entry] of Object.entries(encyclopedia?.molecules??{})){
    if(entry.visuals!=null&&!Array.isArray(entry.visuals))throw new Error(`${id}: visuals must be an array`);
    for(const [index,spec] of chemistryVisualSpecs(entry).entries()){
      const label=`${id} visual ${index}`;if(!spec||typeof spec!=='object')throw new Error(`${label}: spec must be an object`);
      if(!VISUAL_CONCEPT[spec.type])throw new Error(`${label}: unsupported visual type ${spec.type}`);
      if(typeof spec.target!=='string'||!spec.target.trim())throw new Error(`${label}: missing target`);
      if(!entry.concepts?.includes(VISUAL_CONCEPT[spec.type]))throw new Error(`${label}: ${spec.type} requires concept ${VISUAL_CONCEPT[spec.type]}`);
      if(spec.formalCharges&&spec.partialCharges)throw new Error(`${label}: formal and partial charge annotations cannot be mixed`);
      if(spec.formalCharges)assertChargeObject(spec.formalCharges,label);
      if(spec.partialCharges)assertChargeObject(spec.partialCharges,label,{partial:true});
      if(spec.type==='aromaticity'){
        if(spec.motif!=='benzene-like')throw new Error(`${label}: unsupported aromaticity motif`);
        if(spec.formalCharges||spec.partialCharges)throw new Error(`${label}: aromaticity visual cannot own charge annotations`);
      }
      if(spec.type==='resonance'){
        if(!RESONANCE_MOTIFS.has(spec.motif))throw new Error(`${label}: unsupported resonance motif ${spec.motif}`);
        if(!spec.formalCharges)throw new Error(`${label}: resonance contributors require curated formal charges`);
        if(spec.formalCharges.center!==1||spec.formalCharges.terminal!==-1)throw new Error(`${label}: resonance formal charges must be center +1 / terminal -1`);
        if(records.length&&!recordSupportsMotif(byId.get(id),spec.motif))throw new Error(`${label}: resonance target does not match molecule topology`);
      }
      if(spec.type==='formal-charge'){
        if(!FORMAL_MOTIFS.has(spec.motif))throw new Error(`${label}: unsupported formal-charge motif ${spec.motif}`);
        if(!spec.formalCharges||spec.formalCharges.left!==-1||spec.formalCharges.right!==1)throw new Error(`${label}: CO visual requires left -1 / right +1`);
        if(records.length&&!recordSupportsMotif(byId.get(id),spec.motif))throw new Error(`${label}: formal-charge target does not match molecule topology`);
      }
      if(spec.type==='polarity'){
        if(!POLARITY_MOTIFS.has(spec.motif))throw new Error(`${label}: unsupported polarity motif ${spec.motif}`);
        if(!spec.partialCharges)throw new Error(`${label}: polarity visual requires curated partial charges`);
      }
    }
  }
  return true;
}
export function renderChemistryVisuals(owner,entry,record){
  return chemistryVisualSpecs(entry).map(spec=>{
    if(spec.type==='aromaticity')return renderAromaticity(owner);
    if(spec.type==='resonance')return renderResonance(owner,spec.motif);
    if(spec.type==='formal-charge')return renderFormalCharge(owner);
    if(spec.type==='polarity')return renderPolarity(owner,spec.motif);
    return null;
  }).filter(Boolean).map(node=>{node.dataset.moleculeId=record?.id??'';return node;});
}
