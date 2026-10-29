export function selectFrontierCandidate(candidates,{rng}={}){
  if(!Array.isArray(candidates)||!candidates.length)return null;
  const eligible=candidates.filter(candidate=>candidate&&typeof candidate.id==='string'&&Number.isFinite(candidate.weight)&&candidate.weight>0).sort((a,b)=>a.id.localeCompare(b.id));
  if(!eligible.length)return null;if(eligible.length===1)return eligible[0];if(typeof rng!=='function')return null;
  const total=eligible.reduce((sum,candidate)=>sum+candidate.weight,0);if(!Number.isFinite(total)||total<=0)return null;
  let roll=Number(rng());if(!Number.isFinite(roll))roll=0;roll=Math.max(0,Math.min(1-Number.EPSILON,roll))*total;
  for(const candidate of eligible){roll-=candidate.weight;if(roll<0)return candidate;}
  return eligible.at(-1)??null;
}
export function createSeededFrontierRng(seed=1){
  let state=Number.isFinite(seed)?seed|0:1;
  return()=>{state|=0;state=state+0x6D2B79F5|0;let t=Math.imul(state^state>>>15,1|state);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
}
