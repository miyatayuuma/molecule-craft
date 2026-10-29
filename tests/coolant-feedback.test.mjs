import assert from 'node:assert/strict';
import {createRun,stepRun,setCombustionHeld} from '../src/veil/engine.js';
import {flightConfig} from '../src/veil/growth.js';

const emptyMap=()=>({seed:17,dust:[],fields:[],labels:[],routes:[]});
function burnWithWater(amount,seconds){
  const run=createRun(emptyMap(),flightConfig(),{fuel:{fuel:{molecule:'methane',amount:40},oxidizer:{molecule:'oxygen',amount:80},coolant:{molecule:'water',amount}},predators:false});
  const events=[];let coolantSpent=0;
  setCombustionHeld(run,true);
  for(let elapsed=0;elapsed<seconds;elapsed+=1/30){
    events.push(...stepRun(run,{x:0,y:-1},1/30,{consumeCombustion:()=>true,consumeCoolant:(count,molecule)=>{assert.equal(molecule,'water');coolantSpent+=count;return true;}}));
  }
  return {run,events,coolantSpent};
}

const cooling=burnWithWater(20,20);
assert.ok(cooling.events.some(event=>event.type==='coolantStart'&&event.molecule==='water'),'Automatic cooling start event remains reachable');
assert.ok(cooling.coolantSpent>0,'Automatic cooling still consumes coolant');
assert.equal(cooling.run.fuel.coolant.amount,20-cooling.coolantSpent,'HUD cleanup does not alter coolant amount bookkeeping');

const depleted=burnWithWater(1,14);
assert.equal(depleted.coolantSpent,1,'A one-unit coolant load is consumed exactly once');
assert.equal(depleted.run.fuel.coolant.amount,0,'Coolant depletion keeps the canonical zero amount');
assert.ok(depleted.events.some(event=>event.type==='coolantEmpty'),'Coolant depletion event remains reachable for momentary HUD feedback');

console.log('Coolant feedback runtime passed: automatic start, canonical consumption, and empty event remain unchanged.');
