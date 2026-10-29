// Owner: docs/validation/polymer-local-fragment-task4-geometry.md.
// Fixed measurement budget: 2 warmups + 4 retained trials/route/build, B then C.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {polymerTask4Fixtures} from '../tests/helpers/polymer-task4-fixtures.mjs';
import {createPolymerFragment3DLayout,polymerGeometryModel,polymerGeometryDiagnostics,resolvePolymerFragmentTargets} from '../src/polymer-fragment-3d-layout.js';
const baselineSha='37b7d2cde1e60cd28575784a252382f4599c391f',out=resolve(process.argv[2]??'test-results/polymer-task4'),sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
await mkdir(out,{recursive:true});const temporary=await mkdtemp(join(tmpdir(),'polymer-task4-'));
try{
  await writeFile(join(temporary,'baseline.mjs'),execFileSync('git',['show',`${baselineSha}:src/polymer-fragment-3d-layout.js`],{encoding:'utf8'}));
  const baseline=(await import(pathToFileURL(join(temporary,'baseline.mjs')))).createPolymerFragment3DLayout,fixtures=await polymerTask4Fixtures(),rows=[],perf=[];
  for(const f of fixtures){
    const options={sourceRecordsByInstanceId:f.sourceRecordsByInstanceId},before=sha(f),model=polymerGeometryModel(f.sample.fragment,f.sourceRecordsByInstanceId),old=baseline(f.sample,options),p=createPolymerFragment3DLayout(f.sample,options),repeat=createPolymerFragment3DLayout(structuredClone(f.sample),structuredClone(options));
    assert.deepEqual(p,repeat);assert.equal(sha(f),before);assert.deepEqual(p.bonds,f.sample.fragment.bonds);assert.deepEqual(p.atomOrigins,f.sample.fragment.atomOrigins);assert.deepEqual(p.atoms.map(a=>[a.id,a.element,a.formalCharge]),f.sample.fragment.atoms.map(a=>[a.id,a.element,a.formalCharge]));const d=polymerGeometryDiagnostics(model,p.atoms),b=polymerGeometryDiagnostics(model,old.atoms),targets=resolvePolymerFragmentTargets(f.sample,{...options,route:f.route});
    const group=(values,field)=>Object.fromEntries([...new Set(values.map(v=>v.environment??v.kind))].map(k=>{const a=values.filter(v=>(v.environment??v.kind)===k);return[k,{count:a.length,min:Math.min(...a.map(v=>v[field])),max:Math.max(...a.map(v=>v[field])),maxError:Math.max(0,...a.map(v=>v.error??v.deviation??0))}]}));
    rows.push({routeId:f.route.routeId,polymerId:f.route.polymerId,sampleId:f.sample.sampleId,batchGeneration:f.sample.batchGeneration,inputDigest:sha({sample:f.sample,...options}),graphDigest:sha(f.sample.fragment),atomCount:p.atoms.length,bondCount:p.bonds.length,bondOrderHistogram:Object.fromEntries([1,2,3].map(o=>[o,p.bonds.filter(b=>b.order===o).length])),graphAndOriginPreserved:true,determinism:true,iterations:p.diagnostics.iterations,qualityTargetReached:p.diagnostics.qualityTargetReached,accepted:p.diagnostics.accepted,fallback:p.diagnostics.fallback,fallbackReason:p.diagnostics.reason,bounds:p.bounds,depthSpan:p.bounds.depth,baseline:{legacyAccepted:old.diagnostics.accepted,chemicalAccepted:b.accepted,maxBondError:b.maxBondError,maxAngleError:b.maxAngleError,violations:b.violations},candidate:{maxBondError:d.maxBondError,maxAngleError:d.maxAngleError,minimumNonbondedDistance:d.minimumNonbondedDistance,severeOverlapCount:d.severeOverlapCount,bondsByEnvironment:group(d.bonds,'length'),anglesByEnvironment:group(d.angles,'degrees'),planesByEnvironment:group(d.planes,'deviation'),chemical:d},targets,xyz:p.atoms.map(({id,element,formalCharge,origin,x,y,z})=>({id,element,formalCharge,origin,x,y,z}))});
    const times={baseline:[],candidate:[]};
    for(const [name,solve]of [['baseline',baseline],['candidate',createPolymerFragment3DLayout]]){
      for(let i=0;i<2;i++)solve(f.sample,options);
      for(let i=0;i<4;i++){const start=performance.now();solve(f.sample,options);times[name].push(performance.now()-start);}
    }
    perf.push({routeId:f.route.routeId,atomCount:p.atoms.length,...times});
  }
  const runtimeSourceSha256=sha(await readFile('src/polymer-fragment-3d-layout.js','utf8'));
  const evidence={schemaVersion:2,baselineSha,runtimeSourceSha256,node:process.version,units:{coordinates:'world',worldUnitsPerAngstrom:.78,lengthResidualLimit:.08,angleLimitDegrees:15,linearAngleLimitDegrees:3,planeLimitWorld:.08,stericSevere:'0.55 * (vdW radius sum) * 0.78; graph distance >=3'},all25Accepted:rows.every(r=>r.accepted&&r.targets.resolved),rows};
  await writeFile(join(out,'validation-25.json'),JSON.stringify(evidence,null,2)+'\n');await writeFile(join(out,'generation-performance.json'),JSON.stringify({baselineSha,runtimeSourceSha256,node:process.version,conditions:{warmup:2,trials:4,order:'baseline then candidate per route',sameNodeProcess:true,diagnosticsIncluded:true,randomSelection:false},rows:perf},null,2)+'\n');
  console.log(JSON.stringify({routeCount:rows.length,accepted:rows.filter(r=>r.accepted).length,all25Accepted:evidence.all25Accepted,maximumBondError:Math.max(...rows.map(r=>r.candidate.maxBondError)),maximumAngleError:Math.max(...rows.map(r=>r.candidate.maxAngleError)),maximumPlaneDeviation:Math.max(...rows.flatMap(r=>r.candidate.chemical.planes.map(p=>p.deviation)))}));
  assert.equal(evidence.all25Accepted,true);
}finally{await rm(temporary,{recursive:true,force:true});}
