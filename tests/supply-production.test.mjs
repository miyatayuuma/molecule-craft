import assert from 'node:assert/strict';
import {createResources} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();let reject=false;return {getItem:key=>data.get(key)??null,setItem:(key,value)=>{if(reject)throw Error('quota');data.set(key,value);},removeItem:key=>data.delete(key),reject(value=true){reject=value;}};};

const storage=memory(),resources=createResources({storage});resources.collect({H:41,C:10,O:8},0);resources.discover('methane');resources.discover('oxygen');resources.save();
assert.equal(resources.maxCraftable('methane'),10,'Preview uses the limiting element');
assert.deepEqual(resources.costFor('methane',7),{C:7,H:28});assert.equal(resources.tankFillPlan('fuel','methane').maxAdd,10);
const before={...resources.state.elements},filled=resources.fillTankFromElements('fuel','methane',7);assert.equal(filled.added,7);
assert.equal(resources.state.elements.C,before.C-7);assert.equal(resources.state.elements.H,before.H-28);assert.deepEqual(resources.state.tanks.fuel,{molecule:'methane',amount:7});assert.equal(resources.tankFillPlan('fuel','methane').maxAdd,3);
const insufficient=resources.snapshot();assert.equal(resources.fillTankFromElements('fuel','methane',4),false);assert.deepEqual(resources.snapshot(),insufficient,'An unaffordable batch is a no-op');
assert.equal(resources.fillTankFromElements('oxidizer','oxygen',4).added,4);assert.equal(resources.state.elements.O,0);assert.deepEqual(resources.state.tanks.oxidizer,{molecule:'oxygen',amount:4});

resources.state.elements.C=1;resources.state.elements.H=4;resources.save();const failed=resources.snapshot();storage.reject();assert.equal(resources.fillTankFromElements('fuel','methane',1),false);assert.deepEqual(resources.snapshot(),failed,'A failed durable save rolls the whole batch back');
console.log('Direct tank production passed: preview cost, limiting stock, exact batches, and atomic save rollback.');
