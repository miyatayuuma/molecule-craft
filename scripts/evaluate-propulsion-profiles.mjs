import {pathToFileURL} from 'node:url';
import {createRun,stepRun,setCombustionHeld,beginBurst} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {flightConfig,REGIONS} from '../src/veil/growth.js';
import {performanceFor} from '../src/veil/molecule-roles.js';
import {challengeCenter,EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
export function evaluateProfile({fuel='methane',coolant='water',capacity=36,fps=60,early=true,goalY=-11640}={}){
 const load=Object.fromEntries([['propellant','hydrogen'],['fuel',fuel],['oxidizer','oxygen'],['coolant',coolant]].map(([role,id])=>[role,{molecule:id,amount:role==='oxidizer'?capacity:performanceFor(id,role).capacity,capacity:role==='oxidizer'?capacity:performanceFor(id,role).capacity}]));
 const run=createRun(createUniverse(71),flightConfig(),{fuel:load});Object.assign(run.player,REGIONS.oxygen,{vx:0,vy:0});run.region='oxygen';
 const systems={consumeCombustion:()=>true,consumeCoolant:()=>true},rewards=[];let rest=false,lock=0,arrived=false;
 while(run.time<65&&!run.captured){
  rest=rest?run.heat>35:run.heat>75;
  setCombustionHeld(run,!rest&&(early||run.player.y<-8330));
  if(run.danger==='danger'&&run.player.cooldown<=0)beginBurst(run,()=>true);
  const y=run.player.y-160,z=EXPEDITION_CHALLENGES.find(z=>y<z.bottom&&y>z.top),x=z?challengeCenter(z,y):120,dx=x-run.player.x,dy=-160,d=Math.hypot(dx,dy);
  if(run.player.y<goalY)arrived=true;
  if(arrived){setCombustionHeld(run,false);lock+=1/fps;}
  for(const e of stepRun(run,arrived?{x:0,y:0}:{x:dx/d,y:dy/d},1/fps,systems))if(e.type==='inspiration')rewards.push(...e.rewards);
  if(lock>=.8)break;
 }
 return {fuel,coolant,capacity,fps,early,goalY,returned:arrived&&lock>=.8&&!run.captured,time:+run.time.toFixed(2),y:Math.round(run.player.y),heat:+run.heat.toFixed(1),overheats:run.telemetry.overheatEvents,combustionSeconds:+run.telemetry.combustionSeconds.toFixed(2),remaining:run.fuel,rewards};
}
export function responseProbe(fuel,{burst=false}={}){
 const run=createRun({dust:[],fields:[],routes:[],labels:[]},flightConfig(),{predators:false,fuel:{fuel:{molecule:fuel,amount:100},oxidizer:{molecule:'oxygen',amount:100},propellant:{molecule:'hydrogen',amount:120}}});
 let at400=0,at200=0,t90=null;setCombustionHeld(run,!burst);if(burst)beginBurst(run,()=>true);
 for(let i=0;i<120;i++){stepRun(run,{x:0,y:-1},1/60,{consumeCombustion:()=>true});if(i===11)at200=run.player.speed;if(i===23)at400=run.player.speed;if(t90===null&&run.player.speed>=423)t90=run.time;}
 const buffer=run.driveBuffer;setCombustionHeld(run,false);stepRun(run,{x:0,y:-1},1/60,{consumeCombustion:()=>true});
 return {fuel,burst,speed200:+at200.toFixed(1),speed400:+at400.toFixed(1),t90:+t90?.toFixed(3),released:!run.player.combustion,bufferHeld:run.driveBuffer===buffer};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const fuels=['hydrogen','methane','ethyne','dimethyl-ether','propane','n-hexane'];console.log(JSON.stringify({response:[...fuels.map(f=>responseProbe(f)),responseProbe('hydrogen',{burst:true})],routes:fuels.flatMap(fuel=>[36,48,72].map(capacity=>evaluateProfile({fuel,capacity})))},null,2));}
