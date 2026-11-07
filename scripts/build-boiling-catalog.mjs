import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('data/boiling-points.json',root),'utf8'));
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
const output=`// Generated from data/boiling-points.json by scripts/build-boiling-catalog.mjs.
// Values are normal boiling points near 1 atm, not estimated from structure.
export const NORMAL_BOILING_POINTS=Object.freeze({
${entries.join('\n')}
});
`;
const target=new URL('src/compare-boiling-catalog.js',root);
if(process.argv.includes('--check')){
  const existing=await readFile(target,'utf8').catch(()=>null);
  if(existing!==output)throw new Error(`${fileURLToPath(target)} is not up to date`);
  console.log(`Boiling point catalog current: ${entries.length} entries`);
}else{
  await writeFile(target,output);
  console.log(`Generated ${entries.length} normal boiling point entries`);
}
