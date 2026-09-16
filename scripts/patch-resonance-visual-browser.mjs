import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../tests/encyclopedia-chemistry-visual-browser.test.mjs',import.meta.url);
let source=await readFile(url,'utf8');
const replace=(from,to,label)=>{if(!source.includes(from))throw new Error(`Patch anchor missing: ${label}`);source=source.replace(from,to);};
replace("arc:!!node.querySelector('[data-delocalization=\"three-center\"]'),formal:","arc:!!node.querySelector('[data-delocalization=\"three-center\"]'),distributed:[...node.querySelectorAll('[data-delocalization=\"distributed-bond\"]')].map(n=>n.dataset.resonanceBranch),formalPositions:[...node.querySelectorAll('[data-charge-kind=\"formal\"][data-charge-role]')].map(n=>({text:n.textContent,role:n.dataset.chargeRole,x:Number(n.getAttribute('x')),y:Number(n.getAttribute('y'))})),formal:",'inspect resonance markers');
replace("assert(nitro.visuals[0].arc);","assert.equal(nitro.visuals[0].arc,false);assert.deepEqual([...nitro.visuals[0].distributed].sort(),['bottom','top']);assert.deepEqual(nitro.visuals[0].formalPositions.map(c=>c.role).sort(),['center','center','terminal','terminal']);assert(nitro.visuals[0].formalPositions.filter(c=>c.role==='center').every(c=>c.y<60),'nitro N+ labels stay above the N/bond junction');",'nitro hybrid assertion');
replace("assert(ozone.visuals[0].arc);","assert.equal(ozone.visuals[0].arc,false);assert.deepEqual([...ozone.visuals[0].distributed].sort(),['left','right']);assert.deepEqual(ozone.visuals[0].formalPositions.map(c=>c.role).sort(),['center','center','terminal','terminal']);",'ozone hybrid assertion');
replace("nitrobenzene.visuals[0].aromatic&&nitrobenzene.visuals[1].arc,'nitrobenzene must combine aromatic circle grammar and nitro three-center resonance grammar'","nitrobenzene.visuals[0].aromatic&&nitrobenzene.visuals[1].distributed.length===2&&!nitrobenzene.visuals[1].arc,'nitrobenzene must combine aromatic circle grammar and distributed nitro resonance grammar'",'nitrobenzene coexistence');
replace("['nitromethane','ozone','nitrobenzene','sulfur-dioxide','carbon-monoxide']","['nitromethane','ozone','nitrobenzene','2-4-6-trinitrotoluene','sulfur-dioxide','carbon-monoxide']",'asset request list');
const lines=source.split('\n').map(line=>{
  if(line.startsWith("  for(const id of ['nitromethane','ozone','nitrobenzene']){assert.match(assets"))return "  for(const [id,count] of [['nitromethane',2],['ozone',2],['nitrobenzene',2],['2-4-6-trinitrotoluene',6]]){assert.equal((assets[id].match(/data-resonance-distributed-bond=\\\"true\\\"/g)??[]).length,count,`${id}: generated normal structure needs two weak bond components per resonance group`);assert.doesNotMatch(assets[id],/data-resonance-three-center=\\\"true\\\"/,`${id}: legacy three-center arc must be absent`);assert.doesNotMatch(assets[id],/<text[^>]*>[+−]<\\/text>/,`${id}: resonance hybrid asset must not pin a formal charge to one contributor`);}";
  if(line.startsWith("  assert.doesNotMatch(assets['sulfur-dioxide'],/data-resonance-three-center"))return "  assert.doesNotMatch(assets['sulfur-dioxide'],/data-resonance-distributed-bond=\\\"true\\\"/,'sulfur oxo must not adopt nitro/ozone primitive');assert.match(assets['carbon-monoxide'],/<text[^>]*>[+−]<\\/text>/,'CO may retain its representative formal charges outside resonance-hybrid context');";
  if(line.includes("const reduced=await inspect('nitromethane');assert(reduced.visuals[0].arc"))return "  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});const reduced=await inspect('nitromethane');assert(reduced.visuals[0].distributed.length===2&&!reduced.visuals[0].arc&&reduced.visuals[0].arrow==='↔','reduced motion must preserve distributed resonance meaning without animation');";
  if(line.startsWith("console.log('Encyclopedia chemistry visual browser passed:"))return "console.log('Encyclopedia chemistry visual browser passed: mobile aromaticity, polarity, formal-charge and distributed resonance bond grammar; nitrobenzene coexistence; sulfur isolation; reduced-motion and Graph return.');";
  return line;
});
source=lines.join('\n');
if(source.includes("assert(nitro.visuals[0].arc)")||source.includes("assert(ozone.visuals[0].arc)"))throw new Error('Legacy detail arc assertion remained');
await writeFile(url,source);

const formalUrl=new URL('../tests/resonance-formal-charge.test.mjs',import.meta.url);
let formal=await readFile(formalUrl,'utf8');
const formalLines=formal.split('\n').map(line=>{
  if(line.includes('assert.match(svg,/data-resonance-three-center='))return "  const expectedComponents=2*(byId(id).resonanceGroups?.length??0);assert.equal((svg.match(/data-resonance-distributed-bond=\\\"true\\\"/g)??[]).length,expectedComponents,`${id}: Encyclopedia hybrid asset needs two distributed bond components per resonance group`);assert.doesNotMatch(svg,/data-resonance-three-center=\\\"true\\\"/,`${id}: legacy three-center resonance arc must be absent`);";
  return line;
});
formal=formalLines.join('\n');
if(formal.includes('Encyclopedia hybrid asset must use the three-center resonance grammar'))throw new Error('Legacy resonance asset assertion remained');
await writeFile(formalUrl,formal);
