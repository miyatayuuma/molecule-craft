import {appendHazard,defineHazard,effectiveHazardScale,HAZARD_TYPES} from './hazards.js';
import {shockStructureScaleFor} from './shock-structures.js';

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t);};
const freeze=value=>Object.freeze(value);

export const ELECTRICAL_CONTROL_LOSS_PER_INTENSITY=.36;
export const ELECTRICAL_PROPULSION_RESPONSE_LOSS_PER_INTENSITY=.18;
export const ELECTRICAL_FIELD=freeze({
  id:'carbon-sweep-charged-region',
  label:'post-Awakening charged bend',
  worldState:'awakened',
  baseIntensity:.8,
  bounds:freeze({left:430,right:815,top:-5200,bottom:-5525}),
  lobes:freeze([
    freeze({id:'entry',x:605,y:-5290,rx:118,ry:142,angle:.32,weight:.72}),
    freeze({id:'core',x:660,y:-5370,rx:132,ry:150,angle:.18,weight:1}),
    freeze({id:'branch',x:545,y:-5405,rx:94,ry:108,angle:-.42,weight:.58}),
    freeze({id:'tail',x:700,y:-5440,rx:104,ry:112,angle:-.12,weight:.76}),
  ]),
});
export const ELECTRICAL_HAZARD=defineHazard(ELECTRICAL_FIELD.id,HAZARD_TYPES.ELECTRICAL,'charged-region',{source:'post-awakening-field-ecology'});

function lobeInfluence(point,lobe){
  const dx=(Number(point?.x)||0)-lobe.x,dy=(Number(point?.y)||0)-lobe.y,c=Math.cos(lobe.angle),s=Math.sin(lobe.angle),localX=dx*c+dy*s,localY=-dx*s+dy*c;
  const radius=Math.hypot(localX/lobe.rx,localY/lobe.ry);
  return radius>=1?0:(1-smoothstep(radius))*lobe.weight;
}

export function electricalSpatialAt(point){
  let remaining=1;
  for(const lobe of ELECTRICAL_FIELD.lobes)remaining*=1-clamp01(lobeInfluence(point,lobe));
  return clamp01(1-remaining);
}

export function electricalBaseHazardsAt(point,{active=true,shockStructures=[]}={}){
  if(!active)return [];
  const spatial=electricalSpatialAt(point);if(spatial<=1e-6)return [];
  const sourceScale=shockStructureScaleFor(shockStructures,ELECTRICAL_FIELD.id);
  const effective=spatial*ELECTRICAL_FIELD.baseIntensity*sourceScale,hazards=[];
  appendHazard(hazards,ELECTRICAL_HAZARD,Math.min(1,effective),{effectiveIntensity:effective,severity:effective});
  return hazards;
}

export function electricalEffectiveAt(point,worldState='base',{shockStructures=[]}={}){
  if(worldState!==ELECTRICAL_FIELD.worldState)return 0;
  const sourceScale=shockStructureScaleFor(shockStructures,ELECTRICAL_FIELD.id);
  return effectiveHazardScale(electricalSpatialAt(point),ELECTRICAL_FIELD.baseIntensity*sourceScale,HAZARD_TYPES.ELECTRICAL,worldState);
}

export function electricalResponseFor(effectiveIntensity){
  const intensity=Math.max(0,Number(effectiveIntensity)||0);
  return {
    controlAuthority:Math.max(.6,1-intensity*ELECTRICAL_CONTROL_LOSS_PER_INTENSITY),
    propulsionAuthority:Math.max(.76,1-intensity*ELECTRICAL_PROPULSION_RESPONSE_LOSS_PER_INTENSITY),
  };
}

const fract=value=>value-Math.floor(value);
export const ELECTRICAL_VISUAL_SAMPLES=freeze(Array.from({length:72},(_,index)=>{
  const {left,right,top,bottom}=ELECTRICAL_FIELD.bounds;
  return freeze({
    x:left+fract((index+1)*.6180339887498949)*(right-left),
    y:top+fract((index+1)*.7548776662466927)*(bottom-top),
    threshold:fract((index+1)*.4142135623730951),
    phase:fract((index+1)*.5698402909980532),
    angle:fract((index+1)*.3819660112501051)*Math.PI*2,
  });
}));
