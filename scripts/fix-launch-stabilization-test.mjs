import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../tests/loadout-schematic.test.mjs',import.meta.url);
let source=await readFile(url,'utf8');
const old="  assert.match(source,/node.dataset?.sufficient!==undefined/);";
if(!source.includes(old))throw new Error('Generated schematic assertion target not found');
source=source.replace(old,"  assert.ok(source.includes('node.dataset?.sufficient!==undefined'));" );
await writeFile(url,source);
