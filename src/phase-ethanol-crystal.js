import { Matrix4, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';

// Jönsson (1976), Table 1, https://doi.org/10.1107/S0567740876002653.
// Heavy-atom fractional coordinates in C(methyl), C(methylene), O order.
const asymmetricUnit=[
  [[.2106,.2771,.0448],[.0085,.2987,.1462],[0,.1349,.2500]],
  [[-.4665,.2534,.6869],[-.3959,.2313,.5217],[-.1330,.1785,.5475]]
];
const beta=102.2*Math.PI/180;
function cartesian([a,b,c]){
  return new Vector3(5.377*a+8.255*c*Math.cos(beta),6.882*b,8.255*c*Math.sin(beta));
}

function frame([methyl,methylene,oxygen]){
  const x=methylene.clone().sub(oxygen).normalize();
  const z=x.clone().cross(methyl.clone().sub(oxygen)).normalize();
  const y=z.clone().cross(x);
  return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x,y,z));
}

export function ethanolCrystalSites(body,profile){
  // Retain the measured O positions (zigzag chain) and align the DB backbone.
  // Both independent sites share the chamber's rigid DB conformer.
  const local=body.atoms.slice(0,3).map(atom=>new Vector3(...atom.positionAngstrom));
  const inverse=frame(local).invert();
  const cell=asymmetricUnit.flatMap(atoms=>[false,true].map(glide=>{
    // Space group Pc, unique b: c-glide (x,-y,z+1/2) in standard setting
    // has normal b. Jönsson's Pc uses that setting with origin fixed at O(1).
    const points=atoms.map(([a,b,c])=>cartesian(glide?[a,-b,c+.5]:[a,b,c]));
    const orientation=frame(points).multiply(inverse);
    const centre=points[2].clone().sub(local[2].clone().applyQuaternion(orientation));
    return {centre,orientation};
  }));
  // Centre the b-normal slab vertically. All three lattice spacings use the
  // same Å-to-display scale as the atoms.
  const floorY=Math.min(...cell.map(site=>site.centre.y));
  const sites=[];
  for(const {centre,orientation} of cell){
    for(let a=-4;a<=4;a++)for(let c=-4;c<=4;c++){
      const offset=cartesian([a,0,c]).add(centre);
      offset.y-=floorY;
      const {x,y,z}=offset.multiplyScalar(profile.scale);
      if(Math.hypot(x,z)<=profile.bore-profile.skin)
        sites.push({x,y:y+.45,z,orientation,occupied:false});
    }
  }
  return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
}
