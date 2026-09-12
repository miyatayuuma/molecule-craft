import {createVortexFlybyRoute,routeFlowAt} from './route-kit.js';

// One authored experiment. Route geometry and local field guidance share one
// route definition; the vortex remains a reusable area feature layered on top.
export const OXYGEN_HARVEST=Object.freeze({sideSpacing:90,eddyAtoms:180});
export const OXYGEN_JUNCTION=Object.freeze({x:120,y:-8700});
export const OXYGEN_REWARD=Object.freeze({x:120,y:-10720,radius:95});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smoothstep=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const freezePoints=points=>Object.freeze(points.map(point=>Object.freeze(point)));
const freezeStops=stops=>Object.freeze(stops.map(([y,value])=>Object.freeze({y,value})));
const vortexCenter=Object.freeze({x:-500,y:-8380});
const vortexDirection=-1;
export const OXYGEN_VORTEX_ROUTE=createVortexFlybyRoute({
  id:'oxygen-vortex-route',
  entry:{x:170,y:-8090,angle:-Math.PI/2},
  exit:{...OXYGEN_JUNCTION,angle:-Math.PI/2},
  center:vortexCenter,width:230,outerRadius:620,outwardRadius:820,innerRadius:105,startAngle:.4,inwardTurns:.27,outwardTurns:.23,direction:vortexDirection,spacing:20,
});
export const OXYGEN_VORTEX_REWARD=Object.freeze({x:vortexCenter.x,y:vortexCenter.y,radius:72});
export const OXYGEN_VORTEX=Object.freeze({
  id:'oxygen-vortex',label:'冷たい渦',center:vortexCenter,direction:vortexDirection,routeId:OXYGEN_VORTEX_ROUTE.id,
  influenceRadius:760,outerRadius:560,coreRadius:82,tangentialSpeed:112,inwardSpeed:40,inwardAssist:110,escapeAssist:96,
  knots:freezePoints(OXYGEN_VORTEX_ROUTE.points.map(point=>[point.x,point.y])),
  sockets:Object.freeze({entry:OXYGEN_VORTEX_ROUTE.sockets.entry,core:OXYGEN_VORTEX_ROUTE.sockets.core,exit:OXYGEN_VORTEX_ROUTE.sockets.exit,reward:OXYGEN_VORTEX_REWARD}),
  particleRings:Object.freeze([
    Object.freeze({radius:660,count:20,angularSpeed:-.13}),Object.freeze({radius:560,count:24,angularSpeed:-.17}),
    Object.freeze({radius:455,count:26,angularSpeed:-.22}),Object.freeze({radius:350,count:24,angularSpeed:-.28}),
    Object.freeze({radius:245,count:20,angularSpeed:-.34}),Object.freeze({radius:150,count:14,angularSpeed:-.40}),
  ]),
});
export function oxygenVortexFlowAt(p){
  // Route guidance is deliberately much weaker than the vortex itself. It is a
  // readable pre-flow cue, not an invisible rail that steers for the player.
  const guide=routeFlowAt(OXYGEN_VORTEX_ROUTE,p,{speed:4.5,radius:OXYGEN_VORTEX_ROUTE.width*.72});
  const dx=p.x-vortexCenter.x,dy=p.y-vortexCenter.y,radius=Math.hypot(dx,dy);
  if(!Number.isFinite(radius))return {x:0,y:0,intensity:0,radius,guideIntensity:0};
  if(radius<1)return {x:0,y:0,intensity:0,radius,guideIntensity:guide.intensity};
  if(radius>=OXYGEN_VORTEX.influenceRadius)return {...guide,radius,guideIntensity:guide.intensity};
  const rx=dx/radius,ry=dy/radius,tx=-ry*vortexDirection,ty=rx*vortexDirection;
  const edge=smoothstep((OXYGEN_VORTEX.influenceRadius-radius)/(OXYGEN_VORTEX.influenceRadius-OXYGEN_VORTEX.outerRadius));
  const coreFade=smoothstep((radius-OXYGEN_VORTEX.coreRadius*.45)/(OXYGEN_VORTEX.coreRadius*.8));
  const tangential=OXYGEN_VORTEX.tangentialSpeed*edge*(.58+.42*clamp(radius/OXYGEN_VORTEX.outerRadius,0,1))*coreFade;
  const vx=Number.isFinite(p.vx)?p.vx:0,vy=Number.isFinite(p.vy)?p.vy:0,radialVelocity=vx*rx+vy*ry,tangentVelocity=vx*tx+vy*ty;
  // Cutting inward while already travelling with the current converts orbital
  // speed into inward progress. Pointing straight at the centre still works,
  // but is not the quickest standard-thrust line.
  const baseInward=OXYGEN_VORTEX.inwardSpeed*edge*clamp((radius-OXYGEN_VORTEX.coreRadius)/(OXYGEN_VORTEX.outerRadius-OXYGEN_VORTEX.coreRadius),0,1);
  const inwardAssist=OXYGEN_VORTEX.inwardAssist*edge*clamp(-radialVelocity/130,0,1)*clamp(tangentVelocity/150,0,1);
  const escapeBand=Math.sin(Math.PI*clamp((radius-OXYGEN_VORTEX.coreRadius)/(OXYGEN_VORTEX.outerRadius-OXYGEN_VORTEX.coreRadius),0,1));
  const escape=OXYGEN_VORTEX.escapeAssist*edge*escapeBand*clamp(radialVelocity/130,0,1)*clamp(tangentVelocity/180,0,1);
  const radial=escape-baseInward-inwardAssist,guideWeight=coreFade*(1-edge*.7);
  return {x:tx*tangential+rx*radial+guide.x*guideWeight,y:ty*tangential+ry*radial+guide.y*guideWeight,intensity:Math.max(edge*coreFade,guide.intensity*.55*coreFade),radius,radial,tangential,guideIntensity:guide.intensity*coreFade};
}
export const OXYGEN_ROUTES=Object.freeze([
  {id:'oxygen-shortcut',label:'BURSTの近道',color:'#a8d8f0',x:-300,width:230,
    summary:'最短経路。中央の短い強流はBURSTで明確に楽になるが、能力必須にはしない。',
    knots:[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]],
    gates:[{y:-9700,depth:94,pressure:600}],pressure:0,lanes:1,value:2},
  {id:'oxygen-side',label:'低圧の支流',color:'#b4d99c',x:850,width:230,
    summary:'広い低圧帯でOを多く拾う支流。',
    knots:[[120,-8700],[780,-9000],[850,-10350],[120,-10670]],
    gates:[],pressure:0,lanes:4,value:3},
  {id:'oxygen-main',label:'持続流の本道',color:'#f0b28f',x:120,width:230,
    summary:'長い中程度の逆流を進むstandard route。途中の静かな採集帯で区切れる。',
    knots:[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]],
    gates:[],restStops:[{x:300,y:-9750,depth:180}],pressure:370,lanes:2,value:2},
]);

// Deep Oxygen remains physically open: these values describe authored route
// advantages, not capability gates. A coarser provisional dust spacing keeps the
// three-route expansion near the former single-route economy until Task 6.
export const DEEP_OXYGEN_ROUTES=Object.freeze([
  {id:'oxygen-deep-safe',label:'Deep Safe Long',color:'#9bbfd1',x:-650,width:260,classification:'G0 / G1',
    summary:'長い安全側baseline。低圧・低熱で通常推進と自然冷却だけでも安定通過できる。',
    knots:[[120,-10800],[-650,-11000],[-720,-11450],[100,-11830]],pressure:18,spacing:40,lanes:2,value:2},
  {id:'oxygen-deep-skill',label:'Deep Skill Fast',color:'#a8d8f0',x:100,width:180,classification:'G2',
    summary:'最短のprecision route。中央challengeは通常推進でもライン取りで迂回でき、BURSTなら直進しやすい。',
    knots:[[120,-10800],[100,-11200],[100,-11830]],pressure:34,spacing:40,lanes:2,value:2},
  {id:'oxygen-deep-thermal',label:'Deep Thermal',color:'#d69678',x:760,width:260,classification:'G1 → partial G3 candidate',
    summary:'低圧の高熱route。H₂Oは連続DRIVEを明確に伸ばすが、通常移動や休止による通過を妨げない。',
    knots:[[120,-10800],[760,-11050],[760,-11500],[100,-11830]],pressure:16,spacing:40,lanes:2,value:2},
]);
export const DEEP_OXYGEN_FRONTIER_RECOVERY=Object.freeze({x:100,y:-11700,rx:250,ry:130});
const DEEP_OFF_ROUTE_PRESSURE=120;

// Thermal values are environmentAt().heat game units, not player heat. Route C
// owns the network-local field. Deep heat is route-local and converges into a
// naturally cool Frontier recovery zone rather than a scripted heat reset.
export const OXYGEN_THERMAL=Object.freeze({
  routeId:'oxygen-side',coreRadius:150,fadeRadius:260,
  heatStops:freezeStops([
    [-8870,1],[-9050,2],[-9200,4],[-9500,12],[-9700,32],[-9800,48],
    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],
  ]),
  mergeRecovery:Object.freeze({x:120,y:-10800,radius:330,top:-10640,bottom:-10900}),
  deepProfiles:Object.freeze({
    'oxygen-deep-safe':Object.freeze({coreRadius:145,fadeRadius:255,heatStops:freezeStops([
      [-10900,0],[-11000,1],[-11200,3],[-11450,5],[-11550,5],[-11620,0],[-11830,0],
    ])}),
    'oxygen-deep-skill':Object.freeze({coreRadius:100,fadeRadius:190,heatStops:freezeStops([
      [-10900,0],[-11000,3],[-11200,14],[-11320,18],[-11500,18],[-11620,0],[-11830,0],
    ])}),
    'oxygen-deep-thermal':Object.freeze({coreRadius:165,fadeRadius:300,heatStops:freezeStops([
      [-10900,0],[-11000,5],[-11150,18],[-11300,36],[-11450,48],[-11550,48],[-11620,0],[-11830,0],
    ])}),
  }),
});
function profileAtY(stops,y){
  if(!Number.isFinite(y)||!stops.length||y>stops[0].y||y<stops.at(-1).y)return 0;
  for(let i=0;i<stops.length-1;i++){
    const a=stops[i],b=stops[i+1];
    if(y>a.y||y<b.y)continue;
    const t=smoothstep((a.y-y)/(a.y-b.y));
    return a.value+(b.value-a.value)*t;
  }
  return stops.at(-1).value;
}
export function oxygenRouteCenterAtY(route,y){
  if(!Number.isFinite(y)||!Array.isArray(route?.knots))return null;
  for(let i=0;i<route.knots.length-1;i++){
    const [x0,y0]=route.knots[i],[x1,y1]=route.knots[i+1];
    if((y-y0)*(y-y1)>0)continue;
    if(y0===y1)return y===y0?(x0+x1)/2:null;
    const t=(y-y0)/(y1-y0);
    return x0+(x1-x0)*t;
  }
  return null;
}
function routeLateral(route,p,coreRadius,fadeRadius){
  const centerX=oxygenRouteCenterAtY(route,p.y),distance=centerX===null?Infinity:Math.abs(p.x-centerX);
  if(distance<=coreRadius)return 1;
  if(distance>=fadeRadius)return 0;
  return 1-smoothstep((distance-coreRadius)/(fadeRadius-coreRadius));
}
function mergeRecoveryAt(p){
  const recovery=OXYGEN_THERMAL.mergeRecovery;
  return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y<=recovery.top&&p.y>=recovery.bottom&&Math.hypot(p.x-recovery.x,p.y-recovery.y)<=recovery.radius;
}
export function deepOxygenFrontierRecoveryAt(p){
  const recovery=DEEP_OXYGEN_FRONTIER_RECOVERY;
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y))return false;
  const dx=(p.x-recovery.x)/recovery.rx,dy=(p.y-recovery.y)/recovery.ry;
  return dx*dx+dy*dy<=1;
}
export function deepOxygenRouteAt(p){
  if(!Number.isFinite(p?.x)||!Number.isFinite(p?.y)||p.y>-10800||p.y<-11830)return null;
  let best=null,bestDistance=Infinity;
  for(const route of DEEP_OXYGEN_ROUTES){
    const centerX=oxygenRouteCenterAtY(route,p.y);
    if(centerX===null)continue;
    const distance=Math.abs(p.x-centerX);
    if(distance<=route.width/2&&distance<bestDistance){best=route;bestDistance=distance;}
  }
  return best;
}
export function deepOxygenPressureAt(p){
  if(!Number.isFinite(p?.y)||p.y>-10800||p.y<-11830)return null;
  if(mergeRecoveryAt(p)||deepOxygenFrontierRecoveryAt(p))return 0;
  return deepOxygenRouteAt(p)?.pressure??DEEP_OFF_ROUTE_PRESSURE;
}
export function oxygenThermalAt(p){
  const route=OXYGEN_ROUTES.find(candidate=>candidate.id===OXYGEN_THERMAL.routeId);
  const routeLateralFactor=routeLateral(route,p,OXYGEN_THERMAL.coreRadius,OXYGEN_THERMAL.fadeRadius);
  const routeHeat=profileAtY(OXYGEN_THERMAL.heatStops,p.y)*routeLateralFactor;
  const mergeRecovery=mergeRecoveryAt(p),frontierRecovery=deepOxygenFrontierRecoveryAt(p),recovery=mergeRecovery||frontierRecovery;
  let deepHeat=0,deepThermalHeat=0;
  if(!recovery){
    for(const deepRoute of DEEP_OXYGEN_ROUTES){
      const profile=OXYGEN_THERMAL.deepProfiles[deepRoute.id];
      const local=profileAtY(profile.heatStops,p.y)*routeLateral(deepRoute,p,profile.coreRadius,profile.fadeRadius);
      deepHeat=Math.max(deepHeat,local);
      if(deepRoute.id==='oxygen-deep-thermal')deepThermalHeat=local;
    }
  }
  const heat=Math.max(routeHeat,deepHeat),networkFactor=.71*clamp(routeHeat/48,0,1),deepFactor=.71*clamp(deepThermalHeat/48,0,1);
  return {heat,routeHeat,deepHeat,deepThermalHeat,recovery,mergeRecovery,frontierRecovery,intensity:clamp(heat/48,0,1),combustionHeatFactor:1+Math.max(networkFactor,deepFactor)};
}
export function oxygenRouteAt(p){
  if(p.y>-8870||p.y<-10480)return null;
  return OXYGEN_ROUTES.find(route=>{
    const centerX=oxygenRouteCenterAtY(route,p.y);
    return centerX!==null&&Math.abs(p.x-centerX)<route.width/2;
  })??null;
}
export function oxygenRestStopAt(p,route=oxygenRouteAt(p)){
  if(!route)return null;
  return (route.restStops??[]).find(stop=>{
    const centerX=stop.x??oxygenRouteCenterAtY(route,stop.y)??route.x;
    return Math.abs(p.y-stop.y)<stop.depth/2&&Math.abs(p.x-centerX)<route.width/2;
  })??null;
}
export function oxygenPressureAt(p){
  const deepPressure=deepOxygenPressureAt(p);
  if(deepPressure!==null)return deepPressure;
  if(p.y>-8700||p.y<-10850)return null;
  if(p.y>-8870||p.y<-10480)return 0; // approach, merge and shared harvest pocket
  const route=oxygenRouteAt(p);
  if(!route)return 370; // leaving a route is possible, but still costs thrust
  if(oxygenRestStopAt(p,route))return 0;
  let pressure=route.pressure;
  for(const gate of route.gates){
    const edge=gate.depth/2-Math.abs(p.y-gate.y);
    pressure=Math.max(pressure,gate.pressure*clamp(edge/Math.min(12,gate.depth/4),0,1));
  }
  return pressure;
}

export function recordOxygenPassage(run,old,dt){
  if(!run.map.universe)return;
  const route=oxygenRouteAt(run.player),t=run.telemetry;
  if(old.y>OXYGEN_JUNCTION.y&&run.player.y<=OXYGEN_JUNCTION.y)run.events.push({type:'oxygenJunction'});
  if(route&&!t.routesVisited.includes(route.id))t.routesVisited.push(route.id);
  if(route){
    for(const [index,gate]of route.gates.entries()){
      const line=gate.y-gate.depth/2,key=`${route.id}:${index}`;
      if(old.y>=line&&run.player.y<line&&!t.currentCrossings.includes(key))t.currentCrossings.push(key);
    }
    const stalled=run.player.vy<-100&&run.player.y-old.y>=-20*dt&&run.player.boost>0;
    run.burstStallSeconds=stalled?(run.burstStallSeconds??0)+dt:0;
    if(run.burstStallSeconds>=.15&&!run.burstStallRecorded){t.stalledBursts++;run.burstStallRecorded=true;}
  }
  if(Math.hypot(run.player.x-OXYGEN_REWARD.x,run.player.y-OXYGEN_REWARD.y)<OXYGEN_REWARD.radius)t.harvestReached=true;
}
