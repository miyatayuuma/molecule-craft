import {readFile,writeFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const write=(path,text)=>writeFile(new URL(`../${path}`,import.meta.url),text);
const update=async(path,fn)=>{const before=await read(path),after=fn(before);if(after===before)throw new Error(`${path}: no change`);await write(path,after);};
const replaceOnce=(text,from,to,label)=>{const i=text.indexOf(from);if(i<0)throw new Error(`Missing ${label}`);if(text.indexOf(from,i+from.length)>=0)throw new Error(`Duplicate ${label}`);return text.slice(0,i)+to+text.slice(i+from.length);};

const openNitrogen="await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]')`,'Nitrogen destination unavailable');";
const clickNitrogen="const requested=await evaluate(`(()=>{const button=document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]');button.click();return button.dataset.region;})()`);assert.equal(requested,'nitrogen');";

for(const path of ['tests/critical-insight-freeze-browser.test.mjs','tests/nitrogen-field-pickup-browser.test.mjs'])await update(path,text=>{
  text=replaceOnce(text,"await waitFor(`document.querySelector('#expedition-anchor')?.querySelector('option[value=\"nitrogen\"]')!==null`,'Nitrogen destination did not become available');",openNitrogen,'Nitrogen destination wait');
  text=replaceOnce(text,"const requested=await evaluate(`(()=>{const select=document.querySelector('#expedition-anchor');select.value='nitrogen';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#launch-veil').click();return select.value;})()`);assert.equal(requested,'nitrogen');",clickNitrogen,'Nitrogen destination launch');
  if(/expedition-anchor|launch-veil/.test(text))throw new Error(`${path}: retired launch fixture remains`);
  return text;
});

await update('tests/nitrogen-chapter-browser.test.mjs',text=>{
  const firstOld="await send('Page.reload',{ignoreCache:true});await waitFor(`document.querySelector('#expedition-anchor')?.querySelector('option[value=\"nitrogen\"]')!==null`,'Nitrogen destination unavailable');\n  await evaluate(`(()=>{const select=document.querySelector('#expedition-anchor');select.value='nitrogen';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#launch-veil').click();return true;})()`);";
  const firstNew=`await send('Page.reload',{ignoreCache:true});${openNitrogen}\n  await evaluate(\`document.querySelector('#expedition-destinations [data-region="nitrogen"]').click()\`);`;
  text=replaceOnce(text,firstOld,firstNew,'Nitrogen chapter initial launch');
  const relaunchOld="await evaluate(`(()=>{const select=document.querySelector('#expedition-anchor');select.value='nitrogen';select.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#launch-veil').click();return true;})()`);";
  const relaunchNew=`await evaluate(\`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()\`);await waitFor(\`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region="nitrogen"]')\`,'Nitrogen destination unavailable');await evaluate(\`document.querySelector('#expedition-destinations [data-region="nitrogen"]').click()\`);`;
  text=replaceOnce(text,relaunchOld,relaunchNew,'Nitrogen chapter relaunch');
  if(/expedition-anchor|launch-veil/.test(text))throw new Error('Nitrogen chapter retired launch fixture remains');
  return text;
});

await update('tests/rare-survey-browser.test.mjs',text=>{
  const old="await evaluate(`document.querySelector('#launch-veil').click()`);";
  const next="await evaluate(`(()=>{document.querySelector('#open-supply').click();document.querySelector('#collector-launch-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));return true;})()`);await waitFor(`document.querySelector('#expedition-destinations')?.getAttribute('aria-hidden')==='false'&&!!document.querySelector('#expedition-destinations [data-region=\\\"veil\\\"]')`,'H Veil destination unavailable');await evaluate(`document.querySelector('#expedition-destinations [data-region=\\\"veil\\\"]').click()`);";
  text=replaceOnce(text,old,next,'Rare Survey launch');if(/launch-veil|expedition-anchor/.test(text))throw new Error('Rare Survey legacy launch fixture remains');return text;
});

await update('tests/fuel-profiles-browser-check.mjs',text=>replaceOnce(text,"await page.evaluate(()=>document.querySelector('#launch-veil').click());","await page.locator('#collector-launch-handle').press('Enter');await page.locator('#expedition-destinations [data-region=oxygen]').click();",'fuel profile launch'));
await update('tests/oxygen-routes-browser-check.mjs',text=>{
  const old="await page.locator('#open-supply').click();await page.locator('#launch-veil').click();";
  const next="await page.locator('#open-supply').click();await page.locator('#collector-launch-handle').press('Enter');await page.locator('#expedition-destinations [data-region=oxygen]').click();";
  if(!text.includes(old))throw new Error('Missing oxygen route launch fixture');
  return text.replaceAll(old,next);
});

await update('tests/veil-ui-check.mjs',source=>{
  let text=source.replaceAll("q('launch-veil').click();","game.run(\"veilUI.requestExpeditionLaunch('continue')\");");
  text=text.replace("q('expedition-anchor').value='oxygen';q('expedition-anchor').dispatchEvent(new game.window.Event('change',{bubbles:true}));game.run(\"veilUI.requestExpeditionLaunch('continue')\");","game.run(\"veilUI.requestExpeditionLaunch('oxygen')\");");
  text=text.replace("starterGame.document.getElementById('open-supply').click();starterGame.document.getElementById('launch-veil').click();","starterGame.document.getElementById('open-supply').click();starterGame.run(\"veilUI.requestExpeditionLaunch('continue')\");");
  if(/launch-veil|expedition-anchor/.test(text))throw new Error('veil UI check legacy launch fixture remains');return text;
});

await update('tests/mobile-layout-harness.html',source=>replaceOnce(source,"document.querySelector('#supply').onclick=()=>openFixture('#open-supply');document.querySelector('#expedition').onclick=()=>openFixture('#launch-veil',true);","document.querySelector('#supply').onclick=()=>openFixture('#open-supply');document.querySelector('#expedition').onclick=()=>{if(!frame.contentWindow?.localStorage){result.textContent='本番画面を開いてください';return;}frame.contentWindow.localStorage.setItem('molecule-craft.resources.v1',JSON.stringify(expeditionState({full:true})));frame.addEventListener('load',async()=>{if(!await waitForProductionReady()){result.textContent='FAIL · 分子DB readiness timeout';return;}frame.contentDocument.querySelector('#open-supply')?.click();frame.contentDocument.querySelector('#collector-launch-handle')?.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));frame.contentDocument.querySelector('#expedition-destinations [data-region=\"oxygen\"]')?.click();requestAnimationFrame(check);},{once:true});frame.contentWindow.location.reload();};",'mobile expedition fixture'));

for(const path of ['tests/critical-insight-freeze-browser.test.mjs','tests/nitrogen-field-pickup-browser.test.mjs','tests/nitrogen-chapter-browser.test.mjs','tests/rare-survey-browser.test.mjs','tests/fuel-profiles-browser-check.mjs','tests/oxygen-routes-browser-check.mjs','tests/veil-ui-check.mjs','tests/mobile-layout-harness.html']){
  const text=await read(path);if(/launch-veil|expedition-anchor/.test(text))throw new Error(`${path}: retired launch token remains after cleanup`);
}
console.log('Resumed repository hygiene cleanup after retired-launch fixture migration.');