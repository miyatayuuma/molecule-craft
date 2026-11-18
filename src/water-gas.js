export const BORE = 2.85;
import { advanceSample, createSample, REST, clamp } from './water-phase.js';
import { iceSites, moveCondensate } from './water-condensate.js';
export {HIGH} from './water-phase.js';
export const COUNT = 72;
const skin = .28;
const radius = BORE - skin;
export function createGas() {
  const particles = [];
  while (particles.length < COUNT) {
    const angle = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    const x = Math.cos(angle) * r, z = Math.sin(angle) * r;
    const y = skin + Math.random() * (REST - 2 * skin);
    if (particles.some(p => Math.hypot(p.x-x, p.y-y, p.z-z) < 2*skin)) continue;
    const azimuth = Math.random()*2*Math.PI, vertical = 2*Math.random()-1;
    const horizontal = Math.sqrt(1-vertical*vertical), speed = 1.25 + Math.random()*1.65;
    particles.push({x,y,z, vx:speed*horizontal*Math.cos(azimuth), vy:speed*vertical,
      vz:speed*horizontal*Math.sin(azimuth), speed, phase:angle, spin:.7+Math.random()*2});
  }
  const sites=iceSites(COUNT);
  particles.sort((a,b)=>a.y-b.y);
  particles.forEach((p,i)=>{p.site=sites[i];p.free=1;});
  return {...createSample(),particles,time:0};
}

function contain(p, top, pistonSpeed) {
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
  const previous=gas.height;
  advanceSample(gas,dt);
  gas.time+=dt;
  const pistonSpeed=(gas.height-previous)/dt, top=gas.height-skin;
  // Carry part of the gas upward with a fast withdrawal. A height gradient keeps
  // the bottom layer in place and frees the swept volume over several substeps.
  const expansion=Math.max(0,gas.height-previous)/(previous-2*skin);
  const heat=Math.max(.55,1+(gas.temperature-160)/100); // Exaggerated visual speed response.
  for (let i=0;i<COUNT;i++) {
    const p=gas.particles[i];
    const dense=clamp((1-gas.vapor)*COUNT-i,0,1);
    const ice=clamp(gas.ice*COUNT-i,0,1);
    // A molecule leaving the surface picks up a finite outward velocity.
    if(1-dense>p.free)p.vy+=3*(1-dense-p.free);
    p.free=1-dense;
    const speed=Math.hypot(p.vx,p.vy,p.vz);
    const gain=1+p.free*(p.speed*heat/Math.max(.001,speed)-1)*(1-Math.exp(-2*dt));
    p.vx*=gain; p.vy*=gain; p.vz*=gain;
    if(dense>0)moveCondensate(p,gas,dt,dense,ice,i);
    p.x+=p.vx*dt; p.y+=p.vy*dt+.78*(p.y-skin)*expansion; p.z+=p.vz*dt;
    p.phase+=p.spin*dt*(1-ice)*((1-dense)*heat+dense*(.7+gas.temperature/120));
    contain(p,top,pistonSpeed);
  }
  const diameter=skin*2;
  for (let i=0;i<gas.particles.length;i++) {
    const a=gas.particles[i];
    for (let j=0;j<i;j++) {
      const b=gas.particles[j], dx=a.x-b.x, dy=a.y-b.y, dz=a.z-b.z;
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
  for (const p of gas.particles) contain(p,top,pistonSpeed);
}
