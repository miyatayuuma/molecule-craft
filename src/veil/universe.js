import { createMap, sampleLine, random } from './map.js';
import { GROWTH } from './growth.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// Fixed landmarks and connections; variable contents stay near these curves.
const ROUTES=[
  ['carbon-entry','塊の光へ',[[530,-3980],[450,-4300],[250,-4620],[-120,-4990]],'C'],
  ['carbon-main','群れをほどく',[[-120,-4990],[-420,-5340],[-130,-5670],[350,-6020],[230,-6400],[-140,-6790],[170,-7190],[170,-7750]],'C'],
  ['carbon-sweep','群れの内側',[[-120,-4990],[560,-5140],[840,-5540],[650,-5950],[230,-6400]],'C'],
  ['carbon-return','外縁へ続くHの流れ',[[170,-7190],[-690,-6790],[-870,-5840],[-790,-4930],[-430,-4370],[-160,-3980]],'H'],
  ['oxygen-entry','冷たい縁',[[170,-7750],[170,-8090],[-70,-8390],[120,-8700]],'O'],
  ['oxygen-eddy','冷たい渦',[[120,-8700],[-500,-8630],[-700,-8230],[-340,-7970],[170,-8090]],'O'],
  ['oxygen-main','熱の奥へ',[[120,-8700],[390,-9150],[100,-9710],[-170,-10180],[80,-10670],[250,-11200],[100,-11830]],'O'],
  ['oxygen-side','速い支流',[[120,-8700],[870,-9040],[930,-9660],[670,-10160],[80,-10670]],'O'],
  ['horizon','まだ名のない光',[[100,-11830],[0,-12200],[280,-12470]],'O'],
];
const CLUSTERS=[[-120,-4990],[-410,-5350],[-160,-5680],[350,-6020],[230,-6400],[-140,-6790],[170,-7210],[570,-5140],[820,-5540],[660,-5950],[-380,-8150],[-500,-8540],[600,-9450]];
export function createUniverse(seed=1){
  const map=createMap(seed),rng=random(seed^0x5ca1ab1e);map.universe=true;map.clusters=[];map.signals=[];
  for(const d of map.dust){d.element='H';if(d.shoulder){d.x+=(rng()-.5)*13;d.y+=(rng()-.5)*16;}}
  for(const [id,label,knots,element]of ROUTES){
    const route={id,label,element,points:sampleLine(knots,element==='O'?25:30)};map.routes.push(route);
    for(const [i,p]of route.points.entries()){
      const el=element==='C'?'H':element==='O'?(i%5===0?'H':i%17===0?'C':'O'):'H';
      const fast=id==='oxygen-main'||id==='oxygen-side';
      for(let lane=0;lane<(fast?3:1);lane++){
        const offset=(fast?lane-1:0)*29+(rng()-.5)*10,x=p.x-Math.sin(p.angle)*offset,y=p.y+Math.cos(p.angle)*offset;
        map.dust.push({id:map.dust.length,x,y,baseX:x,baseY:y,angle:p.angle,route:id,element:el,kind:el==='H'?'normal':el==='C'?'carbon':'oxygen',value:1,ready:0,flow:fast?{speed:165+rng()*60,span:210,phase:rng()}:null});
      }
    }
  }
  for(const [i,point]of CLUSTERS.entries()){
    const cluster={id:i,x:point[0]+(rng()-.5)*65,y:point[1]+(rng()-.5)*70,radius:GROWTH.clusterRadius,ready:0,burstAt:-100,phase:rng()*Math.PI*2,particles:[]};
    for(let j=0;j<GROWTH.clusterParticles;j++){
      const element=j%5===0?'H':'C',angle=rng()*Math.PI*2;
      const d={id:map.dust.length,x:cluster.x,y:cluster.y,angle,element,kind:element==='C'?'carbon':'normal',cluster:i,spread:.3+rng()*.7,value:3,ready:Infinity};
      cluster.particles.push(d);map.dust.push(d);
    }map.clusters.push(cluster);
  }
  for(const [region,x,y]of [['veil',390,-650],['carbon',840,-5660],['oxygen',-610,-8290]])map.signals.push({region,x:x+(rng()-.5)*60,y:y+(rng()-.5)*60,ready:false,roll:rng(),choice:rng()});
  map.fields.push({x:720,y:-5540,radius:210,phase:rng()*4,angle:-.4},{x:700,y:-9160,radius:290,phase:rng()*4,angle:Math.PI*.7},{x:-110,y:-10200,radius:300,phase:rng()*4,angle:.5});
  map.labels.push({x:250,y:-4500,text:'炭素の群れ ↑'},{x:-120,y:-4890,text:'塊へ進入 → Cがほどける'},{x:170,y:-7590,text:'酸素の奔流 ↑'},{x:-490,y:-8050,text:'流れの縁 · H / C / O'},{x:150,y:-8840,text:'高温・逆流 ↑  COMBUSTION DRIVE'},{x:100,y:-11980,text:'さらに奥に、違う光…'});
  return map;
}
// Strata span the whole world. These are velocities and heat, not key flags.
function band(y,top,bottom,fade){return clamp(Math.min((y-top)/fade,(bottom-y)/fade),0,1);}
export function environmentAt(p,time=0){
  const outer=band(p.y,-4100,-3690,105),hot=band(p.y,-11780,-8830,170),oxygen=band(p.y,-11780,-8150,300);
  const coolEddy=Math.exp(-(((p.x+510)/240)**2+((p.y+8380)/300)**2));
  return {pressure:outer*255+hot*310,flowX:oxygen*(1-coolEddy)*Math.sin(time*1.7+p.y*.008)*48,heat:hot*32+oxygen*(1-hot)*(1-coolEddy)*3,intensity:hot,eddy:coolEddy};
}
export function animateUniverse(run){
  if(!run.map.universe)return;const {time,player:p,map}=run;
  for(const d of map.dust)if(d.flow){const phase=((time*d.flow.speed/d.flow.span+d.flow.phase)%1-.5)*d.flow.span;d.x=d.baseX+Math.cos(d.angle)*phase;d.y=d.baseY+Math.sin(d.angle)*phase;}
  for(const cluster of map.clusters){
    if(time>=cluster.ready&&Math.hypot(p.x-cluster.x,p.y-cluster.y)<cluster.radius+(p.boost>0||p.combustion?22:0)){
      cluster.ready=time+GROWTH.clusterRespawn;cluster.burstAt=time;for(const d of cluster.particles)d.ready=0;run.events.push({type:'cluster',x:cluster.x,y:cluster.y});
    }
    const age=time-cluster.burstAt;if(age<0||age>GROWTH.clusterRespawn)continue;
    for(const d of cluster.particles){const radius=14+GROWTH.clusterSpread*d.spread*(1-Math.exp(-age*2.4));d.x=cluster.x+Math.cos(d.angle+Math.min(age,5)*.08)*radius;d.y=cluster.y+Math.sin(d.angle+Math.min(age,5)*.08)*radius;}
  }
  for(const signal of map.signals)if(!signal.ready&&Math.hypot(p.x-signal.x,p.y-signal.y)<run.config.suctionRadius+18){signal.ready=true;run.events.push({type:'signal',region:signal.region,roll:signal.roll,choice:signal.choice});}
}
