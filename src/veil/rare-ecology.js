import {ELEMENT_PRESENTATION} from '../element-progression.js?v=37';

const freeze=value=>Object.freeze(value);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const ELEMENT_COLOR=Object.fromEntries(ELEMENT_PRESENTATION.map(item=>[item.symbol,item.color]));

export const RARE_ECOLOGY_WORLD_SEED=0x5245434f;
export const RARE_ECOLOGY_ELEMENTS=Object.freeze(['P','S','F','Cl']);
export const RARE_ECOLOGY_AREA_CONFIG=Object.freeze({
  veil:freeze({element:'P',primaryElement:'H',baseDensity:.0095,maxReplacementFraction:.04}),
  carbon:freeze({element:'S',primaryElement:'C',baseDensity:.05,maxReplacementFraction:.09}),
  oxygen:freeze({element:'F',primaryElement:'O',baseDensity:.012,maxReplacementFraction:.04}),
  nitrogen:freeze({element:'Cl',primaryElement:'N',baseDensity:.045,maxReplacementFraction:.07}),
});
const TREATMENT_RESERVE_BANDS=Object.freeze([freeze({below:1,multiplier:1}),freeze({below:2,multiplier:.85}),freeze({below:3,multiplier:.55}),freeze({below:4,multiplier:.20}),freeze({below:Infinity,multiplier:.05})]);
export const RARE_ECOLOGY_SUPPRESSION=Object.freeze({
  P:freeze({atomsPerTreatment:2,densityFloor:.05,bands:TREATMENT_RESERVE_BANDS}),
  S:freeze({atomsPerTreatment:2,densityFloor:.05,bands:TREATMENT_RESERVE_BANDS}),
  F:freeze({atomsPerTreatment:4,densityFloor:.05,bands:TREATMENT_RESERVE_BANDS}),
  Cl:freeze({reserveTarget:8,suppressionOnset:5,densityFloor:.07,curve:2.0}),
});
export const RARE_ECOLOGY_VISUALS=Object.freeze({
  P:freeze({sprite:'rare-p',color:ELEMENT_COLOR.P,rgb:'249,115,22'}),
  S:freeze({sprite:'rare-s',color:ELEMENT_COLOR.S,rgb:'234,179,8'}),
  F:freeze({sprite:'rare-f',color:ELEMENT_COLOR.F,rgb:'34,197,94'}),
  Cl:freeze({sprite:'rare-cl',color:ELEMENT_COLOR.Cl,rgb:'22,163,74'}),
});

const AREA_BY_ELEMENT=Object.freeze(Object.fromEntries(Object.entries(RARE_ECOLOGY_AREA_CONFIG).map(([area,config])=>[config.element,area])));
const stableKey=({area,route,index,lane=0})=>`${area}:${route}:${index}:${lane}`;
function hashUnit(key,seed=RARE_ECOLOGY_WORLD_SEED){
  let h=seed>>>0;for(let i=0;i<key.length;i++){h^=key.charCodeAt(i);h=Math.imul(h,16777619);}h^=h>>>16;return(h>>>0)/4294967296;
}
export function rareEcologyAreaForElement(element){return AREA_BY_ELEMENT[element]??null;}
export function rareEcologyTreatmentReserve(element,held=0){const config=RARE_ECOLOGY_SUPPRESSION[element],amount=Math.max(0,Number(held)||0);return config?.atomsPerTreatment?amount/config.atomsPerTreatment:null;}
export function rareEcologyInventoryMultiplier(element,held=0){
  const config=RARE_ECOLOGY_SUPPRESSION[element];if(!config)return 0;
  const amount=Math.max(0,Number(held)||0);
  if(config.atomsPerTreatment){const reserve=amount/config.atomsPerTreatment,band=config.bands.find(item=>reserve<item.below)??config.bands.at(-1);return Math.max(config.densityFloor,band?.multiplier??config.densityFloor);}
  if(amount<=config.suppressionOnset)return 1;
  const span=Math.max(1,config.reserveTarget-config.suppressionOnset),excess=(amount-config.suppressionOnset)/span;
  return config.densityFloor+(1-config.densityFloor)/(1+excess**config.curve);
}
export function rareEcologyAvailability(element,held=0){
  const area=rareEcologyAreaForElement(element),areaConfig=area&&RARE_ECOLOGY_AREA_CONFIG[area];
  return areaConfig?areaConfig.baseDensity*rareEcologyInventoryMultiplier(element,held):0;
}
export function rareEcologyTargetCount(element,candidateCount,held=0){
  const count=Math.max(0,Math.floor(candidateCount)),area=rareEcologyAreaForElement(element),config=area&&RARE_ECOLOGY_AREA_CONFIG[area];
  if(!count||!config)return 0;
  const nominal=Math.max(1,Math.round(count*rareEcologyAvailability(element,held))),ceiling=Math.max(1,Math.floor(count*config.maxReplacementFraction));
  return Math.min(ceiling,nominal);
}
export function registerResourceSocket(map,{area,route,index,lane=0,x,y,angle=-Math.PI/2,element}={}){
  const config=RARE_ECOLOGY_AREA_CONFIG[area];if(!map||!config||element!==config.primaryElement||!Number.isFinite(index)||!Number.isFinite(x)||!Number.isFinite(y))return null;
  const key=stableKey({area,route,index,lane}),socket={key,area,route,index,lane,x,y,angle,element};
  map.resourceSockets??=[];map.resourceSockets.push(socket);return socket;
}
function replaceSocketDust(map,socket,element,rank,candidateCount,baseStock){
  let dust=map.dust.find(item=>item.resourceSocketKey===socket.key);
  if(!dust){dust={id:map.dust.length,x:socket.x,y:socket.y,angle:socket.angle,route:socket.route,element:socket.element,kind:'normal',value:1,ready:0,resourceSocketKey:socket.key};map.dust.push(dust);}
  dust.x=socket.x;dust.y=socket.y;dust.baseX=socket.x;dust.baseY=socket.y;dust.angle=socket.angle;dust.element=element;dust.kind='rare-element';dust.value=1;dust.ready=0;
  dust.rareEcology=true;dust.rareEcologyArea=socket.area;dust.rareEcologyKey=socket.key;dust.rareEcologyRank=rank;dust.rareEcologyCandidateCount=candidateCount;dust.rareEcologyBaseStock=baseStock;
  delete dust.flow;delete dust.vortex;return dust;
}
export function applyRareEcology(map,stock={},{eligible=false}={}){
  const diagnostics={eligible:eligible===true,worldSeed:RARE_ECOLOGY_WORLD_SEED,areas:{}};
  const sockets=Array.isArray(map?.resourceSockets)?map.resourceSockets:[];
  for(const [area,config] of Object.entries(RARE_ECOLOGY_AREA_CONFIG)){
    const candidates=sockets.filter(socket=>socket.area===area&&socket.element===config.primaryElement).map(socket=>({...socket,roll:hashUnit(socket.key)})).sort((a,b)=>a.roll-b.roll||a.key.localeCompare(b.key));
    const held=Math.max(0,Number(stock?.[config.element])||0),multiplier=rareEcologyInventoryMultiplier(config.element,held),target=eligible?rareEcologyTargetCount(config.element,candidates.length,held):0;
    diagnostics.areas[area]={element:config.element,primaryElement:config.primaryElement,candidates:candidates.length,selected:target,baseDensity:config.baseDensity,maxReplacementFraction:config.maxReplacementFraction,held,treatmentReserve:rareEcologyTreatmentReserve(config.element,held),multiplier};
    if(!eligible)continue;for(let rank=0;rank<target;rank++)replaceSocketDust(map,candidates[rank],config.element,rank,candidates.length,held);
  }
  map.rareEcology=diagnostics;return map;
}
export function rareEcologySocketState(dust,cargo={},baseRespawnSeconds=45){
  if(!dust?.rareEcology||!RARE_ECOLOGY_ELEMENTS.includes(dust.element))return null;
  const held=Math.max(0,Number(dust.rareEcologyBaseStock)||0)+Math.max(0,Number(cargo?.[dust.element])||0),multiplier=rareEcologyInventoryMultiplier(dust.element,held),target=rareEcologyTargetCount(dust.element,dust.rareEcologyCandidateCount,held),active=(dust.rareEcologyRank??Infinity)<target;
  return {element:dust.element,held,multiplier,target,active,respawnSeconds:baseRespawnSeconds/Math.max(.2,multiplier)};
}
