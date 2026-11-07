import {BOILING_TIMING} from './compare-boiling-cycle.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const between=(x,a,b)=>smooth((x-a)/(b-a));

// Deliberate visual metaphor: a strung bead becomes a *bulk sample* of its
// substance. The bead-to-liquid transition is not a measured melting point.
// All volume/bubble parameters are presentation fractions, not molar volumes.
export function boilingMorph(snapshot){
  if(!snapshot)return {pearl:0,liquid:0,bubbles:0,vapor:0,dish:0,condensation:0};
  const {phase,time=0,opacity=1,recovery=0,recoveryFrom=1}=snapshot;
  // Subliming solids skip the liquid vessel entirely. At 1 atm there is no
  // liquid phase for these entries, even while the bead heats on its pedestal.
  if(snapshot.transition?.kind==='sublimation'){
    if(phase==='heating')return {pearl:1,liquid:0,bubbles:0,vapor:0,dish:0,condensation:0};
    if(phase==='subliming'){
      const t=clamp(time/BOILING_TIMING.boiling);
      return {pearl:1-between(t,.08,1),liquid:0,bubbles:0,
        vapor:between(t,.03,.18)*(1-between(t,.90,1.04)),dish:0,condensation:0};
    }
    if(phase==='evaporated')return {pearl:0,liquid:0,bubbles:0,vapor:0,dish:0,condensation:0};
    if(phase==='recovering')return {pearl:clamp(recoveryFrom+(1-recoveryFrom)*between(recovery/BOILING_TIMING.recovery,.36,1)),
      liquid:0,bubbles:0,vapor:0,dish:0,condensation:0};
  }
  if(phase==='heating'){
    const t=clamp(time/BOILING_TIMING.warmup);
    const liquefied=between(t,.07,.48);
    return {pearl:1-liquefied,liquid:liquefied,bubbles:0,vapor:0,dish:liquefied,condensation:0};
  }
  if(phase==='boiling'){
    const t=clamp(time/BOILING_TIMING.boiling);
    const volume=1-between(t,.20,1);
    return {pearl:0,liquid:volume,bubbles:between(t,0,.13)*(1-between(t,.75,1.01))*Math.min(1,volume*4),
      vapor:between(t,.05,.32)*(1-between(t,.98,1.02)*.7),dish:1,condensation:0};
  }
  if(phase==='evaporated')return {pearl:0,liquid:0,bubbles:0,vapor:0,dish:1,condensation:0};
  if(phase==='recovering'){
    const t=clamp(recovery/BOILING_TIMING.recovery);
    const dispersed=1-clamp(recoveryFrom);
    // The sample first gathers into droplets, then the bead reforms. The
    // off-pedestal condensation is only a ghost effect, never a moving dish.
    const condensed=dispersed*between(t,.03,.4)*(1-between(t,.52,.9));
    const pearl=clamp(recoveryFrom+(1-recoveryFrom)*between(t,.36,1));
    return {pearl,liquid:0,bubbles:0,vapor:0,dish:0,condensation:condensed};
  }
  return {pearl:opacity,liquid:0,bubbles:0,vapor:0,dish:0,condensation:0};
}
