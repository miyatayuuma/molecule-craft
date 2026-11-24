import { Quaternion, Vector3 } from '../vendor/three/three.core.min.js';
import { crystal } from './water-ice-sites.js';
import { ethanolCrystalSites } from './phase-ethanol-crystal.js';
import { etherCrystalSites } from './phase-ether-crystal.js';
import { aceticCrystalSites } from './phase-acetic-crystal.js';
import { measuredCrystalSites } from './phase-crystal-cells.js';
import { molecularCrystalSites } from './phase-molecular-crystals.js';


export function iceSites(body,profile) {
  if(profile.lattice==='ethanol-pc')return ethanolCrystalSites(body,profile);
  if(profile.lattice==='ether-rings')return etherCrystalSites(body,profile);
  if(profile.lattice==='acetic-acid-pna21')return aceticCrystalSites(body,profile);
  if(profile.lattice==='dry-ice'){
    // Pa-3, a=5.056 Å, https://som.web.cmu.edu/structures/S104-CO2.html
    // The four face-centred sites carry different body-diagonal axes.
    const basis=[
      [[0,0,0],[1,1,1]], [[.5,.5,0],[1,-1,-1]],
      [[0,.5,.5],[-1,1,-1]], [[.5,0,.5],[-1,-1,1]]
    ];
    const axis=new Vector3().fromArray(body.atoms[1].positionAngstrom)
      .sub(new Vector3().fromArray(body.atoms[2].positionAngstrom)).normalize();
    const edge=5.056*profile.scale;
    const sites=[];
    for(const [[u,v,w],direction] of basis){
      const orientation=new Quaternion().setFromUnitVectors(axis,new Vector3(...direction).normalize());
      for(let j=0;j+v<=1;j++)for(let i=-3;i<=3;i++)for(let k=-3;k<=3;k++){
        sites.push({x:edge*(i+u),y:.42+edge*(j+v),z:edge*(k+w),orientation,occupied:false});
      }
    }
    return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
  }
  if(profile.lattice==='fcc'){
    // Conventional FCC basis, cut three (001) layers inside the bore.
    // Phase I: https://doi.org/10.1103/7hxd-hhjf
    const sites=[];
    for(let j=0;j<3;j++)for(let i=-5;i<=5;i++)for(let k=-5;k<=5;k++){
      if((i+j+k)%2===0)sites.push({x:.51*i,y:.32+.51*j,z:.51*k,occupied:false});
    }
    return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
  }
  const sites=measuredCrystalSites(body,profile)??molecularCrystalSites(body,profile);
  if(sites)return sites;
  return crystal.map(([x,y,z,...q]) => {
    const orientation = new Quaternion(...q).normalize();
    const offset = new Vector3().fromArray(body.atoms[0].positionAngstrom)
      .multiplyScalar(profile.scale).applyQuaternion(orientation);
    return {x:x-offset.x, y:y-offset.y, z:z-offset.z, orientation, occupied:false};
  });
}

export function assignIceSite(p, sites, freezing) {
  if (freezing && !p.site) {
    let closest = Infinity;
    for (const site of sites) {
      if (site.occupied) continue;
      const distance = (p.x-site.x)**2 + (p.y-site.y)**2 + (p.z-site.z)**2;
      if (distance < closest) { closest=distance; p.site=site; }
    }
    p.site.occupied=true;
  } else if (!freezing && p.site && p.frozen < .005) {
    p.site.occupied=false;
    p.site=null;
  }
}

export function moveCondensate(p,s,dt,liquid,ice,index,mobility=1) {
  const t=s.time, phase=index*2.39996;
  const boundary=s.profile.melt??s.profile.vaporTemperature(s.pressure);
  const warmth=.7+Math.max(0,s.temperature-boundary)/95;
  const poolDepth=s.profile.poolDepth??1.20;
  const poolTop=.4+poolDepth*(1-s.phase.gas);
  // Decorrelation and counterflow let neighbours exchange places, even at rest.
  const flow=(s.flowTime??t)*warmth+phase;
  const poolRadius=s.profile.bore ? s.profile.bore-s.profile.skin-.3 : 2.06;
  const rim=5*Math.max(0,Math.hypot(p.x,p.z)-poolRadius);
  const vx=-rim*p.x+.75*warmth*mobility*(Math.sin(flow*.83+p.z)-.32*p.z);
  const vz=-rim*p.z+.75*warmth*mobility*(Math.cos(flow*.71+p.x)+.32*p.x);
  const level=.3+(.5+.5*Math.sin(flow*.95+p.z*.5))*(poolTop-.28);
  const damping=1-Math.exp(-4*liquid*dt);
  p.vx+=(vx-p.vx)*damping;
  p.vz+=(vz-p.vz)*damping;
  p.vy+=(Math.max(-15,4*mobility*(level-p.y))-p.vy)*damping;
  p.vx+=p.force.x*liquid*dt; p.vy+=p.force.y*liquid*dt; p.vz+=p.force.z*liquid*dt;
  if(p.site && ice>0){
    const amp=.018+.022*(Math.max(-30,(s.temperature-boundary))+30)/30;
    const site=p.site, stiffness=1-Math.exp(-12*dt*ice);
    p.vx+=(7*(site.x+amp*Math.sin(15*t+phase)-p.x)-p.vx)*stiffness;
    p.vy+=(7*(site.y+amp*Math.cos(18*t+phase)-p.y)-p.vy)*stiffness;
    p.vz+=(7*(site.z+amp*Math.sin(13*t-phase)-p.z)-p.vz)*stiffness;
  }
}
