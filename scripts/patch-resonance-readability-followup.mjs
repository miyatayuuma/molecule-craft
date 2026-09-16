import {readFile,writeFile} from 'node:fs/promises';

const edit=async(path,mutate)=>{
  const url=new URL(`../${path}`,import.meta.url),before=await readFile(url,'utf8'),after=mutate(before);
  if(after===before)throw new Error(`No changes produced for ${path}`);
  await writeFile(url,after);
};
const replace=(source,from,to,label)=>{
  if(!source.includes(from))throw new Error(`Patch anchor missing: ${label}`);
  return source.replace(from,to);
};

await edit('src/encyclopedia-chemistry-visuals.js',source=>{
  source=replace(source,"const SVG_NS='http://www.w3.org/2000/svg';","import {AROMATIC_STYLE} from './aromatic-rendering.js?v=27';\n\nconst SVG_NS='http://www.w3.org/2000/svg';",'chemistry visual accent import');
  source=replace(source,"if(aromatic){circle(owner,svg,cx,cy,r*.53,{fill:'none',stroke:'#67e8f9','stroke-width':4,'data-aromatic-circle':'true'});return;}","if(aromatic){circle(owner,svg,cx,cy,r*.53,{fill:'none',stroke:AROMATIC_STYLE.cssColor,'stroke-width':4,'data-aromatic-circle':'true'});return;}",'aromatic accent token');
  source=replace(source,`function drawDistributedBondComponent(owner,svg,center,end,other,branch){
  const dx=end.x-center.x,dy=end.y-center.y,len=Math.hypot(dx,dy)||1,otherX=other.x-center.x,otherY=other.y-center.y;
  let ix=-dy/len,iy=dx/len;if(ix*otherX+iy*otherY<0){ix=-ix;iy=-iy;}
  const offset=5.2,start=.29,finish=.71;
  line(owner,svg,center.x+dx*start+ix*offset,center.y+dy*start+iy*offset,center.x+dx*finish+ix*offset,center.y+dy*finish+iy*offset,{stroke:'#9eafc5','stroke-width':1.8,'stroke-opacity':.55,'stroke-linecap':'round','data-delocalization':'distributed-bond','data-resonance-branch':branch,'data-center-role':'center','data-terminal-role':'terminal'});
}`,`function drawDistributedBondComponent(owner,svg,start,end,insideTarget,branch){
  const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy)||1,mx=(start.x+end.x)/2,my=(start.y+end.y)/2;
  let ix=-dy/len,iy=dx/len;if(ix*(insideTarget.x-mx)+iy*(insideTarget.y-my)<0){ix=-ix;iy=-iy;}
  const offset=5.2;
  line(owner,svg,start.x+ix*offset,start.y+iy*offset,end.x+ix*offset,end.y+iy*offset,{stroke:AROMATIC_STYLE.cssColor,'stroke-width':3,'stroke-opacity':.68,'stroke-dasharray':'9 6','stroke-linecap':'round','data-delocalization':'distributed-bond','data-resonance-style':'distributed-dashed','data-resonance-branch':branch,'data-center-role':'center','data-terminal-role':'terminal'});
}`,'detail distributed line style');
  source=replace(source,`function drawNitroHybrid(owner,svg,cx,cy){
  const n={x:cx,y:cy},r={x:cx-52,y:cy},top={x:cx+48,y:cy-31},bottom={x:cx+48,y:cy+31};
  drawSingleBond(owner,svg,r.x+14,r.y,n.x-14,n.y);drawSingleBond(owner,svg,n.x+14,n.y-6,top.x-15,top.y+7);drawSingleBond(owner,svg,n.x+14,n.y+6,bottom.x-15,bottom.y-7);
  drawDistributedBondComponent(owner,svg,n,top,bottom,'top');drawDistributedBondComponent(owner,svg,n,bottom,top,'bottom');
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N');atomLabel(owner,svg,top.x,top.y+7,'O');atomLabel(owner,svg,bottom.x,bottom.y+7,'O');
}`,`function drawNitroHybrid(owner,svg,cx,cy){
  const n={x:cx,y:cy},r={x:cx-52,y:cy},top={x:cx+48,y:cy-31},bottom={x:cx+48,y:cy+31};
  const topStart={x:n.x+14,y:n.y-6},topEnd={x:top.x-15,y:top.y+7},bottomStart={x:n.x+14,y:n.y+6},bottomEnd={x:bottom.x-15,y:bottom.y-7};
  drawSingleBond(owner,svg,r.x+14,r.y,n.x-14,n.y);drawSingleBond(owner,svg,topStart.x,topStart.y,topEnd.x,topEnd.y);drawSingleBond(owner,svg,bottomStart.x,bottomStart.y,bottomEnd.x,bottomEnd.y);
  drawDistributedBondComponent(owner,svg,topStart,topEnd,bottom,'top');drawDistributedBondComponent(owner,svg,bottomStart,bottomEnd,top,'bottom');
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N');atomLabel(owner,svg,top.x,top.y+7,'O');atomLabel(owner,svg,bottom.x,bottom.y+7,'O');
}`,'nitro hybrid parallel geometry');
  source=replace(source,`function drawOzoneHybrid(owner,svg,cx,cy){
  const left={x:cx-58,y:cy+16},mid={x:cx,y:cy-8},right={x:cx+58,y:cy+16};
  drawSingleBond(owner,svg,left.x+14,left.y-6,mid.x-14,mid.y+6);drawSingleBond(owner,svg,mid.x+14,mid.y+6,right.x-14,right.y-6);
  drawDistributedBondComponent(owner,svg,mid,left,right,'left');drawDistributedBondComponent(owner,svg,mid,right,left,'right');
  atomLabel(owner,svg,left.x,left.y+7,'O');atomLabel(owner,svg,mid.x,mid.y+7,'O');atomLabel(owner,svg,right.x,right.y+7,'O');
}`,`function drawOzoneHybrid(owner,svg,cx,cy){
  const left={x:cx-58,y:cy+16},mid={x:cx,y:cy-8},right={x:cx+58,y:cy+16};
  const leftStart={x:left.x+14,y:left.y-6},leftEnd={x:mid.x-14,y:mid.y+6},rightStart={x:mid.x+14,y:mid.y+6},rightEnd={x:right.x-14,y:right.y-6};
  drawSingleBond(owner,svg,leftStart.x,leftStart.y,leftEnd.x,leftEnd.y);drawSingleBond(owner,svg,rightStart.x,rightStart.y,rightEnd.x,rightEnd.y);
  drawDistributedBondComponent(owner,svg,leftStart,leftEnd,right,'left');drawDistributedBondComponent(owner,svg,rightStart,rightEnd,left,'right');
  atomLabel(owner,svg,left.x,left.y+7,'O');atomLabel(owner,svg,mid.x,mid.y+7,'O');atomLabel(owner,svg,right.x,right.y+7,'O');
}`,'ozone hybrid parallel geometry');
  source=replace(source,`function renderResonance(owner,motif){
  const isNitro=motif==='nitro',label=isNitro?'ニトロ基':'オゾン';
  const svg=baseSvg(owner,\`${'${label}'}の2つのLewis共鳴寄与構造と、2本の中心-末端結合へ分散したπ結合成分のhybrid表現\`,'0 0 440 250');
  addText(owner,svg,110,20,'Lewis contributor A',{class:'chemistry-svg-label'});addText(owner,svg,330,20,'Lewis contributor B',{class:'chemistry-svg-label'});
  if(isNitro){drawNitroContributor(owner,svg,110,72,false);drawNitroContributor(owner,svg,330,72,true);}else{drawOzoneContributor(owner,svg,110,72,false);drawOzoneContributor(owner,svg,330,72,true);}
  addText(owner,svg,220,80,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,220,130,'実際には一方へ固定されない',{class:'chemistry-svg-label'});addText(owner,svg,220,151,'↓',{'font-size':22,class:'concept-flow-arrow'});
  if(isNitro)drawNitroHybrid(owner,svg,220,199);else drawOzoneHybrid(owner,svg,220,199);
  addText(owner,svg,220,240,'薄い2本目線 = 2本のbondへ分散したπ結合成分',{'font-size':12,class:'chemistry-svg-caption'});
  return figure(owner,'resonance','Resonance / 共鳴','↔は反応矢印ではありません。上はLewis共鳴寄与構造、下の薄い2本目線は追加のπ結合成分が2本のcenter–terminal bondへ分散したhybridを表します。',svg);
}`,`function renderResonance(owner,motif){
  const isNitro=motif==='nitro',label=isNitro?'ニトロ基':'オゾン';
  const svg=baseSvg(owner,\`${'${label}'}の2つのLewis共鳴寄与構造と、2本の中心-末端結合へ分散したresonance hybrid\`,'0 0 440 235');
  addText(owner,svg,110,20,'Lewis contributor A',{class:'chemistry-svg-label'});addText(owner,svg,330,20,'Lewis contributor B',{class:'chemistry-svg-label'});
  if(isNitro){drawNitroContributor(owner,svg,110,72,false);drawNitroContributor(owner,svg,330,72,true);}else{drawOzoneContributor(owner,svg,110,72,false);drawOzoneContributor(owner,svg,330,72,true);}
  addText(owner,svg,220,80,'↔',{'font-size':34,class:'resonance-arrow','data-resonance-arrow':'true'});
  addText(owner,svg,220,130,'Resonance hybrid / 共鳴混成体',{class:'chemistry-svg-label'});addText(owner,svg,220,151,'↓',{'font-size':22,class:'concept-flow-arrow'});
  if(isNitro)drawNitroHybrid(owner,svg,220,190);else drawOzoneHybrid(owner,svg,220,190);
  return figure(owner,'resonance','Resonance / 共鳴','↔は反応矢印ではなく、等価なLewis共鳴寄与構造を表します。',svg);
}`,'resonance explanation cleanup');
  if(source.includes('薄い2本目線')||source.includes("stroke:'#9eafc5','stroke-width':1.8"))throw new Error('Legacy thin-line resonance explanation/style remained');
  return source;
});

await edit('src/collection-ui.js',source=>{
  source=replace(source,"import {renderChemistryVisuals,validateChemistryVisualSpecs} from './encyclopedia-chemistry-visuals.js?v=2';","import {renderChemistryVisuals,validateChemistryVisualSpecs} from './encyclopedia-chemistry-visuals.js?v=3';",'collection chemistry visual cache key');
  source=replace(source,`  const noteKeys=['model',...(Array.isArray(catalogEntry.notes)?catalogEntry.notes:[])],noteTexts=noteKeys.map(key=>data.encyclopedia.noteDefinitions?.[key]).filter(Boolean);
  if(noteTexts.length){const noteHost=el('div',null,'model-collection-notes');noteHost.append(el('h4','模型・収録について'));for(const text of noteTexts)noteHost.append(el('p',text));extra.append(noteHost);}
`,'','remove repeated model notes');
  if(source.includes('模型・収録について')||source.includes('model-collection-notes'))throw new Error('Player-facing model note renderer remained');
  return source;
});

await edit('src/collection-viewer.js',source=>{
  source=replace(source,"import { AROMATIC_STYLE, aromaticBondKeys, displayedBondOrder, aromaticRingFrame, aromaticRingPoints, createAromaticRing, updateAromaticRing } from './aromatic-rendering.js?v=26';","import { AROMATIC_STYLE, aromaticBondKeys, displayedBondOrder, aromaticRingFrame, aromaticRingPoints, createAromaticRing, updateAromaticRing } from './aromatic-rendering.js?v=27';",'viewer aromatic cache key');
  source=replace(source,"import { specialEdgeKeys, sharedBondCurves, createSharedBonds, updateSharedBonds, createChargeLabel } from './special-bonds.js?v=31';","import { RESONANCE_STYLE, specialEdgeKeys, sharedBondCurves, createSharedBonds, updateSharedBonds, createChargeLabel } from './special-bonds.js?v=32';",'viewer resonance style import');
  source=replace(source,`    for(const shared of layout.sharedGroups??[])for(const curve of sharedBondCurves(THREE,shared,id=>layout.atoms[id].point,{mode:'encyclopedia'})){
      const points=curve.map(p=>p.applyQuaternion(group.quaternion));
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];if(Math.max(a.z,b.z)>=camera.position.z)continue;
        commands.push({z:(a.z+b.z)/2,draw:()=>{const p=project(a),q=project(b);context.save();context.strokeStyle='#8ce7ee';context.globalAlpha=.65;context.lineWidth=1.5;context.beginPath();context.moveTo(p.x,p.y);context.lineTo(q.x,q.y);context.stroke();context.restore();}});
      }
    }`, `    for(const shared of layout.sharedGroups??[]){const distributed=['nitro','ozone'].includes(shared.kind);for(const curve of sharedBondCurves(THREE,shared,id=>layout.atoms[id].point,{mode:'encyclopedia'})){
      const points=curve.map(p=>p.applyQuaternion(group.quaternion));
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i];if(Math.max(a.z,b.z)>=camera.position.z)continue;const z=(a.z+b.z)/2;
        commands.push({z,draw:()=>{const p=project(a),q=project(b),scale=height/(2*Math.tan(19*Math.PI/180)*(camera.position.z-z));context.save();context.strokeStyle=distributed?AROMATIC_STYLE.cssColor:'#8ce7ee';context.globalAlpha=distributed?RESONANCE_STYLE.opacity:.65;context.lineWidth=distributed?Math.max(2,scale*.07):1.5;context.lineCap='round';if(distributed)context.setLineDash([Math.max(5,scale*.11),Math.max(3,scale*.07)]);context.beginPath();context.moveTo(p.x,p.y);context.lineTo(q.x,q.y);context.stroke();context.restore();}});
      }
    }} `,'software resonance stroke');
  return source;
});

await edit('src/app.js',source=>{
  source=replace(source,"from './aromatic-rendering.js?v=26';","from './aromatic-rendering.js?v=27';",'CRAFT aromatic cache key');
  source=replace(source,"from './special-bonds.js?v=30';","from './special-bonds.js?v=32';",'CRAFT resonance cache key');
  return source;
});

await edit('scripts/build-collection-assets.mjs',source=>{
  source=replace(source,"import {aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints} from '../src/aromatic-rendering.js';","import {AROMATIC_STYLE,aromaticBondKeys,displayedBondOrder,aromaticRingFrame,aromaticRingPoints} from '../src/aromatic-rendering.js?v=27';",'asset aromatic style import');
  source=replace(source,"import {specialEdgeKeys,sharedBondCurves} from '../src/special-bonds.js?v=31';","import {RESONANCE_STYLE,specialEdgeKeys,sharedBondCurves} from '../src/special-bonds.js?v=32';",'asset resonance style import');
  source=replace(source,"  const radius=Math.max(1,...atoms.map(a=>a.point.length()+ELEMENTS[a.element].radius));const scale=52/radius;","  const radius=Math.max(1,...atoms.map(a=>a.point.length()+ELEMENTS[a.element].radius));const scale=52/radius,bondStrokeWidth=n(Math.max(1.6,scale*.09));",'asset bond width authority');
  source=replace(source,'stroke-width="${n(Math.max(1.6,scale*.09))}"','stroke-width="${bondStrokeWidth}"','asset main bond width reuse');
  source=replace(source,'stroke="#66d8dc" stroke-width="1.7"','stroke="${AROMATIC_STYLE.assetCssColor}" stroke-width="1.7"','asset aromatic accent token');
  source=replace(source,`      const points=curve.map(p=>project(p.applyQuaternion(rotation))),marker=distributed?\` data-resonance-distributed-bond="true" data-resonance-branch="${'${index}'}"\`:'',opacity=distributed?'.56':'.65',width=distributed?'1.25':'1.2',cap=distributed?' stroke-linecap="round"':'',stroke=distributed?'#90acbc':'#8ce7ee';
      shapes.push({z:points.reduce((sum,p)=>sum+p.z,0)/points.length,svg:\`<path${'${marker}'} d="${'${points.map((p,i)=>`${i?\'L\':\'M\'}${n(p.x)} ${n(p.y)}`).join(\'\')}'}" fill="none" stroke="${'${stroke}'}" stroke-opacity="${'${opacity}'}" stroke-width="${'${width}'}"${'${cap}'}/>\`});`, `      const points=curve.map(p=>project(p.applyQuaternion(rotation))),marker=distributed?\` data-resonance-distributed-bond="true" data-resonance-style="distributed-dashed" data-resonance-branch="${'${index}'}"\`:'',opacity=distributed?String(RESONANCE_STYLE.opacity):'.65',width=distributed?bondStrokeWidth:'1.2',cap=distributed?' stroke-linecap="round"':'',stroke=distributed?RESONANCE_STYLE.assetCssColor:'#8ce7ee',dash=distributed?\` stroke-dasharray="${'${n(bondStrokeWidth*3.2)}'} ${'${n(bondStrokeWidth*2.2)}'}"\`:'';
      shapes.push({z:points.reduce((sum,p)=>sum+p.z,0)/points.length,svg:\`<path${'${marker}'} d="${'${points.map((p,i)=>`${i?\'L\':\'M\'}${n(p.x)} ${n(p.y)}`).join(\'\')}'}" fill="none" stroke="${'${stroke}'}" stroke-opacity="${'${opacity}'}" stroke-width="${'${width}'}"${'${dash}'}${'${cap}'}/>\`});`,'asset distributed resonance style');
  return source;
});

await edit('tests/special-bonds-check.mjs',source=>{
  source=replace(source,"import {sharedBondCurves,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=31';","import {RESONANCE_STYLE,sharedBondCurves,createSharedBonds,updateSharedBonds} from '../src/special-bonds.js?v=32';",'special bond test style import');
  source=replace(source,"assert.equal(visual.children.filter(l=>l.visible).length,6);","assert.equal(visual.children.filter(l=>l.userData.sharedOxoLine&&l.visible).length,6);",'sulfur visible line contract');
  source=source.replaceAll('assert.equal(disposed,12);','assert.equal(disposed,28);');
  source=replace(source,`  const visible=visual.children.filter(line=>line.visible);assert.equal(visible.length,2,\`${'${record.id}'}: renderer exposes two auxiliary lines\`);
  visible.forEach((line,index)=>{assert.equal(line.userData.resonanceVisual,'distributed-bond-component');assert.equal(line.userData.resonanceBranch,index);assert.equal(line.material.color.getHex(),0x9eafc5);assert(line.material.opacity<.7,\`${'${record.id}'}: auxiliary line remains visually weaker than the main bond\`);});`, `  const visible=visual.children.filter(mesh=>mesh.userData.resonanceVisual==='distributed-bond-component'&&mesh.visible);assert.equal(visible.length,RESONANCE_STYLE.dashCount*2,\`${'${record.id}'}: renderer exposes thick dash segments on both auxiliary bonds\`);
  for(const branch of [0,1])assert.equal(visible.filter(mesh=>mesh.userData.resonanceBranch===branch).length,RESONANCE_STYLE.dashCount,\`${'${record.id}'}: each branch has a complete dash sequence\`);
  visible.forEach(mesh=>{assert.equal(mesh.userData.resonanceStyle,'distributed-dashed');assert.equal(mesh.userData.resonanceLineWidth,'bond');assert.equal(mesh.material.color.getHex(),RESONANCE_STYLE.color);assert.equal(mesh.material.opacity,RESONANCE_STYLE.opacity);assert.equal(mesh.scale.x,RESONANCE_STYLE.encyclopediaRadius);assert(mesh.scale.y>0&&Number.isFinite(mesh.scale.y),\`${'${record.id}'}: finite visible dash length\`);});`,'distributed mesh contract');
  return source;
});

await edit('tests/encyclopedia-chemistry-visuals.test.mjs',source=>{
  source=replace(source,"import {chemistryVisualSpecs,validateChemistryVisualSpecs} from '../src/encyclopedia-chemistry-visuals.js';","import {chemistryVisualSpecs,validateChemistryVisualSpecs} from '../src/encyclopedia-chemistry-visuals.js';\nimport {AROMATIC_STYLE} from '../src/aromatic-rendering.js?v=27';",'visual test accent import');
  source=replace(source,"const records=JSON.parse(await readFile(new URL('data/molecules.json',root),'utf8'));","const records=JSON.parse(await readFile(new URL('data/molecules.json',root),'utf8'));\nconst collectionUiSource=await readFile(new URL('src/collection-ui.js',root),'utf8'),pubchemSource=await readFile(new URL('src/pubchem-reference.js',root),'utf8'),visualSource=await readFile(new URL('src/encyclopedia-chemistry-visuals.js',root),'utf8');",'visual test source fixtures');
  source=replace(source,"assert.equal(validateChemistryVisualSpecs(encyclopedia,records),true);","assert.equal(validateChemistryVisualSpecs(encyclopedia,records),true);\nassert.doesNotMatch(collectionUiSource,/模型・収録について|model-collection-notes/,'Repeated model/collection note section must not be rendered');\nassert(encyclopedia.noteDefinitions?.model,'Internal model-note metadata may remain available for non-player-facing uses');\nassert.match(pubchemSource,/PubChem ↗/,'PubChem reference affordance remains intact');\nassert.match(visualSource,new RegExp(AROMATIC_STYLE.cssColor.replace('#','\\\\#')),'Chemistry detail visuals use the aromatic accent authority');\nassert.doesNotMatch(visualSource,/薄い2本目線/,'Line-style prose must not compete with the resonance diagram');",'note cleanup and visual source contracts');
  return source;
});

await edit('tests/encyclopedia-chemistry-visual-browser.test.mjs',source=>{
  source=replace(source,"distributed:[...node.querySelectorAll('[data-delocalization=\"distributed-bond\"]')].map(n=>n.dataset.resonanceBranch),formalPositions:","distributed:[...node.querySelectorAll('[data-delocalization=\"distributed-bond\"]')].map(n=>n.dataset.resonanceBranch),distributedStyles:[...node.querySelectorAll('[data-delocalization=\"distributed-bond\"]')].map(n=>({stroke:n.getAttribute('stroke'),width:Number(n.getAttribute('stroke-width')),opacity:Number(n.getAttribute('stroke-opacity')),dash:n.getAttribute('stroke-dasharray'),style:n.dataset.resonanceStyle})),formalPositions:",'browser resonance style capture');
  source=replace(source,"return{visuals,width:detail.clientWidth,scrollWidth:detail.scrollWidth,docWidth:document.documentElement.clientWidth,docScrollWidth:document.documentElement.scrollWidth};","return{visuals,width:detail.clientWidth,scrollWidth:detail.scrollWidth,docWidth:document.documentElement.clientWidth,docScrollWidth:document.documentElement.scrollWidth,noteSectionCount:detail.querySelectorAll('.model-collection-notes').length,detailText:detail.innerText};",'browser note capture');
  source=replace(source,"    assert(result.scrollWidth<=result.width+1,`${id}: Chemistry visual must not overflow detail on mobile`);assert(result.docScrollWidth<=result.docWidth+1,`${id}: Chemistry visual must not overflow page on mobile`);","    assert(result.scrollWidth<=result.width+1,`${id}: Chemistry visual must not overflow detail on mobile`);assert(result.docScrollWidth<=result.docWidth+1,`${id}: Chemistry visual must not overflow page on mobile`);assert.equal(result.noteSectionCount,0,`${id}: repeated model/collection note section removed`);assert.doesNotMatch(result.detailText,/模型・収録について/,`${id}: note heading must not remain`);",'browser note cleanup assertion');
  source=replace(source,"const nitro=await inspect('nitromethane',{normalShot:true,detailShot:true});assert.deepEqual(nitro.visuals.map(v=>v.type),['resonance']);assert.equal(nitro.visuals[0].arc,false);assert.deepEqual([...nitro.visuals[0].distributed].sort(),['bottom','top']);","const nitro=await inspect('nitromethane',{normalShot:true,detailShot:true});assert.deepEqual(nitro.visuals.map(v=>v.type),['resonance']);assert.equal(nitro.visuals[0].arc,false);assert.deepEqual([...nitro.visuals[0].distributed].sort(),['bottom','top']);assert(nitro.visuals[0].distributedStyles.every(style=>style.stroke==='#67e8f9'&&style.width===3&&style.opacity===.68&&style.dash&&style.style==='distributed-dashed'),'nitro hybrid uses visible cyan same-width dashed components');assert.doesNotMatch(nitro.visuals[0].text,/薄い2本目線/);",'nitro browser style assertion');
  source=replace(source,"const ozone=await inspect('ozone',{normalShot:true,detailShot:true});assert.deepEqual(ozone.visuals.map(v=>v.type),['resonance']);assert.equal(ozone.visuals[0].arc,false);assert.deepEqual([...ozone.visuals[0].distributed].sort(),['left','right']);","const ozone=await inspect('ozone',{normalShot:true,detailShot:true});assert.deepEqual(ozone.visuals.map(v=>v.type),['resonance']);assert.equal(ozone.visuals[0].arc,false);assert.deepEqual([...ozone.visuals[0].distributed].sort(),['left','right']);assert(ozone.visuals[0].distributedStyles.every(style=>style.stroke==='#67e8f9'&&style.width===3&&style.opacity===.68&&style.dash&&style.style==='distributed-dashed'),'ozone hybrid uses visible cyan same-width dashed components');assert.doesNotMatch(ozone.visuals[0].text,/薄い2本目線/);",'ozone browser style assertion');
  source=replace(source,"for(const [id,count] of [['nitromethane',2],['ozone',2],['nitrobenzene',2],['2-4-6-trinitrotoluene',6]]){assert.equal((assets[id].match(/data-resonance-distributed-bond=\\\"true\\\"/g)??[]).length,count,`${id}: generated normal structure needs two weak bond components per resonance group`);","for(const [id,count] of [['nitromethane',2],['ozone',2],['nitrobenzene',2],['2-4-6-trinitrotoluene',6]]){assert.equal((assets[id].match(/data-resonance-distributed-bond=\\\"true\\\"/g)??[]).length,count,`${id}: generated normal structure needs two weak bond components per resonance group`);assert.equal((assets[id].match(/data-resonance-style=\\\"distributed-dashed\\\"/g)??[]).length,count,`${id}: normal thumbnail resonance components are dashed`);assert.match(assets[id],/stroke=\\\"#66d8dc\\\"[^>]*stroke-opacity=\\\"0\\.68\\\"[^>]*stroke-width=\\\"[^\\\"]+\\\"[^>]*stroke-dasharray=\\\"[^\\\"]+\\\"/,`${id}: normal thumbnail uses readable aromatic-accent dashed components`);",'asset dash browser assertion');
  return source;
});

console.log('Applied resonance readability and Encyclopedia note cleanup patch.');
