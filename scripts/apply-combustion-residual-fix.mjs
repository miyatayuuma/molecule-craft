import {readFile,writeFile} from 'node:fs/promises';

async function replaceOnce(path,before,after){
  const source=await readFile(path,'utf8');const count=source.split(before).length-1;if(count!==1)throw new Error(`${path}: expected one match, found ${count}`);await writeFile(path,source.replace(before,after));
}
async function replaceFunction(path,startMarker,endMarker,replacement){
  const source=await readFile(path,'utf8'),start=source.indexOf(startMarker),end=source.indexOf(endMarker,start);if(start<0||end<0)throw new Error(`${path}: function markers not found`);await writeFile(path,source.slice(0,start)+replacement+source.slice(end));
}

await replaceOnce('src/veil/engine.js',"import { combustionPacketFor,performanceFor } from './molecule-roles.js';","import { combustionChargeFor,performanceFor } from './molecule-roles.js';");
await replaceFunction('src/veil/engine.js','function updateCombustion(run,dt,systems){','function updateThermal(run,dt,systems){',`function availableCombustionCharge(run){
  const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer;if(oxidizer.molecule!=='oxygen')return null;
  return combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds});
}

function updateCombustion(run,dt,systems){
  const p=run.player;
  if(!run.driveHeld||p.boost>0||run.captured||run.overheated){p.combustion=false;return;}
  const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer;
  if(run.driveBuffer<=1e-8){
    const charge=availableCombustionCharge(run);
    if(!charge||!systems.consumeCombustion?.(charge)){p.combustion=false;if(!run.driveEmpty){run.driveEmpty=true;run.events.push({type:'driveEmpty'});}return;}
    fuel.amount-=charge.fuelAmount;oxidizer.amount-=charge.oxygenAmount;recordFuelUse(run.telemetry,'fuel',fuel.molecule,charge.fuelAmount);recordFuelUse(run.telemetry,'oxidizer',oxidizer.molecule,charge.oxygenAmount);run.driveBuffer=charge.seconds;run.driveEmpty=false;run.events.push({type:'driveIgnition'});
  }
  p.drive=combustionDriveFor(fuel.molecule)??DRIVES.combustion;p.combustion=true;run.driveBuffer=Math.max(0,run.driveBuffer-dt);
  if(run.driveBuffer<=0&&!availableCombustionCharge(run))p.combustion=false;
}

`);

await replaceOnce('src/veil/resources.js',"import { combustionPacketFor,performanceFor } from './molecule-roles.js';","import { combustionChargeFor,performanceFor } from './molecule-roles.js';");
await replaceOnce('src/veil/resources.js',"consumeCombustion(){const fuel=state.tanks.fuel,oxidizer=state.tanks.oxidizer,p=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});if(blocked||!state.recipes.includes(fuel.molecule)||!state.recipes.includes(oxidizer.molecule)||!p||fuel.molecule!==p.fuel||oxidizer.molecule!==p.oxidizer||fuel.amount<p.fuelAmount||oxidizer.amount<p.oxygenAmount)return false;const snapshot=copy(state);fuel.amount-=p.fuelAmount;oxidizer.amount-=p.oxygenAmount;if(save()||!storage)return true;state=snapshot;return false;},","consumeCombustion(requested=null){const fuel=state.tanks.fuel,oxidizer=state.tanks.oxidizer,charge=oxidizer.molecule==='oxygen'?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null,matches=!requested||!!charge&&requested.fuel===charge.fuel&&requested.fuelAmount===charge.fuelAmount&&requested.oxidizer===charge.oxidizer&&requested.oxygenAmount===charge.oxygenAmount;if(blocked||!state.recipes.includes(fuel.molecule)||!state.recipes.includes(oxidizer.molecule)||!charge||!matches)return false;const snapshot=copy(state);fuel.amount-=charge.fuelAmount;oxidizer.amount-=charge.oxygenAmount;if(save()||!storage)return true;state=snapshot;return false;},");

await replaceOnce('src/veil/ui.js',"import { combustionPacketFor,performanceFor } from './molecule-roles.js';","import { combustionChargeFor,combustionPacketFor,performanceFor } from './molecule-roles.js';");
await replaceOnce('src/veil/ui.js',"if(!active||paused||anchorLock||returnState||run.captured)return;const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds});\n    if((!packet||oxidizer.molecule!=='oxygen'||fuel.amount<packet.fuelAmount||oxidizer.amount<packet.oxygenAmount)&&run.driveBuffer<=0){notice('搭載した燃料またはO₂が空だ · 帰還して再出発しよう',2);return;}","if(!active||paused||anchorLock||returnState||run.captured)return;const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,charge=oxidizer.molecule==='oxygen'?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null;\n    if(!charge&&run.driveBuffer<=0){notice('燃焼に必要な燃料またはO₂が不足 · 帰還して再出発しよう',2);return;}");
await replaceOnce('src/veil/ui.js',"const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds}),combustion=!!packet&&oxidizer.molecule==='oxygen',canBurn=combustion&&fuel.amount>=packet.fuelAmount&&oxidizer.amount>=packet.oxygenAmount,combustionGauge=propulsionGauge('combustion',run.fuel,run.driveBuffer);","const fuel=run.fuel.fuel,oxidizer=run.fuel.oxidizer,packet=combustionPacketFor(fuel.molecule,{baseSeconds:DRIVES.combustion.packetSeconds}),combustion=!!packet&&oxidizer.molecule==='oxygen',charge=combustion?combustionChargeFor(fuel.molecule,{fuelAmount:fuel.amount,oxygenAmount:oxidizer.amount,baseSeconds:DRIVES.combustion.packetSeconds}):null,canBurn=!!charge,combustionGauge=propulsionGauge('combustion',run.fuel,run.driveBuffer);");
await replaceOnce('src/veil/ui.js',"notice('COMBUSTION DRIVEの搭載分が空になった',2);","notice('COMBUSTION DRIVEの燃焼可能分を使い切った',2);");

await replaceOnce('src/veil/growth.js',"import { activeTankRolesFor,combustionPacketFor,performanceFor,tankCapacityFor } from './molecule-roles.js';","import { activeTankRolesFor,combustionBurnPlanFor,combustionPacketFor,performanceFor,tankCapacityFor } from './molecule-roles.js';");
await replaceFunction('src/veil/growth.js','export function combustionPackets(loadout={}){','export function burstDriveFor(id){',`function combustionPlan(loadout={}){
  const fuel=slot(loadout,'fuel','methane'),oxidizer=slot(loadout,'oxidizer','oxygen');if(!performanceFor(fuel.molecule,'fuel')||oxidizer.molecule!=='oxygen')return null;
  return combustionBurnPlanFor(fuel.molecule,{fuelAmount:finiteFuel(fuel.amount),oxygenAmount:finiteFuel(oxidizer.amount),baseSeconds:DRIVES.combustion.packetSeconds});
}
export function combustionPackets(loadout={}){return combustionPlan(loadout)?.fuelUsed??0;}
`);
await replaceFunction('src/veil/growth.js','export function propulsionGauge(id,loadout={},driveBuffer=0){','export function growthGoal(state,{cargo={},nitrogenRegionAvailable=NITROGEN_REGION_AVAILABLE}={}){',`export function propulsionGauge(id,loadout={},driveBuffer=0){
  let remaining=0,capacity=0,seconds=0,maxSeconds=0;
  if(id==='hydrogen'){
    const propellant=slot(loadout,'propellant','hydrogen'),performance=performanceFor(propellant.molecule,'propellant');
    capacity=performance?Math.floor(performance.capacity/performance.moleculesPerBurst):0;remaining=performance?Math.min(capacity,Math.floor(finiteFuel(propellant.amount)/performance.moleculesPerBurst)):0;
  }else if(id==='combustion'){
    const fuel=slot(loadout,'fuel','methane'),oxidizer=slot(loadout,'oxidizer','oxygen'),performance=performanceFor(fuel.molecule,'fuel'),full={fuel:{molecule:fuel.molecule,amount:tankCapacity('fuel',fuel.molecule)??0},oxidizer:{molecule:oxidizer.molecule,amount:oxidizer.capacity??tankCapacity('oxidizer',oxidizer.molecule)??0}},fullPlan=combustionPlan(full),plan=combustionPlan(loadout);
    capacity=fullPlan?.fuelUsed??0;maxSeconds=fullPlan?.seconds??0;seconds=Math.min(maxSeconds,(plan?.seconds??0)+finiteFuel(driveBuffer));const secondsPerFuel=performance?DRIVES.combustion.packetSeconds*performance.energy:0;remaining=Math.min(capacity,secondsPerFuel?Math.ceil(Math.max(0,seconds-1e-10)/secondsPerFuel):0);
  }
  const ratio=capacity?Math.max(0,Math.min(1,id==='combustion'?seconds/maxSeconds:remaining/capacity)):0;
  return {remaining,capacity,seconds,ratio,state:ratio<=0?'empty':ratio<=.34?'low':'enough'};
}
`);

await replaceOnce('tests/generic-propulsion.test.mjs',"assert.equal(propulsionGauge('combustion',{fuel:{molecule:'n-butane',amount:2},oxidizer:{molecule:'oxygen',amount:13}}).ratio,.5);","assert.equal(propulsionGauge('combustion',{fuel:{molecule:'n-butane',amount:2},oxidizer:{molecule:'oxygen',amount:13}}).ratio,.4);");
await replaceOnce('.github/workflows/repository-validation.yml',"          node tests/generic-propulsion.test.mjs\n          node tests/coolant-feedback.test.mjs","          node tests/generic-propulsion.test.mjs\n          node --test tests/combustion-residual-consumption.test.mjs\n          node tests/combustion-residual-browser.test.mjs\n          node tests/coolant-feedback.test.mjs");

console.log('Applied combustion residual consumption fix.');
