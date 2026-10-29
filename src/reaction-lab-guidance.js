import {planVisiblePopulation} from './reaction-lab-core.js?v=13';

// Guidance never changes the rack, environment, or success history.
export function compileReactionGuide(entry,records){
  if(!entry)return {ok:false,reason:'レシピが見つかりません。'};
  const d=entry.definition,units=entry.kind==='normal'?d.reactants.map(r=>r.species):d.representativeSequence;
  const species=[...new Set(units)],ids=new Set(records.map(r=>r.id));
  if(!units.length||species.length>3||species.some(id=>!ids.has(id)))return {ok:false,reason:'このレシピの材料を表示できません。'};
  const population=planVisiblePopulation(species),counts=Object.fromEntries(species.map(id=>[id,units.filter(x=>x===id).length]));
  if(species.some(id=>population.filter(x=>x.species===id).length<counts[id]))return {ok:false,reason:'現在のFEEDでは必要な材料数を用意できません。'};
  const env=entry.kind==='normal'?d:d.environment;
  return {ok:true,reactionId:entry.reactionId,kind:entry.kind,species,counts,requires:env?.requires??[],forbids:env?.forbids??[]};
}
export function evaluateReactionGuide(guide,{slots=[],activeSlots=[],phase='IDLE',environment={},isKnown=()=>true}={}){
  if(!guide?.ok)return {stage:'blocked',reason:guide?.reason??'レシピが見つかりません。'};
  const active=slots.filter(Boolean),missing=guide.species.filter(id=>!active.includes(id)),extra=active.filter(id=>!guide.species.includes(id));
  const locked=guide.species.find(id=>!isKnown(id));if(locked)return {stage:'blocked',species:locked,reason:'必要な分子を先に図鑑で発見してください。'};
  if(extra.length){const index=slots.indexOf(extra[0]);return {stage:'remove',index,species:extra[0]};}
  if(missing.length){const index=slots.findIndex(id=>!id);return {stage:'material',index,species:missing[0],count:guide.counts[missing[0]]};}
  const tokens=new Set([...(environment.light?['light']:[]),...(environment.heat?['heat']:[]),...(environment.medium&&environment.medium!=='neutral'?[environment.medium]:[])]);
  const needed=guide.requires.find(token=>!tokens.has(token));if(needed)return {stage:'condition',token:needed,enable:true};
  const forbidden=guide.forbids.find(token=>tokens.has(token));if(forbidden)return {stage:'condition',token:forbidden,enable:false};
  if(phase==='FLUSHING'||phase==='FEEDING')return {stage:'waiting'};
  const selected=activeSlots.filter(Boolean),same=selected.length===guide.species.length&&guide.species.every(x=>selected.includes(x));
  if(phase==='ACTIVE'&&same)return {stage:'react'};
  return {stage:'feed'};
}
