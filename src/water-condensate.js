import { Quaternion, Vector3 } from '../vendor/three/three.core.min.js';
import { crystal } from './water-ice-sites.js';


export function iceSites(body,profile) {
  if(profile.lattice==='fcc'){
    // Conventional FCC basis, cut three (001) layers inside the bore.
    // Phase I: https://doi.org/10.1103/7hxd-hhjf
    const sites=[];
    for(let j=0;j<3;j++)for(let i=-5;i<=5;i++)for(let k=-5;k<=5;k++){
      if((i+j+k)%2===0)sites.push({x:.51*i,y:.32+.51*j,z:.51*k,occupied:false});
    }
    return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,profile.count);
  }
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

export function moveCondensate(p,s,dt,liquid,ice,index) {
  const t=s.time, phase=index*2.39996;
  const warmth=.7+Math.max(0,(s.temperature-s.profile.melt))/95;
  const poolTop=.4+1.20*(1-s.phase.gas);
  // Decorrelation and counterflow let neighbours exchange places, even at rest.
  const flow=t*warmth+phase;
  const rim=5*Math.max(0,Math.hypot(p.x,p.z)-2.06);
  const vx=-rim*p.x+.75*warmth*(Math.sin(flow*.83+p.z)-.32*p.z);
  const vz=-rim*p.z+.75*warmth*(Math.cos(flow*.71+p.x)+.32*p.x);
  const level=.3+(.5+.5*Math.sin(flow*.95+p.z*.5))*(poolTop-.28);
  const damping=1-Math.exp(-4*liquid*dt);
  p.vx+=(vx-p.vx)*damping;
  p.vz+=(vz-p.vz)*damping;
  p.vy+=(Math.max(-15,4*(level-p.y))-p.vy)*damping;
  p.vx+=p.force.x*liquid*dt; p.vy+=p.force.y*liquid*dt; p.vz+=p.force.z*liquid*dt;
  if(p.site && ice>0){
    const amp=.018+.022*(Math.max(-30,(s.temperature-s.profile.melt))+30)/30;
    const site=p.site, stiffness=1-Math.exp(-12*dt*ice);
    p.vx+=(7*(site.x+amp*Math.sin(15*t+phase)-p.x)-p.vx)*stiffness;
    p.vy+=(7*(site.y+amp*Math.cos(18*t+phase)-p.y)-p.vy)*stiffness;
    p.vz+=(7*(site.z+amp*Math.sin(13*t-phase)-p.z)-p.vz)*stiffness;
  }
}
