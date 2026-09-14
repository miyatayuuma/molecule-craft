import {readFile,writeFile,unlink} from 'node:fs/promises';

const sourcePath=new URL('./task-element-authority-n-foundation.mjs',import.meta.url);
let source=await readFile(sourcePath,'utf8');
source=source.replace("assert.equal(resources.canUseElement(symbol),false,`${symbol||'empty'} must not be gameplay-accessible`);","assert.equal(resources.canUseElement(symbol),false,(symbol||'empty')+' must not be gameplay-accessible');");
source=source.replace("assert.equal(collection.canUseElement(symbol),false,`${symbol} cannot unlock from discoveries`);","assert.equal(collection.canUseElement(symbol),false,symbol+' cannot unlock from discoveries');");
const target=new URL('./.task-element-authority-n-foundation-fixed.mjs',import.meta.url);
await writeFile(target,source);
try{await import(`${target.href}?run=${Date.now()}`);}finally{await unlink(target).catch(()=>{});}

const persistenceURL=new URL('../src/veil/resources-persistence.js',import.meta.url);
let persistence=await readFile(persistenceURL,'utf8');
const oldBalance="for(const el of MANAGED)if(!integer(s.elements[el])||!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');";
const newBalance="for(const el of MANAGED)if(!integer(s.elements[el]))throw Error('Invalid atom balance');for(const el of DUST)if(!integer(s.dust[el])||s.dust[el]>=GROWTH.dustPerAtom[el])throw Error('Invalid atom balance');";
persistence=persistence.replaceAll(oldBalance,newBalance);
await writeFile(persistenceURL,persistence);
