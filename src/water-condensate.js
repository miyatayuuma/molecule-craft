// Ideal hexagonal diamond (wurtzite oxygen sites): alternating AB basal nets,
// four tetrahedral neighbours in the bulk. The finite crystallite has free edges.
export function iceSites(count) {
  const c=1.80, a=c/Math.sqrt(8/3), sites=[];
  for(const layer of [0,3/8,1/2,7/8]){
    const offset=layer>=.5?1/3:0;
    for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++){
      const x=a*(i+offset+(j+offset)/2), z=a*Math.sqrt(3)/2*(j+offset);
      sites.push({x,y:.3+c*layer,z});
    }
  }
  return sites.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z)).slice(0,count);
}

export function moveCondensate(p,s,dt,liquid,ice,index) {
  const t=s.time, phase=index*2.39996;
  const warmth=.7+Math.max(0,s.temperature)/95;
  const poolTop=.4+1.20*(1-s.vapor);
  // Decorrelation and counterflow let neighbours exchange places, even at rest.
  const flow=t*warmth+phase;
  const rim=5*Math.max(0,Math.hypot(p.x,p.z)-2.06);
  const vx=-rim*p.x+warmth*(Math.sin(flow*.83+p.z)-.32*p.z);
  const vz=-rim*p.z+warmth*(Math.cos(flow*.71+p.x)+.32*p.x);
  const level=.3+(.5+.5*Math.sin(flow*.95+p.z*.5))*(poolTop-.28);
  const damping=1-Math.exp(-4*liquid*dt);
  p.vx+=(vx-p.vx)*damping;
  p.vz+=(vz-p.vz)*damping;
  p.vy+=(Math.max(-15,4*(level-p.y))-p.vy)*damping;
  if(ice>0){
    const amp=.018+.022*(Math.max(-30,s.temperature)+30)/30;
    const site=p.site, stiffness=1-Math.exp(-12*dt*ice);
    p.vx+=(7*(site.x+amp*Math.sin(15*t+phase)-p.x)-p.vx)*stiffness;
    p.vy+=(7*(site.y+amp*Math.cos(18*t+phase)-p.y)-p.vy)*stiffness;
    p.vz+=(7*(site.z+amp*Math.sin(13*t-phase)-p.z)-p.vz)*stiffness;
  }
}
