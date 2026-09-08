// Real Chromium + production DOM, Canvas and WebGL. Start a local HTTP server,
// then: node tests/oxygen-routes-browser-check.mjs /path/to/playwright/index.mjs
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.argv[2]));
const browser=await chromium.launch({headless:true,executablePath:process.env.OXYGEN_CHROMIUM_PATH||undefined,args:['--no-sandbox']}),base=process.argv[3]??'http://127.0.0.1:8000';
try{
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base);await page.waitForSelector('#element-palette [data-element="H"]');
  // Fixture storage exists only in this disposable browser context.
  await page.evaluate(async()=>{
    const {createResources}=await import('/src/veil/resources.js'),records=await fetch('/data/molecules.json').then(r=>r.json()),r=createResources({storage:localStorage});
    r.setCatalog(records);r.collect({H:2000,C:1000,O:2000});
    for(const id of ['hydrogen','carbon-dioxide','methane','oxygen','water'])r.discover(id);
    r.fillTankFromElements('propellant','carbon-dioxide',72);r.fillTankFromElements('fuel','methane',18);r.fillTankFromElements('oxidizer','oxygen',36);r.fillTankFromElements('coolant','water',80);r.visit('oxygen');r.save();
    localStorage.setItem('molecule-craft.collection.v1',JSON.stringify({schemaVersion:2,discoveredMolecules:['hydrogen','carbon-dioxide','methane','oxygen','water']}));
  });
  await page.reload();await page.waitForFunction(()=>document.querySelector('#open-collection small')?.textContent.startsWith('5/'));
  await page.screenshot({path:'/tmp/molecule-craft-visual-palette.png'});
  assert.equal(await page.locator('#element-palette .atom-preview').count(),8);
  await page.locator('#parts-tab').click();await page.screenshot({path:'/tmp/molecule-craft-visual-parts.png'});await page.locator('#atoms-tab').click();
  await page.locator('#open-supply').click();
  assert.equal(await page.locator('.shell-port .tank-scale[role=meter]').count(),4);
  assert.equal(await page.locator('#shell-fuel .tank-scale').getAttribute('aria-valuenow'),'18');
  assert.equal(await page.locator('#shell-oxidizer .tank-scale').getAttribute('aria-valuenow'),'36');
  assert.equal(await page.locator('#tank-use-guide').isVisible(),false);
  await page.screenshot({path:'/tmp/molecule-craft-visual-tanks.png'});
  await page.locator('#oxygen-route-guide summary').click();
  assert.equal(await page.locator('#oxygen-route-chart polyline').count(),3);
  assert.match(await page.locator('#loaded-combustion-summary').innerText(),/36秒/);
  await page.locator('#oxygen-route-guide').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/molecule-craft-oxygen-supply.png'});
  for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});
    assert.equal(await page.evaluate(()=>{const d=document.querySelector('#supply-dialog');return d.scrollWidth<=d.clientWidth+1;}),true,`No sheet overflow at ${width}px`);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#oxygen-co2-hint').click();await page.waitForSelector('.expedition-use');
  assert.match(await page.locator('.expedition-use').innerText(),/満載9回/);
  await page.getByRole('button',{name:'補給で比較する'}).click();
  await page.waitForSelector('#supply-dialog[open]');assert.match(await page.locator('#tank-model-name').innerText(),/CO[₂2]/);
  await page.locator('#tank-craft-molecule').click();await page.waitForSelector('#craft-target:not([hidden])');
  assert.match(await page.locator('#craft-target').innerText(),/二酸化炭素|CO₂/);
  await page.locator('#open-supply').click();await page.locator('#launch-veil').click();
  await page.waitForSelector('#veil-view:not([hidden])');
  await page.keyboard.down('Shift');await page.waitForTimeout(300);
  assert.equal(await page.locator('#veil-combustion').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#veil-combustion-fuel [data-role=fuel]').getAttribute('aria-valuenow'),'17');
  assert.equal(await page.locator('#veil-combustion-fuel [data-role=oxidizer]').getAttribute('aria-valuenow'),'34');
  await page.screenshot({path:'/tmp/molecule-craft-visual-burn.png'});await page.keyboard.up('Shift');
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(4200);await page.keyboard.up('ArrowUp');
  await page.screenshot({path:'/tmp/molecule-craft-oxygen-junction.png'});
  assert.match(await page.locator('#veil-message').innerText(),/↖ ↑ ↗/);
  await page.locator('#veil-return').click();await page.waitForSelector('#veil-view',{state:'hidden'});
  assert.match(await page.locator('#craft-last-run').innerText(),/↩/);
  // No region visit or legacy checkpoint may grant the new ending.
  await page.evaluate(async()=>{
    const {createResources}=await import('/src/veil/resources.js');const r=createResources({storage:localStorage});r.visit('frontier');r.save();
  });
  await page.reload();await page.waitForSelector('#open-supply');
  assert.equal(await page.locator('#cho-completion').count(),0);
  assert.equal(await page.locator('#element-palette [data-element="N"]').isVisible(),false);
  await page.locator('#open-supply').click();await page.locator('#launch-veil').click();
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(2600);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(1500);
  await page.keyboard.up('ArrowRight');await page.keyboard.up('ArrowUp');
  await page.waitForFunction(()=>document.querySelector('#veil-goal').dataset.reached==='true');
  await page.screenshot({path:'/tmp/molecule-craft-cho-destination.png'});
  await page.locator('#veil-return').click();await page.waitForSelector('#veil-view',{state:'hidden'});
  assert.match(await page.locator('#craft-last-run').innerText(),/CHO ✓/);
  assert.equal(await page.locator('#cho-completion').count(),0);
  await page.screenshot({path:'/tmp/molecule-craft-cho-ending.png'});
  await page.reload();await page.waitForSelector('#open-supply');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('molecule-craft.resources.v1')).progress.choCompleted),true);
  await page.locator('#open-supply').click();await page.waitForSelector('#supply-dialog[open]');
  await page.locator('#supply-dialog [data-close-dialog]').click();
  // Render an actual production frame at each obstacle for visual inspection.
  await page.evaluate(async()=>{
    const [{createRun},{createUniverse},{flightConfig},{createVeilRenderer}]=await Promise.all([import('/src/veil/engine.js'),import('/src/veil/universe.js'),import('/src/veil/growth.js'),import('/src/veil/renderer.js')]);
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:9999;background:#07121e';const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block';host.append(canvas);document.body.append(host);
    const renderer=createVeilRenderer(canvas),run=createRun(createUniverse(71),flightConfig(),{predators:false});
    Object.assign(run.player,{x:120,y:-9640,angle:-Math.PI/2});run.region='oxygen';renderer.resize();renderer.reset();renderer.draw(run,1/60,true);
    const bytes=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let colored=0;for(let i=0;i<bytes.length;i+=4)if(bytes[i]+bytes[i+1]+bytes[i+2]>80)colored++;if(colored<1000)throw Error('The production field frame is blank');
  });
  await page.screenshot({path:'/tmp/molecule-craft-oxygen-rest.png'});
  assert.deepEqual(errors,[]);console.log('Real Chromium passed: mobile route chart, 320/390/768px layout, collection → supply → craft, keyboard flight, return summary and production Canvas/WebGL. Screenshots in /tmp/molecule-craft-oxygen-*.png.');
}finally{await browser.close();}
