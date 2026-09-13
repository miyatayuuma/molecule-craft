import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../tests/loadout-schematic.test.mjs',import.meta.url);
let source=await readFile(url,'utf8');
for(const [old,replacement] of [
  ["  assert.match(source,/node.dataset?.sufficient!==undefined/);","  assert.ok(source.includes('node.dataset?.sufficient!==undefined'));"],
  ["  assert.match(source,/chip.dataset.stockState=chip.dataset.sufficient==='false'?'short':'ready'/);","  assert.ok(source.includes(\"chip.dataset.stockState=chip.dataset.sufficient==='false'?'short':'ready'\"));"],
  ["  assert.match(source,/preview.setAttribute('aria-label','必要元素')/);","  assert.ok(source.includes(\"preview.setAttribute('aria-label','必要元素')\"));"],
]){
  if(!source.includes(old))throw new Error('Generated schematic assertion target not found: '+old);
  source=source.replace(old,replacement);
}
await writeFile(url,source);
