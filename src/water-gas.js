export const DEFAULT_BORE = 2.85;
import { advanceSample, createSample, REST, clamp } from './water-phase.js';
import { iceSites, assignIceSite, moveCondensate } from './water-condensate.js';
export {HIGH} from './water-phase.js';
import { moleculeSites, initializeWater, sampleInteractions, turnWater } from './water-liquid.js';
import {profiles} from './phase-profiles.js';
import {glycerolMobility} from './phase-substances.js';
export function createGas(record) {
  const profile=profiles[record.id], {count,skin,bore=DEFAULT_BORE}=profile, radius=bore-skin;
  const sample=createSample(profile);
  const local=moleculeSites(record,profile);
  const particles = [];
  while (particles.length < count) {
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const y = skin + Math.random() * (REST - 2 * skin);
    if (particles.some(p => Math.hypot(p.x-x, p.y-y, p.z-z) < 2*skin)) continue;
    const azimuth = Math.random()*2*Math.PI, vertical = 2*Math.random()-1;
    const horizontal = Math.sqrt(1-vertical*vertical), speed = 1.25 + Math.random()*1.65;
    particles.push({x,y,z, vx:speed*horizontal*Math.cos(azimuth), vy:speed*vertical,
      vz:speed*horizontal*Math.sin(azimuth), speed, phase:angle, spin:.7+Math.random()*2});
  }

  particles.sort((a,b)=>a.y-b.y);
  particles.forEach((p,i)=>{
    initializeWater(p,i,record,local,profile);
    p.site=null; p.free=sample.phase.gas; p.frozen=0; p.liquid=sample.phase.liquid;
    if(profile.liquidOnlyRange){
      p.y=skin+(p.y-skin)*(sample.height-2*skin)/(REST-2*skin);
      p.vx=p.vy=p.vz=0;
    }
  });
  return {...sample,record,particles,sites:iceSites(particles[0].body,profile),time:0,interactionClock:0};
}

function contain(p, top, pistonSpeed,skin,radius) {
  const r = Math.hypot(p.x,p.z);
  if (r > radius) {
    const nx=p.x/r, nz=p.z/r, outward=Math.max(0,p.vx*nx+p.vz*nz);
    p.vx-=2*outward*nx; p.vz-=2*outward*nz;
    p.x=radius*nx; p.z=radius*nz;
  }
  if (p.y < skin) { p.y=skin; p.vy=Math.abs(p.vy); }
  if (p.y > top) {
    p.y=top;
    if (p.vy>pistonSpeed) p.vy=Math.max(-10,2*pistonSpeed-p.vy);
  }
}

export function advanceGas(gas, dt) {
  const {count,skin,hz,start,melt,sublimes,bore=DEFAULT_BORE}=gas.profile;
  const previous=gas.height;
  const thermalReference=melt??gas.profile.vaporTemperature(gas.pressure);
  advanceSample(gas,dt);
  gas.time+=dt;
  const mobility=gas.profile.viscous?glycerolMobility(gas.temperature):1;
  if(gas.profile.viscous)gas.flowTime=(gas.flowTime??0)+dt*mobility;
  const pistonSpeed=(gas.height-previous)/dt, top=gas.height-skin, radius=bore-skin;
  // Carry part of the gas upward with a fast withdrawal. A height gradient keeps
  // the bottom layer in place and frees the swept volume over several substeps.
  const expansion=Math.max(0,gas.height-previous)/(previous-2*skin);
  const heat=Math.max(.55,1+(gas.temperature-start)/100); // Exaggerated visual speed response.
  for (let i=0;i<count;i++) {
    const p=gas.particles[i];
    const dense=clamp((1-gas.phase.gas)*count-i,0,1);
    const ice=clamp(gas.phase.solid*count-i,0,1);
    // A molecule leaving the surface picks up a finite outward velocity.
    if(1-dense>p.free)p.vy+=3*(1-dense-p.free);
    p.free=1-dense;
    p.frozen += (ice-p.frozen)*(1-Math.exp(-9*dt));
    assignIceSite(p,gas.sites,ice>0);
    p.liquid=sublimes?0:dense*(1-p.frozen);
  }
  gas.interactionClock+=dt;
  if(hz && gas.interactionClock>=1/hz){
    gas.interactionClock%=1/hz;
    sampleInteractions(gas.particles,gas.profile);
  }
  for (let i=0;i<count;i++) {
    const p=gas.particles[i];
    const speed=Math.hypot(p.vx,p.vy,p.vz);
    const gain=1+p.free*(p.speed*heat/Math.max(.001,speed)-1)*(1-Math.exp(-2*dt));
    p.vx*=gain; p.vy*=gain; p.vz*=gain;
    if(p.site || p.liquid>0)moveCondensate(p,gas,dt,p.liquid,p.frozen,i,mobility);
    p.x+=p.vx*dt; p.y+=p.vy*dt+.78*(p.y-skin)*expansion; p.z+=p.vz*dt;
    turnWater(p,i,dt,heat,gas.temperature-thermalReference,mobility,gas.profile.solidRotation);
    contain(p,top,pistonSpeed,skin,radius);
  }
  const diameter=skin*2;
  for (let i=0;i<gas.particles.length;i++) {
    const a=gas.particles[i];
    for (let j=0;j<i;j++) {
      const b=gas.particles[j];
      // Solid lattice targets already enforce spacing. A hard-sphere impulse
      // can keep two newly captured molecules wedged outside their own sites.
      if(gas.profile.orderedLattice && a.frozen>.95 && b.frozen>.95)continue;
      const dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
      const squared=dx*dx+dy*dy+dz*dz;
      if (squared>=diameter*diameter || squared===0) continue;
      const d=Math.sqrt(squared), nx=dx/d, ny=dy/d, nz=dz/d;
      const push=(diameter-d)/2;
      a.x+=push*nx; a.y+=push*ny; a.z+=push*nz;
      b.x-=push*nx; b.y-=push*ny; b.z-=push*nz;
      const impulse=Math.min(0,(a.vx-b.vx)*nx+(a.vy-b.vy)*ny+(a.vz-b.vz)*nz);
      a.vx-=impulse*nx; a.vy-=impulse*ny; a.vz-=impulse*nz;
      b.vx+=impulse*nx; b.vy+=impulse*ny; b.vz+=impulse*nz;
    }
  }
  for (const p of gas.particles) contain(p,top,pistonSpeed,skin,radius);
}
