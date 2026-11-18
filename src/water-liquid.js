import { Euler, Quaternion, Vector3 } from '../vendor/three/three.core.min.js';
import { createStageABody, evaluateStageAForces } from './reaction-lab-stage-a.js';

// 0.215 display units per O–H bond in the P1 model. Both the drawn atom
// offsets and Stage A sites are relative to the same molecular centre of mass.
export const DISPLAY_PER_ANGSTROM = .215 / .9572;
const halfAngle = 52.25 * Math.PI / 180;
const tipX = .9572 * Math.sin(halfAngle), tipY = .9572 * Math.cos(halfAngle);
const localSites = [[0,0,0], [-tipX,tipY,0], [tipX,tipY,0]];
const euler = new Euler(), step = new Quaternion(), axis = new Vector3();
const freeOrientation = (phase, i) => step.setFromEuler(euler.set(phase+i,phase*.66+i*.41,phase*.36+i*.83));

export function initializeWater(p, i, record) {
  const atoms = record.atoms.map((element,k) => ({
    element, positionAngstrom:localSites[k], chargeE:record.nonbonded.atomicChargesE[k],
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

export function sampleInteractions(particles) {
  const active = [];
  for (const p of particles) {
    p.force.set(0,0,0);
    p.torque.set(0,0,0);
    if (p.liquid <= .001) continue;
    p.body.positionAngstrom[0] = p.x / DISPLAY_PER_ANGSTROM;
    p.body.positionAngstrom[1] = p.y / DISPLAY_PER_ANGSTROM;
    p.body.positionAngstrom[2] = p.z / DISPLAY_PER_ANGSTROM;
    p.orientation.toArray(p.body.orientation);
    active.push(p.body);
  }
  if (active.length < 2) return;
  const result = evaluateStageAForces(active, {collectPairDiagnostics:false});
  for (const body of active) {
    const p = particles[body.id], state = result.bodies.get(body.id);
    bounded(p.torque,state.torqueKcalMolAngstrom,.64,4.2);
    bounded(p.force,state.forceKcalMolAngstrom,.48,2.8);
  }
}

export function turnWater(p, i, dt, heat, temperature) {
  // Apply the incremental P1 gas tumble about world axes. This avoids snapping
  // back to an absolute Euler angle when a previously liquid molecule escapes.
  p.phase += p.spin*dt*heat;
  const current = freeOrientation(p.phase,i);
  axis.set(0,0,0);
  if (p.free > 0) {
    p.previousFree.invert();
    p.previousFree.premultiply(current);
    step.identity().slerp(p.previousFree,p.free);
    p.orientation.premultiply(step);
  }
  p.previousFree.copy(freeOrientation(p.phase,i));
  const thermal = .36 + Math.max(0,temperature)*.005;
  axis.set(Math.sin(p.phase+i), Math.cos(p.phase*.71-i), Math.sin(p.phase*.53+i))
    .multiplyScalar(thermal).add(p.torque).multiplyScalar(p.liquid);
  p.spinVelocity.lerp(axis,1-Math.exp(-6*dt));
  const speed = p.spinVelocity.length();
  if (speed > .0001) {
    axis.copy(p.spinVelocity).divideScalar(speed);
    p.orientation.premultiply(step.setFromAxisAngle(axis,speed*dt*p.liquid));
  }
  if (p.site) p.orientation.slerp(p.site.orientation,1-Math.exp(-9*p.frozen*dt));
  p.orientation.normalize();
}
