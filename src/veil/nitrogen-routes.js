import {createRoute,smoothCurve,straight} from './route-kit.js';
import {inventoryDepletion,keepDepletedSegment,random} from './map.js';
import {NITROGEN_ENTRY} from './nitrogen-config.js';
import {defineHazard,deterministicNoise1D,effectiveHazardScale,hazardSample,HAZARD_TYPES} from './hazards.js';

const freeze=value=>Object.freeze(value);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t);};
export const NITROGEN_WORLD_SEED=0x4e325632;

export const NITROGEN_ROUTE=createRoute({
  id:'nitrogen-main',entry:NITROGEN_ENTRY,width:820,spacing:30,
  segments:[
    straight({length:720}),smoothCurve({length:760,turn:.42}),straight({length:760}),smoothCurve({length:900,turn:-.68}),
    straight({length:720}),smoothCurve({length:860,turn:.58}),straight({length:860}),smoothCurve({length:820,turn:-.52}),
    straight({length:900}),smoothCurve({length:760,turn:.36}),straight({length:980}),
  ],
});
const pointAt=progress=>NITROGEN_ROUTE.points[Math.max(0,Math.min(NITROGEN_ROUTE.points.length-1,Math.round(progress*(NITROGEN_ROUTE.points.length-1))))];
const offsetAt=(progress,offset=0)=>{const p=pointAt(progress);return {x:p.x-Math.sin(p.angle)*offset,y:p.y+Math.cos(p.angle)*offset,angle:p.angle};};
const sectionPoints=(start,end)=>NITROGEN_ROUTE.points.slice(Math.floor(start*(NITROGEN_ROUTE.points.length-1)),Math.ceil(end*(NITROGEN_ROUTE.points.length-1))+1);

export const NITROGEN_ZONES=Object.freeze([
  freeze({id:'nitrogen-entry-expanse',kind:'entry',start:0,end:.20,width:920,points:sectionPoints(0,.20)}),
  freeze({id:'nitrogen-mid-field',kind:'mid',start:.20,end:.46,width:800,points:sectionPoints(.20,.46)}),
  freeze({id:'nitrogen-critical-reach',kind:'critical',start:.46,end:.58,width:880,points:sectionPoints(.46,.58)}),
  freeze({id:'deep-nitrogen',kind:'deep',start:.58,end:.86,width:780,points:sectionPoints(.58,.86)}),
  freeze({id:'core-approach',kind:'core',start:.86,end:1,width:900,points:sectionPoints(.86,1)}),
]);
export const NITROGEN_HIGH_DENSITY_POCKET=freeze({...offsetAt(.36,300),id:'nitrogen-high-density-pocket',radius:170,particles:48,value:2});
export const NITROGEN_RECOVERY_AREAS=Object.freeze([freeze({...offsetAt(.57,-275),id:'nitrogen-recovery-shelf',radius:235}),freeze({...offsetAt(.76,285),id:'deep-nitrogen-recovery',radius:220})]);
export const NITROGEN_RECOVERY_AREA=NITROGEN_RECOVERY_AREAS[0];
export const NITROGEN_INSIGHT_AREA=freeze({...offsetAt(.49,-315),id:'nitrogen-critical-pocket',radius:155});
export const NITROGEN_RARE_CL_SITE=freeze({...offsetAt(.63,470),id:'rare-cl-nitrogen-pocket'});
export const NITROGEN_CORE=freeze({...offsetAt(.965,0),id:'nitrogen-core',radius:155,fractureRadius:245});

const hazard=(id,progress,{offset=0,radius=360,type=HAZARD_TYPES.MECHANICAL,subtype='turbulence',baseIntensity=.5,force=0,heat=0,angle=null,pulse=.16,phase=0}={})=>{
  const p=offsetAt(progress,offset);return freeze({id,progress,x:p.x,y:p.y,radius,type,subtype,baseIntensity,force,heat,angle:angle??p.angle+Math.PI/2,pulse,phase,hazard:defineHazard(id,type,subtype,{source:'nitrogen-field'})});
};
export const NITROGEN_HAZARDS=Object.freeze([
  hazard('nitrogen-entry-turbulence',.12,{offset:-120,radius:410,subtype:'turbulence',baseIntensity:.34,force:54,pulse:.12,phase:.3}),
  hazard('nitrogen-entry-shear',.21,{offset:250,radius:350,subtype:'shear',baseIntensity:.44,force:105,angle:0,pulse:.14,phase:1.2}),
  hazard('nitrogen-mid-pressure',.29,{offset:-170,radius:430,subtype:'pressure',baseIntensity:.58,force:155,angle:Math.PI/2,pulse:.10,phase:2.1}),
  hazard('nitrogen-mid-shear',.39,{offset:260,radius:390,subtype:'shear',baseIntensity:.68,force:170,angle:Math.PI,pulse:.18,phase:.7}),
  hazard('nitrogen-critical-turbulence',.50,{offset:175,radius:360,subtype:'turbulence',baseIntensity:.52,force:78,pulse:.17,phase:2.7}),
  hazard('deep-nitrogen-pressure-a',.62,{offset:-235,radius:465,subtype:'pressure',baseIntensity:.72,force:190,angle:Math.PI/2,pulse:.13,phase:1.4}),
  hazard('deep-nitrogen-thermal',.69,{offset:225,radius:500,type:HAZARD_TYPES.THERMAL,subtype:'hot-zone',baseIntensity:.72,heat:32,pulse:.08,phase:.2}),
  hazard('deep-nitrogen-shear',.77,{offset:-250,radius:430,subtype:'shear',baseIntensity:.80,force:205,angle:0,pulse:.18,phase:2.4}),
  hazard('deep-nitrogen-turbulence',.84,{offset:185,radius:470,subtype:'turbulence',baseIntensity:.82,force:112,pulse:.20,phase:1}),
  hazard('core-approach-thermal',.90,{offset:-180,radius:500,type:HAZARD_TYPES.THERMAL,subtype:'hot-zone',baseIntensity:.84,heat:38,pulse:.08,phase:1.8}),
  hazard('core-approach-pressure',.935,{offset:205,radius:450,subtype:'pressure',baseIntensity:.90,force:225,angle:Math.PI/2,pulse:.15,phase:.5}),
]);
export const NITROGEN_PULSES=Object.freeze(NITROGEN_HAZARDS.filter(item=>item.type===HAZARD_TYPES.MECHANICAL));

export const nitrogenZoneAtProgress=progress=>NITROGEN_ZONES.find(zone=>progress>=zone.start&&progress<zone.end)??NITROGEN_ZONES.at(-1);
export function nitrogenZoneAtPoint(p){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return null;let best=null;for(const zone of NITROGEN_ZONES)for(const point of zone.points){const d=Math.hypot(p.x-point.x,p.y-point.y);if(d<zone.width/2&&(!best||d<best.distance))best={zone,distance:d};}return best?.zone??null;}
export const nitrogenRecoveryAt=p=>NITROGEN_RECOVERY_AREAS.find(area=>Math.hypot(p.x-area.x,p.y-area.y)<=area.radius)??null;
export const nitrogenInsightAreaAt=p=>Math.hypot((p?.x??Infinity)-NITROGEN_INSIGHT_AREA.x,(p?.y??Infinity)-NITROGEN_INSIGHT_AREA.y)<=NITROGEN_INSIGHT_AREA.radius;
export const nitrogenCoreInRange=(run,p=run?.player)=>{const core=run?.map?.nitrogenCore;return !!core&&!core.fractured&&Number.isFinite(p?.x)&&Math.hypot(p.x-core.x,p.y-core.y)<=core.fractureRadius;};

export function nitrogenHazardSpatialAt(item,p,seed=1){
  if(!item||!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return 0;
  const dx=p.x-item.x,dy=p.y-item.y,distance=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),edgeNoise=deterministicNoise1D(seed,`nitrogen:${item.id}:edge`,angle*item.radius,item.radius*.72),effectiveRadius=item.radius*(1+edgeNoise*.095),core=effectiveRadius*.22;
  if(distance>=effectiveRadius)return 0;const falloff=distance<=core?1:1-smoothstep((distance-core)/(effectiveRadius-core)),densityNoise=deterministicNoise1D(seed,`nitrogen:${item.id}:density`,p.x*.31+p.y*.69,260);return clamp01(falloff*(.93+densityNoise*.07));
}
const nitrogenHazardScale=(item,spatial,time,worldState,recoveryScale=1)=>{
  const temporal=1-(item.pulse??0)+(item.pulse??0)*(.5+.5*Math.sin(time*1.35+item.phase)),scale=effectiveHazardScale(spatial*temporal*recoveryScale,item.baseIntensity,item.type,worldState);
  return {temporal,scale,intensity:clamp01(scale)};
};
export function nitrogenHazardEffectiveAt(item,p,time=0,seed=1,{worldState='base'}={}){
  const spatial=nitrogenHazardSpatialAt(item,p,seed),recovery=nitrogenRecoveryAt(p),recoveryScale=recovery?.id?0.22:1;
  return {spatial,recovery,...nitrogenHazardScale(item,spatial,time,worldState,recoveryScale)};
}
export function nitrogenVisualEffectiveAt(item,visual,time=0,{worldState='base'}={}){
  const spatial=clamp01(visual?.spatial),recoveryScale=visual?.recoveryScale===0.22?0.22:1;
  return {spatial,...nitrogenHazardScale(item,spatial,time,worldState,recoveryScale)};
}
export function nitrogenEnvironmentAt(p,time=0,seed=1,{worldState='base'}={}){
  let pressure=0,flowX=0,flowY=0,heat=0;const hazards=[];
  for(const item of NITROGEN_HAZARDS){const sample=nitrogenHazardEffectiveAt(item,p,time,seed,{worldState});if(sample.scale<=1e-6)continue;
    if(item.type===HAZARD_TYPES.THERMAL){const localHeat=item.heat*sample.scale;heat=Math.max(heat,localHeat);const h=hazardSample(item.hazard,sample.intensity,{severity:localHeat,heat:localHeat});if(h)hazards.push(h);continue;}
    const angle=item.subtype==='turbulence'?item.angle+Math.sin(time*.72+item.phase)*.55:item.angle,force=item.force*sample.scale,vx=Math.cos(angle)*force,vy=Math.sin(angle)*force;
    if(item.subtype==='pressure')pressure+=Math.max(0,vy||force);else{flowX+=vx;flowY+=vy;}const h=hazardSample(item.hazard,sample.intensity,{severity:force,vector:{x:vx,y:vy}});if(h)hazards.push(h);
  }
  return {pressure,flowX,flowY,heat,hazards,recovery:nitrogenRecoveryAt(p),combustionHeatFactor:1+Math.min(.7,heat/85)};
}
const nitrogenRetention=(level,{optional=false}={})=>optional?Math.max(0,1-level):Math.max(.3,1-level*.7);
function keepNitrogenSample(level,seed,index,count,{optional=false}={}){
  const retention=nitrogenRetention(level,{optional}),keepCount=Math.max(optional?0:1,Math.round(count*retention));
  if(keepCount>=count)return true;if(keepCount<=0)return false;
  const phase=Math.floor(random(seed)()*count);
  return (Math.imul(index,37)+phase)%count<keepCount;
}
function addDust(map,{x,y,angle,route,element,kind,value=1,ready=0,...extra}){map.dust.push({id:map.dust.length,x,y,angle,route,element,kind,value,ready,...extra});}
function buildNitrogenVisuals(seed){const visuals=[],rng=random(seed^0x6e697472);for(const item of NITROGEN_HAZARDS)for(let i=0;i<12;i++){const angle=i*2.399963+rng()*.34,radius=Math.sqrt((i+.4)/12)*item.radius*.91,x=item.x+Math.cos(angle)*radius,y=item.y+Math.sin(angle)*radius,spatial=nitrogenHazardSpatialAt(item,{x,y},seed);if(spatial>.04)visuals.push({id:`${item.id}:${i}`,hazardId:item.id,x,y,spatial,recoveryScale:nitrogenRecoveryAt({x,y})?.id?0.22:1,phase:rng()*Math.PI*2,type:item.type,subtype:item.subtype,baseIntensity:item.baseIntensity,angle:item.angle});}return visuals;}

export function appendNitrogenField(map,seed=1,stock={},options={}){
  if(!map||map.routes?.some(route=>route.id===NITROGEN_ROUTE.id)){if(map?.nitrogenCore&&options.coreFractured===true)map.nitrogenCore.fractured=true;return map;}
  const worldSeed=Number.isFinite(options.worldSeed)?options.worldSeed>>>0:NITROGEN_WORLD_SEED;
  map.nitrogenEnvironmentSeed=worldSeed;map.depletion??={};map.depletion.N=inventoryDepletion(stock,'N');const depletion=map.depletion.N,route={...NITROGEN_ROUTE,element:null,sourceElement:'N',kind:'nitrogen-field',nitrogen:true,routeDepletion:depletion,lanes:1,authoredLanes:1,value:1};
  map.routes.push(route);map.nitrogenZones=NITROGEN_ZONES;map.nitrogenHazards=NITROGEN_HAZARDS;map.nitrogenRecoveryAreas=NITROGEN_RECOVERY_AREAS;map.nitrogenVisuals=buildNitrogenVisuals(worldSeed);map.nitrogenCore={...NITROGEN_CORE,fractured:options.coreFractured===true};
  for(const [i,p] of route.points.entries()){
    if(i%3===0){if(keepNitrogenSample(depletion,worldSeed^0x4e32,i,Math.ceil(route.points.length/3)))addDust(map,{x:p.x,y:p.y,angle:p.angle,route:route.id,element:'N',kind:'nitrogen',value:1});continue;}
    const mixed=i%41===0?'C':i%23===0?'O':i%17===0?'H':null;if(!mixed)continue;const mixedDepletion=map.depletion[mixed]??0;if(!keepDepletedSegment(mixedDepletion,seed^0x316d,`${route.id}:${mixed}`,i,{optional:true}))continue;
    addDust(map,{x:p.x+(i%2?34:-34)*Math.cos(p.angle),y:p.y+(i%2?34:-34)*Math.sin(p.angle),angle:p.angle,route:`nitrogen-ambient-${mixed.toLowerCase()}`,element:mixed,kind:mixed==='C'?'carbon':mixed==='O'?'oxygen':'normal',value:1,ambient:true});
  }
  for(let i=0;i<NITROGEN_HIGH_DENSITY_POCKET.particles;i++){if(!keepNitrogenSample(depletion,worldSeed^0x91a7,i,NITROGEN_HIGH_DENSITY_POCKET.particles,{optional:true}))continue;const a=i*2.399963,r=Math.sqrt((i+.5)/NITROGEN_HIGH_DENSITY_POCKET.particles)*NITROGEN_HIGH_DENSITY_POCKET.radius;addDust(map,{x:NITROGEN_HIGH_DENSITY_POCKET.x+Math.cos(a)*r,y:NITROGEN_HIGH_DENSITY_POCKET.y+Math.sin(a)*r,angle:NITROGEN_HIGH_DENSITY_POCKET.angle,route:NITROGEN_HIGH_DENSITY_POCKET.id,element:'N',kind:'nitrogen',value:NITROGEN_HIGH_DENSITY_POCKET.value,pocket:NITROGEN_HIGH_DENSITY_POCKET.id});}
  map.signals?.push({id:'nitrogen-insight',region:'nitrogen',x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,anchorX:NITROGEN_INSIGHT_AREA.x,anchorY:NITROGEN_INSIGHT_AREA.y,ready:false,roll:.11,choice:.23,nitrogenCritical:true});
  map.labels.push({x:NITROGEN_ENTRY.x,y:NITROGEN_ENTRY.y,text:'NITROGEN FIELD · open entry'},{x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,text:'N₂ Critical pocket'});for(const area of NITROGEN_RECOVERY_AREAS)map.labels.push({x:area.x,y:area.y,text:'environment recovery'});map.labels.push({x:NITROGEN_CORE.x,y:NITROGEN_CORE.y,text:'CORE · rare-bearing inclusion'});return map;
}
