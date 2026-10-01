// Frozen P2 animation authority: a331c09c52a9579a8f4d7016402aa57028af9b42
// Source function SHA256: 73426637e0f67422b21ee8e0cd47af3ea16fb32055d0debeaac5899b8b5e7710
// Test only; independent of the production registry and animation implementation.
import {GROWTH} from "../../src/veil/growth.js";
import {OXYGEN_VORTEX} from "../../src/veil/oxygen-routes.js";
import {updateDustSpatialMembership} from "../../src/veil/dust-spatial-index.js";
export function animateUniverse(run){
  if(!run.map.universe)return;const {time,player:p,map}=run,diagnostics=run.particleDiagnostics;
  const dynamicStart=diagnostics?.clock?.();
  for(const d of map.dust){
    if(diagnostics){diagnostics.dynamicScanned++;if(d.vortex||d.flow)diagnostics.dynamicUpdated++;}
    if(d.vortex){const angle=d.vortex.phase+time*d.vortex.angularSpeed;d.x=OXYGEN_VORTEX.center.x+Math.cos(angle)*d.vortex.radius;d.y=OXYGEN_VORTEX.center.y+Math.sin(angle)*d.vortex.radius;d.angle=angle-Math.PI/2;}
    else if(d.flow){const phase=((time*d.flow.speed/d.flow.span+d.flow.phase)%1-.5)*d.flow.span;d.x=d.baseX+Math.cos(d.angle)*phase;d.y=d.baseY+Math.sin(d.angle)*phase;}
    if(d.vortex||d.flow)updateDustSpatialMembership(map,d);
  }
  if(dynamicStart!==undefined)diagnostics.dynamicMs+=diagnostics.clock()-dynamicStart;
  for(const cluster of map.clusters){
    if(time>=cluster.ready&&Math.hypot(p.x-cluster.x,p.y-cluster.y)<cluster.radius+(p.boost>0||p.combustion?22:0)){
      cluster.ready=run.time+GROWTH.clusterRespawn;cluster.burstAt=run.time;for(const d of cluster.particles)d.ready=0;run.events.push({type:'cluster',x:cluster.x,y:cluster.y});
    }
    const age=time-cluster.burstAt;if(age<0||age>GROWTH.clusterRespawn)continue;
    for(const d of cluster.particles){if(diagnostics)diagnostics.clusterUpdated++;const radius=14+GROWTH.clusterSpread*d.spread*(1-Math.exp(-age*2.4));d.x=cluster.x+Math.cos(d.angle+Math.min(age,5)*.08)*radius;d.y=cluster.y+Math.sin(d.angle+Math.min(age,5)*.08)*radius;updateDustSpatialMembership(map,d);}
  }
  for(const signal of map.signals){const captureRadius=Number.isFinite(signal.captureRadius)?signal.captureRadius:run.config.suctionRadius+18;if(!signal.ready&&signal.claimable===true&&Math.hypot(p.x-signal.x,p.y-signal.y)<captureRadius){signal.ready=true;signal.claimable=false;run.events.push({type:'signal',region:signal.region,roll:signal.roll,choice:signal.choice});}}
}
