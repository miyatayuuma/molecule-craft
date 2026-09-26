import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  COULOMB_KCAL_ANGSTROM_PER_MOL_E2,
  OVERLAP_GUARD_RADIUS_ANGSTROM,
  OVERLAP_GUARD_SIGMA_FRACTION,
  REACTION_LAB_WORLD_UNITS_PER_ANGSTROM,
  STAGE_A_GAME_STEP_SECONDS,
  STAGE_A_PHYSICAL_PS_PER_GAME_SECOND,
  STANDARD_ATOMIC_MASS_AMU,
  coulombPairEnergyForce,
  createFixedStepAccumulator,
  createStageABody,
  evaluateStageAForces,
  integrateStageA,
  lennardJonesPairEnergyForce,
  lorentzBerthelot,
  rigidBodyMassProperties,
} from '../src/reaction-lab-stage-a.js';

const close = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
const closeRelative = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(actual), Math.abs(expected)), `${actual} != ${expected} within relative tolerance ${tolerance}`);
const atom = (element = 'C', positionAngstrom = [0, 0, 0], chargeE = 0, sigmaAngstrom = 3.4, epsilonKcalMol = 0.1) => ({ element, positionAngstrom, chargeE, sigmaAngstrom, epsilonKcalMol });
const body = (id, x, atoms, extra = {}) => createStageABody({ id, positionAngstrom: [x, 0, 0], atoms, ...extra });

test('canonical unit constants and atomic masses are centralized', () => {
  assert.equal(REACTION_LAB_WORLD_UNITS_PER_ANGSTROM, 0.78);
  assert.equal(STAGE_A_GAME_STEP_SECONDS, 1 / 120);
  assert.equal(STAGE_A_PHYSICAL_PS_PER_GAME_SECOND, 0.1);
  assert.deepEqual(Object.keys(STANDARD_ATOMIC_MASS_AMU).sort(), ['C', 'Cl', 'F', 'H', 'N', 'O', 'P', 'S']);
});

test('Coulomb sign and magnitude use canonical kcal/mol and Angstrom units', () => {
  const repulsion = coulombPairEnergyForce(1, 1, [2, 0, 0]);
  const attraction = coulombPairEnergyForce(1, -1, [2, 0, 0]);
  close(repulsion.energyKcalMol, COULOMB_KCAL_ANGSTROM_PER_MOL_E2 / 2);
  close(repulsion.forceOnA[0], -COULOMB_KCAL_ANGSTROM_PER_MOL_E2 / 4);
  close(attraction.energyKcalMol, -repulsion.energyKcalMol);
  close(attraction.forceOnA[0], -repulsion.forceOnA[0]);
});

test('Lorentz-Berthelot mixing combines sigma arithmetically and epsilon geometrically', () => {
  assert.deepEqual(lorentzBerthelot(3, 0.04, 5, 0.25), { sigmaAngstrom: 4, epsilonKcalMol: 0.1 });
});

test('LJ minimum, dispersion attraction, short-range repulsion and energy-force consistency', () => {
  const sigma = 3.5, epsilon = 0.22, minimum = 2 ** (1 / 6) * sigma;
  const atMinimum = lennardJonesPairEnergyForce(sigma, epsilon, sigma, epsilon, [minimum, 0, 0]);
  close(atMinimum.energyKcalMol, -epsilon, 1e-10); close(atMinimum.forceOnA[0], 0, 1e-10);
  assert.ok(lennardJonesPairEnergyForce(sigma, epsilon, sigma, epsilon, [2 * sigma, 0, 0]).forceOnA[0] > 0);
  assert.ok(lennardJonesPairEnergyForce(sigma, epsilon, sigma, epsilon, [sigma, 0, 0]).forceOnA[0] < 0);
  const r = 4.2, h = 1e-5;
  const energy = distance => lennardJonesPairEnergyForce(sigma, epsilon, sigma, epsilon, [distance, 0, 0]).energyKcalMol;
  const derivative = (energy(r + h) - energy(r - h)) / (2 * h);
  close(lennardJonesPairEnergyForce(sigma, epsilon, sigma, epsilon, [r, 0, 0]).forceOnA[0], derivative, 1e-7);
});

test('Coulomb force is the negative energy gradient with respect to separation', () => {
  const r = 2.1, h = 1e-6, energy = distance => coulombPairEnergyForce(0.3, -0.4, [distance, 0, 0]).energyKcalMol;
  const derivative = (energy(r + h) - energy(r - h)) / (2 * h);
  close(coulombPairEnergyForce(0.3, -0.4, [r, 0, 0]).forceOnA[0], derivative, 1e-6);
});

test('intermolecular forces obey Newton third law and have no distance cutoff', () => {
  const left = body('left', 0, [atom('C', [0, 0, 0], 0.4)]), right = body('right', 100, [atom('O', [0, 0, 0], -0.4)]);
  const evaluated = evaluateStageAForces([left, right]);
  assert.notEqual(evaluated.pairDiagnostics[0].coulombEnergyKcalMol, 0);
  assert.notEqual(evaluated.pairDiagnostics[0].ljEnergyKcalMol, 0);
  const a = evaluated.bodies.get('left').forceKcalMolAngstrom, b = evaluated.bodies.get('right').forceKcalMolAngstrom;
  close(a[0] + b[0], 0); close(a[1] + b[1], 0); close(a[2] + b[2], 0);
});

test('full inertia tensor and molecular mass/COM derive from standard atomic masses', () => {
  const properties = rigidBodyMassProperties([
    atom('O', [0, 0, 0]), atom('H', [1, 0, 0]), atom('H', [0, 1, 0]),
  ]);
  close(properties.totalMassAmu, 18.015);
  close(properties.centerOfMassAngstrom[0], 1.008 / 18.015);
  close(properties.centerOfMassAngstrom[1], 1.008 / 18.015);
  const line = rigidBodyMassProperties([atom('C', [-1, 0, 0]), atom('C', [1, 0, 0])]);
  close(line.inertiaTensorAmuAngstrom2[0][0], 0, 1e-12);
  close(line.inertiaTensorAmuAngstrom2[1][1], 2 * 12.011, 1e-9);
  close(line.inertiaTensorAmuAngstrom2[2][2], 2 * 12.011, 1e-9);
});

test('off-center real atom and virtual charge-site forces contribute torque about COM', () => {
  const a = createStageABody({ id: 'a', positionAngstrom: [0, 0, 0], atoms: [atom('C', [0, 0, 0], 0, 1, 0)], virtualChargeSites: [{ chargeE: 1, positionAngstrom: [0, 1, 0] }] });
  const b = body('b', 2, [atom('O', [0, 1, 0], 1, 1, 0)]);
  const result = evaluateStageAForces([a, b]);
  assert.ok(result.pairDiagnostics.some(pair => pair.siteA.kind === 'virtual' && pair.coulombEnergyKcalMol !== 0));
  assert.ok(Math.abs(result.bodies.get('a').torqueKcalMolAngstrom[2]) > 0);
  close(result.bodies.get('a').forceKcalMolAngstrom[0] + result.bodies.get('b').forceKcalMolAngstrom[0], 0);
});

test('linear molecule pseudo-inverse safely ignores its singular principal axis', () => {
  const a = body('linear', 0, [atom('C', [-1, 0, 0], 1, 1, 0), atom('C', [1, 0, 0], -1, 1, 0)]);
  const b = body('partner', 2, [atom('H', [0, 1, 0], 1, 1, 0)]);
  integrateStageA([a, b], 0.001);
  assert.ok(a.angularVelocityRadPerPs.every(Number.isFinite));
  assert.ok(Math.hypot(...a.angularVelocityRadPerPs) < 1e3);
});

test('overlap guard stays finite, is continuous at its boundary, and reports activations', () => {
  const sigma = 3.4, r = sigma * OVERLAP_GUARD_SIGMA_FRACTION, h = 1e-8;
  const justInside = lennardJonesPairEnergyForce(sigma, 0.1, sigma, 0.1, [r - h, 0, 0]);
  const justOutside = lennardJonesPairEnergyForce(sigma, 0.1, sigma, 0.1, [r + h, 0, 0]);
  closeRelative(justInside.energyKcalMol, justOutside.energyKcalMol, 1e-6);
  closeRelative(justInside.forceOnA[0], justOutside.forceOnA[0], 1e-6);
  assert.ok(justInside.forceOnA[0] < 0);
  const severe = evaluateStageAForces([body('a', 0, [atom()]), body('b', 0.1, [atom()])]);
  assert.ok(severe.overlapGuardActivationCount > 0);
  assert.ok(severe.pairDiagnostics.every(pair => pair.forceOnA.every(Number.isFinite) && Number.isFinite(pair.totalEnergyKcalMol)));
  const overlappingBodies=[body('overlap-a',0,[atom('C',[0,0,0],0,3.4,0.1)]),body('overlap-b',0.1,[atom('C',[0,0,0],0,3.4,0.1)])];
  integrateStageA(overlappingBodies,STAGE_A_GAME_STEP_SECONDS*STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);
  assert.ok(overlappingBodies.every(item=>item.positionAngstrom.every(Number.isFinite)&&item.velocityAngstromPerPs.every(Number.isFinite)));
  assert.ok(overlappingBodies.every(item=>Math.hypot(...item.positionAngstrom)<1),'Severe overlap guard keeps a fixed Stage A step bounded');
  const acceptance = evaluateStageAForces([body('far-a', 0, [atom()]), body('far-b', 5, [atom()])]);
  assert.equal(acceptance.overlapGuardActivationCount, 0);
});

test('fixed-step accumulator is deterministic across render-frame subdivision and bounds catch-up', () => {
  const make = () => [body('a', 0, [atom('C', [0, 0, 0], 0, 3.4, 0.1)]), body('b', 4.5, [atom('C', [0, 0, 0], 0, 3.4, 0.1)])];
  const oneFrame = make(), splitFrames = make();
  const runA = createFixedStepAccumulator(dt => integrateStageA(oneFrame, dt)), runB = createFixedStepAccumulator(dt => integrateStageA(splitFrames, dt));
  runA.advance(1 / 60); runB.advance(1 / 120); runB.advance(1 / 120);
  for (let index = 0; index < 2; index++) {
    close(oneFrame[index].positionAngstrom[0], splitFrames[index].positionAngstrom[0], 1e-12);
    close(oneFrame[index].velocityAngstromPerPs[0], splitFrames[index].velocityAngstromPerPs[0], 1e-12);
  }
  const deltas = [], bounded = createFixedStepAccumulator(dt => deltas.push(dt));
  const result = bounded.advance(1);
  assert.equal(result.steps, 8); assert.equal(deltas.length, 8);
  close(deltas[0], STAGE_A_GAME_STEP_SECONDS * STAGE_A_PHYSICAL_PS_PER_GAME_SECOND);
  assert.ok(result.droppedGameSeconds > 0);
});

test('Stage A engine has no hydrogen-bond tracker/state implementation dependency', async () => {
  const source = await readFile(new URL('../src/reaction-lab-stage-a.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /hydrogenBondTracker|formationDistance|breakDistance|occupancy|challenger|cooldown|hbond/i);
});
