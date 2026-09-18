import {appendHazard,defineHazard,effectiveHazardScale,HAZARD_TYPES} from './hazards.js';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t);};
const freeze=value=>Object.freeze(value);

export const ABRASIVE_MOVEMENT_DRAG_PER_INTENSITY=.34;
export const ABRASIVE_PLUME=freeze({
  id:'carbon-lower-abrasive-plume',
  label:'post-Awakening particulate plume',
  worldState:'awakened',
  baseIntensity:.82,
  direction:freeze({x:-.82,y:.57}),
  bounds:freeze({left:-360,right:430,top:-7160,bottom:-6100}),
  lobes:freeze([
    freeze({id:'upper',x:225,y:-6325,rx:165,ry:245,angle:-.24,weight:.74}),
    freeze({id:'middle',x:105,y:-6535,rx:215,ry:300,angle:.16,weight:1}),
    freeze({id:'lower',x:-45,y:-6750,rx:190,ry:270,angle:.34,weight:.92}),
    freeze({id:'tail',x:-105,y:-6940,rx:135,ry:210,angle:.48,weight:.64}),
  ]),
});
export const ABRASIVE_HAZARD=defineHazard(ABRASIVE_PLUME.id,HAZARD_TYPES.ABRASIVE,'particle-stream',{source:'post-awakening-field-ecology'});

function lobeInfluence(point,lobe){
  const dx=(Number(point?.x)||0)-lobe.x,dy=(Number(point?.y)||0)-lobe.y,c=Math.cos(lobe.angle),s=Math.sin(lobe.angle),localX=dx*c+dy*s,localY=-dx*s+dy*c;
  const radius=Math.hypot(localX/lobe.rx,localY/lobe.ry);
  return radius>=1?0:(1-smoothstep(radius))*lobe.weight;
}

export function abrasiveSpatialAt(point){
  let remaining=1;
  for(const lobe of ABRASIVE_PLUME.lobes)remaining*=1-clamp01(lobeInfluence(point,lobe));
  return clamp01(1-remaining);
}

export function abrasiveBaseHazardsAt(point,{active=true}={}){
  if(!active)return [];
  const spatial=abrasiveSpatialAt(point);if(spatial<=1e-6)return [];
  const effective=spatial*ABRASIVE_PLUME.baseIntensity,hazards=[];
  appendHazard(hazards,ABRASIVE_HAZARD,Math.min(1,effective),{effectiveIntensity:effective,severity:effective});
  return hazards;
}

export function abrasiveEffectiveAt(point,worldState='base'){
  if(worldState!==ABRASIVE_PLUME.worldState)return 0;
  return effectiveHazardScale(abrasiveSpatialAt(point),ABRASIVE_PLUME.baseIntensity,HAZARD_TYPES.ABRASIVE,worldState);
}

const fract=value=>value-Math.floor(value);
export const ABRASIVE_VISUAL_SAMPLES=freeze(Array.from({length:180},(_,index)=>{
  const {left,right,top,bottom}=ABRASIVE_PLUME.bounds;
  return freeze({
    x:left+fract((index+1)*.6180339887498949)*(right-left),
    y:top+fract((index+1)*.7548776662466927)*(bottom-top),
    threshold:fract((index+1)*.4142135623730951),
    phase:fract((index+1)*.5698402909980532),
  });
}));
