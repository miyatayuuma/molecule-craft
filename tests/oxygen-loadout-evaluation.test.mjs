import assert from 'node:assert/strict';
import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {flightConfig} from '../src/veil/growth.js';
import {EXPEDITION} from '../src/veil/config.js';

// BURST interrupts held combustion; the already paid packet resumes intact.
for(const fps of [30,60]){
  const run=createRun({dust:[],fields:[],routes:[]},flightConfig(),{predators:false,fuel:{propellant:{molecule:'hydrogen',amount:120},fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36}}});
  let packets=0,bursts=0;
  const systems={consumeCombustion:()=>{packets++;return true;}};
  setCombustionHeld(run,true);stepRun(run,{x:0,y:-1},1/fps,systems);
  const buffer=run.driveBuffer;
  assert.ok(beginBurst(run,()=>{bursts++;return true;}));
  assert.equal(beginBurst(run,()=>{bursts++;return true;}),false);
  while(run.player.boost>0){stepRun(run,{x:0,y:-1},1/fps,systems);if(run.player.boost>0)assert.equal(run.driveBuffer,buffer);}
  assert.ok(buffer-run.driveBuffer<=1/fps+1e-8,'Only post-burst substeps may burn the packet');
  assert.equal(packets,1);assert.equal(bursts,1);
  stepRun(run,{x:0,y:-1},1/fps,systems);
  assert.ok(run.player.combustion);assert.ok(run.driveBuffer<buffer);assert.equal(packets,1);
}
// The harvest marker confers no invulnerability during the return lock.
const locking=createRun({dust:[],fields:[],routes:[]},flightConfig());
locking.telemetry.harvestReached=true;
locking.eaters.push({id:0,x:locking.player.x,y:locking.player.y,angle:0,speed:0,vx:0,vy:0,phase:0,flank:0,lead:0,trail:[]});
setCombustionHeld(locking,false);stepRun(locking,{x:0,y:0},1/60);
assert.equal(locking.captured,true);
const timeout=simulateOxygenRoute({maxSeconds:.1});
assert.equal(timeout.returnType,'timeout');assert.equal(timeout.netAtoms,null);assert.equal(timeout.returnedAtoms,null);assert.equal(timeout.reached,false);
const options={propellant:'hydrogen',drive:true,coolant:'water',policy:'continuous'};
const sixty=simulateOxygenRoute(options),thirty=simulateOxygenRoute({...options,fps:30});
for(const report of [sixty,thirty]){
  assert.ok(report.reached);assert.equal(report.returnType,'voluntary');
  assert.ok(report.burstUses>0&&report.combustionSeconds>0&&report.propulsionSwitches>0);
  assert.ok(report.returnLockSeconds>=EXPEDITION.anchorLockSeconds-1e-8);
  assert.ok(report.duration-report.arrivalSeconds>=.79);
  assert.ok(report.accountingConsistent);
  for(const el of ['H','C','O'])assert.equal(report.netByElement[el],report.returnedAtoms[el]-report.consumedAtoms[el]);
  const remainingH=Object.values(report.remainingTanks).filter(t=>t.molecule==='hydrogen').reduce((n,t)=>n+2*t.amount,0);
  assert.ok(remainingH>0,'Unused propellant remains stocked');
}
assert.ok(Math.abs(sixty.duration-thirty.duration)<1);
const interruptedLock=simulateOxygenRoute({...options,maxSeconds:sixty.arrivalSeconds+.4});
assert.ok(interruptedLock.harvestReached);assert.equal(interruptedLock.reached,false);
assert.equal(interruptedLock.returnType,'timeout');assert.equal(interruptedLock.returnedAtoms,null);

const captured=simulateOxygenRoute({propellant:'carbon-dioxide'});
assert.equal(captured.returnType,'forced');assert.equal(captured.reached,false);
assert.ok(Object.values(captured.loss).some(n=>n>0));
for(const el of ['H','C','O']){
  assert.equal(captured.returnedAtoms[el],Math.floor((captured.cargoDust[el]-captured.loss[el])/3));
  assert.equal(captured.netByElement[el],captured.returnedAtoms[el]-captured.consumedAtoms[el]);
}
console.log('Oxygen evaluation: accounting, timeout, capture loss, lock interval, mixed propulsion and paid buffer verified.');
