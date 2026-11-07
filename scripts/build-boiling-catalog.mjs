import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/boiling-points.json',root),'utf8'));
const exceptions=JSON.parse(await readFile(new URL('data/boiling-exceptions.json',root),'utf8'));
const molecules=JSON.parse(await readFile(new URL('data/molecules.json',root),'utf8'));
const ids=new Set(molecules.map(record=>record.id));
const entries=[];
for(const [id,entry] of Object.entries(catalog.compounds)){
  if(!ids.has(id))throw new Error(`Unknown molecule ID in boiling catalog: ${id}`);
  if(!Number.isFinite(entry.celsius)||!Number.isInteger(entry.pubchemCid)||entry.pubchemCid<1)
    throw new Error(`Invalid boiling point or PubChem ID: ${id}`);
  if(!Array.isArray(entry.sourceNames)||!entry.sourceNames.length)throw new Error(`Missing sources: ${id}`);
  entries.push(`  ${JSON.stringify(id)}: {celsius:${entry.celsius},pubchemCid:${entry.pubchemCid}},`);
}
const exceptionEntries=[];
for(const [id,entry] of Object.entries(exceptions.compounds)){
  if(!ids.has(id)||Object.hasOwn(catalog.compounds,id))throw new Error(`Conflicting comparison exception: ${id}`);
  if(entry.kind==='sublimation'){
    if(!Number.isFinite(entry.celsius))throw new Error(`Invalid sublimation point: ${id}`);
    exceptionEntries.push(`  ${JSON.stringify(id)}: {kind:'sublimation',celsius:${entry.celsius}},`);
  }else if(entry.kind==='range'){
    if(!Number.isFinite(entry.lowC)||!Number.isFinite(entry.highC)||entry.lowC>=entry.highC||!['isomer','sources'].includes(entry.basis))
      throw new Error(`Invalid normal-boiling range: ${id}`);
    exceptionEntries.push(`  ${JSON.stringify(id)}: {kind:'range',basis:${JSON.stringify(entry.basis)},lowC:${entry.lowC},highC:${entry.highC}},`);
  }else throw new Error(`Unknown comparison exception: ${id}`);
  if(!Array.isArray(entry.sourceUrls)||!entry.sourceUrls.every(url=>url.startsWith('https://'))||!entry.sourceUrls.length)
    throw new Error(`Missing primary-source URL: ${id}`);
}
const output=`// Generated from data/boiling-points.json and data/boiling-exceptions.json.
// Normal boiling points, independently labelled sublimation temperatures,
// and bounded literature/isomer ranges. Never interpret a range midpoint
// as a measured single-compound boiling point.
export const NORMAL_BOILING_POINTS=Object.freeze({
${entries.join('\n')}
});
export const BOILING_COMPARISON_EXCEPTIONS=Object.freeze({
${exceptionEntries.join('\n')}
});
`;
const target=new URL('src/compare-boiling-catalog.js',root);
if(process.argv.includes('--check')){
  const existing=await readFile(target,'utf8').catch(()=>null);
  if(existing!==output)throw new Error(`${fileURLToPath(target)} is not up to date`);
  console.log(`Boiling point catalog current: ${entries.length} normal, ${exceptionEntries.length} alternative entries`);
}else{
  await writeFile(target,output);
  console.log(`Generated ${entries.length} normal and ${exceptionEntries.length} alternative entries`);
}
