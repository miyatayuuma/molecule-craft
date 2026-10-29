export const INSIGHT_DESTINATION_ORDER=Object.freeze(['veil','carbon','oxygen','nitrogen']);
export const INSIGHT_DESTINATION_RESOURCE=Object.freeze({veil:'H',carbon:'C',oxygen:'O',nitrogen:'N'});
export const INSIGHT_DESTINATION_BALANCE_UNIT=Object.freeze({
  // Median atoms collected in 32 deterministic fresh production expeditions.
  // Calibration routes: H saving, C normal, O deep (simulate-expedition.mjs),
  // and a 20-second Nitrogen mainline traverse with available CH4/O2/coolant.
  H:57,
  C:136,
  O:298,
  N:49,
});
export const INSIGHT_DESTINATION_HISTORY_LIMIT=8;
export const INSIGHT_DESTINATION_DEADBAND=.15;
export const INSIGHT_DESTINATION_MAX_RESOURCE_BONUS=1.25;

const destinationSet=new Set(INSIGHT_DESTINATION_ORDER);
const finiteStock=value=>Number.isFinite(value)&&value>0?value:0;

export function normalizeInsightDestinationHistory(value){
  if(!Array.isArray(value))return [];
  return value.filter(destination=>destinationSet.has(destination)).slice(-INSIGHT_DESTINATION_HISTORY_LIMIT);
}

export function recordInsightDestination(history,destination){
  if(!destinationSet.has(destination))return normalizeInsightDestinationHistory(history);
  return [...normalizeInsightDestinationHistory(history),destination].slice(-INSIGHT_DESTINATION_HISTORY_LIMIT);
}

function median(values){
  if(!values.length)return 0;
  const sorted=[...values].sort((a,b)=>a-b),mid=sorted.length>>1;
  return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;
}

export function scoreInsightDestinations({availableDestinations=[],history=[],stocks={}}={}){
  const requestedDestinations=new Set(availableDestinations);
  const available=INSIGHT_DESTINATION_ORDER.filter(destination=>requestedDestinations.has(destination));
  const destinationHistory=normalizeInsightDestinationHistory(history);
  const rawStock=Object.fromEntries(['H','C','O','N'].map(element=>[element,finiteStock(stocks?.[element])]));
  const normalizedStock=Object.fromEntries(['H','C','O','N'].map(element=>[element,rawStock[element]/INSIGHT_DESTINATION_BALANCE_UNIT[element]]));
  const medianCoverage=median(available.map(destination=>normalizedStock[INSIGHT_DESTINATION_RESOURCE[destination]]));
  const lastIndex=new Map();destinationHistory.forEach((destination,index)=>lastIndex.set(destination,index));
  const rotationOrder=[...available].sort((a,b)=>{
    const aLast=lastIndex.has(a)?lastIndex.get(a):-1,bLast=lastIndex.has(b)?lastIndex.get(b):-1;
    return aLast-bLast||INSIGHT_DESTINATION_ORDER.indexOf(a)-INSIGHT_DESTINATION_ORDER.indexOf(b);
  });
  const rotationScoreByDestination=new Map(rotationOrder.map((destination,index)=>[
    destination,rotationOrder.length<=1?1:1-index/(rotationOrder.length-1),
  ]));
  const destinations=available.map(destination=>{
    const element=INSIGHT_DESTINATION_RESOURCE[destination],coverage=normalizedStock[element];
    const rawDeficit=medianCoverage>0?Math.max(0,Math.min(1,(medianCoverage-coverage)/medianCoverage)):0;
    const adjustedDeficit=rawDeficit<=INSIGHT_DESTINATION_DEADBAND?0:Math.max(0,Math.min(1,(rawDeficit-INSIGHT_DESTINATION_DEADBAND)/(1-INSIGHT_DESTINATION_DEADBAND)));
    const rotationScore=rotationScoreByDestination.get(destination)??0,resourceBonus=adjustedDeficit*INSIGHT_DESTINATION_MAX_RESOURCE_BONUS;
    return {destination,element,rawStock:rawStock[element],balanceUnit:INSIGHT_DESTINATION_BALANCE_UNIT[element],normalizedStock:coverage,rotationScore,rawDeficit,adjustedDeficit,resourceDeficit:adjustedDeficit,resourceBonus,score:rotationScore+resourceBonus};
  });
  destinations.sort((a,b)=>b.score-a.score||INSIGHT_DESTINATION_ORDER.indexOf(a.destination)-INSIGHT_DESTINATION_ORDER.indexOf(b.destination));
  return {destinationHistory,availableDestinations:available,rawStock,balanceUnits:INSIGHT_DESTINATION_BALANCE_UNIT,normalizedStock,medianCoverage,rotationOrder,destinations,selectedDestination:destinations[0]?.destination??null};
}
