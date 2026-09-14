from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    "src/element-progression.js",
    "const extra=root.querySelector('#show-extra-elements'),visible=symbol=>['H','C','O'].includes(symbol)||!!extra?.checked;",
    "const extra=root.querySelector('#show-extra-elements'),visible=symbol=>['H','C','N','O'].includes(symbol)||!!extra?.checked;",
)

replace_once("src/app.js", "./element-progression.js?v=38", "./element-progression.js?v=39")
replace_once(
    "src/app.js",
    "onCraft:()=>{collectionGame?.refreshProgress();if(renderer){resize();refresh();}}",
    "onCraft:()=>{elementPalette.update();syncCraftStock();collectionGame?.refreshProgress();if(renderer){resize();refresh();}}",
)
replace_once("index.html", "./src/app.js?v=52", "./src/app.js?v=53")

replace_once(
    "src/veil/renderer.js",
    "carbon:'207,154,255',oxygen:'255,157,119'",
    "carbon:'207,154,255',nitrogen:'59,130,246',oxygen:'255,157,119'",
)
replace_once(
    "src/veil/renderer.js",
    "const element=route.element??'H',color=element==='C'?'#54345f':element==='O'?'#70433d':route.kind==='dense'?'#214f62':'#142e40';",
    "const element=route.element??'H',color=element==='C'?'#54345f':element==='N'?'#315c9f':element==='O'?'#70433d':route.kind==='dense'?'#214f62':'#142e40';",
)
replace_once(
    "src/veil/renderer.js",
    "const rare=dust.kind==='rare',element=dust.element??'H',kind=rare?'rare':element==='C'?'carbon':element==='O'?'oxygen':dust.kind;",
    "const rare=dust.kind==='rare',element=dust.element??'H',kind=rare?'rare':element==='C'?'carbon':element==='N'?'nitrogen':element==='O'?'oxygen':dust.kind;",
)
replace_once(
    "src/veil/renderer.js",
    "glow(q.x,q.y,(rare?38:element==='C'?28:element==='O'?25:22)*scale,kind);",
    "glow(q.x,q.y,(rare?38:element==='C'?28:element==='N'?27:element==='O'?25:22)*scale,kind);",
)
replace_once(
    "src/veil/renderer.js",
    "else{ctx.fillStyle=rare?'#ffe2a1':element==='O'?'#ffd2bd':'#d1f5ff';ctx.beginPath();ctx.arc(q.x,q.y,(rare?4:element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}",
    "else{ctx.fillStyle=rare?'#ffe2a1':element==='N'?'#93c5fd':element==='O'?'#ffd2bd':'#d1f5ff';ctx.beginPath();ctx.arc(q.x,q.y,(rare?4:element==='N'?3.2:element==='O'?3:2.5)*scale,0,Math.PI*2);ctx.fill();}",
)
replace_once(
    "src/veil/renderer.js",
    "e.kind==='rare'?'#edd099':e.kind==='carbon'?'#d7a9ef':e.kind==='oxygen'?'#ffad8f':'#9eeaff'",
    "e.kind==='rare'?'#edd099':e.kind==='carbon'?'#d7a9ef':e.kind==='nitrogen'?'#60a5fa':e.kind==='oxygen'?'#ffad8f':'#9eeaff'",
)

browser = Path("tests/nitrogen-field-pickup-browser.test.mjs")
text = browser.read_text()
anchor = "  const armedPickup=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,dust=run.map.dust.find(d=>d.element==='N'&&d.route==='nitrogen-main');if(!dust)return false;run.predators=false;globalThis.__nitrogenPickupDustId=dust.id;globalThis.__nitrogenPickupUnitsBefore=run.elementDust.N;Object.assign(run.player,{x:dust.x,y:dust.y,angle:dust.angle,vx:0,vy:0,speed:0});return true;})()`);assert.equal(armedPickup,true,'N pickup fixture must find mainline dust');"
visual = """  const visualPair=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,n=run.map.dust.find(d=>d.element==='N'&&d.route==='nitrogen-main');if(!n)return null;const id=Math.max(...run.map.dust.map(d=>d.id))+1000,h={...n,id,x:n.x+90,baseX:n.x+90,element:'H',kind:'normal',route:'test-h-visual'};run.map.dust.push(h);run.predators=false;Object.assign(run.player,{x:n.x,y:n.y+150,angle:n.angle,vx:0,vy:0,speed:0});globalThis.__nitrogenVisualH=id;return {n:n.id,h:id};})()`);assert.ok(visualPair,'visual regression requires an authored N dust sample');
  await new Promise(resolveWait=>setTimeout(resolveWait,300));
  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),data=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.round(q.x*sx))),Math.max(0,Math.min(canvas.height-1,Math.round(q.y*sy))),1,1).data;return [data[0],data[1],data[2]];};return {n:sample(%s),h:sample(%s)};})()`);
  const visualDistance=Math.hypot(...visualColors.n.map((value,index)=>value-visualColors.h[index]));assert.ok(visualDistance>35,`N and H dust must be visually distinguishable in the production canvas: ${JSON.stringify(visualColors)}`);
  await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun;run.map.dust=run.map.dust.filter(d=>d.id!==globalThis.__nitrogenVisualH);delete globalThis.__nitrogenVisualH;})()`);

""" % ("${visualPair.n}", "${visualPair.h}") + anchor
if anchor not in text:
    raise SystemExit("browser visual insertion anchor missing")
text = text.replace(anchor, visual, 1)
return_anchor = "  assert.ok(returned.cargo>=cargoBeforeReturn,'anchor lock may collect additional nearby N but cannot lose already collected cargo on normal return');assert.equal(returned.stock,returned.cargo,'normal return must settle the final run-local N cargo into BASE STOCK');assert.equal(returned.found,true);assert.match(returned.summary,/N \\+[1-9]/,'return summary must expose settled N');"
palette = return_anchor + """
  await waitFor(`(()=>{const button=document.querySelector('#element-palette [data-element="N"]'),stock=document.querySelector('[data-element-stock="N"]');return button&&!button.hidden&&!button.disabled&&Number(stock?.textContent)>0;})()`,'CRAFT N atom did not become available after returning with discovered N',80);
  const craftN=await evaluate(`(()=>{const button=document.querySelector('#element-palette [data-element="N"]'),stock=document.querySelector('[data-element-stock="N"]'),extra=document.querySelector('#show-extra-elements');return {hidden:button.hidden,disabled:button.disabled,stock:Number(stock.textContent),extraChecked:extra.checked};})()`);assert.equal(craftN.hidden,false);assert.equal(craftN.disabled,false);assert.equal(craftN.stock,returned.stock);assert.equal(craftN.extraChecked,false,'N must be a normal progression element, not dependent on the optional extra-elements toggle');
"""
if return_anchor not in text:
    raise SystemExit("browser palette insertion anchor missing")
browser.write_text(text.replace(return_anchor, palette, 1))

validation = Path(".github/workflows/repository-validation.yml")
text = validation.read_text()
old = "          node tests/nitrogen-field-integration.test.mjs\n          node tests/nitrogen-field-pickup-browser.test.mjs"
new = "          node tests/nitrogen-field-integration.test.mjs\n          node tests/nitrogen-visual-identity.test.mjs\n          node tests/nitrogen-field-pickup-browser.test.mjs"
if old not in text:
    raise SystemExit("validation insertion anchor missing")
validation.write_text(text.replace(old, new, 1))
