import {profiles} from './phase-profiles.js';
export {saturation,boiling} from './phase-profiles.js';
// Heights are display volumes in a constant bore. Condensed volumes and compliance
// are enlarged for the hand-operated model; neither is a measured specific volume.
export const REST = 7.6, HIGH = 14.45, LOW = 1.7;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi,x));

const compliance = .018, gripTravel = .95;
const gasVolume = s => REST * (273.15+s.temperature)/(273.15+s.profile.start);

const denseVolume = s => s.profile.sublimes ? s.profile.solidHeight
  : s.profile.liquidHeight+(s.profile.solidHeight-s.profile.liquidHeight)*s.phase.solid;
export function heightOf(s) {
  return s.phase.solid*s.profile.solidHeight+s.phase.liquid*(s.profile.liquidHeight??0)
    -(1-s.phase.gas)*compliance*(s.pressure-1) +
    s.phase.gas*gasVolume(s)/s.pressure;
}
export function createSample(profile=profiles.water) {
  const phase=profile.sublimes
    ? {gas:1,get solid(){return 1-this.gas;},liquid:0}
    : {solid:0,gas:1,get liquid(){return Math.max(0,1-this.solid-this.gas);}};
  return {profile,temperature:profile.start,setting:profile.start,pressure:1,phase,height:REST,stroke:0,velocity:0};
}
// Finger travel below the bubble point mostly loads the piston spring. In the
// two-phase interval, volume is shared by the condensed phase and saturated vapor.
function movePiston(s, delta) {
  const sat=s.profile.saturation(s.temperature), edge=clamp(sat,.5,3);
  const condensed=denseVolume(s)-compliance*(edge-1);
  const vapor=gasVolume(s)/edge;
  const stroke=heightOf(s)-gripTravel*Math.max(0,s.pressure-edge)*(1-s.phase.gas)+delta;
  if(sat>3.00005 && (s.profile.sublimes || s.phase.solid===0)){
    s.phase.gas=1; s.pressure=clamp(gasVolume(s)/clamp(stroke,(Number.isFinite(s.profile.fixedVolumeFrom)?2.78*clamp((s.temperature-130)/30,.65,1):LOW),HIGH),.5,3);
  }else if(sat<.49995 || stroke<condensed){
    s.phase.gas=0; s.pressure=clamp(edge+(condensed-stroke)/(gripTravel+compliance),edge,3);
  }else if(stroke<=vapor){
    s.pressure=edge; s.phase.gas=clamp((stroke-condensed)/(vapor-condensed),0,1);
  }else{
    s.phase.gas=1; s.pressure=clamp(gasVolume(s)/Math.min(stroke,HIGH),.5,edge);
  }
}
const approach=(x,goal,step)=>x+clamp(goal-x,-step,step);
export function advanceSample(s,dt) {
  // A freely loaded piston follows thermal contraction. Above 140 C retain the
  // P0 fixed-volume response when the temperature dial stays in its original range.
  const before=heightOf(s), hot=s.temperature>=s.profile.fixedVolumeFrom && s.setting>=s.profile.fixedVolumeFrom;
  const bp=s.profile.vaporTemperature(s.pressure);
  const setting=s.profile.holdAtDisplayedBoundary && Math.round(bp/s.profile.step)*s.profile.step===s.setting
    ? bp : s.setting;
  const heating=setting>s.temperature+.0001, cooling=setting<s.temperature-.0001;
  // A subliming substance uses the same vapor transition and skips fusion.
  const melts=!s.profile.sublimes;
  if(heating && melts && s.phase.solid>0 && s.temperature>=s.profile.melt){
    s.phase.solid=approach(s.phase.solid,0,.66*dt);
  }else if(cooling && melts && s.phase.solid<1 && s.temperature<=s.profile.melt){
    s.phase.solid=approach(s.phase.solid,1,.66*dt);
  }else if(heating && s.phase.gas<1 && s.temperature>=bp-.0002){
    s.phase.gas=approach(s.phase.gas,1,.43*dt);
  }else if(cooling && s.phase.gas>0 && s.temperature<=bp+.0002){
    s.phase.gas=approach(s.phase.gas,0,.43*dt);
  }else{
    let goal=setting;
    if(heating && melts && s.phase.solid>0)goal=Math.min(goal,s.profile.melt);
    else if(cooling && s.phase.gas>0)goal=Math.max(goal,bp);
    else if(heating && s.phase.gas<1)goal=Math.min(goal,bp);
    else if(cooling && melts && s.phase.solid<1)goal=Math.max(goal,s.profile.melt);
    // Limit how fast the sample catches up to the dial after a plateau.
    // This also limits the actual pressure change in the fixed-volume regime.
    s.temperature=approach(s.temperature,goal,s.profile.rate*dt);
  }
  if(hot && s.phase.gas===1)s.pressure=clamp(gasVolume(s)/before,.5,3);
  // Take up finger displacement with the P0 damped response; discard force at stops.
  s.velocity+=(850*s.stroke-50*s.velocity)*dt;
  const travel=clamp(s.velocity,-40,40)*dt;
  s.stroke-=travel;
  if(Math.abs(travel)>1e-7)movePiston(s,travel);
  if(s.phase.gas===1 && heightOf(s)>HIGH)s.pressure=clamp(gasVolume(s)/HIGH,.5,3);
  s.height=heightOf(s);
}
