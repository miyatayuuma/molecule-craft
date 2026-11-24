import {ELEMENTS} from './chemistry.js?v=20';
import {Matrix4,Quaternion,Vector3} from '../vendor/three/three.core.min.js';

const identity=([x,y,z])=>[x,y,z];
const inversion=([x,y,z])=>[-x,-y,-z];
const screwN=([x,y,z])=>[.5-x,.5+y,.5-z];
const screwC=([x,y,z])=>[-x,.5+y,.5-z];
const centrosymmetric=screw=>[identity,screw,inversion,point=>screw(inversion(point))];
const verticalA=({x,y,z})=>new Vector3(z,x,y);
const verticalC=({x,y,z})=>new Vector3(y,z,x);
const radians=Math.PI/180;

function cartesian({cell:[a,b,c],beta=90,gamma=90,view},[u,v,w]){
  const point=new Vector3(a*u+b*v*Math.cos(gamma*radians)+c*w*Math.cos(beta*radians),
    b*v*Math.sin(gamma*radians),c*w*Math.sin(beta*radians));
  return view?view(point):point;
}

const xyleneRing=[[.6063,.3087,.4348],[.3833,.4077,.3893],[.3937,.6913,.5652]];
const glycol=[
  [-.0867,-.0207,.0342],[-.0102,-.0006,-.1230],[.0049,.1443,.1130],[.2727,.0005,-.1429],
  [.0079,-.1442,.0875],[-.2705,-.0348,.0412],[-.0971,.1318,-.1676],[-.0813,-.1125,-.1740],
  [.0868,.1022,.2023],[.3449,.1277,-.1248]
];
const dmso=[
  [.3139,-.0633,.12708],[.18232,.14961,.19283],[.2905,.3307,.09280],[-.10440,.13580,.16758],
  [.2663,-.1825,.1698],[.5015,-.0518,.1317],[.2465,-.0729,.0435],
  [.2217,.2994,.0114],[.4786,.3299,.0972],[.2305,.4623,.1149]
];

// Fractional positions of molecular landmarks and the operations that repeat
// them. The chamber rigid bodies retain their intramolecular geometry.
const cells={
  // van Koningsveld et al. (1986), coordinates reproduced in Konar et al., Table S2.
  'p-xylene':{cell:[5.806,5.023,11.215],beta:100.48,view:verticalA,
    anchors:[0,1,3],molecules:[xyleneRing],symmetry:[identity,screwN]},
  // Yufit (2013), gz3229sup1.cif, block III (160 K).
  ethylbenzene:{cell:[5.6138,14.970,8.0481],beta:102.18,view:verticalA,
    anchors:[0,1,3],molecules:[[[.26089,.14402,.05894],[.11190,.17626,.16338],[.3822,.11725,.41133]]],
    symmetry:centrosymmetric(screwN)},
  // α-toluene, CSD 725245 / AFLOW NQ3P: two independent molecules.
  toluene:{cell:[7.5889,5.8186,26.982],beta:106.136,
    anchors:[0,1,3],molecules:[
      [[.25252,.57510,.34020],[.13489,.38660,.33222],[.23276,.26730,.25885]],
      [[.76924,.88800,.47034],[.82180,.81460,.42747],[.69189,1.15330,.38027]]
    ],symmetry:centrosymmetric(screwC)},
  // Zavodnik et al., ambient P1121; Allan et al. (2002), Table 3.
  phenol:{cell:[6.050,8.925,14.594],gamma:90.36,
    anchors:[0,1,3],molecules:[
      [[.2217,.8023,.3261],[.0468,.8900,.2954],[.2624,1.1125,.3233]],
      [[.8848,.4102,.1834],[1.0825,.4048,.1366],[.9429,.1936,.05367]],
      [[.5886,.3961,.4526],[.7887,.3190,.4567],[.6561,.1848,.5885]]
    ],symmetry:[identity,([x,y,z])=>[-x,-y,z+.5]]},
  // Fortes et al., neutron diffraction of C3D8, fc5089sup1.cif.
  propane:{cell:[4.11967,12.55244,6.92536],beta:91.4858,view:verticalA,
    anchors:[1,0,2],molecules:[[[.3102,.87582,.38842],[.2165,.94858,.22096],[.2303,.75858,.34637]]],
    symmetry:centrosymmetric(screwN)},
  // Chopra et al. (2010), Tables 1, 2 and 5, 100 K.
  'ethylene-glycol':{cell:[4.9993,6.9031,9.2499],view:verticalA,conformer:glycol,
    anchors:[0,1,2],molecules:[glycol.slice(0,3)],symmetry:[identity,
      ([x,y,z])=>[.5-x,-y,.5+z],([x,y,z])=>[.5+x,.5-y,-z],([x,y,z])=>[-x,.5+y,.5-z]]},
  // Reuter (2017), wm5409sup1.cif, 100 K. Equivalent methyl groups may
  // interchange under an improper operation while preserving the S=O axis.
  'dimethyl-sulfoxide':{cell:[5.2243,6.7414,11.2772],beta:94.82,view:verticalA,conformer:dmso,
    anchors:[1,3,0],molecules:[[dmso[1],dmso[3],dmso[0]]],symmetry:centrosymmetric(screwC),
    reflectedLandmark:dmso[2]}
};

function frame([origin,along,side]){
  const x=along.clone().sub(origin).normalize();
  const z=x.clone().cross(side.clone().sub(origin)).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}

export function measuredConformer(id){
  const cell=cells[id];
  if(!cell?.conformer)return null;
  const points=cell.conformer.map(point=>cartesian(cell,point));
  const centre=points.reduce((sum,point)=>sum.add(point),new Vector3()).divideScalar(points.length);
  return points.map(point=>point.sub(centre).toArray());
}

function measuredBasis(body,cell){
  const local=cell.anchors.map(index=>new Vector3(...body.atoms[index].positionAngstrom));
  const inverse=frame(local).invert();
  return cell.molecules.flatMap(points=>cell.symmetry.map((transform,i)=>{
    const landmarks=i>=2 && cell.reflectedLandmark?[...points.slice(0,2),cell.reflectedLandmark]:points;
    const targets=landmarks.map(point=>cartesian(cell,transform(point)));
    const orientation=frame(targets).multiply(inverse);
    return {origin:targets[0].clone().sub(local[0].clone().applyQuaternion(orientation)),orientation,libration:.07};
  }));
}

function fluorideCell(body){
  // Johnson et al., neutron diffraction: 2.50 Å F···F, b/2 = 2.13 Å,
  // four molecules in two parallel zigzag chains. Registry is idealized.
  const cell={cell:[3.31,4.26,5.22],view:({x,y,z})=>new Vector3(y,x,-z)};
  const local=new Vector3(...body.atoms[0].positionAngstrom);
  const axis=new Vector3(...body.atoms[1].positionAngstrom).sub(local).normalize();
  const spread=Math.sqrt(2.5**2-2.13**2);
  const basis=[];
  for(const [u,v,w,sign] of [[0,0,0,1],[.5,.5,.5, -1]]){
    for(const side of [0,1]){
      const origin=cartesian(cell,[u+side*sign*spread/3.31,v+side*.5,w]);
      const direction=new Vector3(2.13,(1-2*side)*sign*spread,0).normalize();
      const orientation=new Quaternion().setFromUnitVectors(axis,direction);
      origin.sub(local.clone().applyQuaternion(orientation));
      basis.push({origin,orientation,libration:.035});
    }
  }
  return {cell,basis};
}

function chlorideCell(){
  const cell={cell:[5.482,5.482,5.482],view:verticalC};
  const basis=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]].map(point=>({origin:cartesian(cell,point)}));
  return {cell,basis};
}

export function measuredCrystalSites(body,profile){
  const model=cells[profile.lattice];
  const structure=model?{cell:model,basis:measuredBasis(body,model)}
    :profile.lattice==='hydrogen-fluoride'?fluorideCell(body)
    :profile.lattice==='hydrogen-chloride'?chlorideCell():null;
  if(!structure)return null;
  const {cell,basis}=structure;
  const {crystalSpacing=profile.scale,skin,solidHeight,bore,count}=profile;
  const axes=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>cartesian(cell,axis));
  const span=Math.max(...axes.map(axis=>Math.abs(axis.y)));
  const floor=skin+.045, ceiling=solidHeight-skin-.065;
  const limit=(bore-skin-.045)**2;
  const sites=[];
  const point=new Vector3();
  for(const {origin,orientation,libration} of basis){
    const atoms=orientation?body.atoms.map(atom=>({
      offset:new Vector3(...atom.positionAngstrom).multiplyScalar(profile.scale).applyQuaternion(orientation),
      radius:({H:.089,O:.139})[atom.element]??ELEMENTS[atom.element].radius*.34
    })):[];
    for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++)for(let c=-6;c<=6;c++){
      point.copy(origin).addScaledVector(axes[0],a).addScaledVector(axes[1],b).addScaledVector(axes[2],c);
      // Keep a shared vertical origin, including the stagger between molecules.
      const x=point.x*crystalSpacing,y=(point.y-span*.5)*crystalSpacing+floor,z=point.z*crystalSpacing;
      if(y<floor-1e-6 || y>ceiling || x*x+z*z>limit)continue;
      if(atoms.some(({offset,radius})=>Math.hypot(x+offset.x,z+offset.z)+radius+.035>bore
        || y+offset.y-radius<.035 || y+offset.y+radius+.075>solidHeight))continue;
      sites.push({x,y,z,orientation,libration,occupied:false});
    }
  }
  const chainWeight=profile.associationRange ? .65 : 1;
  const priority=site=>chainWeight*site.x**2+site.z**2;
  return sites.sort((a,b)=>priority(a)-priority(b)||a.y-b.y).slice(0,count);
}
