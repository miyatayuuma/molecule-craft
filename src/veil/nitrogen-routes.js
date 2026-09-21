import {inventoryDepletion,keepDepletedSegment,random} from './map.js';
import {NITROGEN_ENTRY} from './nitrogen-config.js';
import {defineHazard,deterministicNoise1D,effectiveHazardScale,hazardSample,HAZARD_TYPES} from './hazards.js';
import {registerResourceSocket} from './rare-ecology.js';

const freeze=value=>Object.freeze(value);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t);};
export const NITROGEN_WORLD_SEED=0x4e325632;
export const NITROGEN_MAIN_WAYPOINTS=freeze([
  freeze({x:280,y:-12920,label:'ENTRY'}),freeze({x:260,y:-13280}),freeze({x:80,y:-13780}),
  freeze({x:-240,y:-14600}),freeze({x:-120,y:-15180,label:'SIDE JUNCTION'}),freeze({x:120,y:-15720}),
  freeze({x:340,y:-16080}),freeze({x:220,y:-16440}),freeze({x:-180,y:-16680,label:'REGROUP'}),
  freeze({x:80,y:-16980}),freeze({x:0,y:-17420}),freeze({x:0,y:-17700,label:'CORE'}),
]);
export const NITROGEN_SIDE_WAYPOINTS=freeze([
  freeze({x:-120,y:-15180,label:'JUNCTION'}),freeze({x:-500,y:-15380}),freeze({x:-760,y:-15700}),
  freeze({x:-360,y:-15840}),freeze({x:120,y:-15720,label:'REJOIN'}),
]);

function sampledPolyline(id,waypoints,{width=760,spacing=30}={}){
  const points=[],segments=[];let length=0,cumulative=[];
  for(let segment=0;segment<waypoints.length-1;segment++){
    const a=waypoints[segment],b=waypoints[segment+1],dx=b.x-a.x,dy=b.y-a.y,distance=Math.hypot(dx,dy),steps=Math.ceil(distance/spacing),angle=Math.atan2(dy,dx);
    segments.push(freeze({index:segment,start:freeze({x:a.x,y:a.y}),end:freeze({x:b.x,y:b.y}),length:distance,angle}));
    for(let step=segment===0?0:1;step<=steps;step++){
      const t=step/steps,point=freeze({x:a.x+dx*t,y:a.y+dy*t,angle:segment===0&&step===0?NITROGEN_ENTRY.angle:angle,segment,waypointIndex:step===steps?segment+1:undefined,distanceFromEntry:length+distance*t});
      points.push(point);
    }
    length+=distance;cumulative.push(length);
  }
  const path=freeze(points),entry=freeze({position:freeze({x:waypoints[0].x,y:waypoints[0].y}),angle:NITROGEN_ENTRY.angle,width}),last=waypoints.at(-1),exit=freeze({position:freeze({x:last.x,y:last.y}),angle:segments.at(-1).angle,width});
  return freeze({id,label:id,width,spacing,length,points:path,segments:freeze(segments),waypoints,entry,exit,sockets:freeze({entry,exit}),cumulative:freeze(cumulative)});
}

export const NITROGEN_ROUTE=sampledPolyline('nitrogen-main',NITROGEN_MAIN_WAYPOINTS,{width:760,spacing:30});
export const NITROGEN_SIDE_ROUTE=sampledPolyline('nitrogen-side-pocket',NITROGEN_SIDE_WAYPOINTS,{width:360,spacing:24});
const section=(id,from,to,width)=>{
  const start=NITROGEN_ROUTE.cumulative[from-1]??0,end=NITROGEN_ROUTE.cumulative[to-1],points=NITROGEN_ROUTE.points.filter(point=>point.segment>=from&&point.segment<to||point.waypointIndex===from||point.waypointIndex===to);
  return freeze({id,kind:id,start:start/NITROGEN_ROUTE.length,end:end/NITROGEN_ROUTE.length,width,fromWaypoint:from,toWaypoint:to,points:freeze(points)});
};
export const NITROGEN_ZONES=freeze([
  section('entry-pocket',0,2,720),section('drive-channel',2,4,760),section('choice-shelf',4,5,700),
  section('pulse-lip',5,7,520),section('insight-basin',7,9,680),section('core-approach',9,11,720),
]);

export const NITROGEN_RESOURCE_GROUPS=freeze([
  freeze({id:'entry-pocket',x:260,y:-13280,radius:130,particles:24,value:1}),
  freeze({id:'drive-mid-stream',x:-240,y:-14600,radius:160,particles:24,value:1}),
  freeze({id:'insight-basin',x:-180,y:-16680,radius:170,particles:28,value:1}),
  freeze({id:'core-traces',x:0,y:-17420,radius:140,particles:20,value:1}),
]);
export const NITROGEN_HIGH_DENSITY_POCKET=freeze({id:'nitrogen-high-density-pocket',x:-760,y:-15700,angle:-Math.PI/2,radius:170,particles:36,value:2});
export const NITROGEN_RECOVERY_AREAS=freeze([
  freeze({id:'nitrogen-side-recovery',x:-500,y:-15380,radius:220,safeExtraction:true}),
  freeze({id:'nitrogen-regroup-basin',x:-180,y:-16680,radius:210,safeExtraction:false}),
]);
export const NITROGEN_RECOVERY_AREA=NITROGEN_RECOVERY_AREAS[0];
export const NITROGEN_REGROUP_AREA=NITROGEN_RECOVERY_AREAS[1];
export const NITROGEN_INSIGHT_ANCHORS=freeze([
  freeze({id:'nitrogen-insight-a',x:-180,y:-16680}),freeze({id:'nitrogen-insight-b',x:80,y:-16980}),freeze({id:'nitrogen-insight-c',x:0,y:-17520}),
]);
export const NITROGEN_INSIGHT_AREA=freeze({id:'nitrogen-insight-basin',x:-180,y:-16680,radius:160,anchors:NITROGEN_INSIGHT_ANCHORS});
export const NITROGEN_CORE=freeze({id:'nitrogen-core',x:0,y:-17700,radius:210,fractureRadius:260});

const hazard=(id,x,y,{radius,type=HAZARD_TYPES.MECHANICAL,subtype='turbulence',baseIntensity=.5,force=0,heat=0,angle=0,pulse=.16,phase=0}={})=>freeze({id,x,y,radius,type,subtype,baseIntensity,force,heat,angle,pulse,phase,hazard:defineHazard(id,type,subtype,{source:'nitrogen-field'})});
export const NITROGEN_HAZARDS=freeze([
  hazard('nitrogen-drive-pressure-a',70,-13950,{radius:650,subtype:'pressure',baseIntensity:.82,force:350,angle:Math.PI/2,pulse:.08,phase:.4}),
  hazard('nitrogen-drive-pressure-b',-175,-14450,{radius:650,subtype:'pressure',baseIntensity:.86,force:370,angle:Math.PI/2,pulse:.1,phase:1.2}),
  hazard('nitrogen-drive-shear',-210,-14640,{radius:420,subtype:'shear',baseIntensity:.58,force:115,angle:0,pulse:.14,phase:2.1}),
  hazard('nitrogen-combined-thermal',40,-17120,{radius:560,type:HAZARD_TYPES.THERMAL,subtype:'hot-zone',baseIntensity:.78,heat:34,pulse:.06,phase:.2}),
  hazard('nitrogen-combined-pressure',0,-17260,{radius:460,subtype:'pressure',baseIntensity:.70,force:170,angle:Math.PI/2,pulse:.08,phase:1.7}),
  hazard('nitrogen-core-turbulence',0,-17520,{radius:360,subtype:'turbulence',baseIntensity:.55,force:105,angle:0,pulse:.16,phase:2.4}),
]);
export const NITROGEN_PULSE_FIELD=freeze({id:'nitrogen-pulse-lip',x:290,y:-16260,radius:180,phase:1.75,angle:0,force:3000,baseIntensity:1,cleanHalfWidth:40,kind:'burst-advantage',type:HAZARD_TYPES.MECHANICAL,subtype:'shear',hazard:defineHazard('nitrogen-pulse-lip',HAZARD_TYPES.MECHANICAL,'shear',{source:'map.fields'})});

export const nitrogenZoneAtProgress=progress=>NITROGEN_ZONES.find(zone=>progress>=zone.start&&progress<zone.end)??NITROGEN_ZONES.at(-1);
export function nitrogenZoneAtPoint(p){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return null;let best=null;
  for(const zone of NITROGEN_ZONES)for(const point of zone.points){const d=Math.hypot(p.x-point.x,p.y-point.y);if(d<zone.width/2&&(!best||d<best.distance))best={zone,distance:d};}
  return best?.zone??null;
}
export const nitrogenRecoveryAt=p=>p?(NITROGEN_RECOVERY_AREAS.find(area=>Math.hypot(p.x-area.x,p.y-area.y)<=area.radius)??null):null;
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
  const pressureForces=[];let flowX=0,flowY=0,heat=0;const hazards=[];
  for(const item of NITROGEN_HAZARDS){const sample=nitrogenHazardEffectiveAt(item,p,time,seed,{worldState});if(sample.scale<=1e-6)continue;
    if(item.type===HAZARD_TYPES.THERMAL){const localHeat=item.heat*sample.scale;heat=Math.max(heat,localHeat);const h=hazardSample(item.hazard,sample.intensity,{severity:localHeat,heat:localHeat});if(h)hazards.push(h);continue;}
    const angle=item.subtype==='turbulence'?item.angle+Math.sin(time*.72+item.phase)*.55:item.angle,force=item.force*sample.scale,vx=Math.cos(angle)*force,vy=Math.sin(angle)*force;
    if(item.subtype==='pressure')pressureForces.push(Math.max(0,vy||force));else{flowX+=vx;flowY+=vy;}const h=hazardSample(item.hazard,sample.intensity,{severity:force,vector:{x:vx,y:vy}});if(h)hazards.push(h);
  }
  // Overlapping fronts reinforce one another without linearly turning authored
  // pockets into an unintended hard wall. The strongest front owns the base
  // push; secondary fronts add a bounded share of their combined force.
  const strongestPressure=Math.max(0,...pressureForces),pressure=strongestPressure+(pressureForces.reduce((sum,value)=>sum+value,0)-strongestPressure)*.8;
  return {pressure,flowX,flowY,heat,hazards,recovery:nitrogenRecoveryAt(p),combustionHeatFactor:1+Math.min(.7,heat/85)};
}

const nitrogenRetention=(level,{optional=false}={})=>optional?Math.max(0,1-level):Math.max(.3,1-level*.7);
export function keepNitrogenSample(level,seed,index,count,{optional=false}={}){
  const retention=nitrogenRetention(level,{optional}),keepCount=Math.max(optional?0:1,Math.round(count*retention));
  if(keepCount>=count)return true;if(keepCount<=0)return false;
  const phase=Math.floor(random(seed)()*count);
  return (Math.imul(index,37)+phase)%count<keepCount;
}
function addDust(map,{x,y,angle,route,element,kind,value=1,ready=0,...extra}){map.dust.push({id:map.dust.length,x,y,angle,route,element,kind,value,ready,...extra});}
function buildNitrogenVisuals(seed){
  const visuals=[],rng=random(seed^0x6e697472);
  for(const item of NITROGEN_HAZARDS)for(let i=0;i<12;i++){
    const angle=i*2.399963+rng()*.34,radius=Math.sqrt((i+.4)/12)*item.radius*.91,x=item.x+Math.cos(angle)*radius,y=item.y+Math.sin(angle)*radius,spatial=nitrogenHazardSpatialAt(item,{x,y},seed);
    if(spatial>.04)visuals.push({id:`${item.id}:${i}`,hazardId:item.id,x,y,spatial,recoveryScale:nitrogenRecoveryAt({x,y})?.id?0.22:1,phase:rng()*Math.PI*2,type:item.type,subtype:item.subtype,baseIntensity:item.baseIntensity,angle:item.angle});
  }
  return visuals;
}
function placeResourceGroup(map,group,depletion,seed,indexStart,total){
  for(let i=0;i<group.particles;i++){
    const angle=i*2.399963,radius=Math.sqrt((i+.5)/group.particles)*group.radius,x=group.x+Math.cos(angle)*radius,y=group.y+Math.sin(angle)*radius,index=indexStart+i;
    const socket=registerResourceSocket(map,{area:'nitrogen',route:NITROGEN_ROUTE.id,index,lane:0,x,y,angle,element:'N'});
    if(keepNitrogenSample(depletion,seed,index,total))addDust(map,{x,y,angle,route:NITROGEN_ROUTE.id,element:'N',kind:'nitrogen',value:group.value,resourceSocketKey:socket?.key,resourceGroup:group.id});
  }
}

export function appendNitrogenField(map,seed=1,stock={},options={}){
  if(!map||map.routes?.some(route=>route.id===NITROGEN_ROUTE.id)){if(map?.nitrogenCore&&options.coreFractured===true)map.nitrogenCore.fractured=true;return map;}
  const worldSeed=Number.isFinite(options.worldSeed)?options.worldSeed>>>0:NITROGEN_WORLD_SEED;
  map.nitrogenEnvironmentSeed=worldSeed;map.depletion??={};map.depletion.N=inventoryDepletion(stock,'N');const depletion=map.depletion.N;
  const route={...NITROGEN_ROUTE,element:null,sourceElement:'N',kind:'nitrogen-field',nitrogen:true,routeDepletion:depletion,lanes:1,authoredLanes:1,value:1};
  map.routes.push(route,{...NITROGEN_SIDE_ROUTE,element:null,sourceElement:'N',kind:'nitrogen-side-pocket',nitrogen:true,optional:true,lanes:1,authoredLanes:1,value:1});map.nitrogenSideRoute=NITROGEN_SIDE_ROUTE;map.nitrogenZones=NITROGEN_ZONES;map.nitrogenHazards=NITROGEN_HAZARDS;map.nitrogenPulseField={...NITROGEN_PULSE_FIELD};map.fields.push(map.nitrogenPulseField);
  map.nitrogenRecoveryAreas=NITROGEN_RECOVERY_AREAS;map.nitrogenVisuals=buildNitrogenVisuals(worldSeed);map.nitrogenCore={...NITROGEN_CORE,fractured:options.coreFractured===true};
  let socketIndex=0;for(const group of NITROGEN_RESOURCE_GROUPS){placeResourceGroup(map,group,depletion,worldSeed^0x4e32,socketIndex,96);socketIndex+=group.particles;}
  for(let i=0;i<NITROGEN_HIGH_DENSITY_POCKET.particles;i++){
    if(!keepNitrogenSample(depletion,worldSeed^0x91a7,i,NITROGEN_HIGH_DENSITY_POCKET.particles,{optional:true}))continue;
    const a=i*2.399963,r=Math.sqrt((i+.5)/NITROGEN_HIGH_DENSITY_POCKET.particles)*NITROGEN_HIGH_DENSITY_POCKET.radius;
    addDust(map,{x:NITROGEN_HIGH_DENSITY_POCKET.x+Math.cos(a)*r,y:NITROGEN_HIGH_DENSITY_POCKET.y+Math.sin(a)*r,angle:NITROGEN_HIGH_DENSITY_POCKET.angle,route:NITROGEN_HIGH_DENSITY_POCKET.id,element:'N',kind:'nitrogen',value:NITROGEN_HIGH_DENSITY_POCKET.value,pocket:NITROGEN_HIGH_DENSITY_POCKET.id});
  }
  for(const [i,element]of ['H','C','O','H','C','O','H','C','O','H','C','O'].entries()){
    const group=NITROGEN_RESOURCE_GROUPS[i%NITROGEN_RESOURCE_GROUPS.length],angle=i*2.399963,radius=group.radius*.76;
    addDust(map,{x:group.x+Math.cos(angle)*radius,y:group.y+Math.sin(angle)*radius,angle,route:`nitrogen-ambient-${element.toLowerCase()}`,element,kind:element==='C'?'carbon':element==='O'?'oxygen':'normal',value:1,ambient:true});
  }
  map.signals?.push(...NITROGEN_INSIGHT_ANCHORS.map(anchor=>({id:anchor.id,region:'nitrogen',x:anchor.x,y:anchor.y,anchorX:anchor.x,anchorY:anchor.y,captureRadius:160,ready:false,roll:.11,choice:.23,nitrogenCritical:true})));
  map.labels.push({x:NITROGEN_ENTRY.x,y:NITROGEN_ENTRY.y,text:'NITROGEN FIELD · proving ground'});
  for(const area of NITROGEN_RECOVERY_AREAS)map.labels.push({x:area.x,y:area.y,text:area.safeExtraction?'SAFE EXTRACTION · N recovery':'regroup basin · cool and reorient'});
  map.labels.push({x:NITROGEN_HIGH_DENSITY_POCKET.x,y:NITROGEN_HIGH_DENSITY_POCKET.y,text:'optional dense N pocket'},{x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,text:'N₂ resonance basin'},{x:NITROGEN_CORE.x,y:NITROGEN_CORE.y,text:'CORE · rare-bearing inclusion'});
  return map;
}
