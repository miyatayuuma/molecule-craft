import {readFile,writeFile} from 'node:fs/promises';
const url=new URL('../tests/supply-tanks.test.mjs',import.meta.url);
let source=await readFile(url,'utf8');
const old="assert.equal(migrated.selectedLoadout().propellant,'hydrogen');assert.deepEqual(migrated.state.tanks.propellant,{molecule:'hydrogen',amount:4});assert.equal(migrated.state.elements.H,10);";
const replacement="assert.equal(migrated.selectedLoadout().propellant,null);assert.deepEqual(migrated.state.tanks.propellant,{molecule:null,amount:0});assert.equal(migrated.state.elements.H,0);";
if(!source.includes(old))throw new Error('Stale schema-7 save assertion not found');
source=source.replace(old,replacement).replace('impossible guard, and legacy initialization.','impossible guard, and stale-save reset.');
await writeFile(url,source);
