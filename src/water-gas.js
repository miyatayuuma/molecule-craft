// Height represents volume because the bore and the number of molecules are fixed.
export const BORE = 2.85;
export const REST = 7.6;
export const LOW = 2.78;
export const HIGH = 14.45;
export const COUNT = 72;
const skin = .28;
const radius = BORE - skin;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const pressure = (temperature, height) => (temperature + 273.15) / 433.15 * REST / height;

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
  return {particles, height:REST, target:REST, temperature:160, velocity:0};
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
  // A damped piston follows the finger. Its actual face drives collisions and the gauge.
  gas.velocity += (850*(gas.target-previous)-50*gas.velocity)*dt;
  gas.height=clamp(previous+clamp(gas.velocity,-48,48)*dt,LOW,HIGH);
  const pistonSpeed=(gas.height-previous)/dt, top=gas.height-skin;
  const heat=1+(gas.temperature-160)/100; // Exaggerated visual speed response.
  for (const p of gas.particles) {
    const speed=Math.hypot(p.vx,p.vy,p.vz);
    const gain=1+(p.speed*heat/Math.max(.001,speed)-1)*(1-Math.exp(-2*dt));
    p.vx*=gain; p.vy*=gain; p.vz*=gain;
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt;
    p.phase+=p.spin*dt*heat;
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
