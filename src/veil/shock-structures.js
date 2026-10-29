// Run-local world structures that can react to a SHOCK wave.  These are
// deliberately separate from Nitrogen Core: Core owns progression and its
// persistent lifecycle, while this module owns optional hazard-source pilots.

export const SHOCK_STRUCTURE_VERSION=1;

export const CARBON_CHARGED_ANCHOR=Object.freeze({
  id:'carbon-charged-anchor',
  kind:'hazard-anchor',
  targetHazard:'carbon-sweep-charged-region',
  route:'carbon-sweep',
  x:660,
  y:-5370,
  radius:44,
  activeWorldState:'awakened',
  postFractureScale:.60,
  fractureDuration:.36,
});

const copyStructure=()=>({...CARBON_CHARGED_ANCHOR,active:true,fractured:false,fracturedAt:null});

export function createShockStructures(worldState='base'){
  return worldState===CARBON_CHARGED_ANCHOR.activeWorldState?[copyStructure()]:[];
}

export function activeShockStructuresFor(map){
  return (map?.shockStructures??[]).filter(structure=>structure?.active===true);
}

export function fractureShockStructures(map,origin,radius,time=0){
  const fractured=[];
  for(const structure of activeShockStructuresFor(map)){
    if(structure.fractured===true||Math.hypot(structure.x-(origin?.x??NaN),structure.y-(origin?.y??NaN))>radius)continue;
    structure.fractured=true;structure.fracturedAt=Number.isFinite(time)?time:0;fractured.push(structure);
  }
  return fractured;
}

export function shockStructureScaleFor(structures,targetHazard){
  for(const structure of structures??[]){
    if(structure?.active===true&&structure.fractured===true&&structure.targetHazard===targetHazard)return structure.postFractureScale;
  }
  return 1;
}
