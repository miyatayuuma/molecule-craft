from pathlib import Path


def replace(path, old, new):
    p=Path(path); s=p.read_text()
    if new in s:
        return
    if old not in s:
        raise SystemExit(f'missing replacement in {path}: {old[:100]!r}')
    p.write_text(s.replace(old,new))

path='src/encyclopedia-chemistry-visuals.js'
p=Path(path); s=p.read_text()
s=s.replace("function drawDoubleBond(owner,svg,x1,y1,x2,y2){\n  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ox=-dy/len*3.2,oy=dx/len*3.2;\n  line(owner,svg,x1+ox,y1+oy,x2+ox,y2+oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round'});\n  line(owner,svg,x1-ox,y1-oy,x2-ox,y2-oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round'});\n}\nfunction drawSingleBond(owner,svg,x1,y1,x2,y2){line(owner,svg,x1,y1,x2,y2,{stroke:'#9eafc5','stroke-width':3,'stroke-linecap':'round'});}", "function drawDoubleBond(owner,svg,x1,y1,x2,y2,attrs={}){\n  const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,ox=-dy/len*3.2,oy=dx/len*3.2;\n  line(owner,svg,x1+ox,y1+oy,x2+ox,y2+oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round',...attrs});\n  line(owner,svg,x1-ox,y1-oy,x2-ox,y2-oy,{stroke:'#9eafc5','stroke-width':2.4,'stroke-linecap':'round',...attrs});\n}\nfunction drawSingleBond(owner,svg,x1,y1,x2,y2,attrs={}){line(owner,svg,x1,y1,x2,y2,{stroke:'#9eafc5','stroke-width':3,'stroke-linecap':'round',...attrs});}")
old="""function drawNitroContributor(owner,svg,cx,cy,flip=false){
  const n={x:cx,y:cy},r={x:cx-47,y:cy},top={x:cx+43,y:cy-29},bottom={x:cx+43,y:cy+29};
  drawSingleBond(owner,svg,r.x+13,r.y,n.x-14,n.y);flip?drawSingleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7):drawDoubleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7);
  flip?drawDoubleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7):drawSingleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7);
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N','+');atomLabel(owner,svg,top.x,top.y+7,'O',flip?'−':null);atomLabel(owner,svg,bottom.x,bottom.y+7,'O',flip?null:'−');
}
"""
new="""function drawNitroContributor(owner,svg,cx,cy,flip=false){
  const n={x:cx,y:cy},r={x:cx-47,y:cy},top={x:cx+43,y:cy-29},bottom={x:cx+43,y:cy+29},contributor=flip?'B':'A';
  const attrs=branch=>({'data-resonance-contributor':contributor,'data-resonance-branch':branch});
  drawSingleBond(owner,svg,r.x+13,r.y,n.x-14,n.y);
  if(flip){drawSingleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7,attrs('top'));drawDoubleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7,attrs('bottom'));}
  else{drawDoubleBond(owner,svg,n.x+13,n.y-7,top.x-14,top.y+7,attrs('top'));drawSingleBond(owner,svg,n.x+14,n.y+7,bottom.x-15,bottom.y-7,attrs('bottom'));}
  atomLabel(owner,svg,r.x,r.y+7,'R');atomLabel(owner,svg,n.x,n.y+7,'N','+');atomLabel(owner,svg,top.x,top.y+7,'O',flip?'−':null);atomLabel(owner,svg,bottom.x,bottom.y+7,'O',flip?null:'−');
}
"""
if old not in s: raise SystemExit('nitro contributor anchor missing')
s=s.replace(old,new)
old="""function drawOzoneContributor(owner,svg,cx,cy,flip=false){
  const left={x:cx-52,y:cy},mid={x:cx,y:cy},right={x:cx+52,y:cy};
  if(flip){drawDoubleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y);drawSingleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y);}else{drawSingleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y);drawDoubleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y);}
  atomLabel(owner,svg,left.x,left.y+7,'O',flip?null:'−');atomLabel(owner,svg,mid.x,mid.y+7,'O','+');atomLabel(owner,svg,right.x,right.y+7,'O',flip?'−':null);
}
"""
new="""function drawOzoneContributor(owner,svg,cx,cy,flip=false){
  const left={x:cx-52,y:cy},mid={x:cx,y:cy},right={x:cx+52,y:cy},contributor=flip?'B':'A';
  const attrs=branch=>({'data-resonance-contributor':contributor,'data-resonance-branch':branch});
  if(flip){drawDoubleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y,attrs('left'));drawSingleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y,attrs('right'));}else{drawSingleBond(owner,svg,left.x+14,left.y,mid.x-14,mid.y,attrs('left'));drawDoubleBond(owner,svg,mid.x+14,mid.y,right.x-14,right.y,attrs('right'));}
  atomLabel(owner,svg,left.x,left.y+7,'O',flip?null:'−');atomLabel(owner,svg,mid.x,mid.y+7,'O','+');atomLabel(owner,svg,right.x,right.y+7,'O',flip?'−':null);
}
"""
if old not in s: raise SystemExit('ozone contributor anchor missing')
s=s.replace(old,new)
p.write_text(s)

path='tests/encyclopedia-chemistry-visual-browser.test.mjs'
p=Path(path); s=p.read_text()
old="arrow:node.querySelector('[data-resonance-arrow=\"true\"]')?.textContent??''})),detail=document.querySelector('#collection-detail');"
new="arrow:node.querySelector('[data-resonance-arrow=\"true\"]')?.textContent??'',contributorBonds:Object.fromEntries(['A','B'].map(c=>[c,Object.fromEntries(['top','bottom','left','right'].map(branch=>[branch,node.querySelectorAll(`[data-resonance-contributor=\"${c}\"][data-resonance-branch=\"${branch}\"]`).length]))]))})),detail=document.querySelector('#collection-detail');"
if old not in s: raise SystemExit('browser inspection anchor missing')
s=s.replace(old,new)
old="const nitro=await inspect('nitromethane',{normalShot:true,detailShot:true});assert.deepEqual(nitro.visuals.map(v=>v.type),['resonance']);assert(nitro.visuals[0].arc);assert.equal(nitro.visuals[0].arrow,'↔');assert.match(nitro.visuals[0].text,/N|形式|Lewis/);"
new="const nitro=await inspect('nitromethane',{normalShot:true,detailShot:true});assert.deepEqual(nitro.visuals.map(v=>v.type),['resonance']);assert(nitro.visuals[0].arc);assert.equal(nitro.visuals[0].arrow,'↔');assert.match(nitro.visuals[0].text,/N|形式|Lewis/);assert.deepEqual(nitro.visuals[0].contributorBonds.A,{top:2,bottom:1,left:0,right:0},'nitro contributor A must be R–N+(=O)–O−');assert.deepEqual(nitro.visuals[0].contributorBonds.B,{top:1,bottom:2,left:0,right:0},'nitro contributor B must swap both bond order and O−');"
if old not in s: raise SystemExit('nitro assertion anchor missing')
s=s.replace(old,new)
old="const ozone=await inspect('ozone',{normalShot:true,detailShot:true});assert.deepEqual(ozone.visuals.map(v=>v.type),['resonance']);assert(ozone.visuals[0].arc);assert.equal(ozone.visuals[0].arrow,'↔');"
new="const ozone=await inspect('ozone',{normalShot:true,detailShot:true});assert.deepEqual(ozone.visuals.map(v=>v.type),['resonance']);assert(ozone.visuals[0].arc);assert.equal(ozone.visuals[0].arrow,'↔');assert.deepEqual(ozone.visuals[0].contributorBonds.A,{top:0,bottom:0,left:1,right:2},'ozone contributor A bond orders');assert.deepEqual(ozone.visuals[0].contributorBonds.B,{top:0,bottom:0,left:2,right:1},'ozone contributor B must swap bond order with terminal O−');"
if old not in s: raise SystemExit('ozone assertion anchor missing')
s=s.replace(old,new)
p.write_text(s)
