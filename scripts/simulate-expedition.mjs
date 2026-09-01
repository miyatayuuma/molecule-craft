import { createRun, stepRun, beginBurst, setCombustionHeld } from '../src/veil/engine.js';
import { createUniverse } from '../src/veil/universe.js';
import { EXPEDITION } from '../src/veil/config.js';
import { DRIVES, REGIONS, flightConfig, regionAt } from '../src/veil/growth.js';
import { createResources } from '../src/veil/resources.js';
import { completeExpeditionTelemetry } from '../src/veil/telemetry.js';
import { pathToFileURL } from 'node:url';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const total=values=>Object.values(values).reduce((sum,value)=>sum+value,0);

function pathFor(map,ids,start){
  const special={
    'carbon-loop':()=>{const main=map.routes.find(item=>item.id==='carbon-main')?.points??[],side=map.routes.find(item=>item.id==='carbon-sweep')?.points??[];let join=0;for(let i=1;i<main.length;i++)if(Math.hypot(main[i].x-230,main[i].y+6400)<Math.hypot(main[join].x-230,main[join].y+6400))join=i;return [...main.slice(0,join+1),...[...side].reverse()];},
    'oxygen-loop':()=>{const main=map.routes.find(item=>item.id==='oxygen-main')?.points??[],side=map.routes.find(item=>item.id==='oxygen-side')?.points??[];let join=0;for(let i=1;i<main.length;i++)if(Math.hypot(main[i].x-80,main[i].y+10670)<Math.hypot(main[join].x-80,main[join].y+10670))join=i;return [...main.slice(0,join+1),...[...side].reverse()];},
  };
  const points=ids.flatMap(spec=>{if(special[spec])return special[spec]();const reverse=spec.startsWith('!'),id=reverse?spec.slice(1):spec,route=map.routes.find(item=>item.id===id),items=route?.points??[];return reverse?[...items].reverse():items;});
  let index=0;for(let i=1;i<points.length;i++)if(Math.hypot(points[i].x-start.x,points[i].y-start.y)<Math.hypot(points[index].x-start.x,points[index].y-start.y))index=i;
  return {points,index};
}

export function simulate({name,start,routes,seconds,drive='off',burst='off',loop=false,seed=20260901}){
  const map=createUniverse(seed),fuel={hydrogen:EXPEDITION.hydrogenCapacity,methane:EXPEDITION.methaneCapacity,oxygen:EXPEDITION.oxygenCapacity},run=createRun(map,flightConfig(),{fuel});
  Object.assign(run.player,REGIONS[start],{vx:0,vy:0});run.region=start;const path=pathFor(map,routes,run.player),timeline=[],encounters=[];let nextSample=15;
  for(let frame=0;frame<seconds*60&&!run.captured;frame++){
    const p=run.player;
    while(path.index<path.points.length-1&&Math.hypot(path.points[path.index].x-p.x,path.points[path.index].y-p.y)<85)path.index++;
    if(path.index===path.points.length-1&&loop)path.index=0;
    const target=path.points[path.index]??{x:p.x,y:p.y-100},dx=target.x-p.x,dy=target.y-p.y,length=Math.hypot(dx,dy)||1;
    const driveOn=drive==='always'||drive==='danger'&&run.eaters.length>0;setCombustionHeld(run,driveOn);
    const burstNow=burst==='spam'||burst==='danger'&&run.nearestEater<EXPEDITION.eaterDangerRadius+35;
    if(burstNow&&p.cooldown<=0)beginBurst(run,()=>true);
    const events=stepRun(run,{x:dx/length,y:dy/length},1/60,{consumeCombustion:()=>true});
    for(const event of events)if(['eaterSpawn','danger','capture'].includes(event.type))encounters.push({seconds:+run.time.toFixed(1),type:event.type,level:event.level,x:Math.round(p.x),y:Math.round(p.y),distance:Number.isFinite(run.nearestEater)?Math.round(run.nearestEater):null});
    if(run.time+1e-6>=nextSample){timeline.push({seconds:nextSample,eaters:run.eaters.length,atoms:total(run.collectedElements),depth:Math.round(run.telemetry.maxDepth),H2:run.fuel.hydrogen,CH4:run.fuel.methane,O2:run.fuel.oxygen});nextSample+=15;}
  }
  const resources=createResources({storage:memory()}),settlement=resources.settleExpedition(run.elementDust,run.best,run.captured),report=completeExpeditionTelemetry(run,{captured:run.captured,result:settlement});
  const fuelAtoms=report.fuelUsed.hydrogen*2+report.fuelUsed.methane*5+report.fuelUsed.oxygen*2,gross=total(report.collected),minutes=Math.max(report.duration/60,1/60);
  return {name,...report,grossAtoms:gross,fuelAtomCost:fuelAtoms,netAtoms:gross-fuelAtoms,grossPerMinute:Math.round(gross/minutes),netPerMinute:Math.round((gross-fuelAtoms)/minutes),timeline,encounters};
}

export function density(seed=20260901){
  const map=createUniverse(seed),result=Object.fromEntries(['veil','carbon','oxygen','frontier'].map(id=>[id,{routeUnits:0,clusterUnits:0}]));
  for(const dust of map.dust){const region=regionAt(dust.y),key=dust.cluster===undefined?'routeUnits':'clusterUnits';result[region][key]+=dust.value;}
  return result;
}

export const SCENARIOS=[
  {name:'saving',start:'veil',routes:['entry','safe','detour','return'],seconds:30},
  {name:'normal',start:'carbon',routes:['carbon-loop'],seconds:55,burst:'danger',loop:true},
  {name:'deep',start:'oxygen',routes:['oxygen-loop'],seconds:35,drive:'always',loop:true},
  {name:'burst-spam',start:'veil',routes:['entry','risk','detour','return'],seconds:110,burst:'spam',loop:true},
  {name:'drive-always',start:'oxygen',routes:['oxygen-loop'],seconds:150,drive:'always',burst:'danger',loop:true},
  {name:'fuel-saving-overstay',start:'veil',routes:['entry','safe','detour','return'],seconds:150,loop:true},
];

export function runExpeditionSimulation(){return {parameters:{normalSpeed:flightConfig().speed,burst:DRIVES.hydrogen,combustion:DRIVES.combustion,expedition:EXPEDITION},density:density(),scenarios:SCENARIOS.map(simulate)};}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)console.log(JSON.stringify(runExpeditionSimulation(),null,2));
