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

// CoolProp 8.0.0, HEOS Methane. For i=0..50:
// PropsSI('T','P',101325*(0.5+i*0.05),'Q',0,'Methane') - 273.15 (deg C).
const methaneTemperatures = [-169.275133, -168.272975, -167.33983, -166.465603, -165.642329, -164.863604, -164.124197, -163.419775, -162.74671, -162.101926, -161.482795, -160.887051, -160.312727, -159.758101, -159.22166, -158.702063, -158.19812, -157.708766, -157.233043, -156.770093, -156.319135, -155.879462, -155.45043, -155.031451, -154.621987, -154.221541, -153.829659, -153.445919, -153.069933, -152.70134, -152.339804, -151.985013, -151.636677, -151.294523, -150.958298, -150.627764, -150.302697, -149.982887, -149.668136, -149.358258, -149.053078, -148.75243, -148.456155, -148.164107, -147.876145, -147.592134, -147.311947, -147.035466, -146.762573, -146.493161, -146.227126];
// Span & Wagner (1996), https://doi.org/10.1063/1.555991. Solve for
// T in K at p = 101325*(0.5+i*0.05) Pa by bisection and subtract 273.15.
// ln(p/517950) = (216.592/T)*(-14.740846*x+2.4327015*x^1.9-5.3061778*x^2.9),
// where x = 1 - T/216.592. This grid lies inside the correlation's range.
const carbonDioxideTemperatures = [
  -86.566426, -85.491925, -84.500207, -83.578731, -82.717651, -81.909093, -81.146653, -80.425051,
  -79.739884, -79.087434, -78.464538, -77.868475, -77.296895, -76.747745, -76.219229, -75.709760,
  -75.217930, -74.742488, -74.282310, -73.836390, -73.403818, -72.983769, -72.575498, -72.178321,
  -71.791616, -71.414812, -71.047386, -70.688853, -70.338769, -69.996720, -69.662325, -69.335228,
  -69.015099, -68.701630, -68.394533, -68.093539, -67.798397, -67.508871, -67.224737, -66.945787,
  -66.671826, -66.402666, -66.138134, -65.878064, -65.622299, -65.370691, -65.123099, -64.879391,
  -64.639439, -64.403123, -64.170329
];

function vaporBoundary(temperatures){
  const min=.5, increment=.05, last=temperatures.length-1;
  return {
    vaporTemperature(p){
      const index=Math.max(0,Math.min(last,(p-min)/increment));
      const i=Math.min(last-1,Math.floor(index));
      return temperatures[i]+(index-i)*(temperatures[i+1]-temperatures[i]);
    },
    saturation(t){
      if(t<temperatures[0])return 0;
      if(t>temperatures[last])return Infinity;
      let lo=0, hi=last;
      while(hi-lo>1){
        const mid=(lo+hi)>>1;
        if(temperatures[mid]<t)lo=mid;
        else hi=mid;
      }
      return min+increment*(lo+(t-temperatures[lo])/(temperatures[hi]-temperatures[lo]));
    }
  };
}
// Boundaries in Celsius and atm. All heights, rates, particle counts and scales
// are observation settings. Methane fusion rounded to the nearest half degree
// (NIST WebBook, CAS 74-82-8). Solid/liquid density at 90 K: 0.492/0.452
// g/cm³ (https://doi.org/10.1364/AO.33.008306).
export const profiles={
  water:{melt:0,vaporTemperature:boiling,saturation, min:-30,max:200,step:1,start:160,rate:62,
    solidHeight:2.15,liquidHeight:1.98,count:72,hz:20,scale:.215/.9572,skin:.28,
    lattice:'ice', donorFrame:true, iceLabels:true,fixedVolumeFrom:140,torqueGain:.64,forceGain:.48},
  methane:{melt:-182.5,...vaporBoundary(methaneTemperatures),
    min:-200,max:-100,step:.5,start:-120,rate:18,solidHeight:1.98*.452/.492,liquidHeight:1.98,
    count:60,hz:10,scale:.18,skin:.28,lattice:'fcc',fixedVolumeFrom:Infinity,torqueGain:.28,forceGain:.32},
  'carbon-dioxide':{sublimes:true,...vaporBoundary(carbonDioxideTemperatures),
    min:-110,max:0,step:.5,start:-40,rate:22,holdAtDisplayedBoundary:true,
    solidHeight:1.96,count:64,scale:.225,skin:.37,lattice:'dry-ice',orderedLattice:true,fixedVolumeFrom:Infinity}
};
