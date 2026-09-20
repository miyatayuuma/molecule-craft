import { VEIL } from './config.js';
import {defineHazard,HAZARD_TYPES} from './hazards.js';
import {registerResourceSocket} from './rare-ecology.js';
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
  id:'hydrogen-revisit',label:'H revisit loop',classification:'G0 / G1',densityTier:'local-pocket',revisit:true,
  knots:freezeKnots([[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]),spacing:30,lanes:1,value:VEIL.dustValue,
  current:Object.freeze({width:180,force:90,hazard:defineHazard('hydrogen-revisit-current',HAZARD_TYPES.MECHANICAL,'turbulence',{source:'route-current'})}),
});
export const HYDROGEN_REVISIT_POCKET=Object.freeze({
  id:'hydrogen-revisit-pocket',x:-900,y:-2700,radius:72,particles:50,value:2,primary:'H',secondary:'C',
});

// N limits are a foundation default only; no current CHO route consumes N depletion.
const DEPLETION_LIMITS=Object.freeze({H:{start:120,full:700},C:{start:40,full:400},N:{start:120,full:425},O:{start:60,full:320}});
const OPTIONAL_H_ROUTES=new Set(['detour','technical',HYDROGEN_REVISIT_ROUTE.id]);
const clamp01=value=>Math.max(0,Math.min(1,value));
// Authored on the low-pressure safe H route, away from the spawn and the
// ambient turbulence field. Its geometry is fixed across every run seed.
export const SAFE_EXTRACTION_SITE=Object.freeze({id:'hydrogen-safe-extraction',x:-520,y:-2200,radius:120,route:'safe'});
function hashRoll(seed,key){let h=seed>>>0;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;return(h>>>0)/4294967296;}
export function isInsideSafeExtractionSite(point,site=SAFE_EXTRACTION_SITE){return !!point&&!!site&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.hypot(point.x-site.x,point.y-site.y)<=site.radius;}
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
export function createMap(seed=1,stock={},{capabilities={}}={}){
  const rng=random(seed),denseChoice=Math.floor(rng()*3),hDepletion=inventoryDepletion(stock,'H'),depletion={H:hDepletion,C:inventoryDepletion(stock,'C'),O:inventoryDepletion(stock,'O')},revisitUnlocked=capabilities.combustionDrive===true,routes=DEFINITIONS.filter(([id])=>id!==HYDROGEN_REVISIT_ROUTE.id||revisitUnlocked).map(([id,label,knots,kind])=>{
    const revisit=id===HYDROGEN_REVISIT_ROUTE.id,profile=revisit?HYDROGEN_REVISIT_ROUTE:null;
    return {id,label,kind,points:revisit?sampleAuthoredLine(knots,profile.spacing):sampleLine(knots,kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing),revisit,densityTier:profile?.densityTier,classification:profile?.classification,spacing:profile?.spacing,lanes:profile?.lanes,value:profile?.value,width:profile?.current?.width};
  });
  const dust=[],resourceSockets=[],socketRegistry={resourceSockets},denseSideCount=hDepletion<.3?2:hDepletion<.58?1:0,shoulderLaneCount=hDepletion<.2?VEIL.shoulderLanes:hDepletion<.45?Math.max(1,Math.ceil(VEIL.shoulderLanes/2)):0;
  for(const route of routes)for(const [i,p]of route.points.entries()){
    const optional=OPTIONAL_H_ROUTES.has(route.id),keepCenter=keepDepletedSegment(hDepletion,seed,route.id,i,{optional});
    if(route.revisit){
      const lanes=hDepletion<.28?route.lanes:hDepletion<.62?Math.max(1,Math.ceil(route.lanes/2)):1;
      for(let lane=0;lane<route.lanes;lane++){
        const signedLane=lane-(route.lanes-1)/2,offset=signedLane*VEIL.denseLaneOffset,x=p.x-Math.sin(p.angle)*offset,y=p.y+Math.cos(p.angle)*offset,socket=registerResourceSocket(socketRegistry,{area:'veil',route:route.id,index:i,lane,x,y,angle:p.angle,element:'H'});
        if(!keepCenter||lane>=lanes)continue;
        dust.push({...p,x,y,id:dust.length,route:route.id,kind:signedLane?'dense':'normal',value:route.value,ready:0,lane:signedLane,resourceSocketKey:socket?.key});
      }
      continue;
    }
    const socket=registerResourceSocket(socketRegistry,{area:'veil',route:route.id,index:i,lane:0,x:p.x,y:p.y,angle:p.angle,element:'H'});
    if(keepCenter)dust.push({...p,id:dust.length,route:route.id,kind:route.kind??'normal',value:VEIL.dustValue,ready:0,resourceSocketKey:socket?.key});
    if(keepCenter&&(route.kind==='dense'||(['safe','return','technical'][denseChoice]===route.id&&i%VEIL.bandPeriod<VEIL.bandLength))){
      const sides=denseSideCount===2?[-1,1]:denseSideCount===1?[-1]:[];
      for(const side of sides)dust.push({...p,x:p.x-Math.sin(p.angle)*side*VEIL.denseLaneOffset,y:p.y+Math.cos(p.angle)*side*VEIL.denseLaneOffset,id:dust.length,route:route.id,kind:'dense',value:VEIL.dustValue,ready:0,lane:side});
    }
    if(keepCenter&&route.id==='risk'&&p.y<-1400&&p.y>-2130)for(const side of [-1,1])for(let lane=0;lane<shoulderLaneCount;lane++){
      const offset=side*(VEIL.shoulderOffset+lane*VEIL.denseLaneOffset);
      dust.push({...p,x:p.x-Math.sin(p.angle)*offset,y:p.y+Math.cos(p.angle)*offset,id:dust.length,route:route.id,kind:'dense',value:VEIL.dustValue,ready:0,shoulder:true,lane:side*(lane+2)});
    }
  }
  const revisit=routes.find(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),currents=[];
  if(revisit){
    currents.push({id:'hydrogen-revisit-current',route:revisit,width:HYDROGEN_REVISIT_ROUTE.current.width,force:HYDROGEN_REVISIT_ROUTE.current.force,speed:-HYDROGEN_REVISIT_ROUTE.current.force,hazard:HYDROGEN_REVISIT_ROUTE.current.hazard});
    const pocket=HYDROGEN_REVISIT_POCKET;
    for(let i=0;i<pocket.particles;i++){
      const element=i%5===0?pocket.secondary:pocket.primary;
      if(!keepDepletedSegment(depletion[element]??0,seed^0x52f4a3,`${pocket.id}:${element}`,i,{optional:true}))continue;
      const angle=i*2.399963,radius=Math.sqrt((i+.5)/pocket.particles)*pocket.radius,x=pocket.x+Math.cos(angle)*radius,y=pocket.y+Math.sin(angle)*radius;
      dust.push({id:dust.length,x,y,angle:-Math.PI/2,route:pocket.id,element,kind:element==='C'?'carbon':'normal',value:pocket.value,ready:0,pocket:pocket.id});
    }
  }
  if(rng()<VEIL.rareChance){const route=routes.find(r=>r.id==='technical'),p=route.points[Math.floor(route.points.length*.6)];dust.push({...p,id:dust.length,route:route.id,kind:'rare',value:VEIL.rareValue*VEIL.dustPerH,ready:0});}
  const labels=[{x:-390,y:-1280,text:'ゆるやかな流れ'},{x:410,y:-1310,text:'濃い流れ'},{x:500,y:-2760,text:'静かな切れ目'},{x:530,y:-3660,text:'外縁の強流 ↑ H₂ BURST'}];
  const anchor=revisit?.points[Math.floor((revisit?.points.length??1)*.55)];
  if(anchor)labels.push({x:anchor.x,y:anchor.y,text:`${revisit.id} · post-DRIVE current ${HYDROGEN_REVISIT_ROUTE.current.force} · local H pocket`});
  return {seed,routes,dust,resourceSockets,depletion,currents,safeExtractionSite:SAFE_EXTRACTION_SITE,capabilities:{combustionDrive:revisitUnlocked},fields:[{id:'veil-ambient-flow',x:470+(rng()-.5)*80,y:-1700+(rng()-.5)*100,radius:VEIL.fieldRadius,phase:rng()*4,angle:.15,kind:'ambient-turbulence',hazard:defineHazard('veil-ambient-flow',HAZARD_TYPES.MECHANICAL,'turbulence',{source:'map.fields'})}],labels};
}
