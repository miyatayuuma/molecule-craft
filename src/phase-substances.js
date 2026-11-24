import {saturationTemperatures} from './phase-saturation-temperatures.js';

// Near-fusion densities, g/cm³. Solid densities are from the referenced unit
// cells where available. Chamber volumes use only their ratio.
const densities={
  'n-butane':[.735,.81], benzene:[.894,1.00], cyclohexane:[.791,.845],
  oxygen:[1.306,1.32], chlorine:[1.744,2.04], nitrogen:[.867,.94],
  hydrogen:[.0770,.088], ammonia:[.734,.85], glycerol:[1.261,1.37],
  'p-xylene':[.867,1.096], ethylbenzene:[.969,1.067], toluene:[.975,1.066],
  phenol:[1.058,1.189], 'hydrogen-fluoride':[1.204,1.81], 'hydrogen-chloride':[1.254,1.47],
  propane:[.733,.818], 'ethylene-glycol':[1.136,1.29], 'dimethyl-sulfoxide':[1.102,1.311]
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

const aromatic={count:42,bore:3.82,liquidHeight:3.02,poolDepth:1.70,scale:.168,skin:.58};
const hydrogenHalide={count:100,bore:3.19,scale:.226,skin:.31,poolDepth:1.37,hz:10};
const newObservations={
  'p-xylene':{...aromatic,melt:13.25,min:-115,max:192,step:.25,start:5,rate:54},
  ethylbenzene:{...aromatic,melt:-95,min:-115,max:192,step:.25,start:5,rate:54},
  toluene:{...aromatic,melt:-95.2,min:-115,max:165,step:.2,start:25,rate:48},
  phenol:{...aromatic,melt:40.9,min:8,max:235,step:.1,start:25,rate:46,
    hz:10,interactionRange:6.8,torqueGain:.31,forceGain:.24},
  'hydrogen-fluoride':{...hydrogenHalide,melt:-83.4,min:-105,max:62,step:.1,start:-40,rate:35,
    liquidHeight:2.94,associationRange:1.03},
  'hydrogen-chloride':{...hydrogenHalide,melt:-114.1,min:-145,max:-32,step:.1,start:-40,rate:26,
    liquidHeight:2.13,crystalSpacing:.194,interactionRange:6,torqueGain:.17,forceGain:.16,solidRotation:.8},
  propane:{melt:-187.6,min:-202,max:32,step:.2,start:25,rate:47,
    count:56,bore:3.31,liquidHeight:2.12,poolDepth:1.33,scale:.169,skin:.41},
  'ethylene-glycol':{melt:-12.9,min:-37,max:215,step:.1,start:20,rate:49,
    count:48,bore:3.41,liquidHeight:2.55,poolDepth:1.63,scale:.173,skin:.45,
    hz:10,interactionRange:6.3,torqueGain:.34,forceGain:.25,mobility:glycolMobility},
  'dimethyl-sulfoxide':{melt:18.5,min:-8,max:120,step:.1,start:20,rate:23,
    count:48,bore:3.43,liquidHeight:2.62,poolDepth:1.65,scale:.177,skin:.47,
    hz:10,antiparallelRange:1.22,liquidOnlyRange:true}
};

for(const [id,observation] of Object.entries(newObservations)){
  observations[id]={...observation,lattice:id,startInEquilibrium:true};
}

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
function logViscosity(temperature,values,start,step){
  const index=Math.max(0,Math.min((temperature-start)/step,values.length-1));
  const i=Math.min(Math.floor(index),values.length-2);
  return values[i]*(values[i+1]/values[i])**(index-i);
}

export function glycerolMobility(temperature){
  return (14.8/logViscosity(temperature,viscosity,20,10))**.36;
}

// Perry 8e, table 2-313, dynamic viscosity in mPa·s at -10, 0, …, 210 °C.
const glycolViscosity=[108.206,57.395,33.282,20.738,13.703,9.504,6.863,5.127,3.941,3.106,2.5,2.049,
  1.707,1.443,1.234,1.068,.933,.823,.731,.655,.59,.535,.488];

function glycolMobility(temperature){
  return Math.min(1,(.9/logViscosity(temperature,glycolViscosity,-10,10))**.30);
}
