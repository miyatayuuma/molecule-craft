import { Matrix4, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';

const faceCentres=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]];
const radians=deg=>deg*Math.PI/180;
const vector=v=>new Vector3(...v);
const axisX=new Vector3(1,0,0), axisY=new Vector3(0,1,0), axisZ=new Vector3(0,0,1);

function frame(normal, along){
  const z=normal.clone().normalize(), x=along.clone().addScaledVector(z,-along.dot(z)).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}

function benzene(){
  // Cox's ambient-pressure phase I: four Pbca inversion centres, with ring
  // normals about 50° from c, nearly perpendicular to b. View down b.
  const angle=radians(50), normal=new Vector3(Math.sin(angle),Math.cos(angle),0);
  const inverse=frame(axisZ,axisY).invert(); // The catalogue ring is planar in XY.
  return {
    cell:[7.46,7.034,9.66],
    basis:faceCentres.map((site,i)=>[site,frame(
      new Vector3(normal.x,i===1||i===2?-normal.y:normal.y,0),axisZ
    ).multiply(inverse)])
  };
}

function ammonia(body){
  // Olovsson & Templeton: N at (u,u,u), with P2₁3 screw-related partners.
  const u=.0401, xyz=body.atoms.map(a=>vector(a.positionAngstrom));
  const [n,h]=xyz, lonePair=n.clone().multiplyScalar(4).sub(xyz.reduce(
    (sum,point)=>sum.add(point),new Vector3()
  ));
  const local=frame(lonePair,h.clone().sub(n)).invert();
  const rotation=frame(vector([1,1,1]),vector([-.19,.10,-.05])).multiply(local);
  return {
    cell:[5.138,5.138,5.138],
    basis:[
      [[u,u,u],rotation],
      [[.5+u,.5-u,1-u],new Quaternion().setFromAxisAngle(axisX,Math.PI).multiply(rotation)],
      [[1-u,.5+u,.5-u],new Quaternion().setFromAxisAngle(axisY,Math.PI).multiply(rotation)],
      [[.5-u,1-u,.5+u],new Quaternion().setFromAxisAngle(axisZ,Math.PI).multiply(rotation)]
    ]
  };
}

function chlorine(body){
  const axis=vector(body.atoms[1].positionAngstrom).sub(vector(body.atoms[0].positionAngstrom)).normalize();
  return {
    cell:[6.24,4.48,8.26],
    basis:faceCentres.map((site,i)=>[site,new Quaternion().setFromUnitVectors(axis,
      vector([0,.1161*4.48,(i===1||i===2?-1:1)*.1014*8.26]).normalize()
    )])
  };
}

function oxygen(body){
  const axis=vector(body.atoms[1].positionAngstrom).sub(vector(body.atoms[0].positionAngstrom)).normalize();
  const basis=[[[0,0,0]],[[.5,.5,.5]]];
  // A15-type Pm-3n packing: 2a rotors and 6c molecules with preferential axes.
  for(const x of [.25,.75]){
    basis.push([[x,0,.5],new Quaternion().setFromUnitVectors(axis,axisY),.32]);
    basis.push([[.5,x,0],new Quaternion().setFromUnitVectors(axis,axisZ),.32]);
    basis.push([[0,.5,x],new Quaternion().setFromUnitVectors(axis,axisX),.32]);
  }
  return {cell:[6.78,6.78,6.78],basis};
}

function hexagonal(a,c){
  return {cell:[a,c,a*Math.sqrt(3)],basis:[
    [[0,0,0]],[[.5,0,.5]],[[.5,.5,1/6]],[[0,.5,2/3]]
  ]};
}

function butane(body){
  const carbons=body.atoms.slice(0,4).map(a=>vector(a.positionAngstrom));
  const long=carbons[3].clone().sub(carbons[0]), second=carbons[1].clone().sub(carbons[0]);
  const inverse=frame(long.clone().cross(second),long).invert();
  // Tilted chain-packing motif inspired by the reported monoclinic model.
  return {
    cell:[7.64,5.1,6.2], shear:.11,
    basis:[
      [[0,0,0],frame(axisY,vector([1,0,.42])).multiply(inverse)],
      [[.5,.5,.5],frame(axisY,vector([1,0,-.42])).multiply(inverse)]
    ]
  };
}

function glycerol(){
  // Corrugated sheets with alternating tilts. A packing motif from Kusukawa
  // et al., not their atomic coordinates or a crystallographic refinement.
  return {cell:[10.6,8,5.12],basis:[
    [[0,0,0],new Quaternion().setFromAxisAngle(axisZ,.64)],
    [[.5,.09,0],new Quaternion().setFromAxisAngle(axisZ,-.64)],
    [[.25,.5,.5],new Quaternion().setFromAxisAngle(axisY,Math.PI).multiply(new Quaternion().setFromAxisAngle(axisZ,-.64))],
    [[.75,.59,.5],new Quaternion().setFromAxisAngle(axisY,Math.PI).multiply(new Quaternion().setFromAxisAngle(axisZ,.64))]
  ]};
}

const structures={
  butane,benzene,cyclohexane:()=>({cell:[8.712,8.712,8.712],basis:faceCentres.map(site=>[site])}),
  oxygen,chlorine,nitrogen:()=>hexagonal(3.861,6.265),hydrogen:()=>hexagonal(3.76,6.11),
  ammonia,glycerol
};

export function molecularCrystalSites(body,profile){
  const structure=structures[profile.lattice]?.(body);
  if(!structure)return null;
  const {cell:[a,b,c],basis,shear=0}=structure;
  const {crystalScale=profile.scale,skin,solidHeight,bore,count}=profile;
  const scale=crystalScale;
  const radius=bore-skin-.03, floor=skin+.05, ceiling=solidHeight-skin-.08;
  const sites=[];
  for(const [[u,v,w],orientation,libration] of basis){
    for(let j=0;floor+(j+v)*b*scale<=ceiling;j++){
      const y=floor+(j+v)*b*scale;
      for(let i=-6;i<=6;i++)for(let k=-6;k<=6;k++){
        const x=(a*(i+u)+shear*c*(k+w))*scale,z=c*(k+w)*scale;
        if(x*x+z*z<=radius*radius)sites.push({x,y,z,orientation,libration,occupied:false});
      }
    }
  }
  return sites.sort((a,b)=>(a.x*a.x+a.z*a.z)-(b.x*b.x+b.z*b.z)||a.y-b.y).slice(0,count);
}
