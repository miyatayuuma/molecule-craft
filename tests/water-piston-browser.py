from playwright.sync_api import sync_playwright
from pathlib import Path
import json
import os
import re
import shutil
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class QuietHandler(SimpleHTTPRequestHandler):
 def log_message(self, *args):
  pass

server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
threading.Thread(target=server.serve_forever,daemon=True).start()
Path('shots').mkdir(exist_ok=True)
html=Path('index.html').read_text()
html=re.sub(r'\s*<script type="module" src="./src/(?:app|pwa).js[^"]*"></script>','',html)
def verify_phase_chamber(page, touch, box, substance):
 from datetime import datetime, timezone, timedelta

 dry_ice=substance=='carbon-dioxide'
 name='co2' if dry_ice else 'ethanol'
 motion_dir=os.environ.get('PHASE_MOTION')
 frame=0
 if motion_dir:
  motion_dir=Path(motion_dir)/name
  motion_dir.mkdir(parents=True,exist_ok=True)
 slider=page.locator('#water-temp')
 if not dry_ice:
  slider.evaluate('(e)=>{e.value=30; e.dispatchEvent(new Event("input"))}')
  page.wait_for_function("document.querySelector('.water-identity small').dataset.phase==='liquid' && document.querySelector('.water-degrees').value==='30'",timeout=45000)
  frame_times,force_times=page.evaluate('''async()=>{window.forceTimes=[];let frames=[],last=await new Promise(requestAnimationFrame);
   while(frames.length<100){let t=await new Promise(requestAnimationFrame);frames.push(t-last);last=t}
   return [frames,window.forceTimes]}''')
  assert len(force_times)>10
  for label,values in [('frame',frame_times),('Stage A',force_times)]:
   values.sort()
   print(name,label,'median/p95 ms',values[len(values)//2],values[int(.95*len(values))],flush=True)
  page.locator('.water-close').evaluate('e=>e.click()')
  page.locator('#open-water-piston').evaluate('e=>e.click()')
  page.wait_for_selector('.water-stage canvas',state='attached')
 clock=page.clock
 start=datetime(2024,1,1,tzinfo=timezone.utc)
 clock.install(time=start)
 clock.pause_at(start+timedelta(seconds=1))
 slider=page.locator('#water-temp')
 grip=page.locator('.water-grip')
 phase=page.locator('.water-identity small')
 bands=page.locator('.water-phase-strip i')
 pressure=lambda: float(page.locator('.water-pressure').inner_text())

 def heat(t):
  rect=slider.bounding_box()
  lo,hi,step=[float(slider.get_attribute(attr)) for attr in ('min','max','step')]
  x=rect['x']+8+(rect['width']-16)*(t-lo)/(hi-lo)
  y=rect['y']+rect['height']/2
  touch('Start',[(x,y)]);touch('End',[])
  diff=round((t-float(slider.input_value()))/step)
  for _ in range(abs(diff)):slider.press('ArrowRight' if diff>0 else 'ArrowLeft')
  assert float(slider.input_value())==t

 def piston(dy):
  x,y=box(grip)
  touch('Start',[(x,y)]);touch('Move',[(x,y+dy)]);touch('End',[])

 def expect(state):
  assert phase.get_attribute('data-phase')==state,phase.inner_text()
  if dry_ice:assert bands.nth(1).evaluate("e=>e.style.getPropertyValue('--share')")=='0'
  assert .5<=pressure()<=3
  assert grip.bounding_box()['x']+grip.bounding_box()['width']<=390-16

 def advance(ms):
  nonlocal frame
  if not motion_dir:
   clock.run_for(ms)
   return
  while ms>0:
   interval=min(ms,166)
   clock.run_for(interval)
   page.screenshot(path=str(motion_dir/f'{frame:04d}.png'))
   frame+=1
   ms-=interval

 def shot(state):page.screenshot(path=f'shots/{name}-{state}.png')

 assert page.locator('.water-stage canvas').count()
 expect('gas');shot('gas')
 share=lambda: float(bands.nth(2).evaluate("e=>e.style.getPropertyValue('--share')"))
 if dry_ice:
  heat(-100)
  advance(2450);expect('depositing')
  advance(3900);expect('ice');shot('solid')
  heat(-80);advance(1800)
  piston(-110);advance(2100);expect('solidGas')
  assert .87<pressure()<.90
  vapor=share()
  assert .30<vapor<.85,vapor
  advance(700);assert share()==vapor
  shot('coexistence')
  piston(58);advance(2200);expect('solidGas')
  assert 0<share()<vapor
  heat(-40);advance(500);expect('sublimating')
  advance(4800);expect('gas')
 else:
  heat(72);advance(4300);expect('liquid');shot('liquid')
  piston(-116);advance(2300);expect('mixed')
  vapor=share()
  assert .25<vapor<.8 and .75<pressure()<.80,(vapor,pressure())
  shot('coexistence')
  piston(65);advance(2100);expect('mixed')
  assert 0<share()<vapor
  piston(90);advance(1900);expect('liquid')
  heat(-130);advance(7000);expect('ice');shot('solid')
  heat(130);advance(3500);expect('liquid')
  advance(5300);expect('gas')

 page.locator('.water-reset').evaluate('e=>e.click()')
 clock.run_for(7000);expect('gas')
 assert pressure()==1
 page.locator('.water-close').evaluate('e=>e.click()')
 assert page.locator('#open-water-piston').is_visible()
 page.locator('#open-water-piston').evaluate('e=>e.click()')
 page.wait_for_selector('.water-stage canvas',state='attached')
 expect('gas');assert pressure()==1
 page.locator('.water-close').evaluate('e=>e.click()')

with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'])
 substance=os.environ.get('PISTON_SUBSTANCE','water')
 comparison=os.environ.get('WATER_COMPARISON')
 new_substance=substance in ('carbon-dioxide','ethanol')
 for w,h in ([(390,844)] if comparison or new_substance else [(390,844),(360,740),(1280,800)]):
  ctx=b.new_context(viewport={'width':w,'height':h},has_touch=w<500,is_mobile=w<500,device_scale_factor=1)
  p=ctx.new_page(); errors=[];p.on('pageerror',lambda err:errors.append(str(err)))
  p.route('**/fixture',lambda r:r.fulfill(body=html,content_type='text/html'))
  if comparison or new_substance:
   p.add_init_script("let seed=124; Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)")
  if comparison or substance=='ethanol':
   def instrument(route):
    code=Path('src/reaction-lab-stage-a.js').read_text().replace('export function evaluateStageAForces(', 'function evaluateUnmeasured(')
    code+="\nexport function evaluateStageAForces(...args){const t=performance.now();const result=evaluateUnmeasured(...args);window.forceTimes?.push(performance.now()-t);return result}"
    route.fulfill(body=code,content_type='application/javascript')
   p.route('**/reaction-lab-stage-a.js',instrument)
  p.goto(f'http://127.0.0.1:{server.server_port}/fixture')
  p.evaluate('''async(id)=>{const c=await import('/src/chemistry.js');await c.loadMoleculeDatabase();
  const ui=await import('/src/collection-ui.js');
  const preset={schemaVersion:3,discoveredMolecules:[{id,at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
  const data=new Map([['molecule-craft.collection.v1',JSON.stringify(preset)]]);window.data=data;
  window.book=await ui.createCollectionUI({records:c.moleculeCatalog(),storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},onPlace(){},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});
  book.openEntry('molecules',id);}''',substance)
  save=p.evaluate('JSON.stringify([...data])')
  p.locator('#open-water-piston').click()
  grip=p.locator('.water-grip'); stage=p.locator('.water-stage')
  gauge=lambda:float(p.locator('.water-pressure').inner_text())
  def box(loc):
   r=loc.bounding_box();return [r['x']+r['width']/2,r['y']+r['height']/2]
  def settle():p.wait_for_timeout(850)
  if new_substance:
   client=ctx.new_cdp_session(p)
   def touch(kind,points):
    client.send('Input.dispatchTouchEvent',{'type':'touch'+kind,'touchPoints':[{'x':x,'y':y,'id':i+1} for i,(x,y) in enumerate(points)]})
   verify_phase_chamber(p,touch,box,substance)
   assert save==p.evaluate('JSON.stringify([...data])')
   p.add_init_script('''(id=>localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({
    schemaVersion:3,discoveredMolecules:[{id,at:1,order:1}],discoveredGroups:[],
    unlockedStructures:[],legacyElements:[],milestones:[]})))(''' + json.dumps(substance) + ')')
   p.goto(f'http://127.0.0.1:{server.server_port}/?reactionLabTest=1')
   p.wait_for_function("!document.querySelector('#open-reaction-lab').disabled")
   p.evaluate("id=>dispatchEvent(new CustomEvent('molecule-craft:open-molecule',{detail:{id}}))",substance)
   p.locator('#open-water-piston').click()
   p.wait_for_selector('.water-stage canvas',state='attached')
   p.locator('.water-close').click()
   assert p.locator('#open-water-piston').is_visible()
   assert not errors,errors
   print(w,substance,'passed',flush=True)
   ctx.close()
   continue
  if comparison:
   out=Path(comparison)
   out.mkdir(parents=True,exist_ok=True)
   def set_temp(t):
    p.locator('#water-temp').evaluate('(e,t)=>{e.value=t;e.dispatchEvent(new Event("input"))}',t)
   liquid=25 if substance=='water' else -170
   set_temp(liquid)
   p.wait_for_selector('[data-phase=liquid]')
   frames,costs=p.evaluate("""async()=>{window.forceTimes=[];let frames=[],last=await new Promise(requestAnimationFrame);
    while(frames.length<100){let t=await new Promise(requestAnimationFrame);frames.push(t-last);last=t}
    return [frames,window.forceTimes]}""")
   for label,values in [('frame',frames),('interaction',costs)]:
    values.sort()
    print(out.name,label,'median/p95 ms',values[len(values)//2],values[int(.95*len(values))],flush=True)
   # Replay from the same seed under a controlled animation clock for paired frames.
   from datetime import datetime,timezone,timedelta
   p.clock.install(time=datetime(2024,1,1,tzinfo=timezone.utc))
   p.clock.pause_at(datetime(2024,1,1,tzinfo=timezone.utc)+timedelta(seconds=1))
   p.locator('.water-close').evaluate('e=>e.click()')
   p.evaluate('let s=124; Math.random=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)')
   p.locator('#open-water-piston').evaluate('e=>e.click()')
   p.wait_for_selector('.water-stage canvas',state='attached')
   set_temp(liquid)
   p.clock.run_for(6500)
   for sequence,temp in ([('liquid',25),('freeze',-10),('melt',8)] if substance=='water' else [('liquid',liquid),('freeze',-195),('melt',-120),('gas',-120)]):
    set_temp(temp)
    for k in range(20):
     p.clock.run_for(200)
     p.screenshot(path=str(out/f'{sequence}-{k:02d}.png'))
   if substance=='methane':
    assert p.locator('[data-phase=gas]').count()
    set_temp(-165);p.clock.run_for(6000)
    assert p.locator('[data-phase=liquid]').count()
    for _ in range(8):grip.press('ArrowUp')
    p.clock.run_for(2000)
    assert p.locator('[data-phase=mixed]').count()
    p.screenshot(path=str(out/'coexistence.png'))
    for _ in range(10):grip.press('ArrowDown')
    p.clock.run_for(2000)
    assert p.locator('[data-phase=liquid]').count()
    p.locator('.water-reset').evaluate('e=>e.click()')
    p.clock.run_for(7500)
    assert gauge()==1 and p.locator('[data-phase=gas]').count()
    p.locator('.water-close').evaluate('e=>e.click()')
    assert p.locator('#open-water-piston').is_visible()
   assert not errors,errors
   ctx.close()
   continue
  settle()
  assert gauge()==1 and p.locator('.water-stage canvas').count()
  p.screenshot(path=f'shots/water-piston-{w}.png')
  print(w,'initial',gauge(),box(grip),flush=True)
  client=ctx.new_cdp_session(p)
  def touch(kind,points):
   client.send('Input.dispatchTouchEvent',{'type':'touch'+kind,'touchPoints':[{'x':a,'y':b,'id':i+1} for i,(a,b) in enumerate(points)]})
  x,y=box(grip)
  if w<500:
   touch('Start',[(x,y)])
   for step in range(1,9):touch('Move',[(x,y+step*8)])
   settle(); mid=gauge();assert mid>1
   touch('Move',[(x,y-20)]);settle();assert gauge()<1
   touch('Move',[(x,h-115)]);p.wait_for_function("Number(document.querySelector('.water-pressure').value)>2.70");settle();compressed=gauge()
   r=p.locator('#water-temp').bounding_box(); xx=r['x']+r['width']-5; yy=r['y']+r['height']/2
   touch('Start',[(x,h-115),(xx,yy)]);settle()
   hot=gauge();assert hot>compressed and hot<3.02,(hot,compressed)
   touch('Move',[(x,h-115),(r['x']+8+(r['width']-16)*170/230,yy)])
   p.wait_for_function("Number(document.querySelector('.water-pressure').value)<"+str(compressed))
   assert 139<=int(p.locator('#water-temp').input_value())<=141
   touch('End',[]);settle()
   p.screenshot(path=f'shots/water-compressed-{w}.png')
   x,y=box(grip);touch('Start',[(x,y)]);touch('Move',[(x,95)]);touch('End',[]);settle()
   assert .48<gauge()<.53,gauge()
   xx,yy=box(stage);touch('Start',[(xx,yy)]);touch('Move',[(xx+75,yy)]);touch('End',[])
   p.screenshot(path=f'shots/water-expanded-{w}.png')
  else:
   p.mouse.move(x,y);p.mouse.down();p.mouse.move(x,y+150,steps=12);p.mouse.up();settle();assert gauge()>2
   xx,yy=box(stage);p.mouse.move(xx,yy);p.mouse.down();p.mouse.move(xx+120,yy);p.mouse.up()
   p.screenshot(path='shots/water-compressed-pc.png')
  p.locator('.water-reset').click();p.wait_for_function("document.querySelector('.water-pressure').value==='1.00'",timeout=6000)
  phase=p.locator('.water-identity small')
  slider=p.locator('#water-temp')
  if w<500:
   r=slider.bounding_box()
   assert r['x']>=24 and r['x']+r['width']<=w-24,r
   r=grip.bounding_box()
   assert r['x']>=24 and r['x']+r['width']<=w-24,r
   r=slider.bounding_box()
   for x,expected in [(r['x']+3,'-30'),(r['x']+r['width']-3,'200')]:
    touch('Start',[(x,r['y']+r['height']/2)]);touch('End',[])
    assert slider.input_value()==expected
   p.locator('.water-reset').click()
  def heat(t):
   rect=slider.bounding_box()
   x=rect['x']+8+(rect['width']-16)*(t+30)/230
   y=rect['y']+rect['height']/2
   if w<500:
    touch('Start',[(x,y)]);touch('End',[])
   else:p.mouse.click(x,y)
   # Account for the native thumb inset and integer CSS pixel rounding.
   diff=t-int(slider.input_value())
   assert abs(diff)<=4,diff
   for _ in range(abs(diff)):slider.press('ArrowRight' if diff>0 else 'ArrowLeft')
   assert int(slider.input_value())==t
  def at(state,t=None):
   p.wait_for_function("""([state,t])=>document.querySelector('.water-identity small').dataset.phase===state &&
    (t===null || Number(document.querySelector('.water-degrees').value)===t)""",arg=[state,t],timeout=45000)
  def photograph(state):
   p.screenshot(path=f'shots/water-{state}-{w}.png')
  heat(25);at('condensing');at('liquid',25);assert abs(gauge()-1)<.02
  settle();photograph('liquid')
  heat(-10);at('freezing')
  if w<500:
   p.screenshot(path=f'shots/water-lag-{w}.png')
   heat(0);at('slush',0)
   share=p.locator('.water-phase-strip i').first.get_attribute('style')
   settle()
   assert p.locator('.water-phase-strip i').first.get_attribute('style')==share
   assert p.locator('.water-temp-marker').evaluate("e=>parseFloat(e.style.getPropertyValue('--actual'))")==30/230*100
   photograph('slush')
   heat(25);at('melting')
  else:heat(25)
  at('liquid',25)
  heat(-10);at('ice',-10);p.wait_for_timeout(1800);photograph('ice')
  heat(104);at('melting');at('boiling');heat(97);at('liquid',97)
  heat(104);at('gas',104);heat(90);at('condensing');at('liquid',90)
  x,y=box(grip)
  def piston(start,end):
   if w<500:
    touch('Start',[start]);touch('Move',[end]);touch('End',[])
   else:
    p.mouse.move(*start);p.mouse.down();p.mouse.move(*end,steps=5);p.mouse.up()
  piston((x,y),(x,y-135))
  at('mixed',90);assert .68<gauge()<.71
  if w<500:
   bands=p.locator('.water-phase-strip i')
   assert bands.nth(1).evaluate('e=>e.offsetWidth')>0
   assert bands.nth(2).evaluate('e=>e.offsetWidth')>0
  photograph('coexistence')
  x,y=box(grip);piston((x,y),(x,y+155));at('liquid',90)
  p.locator('.water-reset').click();at('gas',160)
  p.wait_for_function("document.querySelector('.water-pressure').value==='1.00'")
  p.locator('.water-close').click();assert not p.locator('.water-piston').count()
  p.locator('#open-water-piston').click();settle();assert gauge()==1
  p.locator('.water-close').click()
  p.locator('[data-book-tab=groups]').click();assert p.locator('[data-book-tab=groups]').get_attribute('aria-selected')=='true'
  assert save==p.evaluate('JSON.stringify([...data])')
  if w==390:
   # Open the real application with a separate, already-discovered fixture.
   p.add_init_script("""localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({
    schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],
    unlockedStructures:[],legacyElements:[],milestones:[]}))""")
   p.goto(f'http://127.0.0.1:{server.server_port}/?reactionLabTest=1')
   p.wait_for_function("!document.querySelector('#open-reaction-lab').disabled")
   p.evaluate("dispatchEvent(new CustomEvent('molecule-craft:open-molecule',{detail:{id:'water'}}))")
   p.locator('#open-water-piston').click()
   p.locator('.water-close').click()
   p.locator('#close-collection').click()
   p.locator('#open-reaction-lab').click()
   p.wait_for_selector('#reaction-lab-dialog[open]')
   p.locator('[data-lab-close]').click()
  assert not errors,errors
  print(w,'passed',flush=True);ctx.close()
