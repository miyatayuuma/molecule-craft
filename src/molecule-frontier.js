import {FRONTIER_WEIGHTING} from './molecule-frontier-weighting.js';
export {FRONTIER_WEIGHTING,scoreFrontierCandidates} from './molecule-frontier-weighting.js';
export {selectFrontierCandidate,createSeededFrontierRng} from './molecule-frontier-selection.js';

const REGION_NAMES=Object.freeze({H:'Hydrogen',C:'Carbon',O:'Oxygen',D:'Deep',F:'Frontier'});
function ids(value){if(typeof value==='string')return new Set([value]);if(value==null)return new Set();try{return new Set([...value].filter(id=>typeof id==='string'&&id));}catch{return new Set();}}
const sorted=value=>[...ids(value)].sort((a,b)=>a.localeCompare(b));
const validGraph=graph=>!!graph&&Array.isArray(graph.nodes)&&typeof graph.nodeById==='function'&&typeof graph.getNeighbors==='function';
function neighbors(graph,id){try{return sorted(graph.getNeighbors(id)??[]).filter(next=>graph.nodeById(next));}catch{return [];}}
const decode=(table,code)=>typeof table?.[code]==='string'?table[code]:null;
function branches(graph,node){return Array.isArray(node?.branchCodes)?[...new Set(node.branchCodes.map(code=>decode(graph.branchCodes,code)).filter(Boolean))].sort((a,b)=>a.localeCompare(b)):[];}
function affinities(value){const out={};if(typeof value!=='string')return out;for(const item of value.split(',')){const match=/^([HCODF])((?:1|0?(?:\.\d+)?))$/.exec(item.trim());if(match)out[REGION_NAMES[match[1]]]=Math.max(0,Math.min(1,Number(match[2])));}return out;}
function metadata(graph,id,discovered){const node=graph.nodeById(id);if(!node)return null;const adjacent=neighbors(graph,id);return Object.freeze({id,depth:Number.isInteger(node.depth)&&node.depth>=0?node.depth:0,tier:Number.isInteger(node.tier)&&node.tier>=0?node.tier:0,family:decode(graph.familyCodes,node.familyCode),branchKeys:Object.freeze(branches(graph,node)),regionAffinities:Object.freeze(affinities(node.affinities)),directDiscoveredNeighbors:Object.freeze(adjacent.filter(next=>discovered.has(next))),directUndiscoveredNeighbors:Object.freeze(adjacent.filter(next=>!discovered.has(next))),baseWeight:FRONTIER_WEIGHTING.baseWeight});}
export function getFrontierCandidates(graph,{discoveredIds=[],knownRecipeIds=[]}={}){if(!validGraph(graph))return Object.freeze([]);const discovered=new Set(sorted(discoveredIds).filter(id=>graph.nodeById(id))),known=ids(knownRecipeIds),found=new Set();for(const id of [...discovered].sort((a,b)=>a.localeCompare(b)))for(const next of neighbors(graph,id))if(!discovered.has(next)&&!known.has(next))found.add(next);return Object.freeze([...found].sort((a,b)=>a.localeCompare(b)).map(id=>metadata(graph,id,discovered)).filter(Boolean));}
