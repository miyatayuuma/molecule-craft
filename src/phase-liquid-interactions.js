import {Vector3} from '../vendor/three/three.core.min.js';

const direction=new Vector3(), approach=new Vector3(), turn=new Vector3();
const at=(p,index,scale,out)=>out.fromArray(p.body.atoms[index].positionAngstrom)
  .multiplyScalar(scale).applyQuaternion(p.orientation).add(p);
const offset=(a,b,out)=>out.set(b.x-a.x,b.y-a.y,b.z-a.z);

function alignedFluoride(p,other,cutoff){
  offset(p,other,direction);
  const length=direction.length();
  return length>.40 && length<cutoff && direction.multiplyScalar(1/length).dot(p.polarAxis)>.83;
}

export function sampleFluoride(particles,profile,time,temperature){
  const {scale,associationRange}=profile;
  const incoming=new Set();
  const liquid=particles.filter(p=>p.liquid>.85);
  const solid=particles.filter(p=>p.frozen>.88);
  const liquidSet=new Set(liquid);
  for(const p of particles){
    p.force.set(0,0,0);p.torque.set(0,0,0);
    p.polarAxis??=new Vector3();
    p.polarAxis.set(1,0,0).applyQuaternion(p.orientation);
    p.crystalHydrogenBond=null;
    if(!liquidSet.has(p))p.hydrogenBond=null;
  }
  for(const p of solid){
    p.crystalHydrogenBond=solid.find(other=>alignedFluoride(p,other,.66))??null;
  }

  // One donor and one acceptor per molecule. Neighbours exchange as the
  // temporary links break or reach the end of their lifetime.
  for(const p of liquid){
    const other=p.hydrogenBond;
    if(!other)continue;
    if(liquidSet.has(other) && time<p.bondUntil && offset(p,other,direction).length()<associationRange){
      incoming.add(other);
    }else{
      p.hydrogenBond=null;
      p.canBondAt=time+.2;
    }
  }
  for(const p of liquid){
    if(p.hydrogenBond || time<(p.canBondAt??0))continue;
    let best=Infinity, acceptor=null;
    for(const other of liquid){
      if(other===p || incoming.has(other) || other.hydrogenBond===p || other.hydrogenBond?.hydrogenBond===p)continue;
      offset(p,other,direction);
      const distance=direction.length();
      if(distance<.48 || distance>associationRange)continue;
      direction.multiplyScalar(1/distance);
      const donorAlignment=p.polarAxis.dot(direction);
      const onward=other.hydrogenBond?offset(other,other.hydrogenBond,approach).normalize():other.polarAxis;
      const bend=direction.dot(onward);
      if(donorAlignment<.25 || bend<-.18 || bend>.94)continue;
      const score=Math.abs(distance-.63)+.2*(1-donorAlignment)+.15*Math.abs(bend-.5);
      if(score<best){best=score;acceptor=other;}
    }
    if(!acceptor)continue;
    p.hydrogenBond=acceptor;
    incoming.add(acceptor);
    const cold=Math.max(0,Math.min(1,(15-temperature)/100));
    p.bondUntil=time+.32+.50*Math.random()+.42*cold;
  }

  for(const p of liquid){
    const other=p.hydrogenBond;
    if(!other)continue;
    at(p,0,scale,approach);
    at(other,0,scale,direction).sub(approach);
    const distance=direction.length();
    direction.normalize();
    turn.crossVectors(p.polarAxis,direction);
    p.torque.addScaledVector(turn,9);
    // Surface flow still moves the chains while the weak spring brings the
    // fluorines towards their typical association distance.
    const spring=Math.max(-2,Math.min(2,(distance-.62)*13));
    p.force.addScaledVector(direction,spring);
    other.force.addScaledVector(direction,-spring);
  }
}

export function sampleAntiparallel(particles,profile,temperature){
  const active=particles.filter(p=>p.liquid>.75);
  const axis=new Vector3().fromArray(particles[0].body.atoms[3].positionAngstrom)
    .sub(new Vector3().fromArray(particles[0].body.atoms[1].positionAngstrom)).normalize();
  for(const p of particles){
    p.force.set(0,0,0);p.torque.set(0,0,0);
    p.polarAxis??=new Vector3();
    p.polarAxis.copy(axis).applyQuaternion(p.orientation);
  }
  const range=profile.antiparallelRange;
  const strength=.85/(1+Math.max(0,temperature-20)/70);
  for(let i=0;i<active.length;i++)for(let j=0;j<i;j++){
    const a=active[i],b=active[j];
    offset(a,b,direction);
    const distance=direction.length();
    if(distance>=range || distance<.7)continue;
    direction.multiplyScalar(1/distance);
    // Side-by-side S=O dipoles have a mild antiparallel preference. End-to-end
    // neighbours and warmer liquid get less alignment. No association links.
    const lateral=1-Math.max(Math.abs(a.polarAxis.dot(direction)),Math.abs(b.polarAxis.dot(direction)));
    const weight=(range-distance)*strength*lateral;
    turn.crossVectors(a.polarAxis,b.polarAxis);
    a.torque.addScaledVector(turn,-weight);
    b.torque.addScaledVector(turn,weight);
  }
}
