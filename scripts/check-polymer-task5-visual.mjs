// Owner: Task⑤ static visual workflow. Missing evidence is a gate failure.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const directory=process.argv[2]??'test-results/reaction-lab-polymer-simplification/task5',expected=Number(process.env.POLYMER_TASK5_DPR??1)===2?16:25;
const failures=[],rows=[];
for(const name of await readdir(directory)){const path=join(directory,name,'visual.json');let row;try{row=JSON.parse(await readFile(path,'utf8'));}catch{failures.push(`${name}: missing visual.json`);continue;}
  const reasons=[];
  if(!row.uiAcceptance?.length)reasons.push('A10/A11 evidence missing');
  for(const ui of row.uiAcceptance??[])if(ui.failures.length||ui.horizontalOverflow>1)reasons.push('A10/A11 '+JSON.stringify(ui.failures));
  if(row.sourceSha!==process.env.POLYMER_SOURCE_SHA)reasons.push('source SHA mismatch');
  if(!row.initialEndVisibility||row.initialEndVisibility.some(x=>x.visibleFraction<.60))reasons.push('initial real ends insufficiently visible');
  for(const triple of row.tripleLocalWitnesses??[])if(!triple.witness)reasons.push('triple local focus missing: '+triple.bondIndex);
  if(!row.resetAfterLocal||row.resetAfterLocal.angle>1e-5||Math.abs(row.resetAfterLocal.zoomRatio-1)>1e-6||!(row.resetAfterLocal.maxProjectionError<=1))reasons.push('local-focus return unverified');
  if(!row.pointerWitnessesComplete)reasons.push('actual pointer witnesses incomplete');
  for(const group of row.simultaneous??[])if(!group.witness)reasons.push('simultaneous group missing: '+group.kind+'/'+group.anchor);
  if(!row.simultaneous)reasons.push('simultaneous group ledger missing');
  if(row.missingAtoms.length)reasons.push(`unrecovered atoms ${row.missingAtoms}`);
  if(row.missingBonds.length)reasons.push(`unrecovered bonds ${row.missingBonds}`);
  if(!row.localRecovery.completed||!row.rasterLuminance.completed)reasons.push('local/raster grading incomplete');
  for(const ring of row.ringSimultaneous)if(!ring.witness)reasons.push(`ring path not simultaneous: ${ring.kind}`);
  if(row.views.filter(v=>v.mode==='overview').length!==40)reasons.push('missing fixed overview grid');
  const kinds=new Set(row.comparisonStates.map(s=>s.kind));if(!kinds.has('before')||!kinds.has('after'))reasons.push('comparison states incomplete');
  if(reasons.length)failures.push(`${name}: ${reasons.join('; ')}`);
  rows.push({polymerId:row.polymerId,atoms:row.initial.graph.atoms.length,bonds:row.initial.graph.bonds.length,views:row.views.length,missingAtoms:row.missingAtoms,missingBonds:row.missingBonds,failures:reasons});
}
console.log(JSON.stringify({expected,completed:rows.length,rows,failures},null,2));
assert.equal(rows.length,expected,'Every declared route must have complete evidence');
assert.deepEqual(failures,[],'Static visual acceptance has unresolved failures');
