from pathlib import Path
p=Path('tests/encyclopedia-transition-browser.test.mjs')
text=p.read_text()
old="""  await send('Runtime.enable');await send('Page.enable');await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,100));if((await evaluate(`document.querySelector('#open-collection')?.textContent??''`)).includes('/129'))break;}
  const save={schemaVersion:3,discoveredMolecules:['hydrogen','oxygen','n-butane','isobutane'].map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};await evaluate(`localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(save))})`);await send('Page.reload');
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));if((await evaluate(`document.querySelector('#open-collection')?.textContent??''`)).includes('4/129'))break;}assert.match(await evaluate(`document.querySelector('#open-collection')?.textContent??''`),/4\\/129/);
"""
new="""  await send('Runtime.enable');await send('Page.enable');
  // Seed the production persistence contract before the application boots. Reloading
  // an already initialized collection would only mutate storage, not the in-memory state.
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/__transition-seed__`});await new Promise(r=>setTimeout(r,80));
  const save={schemaVersion:3,discoveredMolecules:['hydrogen','oxygen','n-butane','isobutane'].map((id,index)=>({id,at:index+1,order:index+1})),discoveredGroups:[],unlockedStructures:[],legacyElements:[],milestones:[]};await evaluate(`localStorage.setItem('molecule-craft.collection.v1',${JSON.stringify(JSON.stringify(save))})`);assert.equal(await evaluate(`localStorage.getItem('molecule-craft.collection.v1')`),JSON.stringify(save));
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));if((await evaluate(`document.querySelector('#open-collection')?.textContent??''`)).includes('4/129'))break;}assert.match(await evaluate(`document.querySelector('#open-collection')?.textContent??''`),/4\\/129/);
"""
if text.count(old)!=1: raise SystemExit(f'expected browser seed block once, found {text.count(old)}')
p.write_text(text.replace(old,new))
