import {readFile,writeFile,unlink} from 'node:fs/promises';

const sourcePath=new URL('./task-element-authority-n-foundation.mjs',import.meta.url);
let source=await readFile(sourcePath,'utf8');
source=source.replace("assert.equal(resources.canUseElement(symbol),false,`${symbol||'empty'} must not be gameplay-accessible`);","assert.equal(resources.canUseElement(symbol),false,(symbol||'empty')+' must not be gameplay-accessible');");
source=source.replace("assert.equal(collection.canUseElement(symbol),false,`${symbol} cannot unlock from discoveries`);","assert.equal(collection.canUseElement(symbol),false,symbol+' cannot unlock from discoveries');");
const target=new URL('./.task-element-authority-n-foundation-fixed.mjs',import.meta.url);
await writeFile(target,source);
try{await import(`${target.href}?run=${Date.now()}`);}finally{await unlink(target).catch(()=>{});}
