import {readFile,writeFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');
const write=(path,text)=>writeFile(new URL(`../${path}`,import.meta.url),text);
const replaceOnce=(text,from,to,label)=>{
  const first=text.indexOf(from);if(first<0)throw new Error(`Missing ${label}`);if(text.indexOf(from,first+from.length)>=0)throw new Error(`Duplicate ${label}`);return text.slice(0,first)+to+text.slice(first+from.length);
};
const update=async(path,fn)=>{const before=await read(path),after=fn(before);if(after===before)throw new Error(`${path}: no change`);await write(path,after);};

await update('scripts/build-molecule-db.mjs',source=>{
  let text=source;
  text=replaceOnce(text,', iupacNameEn, learningNote, stereochemistry',', iupacNameEn, stereochemistry','add learningNote parameter');
  text=replaceOnce(text,', ...(learningNote?{learningNote}:{}), ...(stereochemistry?',', ...(stereochemistry?','learningNote output');

  const stripTupleNote=(line,id)=>{
    if(!line.includes(`['${id}'`))return line;
    const next=line.replace(/,'[^'\n]*'(\],?)$/,'$1');
    if(next===line)throw new Error(`Could not strip tuple learningNote for ${id}`);
    return next;
  };
  text=text.replace('for(const [id,nameJa,nameEn,count,iupacNameEn,learningNote] of [','for(const [id,nameJa,nameEn,count,iupacNameEn] of [');
  for(const id of ['malonic-acid','succinic-acid','adipic-acid'])text=text.split('\n').map(line=>stripTupleNote(line,id)).join('\n');
  text=replaceOnce(text,']) add({id,nameJa,nameEn,iupacNameEn,learningNote,...diacid(count),category:\'dicarboxylic-acid\'});',']) add({id,nameJa,nameEn,iupacNameEn,...diacid(count),category:\'dicarboxylic-acid\'});','diacid learningNote consumer');

  text=text.replace('for(const [id,nameJa,nameEn,side,iupacNameEn,learningNote] of [','for(const [id,nameJa,nameEn,side,iupacNameEn] of [');
  for(const id of ['serine','cysteine','methionine'])text=text.split('\n').map(line=>stripTupleNote(line,id)).join('\n');
  text=replaceOnce(text,"add({id,nameJa,nameEn,iupacNameEn,learningNote,stereochemistry:'unspecified'","add({id,nameJa,nameEn,iupacNameEn,stereochemistry:'unspecified'",'amino acid learningNote consumer');

  text=text.replace(/,\s*learningNote\s*:\s*'[^'\n]*'/g,'');
  text=text.replace(/,\s*learningNote\s*:\s*"[^"\n]*"/g,'');
  const remains=text.split('\n').filter(line=>line.includes('learningNote'));
  if(remains.length)throw new Error(`learningNote remains in generator:\n${remains.join('\n')}`);
  return text;
});

await update('tests/browser-harness.html',text=>replaceOnce(text,"checkPreviewModels(THREE,records.filter(record=>record.learningNote||['methane','ethene','ethyne','benzene','anisole','phenol'].includes(record.id)),collectionData.templates);","checkPreviewModels(THREE,records,collectionData.templates);",'preview learningNote fixture'));
await update('tests/preview-model-checks.js',text=>replaceOnce(text,"if(record.learningNote||['methyl','isopropyl','n-butyl'].includes(record.id))","if(!record.attachments||['methyl','isopropyl','n-butyl'].includes(record.id))",'preview learningNote condition'));
await update('tests/collection-expansion.test.mjs',text=>replaceOnce(text,'assert.ok(entry?.learningNote&&entry.iupacNameEn&&entry.commonNameJa,ref.id);','assert.ok(entry?.iupacNameEn&&entry.commonNameJa,ref.id);','collection metadata assertion'));
await update('tests/encyclopedia-content-architecture.test.mjs',text=>{
  const marker="assert.equal(records.length,135,'production molecule count must remain 135');";
  return replaceOnce(text,marker,`${marker}\nassert.ok(records.every(record=>!Object.hasOwn(record,'learningNote')),'retired learningNote compatibility payload must not remain in the production molecule DB');`,'content architecture count');
});

await update('index.html',text=>{
  let out=text.replace('<button id="tank-next-hint" type="button" hidden>作り方を見る</button>','');
  out=out.replace(/\n\s*<div class="supply-footer">[^\n]+<\/div>/,'');
  if(out.includes('tank-next-hint')||out.includes('expedition-anchor')||out.includes('launch-veil'))throw new Error('retired hidden launch/hint DOM remains');
  return out;
});
await update('src/pending-craft.js',text=>text.replace(/\n\s*const legacy=root\.getElementById\?\.\('tank-next-hint'\);\n\s*if\(legacy\)\{[^\n]+\}\n/,'\n'));
await update('src/game-shell.js',text=>replaceOnce(text,"'#molecule-iupac','#tank-next-hint','.tank-explanation'","'#molecule-iupac','.tank-explanation'",'game shell legacy hint selector'));

await update('src/veil/supply.js',source=>{
  let text=source;
  text=replaceOnce(text,'onLaunchReady=()=>false,onAnchor})','onLaunchReady=()=>false})','supply onAnchor parameter');
  text=text.replace("anchorsKey=''","destinationsKey=''");
  text=text.replace(/\n\s*const legacyFooter=q\('expedition-anchor'\)\?\.closest\('\.supply-footer'\);if\(legacyFooter\)legacyFooter\.hidden=true;/,'');
  text=replaceOnce(text,'function renderLaunchDestinations(){\n    const checkpoint=','function renderLaunchDestinations(){\n    launchLayer.replaceChildren();\n    const checkpoint=','destination rebuild cleanup');
  const old="const anchors=`${destinations.join('|')}|${state.progress.checkpoint}`;if(anchors!==anchorsKey){anchorsKey=anchors;const list=q('expedition-anchor'),selected=list.value;list.replaceChildren();for(const [id,text]of [['continue','探索の続き'],...destinations.map(id=>[id,REGIONS[id].name])]){const option=document.createElement('option');option.value=id;option.textContent=text;list.append(option);}list.value=selected&&[...list.options].some(option=>option.value===selected)?selected:'continue';renderLaunchDestinations();}";
  const next="const destinationKey=`${destinations.join('|')}|${state.progress.checkpoint}`;if(destinationKey!==destinationsKey){destinationsKey=destinationKey;renderLaunchDestinations();}";
  text=replaceOnce(text,old,next,'legacy destination select rebuild');
  text=text.replace("q('expedition-anchor').addEventListener('change',()=>{requestedDestinationId=null;onAnchor(q('expedition-anchor').value);});",'');
  if(/expedition-anchor|launch-veil|legacyFooter|onAnchor|anchorsKey/.test(text))throw new Error('legacy launch contract remains in supply');
  return text;
});

await update('src/veil/ui.js',source=>{
  let text=source;
  text=text.replace(",anchor='continue',anchorLock",',anchorLock');
  text=text.replace(',onAnchor:selectLaunchDestination});','});');
  text=text.replace('snapshot:()=>({resources:captureLaunchRollbackState(resources),anchor}),','snapshot:()=>({resources:captureLaunchRollbackState(resources)}),');
  text=replaceOnce(text,"anchor=id;const select=q('expedition-anchor');if(select&&[...select.options].some(option=>option.value===id))select.value=id;updateCraft();return true;",'return true;','selected legacy anchor mirror');
  text=text.replace("    supply.update();q('launch-veil').disabled=resources.blocked;\n    q('launch-veil').textContent='↗ 出発';","    supply.update();");
  text=text.replace("anchor='continue';q('expedition-anchor').value='continue';active=true;","active=true;");
  text=text.replace("    anchor=checkpoint.anchor;const anchorSelect=q('expedition-anchor');if(anchorSelect)anchorSelect.value=checkpoint.anchor;\n",'');
  text=text.replace("onCraft();updateCraft();q('launch-veil').focus();","onCraft();updateCraft();q('open-supply')?.focus();");
  text=text.replace("  q('launch-veil').addEventListener('click',event=>{event.preventDefault();requestExpeditionLaunch(anchor);});",'  ');
  if(/expedition-anchor|launch-veil|checkpoint\.anchor|\banchor=/.test(text))throw new Error('legacy launch DOM/state remains in veil ui');
  return text;
});

await update('veil.css',source=>{
  let text=source;
  const selectors=[
    /\.resource-bar #launch-veil\{[^}]*\}/g,
    /#supply-dialog \.supply-footer(?: \.anchor-select(?: select)?| \.shell-launch)?\{[^}]*\}/g,
    /#supply-dialog \.anchor-select>span\{[^}]*\}/g,
    /\.shell-launch\{[^}]*\}/g,
    /\.anchor-select(?: select)?\{[^}]*\}/g,
  ];
  for(const re of selectors)text=text.replace(re,'');
  text=text.replace('.shell-port,.shell-launch{','.shell-port{');
  if(/launch-veil|supply-footer|anchor-select|shell-launch/.test(text))throw new Error('retired launch CSS remains');
  return text;
});

await update('src/special-bonds.js',text=>text.replaceAll('legacySharedBondCurves','sulfurOxoBondCurves'));

await update('docs/molecule-frontier-balance.md',text=>text.replaceAll('129-node graph','135-node graph').replace('reachableな129 node','reachableな135 node'));
await update('docs/molecule-graph-design.md',text=>{
  let out=text.replace('The 162-entry legacy inventory was replaced by the audited 129-node graph in Molecule DB v2.','The 162-entry legacy inventory was replaced by the audited Molecule DB v2 graph, which has since expanded to 135 production nodes.');
  out=out.replace('The production database and discovery graph now contain **129 molecules / nodes** connected by **144 edges**. The migration applied the PR #176 audit outcome: RETAIN 117, REWRITE 8, DELETE 37, and ADD 4. The graph is one connected component, has no isolated nodes, a maximum direct-neighbor count of **6**, and a longest degree-2 corridor of **4**.','The production database and discovery graph now contain **135 molecules / nodes** connected by **157 edges**. The original Molecule DB v2 migration applied the PR #176 audit outcome: RETAIN 117, REWRITE 8, DELETE 37, and ADD 4; subsequent reviewed extensions added the current resonance/nitro series. The graph remains one connected component with no isolated nodes, a maximum direct-neighbor count of **7**, and a longest degree-2 corridor of **4**.');
  return out;
});

await update('tests/pending-craft.test.mjs',text=>replaceOnce(text,"assert.doesNotMatch(supplySource,/tank-next-hint'\\)\\.addEventListener/,'LOADOUT must not own the unfinished-molecule craft route');","assert.doesNotMatch(pendingSource,/tank-next-hint/,'retired LOADOUT hint-button compatibility DOM must not return');",'pending legacy hint test'));

await update('tests/issue-122-launch-route.test.mjs',source=>{
  let text=source;
  text=text.replace("const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');","const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');\nconst index=await readFile(new URL('../index.html',import.meta.url),'utf8');");
  text=text.replace("has(veil,\"q('launch-veil').addEventListener('click',event=>{event.preventDefault();requestExpeditionLaunch(anchor);});\",'normal launch button is a direct application request path, not a relay');\n",'');
  text=text.replace("assert.equal(veil.split(\"q('launch-veil').addEventListener\").length-1,1,'launch handler is installed once per UI instance');","lacks(veil,'launch-veil','retired hidden launch button must not remain in EXPLORE UI');\nlacks(supply,'expedition-anchor','retired destination select must not remain in LOADOUT');\nlacks(index,'id=\"launch-veil\"','retired hidden launch button must not remain in production DOM');\nlacks(index,'id=\"expedition-anchor\"','retired hidden destination select must not remain in production DOM');");
  return text;
});
await update('tests/launch-selector.test.mjs',source=>{
  let text=source.replace("const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');","const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');\nconst indexSource=await readFile(new URL('../index.html',import.meta.url),'utf8');");
  text=text.replace("assert.doesNotMatch(source,/q\\('launch-veil'\\)\\.click\\(\\)/,'Launch must not relay application behavior through a pseudo-click');","assert.doesNotMatch(source,/launch-veil|expedition-anchor/,'LOADOUT must not retain the retired fallback launch DOM contract');");
  text=text.replace("assert.match(uiSource,/q\\('launch-veil'\\)\\.addEventListener\\('click',event=>\\{event\\.preventDefault\\(\\);requestExpeditionLaunch\\(anchor\\);\\}\\)/,'The launch affordance must enter the same application request API');","assert.doesNotMatch(uiSource,/launch-veil|expedition-anchor/,'EXPLORE must not retain the retired hidden launch controls');\nassert.doesNotMatch(indexSource,/id=\"(?:launch-veil|expedition-anchor)\"/,'Production DOM must expose only the Collector Shell destination selector');");
  return text;
});
await update('tests/launch-pointer-lifecycle.test.mjs',text=>text.replace(/^.*launch-veil.*$/m,"assert.doesNotMatch(source,/launch-veil|expedition-anchor/,'Pointer lifecycle must not retain the retired fallback launch DOM contract');"));

const replaceNitrogenLaunch=async path=>update(path,source=>{
  let text=source;
  text=text.replace(/await waitFor\(`document\.querySelector\('#expedition-anchor'\)\?\.querySelector\('option\[value=\\"nitrogen\\"\]'\)!==null`,([^;]+);/g,"await evaluate(`document.querySelector('#open-supply').click()`);await waitFor(`!!document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]')`,$1);");
  text=text.replace(/const requested=await evaluate\(`\(\(\)=>\{const select=document\.querySelector\('#expedition-anchor'\);select\.value='nitrogen';select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\);document\.querySelector\('#launch-veil'\)\.click\(\);return select\.value;\}\)\(\)`\);assert\.equal\(requested,'nitrogen'\);/g,"const requested=await evaluate(`(()=>{const button=document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]');button.click();return button.dataset.region;})()`);assert.equal(requested,'nitrogen');");
  text=text.replace(/await evaluate\(`\(\(\)=>\{const select=document\.querySelector\('#expedition-anchor'\);select\.value='nitrogen';select\.dispatchEvent\(new Event\('change',\{bubbles:true\}\)\);document\.querySelector\('#launch-veil'\)\.click\(\);return true;\}\)\(\)`\);/g,"await evaluate(`document.querySelector('#open-supply').click()`);await waitFor(`!!document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]')`,'Nitrogen destination unavailable');await evaluate(`document.querySelector('#expedition-destinations [data-region=\\\"nitrogen\\\"]').click()`);");
  if(/expedition-anchor|launch-veil/.test(text))throw new Error(`${path}: retired launch fixture remains`);
  return text;
});
await replaceNitrogenLaunch('tests/critical-insight-freeze-browser.test.mjs');
await replaceNitrogenLaunch('tests/nitrogen-field-pickup-browser.test.mjs');
await replaceNitrogenLaunch('tests/nitrogen-chapter-browser.test.mjs');

await update('tests/rare-survey-browser.test.mjs',text=>{
  const next=text.replace("await evaluate(`document.querySelector('#launch-veil').click()`);","await evaluate(`document.querySelector('#open-supply').click()`);await waitFor(`!!document.querySelector('#expedition-destinations [data-region=\\\"veil\\\"]')`,'H Veil destination unavailable');await evaluate(`document.querySelector('#expedition-destinations [data-region=\\\"veil\\\"]').click()`);");
  if(/launch-veil|expedition-anchor/.test(next))throw new Error('Rare Survey legacy launch fixture remains');return next;
});
await update('tests/fuel-profiles-browser-check.mjs',text=>text.replace("await page.evaluate(()=>document.querySelector('#launch-veil').click());","await page.evaluate(()=>document.querySelector('#expedition-destinations [data-region=\\\"oxygen\\\"]').click());"));
await update('tests/oxygen-routes-browser-check.mjs',text=>text.replaceAll("await page.locator('#open-supply').click();await page.locator('#launch-veil').click();","await page.locator('#open-supply').click();await page.evaluate(()=>document.querySelector('#expedition-destinations [data-region=\\\"oxygen\\\"]').click());"));

await update('tests/veil-ui-check.mjs',source=>{
  let text=source.replaceAll("q('launch-veil').click();","game.run(\"veilUI.requestExpeditionLaunch('continue')\");");
  text=text.replace("q('expedition-anchor').value='oxygen';q('expedition-anchor').dispatchEvent(new game.window.Event('change',{bubbles:true}));game.run(\"veilUI.requestExpeditionLaunch('continue')\");","game.run(\"veilUI.requestExpeditionLaunch('oxygen')\");");
  if(/launch-veil|expedition-anchor/.test(text))throw new Error('veil UI check legacy launch fixture remains');return text;
});
await update('tests/mobile-layout-harness.html',source=>{
  let text=source;
  text=text.replace("document.querySelector('#supply').onclick=()=>openFixture('#open-supply');document.querySelector('#expedition').onclick=()=>openFixture('#launch-veil',true);","document.querySelector('#supply').onclick=()=>openFixture('#open-supply');document.querySelector('#expedition').onclick=()=>{if(!frame.contentWindow?.localStorage){result.textContent='本番画面を開いてください';return;}frame.contentWindow.localStorage.setItem('molecule-craft.resources.v1',JSON.stringify(expeditionState({full:true})));frame.addEventListener('load',async()=>{if(!await waitForProductionReady()){result.textContent='FAIL · 分子DB readiness timeout';return;}frame.contentDocument.querySelector('#open-supply')?.click();frame.contentDocument.querySelector('#expedition-destinations [data-region=\"oxygen\"]')?.click();requestAnimationFrame(check);},{once:true});frame.contentWindow.location.reload();};");
  return text;
});

for(const path of ['src/veil/supply.js','src/veil/ui.js','index.html','tests/critical-insight-freeze-browser.test.mjs','tests/nitrogen-field-pickup-browser.test.mjs','tests/nitrogen-chapter-browser.test.mjs','tests/rare-survey-browser.test.mjs','tests/fuel-profiles-browser-check.mjs','tests/oxygen-routes-browser-check.mjs','tests/veil-ui-check.mjs','tests/mobile-layout-harness.html']){
  const text=await read(path);if(/launch-veil|expedition-anchor/.test(text))throw new Error(`${path}: legacy launch token remains after cleanup`);
}

console.log('Applied repository hygiene cleanup.');