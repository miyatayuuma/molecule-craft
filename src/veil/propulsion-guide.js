import {performanceFor,activeTankRolesFor,combustionPacketFor} from './molecule-roles.js';
import {combustionPackets} from './growth.js';
import './equipment-ux.js';

export function expeditionUseFor(id,preferredRole=null){
  const roles=activeTankRolesFor(id),role=roles.includes(preferredRole)?preferredRole:roles[0];
  const propellant=performanceFor(id,'propellant');
  if(role==='propellant')return {role:'propellant',label:'噴射剤',strength:`${Math.round(propellant.burstPower*100)}%の一噴射 · 満載${Math.floor(propellant.capacity/propellant.moleculesPerBurst)}回`,
    good:propellant.burstPower>=.9?'薄く強い逆流を一気に越える。':'弱い逆流を小刻みに越え、採集を重ねる。',
    weakness:propellant.burstPower>=.9?'1回の消費が大きく、反復採集では材料を多く使う。':'強い逆流では押し戻される。'};
  if(role==='fuel')return {role:'fuel',label:'燃料',strength:'O₂と組み合わせて連続航行',good:'持続流の本道を押し進む。',weakness:'長時間の燃焼は発熱する。冷却剤か途中の休止が必要。'};
  if(role==='coolant')return {role:'coolant',label:'冷却剤',strength:'燃焼熱を自動で冷却',good:'燃焼を中断する回数を減らす。',weakness:'単独では推進しない。使い切ると自然冷却が必要。'};
  if(role==='oxidizer')return {role:'oxidizer',label:'酸化剤',strength:'燃料と組み合わせて燃焼',good:'持続流の航行を支える。',weakness:'単独では推進しない。燃料との残量の釣り合いが必要。'};
  return null;
}
export function loadedCombustionSummary(tanks){
  const packet=combustionPacketFor(tanks.fuel?.molecule),seconds=combustionPackets(tanks)*(packet?.seconds??0);
  const cooled=!!performanceFor(tanks.coolant?.molecule,'coolant')&&tanks.coolant.amount>0;
  return {seconds,cooling:cooled?'自動冷却あり':'冷却剤なし · 休止で冷却'};
}
export function expeditionReview(report){
  const summary=`噴射 ${report.burstUses}回 · 燃焼 ${Math.round(report.combustionSeconds)}秒 · 過熱 ${report.overheatEvents}回`;
  const advice=report.overheatEvents>0?'燃焼中に過熱。冷却剤を積むか、途中で燃焼を休めよう。':report.stalledBursts>0?'噴射中も逆流で進めなかった。強い噴射剤か別の流れを試そう。':'';
  return {summary,advice};
}
