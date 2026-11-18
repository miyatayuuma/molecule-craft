from playwright.sync_api import sync_playwright
from pathlib import Path
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
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=shutil.which('google-chrome') or shutil.which('chromium'),args=['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--ignore-gpu-blocklist'])
 for w,h in [(390,844),(360,740),(1280,800)]:
  ctx=b.new_context(viewport={'width':w,'height':h},has_touch=w<500,is_mobile=w<500,device_scale_factor=1)
  p=ctx.new_page(); errors=[];p.on('pageerror',lambda err:errors.append(str(err)))
  p.route('**/fixture',lambda r:r.fulfill(body=html,content_type='text/html'))
  p.goto(f'http://127.0.0.1:{server.server_port}/fixture')
  p.evaluate('''async()=>{const c=await import('/src/chemistry.js');await c.loadMoleculeDatabase();
  const ui=await import('/src/collection-ui.js');
  const preset={schemaVersion:3,discoveredMolecules:[{id:'water',at:1,order:1}],discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};
  const data=new Map([['molecule-craft.collection.v1',JSON.stringify(preset)]]);window.data=data;
  window.book=await ui.createCollectionUI({records:c.moleculeCatalog(),storage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},onPlace(){},canOpen:()=>true,elementAccess:()=>true,recipeState:()=>({recipes:[],hints:[]})});
  book.openEntry('molecules','water');}''')
  save=p.evaluate('JSON.stringify([...data])')
  p.locator('#open-water-piston').click()
  grip=p.locator('.water-grip'); stage=p.locator('.water-stage')
  gauge=lambda:float(p.locator('.water-pressure').inner_text())
  def box(loc):
   r=loc.bounding_box();return [r['x']+r['width']/2,r['y']+r['height']/2]
  def settle():p.wait_for_timeout(850)
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
   touch('Move',[(x,h-115)]);settle();compressed=gauge();assert compressed>2.65
   r=p.locator('#water-temp').bounding_box(); xx=r['x']+r['width']-5; yy=r['y']+r['height']/2
   touch('Start',[(x,h-115),(xx,yy)]);settle()
   hot=gauge();assert hot>compressed and hot<3.02,(hot,compressed)
   touch('Move',[(x,h-115),(r['x']+8+(r['width']-16)*170/230,yy)]);settle();assert gauge()<compressed
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
  def heat(t):
   slider.fill(str(t))
  def at(state,t=None):
   p.wait_for_function("""([state,t])=>document.querySelector('.water-identity small').dataset.phase===state &&
    (t===null || Number(document.querySelector('.water-degrees').value)===t)""",arg=[state,t],timeout=45000)
  def photograph(state):
   p.screenshot(path=f'shots/water-{state}-{w}.png')
  heat(25);at('condensing');at('liquid',25);assert abs(gauge()-1)<.02
  settle();photograph('liquid')
  heat(-10);at('freezing');heat(25);at('liquid',25)
  heat(-10);at('ice',-10);settle();photograph('ice')
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
  photograph('coexistence')
  x,y=box(grip);piston((x,y),(x,y+155));at('liquid',90)
  p.locator('.water-reset').click();at('gas',160)
  p.wait_for_function("document.querySelector('.water-pressure').value==='1.00'")
  p.locator('.water-close').click();assert not p.locator('.water-piston').count()
  p.locator('#open-water-piston').click();settle();assert gauge()==1
  p.locator('.water-close').click()
  p.locator('[data-book-tab=groups]').click();assert p.locator('[data-book-tab=groups]').get_attribute('aria-selected')=='true'
  assert save==p.evaluate('JSON.stringify([...data])')
  assert not errors,errors
  print(w,'passed',flush=True);ctx.close()
