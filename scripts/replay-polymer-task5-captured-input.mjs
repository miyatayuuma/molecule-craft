// Owner: Task⑤ fit diagnostic workflow and validation ledger. A real rejected
// production input blocks acceptance; this is not a new chemistry fixture.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {createPolymerFragment3DLayout,createSafePolymerFragmentPlan} from '../src/polymer-fragment-3d-layout.js';
import {createPolymerPresentationPlan} from '../src/reaction-lab-polymer-presentation.js';

const customInput=Boolean(process.argv[2]),path=customInput?resolve(process.argv[2]):new URL('../docs/validation/polymer-local-fragment-task5-evidence/hosted-pet-failure.json',import.meta.url),bytes=await readFile(path),captured=JSON.parse(bytes),{snapshot,sources}=captured.input,sample=snapshot.sample;
const sha=value=>createHash('sha256').update(value).digest('hex'),before=JSON.stringify({sample,sources});
const plan=createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId:sources});
let safePlan=null,safeError=null;
try{safePlan=createSafePolymerFragmentPlan(sample,{sourceRecordsByInstanceId:sources},createPolymerPresentationPlan);}catch(error){safeError={code:error.code,message:error.message};}
const unchanged=JSON.stringify({sample,sources})===before;
const report={kind:'CAPTURED_PRODUCTION_INPUT_REPLAY_NOT_BROWSER_ACCEPTANCE',capturedSourceSha:customInput?(process.env.POLYMER_CAPTURED_SOURCE_SHA??null):'6400361c5bc813cd098a038de7883df4692b36ef',candidateSourceSha:process.env.POLYMER_SOURCE_SHA??null,run:customInput?null:39544766886,job:customInput?null:119040316034,artifact:customInput?null:12322320528,inputSHA256:sha(bytes),geometrySourceSHA256:sha(await readFile(new URL('../src/polymer-fragment-3d-layout.js',import.meta.url))),sampleId:sample.sampleId,routeId:sample.routeId,graphDigest:sha(JSON.stringify(sample.fragment)),viewport:customInput?JSON.parse(process.env.POLYMER_CAPTURED_VIEWPORT??'null'):{width:360,height:780,mobile:true},DPR:customInput?Number(process.env.POLYMER_CAPTURED_DPR??1):1,motion:customInput?(process.env.POLYMER_CAPTURED_MOTION??'normal'):'normal',unchanged,diagnostics:plan.diagnostics,safeError,pass:unchanged&&Boolean(safePlan?.diagnostics.accepted)};
const directory=resolve(process.env.POLYMER_EVIDENCE_DIR??'test-results/reaction-lab-polymer-simplification');await mkdir(directory,{recursive:true});await writeFile(resolve(directory,'captured-input-replay.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,diagnostics:{...report.diagnostics,chemical:{violations:report.diagnostics.chemical.violations}}},null,2));
if(!report.pass)process.exitCode=1;
