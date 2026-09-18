export const HAZARD_CONTRACT_VERSION=1;

export const HAZARD_TYPES=Object.freeze({
  MECHANICAL:'mechanical',
  THERMAL:'thermal',
  ABRASIVE:'abrasive',
  ELECTRICAL:'electrical',
});

export const HAZARD_SUBTYPES=Object.freeze({
  mechanical:Object.freeze(['pressure','shear','turbulence','vortex']),
  thermal:Object.freeze(['hot-zone','gradient']),
  abrasive:Object.freeze(['particle-stream']),
  electrical:Object.freeze(['arc','charged-region']),
});

const VALID_TYPES=new Set(Object.values(HAZARD_TYPES));
const VALID_SUBTYPES=new Map(Object.entries(HAZARD_SUBTYPES).map(([type,values])=>[type,new Set(values)]));
const clamp01=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smoothstep=value=>{const t=clamp01(value);return t*t*(3-2*t);};
const keyHashCache=new Map();

function hashKey(key){
  const text=String(key??'');
  if(keyHashCache.has(text))return keyHashCache.get(text);
  let hash=2166136261;
  for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}
  hash>>>=0;keyHashCache.set(text,hash);return hash;
}
function latticeValue(seed,key,index){
  let value=(Number(seed)>>>0)^hashKey(key)^Math.imul(index|0,0x9e3779b1);
  value^=value>>>16;value=Math.imul(value,0x7feb352d);value^=value>>>15;value=Math.imul(value,0x846ca68b);value^=value>>>16;
  return ((value>>>0)/4294967295)*2-1;
}

export function deterministicNoise1D(seed,key,coordinate,scale=180){
  const safeScale=Math.max(1,Math.abs(Number(scale)||180)),position=(Number(coordinate)||0)/safeScale,index=Math.floor(position),fraction=position-index,eased=smoothstep(fraction);
  const a=latticeValue(seed,key,index),b=latticeValue(seed,key,index+1);
  return a+(b-a)*eased;
}

export function defineHazard(id,type,subtype,{source='field-environment'}={}){
  if(typeof id!=='string'||!id)throw new TypeError('Hazard id must be a non-empty string');
  if(!VALID_TYPES.has(type))throw new TypeError(`Unknown hazard type: ${type}`);
  if(!VALID_SUBTYPES.get(type)?.has(subtype))throw new TypeError(`Unknown ${type} hazard subtype: ${subtype}`);
  return Object.freeze({id,type,subtype,source});
}

export function hazardSample(definition,intensity,{severity=intensity,vector=null,heat=null,spatial=true}={}){
  if(!definition||!VALID_TYPES.has(definition.type))throw new TypeError('Hazard sample requires a valid definition');
  const normalized=clamp01(intensity);
  if(normalized<=1e-6)return null;
  const sample={id:definition.id,type:definition.type,subtype:definition.subtype,source:definition.source,intensity:normalized,severity:Number.isFinite(severity)?Math.max(0,severity):normalized,spatial:spatial!==false};
  if(vector&&Number.isFinite(vector.x)&&Number.isFinite(vector.y))sample.vector={x:vector.x,y:vector.y};
  if(Number.isFinite(heat))sample.heat=Math.max(0,heat);
  return sample;
}

export function appendHazard(target,definition,intensity,details){
  const sample=hazardSample(definition,intensity,details);if(sample)target.push(sample);return sample;
}

export function dominantHazard(hazards,type=null){
  let best=null;
  for(const hazard of hazards??[]){if(type&&hazard.type!==type)continue;if(!best||hazard.intensity>best.intensity)best=hazard;}
  return best;
}

export function softExtentInfluence(value,center,halfExtent,fade=0){
  const extent=Math.max(0,Number(halfExtent)||0),edge=Math.max(0,Math.min(extent,Number(fade)||0)),distance=Math.abs((Number(value)||0)-(Number(center)||0));
  if(edge<=1e-9)return distance<=extent?1:0;
  const inner=Math.max(0,extent-edge),outer=extent+edge;
  if(distance<=inner)return 1;if(distance>=outer)return 0;
  return 1-smoothstep((distance-inner)/(outer-inner));
}

export function organicCorridorProfile(seed,id,axis,center,halfWidth,{centerJitter=0,widthJitter=.08,scale=180}={}){
  const nominal=Math.max(1,Number(halfWidth)||1),drift=deterministicNoise1D(seed,`${id}:center`,axis,scale)*Math.max(0,centerJitter),widthNoise=deterministicNoise1D(seed,`${id}:width`,axis,scale*.83);
  return {center:(Number(center)||0)+drift,halfWidth:nominal*Math.max(.72,1+widthNoise*Math.max(0,widthJitter)),nominalHalfWidth:nominal};
}

export function organicCorridorInfluence({seed=1,id='hazard',x=0,y=0,centerX=0,centerY=0,halfWidth=100,halfLength=Infinity,edgeFade=0,centerJitter=0,widthJitter=.08,scale=180}={}){
  const profile=organicCorridorProfile(seed,id,y,centerX,halfWidth,{centerJitter,widthJitter,scale}),normalized=Math.abs((Number(x)||0)-profile.center)/profile.halfWidth,lateral=normalized>=1?0:1-smoothstep(normalized),longitudinal=Number.isFinite(halfLength)?softExtentInfluence(y,centerY,halfLength,edgeFade):1;
  return {...profile,lateral,longitudinal,intensity:lateral*longitudinal};
}

export const FIELD_RESPONSIBILITY_AUDIT=Object.freeze({
  environmentalHazards:Object.freeze([
    Object.freeze({source:'map.fields',types:Object.freeze(['mechanical']),examples:Object.freeze(['ambient flow field','BURST shear','Nitrogen pulse'])}),
    Object.freeze({source:'route pressure / localized gate',types:Object.freeze(['mechanical']),examples:Object.freeze(['Oxygen route pressure','Veil boundary current'])}),
    Object.freeze({source:'expedition challenge environment',types:Object.freeze(['mechanical','thermal']),examples:Object.freeze(['pulse pressure','curve shear','thermal challenge'])}),
    Object.freeze({source:'route current / vortex',types:Object.freeze(['mechanical']),examples:Object.freeze(['H/C revisit current','Oxygen vortex'])}),
    Object.freeze({source:'thermal environment',types:Object.freeze(['thermal']),examples:Object.freeze(['Oxygen thermal route','shared thermal belt','frontier thermal wall'])}),
  ]),
  agents:Object.freeze([
    Object.freeze({source:'Dust Eater',owner:'engine.js',reason:'autonomous pursuing agent; never an environmental hazard'}),
  ]),
  structures:Object.freeze([
    Object.freeze({source:'route geometry / authored landmark',reason:'world structure only'}),
    Object.freeze({source:'resource dust / carbon cluster',reason:'collectible or world object; particulate appearance alone is not abrasive hazard'}),
    Object.freeze({source:'Rare Survey anomaly',reason:'finite authored collectible; not a hazard'}),
  ]),
  progressionMechanisms:Object.freeze([
    Object.freeze({source:'Normal/Critical Insight signal',reason:'knowledge/progression marker'}),
    Object.freeze({source:'route unlock / destination / challenge passage',reason:'progression state and telemetry'}),
    Object.freeze({source:'pickup / return settlement',reason:'resource lifecycle'}),
  ]),
});

export const PRODUCTION_HAZARD_FAMILIES=Object.freeze([
  Object.freeze({family:'pressure',type:HAZARD_TYPES.MECHANICAL,subtype:'pressure'}),
  Object.freeze({family:'shear',type:HAZARD_TYPES.MECHANICAL,subtype:'shear'}),
  Object.freeze({family:'turbulence',type:HAZARD_TYPES.MECHANICAL,subtype:'turbulence'}),
  Object.freeze({family:'vortex',type:HAZARD_TYPES.MECHANICAL,subtype:'vortex'}),
  Object.freeze({family:'heat',type:HAZARD_TYPES.THERMAL,subtype:'hot-zone'}),
]);


export const HAZARD_WORLD_STATES=Object.freeze({BASE:'base',AWAKENED:'awakened'});
export const HAZARD_WORLD_MULTIPLIERS=Object.freeze({
  base:Object.freeze({mechanical:1,thermal:1,abrasive:1,electrical:1}),
  awakened:Object.freeze({mechanical:1.22,thermal:1.16,abrasive:1.12,electrical:1.14}),
});
export const hazardWorldStateFor=worldAwakened=>worldAwakened===true?HAZARD_WORLD_STATES.AWAKENED:HAZARD_WORLD_STATES.BASE;
export function hazardWorldMultiplier(type,worldState=HAZARD_WORLD_STATES.BASE){if(!VALID_TYPES.has(type))throw new TypeError(`Unknown hazard type: ${type}`);return HAZARD_WORLD_MULTIPLIERS[worldState]?.[type]??1;}
export function effectiveHazardScale(spatial=1,baseIntensity=1,type=HAZARD_TYPES.MECHANICAL,worldState=HAZARD_WORLD_STATES.BASE){return Math.max(0,Number(spatial)||0)*Math.max(0,Number(baseIntensity)||0)*hazardWorldMultiplier(type,worldState);}
export function scaleHazardSampleForWorld(sample,worldState=HAZARD_WORLD_STATES.BASE){if(!sample)return null;const multiplier=hazardWorldMultiplier(sample.type,worldState),scaled={...sample,intensity:clamp01(sample.intensity*multiplier),severity:(sample.severity??0)*multiplier};if(sample.vector)scaled.vector={x:sample.vector.x*multiplier,y:sample.vector.y*multiplier};if(Number.isFinite(sample.heat))scaled.heat=sample.heat*multiplier;return scaled;}
