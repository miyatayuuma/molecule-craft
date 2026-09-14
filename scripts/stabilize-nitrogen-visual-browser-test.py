from pathlib import Path

p=Path('tests/nitrogen-field-pickup-browser.test.mjs')
text=p.read_text()
old="""  await new Promise(resolveWait=>setTimeout(resolveWait,300));
  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d'),rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),data=ctx.getImageData(Math.max(0,Math.min(canvas.width-1,Math.round(q.x*sx))),Math.max(0,Math.min(canvas.height-1,Math.round(q.y*sy))),1,1).data;return [data[0],data[1],data[2]];};return {n:sample(${visualPair.n}),h:sample(${visualPair.h})};})()`);
"""
new="""  const visualColors=await evaluate(`(()=>{const run=globalThis.__nitrogenPickupRun,renderer=globalThis.__nitrogenPickupRenderer,canvas=document.querySelector('#veil-canvas'),ctx=canvas.getContext('2d');renderer.reset();renderer.draw(run,0,false);const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height,sample=id=>{const d=run.map.dust.find(item=>item.id===id),q=renderer.screen(d.x,d.y),cx=Math.round(q.x*sx),cy=Math.round(q.y*sy),radius=Math.max(3,Math.round(6*Math.max(sx,sy))),left=Math.max(0,cx-radius),top=Math.max(0,cy-radius),right=Math.min(canvas.width,cx+radius+1),bottom=Math.min(canvas.height,cy+radius+1),pixels=ctx.getImageData(left,top,Math.max(1,right-left),Math.max(1,bottom-top)).data;let best=[0,0,0],score=-1;for(let i=0;i<pixels.length;i+=4){const next=pixels[i]+pixels[i+1]+pixels[i+2];if(pixels[i+3]>0&&next>score){score=next;best=[pixels[i],pixels[i+1],pixels[i+2]];}}return best;};return {n:sample(${visualPair.n}),h:sample(${visualPair.h})};})()`);
"""
if old not in text:
    raise SystemExit('visual browser timing anchor missing')
text=text.replace(old,new,1)
text=text.replace('assert.ok(visualDistance>35,`N and H dust must be visually distinguishable', 'assert.ok(visualDistance>50,`N and H dust must be visually distinguishable',1)
p.write_text(text)
