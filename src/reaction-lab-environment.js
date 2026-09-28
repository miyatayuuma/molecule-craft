// Canonical, viewer-independent Activation Environment state for Reaction Lab.
// This module intentionally knows nothing about chemistry, rendering, or physics.

export const REACTION_LAB_ENVIRONMENT_TOKENS=Object.freeze(['light','heat','acidic','basic']);
export const REACTION_LAB_MEDIUMS=Object.freeze(['neutral','acidic','basic']);

const allowedTokens=new Set(REACTION_LAB_ENVIRONMENT_TOKENS);
const allowedMedia=new Set(REACTION_LAB_MEDIUMS);

export function validateReactionLabEnvironmentState(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('invalid-reaction-lab-environment-state');
  const keys=Object.keys(value).sort();
  if(keys.length!==3||keys[0]!=='heat'||keys[1]!=='light'||keys[2]!=='medium'||typeof value.light!=='boolean'||typeof value.heat!=='boolean'||!allowedMedia.has(value.medium))throw new Error('invalid-reaction-lab-environment-state');
  return true;
}

export function snapshotReactionLabEnvironment(value){
  validateReactionLabEnvironmentState(value);
  return Object.freeze({light:value.light,heat:value.heat,medium:value.medium});
}

export function createDefaultReactionLabEnvironmentState(){
  return Object.freeze({light:false,heat:false,medium:'neutral'});
}

export function validateNormalizedEnvironmentTokens(value){
  if(!(Array.isArray(value)||value instanceof Set))throw new Error('invalid-environment-token-set');
  const tokens=[...value];
  if(tokens.some(token=>typeof token!=='string'||!allowedTokens.has(token)))throw new Error('unknown-environment-token');
  if(new Set(tokens).size!==tokens.length)throw new Error('duplicate-environment-token');
  if(tokens.includes('acidic')&&tokens.includes('basic'))throw new Error('mutually-exclusive-ph-conditions');
  return true;
}

export function environmentTokensFromSnapshot(value){
  validateReactionLabEnvironmentState(value);
  const tokens=[];
  if(value.light)tokens.push('light');
  if(value.heat)tokens.push('heat');
  if(value.medium==='acidic')tokens.push('acidic');
  if(value.medium==='basic')tokens.push('basic');
  return new Set(tokens);
}

export function reactionLabEnvironmentStateFromTokens(value){
  validateNormalizedEnvironmentTokens(value);
  const tokens=new Set(value);
  return snapshotReactionLabEnvironment({light:tokens.has('light'),heat:tokens.has('heat'),medium:tokens.has('acidic')?'acidic':tokens.has('basic')?'basic':'neutral'});
}

export function enumerateCanonicalReactionLabEnvironments(){
  const states=[];
  for(const light of [false,true])for(const heat of [false,true])for(const medium of REACTION_LAB_MEDIUMS){
    const snapshot=snapshotReactionLabEnvironment({light,heat,medium});
    states.push(Object.freeze({snapshot,tokens:Object.freeze([...environmentTokensFromSnapshot(snapshot)])}));
  }
  return Object.freeze(states);
}

export function createReactionLabEnvironment(initialState=createDefaultReactionLabEnvironmentState()){
  let state=snapshotReactionLabEnvironment(initialState);
  const set=(next)=>{state=snapshotReactionLabEnvironment(next);return state;};
  return Object.freeze({
    snapshot:()=>state,
    setLight:value=>{if(typeof value!=='boolean')throw new Error('light-state-must-be-boolean');return set({...state,light:value});},
    toggleLight:()=>set({...state,light:!state.light}),
    setHeat:value=>{if(typeof value!=='boolean')throw new Error('heat-state-must-be-boolean');return set({...state,heat:value});},
    toggleHeat:()=>set({...state,heat:!state.heat}),
    setMedium:value=>{if(!allowedMedia.has(value))throw new Error('invalid-reaction-lab-medium');return set({...state,medium:value});},
    setFromConditionTokens:value=>set(reactionLabEnvironmentStateFromTokens(value)),
    conditions:()=>environmentTokensFromSnapshot(state),
  });
}
