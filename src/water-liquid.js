import { Euler, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';
import { createStageABody, evaluateStageAForces } from './reaction-lab-stage-a.js';

// 0.215 display units per O–H bond in the P1 model. Both the drawn atom
// offsets and Stage A sites are relative to the same molecular centre of mass.
import * as THREE from '../vendor/three/three.core.min.js';
import { createPreviewModel } from './preview-model.js';
import { REACTION_LAB_WORLD_UNITS_PER_ANGSTROM } from './reaction-lab-stage-a.js';
const halfAngle = 52.25 * Math.PI / 180;
const tipX = .9572 * Math.sin(halfAngle), tipY = .9572 * Math.cos(halfAngle);
const localSites = [[0,0,0], [-tipX,tipY,0], [tipX,tipY,0]];
const euler = new Euler(), step = new Quaternion(), axis = new Vector3();
const freeOrientation = (phase, i) => step.setFromEuler(euler.set(phase+i,phase*.66+i*.41,phase*.36+i*.83));

export function moleculeSites(record,profile){
  if(profile.donorFrame)return localSites; // GenIce local donor frame
  const preview=createPreviewModel(THREE,record);
  for(let i=0;i<80;i++)preview.step();
  return preview.snapshot().atoms.map(atom=>atom.point.divideScalar(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM).toArray());
}

export function initializeWater(p, i, record, sites, profile) {
  const atoms = record.atoms.map((element,k) => ({
    element, positionAngstrom:sites[k], chargeE:record.nonbonded.atomicChargesE[k],
    sigmaAngstrom:record.nonbonded.sigmaAngstrom[k], epsilonKcalMol:record.nonbonded.epsilonKcalMol[k]
  }));
  p.body = createStageABody({id:i, positionAngstrom:[0,0,0], atoms});
  p.orientation = freeOrientation(p.phase,i).clone();
  p.previousFree = p.orientation.clone();
  p.force = new Vector3();
  p.torque = new Vector3();
  p.spinVelocity = new Vector3();
}

function bounded(out, values, gain, limit) {
  out.fromArray(values).multiplyScalar(gain).clampLength(0,limit);
}

export function sampleInteractions(particles,profile) {
  const active = [];
  for (const p of particles) {
    p.force.set(0,0,0);
    p.torque.set(0,0,0);
    if (p.liquid <= .001) continue;
    p.body.positionAngstrom[0] = p.x / profile.scale;
    p.body.positionAngstrom[1] = p.y / profile.scale;
    p.body.positionAngstrom[2] = p.z / profile.scale;
    p.orientation.toArray(p.body.orientation);
    active.push(p.body);
  }
  if (active.length < 2) return;
  const excludedMoleculePairs = new Set();
  if (profile.interactionRange) {
    // These neutral molecules are driven by nearby partners in the observation
    // model. Use Stage A's existing pair filter to leave the shared solver alone.
    const cutoffSquared=profile.interactionRange**2;
    for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
      const a=active[i], b=active[j];
      const [ax,ay,az]=a.positionAngstrom, [bx,by,bz]=b.positionAngstrom;
      if((ax-bx)**2+(ay-by)**2+(az-bz)**2>cutoffSquared)excludedMoleculePairs.add(`${a.id}|${b.id}`);
    }
  }
  const result = evaluateStageAForces(active, {collectPairDiagnostics:false,excludedMoleculePairs});
  for (const body of active) {
    const p = particles[body.id], state = result.bodies.get(body.id);
    bounded(p.torque,state.torqueKcalMolAngstrom,profile.torqueGain,4.2);
    bounded(p.force,state.forceKcalMolAngstrom,profile.forceGain,2.8);
  }
}

export function turnWater(p, i, dt, heat, temperature) {
  // Apply the incremental P1 gas tumble about world axes. This avoids snapping
  // back to an absolute Euler angle when a previously liquid molecule escapes.
  const previousPhase = p.phase;
  p.phase += p.spin*dt*heat;
  if (p.free > 0) {
    p.previousFree.copy(freeOrientation(previousPhase,i)).invert();
    p.previousFree.premultiply(freeOrientation(p.phase,i));
    step.identity().slerp(p.previousFree,p.free);
    p.orientation.premultiply(step);
  }
  const thermal = .36 + Math.max(0,temperature)*.005;
  axis.set(Math.sin(p.phase+i), Math.cos(p.phase*.71-i), Math.sin(p.phase*.53+i))
    .multiplyScalar(thermal).add(p.torque).multiplyScalar(p.liquid);
  p.spinVelocity.lerp(axis,1-Math.exp(-6*dt));
  const speed = p.spinVelocity.length();
  if (speed > .0001) {
    axis.copy(p.spinVelocity).divideScalar(speed);
    p.orientation.premultiply(step.setFromAxisAngle(axis,speed*dt*p.liquid));
  }
  if(p.site && !p.site.orientation){
    axis.set(Math.cos(i),.7,Math.sin(i)).normalize();
    p.orientation.premultiply(step.setFromAxisAngle(axis,dt*p.frozen*p.spin*Math.max(.18,.65+temperature/45)));
  }
  if (p.site?.orientation) p.orientation.slerp(p.site.orientation,1-Math.exp(-9*p.frozen*dt));
  p.orientation.normalize();
}
