import { VEIL } from './config.js';
export function random(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// Authored knots, never random scatter. Uniform arc-length sampling keeps pickup rhythm.
export function sampleLine(knots,spacing=VEIL.dustSpacing){
  const result=[];let previous=null,remainder=0;
  for(let i=0;i<knots.length-1;i++){
    const a=knots[Math.max(0,i-1)],b=knots[i],c=knots[i+1],d=knots[Math.min(knots.length-1,i+2)];
    for(let j=0;j<=100;j++){
      const t=j/100,t2=t*t,t3=t2*t;
      const p={x:.5*(2*b[0]+(-a[0]+c[0])*t+(2*a[0]-5*b[0]+4*c[0]-d[0])*t2+(-a[0]+3*b[0]-3*c[0]+d[0])*t3),y:.5*(2*b[1]+(-a[1]+c[1])*t+(2*a[1]-5*b[1]+4*c[1]-d[1])*t2+(-a[1]+3*b[1]-3*c[1]+d[1])*t3)};
      if(previous){let dx=p.x-previous.x,dy=p.y-previous.y,len=Math.hypot(dx,dy);if(len>0){while(remainder+len>=spacing){const f=(spacing-remainder)/len;previous={x:previous.x+dx*f,y:previous.y+dy*f};result.push({...previous,angle:Math.atan2(dy,dx)});dx=p.x-previous.x;dy=p.y-previous.y;len=Math.hypot(dx,dy);remainder=0;}remainder+=len;}}else result.push({...p,angle:-Math.PI/2});
      previous=p;
    }
  }
  return result;
}
const DEFINITIONS=[
  ['entry','はじまりの流れ',[[0,210],[0,-220],[-180,-540],[0,-830],[0,-1100]]],
  ['safe','ゆるやかな流れ',[[0,-1100],[-380,-1300],[-670,-1720],[-520,-2200],[0,-2600]]],
  ['risk','濃い流れ',[[0,-1100],[340,-1320],[540,-1730],[350,-2130],[0,-2600]],'dense'],
  ['approach','空白へ',[[0,-2600],[140,-2730],[310,-2760]]],
  // 450-unit gap: > chain window at normal speed; < window during H₂ boost.
  ['landing','空白の向こう',[[765,-2760],[880,-2990],[650,-3240],[530,-3550]]],
  ['detour','大きな回り道',[[0,-2600],[-410,-2740],[-800,-3090],[-730,-3570],[-300,-3870],[180,-3630],[530,-3550]]],
  ['gate','外縁の流れ',[[530,-3550],[530,-3750]]],
  ['beyond','帳の向こう',[[530,-3960],[220,-4140],[-160,-3980]]],
  ['return','帰りの流れ',[[530,-3550],[1000,-3190],[1090,-2400],[930,-1510],[1070,-700],[800,40],[300,280],[0,210]]],
  ['technical','折り返す光',[[930,-1510],[610,-1010],[360,-720],[570,-450],[390,-180],[0,210]],'technical'],
];
export function createMap(seed=1){
  const rng=random(seed),denseChoice=Math.floor(rng()*3),routes=DEFINITIONS.map(([id,label,knots,kind])=>({id,label,kind,points:sampleLine(knots,kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing)}));
  const dust=[];
  for(const route of routes)for(const [i,p]of route.points.entries()){
    dust.push({...p,id:dust.length,route:route.id,kind:route.kind??'normal',value:VEIL.dustValue,ready:0});
    if(route.kind==='dense'||(['safe','return','technical'][denseChoice]===route.id&&i%24<12))for(const side of [-1,1])dust.push({...p,x:p.x-Math.sin(p.angle)*side*20,y:p.y+Math.cos(p.angle)*side*20,id:dust.length,route:route.id,kind:'dense',value:VEIL.dustValue,ready:0});
  }
  if(rng()<VEIL.rareChance){const route=routes.find(r=>r.id==='technical'),p=route.points[Math.floor(route.points.length*.6)];dust.push({...p,id:dust.length,route:route.id,kind:'rare',value:VEIL.rareValue*VEIL.dustPerH,ready:0});}
  return {seed,routes,dust,fields:[{x:470+(rng()-.5)*80,y:-1700+(rng()-.5)*100,radius:VEIL.fieldRadius,phase:rng()*4}],labels:[{x:-390,y:-1280,text:'ゆるやかな流れ'},{x:410,y:-1310,text:'高密度 / 反発場'},{x:500,y:-2760,text:'H₂ → 空白をつなぐ'},{x:530,y:-3660,text:'外縁の逆流 ↑ H₂'}]};
}
