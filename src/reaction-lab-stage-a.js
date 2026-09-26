// Stateless canonical Coulomb + Lennard-Jones rigid-body physics.
// All positions are Angstroms; no Three.js values or visual radii enter here.
export const REACTION_LAB_WORLD_UNITS_PER_ANGSTROM = 0.78;
export const COULOMB_KCAL_ANGSTROM_PER_MOL_E2 = 332.06371;
export const KCAL_MOL_AMU_TO_ANGSTROM_PS2 = 418.4;
export const STAGE_A_PHYSICAL_PS_PER_GAME_SECOND = 0.10;
export const STAGE_A_GAME_STEP_SECONDS = 1 / 120;
export const STAGE_A_MAX_CATCH_UP_STEPS = 8;
export const OVERLAP_GUARD_RADIUS_ANGSTROM = 0.35;

export const STANDARD_ATOMIC_MASS_AMU = Object.freeze({
  H: 1.008, C: 12.011, N: 14.007, O: 15.999,
  F: 18.998403163, P: 30.973761998, S: 32.06, Cl: 35.45,
});

const vec = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a, value) => [a[0] * value, a[1] * value, a[2] * value];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => Math.hypot(a[0], a[1], a[2]);
const finiteVector = a => a.length === 3 && a.every(Number.isFinite);

function quaternionNormalize(q = [0, 0, 0, 1]) {
  const magnitude = Math.hypot(q[0], q[1], q[2], q[3]);
  return magnitude > 1e-15 ? q.map(value => value / magnitude) : [0, 0, 0, 1];
}

function quaternionRotate(qValue, point) {
  const [x, y, z, w] = quaternionNormalize(qValue);
  const u = [x, y, z];
  return add(point, add(scale(cross(u, point), 2 * w), scale(cross(u, cross(u, point)), 2)));
}

function quaternionMultiply(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
}

export function rigidBodyMassProperties(atoms) {
  if (!Array.isArray(atoms) || !atoms.length) throw new Error('A rigid body needs at least one real atom.');
  const masses = atoms.map(atom => {
    const mass = STANDARD_ATOMIC_MASS_AMU[atom.element];
    if (!Number.isFinite(mass)) throw new Error(`No standard atomic mass for ${atom.element}.`);
    return mass;
  });
  const totalMassAmu = masses.reduce((sum, mass) => sum + mass, 0);
  const centerOfMassAngstrom = atoms.reduce((sum, atom, index) => add(sum, scale(atom.positionAngstrom, masses[index])), vec()).map(value => value / totalMassAmu);
  const centeredPositionsAngstrom = atoms.map(atom => sub(atom.positionAngstrom, centerOfMassAngstrom));
  const inertiaTensorAmuAngstrom2 = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let index = 0; index < atoms.length; index++) {
    const r = centeredPositionsAngstrom[index], mass = masses[index], rr = dot(r, r);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      inertiaTensorAmuAngstrom2[row][column] += mass * ((row === column ? rr : 0) - r[row] * r[column]);
    }
  }
  return { totalMassAmu, centerOfMassAngstrom, centeredPositionsAngstrom, inertiaTensorAmuAngstrom2 };
}

// A C1-continuous soft core active only inside severe overlap. At the boundary
// it matches both distance and first derivative, leaving normal interactions
// exactly canonical and making force the derivative of the reported energy.
function guardedRadius(radius, boundary = OVERLAP_GUARD_RADIUS_ANGSTROM) {
  if (radius >= boundary) return { effectiveRadius: radius, derivative: 1, active: false };
  const ratio = Math.max(0, radius / boundary);
  return { effectiveRadius: boundary * (0.5 + 0.5 * ratio * ratio), derivative: ratio, active: true };
}

function radialForceVector(forceMagnitude, delta, radius, fallbackDirection) {
  if (radius > 1e-14) return scale(delta, forceMagnitude / radius);
  if (forceMagnitude === 0) return vec();
  const direction = finiteVector(fallbackDirection) && norm(fallbackDirection) > 1e-14 ? fallbackDirection : [1, 0, 0];
  return scale(direction, forceMagnitude / norm(direction));
}

export function coulombPairEnergyForce(chargeA, chargeB, deltaAngstrom, { guardRadiusAngstrom = OVERLAP_GUARD_RADIUS_ANGSTROM, fallbackDirection } = {}) {
  const radius = norm(deltaAngstrom);
  if (!Number.isFinite(radius) || !chargeA || !chargeB) return { energyKcalMol: 0, forceOnA: vec(), guarded: false };
  const guard = guardedRadius(radius, guardRadiusAngstrom);
  const product = COULOMB_KCAL_ANGSTROM_PER_MOL_E2 * chargeA * chargeB;
  const energyKcalMol = product / guard.effectiveRadius;
  const derivative = -product / (guard.effectiveRadius ** 2) * guard.derivative;
  return { energyKcalMol, forceOnA: radialForceVector(derivative, deltaAngstrom, radius, fallbackDirection), guarded: guard.active };
}

export function lorentzBerthelot(sigmaA, epsilonA, sigmaB, epsilonB) {
  if (![sigmaA, epsilonA, sigmaB, epsilonB].every(Number.isFinite) || sigmaA <= 0 || sigmaB <= 0 || epsilonA < 0 || epsilonB < 0) throw new Error('Invalid Lennard-Jones parameters.');
  return { sigmaAngstrom: (sigmaA + sigmaB) / 2, epsilonKcalMol: Math.sqrt(epsilonA * epsilonB) };
}

export function lennardJonesPairEnergyForce(sigmaA, epsilonA, sigmaB, epsilonB, deltaAngstrom, { guardRadiusAngstrom = OVERLAP_GUARD_RADIUS_ANGSTROM, fallbackDirection } = {}) {
  const radius = norm(deltaAngstrom), mixed = lorentzBerthelot(sigmaA, epsilonA, sigmaB, epsilonB);
  if (!Number.isFinite(radius) || mixed.epsilonKcalMol === 0) return { ...mixed, energyKcalMol: 0, forceOnA: vec(), guarded: false };
  const guard = guardedRadius(radius, guardRadiusAngstrom), ratio = mixed.sigmaAngstrom / guard.effectiveRadius;
  const sixth = ratio ** 6, twelfth = sixth * sixth;
  const energyKcalMol = 4 * mixed.epsilonKcalMol * (twelfth - sixth);
  const derivative = 24 * mixed.epsilonKcalMol * (sixth - 2 * twelfth) / guard.effectiveRadius * guard.derivative;
  return { ...mixed, energyKcalMol, forceOnA: radialForceVector(derivative, deltaAngstrom, radius, fallbackDirection), guarded: guard.active };
}

function rotateTensor(tensor, quaternion) {
  const basis = [quaternionRotate(quaternion, [1, 0, 0]), quaternionRotate(quaternion, [0, 1, 0]), quaternionRotate(quaternion, [0, 0, 1])];
  const rotation = [[basis[0][0], basis[1][0], basis[2][0]], [basis[0][1], basis[1][1], basis[2][1]], [basis[0][2], basis[1][2], basis[2][2]]];
  const multiply = (a, b) => a.map(row => b[0].map((_, column) => row.reduce((sum, value, index) => sum + value * b[index][column], 0)));
  const transpose = matrix => matrix[0].map((_, column) => matrix.map(row => row[column]));
  return multiply(multiply(rotation, tensor), transpose(rotation));
}

function symmetricPseudoInverseMultiply(matrixValue, vectorValue) {
  // Jacobi eigen decomposition yields a stable Moore-Penrose inverse for the
  // zero principal moment of linear molecules without amplifying that axis.
  const a = matrixValue.map(row => [...row]), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 24; iteration++) {
    let p = 0, q = 1;
    if (Math.abs(a[0][2]) > Math.abs(a[p][q])) [p, q] = [0, 2];
    if (Math.abs(a[1][2]) > Math.abs(a[p][q])) [p, q] = [1, 2];
    if (Math.abs(a[p][q]) < 1e-14) break;
    const angle = 0.5 * Math.atan2(2 * a[p][q], a[q][q] - a[p][p]), c = Math.cos(angle), s = Math.sin(angle);
    for (let k = 0; k < 3; k++) {
      if (k === p || k === q) continue;
      const apk = a[p][k], aqk = a[q][k];
      a[p][k] = a[k][p] = c * apk - s * aqk;
      a[q][k] = a[k][q] = s * apk + c * aqk;
    }
    const app = a[p][p], aqq = a[q][q], apq = a[p][q];
    a[p][p] = c * c * app - 2 * s * c * apq + s * s * aqq;
    a[q][q] = s * s * app + 2 * s * c * apq + c * c * aqq;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
  }
  const eigenvalues = [a[0][0], a[1][1], a[2][2]], maximum = Math.max(0, ...eigenvalues), threshold = Math.max(1e-12, maximum * 1e-10);
  const transformed = v[0].map((_, column) => dot([v[0][column], v[1][column], v[2][column]], vectorValue));
  const coefficients = eigenvalues.map((value, index) => value > threshold ? transformed[index] / value : 0);
  return [0, 1, 2].map(row => coefficients.reduce((sum, value, index) => sum + v[row][index] * value, 0));
}

function bodySitePosition(body, localPosition) { return add(body.positionAngstrom, quaternionRotate(body.orientation, localPosition)); }
function stableFallback(a, b) {
  const seed = `${a.bodyId}:${a.kind}:${a.index}|${b.bodyId}:${b.kind}:${b.index}`;
  let hash = 2166136261;
  for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const axis = Math.abs(hash % 3), sign = (hash & 4) ? -1 : 1;
  return axis === 0 ? [sign, 0, 0] : axis === 1 ? [0, sign, 0] : [0, 0, sign];
}

export function evaluateStageAForces(bodies, { excludedMoleculePairs = new Set(), collectPairDiagnostics = true } = {}) {
  const results = new Map(bodies.map(body => [body.id, { forceKcalMolAngstrom: vec(), torqueKcalMolAngstrom: vec(), energyKcalMol: 0 }]));
  const pairDiagnostics = [];
  let overlapGuardActivationCount = 0;
  const sitesFor = body => [
    ...(body.atoms ?? []).map((atom, index) => ({ bodyId: body.id, kind: 'atom', index, chargeE: atom.chargeE, localPositionAngstrom: atom.positionAngstrom, atom })),
    ...(body.virtualChargeSites ?? []).map((site, index) => ({ bodyId: body.id, kind: 'virtual', index, chargeE: site.chargeE, localPositionAngstrom: site.positionAngstrom, atom: null })),
  ];
  for (let leftIndex = 0; leftIndex < bodies.length; leftIndex++) for (let rightIndex = leftIndex + 1; rightIndex < bodies.length; rightIndex++) {
    const left = bodies[leftIndex], right = bodies[rightIndex], pairName = [left.id, right.id].sort().join('|');
    if (excludedMoleculePairs.has(pairName)) continue;
    const leftResult = results.get(left.id), rightResult = results.get(right.id), sitePairs = new Map();
    const getPair = (siteA, siteB, positionA, positionB) => {
      const key = `${siteA.kind}:${siteA.index}|${siteB.kind}:${siteB.index}`;
      if (!sitePairs.has(key)) sitePairs.set(key, { bodyAId: left.id, siteA: { kind: siteA.kind, index: siteA.index }, bodyBId: right.id, siteB: { kind: siteB.kind, index: siteB.index }, positionA, positionB, coulombEnergyKcalMol: 0, ljEnergyKcalMol: 0, coulombForceOnA: vec(), ljForceOnA: vec(), forceOnA: vec(), torqueOnA: vec(), torqueOnB: vec(), overlapGuarded: false });
      return sitePairs.get(key);
    };
    const leftSites = sitesFor(left), rightSites = sitesFor(right);
    for (const siteA of leftSites) for (const siteB of rightSites) {
      if (!siteA.chargeE || !siteB.chargeE) continue;
      const positionA = bodySitePosition(left, siteA.localPositionAngstrom), positionB = bodySitePosition(right, siteB.localPositionAngstrom), delta = sub(positionB, positionA), fallbackDirection = stableFallback(siteA, siteB);
      const term = coulombPairEnergyForce(siteA.chargeE, siteB.chargeE, delta, { fallbackDirection }), pair = getPair(siteA, siteB, positionA, positionB);
      pair.coulombEnergyKcalMol += term.energyKcalMol; pair.coulombForceOnA = add(pair.coulombForceOnA, term.forceOnA); pair.forceOnA = add(pair.forceOnA, term.forceOnA); pair.overlapGuarded ||= term.guarded;
      leftResult.energyKcalMol += term.energyKcalMol / 2; rightResult.energyKcalMol += term.energyKcalMol / 2;
      leftResult.forceKcalMolAngstrom = add(leftResult.forceKcalMolAngstrom, term.forceOnA); rightResult.forceKcalMolAngstrom = sub(rightResult.forceKcalMolAngstrom, term.forceOnA);
      const torqueA = cross(sub(positionA, left.positionAngstrom), term.forceOnA), torqueB = cross(sub(positionB, right.positionAngstrom), scale(term.forceOnA, -1));
      leftResult.torqueKcalMolAngstrom = add(leftResult.torqueKcalMolAngstrom, torqueA); rightResult.torqueKcalMolAngstrom = add(rightResult.torqueKcalMolAngstrom, torqueB);
      pair.torqueOnA = add(pair.torqueOnA, torqueA); pair.torqueOnB = add(pair.torqueOnB, torqueB);
      if (term.guarded) overlapGuardActivationCount++;
    }
    for (const siteA of leftSites) {
      if (!siteA.atom) continue;
      const positionA = bodySitePosition(left, siteA.localPositionAngstrom);
      for (const siteB of rightSites) {
        if (!siteB.atom) continue;
        const positionB = bodySitePosition(right, siteB.localPositionAngstrom), delta = sub(positionB, positionA), fallbackDirection = stableFallback(siteA, siteB);
        const atomA = siteA.atom, atomB = siteB.atom;
        const term = lennardJonesPairEnergyForce(atomA.sigmaAngstrom, atomA.epsilonKcalMol, atomB.sigmaAngstrom, atomB.epsilonKcalMol, delta, { fallbackDirection });
        const pair = getPair(siteA, siteB, positionA, positionB);
        const guardAlreadyCounted = pair.overlapGuarded;
        pair.ljEnergyKcalMol += term.energyKcalMol; pair.ljForceOnA = add(pair.ljForceOnA, term.forceOnA); pair.forceOnA = add(pair.forceOnA, term.forceOnA); pair.overlapGuarded ||= term.guarded;
        leftResult.energyKcalMol += term.energyKcalMol / 2; rightResult.energyKcalMol += term.energyKcalMol / 2;
        leftResult.forceKcalMolAngstrom = add(leftResult.forceKcalMolAngstrom, term.forceOnA); rightResult.forceKcalMolAngstrom = sub(rightResult.forceKcalMolAngstrom, term.forceOnA);
        const torqueA = cross(sub(positionA, left.positionAngstrom), term.forceOnA), torqueB = cross(sub(positionB, right.positionAngstrom), scale(term.forceOnA, -1));
        leftResult.torqueKcalMolAngstrom = add(leftResult.torqueKcalMolAngstrom, torqueA); rightResult.torqueKcalMolAngstrom = add(rightResult.torqueKcalMolAngstrom, torqueB);
        pair.torqueOnA = add(pair.torqueOnA, torqueA); pair.torqueOnB = add(pair.torqueOnB, torqueB);
        if (term.guarded && !guardAlreadyCounted) overlapGuardActivationCount++;
      }
    }
    if (collectPairDiagnostics) for (const pair of sitePairs.values()) pairDiagnostics.push({ ...pair, totalEnergyKcalMol: pair.coulombEnergyKcalMol + pair.ljEnergyKcalMol, coulombForce: pair.coulombForceOnA, ljForce: pair.ljForceOnA, totalForce: pair.forceOnA });
  }
  return { bodies: results, pairDiagnostics, overlapGuardActivationCount };
}

export function createStageABody({ id, positionAngstrom, orientation = [0, 0, 0, 1], velocityAngstromPerPs = [0, 0, 0], angularVelocityRadPerPs = [0, 0, 0], atoms, virtualChargeSites = [], massProperties = null }) {
  const properties = massProperties ?? rigidBodyMassProperties(atoms);
  return { id, positionAngstrom: [...positionAngstrom], orientation: quaternionNormalize(orientation), velocityAngstromPerPs: [...velocityAngstromPerPs], angularVelocityRadPerPs: [...angularVelocityRadPerPs], atoms: atoms.map((atom, index) => ({ ...atom, positionAngstrom: [...(properties.centeredPositionsAngstrom?.[index] ?? atom.positionAngstrom)], massAmu: STANDARD_ATOMIC_MASS_AMU[atom.element] })), virtualChargeSites: virtualChargeSites.map(site => ({ ...site, positionAngstrom: [...site.positionAngstrom] })), massAmu: properties.totalMassAmu, inertiaTensorAmuAngstrom2: properties.inertiaTensorAmuAngstrom2.map(row => [...row]) };
}

export function integrateStageA(bodies, physicalDeltaPs, { excludedMoleculePairs = new Set(), linearDampingPerPs = 9.08, angularDampingPerPs = 37.1 } = {}) {
  if (!Number.isFinite(physicalDeltaPs) || physicalDeltaPs < 0) throw new Error('Physical timestep must be finite and non-negative.');
  const forces = evaluateStageAForces(bodies, { excludedMoleculePairs, collectPairDiagnostics: true });
  for (const body of bodies) {
    if (body.kinematic) continue;
    const state = forces.bodies.get(body.id), acceleration = scale(state.forceKcalMolAngstrom, KCAL_MOL_AMU_TO_ANGSTROM_PS2 / body.massAmu);
    body.velocityAngstromPerPs = scale(add(body.velocityAngstromPerPs, scale(acceleration, physicalDeltaPs)), Math.exp(-linearDampingPerPs * physicalDeltaPs));
    body.positionAngstrom = add(body.positionAngstrom, scale(body.velocityAngstromPerPs, physicalDeltaPs));
    const worldInertia = rotateTensor(body.inertiaTensorAmuAngstrom2, body.orientation);
    const angularAcceleration = scale(symmetricPseudoInverseMultiply(worldInertia, state.torqueKcalMolAngstrom), KCAL_MOL_AMU_TO_ANGSTROM_PS2);
    body.angularVelocityRadPerPs = scale(add(body.angularVelocityRadPerPs, scale(angularAcceleration, physicalDeltaPs)), Math.exp(-angularDampingPerPs * physicalDeltaPs));
    const omega = body.angularVelocityRadPerPs, omegaQuaternion = [omega[0], omega[1], omega[2], 0];
    body.orientation = quaternionNormalize(quaternionMultiply(omegaQuaternion, body.orientation).map((value, index) => body.orientation[index] + 0.5 * value * physicalDeltaPs));
  }
  return forces;
}

export function createFixedStepAccumulator(step, { gameStepSeconds = STAGE_A_GAME_STEP_SECONDS, physicalPsPerGameSecond = STAGE_A_PHYSICAL_PS_PER_GAME_SECOND, maxCatchUpSteps = STAGE_A_MAX_CATCH_UP_STEPS } = {}) {
  if (typeof step !== 'function' || !(gameStepSeconds > 0) || !(physicalPsPerGameSecond > 0) || !Number.isInteger(maxCatchUpSteps) || maxCatchUpSteps < 1) throw new Error('Invalid fixed-step accumulator configuration.');
  let accumulator = 0;
  return {
    advance(renderDeltaSeconds) {
      const delta = Number.isFinite(renderDeltaSeconds) ? Math.max(0, Math.min(renderDeltaSeconds, gameStepSeconds * maxCatchUpSteps)) : 0;
      accumulator = Math.min(accumulator + delta, gameStepSeconds * maxCatchUpSteps);
      let steps = 0;
      while (accumulator + 1e-12 >= gameStepSeconds && steps < maxCatchUpSteps) {
        step(gameStepSeconds * physicalPsPerGameSecond);
        accumulator -= gameStepSeconds; steps++;
      }
      return { steps, interpolationAlpha: accumulator / gameStepSeconds, droppedGameSeconds: Math.max(0, renderDeltaSeconds - delta) };
    },
    reset() { accumulator = 0; },
    get remainderGameSeconds() { return accumulator; },
  };
}

export function stageABodySnapshot(body) {
  return { id: body.id, massAmu: body.massAmu, centerOfMassAngstrom: [...body.positionAngstrom], inertiaTensorAmuAngstrom2: body.inertiaTensorAmuAngstrom2.map(row => [...row]), positionAngstrom: [...body.positionAngstrom], orientation: [...body.orientation], velocityAngstromPerPs: [...body.velocityAngstromPerPs], angularVelocityRadPerPs: [...body.angularVelocityRadPerPs] };
}
