// CI evidence transfer: data chunks contain measurements, never credentials.
import {readFile} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {summarizeProfile,classifyProfile} from './summarize-field-profile.mjs';
const directory=process.argv[2],browser=process.argv.includes('--browser'),partial=process.argv.includes('--allow-partial'),phase=browser?'browser':basename(directory);
const emit=(type,data)=>console.log('FIELD_'+type+' '+JSON.stringify(data));
let bytes;
if(browser){
  const report=await readFile(join(directory,'browser.json'));bytes=gzipSync(report);
  const data=JSON.parse(report);emit('BROWSER',{browser:data.browser,runtimeSourceSha256:data.runtimeSourceSha256,results:data.results});
  const visuals=JSON.parse(await readFile(join(directory,'visual-comparison.json')));emit('VISUALS',visuals);
}else{
  try{bytes=await readFile(join(directory,'raw.json.gz'));}catch(e){if(e.code!=='ENOENT'||!partial)throw e;try{bytes=await readFile(join(directory,'checkpoint.json.gz'));}catch(e){if(e.code!=='ENOENT')throw e;emit('MISSING',{phase});process.exit(0);}}
  const report=JSON.parse(gunzipSync(bytes));
  try{const summary=summarizeProfile(report);const {groups,...header}=summary;emit('HEADER',{phase,...header});for(const group of groups)emit('GROUP',{phase,group});if(report.mode==='coarse')emit('CLASSIFICATION',classifyProfile(summary));}
  catch(e){if(!partial)throw e;emit('PARTIAL',{phase,message:e.message,results:report.results.length});}
}
const base64=bytes.toString('base64'),chunks=Math.ceil(base64.length/8000),sha256=createHash('sha256').update(bytes).digest('hex');
emit('RAW_METADATA',{phase,file:phase+'-raw.json.gz',sha256,chunks,bytes:bytes.length});
for(let index=0;index<chunks;index++)emit('RAW_CHUNK',{phase,index,base64:base64.slice(index*8000,(index+1)*8000)});
