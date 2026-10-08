import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';

const directory=process.argv[2]??'test-results/reaction-lab-polymer-simplification';
const routeIds=['polyethylene-coordination','ethylene-propylene-coordination','polyethylene-oxide-anionic-ring-opening','polyethylene-terephthalate-direct-polycondensation','phenol-formaldehyde-resole','styrene-butadiene-radical','butyl-rubber-cationic','nylon-6-6-direct-polycondensation','polystyrene-radical'];
const legacy={cinematicActive:false,cinematicObjectCount:0,cinematicGeometryCount:0,cinematicMaterialCount:0,morphologyBridgeActive:false,morphologyRendererAllocations:0,bridgeRendererAllocations:0,cameraTransitionActive:false};
const viewports=[{width:390,height:844,label:'mobile'},{width:1280,height:900,label:'desktop'}],results=[];
for(const viewport of viewports){
  const rows=JSON.parse(await readFile(`${directory}/browser-${viewport.width}.json`,'utf8'));
  assert.equal(rows.length,routeIds.length+1,`${viewport.label}: all representative routes and reduced motion are recorded`);
  const byRoute=new Map(rows.map(row=>[row.routeId,row]));assert.equal(byRoute.size,rows.length,`${viewport.label}: no duplicate browser evidence rows`);
  for(const routeId of routeIds){const row=byRoute.get(routeId);assert.ok(row,`${viewport.label}: ${routeId} evidence is present`);assert.equal(row.durationMs,650);}
  const reduced=byRoute.get('polyethylene-reduced-motion');assert.ok(reduced,`${viewport.label}: reduced motion evidence is present`);assert.equal(reduced.durationMs,250);
  for(const row of rows){
    assert.equal(row.viewport.width,viewport.width);assert.equal(row.viewport.height,viewport.height);assert.ok(Number.isInteger(row.unitCount)&&row.unitCount>0);
    assert.equal(row.readyLayoutCalls,row.finiteLayoutCalls,`${viewport.label} ${row.routeId}: ready does not trigger another finite layout`);
    assert.equal(row.completionLayoutCallsAfterReady,0,`${viewport.label} ${row.routeId}: ready has no completion layout loop`);
    assert.deepEqual(row.legacy,legacy,`${viewport.label} ${row.routeId}: retired renderers and camera transition remain inactive`);
    assert.deepEqual(row.legacyModulesLoaded,[],`${viewport.label} ${row.routeId}: retired modules were not fetched`);
  }
  results.push({viewport:`${viewport.width}x${viewport.height}`,routeCount:routeIds.length,normalFeedbackMs:650,reducedFeedbackMs:250,layoutCallsAfterReady:0,legacyModuleFetches:0,legacyRendererAllocations:0});
  console.log(`${viewport.width}x${viewport.height}: ${routeIds.length} representative routes + reduced motion; finite layout stops at ready; legacy modules/resources absent.`);
}
await mkdir(directory,{recursive:true});
await writeFile(`${directory}/resource-summary.json`,JSON.stringify({method:'actual browser route evidence; runtime resource gate only; no CPU or GPU percentage inferred',results},null,2));
