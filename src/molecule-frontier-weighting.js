export const FRONTIER_WEIGHTING=Object.freeze({baseWeight:1,shallowBonus:.16,unexploredBranchBonus:.28,regionAffinityBonus:.25});
const REGION_ALIASES=new Map([
  ['h','Hydrogen'],['hydrogen','Hydrogen'],['veil','Hydrogen'],['h veil','Hydrogen'],
  ['c','Carbon'],['carbon','Carbon'],['carbon drift','Carbon'],
  ['o','Oxygen'],['oxygen','Oxygen'],['oxygen surge','Oxygen'],
  ['d','Deep'],['deep','Deep'],
  ['f','Frontier'],['frontier','Frontier'],['inner horizon','Frontier'],
]);
function ids(value){if(typeof value==='string')return new Set([value]);if(value==null)return new Set();try{return new Set([...value].filter(id=>typeof id==='string'&&id));}catch{return new Set();}}
const sorted=value=>[...ids(value)].sort((a,b)=>a.localeCompare(b));
const decode=(table,code)=>typeof table?.[code]==='string'?table[code]:null;
function branches(graph,node){return Array.isArray(node?.branchCodes)?[...new Set(node.branchCodes.map(code=>decode(graph.branchCodes,code)).filter(Boolean))]:[];}
function branchProgress(graph,candidates,discovered){
  const visible=[...new Set(candidates.flatMap(candidate=>Array.isArray(candidate?.branchKeys)?candidate.branchKeys:[]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  const counts=new Map(visible.map(key=>[key,0]));if(!visible.length)return {counts,min:0,max:0};
  for(const id of discovered){const node=graph.nodeById(id);if(!node)continue;for(const key of branches(graph,node))if(counts.has(key))counts.set(key,counts.get(key)+1);}
  const values=[...counts.values()];return {counts,min:Math.min(...values),max:Math.max(...values)};
}
const shallowFactor=depth=>1+FRONTIER_WEIGHTING.shallowBonus/Math.max(1,Number.isFinite(depth)?Math.max(0,depth):1);
function unexploredFactor(candidate,progress){
  const keys=Array.isArray(candidate?.branchKeys)?candidate.branchKeys:[];if(!keys.length||progress.max===progress.min)return {factor:1,branches:[]};
  const span=progress.max-progress.min,rows=keys.map(branchKey=>{const discoveredCount=progress.counts.get(branchKey)??progress.max;return {branchKey,discoveredCount,relativeUnexplored:(progress.max-discoveredCount)/span};});
  const relative=rows.reduce((sum,row)=>sum+row.relativeUnexplored,0)/rows.length;
  return {factor:1+FRONTIER_WEIGHTING.unexploredBranchBonus*relative,branches:rows};
}
function canonicalRegion(region){return typeof region==='string'?REGION_ALIASES.get(region.trim().toLowerCase())??null:null;}
function regionFactor(candidate,region){const canonical=canonicalRegion(region),raw=canonical?candidate?.regionAffinities?.[canonical]:0,affinity=Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):0;return {factor:1+FRONTIER_WEIGHTING.regionAffinityBonus*affinity,region:canonical,affinity};}
export function scoreFrontierCandidates(graph,candidates,{discoveredIds=[],region=null}={}){
  if(!graph||typeof graph.nodeById!=='function'||!Array.isArray(candidates))return Object.freeze([]);
  const discovered=new Set(sorted(discoveredIds).filter(id=>graph.nodeById(id))),valid=candidates.filter(candidate=>candidate&&typeof candidate.id==='string'&&graph.nodeById(candidate.id)).sort((a,b)=>a.id.localeCompare(b.id)),progress=branchProgress(graph,valid,discovered);
  return Object.freeze(valid.map(candidate=>{
    const baseWeight=Number.isFinite(candidate.baseWeight)&&candidate.baseWeight>0?candidate.baseWeight:FRONTIER_WEIGHTING.baseWeight,shallow=shallowFactor(candidate.depth),unexplored=unexploredFactor(candidate,progress),affinity=regionFactor(candidate,region),product=baseWeight*shallow*unexplored.factor*affinity.factor,weight=Number.isFinite(product)&&product>0?product:baseWeight;
    return Object.freeze({...candidate,baseWeight,weight,weighting:Object.freeze({baseWeight,shallow:Object.freeze({factor:shallow,depth:candidate.depth}),unexploredBranch:Object.freeze({factor:unexplored.factor,branches:Object.freeze(unexplored.branches.map(row=>Object.freeze(row)))}),regionAffinity:Object.freeze(affinity)})});
  }));
}
