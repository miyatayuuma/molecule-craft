// Actual production UI/Canvas/keyboard, with a test-only handle to the live run.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),results=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/src/veil/ui.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('run=createRun(','run=window.__profileRun=createRun(')});});
 await page.goto(process.argv[3]??'http://127.0.0.1:8765');
 for(const fuel of ['hydrogen','methane','ethyne','dimethyl-ether','propane','n-hexane']){
  await page.evaluate(async fuel=>{
   const {createResources}=await import('/src/veil/resources.js');localStorage.clear();const r=createResources({storage:localStorage});r.setCatalog(await fetch('/data/molecules.json').then(r=>r.json()));r.collect({H:5000,C:5000,O:5000});
   for(const id of [fuel,'oxygen','water','hydrogen','ethene','propene','phenol','formaldehyde'])r.discover(id);
   for(const [role,id] of [['propellant','hydrogen'],['fuel',fuel],['oxidizer','oxygen'],['coolant','water']])r.fillTankFromElements(role,id,r.tankFillPlan(role,id).maxAdd);
   r.visit('oxygen');r.save();
  },fuel);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#resource-h')?.textContent!=='0');
  await page.locator('#open-supply').click();await page.locator('#shell-oxidizer').click();
  await page.locator('[data-upgrade=seal]').click();assert.equal(await page.locator('#shell-oxidizer [role=meter]').getAttribute('aria-valuemax'),'48');
  await page.locator('[data-upgrade=overwrap]').click();assert.equal(await page.locator('#shell-oxidizer [role=meter]').getAttribute('aria-valuemax'),'72');
  if(fuel==='methane')await page.screenshot({path:'/tmp/fuel-profile-upgrades.png'});
  await page.evaluate(()=>document.querySelector('#launch-veil').click());await page.waitForFunction(()=>window.__profileRun);
  assert.equal(await page.evaluate(()=>window.__profileRun.fuel.oxidizer.capacity),72);
  await page.evaluate(()=>Object.assign(window.__profileRun.player,{x:0,y:0,speed:29,vx:0,vy:0,angle:-Math.PI/2}));
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');await page.waitForTimeout(450);
  results.push(await page.evaluate(fuel=>({fuel,time:window.__profileRun.time,speed:window.__profileRun.player.speed,drive:window.__profileRun.player.drive}),fuel));
  await page.keyboard.up('Shift');const buffer=await page.evaluate(()=>window.__profileRun.driveBuffer);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>window.__profileRun.driveBuffer),buffer);assert.equal(await page.evaluate(()=>window.__profileRun.player.combustion),false);
  await page.keyboard.up('ArrowUp');if(fuel==='n-hexane'){
   await page.screenshot({path:'/tmp/fuel-profile-flight.png'});
   await page.evaluate(()=>{Object.assign(window.__profileRun.player,{x:120,y:-8340,speed:29,vx:0,vy:0,angle:-Math.PI/2});window.__craftReward=null;window.addEventListener('molecule-craft:craft-molecule',e=>window.__craftReward=e.detail.id);});
   await page.keyboard.down('ArrowUp');await page.keyboard.down('Shift');
   await page.waitForFunction(()=>window.__profileRun.inspiration==='dimethyl-ether',{},{timeout:10000});
   await page.keyboard.up('Shift');await page.keyboard.up('ArrowUp');
   assert.equal(await page.locator('#veil-craft-prompt').isVisible(),true);
   await page.locator('#veil-to-craft').click();
   await page.waitForFunction(()=>window.__craftReward==='dimethyl-ether');
  }
 }
 assert.deepEqual(errors,[]);assert.ok(results.every(r=>r.drive.boostSpeed===470));console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
