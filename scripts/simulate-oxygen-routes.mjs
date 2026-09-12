import {pathToFileURL} from 'node:url';
import {createRun,stepRun,beginBurst,setCombustionHeld} from '../src/veil/engine.js';
import {createUniverse,OXYGEN_ENTRY_KNOTS} from '../src/veil/universe.js';
import {CHO_DESTINATION} from '../src/veil/cho-campaign.js';
import {EXPEDITION} from '../src/veil/config.js';
import {flightConfig,REGIONS} from '../src/veil/growth.js';
import {OXYGEN_ROUTES,OXYGEN_JUNCTION,OXYGEN_REWARD,oxygenPressureAt} from '../src/veil/oxygen-routes.js';
import {createResources} from '../src/veil/resources.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {completeExpeditionTelemetry} from '../src/veil/telemetry.js';

const records=[{id:'hydrogen',atoms:['H','H']},{id:'carbon-dioxide',atoms:['C','O','O']},{id:'methane',atoms:['C','H','H','H','H']},{id:'oxygen',atoms:['O','O']},{id:'water',atoms:['O','H','H']}];
const elements=['H','C','O'];
const atomsFor=tanks=>Object.fromEntries(elements.map(el=>[el,Object.values(tanks).reduce((sum,t)=>sum+(records.find(r=>r.id===t.molecule)?.atoms.filter(a=>a===el).length??0)*t.amount,0)]));
const total=counts=>Object.values(counts).reduce((a,b)=>a+b,0);
export const POLICIES=['burst','continuous','economy'];
export function simulateOxygenRoute({routeId='oxygen-shortcut',propellant='hydrogen',drive=false,coolant=null,rest=false,policy=drive?'continuous':'burst',seed=1,fps=60,predators=true,maxSeconds=65,start='oxygen',detour=false,lateralOffset=0,burstTimes=null,timingOffset=0,harvestLayout,stock={}, destination='harvest'}={}){
  if(!['harvest','final'].includes(destination)||!POLICIES.includes(policy)||!OXYGEN_ROUTES.some(r=>r.id===routeId)||![30,60].includes(fps)||!['oxygen','junction'].includes(start)||!Number.isFinite(maxSeconds)||maxSeconds<=0)throw Error('Invalid simulation options');
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)},resources=createResources({storage});
  resources.setCatalog(records);resources.collect({H:2000,C:1000,O:2000});
  for(const [use,id]of [['propellant',propellant],['fuel',drive?'methane':null],['oxidizer',drive?'oxygen':null],['coolant',coolant]]){
    if(!id)continue;resources.discover(id);resources.fillTankFromElements(use,id,performanceFor(id,use).capacity);
  }
  const route=OXYGEN_ROUTES.find(r=>r.id===routeId),run=createRun(createUniverse(seed,stock,{harvestLayout}),flightConfig(),{fuel:resources.prepareExpedition(),predators});
  const initialTanks=structuredClone(resources.state.tanks),initialFillAtoms=atomsFor(initialTanks);
  Object.assign(run.player,start==='oxygen'?REGIONS.oxygen:OXYGEN_JUNCTION,{angle:REGIONS.oxygen.angle,vx:0,vy:0});run.region='oxygen';
  let knots=route.knots;
  if(detour){
    if(routeId!=='oxygen-shortcut')throw Error('Detour is only defined for the shortcut');
    // Leave the strong gate's width, cross the surrounding 370 current, rejoin.
    knots=[...route.knots.slice(0,2),[-300,-9020],[-470,-9120],[-470,-9390],[-300,-9530],...route.knots.slice(2)];
  }
  const entryPoints=start==='oxygen'?OXYGEN_ENTRY_KNOTS.slice(1).map(([x,y])=>({x,y})):[];
  const branchPoints=knots.slice(1).map(([x,y])=>({x:x+lateralOffset,y}));
  const harvestIndex=entryPoints.length+branchPoints.length;
  const points=[...entryPoints,...branchPoints,OXYGEN_REWARD,...(destination==='final'?[{x:250,y:-11200},{x:100,y:-11830},{x:0,y:-12200},CHO_DESTINATION]:[])];
  let index=0,resting=false,returning=0,arrivalSeconds=null,replayIndex=0,previousMode='coast',modeTransitions=0,propulsionSwitches=0,lastPropulsion=null;
  const actualBurstTimes=[];
  const tick=input=>{
    stepRun(run,input,1/fps,systems);
    const mode=run.player.boost>0?'burst':run.player.combustion?'combustion':'coast';
    if(mode!==previousMode)modeTransitions++;
    if(mode!=='coast'&&mode!==lastPropulsion){if(lastPropulsion)propulsionSwitches++;lastPropulsion=mode;}
    previousMode=mode;
    if(arrivalSeconds===null&&(destination==='final'?run.destinationReached:run.telemetry.harvestReached))arrivalSeconds=run.time;
  };
  const systems={consumeCombustion:packet=>resources.consumeCombustion(packet),consumeCoolant:(amount,molecule)=>resources.consumeTank('coolant',molecule,amount)};
  for(let frame=0;frame<maxSeconds*fps&&!run.captured;frame++){
    if(destination==='final'?run.destinationReached:run.telemetry.harvestReached){
      setCombustionHeld(run,false);tick({x:0,y:0});returning+=1/fps;if(returning+1e-8>=EXPEDITION.anchorLockSeconds)break;continue;
    }
    if(destination==='final'&&run.telemetry.harvestReached&&index<=harvestIndex)index=harvestIndex+1;
    const p=run.player,target=points[index],atRest=rest&&route.restStops?.some(stop=>target.y===stop.y)&&Math.hypot(p.x-target.x,p.y-target.y)<30;
    if(atRest&&run.heat>20)resting=true;
    if(run.heat<=20)resting=false;
    if(!resting&&index<points.length-1&&Math.hypot(p.x-target.x,p.y-target.y)<22)index++;
    const next=points[index],dx=next.x-p.x,dy=next.y-p.y,length=Math.hypot(dx,dy)||1;
    const pressure=oxygenPressureAt(p)??(destination==='final'&&p.y<-10850&&p.y>-11780?310:0);
    setCombustionHeld(run,drive&&!resting&&(policy==='continuous'||policy==='economy'&&pressure>0||policy==='burst'&&pressure>0&&(route.gates.length===0||detour)));
    const fire=()=>{if(beginBurst(run,(amount,id)=>resources.consumeTank('propellant',id,amount)))actualBurstTimes.push(run.time);};
    if(burstTimes){
      while(replayIndex<burstTimes.length&&run.time+1e-8>=Math.max(0,burstTimes[replayIndex]+timingOffset)){fire();replayIndex++;}
    }else if(!resting&&Math.abs(p.x-route.x)<route.width/2)for(const gate of route.gates){
      if(p.y>gate.y&&p.y<gate.y+gate.depth/2+30)fire();
    }
    tick({x:dx/length*(resting?.2:1),y:dy/length*(resting?.2:1)});
  }
  const reached=arrivalSeconds!==null&&returning+1e-8>=EXPEDITION.anchorLockSeconds&&!run.captured;
  const remainingTanks=structuredClone(resources.state.tanks),remainingAtoms=atomsFor(remainingTanks);
  const consumedAtoms=Object.fromEntries(elements.map(el=>[el,initialFillAtoms[el]-remainingAtoms[el]]));
  // A timeout is unreturned cargo, not an implicit voluntary settlement.
  const result=run.captured||reached?resources.settleExpedition(run.elementDust,run.best,run.captured,{destinationReached:run.destinationReached}):null;
  const report=completeExpeditionTelemetry(run,{captured:run.captured,result});
  const returnedAtoms=result?.atoms??null,netByElement=returnedAtoms&&Object.fromEntries(elements.map(el=>[el,returnedAtoms[el]-consumedAtoms[el]]));
  const accountingConsistent=Object.entries(report.loadout).every(([use,t])=>t.start-t.used===remainingTanks[use].amount&&run.fuel[use].amount===remainingTanks[use].amount);
  if(!accountingConsistent)throw Error('Tank / telemetry accounting mismatch');
  return {...report,returnType:run.captured?'forced':reached?'voluntary':'timeout',routeId,policy,seed,fps,detour,destination,stock,lateralOffset,timingOffset,
    grossAtoms:total(report.collected),fuelAtomCost:total(consumedAtoms),netAtoms:netByElement?total(netByElement):null,
    initialFillAtoms,consumedAtoms,returnedAtoms,netByElement,remainingTanks,remainingDust:result?{...resources.state.dust}:null,
    cargoDust:{...run.elementDust},arrivalSeconds,reached,returnLockSeconds:returning,actualBurstTimes,propulsionSwitches,modeTransitions,
    driveBuffer:run.driveBuffer,accountingConsistent,position:{x:Math.round(run.player.x),y:Math.round(run.player.y)}};
}
export const OXYGEN_SCENARIOS=[
  {routeId:'oxygen-shortcut',propellant:'hydrogen'},
  {routeId:'oxygen-side',propellant:'carbon-dioxide'},
  {routeId:'oxygen-main',propellant:null,drive:true,coolant:'water'},
  {routeId:'oxygen-main',propellant:null,drive:true},
  {routeId:'oxygen-main',propellant:null,drive:true,rest:true},
  {routeId:'oxygen-main',propellant:null,drive:true,coolant:'carbon-dioxide'},
];
export function evaluateOxygenLoadouts(){
  const seeds=[1,71,2026],baseline=[],controls=[],sensitivity=[],fpsChecks=[];
  for(const propellant of ['hydrogen','carbon-dioxide'])for(const route of OXYGEN_ROUTES)for(const policy of POLICIES)for(const seed of seeds){
    const options={propellant,drive:true,coolant:'water',rest:true,routeId:route.id,policy,seed};
    baseline.push({options,report:simulateOxygenRoute(options)});
  }
  for(const propellant of ['hydrogen','carbon-dioxide'])for(const policy of POLICIES)for(const seed of seeds){
    const options={propellant,drive:true,coolant:'water',rest:true,routeId:'oxygen-shortcut',policy,seed,detour:true};
    baseline.push({options,report:simulateOxygenRoute(options)});
  }
  for(const options of OXYGEN_SCENARIOS)for(const seed of seeds)controls.push({options:{...options,seed},report:simulateOxygenRoute({...options,seed})});
  for(const {options,report} of baseline){
    if(!report.reached)continue;
    for(const delta of [{timingOffset:-.15},{timingOffset:.15},{lateralOffset:-30},{lateralOffset:30}]){
      const changed={...options,...delta,...('timingOffset'in delta?{burstTimes:report.actualBurstTimes}:{})};
      sensitivity.push({options:changed,report:simulateOxygenRoute(changed)});
    }
    if(options.seed===1)fpsChecks.push({options:{...options,fps:30},report:simulateOxygenRoute({...options,fps:30})});
  }
  return {seeds,baseline,controls,sensitivity,fpsChecks};
}
export function compareOxygenLayouts(){
  const variants={original:{sideSpacing:27,eddyAtoms:0},spread:{sideSpacing:90,eddyAtoms:0},eddy:{sideSpacing:27,eddyAtoms:180},combined:{sideSpacing:90,eddyAtoms:180}};
  return Object.entries(variants).flatMap(([variant,harvestLayout])=>['hydrogen','carbon-dioxide'].flatMap(propellant=>['oxygen-side','oxygen-main'].map(routeId=>{
    const options={propellant,routeId,harvestLayout,drive:true,coolant:'water',rest:true,policy:'continuous',seed:1};return {variant,options,report:simulateOxygenRoute(options)};
  })));
}
export function evaluateChoDestinations(){
  const rows=[],cases=[{propellant:'hydrogen',routeId:'oxygen-shortcut'},{propellant:'carbon-dioxide',routeId:'oxygen-side'},...['hydrogen','carbon-dioxide'].map(propellant=>({propellant,routeId:'oxygen-main'}))];
  for(const entry of cases)for(const seed of [1,71,2026])for(const fps of [30,60]){
    const options={...entry,seed,fps,drive:true,coolant:'water',rest:true,policy:'continuous',destination:'final'};
    const report=simulateOxygenRoute(options);rows.push({options,report});
    if(report.reached&&seed===1&&fps===60)for(const delta of [{timingOffset:-.15},{timingOffset:.15},{lateralOffset:-30},{lateralOffset:30}]){
      const shifted={...options,...delta,...('timingOffset'in delta?{burstTimes:report.actualBurstTimes}:{})};rows.push({options:shifted,report:simulateOxygenRoute(shifted)});
    }
  }
  return rows;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const arg=process.argv[2],commands={'--matrix':evaluateOxygenLoadouts,'--final-matrix':evaluateChoDestinations,'--compare-layouts':compareOxygenLayouts,'--controls':()=>OXYGEN_SCENARIOS.map(simulateOxygenRoute),'--case':()=>simulateOxygenRoute(JSON.parse(process.argv[3]))};
  if(arg&&!commands[arg])throw Error('Use --matrix, --final-matrix, --compare-layouts, --controls, or --case JSON');
  console.log(JSON.stringify((commands[arg]??commands['--controls'])(),null,2));
}
