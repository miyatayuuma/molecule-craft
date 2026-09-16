import {createRoute,smoothCurve,straight,routeFlowAt} from './route-kit.js';
import {inventoryDepletion,random} from './map.js';
import {NITROGEN_ENTRY} from './nitrogen-config.js';

const freeze=value=>Object.freeze(value);
const freezeList=values=>Object.freeze(values.map(value=>Object.freeze(value)));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Nitrogen is intentionally one continuous chapter rather than a route-choice
// network.  The route changes shape and encounter grammar several times so the
// player reads distinct spaces instead of six copies of the same pulse corridor.
export const NITROGEN_ROUTE=createRoute({
  id:'nitrogen-main',entry:NITROGEN_ENTRY,width:300,spacing:30,
  segments:[
    straight({length:320}),
    smoothCurve({length:520,turn:.60}),straight({length:360}),
    smoothCurve({length:520,turn:-1.00}),straight({length:260}),
    smoothCurve({length:620,turn:1.05}),straight({length:300}),
    smoothCurve({length:500,turn:-.75}),straight({length:360}),
  ],
});

export const NITROGEN_ZONES=freezeList([
  {id:'nitrogen-entry',label:'Threshold Fan',kind:'entry',start:0,end:.17,width:360,resourceStride:1,laneOffsets:[0]},
  {id:'nitrogen-crosswind',label:'Crosswind Weave',kind:'movement',start:.17,end:.46,width:220,resourceStride:1,laneOffsets:[0]},
  {id:'nitrogen-harvest-basin',label:'Harvest Basin',kind:'collection',start:.46,end:.67,width:480,resourceStride:2,laneOffsets:[-80,80]},
  {id:'nitrogen-recovery-shelf',label:'Recovery Shelf',kind:'recovery',start:.67,end:.79,width:540,resourceStride:3,laneOffsets:[0]},
  {id:'nitrogen-critical-approach',label:'Critical Approach',kind:'approach',start:.79,end:1,width:260,resourceStride:1,laneOffsets:[0]},
].map(zone=>({...zone,laneOffsets:Object.freeze(zone.laneOffsets)})));

const pointAt=progress=>NITROGEN_ROUTE.points[Math.min(NITROGEN_ROUTE.points.length-1,Math.max(0,Math.round(clamp(progress,0,1)*(NITROGEN_ROUTE.points.length-1))))];
const offsetAt=(progress,lateral=0)=>{const p=pointAt(progress);return freeze({x:p.x-Math.sin(p.angle)*lateral,y:p.y+Math.cos(p.angle)*lateral,angle:p.angle,progress:clamp(progress,0,1)});};
const zonePoints=zone=>{
  const last=NITROGEN_ROUTE.points.length-1,start=Math.max(0,Math.floor(zone.start*last)),end=Math.min(last,Math.ceil(zone.end*last));
  return Object.freeze(NITROGEN_ROUTE.points.slice(start,end+1));
};
export const NITROGEN_ZONE_GEOMETRY=Object.freeze(NITROGEN_ZONES.map(zone=>freeze({...zone,points:zonePoints(zone)})));
export function nitrogenZoneAtProgress(progress){const t=clamp(Number(progress)||0,0,1);return NITROGEN_ZONES.find((zone,index)=>t>=zone.start&&(index===NITROGEN_ZONES.length-1?t<=zone.end:t<zone.end))??NITROGEN_ZONES.at(-1);}

function segmentDistance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy,t=l2?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1):0;return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t);}
function polylineDistance(points,p){let best=Infinity;for(let i=0;i<points.length-1;i++)best=Math.min(best,segmentDistance(p,points[i],points[i+1]));return best;}
export function nitrogenZoneAtPoint(p){
  if(!p)return null;
  let best=null;
  for(const zone of NITROGEN_ZONE_GEOMETRY){const distance=polylineDistance(zone.points,p);if(distance<=zone.width/2&&(!best||distance<best.distance))best={zone,distance};}
  return best?.zone??null;
}

export const NITROGEN_HIGH_DENSITY_POCKET=freeze({...offsetAt(.57,260),id:'nitrogen-high-density',radius:125,particles:54,value:2});
export const NITROGEN_RECOVERY_AREA=freeze({...offsetAt(.73,0),id:'nitrogen-recovery',radius:190});
export const NITROGEN_INSIGHT_AREA=freeze({...offsetAt(.84,-140),id:'nitrogen-critical-insight',radius:165});
export const NITROGEN_RARE_CL_SITE=freeze({...offsetAt(.59,470),id:'rare-cl-nitrogen-pocket'});

function pulseAt(id,progress,{force,radius,offset=0,angleOffset=Math.PI/2,optional=false}={}){
  const p=offsetAt(progress,offset);return freeze({id,progress,x:p.x,y:p.y,force,radius,angle:p.angle+angleOffset,optional});
}
// Five disturbances shape the mainline; the fourth pulse is an optional shear
// protecting the richer collection side.  Irregular spacing/radius/direction
// avoids a metronomic obstacle sequence while preserving the existing PULSE roles.
export const NITROGEN_PULSES=Object.freeze([
  pulseAt('nitrogen-pulse-entry',.16,{force:360,radius:210,angleOffset:Math.PI/2}),
  pulseAt('nitrogen-pulse-weave-a',.27,{force:610,radius:125,angleOffset:-Math.PI/2}),
  pulseAt('nitrogen-pulse-weave-b',.36,{force:540,radius:145,angleOffset:Math.PI/2}),
  pulseAt('nitrogen-pulse-pocket',.57,{force:500,radius:140,offset:165,angleOffset:-Math.PI/2,optional:true}),
  pulseAt('nitrogen-pulse-approach',.83,{force:420,radius:185,angleOffset:Math.PI}),
  pulseAt('nitrogen-pulse-final',.94,{force:600,radius:130,angleOffset:Math.PI/2}),
]);
export const NITROGEN_MAINLINE_PULSES=Object.freeze(NITROGEN_PULSES.filter(pulse=>!pulse.optional));
export const NITROGEN_LANDMARKS=freezeList([
  {...offsetAt(.08),id:'nitrogen-threshold-fan',kind:'threshold',radius:180},
  {x:NITROGEN_HIGH_DENSITY_POCKET.x,y:NITROGEN_HIGH_DENSITY_POCKET.y,id:'nitrogen-harvest-basin-landmark',kind:'harvest',radius:220},
  {x:NITROGEN_RECOVERY_AREA.x,y:NITROGEN_RECOVERY_AREA.y,id:'nitrogen-recovery-landmark',kind:'recovery',radius:NITROGEN_RECOVERY_AREA.radius},
  {x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,id:'nitrogen-insight-alcove-landmark',kind:'insight',radius:175},
]);

const nitrogenRetention=(level,{optional=false}={})=>optional?Math.max(0,1-level):Math.max(.3,1-level*.7);
function keepNitrogenSample(level,seed,index,count,{optional=false}={}){
  const retention=nitrogenRetention(level,{optional}),keepCount=Math.max(optional?0:1,Math.round(count*retention));
  if(keepCount>=count)return true;if(keepCount<=0)return false;
  const phase=Math.floor(random(seed)()*count);
  return (Math.imul(index,37)+phase)%count<keepCount;
}
export function nitrogenInsightAreaAt(p){return !!p&&Math.hypot(p.x-NITROGEN_INSIGHT_AREA.x,p.y-NITROGEN_INSIGHT_AREA.y)<=NITROGEN_INSIGHT_AREA.radius;}
export function nitrogenEnvironmentAt(p,time=0){
  let flowX=0,flowY=0,intensity=0;
  for(const pulse of NITROGEN_PULSES){const dx=p.x-pulse.x,dy=p.y-pulse.y,d=Math.hypot(dx,dy),radius=pulse.radius;if(d>=radius)continue;const spatial=(1-d/radius)**2,beat=.76+.24*Math.sin(time*3.1+pulse.progress*11),strength=pulse.force*spatial*beat;flowX+=Math.cos(pulse.angle)*strength;flowY+=Math.sin(pulse.angle)*strength*.08;intensity=Math.max(intensity,spatial);}
  let guide={x:0,y:0,intensity:0};
  for(const zone of NITROGEN_ZONE_GEOMETRY){const next=routeFlowAt({points:zone.points,width:zone.width},p,{speed:zone.kind==='recovery'?6:11,radius:zone.width*.48});if(next.intensity>guide.intensity)guide=next;}
  return {flowX:flowX+guide.x,flowY:flowY+guide.y,intensity:Math.max(intensity,guide.intensity)};
}
export function appendNitrogenField(map,seed=1,stock={}){
  if(map.routes?.some(route=>route.id===NITROGEN_ROUTE.id))return map;
  const depletion=inventoryDepletion(stock,'N'),rng=random(seed^0x6e6974),route={id:NITROGEN_ROUTE.id,label:'Nitrogen Chapter',element:'N',sourceElement:'N',points:NITROGEN_ROUTE.points,width:NITROGEN_ROUTE.width,spacing:30,lanes:1,authoredLanes:1,value:1,routeDepletion:depletion,nitrogen:true,nitrogenZones:NITROGEN_ZONE_GEOMETRY};
  map.routes.push(route);map.depletion.N=depletion;map.nitrogenZones=NITROGEN_ZONE_GEOMETRY.map(zone=>({...zone,points:[...zone.points]}));map.nitrogenLandmarks=NITROGEN_LANDMARKS.map(item=>({...item}));

  const candidates=[];
  for(const [i,p] of NITROGEN_ROUTE.points.entries()){
    const progress=i/Math.max(1,NITROGEN_ROUTE.points.length-1),zone=nitrogenZoneAtProgress(progress);if(i%zone.resourceStride!==0)continue;
    for(const laneOffset of zone.laneOffsets){const lateral=laneOffset+(rng()-.5)*8,x=p.x-Math.sin(p.angle)*lateral,y=p.y+Math.cos(p.angle)*lateral;candidates.push({x,y,angle:p.angle,zone:zone.id,laneOffset});}
  }
  for(const [i,candidate] of candidates.entries()){
    if(!keepNitrogenSample(depletion,seed^0x4e32,i,candidates.length))continue;
    map.dust.push({id:map.dust.length,x:candidate.x,y:candidate.y,baseX:candidate.x,baseY:candidate.y,angle:candidate.angle,route:NITROGEN_ROUTE.id,element:'N',kind:'nitrogen',value:1,ready:0,lane:candidate.laneOffset,zone:candidate.zone});
  }
  for(let i=0;i<NITROGEN_HIGH_DENSITY_POCKET.particles;i++){
    if(!keepNitrogenSample(depletion,seed^0x91a7,i,NITROGEN_HIGH_DENSITY_POCKET.particles,{optional:true}))continue;
    const a=i*2.399963,r=Math.sqrt((i+.5)/NITROGEN_HIGH_DENSITY_POCKET.particles)*NITROGEN_HIGH_DENSITY_POCKET.radius,x=NITROGEN_HIGH_DENSITY_POCKET.x+Math.cos(a)*r,y=NITROGEN_HIGH_DENSITY_POCKET.y+Math.sin(a)*r;map.dust.push({id:map.dust.length,x,y,angle:NITROGEN_HIGH_DENSITY_POCKET.angle,route:NITROGEN_HIGH_DENSITY_POCKET.id,element:'N',kind:'nitrogen',value:NITROGEN_HIGH_DENSITY_POCKET.value,ready:0,pocket:NITROGEN_HIGH_DENSITY_POCKET.id});
  }
  for(const pulse of NITROGEN_PULSES)map.fields.push({id:pulse.id,x:pulse.x,y:pulse.y,radius:pulse.radius,phase:pulse.progress*1.7,angle:pulse.angle,force:pulse.force,kind:'nitrogen-pulse',route:NITROGEN_ROUTE.id,optional:pulse.optional});
  map.signals?.push({id:'nitrogen-insight',region:'nitrogen',x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,anchorX:NITROGEN_INSIGHT_AREA.x,anchorY:NITROGEN_INSIGHT_AREA.y,ready:false,roll:.11,choice:.23,nitrogenCritical:true});
  map.labels.push({x:NITROGEN_ENTRY.x,y:NITROGEN_ENTRY.y,text:'NITROGEN FIELD · threshold fan'});
  for(const zone of NITROGEN_ZONE_GEOMETRY){const center=zone.points[Math.floor(zone.points.length/2)];map.labels.push({x:center.x,y:center.y,text:`${zone.label} · width ${zone.width}`});}
  map.labels.push({x:NITROGEN_HIGH_DENSITY_POCKET.x,y:NITROGEN_HIGH_DENSITY_POCKET.y,text:'optional high-density N pocket'},{x:NITROGEN_RECOVERY_AREA.x,y:NITROGEN_RECOVERY_AREA.y,text:'environment recovery · reorient'},{x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,text:'N₂ Critical Insight alcove'});
  return map;
}
