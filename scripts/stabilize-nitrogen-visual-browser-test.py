from pathlib import Path

p=Path('tests/nitrogen-field-pickup-browser.test.mjs')
text=p.read_text()
old="""  await new Promise(resolveWait=>setTimeout(resolveWait,300));
  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),data=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.round(q.x*sx))),Math.max(0,Math.min(canvas.height-1,Math.round(q.y*sy))),1,1).data;return [data[0],data[1],data[2]];};return {n:sample(${visualPair.n}),h:sample(${visualPair.h})};})()`);
"""
new="""  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d');renderer.reset();renderer.draw(run,0,false);const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),data=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.round(q.x*sx))),Math.max(0,Math.min(canvas.height-1,Math.round(q.y*sy))),1,1).data;return [data[0],data[1],data[2]];};return {n:sample(${visualPair.n}),h:sample(${visualPair.h})};})()`);
"""
if old not in text:
    raise SystemExit('visual browser timing anchor missing')
p.write_text(text.replace(old,new,1))
