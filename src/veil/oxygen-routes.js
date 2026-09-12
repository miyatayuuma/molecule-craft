import {createVortexFlybyRoute,routeFlowAt} from './route-kit.js';

// One authored experiment. Route geometry and local field guidance share one
// route definition; the vortex remains a reusable area feature layered on top.
export const OXYGEN_HARVEST=Object.freeze({sideSpacing:90,eddyAtoms:180});
export const OXYGEN_JUNCTION=Object.freeze({x:120,y:-8700});
export const OXYGEN_REWARD=Object.freeze({x:120,y:-10720,radius:95});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smoothstep=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const freezePoints=points=>Object.freeze(points.map(point=>Object.freeze(point)));
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
  const rx=dx/radius,ry=dy/radius,tx=-ry*OXYGEN_VORTEX.direction,ty=rx*OXYGEN_VORTEX.direction;
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
    summary:'広い低圧帯でOを多く拾う。thermal差別化は後続調整で加える。',
    knots:[[120,-8700],[780,-9000],[850,-10350],[120,-10670]],
    gates:[],pressure:0,lanes:4,value:3},
  {id:'oxygen-main',label:'持続流の本道',color:'#f0b28f',x:120,width:230,
    summary:'長い中程度の逆流を進むstandard route。途中の静かな採集帯で区切れる。',
    knots:[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]],
    gates:[],restStops:[{x:300,y:-9750,depth:180}],pressure:370,lanes:2,value:2},
]);
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
