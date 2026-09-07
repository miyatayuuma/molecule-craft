// One authored experiment. Geometry is shared by physics, dust, drawing and
// the supply chart; no route knows about recipes, molecule IDs or unlocks.
// Placement parameters are also accepted by offline comparison runs.
export const OXYGEN_HARVEST=Object.freeze({sideSpacing:90,eddyAtoms:180});
export const OXYGEN_JUNCTION=Object.freeze({x:120,y:-8700});
export const OXYGEN_REWARD=Object.freeze({x:120,y:-10720,radius:95});
export const OXYGEN_ROUTES=Object.freeze([
  {id:'oxygen-shortcut',label:'強流の近道',color:'#a8d8f0',x:-300,width:230,
    summary:'強い一噴射で薄い流れを越える。短時間・採集少なめ。',
    knots:[[120,-8700],[-300,-8870],[-300,-10480],[120,-10670]],
    gates:[{y:-9250,depth:94,pressure:600}],pressure:0,lanes:1,value:2},
  {id:'oxygen-side',label:'連続する支流',color:'#b4d99c',x:850,width:230,
    summary:'4つの弱い逆流と、左右に広がる採集帯。急ぐか、進路を変えて拾うか。',
    knots:[[120,-8700],[850,-8870],[850,-10480],[120,-10670]],
    gates:[-9150,-9500,-9850,-10200].map(y=>({y,depth:24,pressure:490})),pressure:0,lanes:4,value:3},
  {id:'oxygen-main',label:'持続流の本道',color:'#f0b28f',x:120,width:230,
    summary:'長い逆流を燃焼で進む。静かな渦で冷却しながらOをまとめて回収。',
    knots:[[120,-8700],[120,-8870],[120,-9700],[120,-10480],[120,-10670]],
    gates:[],restStops:[{y:-9700,depth:180}],pressure:370,lanes:2,value:2},
]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function oxygenRouteAt(p){
  if(p.y>-8870||p.y<-10480)return null;
  return OXYGEN_ROUTES.find(route=>Math.abs(p.x-route.x)<route.width/2)??null;
}
export function oxygenPressureAt(p){
  if(p.y>-8700||p.y<-10850)return null;
  if(p.y>-8870||p.y<-10480)return 0; // approach, merge and shared harvest pocket
  const route=oxygenRouteAt(p);
  if(!route)return 370; // leaving a route is possible, but still costs thrust
  if(route.restStops?.some(stop=>Math.abs(p.y-stop.y)<stop.depth/2))return 0;
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
