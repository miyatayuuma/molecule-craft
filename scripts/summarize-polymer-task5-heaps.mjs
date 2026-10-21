// Test-only heap ownership evidence; never imported by the application or RAF.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
const dir=resolve(process.argv[2]??'test-results/reaction-lab-polymer-simplification'),cycles=[];
for(const kind of ['before','water','concept']){
  const file='heap-'+kind+'.heapsnapshot',bytes=await readFile(join(dir,file)),data=JSON.parse(bytes),meta=data.snapshot.meta,fields=meta.node_fields,types=meta.node_types[0],width=fields.length,at=Object.fromEntries(['type','name','self_size'].map(k=>[k,fields.indexOf(k)]));
  assert.ok(Object.values(at).every(i=>i>=0),'known real-browser heap node fields');assert.equal(data.nodes.length%width,0);
  const selfSizeByType={},resources={};let selfSize=0;
  for(let i=0;i<data.nodes.length;i+=width){const type=types[data.nodes[i+at.type]],name=data.strings[data.nodes[i+at.name]],size=data.nodes[i+at.self_size];selfSize+=size;selfSizeByType[type]=(selfSizeByType[type]??0)+size;
    if(['object','native'].includes(type)&&/^(Float32Array|ArrayBuffer|WebGLBuffer|WebGLVertexArrayObject|WebGLProgram|WebGLShader|system \/ JSArrayBufferData)$/.test(name)){const key=type+'|'+name,row=resources[key]??={count:0,selfSize:0};row.count++;row.selfSize+=size;}
  }
  cycles.push({kind,file,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,selfSize,selfSizeByType,resources});
}
const first=cycles[0],last=cycles.at(-1),growthByType=Object.fromEntries([...new Set(cycles.flatMap(c=>Object.keys(c.selfSizeByType)))].map(k=>[k,(last.selfSizeByType[k]??0)-(first.selfSizeByType[k]??0)])),resourceKeys=[...new Set(cycles.flatMap(c=>Object.keys(c.resources)))],resourceDifferences=resourceKeys.filter(k=>cycles.some(c=>JSON.stringify(c.resources[k])!==JSON.stringify(first.resources[k])));
const report={kind:'BOUNDED_REAL_BROWSER_RESOURCE_OWNERSHIP',sourceSha:process.env.POLYMER_SOURCE_SHA??null,cycles,totalSelfSizeGrowth:last.selfSize-first.selfSize,growthByType,resourceDifferences,limitation:'Three real PF construction/disposal cycles. Self-size is not retained-size dominance analysis or a proof of long-session heap convergence. Compiled-code growth is reported separately; no total-heap threshold is changed.'};
await writeFile(join(dir,'heap-summary.json'),JSON.stringify(report,null,2));assert.deepEqual(resourceDifferences,[],'same PF construction/disposal must not accumulate measured geometry/buffer resources');console.log(JSON.stringify({sourceSha:report.sourceSha,totalSelfSizeGrowth:report.totalSelfSizeGrowth,growthByType,resourceDifferences}));
