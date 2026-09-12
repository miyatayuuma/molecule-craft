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

// Revisit routes use the shared sampler but also preserve the authored terminal socket.
// Existing route samples stay byte-for-byte behaviorally unchanged.
export function sampleAuthoredLine(knots,spacing=VEIL.dustSpacing){
  const points=sampleLine(knots,spacing),[x,y]=knots.at(-1),last=points.at(-1);
  if(!last||Math.hypot(last.x-x,last.y-y)>1e-9){
    const from=last??{x:knots.at(-2)[0],y:knots.at(-2)[1]};
    points.push({x,y,angle:Math.atan2(y-from.y,x-from.x)});
  }else Object.assign(last,{x,y});
  return points;
}

const freezeKnots=knots=>Object.freeze(knots.map(knot=>Object.freeze(knot)));
export const HYDROGEN_REVISIT_ROUTE=Object.freeze({
  id:'hydrogen-revisit',label:'H revisit pocket',classification:'G0 / G1',densityTier:'very-high',revisit:true,
  knots:freezeKnots([[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]),spacing:20,lanes:3,value:VEIL.dustValue,
});

const DEPLETION_LIMITS=Object.freeze({H:{start:80,full:800},C:{start:40,full:400},O:{start:40,full:400}});
const OPTIONAL_H_ROUTES=new Set(['detour','technical',HYDROGEN_REVISIT_ROUTE.id]);
const clamp01=value=>Math.max(0,Math.min(1,value));
function hashRoll(seed,key){let h=seed>>>0;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;return(h>>>0)/4294967296;}
export function inventoryDepletion(stock={},element){
  const limits=DEPLETION_LIMITS[element];if(!limits)return 0;
  const amount=Number.isFinite(stock?.[element])?Math.max(0,stock[element]):0,t=clamp01((amount-limits.start)/(limits.full-limits.start));
  return t*t*(3-2*t);
}
export function keepDepletedSegment(level,seed,routeId,index,{optional=false}={}){
  if(optional&&level>=.9)return false;
  if(level<.58)return true;
  const block=Math.floor(index/7),chance=Math.min(.55,(level-.58)/.42*.55);
  return hashRoll(seed,`${routeId}:${block}`)>=chance;
}

const DEFINITIONS=[
  ['entry','はじまりの流れ',[[0,210],[0,-220],[-180,-540],[0,-830],[0,-1100]]],
  ['safe','ゆるやかな流れ',[[0,-1100],[-380,-1300],[-670,-1720],[-520,-2200],[0,-2600]]],
  ['risk','濃い流れ',[[0,-1100],[340,-1320],[540,-1730],[350,-2130],[0,-2600]],'dense'],
  ['approach','薄い光をたどる',[[0,-2600],[170,-2730],[520,-2760]]],
  // A quiet gap separates route phrases, but H₂ is reserved for danger and
  // the boundary current rather than being a CHAIN-maintenance tool.
  ['landing','光の向こう',[[625,-2760],[830,-2960],[650,-3240],[530,-3550]]],
  ['detour','外側の弧',[[0,-2600],[-410,-2740],[-800,-3090],[-730,-3570],[-300,-3870],[180,-3630],[530,-3550]]],
  ['gate','外縁の流れ',[[530,-3550],[530,-3750]]],
  ['beyond','帳の向こう',[[530,-3960],[220,-4140],[-160,-3980]]],
  ['return','帰りの流れ',[[530,-3550],[1000,-3190],[1090,-2400],[930,-1510],[1070,-700],[800,40],[300,280],[0,210]]],
  ['technical','折り返す光',[[930,-1510],[610,-1010],[360,-720],[570,-450],[390,-180],[0,210]],'technical'],
  [HYDROGEN_REVISIT_ROUTE.id,HYDROGEN_REVISIT_ROUTE.label,HYDROGEN_REVISIT_ROUTE.knots],
];
export function createMap(seed=1,stock={}){
  const rng=random(seed),denseChoice=Math.floor(rng()*3),hDepletion=inventoryDepletion(stock,'H'),routes=DEFINITIONS.map(([id,label,knots,kind])=>{
    const revisit=id===HYDROGEN_REVISIT_ROUTE.id,profile=revisit?HYDROGEN_REVISIT_ROUTE:null;
    return {id,label,kind,points:revisit?sampleAuthoredLine(knots,profile.spacing):sampleLine(knots,kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing),revisit,densityTier:profile?.densityTier,classification:profile?.classification,spacing:profile?.spacing,lanes:profile?.lanes,value:profile?.value};
  });
  const dust=[],denseSideCount=hDepletion<.3?2:hDepletion<.58?1:0,shoulderLaneCount=hDepletion<.2?VEIL.shoulderLanes:hDepletion<.45?Math.max(1,Math.ceil(VEIL.shoulderLanes/2)):0;
  for(const route of routes)for(const [i,p]of route.points.entries()){
    const optional=OPTIONAL_H_ROUTES.has(route.id),keepCenter=keepDepletedSegment(hDepletion,seed,route.id,i,{optional});
    if(route.revisit){
      if(!keepCenter)continue;
      const lanes=hDepletion<.28?route.lanes:hDepletion<.62?Math.max(1,Math.ceil(route.lanes/2)):1;
      for(let lane=0;lane<lanes;lane++){
        const signedLane=lane-(lanes-1)/2,offset=signedLane*VEIL.denseLaneOffset;
        dust.push({...p,x:p.x-Math.sin(p.angle)*offset,y:p.y+Math.cos(p.angle)*offset,id:dust.length,route:route.id,kind:signedLane?'dense':'normal',value:route.value,ready:0,lane:signedLane});
      }
      continue;
    }
    if(keepCenter)dust.push({...p,id:dust.length,route:route.id,kind:route.kind??'normal',value:VEIL.dustValue,ready:0});
    if(keepCenter&&(route.kind==='dense'||(['safe','return','technical'][denseChoice]===route.id&&i%VEIL.bandPeriod<VEIL.bandLength))){
      const sides=denseSideCount===2?[-1,1]:denseSideCount===1?[-1]:[];
      for(const side of sides)dust.push({...p,x:p.x-Math.sin(p.angle)*side*VEIL.denseLaneOffset,y:p.y+Math.cos(p.angle)*side*VEIL.denseLaneOffset,id:dust.length,route:route.id,kind:'dense',value:VEIL.dustValue,ready:0,lane:side});
    }
    if(keepCenter&&route.id==='risk'&&p.y<-1400&&p.y>-2130)for(const side of [-1,1])for(let lane=0;lane<shoulderLaneCount;lane++){
      const offset=side*(VEIL.shoulderOffset+lane*VEIL.denseLaneOffset);
      dust.push({...p,x:p.x-Math.sin(p.angle)*offset,y:p.y+Math.cos(p.angle)*offset,id:dust.length,route:route.id,kind:'dense',value:VEIL.dustValue,ready:0,shoulder:true,lane:side*(lane+2)});
    }
  }
  if(rng()<VEIL.rareChance){const route=routes.find(r=>r.id==='technical'),p=route.points[Math.floor(route.points.length*.6)];dust.push({...p,id:dust.length,route:route.id,kind:'rare',value:VEIL.rareValue*VEIL.dustPerH,ready:0});}
  const labels=[{x:-390,y:-1280,text:'ゆるやかな流れ'},{x:410,y:-1310,text:'濃い流れ'},{x:500,y:-2760,text:'静かな切れ目'},{x:530,y:-3660,text:'外縁の強流 ↑ H₂ BURST'}];
  const revisit=routes.find(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),anchor=revisit?.points[Math.floor((revisit?.points.length??1)*.55)];
  if(anchor)labels.push({x:anchor.x,y:anchor.y,text:`${revisit.id} · ${revisit.densityTier} H · spacing ${revisit.spacing} / lanes ${revisit.lanes} / value ${revisit.value}`});
  return {seed,routes,dust,depletion:{H:hDepletion,C:inventoryDepletion(stock,'C'),O:inventoryDepletion(stock,'O')},fields:[{x:470+(rng()-.5)*80,y:-1700+(rng()-.5)*100,radius:VEIL.fieldRadius,phase:rng()*4,angle:.15}],labels};
}
