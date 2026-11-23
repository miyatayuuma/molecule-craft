import { Matrix4, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';

// Jones & Templeton (1958), Table 1. Fractional coordinates in DB order:
// methyl carbon C(II), carboxyl carbon C(I), carbonyl oxygen O(II), hydroxyl O(I).
const atoms=[
  [.0868,.372,.357],[.1641,.276,.170],[.2526,.369,.178],[.1295,.103,0]
];
const cell=[13.32,4.08,5.77];
const symmetry=[
  ([x,y,z])=>[x,y,z],
  ([x,y,z])=>[-x,-y,z+.5],
  ([x,y,z])=>[x+.5,.5-y,z],
  ([x,y,z])=>[.5-x,y+.5,z+.5]
];
function frame([methyl,carbonyl,oxygen]){
  const x=oxygen.clone().sub(carbonyl).normalize();
  const z=x.clone().cross(methyl.clone().sub(carbonyl)).normalize();
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,z.clone().cross(x),z));
}

export function aceticCrystalSites(body,profile){
  const local=body.atoms.slice(0,3).map(atom=>new Vector3(...atom.positionAngstrom));
  const inverse=frame(local).invert();
  const basis=symmetry.map(transform=>{
    const points=atoms.map(atom=>new Vector3(...transform(atom).map((value,i)=>value*cell[i])));
    const orientation=frame(points).multiply(inverse);
    const centre=points[1].clone().sub(local[1].clone().applyQuaternion(orientation));
    // Wrap centres independently so successive b layers share one slab.
    centre.y=((centre.y%cell[1])+cell[1])%cell[1];
    return {centre,orientation};
  });
  const floor=Math.min(...basis.map(({centre})=>centre.y));
  const sites=[];
  for(const {centre,orientation} of basis){
    for(let a=-2;a<=2;a++)for(let b=0;b<2;b++)for(let c=-3;c<=3;c++){
      const x=(centre.x+a*cell[0])*profile.scale, z=(centre.z+c*cell[2])*profile.scale;
      const y=.52+(centre.y-floor+b*cell[1])*profile.scale;
      const radius=Math.hypot(x,z);
      if(radius<=profile.bore-profile.skin && y<=profile.solidHeight-profile.skin-.05)
        sites.push({x,y,z,orientation,occupied:false});
    }
  }
  return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
}
