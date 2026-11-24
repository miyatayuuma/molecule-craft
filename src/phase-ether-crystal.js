import { Matrix4, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';

export function etherCrystalSites(body,profile){
  // An observation lattice based on the rotated rings in the ambient-pressure
  // tetragonal alpha phase, with cell volume derived from 0.975 g/cm³ at 93 K.
  // See docs/phase-chamber-data.md for the diffraction and density sources.
  const cellWidth=9.09, layerSpacing=4*78.5/cellWidth**2;
  // Tilt the DB conformers and stagger adjacent layers to leave room between
  // methyl groups while keeping the volume per molecule fixed.
  const tilt=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-.706)
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.213));
  const [carbon,oxygen,otherCarbon]=body.atoms.slice(0,3).map(atom=>new Vector3(...atom.positionAngstrom));
  const tangent=otherCarbon.clone().sub(carbon).normalize();
  const bisector=carbon.clone().lerp(otherCarbon,.5).sub(oxygen).normalize();
  const normal=tangent.clone().cross(bisector).normalize();
  const frame=new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(tangent,normal.clone().cross(tangent),normal)).invert();
  const sites=[];
  for(let layer=0;layer<2;layer++){
    for(let turn=0;turn<4;turn++){
      const angle=turn*Math.PI/2+.48+layer*.51;
      const radial=new Vector3(Math.cos(angle),0,Math.sin(angle));
      const orientation=new Quaternion().setFromRotationMatrix(
        new Matrix4().makeBasis(new Vector3(-radial.z,0,radial.x),radial.clone().negate(),new Vector3(0,-1,0)))
        .multiply(tilt).multiply(frame);
      for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){
        const x=(a*cellWidth+3.19*radial.x+.8*layer)*profile.scale;
        const z=(b*cellWidth+3.19*radial.z+.8*layer)*profile.scale;
        if(Math.hypot(x,z)<=profile.bore-profile.skin)
          sites.push({x,y:.53+layer*layerSpacing*profile.scale,z,orientation,occupied:false});
      }
    }
  }
  return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
}
