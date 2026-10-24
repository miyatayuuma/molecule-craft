// Owner: Task⑤ static visual workflow. Missing evidence is a gate failure.
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
const directory=process.argv[2]??'test-results/reaction-lab-polymer-simplification/task5',diagnosticRoute=process.env.POLYMER_FIT_DIAGNOSTIC_ROUTE??null,expected=diagnosticRoute?1:Number(process.env.POLYMER_TASK5_DPR??1)===2?16:25;
const failures=[],rows=[];
for(const name of await readdir(directory)){const path=join(directory,name,'visual.json');let row;try{row=JSON.parse(await readFile(path,'utf8'));}catch{failures.push(`${name}: missing visual.json`);continue;}
  const reasons=[];
  if(!row.uiAcceptance?.length)reasons.push('A10/A11 evidence missing');
  for(const ui of row.uiAcceptance??[])if(ui.failures.length||ui.horizontalOverflow>1)reasons.push('A10/A11 '+JSON.stringify(ui.failures));
  if(diagnosticRoute&&row.routeId!==diagnosticRoute)reasons.push('diagnostic route mismatch');
  if(!diagnosticRoute&&!/^[0-9a-f]{40}$/.test(process.env.POLYMER_SOURCE_SHA??''))reasons.push('formal source SHA missing');
  if(row.sourceSha!==process.env.POLYMER_SOURCE_SHA)reasons.push('source SHA mismatch');
  if(!row.initialEndVisibility||row.initialEndVisibility.some(x=>x.visibleFraction<.60))reasons.push('initial real ends insufficiently visible');
  const triples=row.initial.graph.bonds.flatMap((b,i)=>b.order===3?[i]:[]),tripleRecords=row.tripleLocalWitnesses??[];
  if(JSON.stringify(tripleRecords.map(t=>t.bondIndex).sort((a,b)=>a-b))!==JSON.stringify(triples))reasons.push('actual triple bond ledger incomplete');
  for(const triple of tripleRecords){const v=triple.witness,b=row.initial.graph.bonds[triple.bondIndex];if(!v||!b||b.order!==3||!v.mode.startsWith('local-')||!(v.localQMin>=20)||!v.visibleBonds.includes(triple.bondIndex)||[b.a,b.b].some(i=>!v.visibleAtoms.includes(i)||!v.localQAtoms.includes(i)))reasons.push('triple local focus missing: '+triple.bondIndex);}
  if(!row.resetAfterLocal||row.resetAfterLocal.angle>1e-5||Math.abs(row.resetAfterLocal.zoomRatio-1)>1e-6||!(row.resetAfterLocal.maxProjectionError<=1))reasons.push('local-focus return unverified');
  if(!row.pointerWitnessesComplete)reasons.push('actual pointer witnesses incomplete');
  if(row.views.some(v=>!v.photometryPNG||!v.photometrySha256))reasons.push('annotation-free photometry evidence missing');
  if(row.views.some(v=>!v.domOcclusions))reasons.push('actual DOM/annotation occlusion evidence missing');
  if(!row.atomVisibilityCriterion)reasons.push('separate A03/A06 acceptance contract missing');
  if(!row.idMaskRaster?.startsWith('SINGLE_SAMPLE_SRGB_OBJECT_ID'))reasons.push('unmixed object-ID raster evidence missing');
  for(const group of row.simultaneous??[]){const v=group.witness;if(!v)reasons.push('simultaneous group missing: '+group.kind+'/'+group.anchor);else if(!v.mode.startsWith('local-')||!(v.localQMin>=20)||!v.localShell?.includes(group.anchor)||group.atomIndices.some(i=>!v.localQAtoms?.includes(i)||!v.visibleAtoms.includes(i))||group.bondIndices.some(i=>!v.visibleBonds.includes(i))||group.kind.startsWith('aromatic-')&&v.selection?.kind!==group.kind)reasons.push('local group contract incomplete: '+group.kind+'/'+group.anchor);}
  if(!row.simultaneous)reasons.push('simultaneous group ledger missing');
  if(row.missingAtoms.length)reasons.push(`unrecovered atoms ${row.missingAtoms}`);
  if(row.initial.graph.atoms.some((_,i)=>!row.atomWitnesses[i]?.contour?.pass||!row.atomWitnesses[i]?.photometryPNG||!row.atomWitnesses[i]?.photometrySha256))reasons.push('per-atom A06 photometry incomplete');
  if(row.missingBonds.length)reasons.push(`unrecovered bonds ${row.missingBonds}`);
  if(!row.localRecovery.completed||!row.rasterLuminance.completed)reasons.push('local/raster grading incomplete');
  for(const ring of row.ringSimultaneous)if(!ring.witness)reasons.push(`ring path not simultaneous: ${ring.kind}`);
  if(row.views.filter(v=>v.mode==='overview').length!==40)reasons.push('missing fixed overview grid');
  const kinds=new Set(row.comparisonStates.map(s=>s.kind));if(!kinds.has('before')||!kinds.has('after'))reasons.push('comparison states incomplete');
  if(reasons.length)failures.push(`${name}: ${reasons.join('; ')}`);
  rows.push({polymerId:row.polymerId,atoms:row.initial.graph.atoms.length,bonds:row.initial.graph.bonds.length,views:row.views.length,missingAtoms:row.missingAtoms,missingBonds:row.missingBonds,failures:reasons});
}
console.log(JSON.stringify({kind:diagnosticRoute?'SINGLE_ROUTE_PILOT_NOT_ALL25_OR_FINAL_ACCEPTANCE':'FORMAL_STATIC_BROWSER_GATE',sourceSha:process.env.POLYMER_SOURCE_SHA??null,expected,completed:rows.length,rows,failures},null,2));
assert.equal(rows.length,expected,'Every declared route must have complete evidence');
assert.deepEqual(failures,[],'Static visual acceptance has unresolved failures');
