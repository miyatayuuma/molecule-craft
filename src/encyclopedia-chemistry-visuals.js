import {AROMATIC_STYLE} from './aromatic-rendering.js?v=27';
import {aromaticGraphCycles} from './aromatic-graph.js?v=1';

const SVG_NS='http://www.w3.org/2000/svg';
const VISUAL_CONCEPT={aromaticity:'aromaticity',resonance:'resonance','distributed-bond':'bond-order','formal-charge':'formal-charge',polarity:'polarity'};
const RESONANCE_MOTIFS=new Set(['nitro','ozone']);
const DISTRIBUTED_MOTIFS=new Set(['sulfur-oxo']);
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
  if(aromatic){circle(owner,svg,cx,cy,r*.53,{fill:'none',stroke:AROMATIC_STYLE.cssColor,'stroke-width':4,'data-aromatic-circle':'true'});return;}
  for(const edgeIndex of [doubleOffset%2,(doubleOffset+2)%6,(doubleOffset+4)%6]){
    const a=points[edgeIndex],b=points[(edgeIndex+1)%6],toward=point=>({x:point.x+(cx-point.x)*.16,y:point.y+(cy-point.y)*.16});
    const aa=toward(a),bb=toward(b);line(owner,svg,aa.x,aa.y,bb.x,bb.y,{stroke:'#d6e5ee','stroke-width':2.4,'stroke-linecap':'round'});
  }
}
function renderBenzeneAromaticity(owner){
  const svg=baseSvg(owner,'芳香族性：2つのKekulé共鳴寄与構造と、環全体へ広がるπ電子を表す芳香環内円','0 0 420 245');
  addText(owner,svg,105,22,'寄与構造 A',{class:'chemistry-svg-label'});addText(owner,svg,315,22,'寄与構造 B',{class:'chemistry-svg-label'});
  drawRing(owner,svg,105,78,42,{doubleOffset:0});drawRing(owner,svg,315,78,42,{doubleOffset:1});
  addText(owner,svg,210,83,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,210,137,'↓',{'font-size':24,class:'concept-flow-arrow'});addText(owner,svg,210,158,'実際の電子構造',{class:'chemistry-svg-label'});
  drawRing(owner,svg,210,205,38,{aromatic:true});
  return figure(owner,'aromaticity','Aromaticity / 芳香族性','↔は反応ではなく等価な共鳴寄与構造。水色の内円は、π電子が環全体へ非局在化していることを表します。',svg);
}
function cycleMotif(cycle,record){
  const elements=cycle.map(id=>record?.atoms?.[id]);
  if(elements.length===6&&elements.every(element=>element==='C'))return 'benzene-like';
  if(elements.length===6&&elements.every(element=>element==='C'||element==='N')&&elements.includes('N'))return 'six-member-heteroaromatic';
  if(elements.length===5&&elements.every(element=>element==='C'||element==='O')&&elements.includes('O'))return 'five-member-oxygen-heteroaromatic';
  return 'supported-aromatic-cycle';
}
function renderHeteroaromaticity(owner,spec,record){
  const cycle=spec.cycle,elements=cycle.map(id=>record.atoms[id]),size=cycle.length,cx=162,cy=126,r=size===5?66:76;
  const points=cycle.map((_,index)=>{const angle=-Math.PI/2+index*Math.PI*2/size;return{x:cx+Math.cos(angle)*r,y:cy+Math.sin(angle)*r,angle};});
  const svg=baseSvg(owner,'実際の芳香環の原子と結合、環全体に広がる6π電子を示す模式図','0 0 420 260');
  addText(owner,svg,162,24,size===5?'5員芳香環':'6員芳香環',{class:'chemistry-svg-label'});
  for(let index=0;index<size;index++){
    const next=(index+1)%size,a=points[index],b=points[next],order=record.bonds.find(([left,right])=>(left===cycle[index]&&right===cycle[next])||(left===cycle[next]&&right===cycle[index]))?.[2]??1;
    const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1,trim=17,from={x:a.x+dx*trim/length,y:a.y+dy*trim/length},to={x:b.x-dx*trim/length,y:b.y-dy*trim/length};
    if(order===2)drawDoubleBond(owner,svg,from.x,from.y,to.x,to.y);else drawSingleBond(owner,svg,from.x,from.y,to.x,to.y);
  }
  circle(owner,svg,cx,cy,r*.48,{fill:'none',stroke:AROMATIC_STYLE.cssColor,'stroke-width':4,'data-aromatic-circle':'true'});
  cycle.forEach((id,index)=>{
    const point=points[index],element=elements[index];
    addText(owner,svg,point.x,point.y+7,element,{'font-size':23,'font-weight':700,class:'atom-label','data-aromatic-atom-index':id,'data-aromatic-atom-element':element});
    if(size===6&&element==='N'){
      const x=point.x+Math.cos(point.angle)*21,y=point.y+Math.sin(point.angle)*21;
      addText(owner,svg,x,y+4,'··',{'font-size':18,'font-weight':700,class:'lone-pair-label','data-lone-pair-role':'in-plane-not-pi'});
    }
    if(size===5&&element==='O'){
      const inner={x:point.x-Math.cos(point.angle)*18,y:point.y-Math.sin(point.angle)*18},outer={x:point.x+Math.cos(point.angle)*20,y:point.y+Math.sin(point.angle)*20};
      addText(owner,svg,inner.x,inner.y+4,'··',{'font-size':18,'font-weight':700,class:'lone-pair-label pi-contributing','data-lone-pair-role':'pi-contributing'});
      addText(owner,svg,outer.x,outer.y+4,'··',{'font-size':18,'font-weight':700,class:'lone-pair-label','data-lone-pair-role':'in-plane'});
    }
  });
  addText(owner,svg,329,99,'6π電子',{class:'chemistry-svg-label','data-pi-electron-count':'6'});
  if(size===6&&elements.includes('N'))addText(owner,svg,329,128,'Nの孤立電子対',{class:'chemistry-svg-label'});
  if(size===5&&elements.includes('O'))addText(owner,svg,329,128,'Oの孤立電子対1組がπ系へ',{class:'chemistry-svg-label'});
  addText(owner,svg,210,225,'環原子と結合次数は分子グラフから表示',{class:'chemistry-svg-caption'});
  const description=size===6&&elements.includes('N')?'Nの孤立電子対は環面内にあり、6π電子の芳香族π系には含まれません。':size===5&&elements.includes('O')?'Oの孤立電子対の一組がπ系へ寄与し、環の6π電子をつくります。':'環全体へ6π電子が非局在化しています。';
  return figure(owner,'aromaticity','Aromaticity / 芳香族性',description,svg);
}
function renderAromaticity(owner,spec,record){
  return spec.motif==='benzene-like'?renderBenzeneAromaticity(owner):renderHeteroaromaticity(owner,spec,record);
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
function drawDistributedBondComponent(owner,svg,start,end,insideTarget,branch){
  const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
  let ix=-dy/len,iy=dx/len;if(ix*(insideTarget.x-mx)+iy*(insideTarget.y-my)<0){ix=-ix;iy=-iy;}
  const offset=5.2;
  line(owner,svg,start.x+ix*offset,start.y+iy*offset,end.x+ix*offset,end.y+iy*offset,{stroke:AROMATIC_STYLE.cssColor,'stroke-width':3,'stroke-opacity':.68,'stroke-dasharray':'9 6','stroke-linecap':'round','data-delocalization':'distributed-bond','data-resonance-style':'distributed-dashed','data-resonance-branch':branch,'data-center-role':'center','data-terminal-role':'terminal'});
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
  const topStart={x:n.x+14,y:n.y-6},topEnd={x:top.x-15,y:top.y+7},bottomStart={x:n.x+14,y:n.y+6},bottomEnd={x:bottom.x-15,y:bottom.y-7};
  drawSingleBond(owner,svg,r.x+14,r.y,n.x-14,n.y);drawSingleBond(owner,svg,topStart.x,topStart.y,topEnd.x,topEnd.y);drawSingleBond(owner,svg,bottomStart.x,bottomStart.y,bottomEnd.x,bottomEnd.y);
  drawDistributedBondComponent(owner,svg,topStart,topEnd,bottom,'top');drawDistributedBondComponent(owner,svg,bottomStart,bottomEnd,top,'bottom');
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N');atomLabel(owner,svg,top.x,top.y+7,'O');atomLabel(owner,svg,bottom.x,bottom.y+7,'O');
}
function drawOzoneHybrid(owner,svg,cx,cy){
  const left={x:cx-58,y:cy+16},mid={x:cx,y:cy-8},right={x:cx+58,y:cy+16};
  const leftStart={x:left.x+14,y:left.y-6},leftEnd={x:mid.x-14,y:mid.y+6},rightStart={x:mid.x+14,y:mid.y+6},rightEnd={x:right.x-14,y:right.y-6};
  drawSingleBond(owner,svg,leftStart.x,leftStart.y,leftEnd.x,leftEnd.y);drawSingleBond(owner,svg,rightStart.x,rightStart.y,rightEnd.x,rightEnd.y);
  drawDistributedBondComponent(owner,svg,leftStart,leftEnd,right,'left');drawDistributedBondComponent(owner,svg,rightStart,rightEnd,left,'right');
  atomLabel(owner,svg,left.x,left.y+7,'O');atomLabel(owner,svg,mid.x,mid.y+7,'O');atomLabel(owner,svg,right.x,right.y+7,'O');
}
function renderResonance(owner,motif){
  const isNitro=motif==='nitro',label=isNitro?'ニトロ基':'オゾン';
  const svg=baseSvg(owner,`${label}の2つのLewis共鳴寄与構造と、2本の中心-末端結合へ分散したresonance hybrid`,'0 0 440 235');
  addText(owner,svg,110,20,'Lewis contributor A',{class:'chemistry-svg-label'});addText(owner,svg,330,20,'Lewis contributor B',{class:'chemistry-svg-label'});
  if(isNitro){drawNitroContributor(owner,svg,110,72,false);drawNitroContributor(owner,svg,330,72,true);}else{drawOzoneContributor(owner,svg,110,72,false);drawOzoneContributor(owner,svg,330,72,true);}
  addText(owner,svg,220,80,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,220,130,'Resonance hybrid / 共鳴混成体',{class:'chemistry-svg-label'});addText(owner,svg,220,151,'↓',{'font-size':22,class:'concept-flow-arrow'});
  if(isNitro)drawNitroHybrid(owner,svg,220,190);else drawOzoneHybrid(owner,svg,220,190);
  return figure(owner,'resonance','Resonance / 共鳴','↔は反応矢印ではなく、等価なLewis共鳴寄与構造を表します。',svg);
}
function sulfurOxoTopology(record){
  if(!record?.atoms||!record?.bonds)return null;
  const adjacency=record.atoms.map(()=>[]);
  for(const [a,b,order] of record.bonds){adjacency[a]?.push({id:b,order});adjacency[b]?.push({id:a,order});}
  const sulfurIds=record.atoms.flatMap((element,id)=>element==='S'?[id]:[]);if(sulfurIds.length!==1)return null;
  const center=sulfurIds[0],neighbors=adjacency[center]??[];
  const terminal=neighbors.filter(edge=>edge.order===2&&record.atoms[edge.id]==='O'&&adjacency[edge.id].length===1).map(edge=>edge.id);
  const hydroxyls=neighbors.filter(edge=>edge.order===1&&record.atoms[edge.id]==='O'&&adjacency[edge.id].some(other=>other.order===1&&record.atoms[other.id]==='H')).map(edge=>edge.id);
  return terminal.length>=2?{center,terminal,hydroxyls,adjacency}:null;
}
function drawSulfurAuxiliary(owner,svg,start,end,insideTarget,branch){
  const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
  let ix=-dy/len,iy=dx/len;if(ix*(insideTarget.x-mx)+iy*(insideTarget.y-my)<0){ix=-ix;iy=-iy;}
  const offset=5.2;
  line(owner,svg,start.x+ix*offset,start.y+iy*offset,end.x+ix*offset,end.y+iy*offset,{stroke:AROMATIC_STYLE.cssColor,'stroke-width':3,'stroke-opacity':.82,'stroke-dasharray':'9 6','stroke-linecap':'round','data-delocalization':'distributed-bond','data-distributed-style':'distributed-dashed','data-distributed-branch':branch,'data-distribution-semantics':'sulfur-oxo','data-sulfur-bond-role':'terminal'});
}
function sulfurOxoPositions(topology,cx,cy){
  const {terminal,hydroxyls}=topology,positions=new Map(),all=[...terminal,...hydroxyls];
  const place=(ids,angles,radius)=>ids.forEach((id,index)=>{const angle=angles[index];positions.set(id,{x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius});});
  if(terminal.length===3){place(terminal,[-Math.PI/2,Math.PI/6,5*Math.PI/6],61);}
  else if(hydroxyls.length===2){place(terminal,[-3*Math.PI/4,-Math.PI/4],58);place(hydroxyls,[3*Math.PI/4,Math.PI/4],58);}
  else if(terminal.length===2){place(terminal,[3*Math.PI/4,Math.PI/4],66);}
  else place(all,all.map((_,index)=>-Math.PI/2+index*Math.PI*2/all.length),60);
  return positions;
}
function sulfurPanel(owner,svg,record,topology,cx,{model=false}={}){
  const cy=128,center={x:cx,y:cy},positions=sulfurOxoPositions(topology,cx,cy),terminalSet=new Set(topology.terminal);
  addText(owner,svg,cx,28,model?'模型での表示':'正準Lewis表記',{class:'chemistry-svg-label','data-sulfur-panel':model?'model':'canonical'});
  const branchCoords=new Map();
  for(const id of [...topology.terminal,...topology.hydroxyls]){
    const point=positions.get(id),dx=point.x-cx,dy=point.y-cy,length=Math.hypot(dx,dy)||1;
    const start={x:cx+dx*14/length,y:cy+dy*14/length},end={x:point.x-dx*15/length,y:point.y-dy*15/length};
    const order=terminalSet.has(id)?(model?1:2):1;
    const bondAttrs={'data-sulfur-bond-panel':model?'model':'canonical','data-sulfur-bond-role':terminalSet.has(id)?'terminal':'s-oh','data-sulfur-bond-order':order};
    if(order===2)drawDoubleBond(owner,svg,start.x,start.y,end.x,end.y,bondAttrs);else drawSingleBond(owner,svg,start.x,start.y,end.x,end.y,bondAttrs);
    branchCoords.set(id,{start,end});
  }
  if(model)topology.terminal.forEach((id,index)=>{
    const {start,end}=branchCoords.get(id),inside=positions.get(topology.terminal.find(other=>other!==id))??center;
    drawSulfurAuxiliary(owner,svg,start,end,inside,index);
  });
  if(topology.hydroxyls.length){
    for(const id of topology.hydroxyls){
      const point=positions.get(id),dx=point.x-cx,dy=point.y-cy,length=Math.hypot(dx,dy)||1,h={x:point.x+dx/length*27,y:point.y+dy/length*27};
      drawSingleBond(owner,svg,point.x+dx/length*12,point.y+dy/length*12,h.x-dx/length*10,h.y-dy/length*10,{'data-sulfur-bond-panel':model?'model':'canonical','data-sulfur-bond-role':'o-h','data-sulfur-bond-order':1});
      addText(owner,svg,h.x,h.y+6,'H',{'font-size':18,'font-weight':700,class:'atom-label'});
    }
  }
  atomLabel(owner,svg,cx,cy+8,'S');
  for(const id of [...topology.terminal,...topology.hydroxyls]){const point=positions.get(id);atomLabel(owner,svg,point.x,point.y+8,'O');}
}
function renderDistributedBond(owner,spec,record){
  const topology=sulfurOxoTopology(record),svg=baseSvg(owner,'canonical Lewis graph and sulfur-oxo model representation with supplementary cyan dashed terminal S–O components','0 0 520 260');
  sulfurPanel(owner,svg,record,topology,130);line(owner,svg,260,49,260,211,{stroke:'#53657b','stroke-width':1.5,'data-visual-separator':'true'});sulfurPanel(owner,svg,record,topology,390,{model:true});
  return figure(owner,'distributed-bond','Distributed Bond / 分散結合の補助表示','水色破線は通常の局在した追加結合線そのものではなく、S–O結合性を補助的に示す模型記号です。ニトロ基やオゾンの図のように、等価なLewis寄与構造の間で単結合と二重結合が交換する意味ではありません。',svg);
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

function recordAromaticCycles(record){
  if(!record?.atoms||!record?.bonds)return[];
  const atoms=record.atoms.map((element,id)=>({id,element,formalCharge:Number(record.formalCharges?.[id]??0)}));
  return aromaticGraphCycles(atoms,record.bonds);
}
export function chemistryVisualSpecs(entry={},record=null){
  const explicit=Array.isArray(entry.visuals)?entry.visuals.map(item=>({...item})):[];
  if(entry.concepts?.includes('aromaticity')&&!explicit.some(item=>item.type==='aromaticity')){
    explicit.unshift(...recordAromaticCycles(record).map(cycle=>({type:'aromaticity',motif:cycleMotif(cycle,record),cycle,target:'aromatic-ring'})));
  }
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
  if(DISTRIBUTED_MOTIFS.has(motif))return !!sulfurOxoTopology(record);
  return true;
}
function sameCycleMembers(a,b){return a.length===b.length&&a.every(id=>b.includes(id));}
export function validateChemistryVisualSpecs(encyclopedia,records=[]){
  const byId=new Map(records.map(record=>[record.id,record]));
  for(const [id,entry] of Object.entries(encyclopedia?.molecules??{})){
    if(entry.visuals!=null&&!Array.isArray(entry.visuals))throw new Error(`${id}: visuals must be an array`);
    const record=byId.get(id);
    for(const [index,spec] of chemistryVisualSpecs(entry,record).entries()){
      const label=`${id} visual ${index}`;if(!spec||typeof spec!=='object')throw new Error(`${label}: spec must be an object`);
      if(!VISUAL_CONCEPT[spec.type])throw new Error(`${label}: unsupported visual type ${spec.type}`);
      if(typeof spec.target!=='string'||!spec.target.trim())throw new Error(`${label}: missing target`);
      if(!entry.concepts?.includes(VISUAL_CONCEPT[spec.type]))throw new Error(`${label}: ${spec.type} requires concept ${VISUAL_CONCEPT[spec.type]}`);
      if(spec.formalCharges&&spec.partialCharges)throw new Error(`${label}: formal and partial charge annotations cannot be mixed`);
      if(spec.formalCharges)assertChargeObject(spec.formalCharges,label);
      if(spec.partialCharges)assertChargeObject(spec.partialCharges,label,{partial:true});
      if(spec.type==='aromaticity'){
        if(!['benzene-like','six-member-heteroaromatic','five-member-oxygen-heteroaromatic','supported-aromatic-cycle'].includes(spec.motif))throw new Error(`${label}: unsupported aromaticity motif`);
        if(!Array.isArray(spec.cycle)||spec.cycle.length<5||spec.cycle.length>6)throw new Error(`${label}: aromaticity visual requires a topology-derived cycle`);
        if(records.length&&!recordAromaticCycles(record).some(cycle=>sameCycleMembers(cycle,spec.cycle)))throw new Error(`${label}: aromaticity visual cycle is not authoritative for molecule topology`);
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
      if(spec.type==='distributed-bond'){
        if(!DISTRIBUTED_MOTIFS.has(spec.motif))throw new Error(`${label}: unsupported distributed-bond motif ${spec.motif}`);
        if(spec.formalCharges||spec.partialCharges)throw new Error(`${label}: distributed-bond visual cannot own charge annotations`);
        const topology=sulfurOxoTopology(record);
        if(records.length&&(!topology||topology.terminal.length!==spec.branches))throw new Error(`${label}: sulfur-oxo branch count does not match terminal S=O topology`);
        if(RESONANCE_MOTIFS.has(spec.motif))throw new Error(`${label}: distributed-bond motif cannot reuse resonance semantics`);
      }
    }
  }
  return true;
}
export function renderChemistryVisuals(owner,entry,record){
  return chemistryVisualSpecs(entry,record).map(spec=>{
    if(spec.type==='aromaticity')return renderAromaticity(owner,spec,record);
    if(spec.type==='resonance')return renderResonance(owner,spec.motif);
    if(spec.type==='distributed-bond')return renderDistributedBond(owner,spec,record);
    if(spec.type==='formal-charge')return renderFormalCharge(owner);
    if(spec.type==='polarity')return renderPolarity(owner,spec.motif);
    return null;
  }).filter(Boolean).map(node=>{node.dataset.moleculeId=record?.id??'';return node;});
}
