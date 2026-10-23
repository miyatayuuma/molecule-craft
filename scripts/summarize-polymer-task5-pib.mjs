// Owner: docs/validation/polymer-local-fragment-task5-pla-recovery.md.
// Reuse the frozen actual PNG campaign; no browser, new poses or PASS waiver.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
const directory=resolve(process.argv[2]),output=resolve(process.argv[3]??'test-results/pib-conflict'),bytes=await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/ba94cb-pib-visual.json.gz',import.meta.url)),r=JSON.parse(gunzipSync(bytes));
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(sha(JSON.stringify(r.initial.graph)),r.graphDigest);
assert.deepEqual(JSON.parse(await readFile(join(directory,'visual.json'))),r,'actual artifact must match the frozen campaign');
await mkdir(output,{recursive:true});const groups=[];
for(const g of r.simultaneous.filter(g=>!g.witness)){
 const views=r.views.filter(v=>v.mode==='local-'+g.anchor).map(v=>({...v,missingAtoms:g.atomIndices.filter(a=>!v.visibleAtoms.includes(a)),missingBonds:g.bondIndices.filter(b=>!v.visibleBonds.includes(b))}));
 assert.equal(views.length,40);assert.equal(new Set(views.map(v=>v.yaw+':'+v.pitch)).size,40);
 const ledger=[];for(const v of views){for(const [path,hash]of [[v.actualPNG,v.actualSha256],[v.mask,v.sha256],[v.photometryPNG,v.photometrySha256]])assert.equal(sha(await readFile(join(directory,path))),hash,'original PNG identity '+path);ledger.push({mode:v.mode,yaw:v.yaw,pitch:v.pitch,localQMin:v.localQMin,missingAtoms:v.missingAtoms,missingBonds:v.missingBonds,files:[{path:v.actualPNG,sha256:v.actualSha256},{path:v.mask,sha256:v.sha256},{path:v.photometryPNG,sha256:v.photometrySha256}]});}
 const best=views.toSorted((a,b)=>a.missingAtoms.length+a.missingBonds.length-b.missingAtoms.length-b.missingBonds.length).slice(0,2);
 const retained=[];for(const v of best){const files=[];for(const name of [v.actualPNG,v.mask,v.photometryPNG]){const b=await readFile(join(directory,name));await writeFile(join(output,name),b);files.push({path:name,sha256:sha(b)});}retained.push({yaw:v.yaw,pitch:v.pitch,missingAtoms:v.missingAtoms,missingBonds:v.missingBonds,files});}
 groups.push({anchor:g.anchor,atomIndices:g.atomIndices,bondIndices:g.bondIndices,atomPass:views.filter(v=>!v.missingAtoms.length).length,bondPass:views.filter(v=>!v.missingBonds.length).length,jointPass:views.filter(v=>!v.missingAtoms.length&&!v.missingBonds.length).length,retained,ledger});
}
const report={kind:'FROZEN_ACTUAL_PNG_40_DIRECTION_CONFLICT_NOT_GLOBAL_IMPOSSIBILITY',sourceSha:r.sourceSha,sampleId:r.sampleId,routeId:r.routeId,graphDigest:r.graphDigest,viewport:r.viewport,DPR:r.DPR,motion:r.motion,frozenReportSha256:sha(bytes),originalArtifactId:12420347609,budget:{directions:40,localAttemptsPerAnchor:1},groups,decision:'BLOCKED_A07_S12_NO_SIMULTANEOUS_VIEW',limits:['All original PNG/mask/photometry hashes verified. Only the two closest failed poses per anchor are copied here.','This proves failure in the existing fixed campaign, not impossibility under every rigid pose.','No new browser campaign, chemistry change, fit change or grader relaxation.']};
await writeFile(join(output,'pib-visibility-conflict.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({kind:report.kind,sourceSha:r.sourceSha,groups:groups.map(({anchor,atomPass,bondPass,jointPass})=>({anchor,atomPass,bondPass,jointPass}))},null,2));
