import {pathToFileURL} from 'node:url';
import {createFlight,moveFlight} from '../src/veil/engine.js';
import {DRIVES,GROWTH,MOLECULE_USES,flightConfig} from '../src/veil/growth.js';
import {createMap} from '../src/veil/map.js';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {createResources} from '../src/veil/resources.js';
import {OXYGEN_ROUTES} from '../src/veil/oxygen-routes.js';
import {simulate} from './simulate-expedition.mjs';
import {simulateOxygenRoute} from './simulate-oxygen-routes.mjs';

const ELEMENTS=['H','C','O'];
const SEED=20260914;
const sum=values=>Object.values(values).reduce((total,value)=>total+(value??0),0);
const round=value=>Number.isFinite(value)?Math.round(value*100)/100:value;
const routeBy=(map,id)=>map.routes.find(route=>route.id===id);

function fuelElementCost(fuelUsed={}){
  return Object.fromEntries(ELEMENTS.map(element=>[
    element,
    Object.entries(fuelUsed).reduce((total,[id,count])=>total+(MOLECULE_USES[id]?.atoms?.filter(atom=>atom===element).length??0)*count,0),
  ]));
}
function netFromTelemetry(report){
  const cost=fuelElementCost(report.fuelUsed);
  return {cost,net:Object.fromEntries(ELEMENTS.map(element=>[element,(report.collected?.[element]??0)-cost[element]]))};
}
function expeditionMetric(report){
  const {cost,net}=netFromTelemetry(report);
  return {
    duration:report.duration,returnType:report.returnType,collected:report.collected,cost,net,
    burstUses:report.burstUses,combustionSeconds:report.combustionSeconds,maxHeat:report.maxHeat,
    overheatEvents:report.overheatEvents,maxEaters:report.maxEaters,minEaterDistance:report.minEaterDistance,
    dangerContacts:report.dangerContacts,loss:report.loss,
  };
}
function oxygenMetric(report){
  return {
    reached:report.reached,arrivalSeconds:round(report.arrivalSeconds),returnType:report.returnType,
    collected:report.collected,cost:report.consumedAtoms,net:report.netByElement,
    burstUses:report.burstUses,combustionSeconds:report.combustionSeconds,maxHeat:report.maxHeat,
    overheatEvents:report.overheatEvents,coolantUsed:report.loadout?.coolant?.used??0,
    maxEaters:report.maxEaters,minEaterDistance:report.minEaterDistance,dangerContacts:report.dangerContacts,
    destinationReached:report.destinationReached,choCompleted:report.choCompleted,
    routesVisited:report.routesVisited,currentCrossings:report.currentCrossings,
  };
}
function traverseRevisit(map,id,{drive=false,maxSeconds=45}={}){
  const route=routeBy(map,id);if(!route)return Infinity;
  const config=flightConfig(),player=createFlight(config),dt=1/60,points=route.points;
  Object.assign(player,{x:points[0].x,y:points[0].y,angle:points[0].angle,vx:0,vy:0,speed:config.driftSpeed});
  let index=1;
  for(let frame=0;frame<maxSeconds/dt;frame++){
    const target=points[Math.min(index,points.length-1)],dx=target.x-player.x,dy=target.y-player.y,distance=Math.hypot(dx,dy);
    if(distance<24){if(index===points.length-1)return frame*dt;index=Math.min(points.length-1,index+3);continue;}
    player.drive=drive?DRIVES.combustion:null;player.combustion=drive;
    moveFlight(player,{x:dx/distance,y:dy/distance},dt,{config,environment:environmentAt(player,frame*dt,map)});
  }
  return Infinity;
}
function elementFieldAtoms(map,element){
  const units=map.dust.filter(dust=>(dust.element??'H')===element).reduce((total,dust)=>total+dust.value,0);
  return round(units/(GROWTH.dustPerAtom[element]??3));
}
function pocketAtoms(map,id,element){
  const units=map.dust.filter(dust=>dust.route===id&&(dust.element??'H')===element).reduce((total,dust)=>total+dust.value,0);
  return round(units/(GROWTH.dustPerAtom[element]??3));
}
function stockEconomy(){
  const capabilities={combustionDrive:true};
  return [
    {name:'low',H:0,O:0},
    {name:'mid',H:540,O:250},
    {name:'high',H:700,O:320},
  ].map(stock=>{
    const map=createUniverse(SEED,{H:stock.H,C:0,O:stock.O},{capabilities});
    return {...stock,aggregate:{H:elementFieldAtoms(map,'H'),C:elementFieldAtoms(map,'C'),O:elementFieldAtoms(map,'O')},pockets:{
      hydrogenRevisit:pocketAtoms(map,'hydrogen-revisit-pocket','H'),
      carbonRevisit:pocketAtoms(map,'carbon-revisit-pocket','C'),
      recovery:pocketAtoms(map,'oxygen-rest-harvest','O'),
      merge:pocketAtoms(map,'oxygen-harvest','O'),
    }};
  });
}
function progressionInsights(){
  const fresh=createResources({storage:null});fresh.collect({H:160});
  const methane=createResources({storage:null});methane.discover('hydrogen');methane.collect({H:16,C:4});
  const oxygen=createResources({storage:null});oxygen.discover('hydrogen');oxygen.discover('methane');oxygen.collect({O:16});
  const water=createResources({storage:null});water.discover('hydrogen');water.discover('methane');water.discover('oxygen');water.recordCoolantNeedExperience();water.collect({H:16,O:8});
  return {
    hydrogen:fresh.progressionInsightCandidates().includes('hydrogen'),
    methane:methane.progressionInsightCandidates().includes('methane'),
    oxygen:oxygen.progressionInsightCandidates().includes('oxygen'),
    water:water.progressionInsightCandidates().includes('water'),
  };
}

export function runChoFieldPolishSimulation({seed=SEED}={}){
  const freshHydrogen=simulate({name:'fresh-hydrogen',start:'veil',routes:['entry','safe','detour','return'],seconds:30,seed});
  const freshCarbon=simulate({name:'fresh-carbon',start:'carbon',routes:['carbon-loop'],seconds:55,burst:'danger',loop:true,seed});
  const overstay=simulate({name:'overstay',start:'veil',routes:['entry','safe','detour','return'],seconds:180,loop:true,seed});

  const capabilities={combustionDrive:true},hMap=createMap(seed,{H:0,C:0,O:0},{capabilities}),postDrive=createUniverse(seed,{H:0,C:0,O:0},{capabilities});
  const revisit={
    hydrogen:{normal:traverseRevisit(hMap,'hydrogen-revisit'),drive:traverseRevisit(hMap,'hydrogen-revisit',{drive:true})},
    carbon:{normal:traverseRevisit(postDrive,'carbon-revisit'),drive:traverseRevisit(postDrive,'carbon-revisit',{drive:true})},
  };
  for(const value of Object.values(revisit)){value.normal=round(value.normal);value.drive=round(value.drive);value.driveRatio=round(value.drive/value.normal);}

  const routeBase={seed,predators:false,start:'junction',maxSeconds:50};
  const shortcutBurst=simulateOxygenRoute({...routeBase,routeId:'oxygen-shortcut',propellant:'hydrogen',drive:false});
  const shortcutNormal=simulateOxygenRoute({...routeBase,routeId:'oxygen-shortcut',propellant:null,drive:false,detour:true});
  const mainNormal=simulateOxygenRoute({...routeBase,routeId:'oxygen-main',propellant:null,drive:false});
  const mainDrive=simulateOxygenRoute({...routeBase,routeId:'oxygen-main',propellant:null,drive:true,policy:'continuous'});
  const sideNormal=simulateOxygenRoute({...routeBase,routeId:'oxygen-side',propellant:null,drive:false});
  const sideDry=simulateOxygenRoute({...routeBase,routeId:'oxygen-side',propellant:null,drive:true,policy:'continuous'});
  const sideWet=simulateOxygenRoute({...routeBase,routeId:'oxygen-side',propellant:null,drive:true,coolant:'water',policy:'continuous'});
  const finalTraversal=simulateOxygenRoute({seed,predators:false,routeId:'oxygen-main',propellant:null,drive:true,coolant:'water',rest:true,policy:'continuous',destination:'final',maxSeconds:75});

  const routes=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,{lanes:route.lanes,value:route.value,pressure:route.pressure,gates:route.gates.length}]));
  return {
    seed,
    progression:progressionInsights(),
    fresh:{hydrogen:expeditionMetric(freshHydrogen),carbon:expeditionMetric(freshCarbon)},
    revisit,
    stock:stockEconomy(),
    oxygen:{
      profiles:routes,
      shortcut:{normal:oxygenMetric(shortcutNormal),burst:oxygenMetric(shortcutBurst)},
      main:{normal:oxygenMetric(mainNormal),drive:oxygenMetric(mainDrive)},
      side:{normal:oxygenMetric(sideNormal),dryDrive:oxygenMetric(sideDry),cooledDrive:oxygenMetric(sideWet)},
    },
    deepToCho:oxygenMetric(finalTraversal),
    threat:{overstay:expeditionMetric(overstay),captured:overstay.returnType==='forced'},
  };
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runChoFieldPolishSimulation(),null,2));
