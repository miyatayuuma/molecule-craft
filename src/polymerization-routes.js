import { matchReactionSitePattern } from './reaction-lab-core.js?v=13';

export const POLYMERIZATION_ROUTE_SCHEMA_VERSION=1;
export const POLYMERIZATION_BUILDERS=Object.freeze(['chain','step-growth','network']);
export const POLYMERIZATION_TRANSFORM_FAMILIES=Object.freeze(['vinyl','diene','epoxide','ester-condensation','amide-condensation','phenol-methylolation','phenol-methylene-bridge']);
export const POLYMER_PROCESS_SETUP_TOKENS=Object.freeze(['coordination-catalyst','diene-coordination-catalyst','radical-initiation','cationic-initiation','lewis-acid-catalysis','active-cooling','alkoxide-type-initiation','dry-controlled-medium','esterification-polycondensation','amidation-polycondensation','water-removal','resole-base-catalysis','pressure-controlled-process']);
export const POLYMERIZATION_ROUTE_COUNT=25;

const routeIdPattern=/^[a-z0-9][a-z0-9-]*$/;
const sameSet=(a,b)=>a.length===b.length&&new Set(a).size===a.length&&a.every(value=>b.includes(value));
const deepFreeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child);}return value;};
let current=null,loadPromise=null,state={status:'idle',loaded:false,count:0,error:null,source:null};

function assertEnumList(actual,expected,label){if(!Array.isArray(actual)||actual.length!==expected.length||new Set(actual).size!==expected.length||expected.some(value=>!actual.includes(value)))throw new Error(`Invalid ${label} authority.`);}
function validateEnvironment(route){
  const env=route.environment;
  if(!env||!Array.isArray(env.requires)||!Array.isArray(env.forbids)||env.requires.some(token=>!['light','heat','acidic','basic'].includes(token))||env.forbids.some(token=>!['light','heat','acidic','basic'].includes(token))||new Set(env.requires).size!==env.requires.length||new Set(env.forbids).size!==env.forbids.length||env.requires.some(token=>env.forbids.includes(token))||env.requires.includes('acidic')&&env.requires.includes('basic'))throw new Error(`Invalid environment authority: ${route.routeId}`);
}

export function validatePolymerizationRouteAuthority(input,{polymers,molecules}={}){
  if(!input||input.schemaVersion!==POLYMERIZATION_ROUTE_SCHEMA_VERSION||!Array.isArray(input.routes)||!Array.isArray(input.sitePatterns))throw new Error('Invalid polymerization route authority envelope.');
  assertEnumList(input.builders,POLYMERIZATION_BUILDERS,'builder');
  assertEnumList(input.transformFamilies,POLYMERIZATION_TRANSFORM_FAMILIES,'transform-family');
  assertEnumList(input.processSetupTokens,POLYMER_PROCESS_SETUP_TOKENS,'process-token');
  if(input.routes.length!==POLYMERIZATION_ROUTE_COUNT)throw new Error(`Expected ${POLYMERIZATION_ROUTE_COUNT} polymerization routes.`);
  if(!Array.isArray(polymers)||polymers.length!==POLYMERIZATION_ROUTE_COUNT)throw new Error('Polymer chemistry catalog must contain exactly 25 records.');
  const polymersById=new Map(polymers.map(record=>[record.id,record])),moleculesById=new Map((molecules??[]).map(record=>[record.id,record]));
  const patternIds=new Set();
  for(const pattern of input.sitePatterns){
    if(!pattern||typeof pattern.id!=='string'||!routeIdPattern.test(pattern.id)||patternIds.has(pattern.id))throw new Error('Invalid polymer-specific site pattern id.');
    patternIds.add(pattern.id);
    if(!Array.isArray(pattern.atoms)||!pattern.atoms.length||!Array.isArray(pattern.bonds))throw new Error(`Invalid polymer-specific site pattern: ${pattern.id}`);
  }
  if(input.routes.length!==polymersById.size)throw new Error('Polymer routes must own every polymer exactly once.');
  const routesById=new Map(),polymersSeen=new Set(),feedKeys=new Set();
  for(const route of input.routes){
    if(!route||typeof route.routeId!=='string'||!routeIdPattern.test(route.routeId)||routesById.has(route.routeId))throw new Error('Invalid or duplicate polymerization route id.');
    if(!polymersById.has(route.polymerId)||polymersSeen.has(route.polymerId))throw new Error(`Unknown or duplicate polymer route target: ${route.polymerId}`);
    if(!POLYMERIZATION_BUILDERS.includes(route.builder))throw new Error(`Invalid polymer builder: ${route.routeId}`);
    if(!Array.isArray(route.transformFamilies)||!route.transformFamilies.length||route.transformFamilies.some(family=>!POLYMERIZATION_TRANSFORM_FAMILIES.includes(family))||new Set(route.transformFamilies).size!==route.transformFamilies.length)throw new Error(`Invalid transform family: ${route.routeId}`);
    if(!Array.isArray(route.feedSpecies)||!route.feedSpecies.length||route.feedSpecies.some(id=>typeof id!=='string'||!routeIdPattern.test(id))||new Set(route.feedSpecies).size!==route.feedSpecies.length)throw new Error(`Invalid exact Feed set: ${route.routeId}`);
    if(!Array.isArray(route.representativeSequence)||route.representativeSequence.length<2||route.representativeSequence.some(id=>!route.feedSpecies.includes(id))||!sameSet(route.feedSpecies,[...new Set(route.representativeSequence)]))throw new Error(`Representative sequence does not match Feed set: ${route.routeId}`);
    const polymer=polymersById.get(route.polymerId),chemicalFeed=[...new Set(polymer.reactants.map(item=>item.moleculeId))].sort();
    if(!sameSet([...route.feedSpecies].sort(),chemicalFeed))throw new Error(`Route Feed differs from polymer reactants: ${route.routeId}`);
    if(moleculesById.size&&route.feedSpecies.some(id=>!moleculesById.has(id)))throw new Error(`Unknown molecule in polymer Feed: ${route.routeId}`);
    const feedKey=[...route.feedSpecies].sort().join('|');if(feedKeys.has(feedKey))throw new Error(`Polymer exact Feed sets must be unique: ${route.routeId}`);feedKeys.add(feedKey);
    if(!Array.isArray(route.sitePatternIds)||!route.sitePatternIds.length||route.sitePatternIds.some(id=>!patternIds.has(id))||new Set(route.sitePatternIds).size!==route.sitePatternIds.length)throw new Error(`Invalid polymer site-pattern assignment: ${route.routeId}`);
    if(typeof route.processLabel!=='string'||!route.processLabel.trim()||!Array.isArray(route.processSetupTokens)||route.processSetupTokens.some(token=>!POLYMER_PROCESS_SETUP_TOKENS.includes(token))||new Set(route.processSetupTokens).size!==route.processSetupTokens.length)throw new Error(`Invalid process setup: ${route.routeId}`);
    validateEnvironment(route);
    const cadence=route.interactionCadence,evidence=route.completionEvidence;
    if(!cadence||!Number.isInteger(cadence.manualSteps)||cadence.manualSteps<0||!Number.isInteger(cadence.automaticSteps)||cadence.automaticSteps<0||!evidence||!Number.isInteger(evidence.unitCount)||evidence.unitCount<2||cadence.manualSteps+cadence.automaticSteps!==evidence.unitCount-1||!Number.isInteger(evidence.interUnitLinks)||evidence.interUnitLinks<0||!Number.isInteger(evidence.ringOpenings)||evidence.ringOpenings<0||!evidence.byproducts||!Number.isInteger(evidence.byproducts.water)||evidence.byproducts.water<0||!Array.isArray(evidence.requiredFeatures))throw new Error(`Invalid completion evidence: ${route.routeId}`);
    if(route.builder==='network'&&route.presentation?.kind!=='network'||route.builder!=='network'&&route.presentation?.kind==='network')throw new Error(`Builder and presentation disagree: ${route.routeId}`);
    if(!route.presentation||!Array.isArray(route.presentation.qualifiers)||!Array.isArray(route.presentation.continuationMarkers)||route.presentation.continuationMarkers.some(marker=>!['chain-continuation','active-chain-end','network-continuation'].includes(marker)))throw new Error(`Invalid polymer presentation contract: ${route.routeId}`);
    if(moleculesById.size){
      const patterns=input.sitePatterns.filter(pattern=>route.sitePatternIds.includes(pattern.id));
      if(!route.feedSpecies.some(id=>patterns.some(pattern=>matchReactionSitePattern(moleculesById.get(id),pattern).length>0)))throw new Error(`No authored reactive site matches route: ${route.routeId}`);
    }
    routesById.set(route.routeId,deepFreeze({...route,feedSpecies:[...route.feedSpecies],representativeSequence:[...route.representativeSequence]}));polymersSeen.add(route.polymerId);
  }
  if(polymers.some(record=>!polymersSeen.has(record.id)))throw new Error('Polymer route catalog has an unowned polymer.');
  return deepFreeze({schemaVersion:1,builders:[...input.builders],transformFamilies:[...input.transformFamilies],processSetupTokens:[...input.processSetupTokens],sitePatterns:input.sitePatterns.map(pattern=>({...pattern})),routes:[...routesById.values()]});
}

export function setPolymerizationRouteAuthority(input,options={}){
  current=validatePolymerizationRouteAuthority(input,options);state={status:'ready',loaded:true,count:current.routes.length,error:null,source:'direct'};return{ok:true,count:current.routes.length};
}
export function polymerizationRouteStatus(){return{...state};}
export function polymerizationRoutes(){if(!current)throw new Error(`Polymer routes are not ready (${state.status}).`);return current.routes.slice();}
export function polymerizationRoute(id){if(!current)throw new Error(`Polymer routes are not ready (${state.status}).`);return current.routes.find(route=>route.routeId===id)??null;}
export function polymerizationSitePatterns(){if(!current)throw new Error(`Polymer routes are not ready (${state.status}).`);return current.sitePatterns;}
export function resolvePolymerizationRoute(activeSlots){
  if(!current)throw new Error(`Polymer routes are not ready (${state.status}).`);
  const species=activeSlots?.filter(Boolean)??[];
  if(!species.length||new Set(species).size!==species.length)return null;
  const key=[...species].sort().join('|');
  return current.routes.find(route=>[...route.feedSpecies].sort().join('|')===key)??null;
}
export async function loadPolymerizationRouteAuthority({url=new URL('../data/polymerization-routes.json',import.meta.url),polymers,molecules}={}){
  if(loadPromise)return loadPromise;
  state={status:'loading',loaded:false,count:0,error:null,source:null};
  const promise=(async()=>{try{const response=await fetch(url,{cache:'no-store'});if(!response?.ok)throw new Error(`HTTP ${response?.status??'unknown'}`);const input=await response.json();current=validatePolymerizationRouteAuthority(input,{polymers,molecules});state={status:'ready',loaded:true,count:current.routes.length,error:null,source:'network'};return{ok:true,count:current.routes.length};}catch(error){current=null;state={status:'error',loaded:false,count:0,error:String(error?.message??error),source:null};return{ok:false,count:0,error:state.error};}})().finally(()=>{loadPromise=null;});
  loadPromise=promise;return promise;
}
