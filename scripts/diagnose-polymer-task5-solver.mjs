// Owner: Task⑤ PET recovery. Instrument a private test-only copy; production
// layout and RAF receive no tracing hooks. Full constraints retained per iteration.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sourceRef=process.env.SOLVER_SOURCE_REF??'300046aef8fb216c59a64451cba89baf5c97e4ba';
const source=process.env.SOLVER_SOURCE_PATH?await readFile(process.env.SOLVER_SOURCE_PATH,'utf8'):sourceRef==='working-tree'?await readFile(new URL('../src/polymer-fragment-3d-layout.js',import.meta.url),'utf8'):execFileSync('git',['show',`${sourceRef}:src/polymer-fragment-3d-layout.js`],{encoding:'utf8'});
const captured=JSON.parse(await readFile(new URL('../docs/validation/polymer-local-fragment-task5-evidence/hosted-pet-failure.json',import.meta.url)));
const variant=process.env.SOLVER_VARIANT??'baseline';
let instrumented=source;
const replace=(a,b)=>{if(instrumented.split(a).length!==2)throw Error(`Ambiguous diagnostic patch: ${a}`);instrumented=instrumented.replace(a,b);};
if(variant==='plane-last')replace('for(const plane of model.planar)projectPlane(plane.indices);\n    for(const b of model.bondTargets)projectDistance(b.a,b.b,b.target,.9);','for(const b of model.bondTargets)projectDistance(b.a,b.b,b.target,.9);\n    for(const plane of model.planar)projectPlane(plane.indices);');
else if(variant==='symmetric'){
  for(const [name,array] of [['pair','activeNonbonded'],['a','model.angles'],['indices','model.rings'],['plane','model.planar'],['b','model.bondTargets']]){
    const expression=`for(const ${name} of ${array})${name==='a'?'projectAngle(a);':''}`;
    replace(expression,`for(const ${name} of (sweep%2?[...${array}].reverse():${array}))${name==='a'?'projectAngle(a);':''}`);
  }
}else if(variant==='distance-plane-symmetric'){
  replace('for(const plane of model.planar)projectPlane(plane.indices);\n    for(const b of model.bondTargets)projectDistance(b.a,b.b,b.target,.9);','for(const b of model.bondTargets)projectDistance(b.a,b.b,b.target,.9);\n    for(const plane of (sweep%2?[...model.planar].reverse():model.planar))projectPlane(plane.indices);');
}else if(variant!=='baseline')throw Error(`Unknown variant: ${variant}`);
instrumented='export const iterationTrace=[],stageTrace=[];\n'+instrumented;
replace('for(let i=0;i<iterations;i++){','iterationTrace.push({iteration:0,chemical:polymerGeometryDiagnostics(model,p)});\n  for(let i=0;i<iterations;i++){');
for(const [anchor,label]of [
  ['for(const a of model.angles)projectAngle(a);','repulsion'],
  ['for(const indices of model.rings)','angle'],
  ['for(const plane of model.planar)','ring'],
  ['for(const b of model.bondTargets)','plane']
]){
  // Trace only baseline stages; complete iteration trace is shared by variants.
  if(variant==='baseline')replace(anchor,`if(sweep===7&&(i===0||i===iterations-1))stageTrace.push({iteration:i+1,after:'${label}',chemical:polymerGeometryDiagnostics(model,p)});\n    ${anchor}`);
}
replace('if(performed%8===0){','iterationTrace.push({iteration:performed,chemical:polymerGeometryDiagnostics(model,p)});\n    if(performed%8===0){');
const layout=await import('data:text/javascript;base64,'+Buffer.from(instrumented).toString('base64'));
const plan=layout.createPolymerFragment3DLayout(captured.input.snapshot.sample,{sourceRecordsByInstanceId:captured.input.sources});
const directory='test-results/task5-solver';await mkdir(directory,{recursive:true});
await writeFile(`${directory}/${sourceRef==='working-tree'?'retained':variant}.json`,JSON.stringify({variant,sourceRef,sourceSHA256:createHash('sha256').update(source).digest('hex'),diagnostics:plan.diagnostics,iterations:layout.iterationTrace,stages:layout.stageTrace})+'\n');
const summary=d=>({accepted:d.accepted,bond:d.maxBondError,angle:d.maxAngleError,plane:Math.max(...d.planes.map(p=>p.deviation)),steric:d.severeOverlapCount});
console.log(JSON.stringify({variant,final:summary(plan.diagnostics.chemical),iterations:layout.iterationTrace.filter(t=>[0,1,8,40,80,120,160].includes(t.iteration)).map(t=>({iteration:t.iteration,...summary(t.chemical)})),finalStages:layout.stageTrace.filter(t=>t.iteration===160).map(t=>({after:t.after,...summary(t.chemical)})),acceptedIterations:layout.iterationTrace.filter(t=>t.chemical.accepted).map(t=>t.iteration)},null,2));
