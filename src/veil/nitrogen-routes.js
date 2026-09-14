import {createRoute,smoothCurve,straight,routeFlowAt} from './route-kit.js';
import {inventoryDepletion,keepDepletedSegment,random} from './map.js';

const freeze=value=>Object.freeze(value);
export const NITROGEN_REGION_BOUNDS=freeze({left:-1100,right:1250,top:-16650,bottom:500});
export const NITROGEN_ENTRY=freeze({x:280,y:-12920,angle:-Math.PI/2});
export const NITROGEN_EXIT=freeze({x:120,y:-16080,angle:-Math.PI/2});
export const NITROGEN_ROUTE=createRoute({
  id:'nitrogen-main',entry:NITROGEN_ENTRY,width:250,spacing:30,
  segments:[
    straight({length:360}),smoothCurve({length:500,turn:.28}),straight({length:430}),
    smoothCurve({length:500,turn:-.34}),straight({length:430}),smoothCurve({length:500,turn:.30}),straight({length:420}),
  ],
});
export const NITROGEN_PULSES=freeze([
  freeze({id:'nitrogen-pulse-1',progress:.14,force:1180,angle:0}),
  freeze({id:'nitrogen-pulse-2',progress:.29,force:1320,angle:Math.PI}),
  freeze({id:'nitrogen-pulse-3',progress:.45,force:1240,angle:0}),
  freeze({id:'nitrogen-pulse-4',progress:.61,force:1360,angle:Math.PI}),
  freeze({id:'nitrogen-pulse-5',progress:.77,force:1220,angle:0}),
  freeze({id:'nitrogen-pulse-6',progress:.91,force:1300,angle:Math.PI}),
]);
export const NITROGEN_INSIGHT_AREA=freeze({id:'nitrogen-critical-insight',x:-30,y:-15120,radius:190});
export const NITROGEN_HIGH_DENSITY_POCKET=freeze({id:'nitrogen-high-density',x:620,y:-14920,radius:115,particles:54,value:2});

const pointAt=progress=>NITROGEN_ROUTE.points[Math.min(NITROGEN_ROUTE.points.length-1,Math.max(0,Math.round(progress*(NITROGEN_ROUTE.points.length-1))))];
export function nitrogenInsightAreaAt(p){return !!p&&Math.hypot(p.x-NITROGEN_INSIGHT_AREA.x,p.y-NITROGEN_INSIGHT_AREA.y)<=NITROGEN_INSIGHT_AREA.radius;}
export function nitrogenEnvironmentAt(p,time=0){
  let flowX=0,flowY=0,intensity=0;
  for(const pulse of NITROGEN_PULSES){const c=pointAt(pulse.progress),dx=p.x-c.x,dy=p.y-c.y,d=Math.hypot(dx,dy),radius=150;if(d>=radius)continue;const spatial=(1-d/radius)**2,beat=.76+.24*Math.sin(time*3.1+pulse.progress*11),strength=pulse.force*spatial*beat;flowX+=Math.cos(pulse.angle)*strength;flowY+=Math.sin(pulse.angle)*strength*.08;intensity=Math.max(intensity,spatial);}
  const guide=routeFlowAt(NITROGEN_ROUTE,p,{speed:12,radius:NITROGEN_ROUTE.width*.62});
  return {flowX:flowX+guide.x,flowY:flowY+guide.y,intensity:Math.max(intensity,guide.intensity)};
}
export function appendNitrogenField(map,seed=1,stock={}){
  const depletion=inventoryDepletion(stock,'N'),rng=random(seed^0x6e6974),route={id:NITROGEN_ROUTE.id,label:'Pulse Corridor',element:'N',sourceElement:'N',points:NITROGEN_ROUTE.points,width:NITROGEN_ROUTE.width,spacing:30,lanes:2,authoredLanes:2,value:1,routeDepletion:depletion,nitrogen:true};
  map.routes.push(route);map.depletion.N=depletion;
  for(const [i,p] of NITROGEN_ROUTE.points.entries()){
    if(!keepDepletedSegment(depletion,seed^0x4e32,NITROGEN_ROUTE.id,i))continue;
    for(let lane=0;lane<2;lane++){const offset=(lane-.5)*48+(rng()-.5)*7,x=p.x-Math.sin(p.angle)*offset,y=p.y+Math.cos(p.angle)*offset;map.dust.push({id:map.dust.length,x,y,baseX:x,baseY:y,angle:p.angle,route:NITROGEN_ROUTE.id,element:'N',kind:'nitrogen',value:1,ready:0,lane:lane-.5});}
  }
  for(let i=0;i<NITROGEN_HIGH_DENSITY_POCKET.particles;i++){
    if(!keepDepletedSegment(depletion,seed^0x91a7,`${NITROGEN_HIGH_DENSITY_POCKET.id}:N`,i,{optional:true}))continue;
    const a=i*2.399963,r=Math.sqrt((i+.5)/NITROGEN_HIGH_DENSITY_POCKET.particles)*NITROGEN_HIGH_DENSITY_POCKET.radius,x=NITROGEN_HIGH_DENSITY_POCKET.x+Math.cos(a)*r,y=NITROGEN_HIGH_DENSITY_POCKET.y+Math.sin(a)*r;map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:NITROGEN_HIGH_DENSITY_POCKET.id,element:'N',kind:'nitrogen',value:NITROGEN_HIGH_DENSITY_POCKET.value,ready:0,pocket:NITROGEN_HIGH_DENSITY_POCKET.id});
  }
  for(const pulse of NITROGEN_PULSES){const c=pointAt(pulse.progress);map.fields.push({id:pulse.id,x:c.x,y:c.y,radius:150,phase:pulse.progress*1.7,angle:pulse.angle,force:pulse.force,kind:'nitrogen-pulse',route:NITROGEN_ROUTE.id});}
  map.signals?.push({id:'nitrogen-insight',region:'nitrogen',x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,anchorX:NITROGEN_INSIGHT_AREA.x,anchorY:NITROGEN_INSIGHT_AREA.y,ready:false,roll:.11,choice:.23,nitrogenCritical:true});
  map.labels.push({x:NITROGEN_ENTRY.x,y:NITROGEN_ENTRY.y,text:'NITROGEN FIELD · pulse corridor'},{x:NITROGEN_HIGH_DENSITY_POCKET.x,y:NITROGEN_HIGH_DENSITY_POCKET.y,text:'optional high-density N pocket'},{x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,text:'N₂ Critical Insight opportunity'});
  return map;
}
