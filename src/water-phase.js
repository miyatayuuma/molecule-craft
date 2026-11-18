// Heights are display volumes in a constant bore. Condensed volumes and compliance
// are enlarged for the hand-operated model; neither is a measured specific volume.
export const REST = 7.6, HIGH = 14.45, LOW = 1.7;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi,x));
const liquidHeight = 1.82, iceHeight = 1.98;
const compliance = .018, gripTravel = .95;
const gasVolume = t => REST * (273.15+t)/433.15;

// IAPWS SR1-86 saturation pressure (Eq. 1), https://iapws.org/relguide/Supp-sat.html
export function saturation(t) {
  const k = Math.max(273.16,t+273.15), x = 1-k/647.096;
  const series = -7.85951783*x + 1.84408259*x**1.5 - 11.7866497*x**3
    + 22.6807411*x**3.5 - 15.9618719*x**4 + 1.80122502*x**7.5;
  return 22.064/.101325*Math.exp(647.096/k*series);
}
// Invert once per pressure change, interpolating a quarter-degree table.
const curve = Array.from({length:241},(_,i)=>saturation(80+i/4));
export function boiling(p) {
  let a=0,b=curve.length-1;
  while(b-a>1){const mid=(a+b)>>1;if(curve[mid]<p)a=mid;else b=mid;}
  return 80+(a+(p-curve[a])/(curve[b]-curve[a]))/4;
}
const denseVolume = s => liquidHeight+(iceHeight-liquidHeight)*s.ice;
export function heightOf(s) {
  return (1-s.vapor)*(denseVolume(s)-compliance*(s.pressure-1)) +
    s.vapor*gasVolume(s.temperature)/s.pressure;
}
export function createSample() {
  return {temperature:160,setting:160,pressure:1,vapor:1,ice:0,height:REST,stroke:0,velocity:0};
}
// Finger travel below the bubble point mostly loads the piston spring. In the
// two-phase interval, volume is shared by the liquid and saturated vapor.
function movePiston(s, delta) {
  const sat=saturation(s.temperature), edge=clamp(sat,.5,3);
  const liquid=denseVolume(s)-compliance*(edge-1);
  const vapor=gasVolume(s.temperature)/edge;
  const stroke=heightOf(s)-gripTravel*Math.max(0,s.pressure-edge)*(1-s.vapor)+delta;
  if(sat>3 && s.ice===0){
    s.vapor=1; s.pressure=clamp(gasVolume(s.temperature)/clamp(stroke,2.78*clamp((s.temperature-130)/30,.65,1),HIGH),.5,3);
  }else if(sat<.5 || stroke<liquid){
    s.vapor=0; s.pressure=clamp(edge+(liquid-stroke)/(gripTravel+compliance),edge,3);
  }else if(stroke<=vapor){
    s.pressure=edge; s.vapor=clamp((stroke-liquid)/(vapor-liquid),0,1);
  }else{
    s.vapor=1; s.pressure=clamp(gasVolume(s.temperature)/Math.min(stroke,HIGH),.5,edge);
  }
}
const approach=(x,goal,step)=>x+clamp(goal-x,-step,step);
export function advanceSample(s,dt) {
  // A freely loaded piston follows thermal contraction. Above 140 C retain the
  // P0 fixed-volume response when the temperature dial stays in its original range.
  const before=heightOf(s), hot=s.temperature>=140 && s.setting>=140;
  const bp=boiling(s.pressure), heating=s.setting>s.temperature+.0001;
  const cooling=s.setting<s.temperature-.0001;
  if(heating && s.ice>0 && s.temperature>=0){
    s.ice=approach(s.ice,0,.66*dt);
  }else if(cooling && s.ice<1 && s.temperature<=0){
    s.ice=approach(s.ice,1,.66*dt);
  }else if(heating && s.vapor<1 && s.temperature>=bp-.0002){
    s.vapor=approach(s.vapor,1,.43*dt);
  }else if(cooling && s.vapor>0 && s.temperature<=bp+.0002){
    s.vapor=approach(s.vapor,0,.43*dt);
  }else{
    let goal=s.setting;
    if(heating && s.ice>0)goal=Math.min(goal,0);
    else if(cooling && s.vapor>0)goal=Math.max(goal,bp);
    else if(heating && s.vapor<1)goal=Math.min(goal,bp);
    else if(cooling && s.ice<1)goal=Math.max(goal,0);
    s.temperature=approach(s.temperature,goal,95*dt);
  }
  if(hot && s.vapor===1)s.pressure=clamp(gasVolume(s.temperature)/before,.5,3);
  // Take up finger displacement with the P0 damped response; discard force at stops.
  s.velocity+=(850*s.stroke-50*s.velocity)*dt;
  const travel=clamp(s.velocity,-40,40)*dt;
  s.stroke-=travel;
  if(Math.abs(travel)>1e-7)movePiston(s,travel);
  if(heightOf(s)>HIGH)s.pressure=gasVolume(s.temperature)/HIGH;
  s.height=heightOf(s);
}
