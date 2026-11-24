import {saturationTemperatures} from './phase-saturation-temperatures.js';

// Near-fusion densities, g/cm³. Solid densities are from the referenced unit
// cells where available. Chamber volumes use only their ratio.
const densities={
  'n-butane':[.735,.81], benzene:[.894,1.00], cyclohexane:[.791,.845],
  oxygen:[1.306,1.32], chlorine:[1.744,2.04], nitrogen:[.867,.94],
  hydrogen:[.0770,.088], ammonia:[.734,.85], glycerol:[1.261,1.37]
};

// Geometry, animation rates and fill are independent of the physical data.
const observations={
  'n-butane':{melt:-138.25,min:-151,max:42,step:.25,start:25,rate:55,
    count:44,bore:3.52,liquidHeight:2.17,scale:.178,skin:.56,crystalScale:.155,lattice:'butane',torsion:true},
  benzene:{melt:5.5,min:-10,max:135,step:.1,start:100,rate:38,
    count:44,bore:3.56,liquidHeight:2.38,poolDepth:1.43,scale:.183,skin:.56,crystalScale:.179,lattice:'benzene'},
  cyclohexane:{melt:6.5,min:-25,max:137,step:.1,start:100,rate:42,
    count:44,bore:3.65,liquidHeight:2.65,poolDepth:1.70,scale:.19,skin:.55,lattice:'cyclohexane',solidRotation:.86},
  oxygen:{melt:-218.8,min:-227,max:-164,step:.1,start:-180,rate:15,
    count:104,bore:3.20,liquidHeight:2.03,scale:.245,skin:.30,crystalScale:.205,lattice:'oxygen',solidRotation:1.15},
  chlorine:{melt:-101,min:-116,max:12,step:.25,start:-24,rate:26,
    count:78,bore:3.28,liquidHeight:2.19,scale:.193,skin:.39,crystalScale:.175,lattice:'chlorine'},
  nitrogen:{melt:-210,min:-227,max:-172,step:.1,start:-180,rate:15,
    count:112,bore:3.20,liquidHeight:2.25,scale:.246,skin:.30,crystalScale:.210,lattice:'nitrogen',solidRotation:.82},
  hydrogen:{melt:-259.2,min:-263,max:-244,step:.1,start:-247,rate:4.2,
    count:124,bore:3.20,liquidHeight:2.07,scale:.32,skin:.235,crystalScale:.176,lattice:'hydrogen',solidRotation:1.35},
  ammonia:{melt:-77.7,min:-91,max:6,step:.1,start:-22,rate:23,
    count:70,bore:3.28,liquidHeight:2.04,scale:.215,skin:.36,crystalScale:.205,lattice:'ammonia',
    hz:10,interactionRange:8,torqueGain:.32,forceGain:.20},
  glycerol:{melt:18,min:-5,max:100,step:.1,start:24,rate:23,
    count:40,bore:3.60,liquidHeight:2.66,poolDepth:1.71,scale:.181,skin:.58,crystalScale:.172,lattice:'glycerol',
    liquidOnlyRange:true, viscous:true}
};

export function additionalPhaseProfiles(vaporBoundary){
  return Object.fromEntries(Object.entries(observations).map(([id,observation])=>{
    const [liquidDensity,solidDensity]=densities[id];
    const boundary=observation.liquidOnlyRange
      ? {vaporTemperature:()=>Infinity,saturation:()=>0}
      : vaporBoundary(saturationTemperatures[id]);
    return [id,{
      ...observation,...boundary,compactRendering:true,orderedLattice:true,
      holdAtDisplayedBoundary:true,fixedVolumeFrom:Infinity,
      solidHeight:observation.liquidHeight*liquidDensity/solidDensity
    }];
  }));
}

// Segur & Oberstar (1951), pure glycerol, dynamic viscosity in mPa·s.
// Interpolate in log space and compress the contrast for the observation timescale.
const viscosity=[1410,612,284,142,81.3,50.6,31.9,21.3,14.8];
export function glycerolMobility(temperature){
  const index=Math.max(0,Math.min((temperature-20)/10,viscosity.length-1));
  const i=Math.min(Math.floor(index),viscosity.length-2);
  const value=viscosity[i]*(viscosity[i+1]/viscosity[i])**(index-i);
  return (14.8/value)**.36;
}
