import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const sourcePath=new URL('./task-element-authority-n-foundation.mjs',import.meta.url);
let source=await readFile(sourcePath,'utf8');
source=source.replace("assert.equal(resources.canUseElement(symbol),false,`${symbol||'empty'} must not be gameplay-accessible`);","assert.equal(resources.canUseElement(symbol),false,(symbol||'empty')+' must not be gameplay-accessible');");
source=source.replace("assert.equal(collection.canUseElement(symbol),false,`${symbol} cannot unlock from discoveries`);","assert.equal(collection.canUseElement(symbol),false,symbol+' cannot unlock from discoveries');");
const target=resolve('/tmp/task-element-authority-n-foundation-fixed.mjs');
await writeFile(target,source);
await import(pathToFileURL(target));
