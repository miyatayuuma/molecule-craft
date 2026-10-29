import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const audit = JSON.parse(await readFile(new URL('../generated/reaction-lab-stage-a-audit.json', import.meta.url), 'utf8'));

test('RL-NB3 generated evidence keeps production on RL-1H when a gate fails', () => {
  assert.equal(audit.globalResult, 'FAIL');
  assert.equal(audit.productionCutover, false);
  assert.deepEqual(audit.failureClassification, ['needs-anisotropy-stage-b']);
  assert.equal(audit.fixtureProtocol.thermalNoise, 0);
});

test('24 seeded water dimers meet the distance, energy, linearity, and overlap gates', () => {
  const fixture = audit.fixtures['water-water'];
  assert.equal(fixture.orientationCount, 24);
  assert.equal(fixture.pass, true);
  assert.ok(fixture.lowestEnergyKcalMol >= -8 && fixture.lowestEnergyKcalMol <= -3.5);
  assert.ok(fixture.lowestEnergyGeometry.oxygenDistanceAngstrom >= 2.65 && fixture.lowestEnergyGeometry.oxygenDistanceAngstrom <= 3.15);
  assert.ok(fixture.lowestEnergyGeometry.donorLinearityDeg >= 150);
  assert.equal(fixture.guardActivationCount, 0);
});

test('acetone is isolated as acceptor-side directionality failure', () => {
  const { acceptorGeometry } = audit.fixtures['water-acetone'];
  assert.ok(acceptorGeometry.distance >= 1.7 && acceptorGeometry.distance <= 2.2);
  assert.ok(acceptorGeometry.donorAngle >= 145);
  assert.ok(acceptorGeometry.acceptorAngle >= 100 && acceptorGeometry.acceptorAngle <= 140);
  assert.ok(acceptorGeometry.outOfPlaneDeg > 35);
  for (const id of ['water-pyridine', 'water-methane', 'water-carbon-dioxide', 'water-oxygen', 'water-nitrogen', 'carbonic-acid-carbon-dioxide']) assert.equal(audit.fixtures[id].pass, true, id);
});

test('continuity, partner exchange, and drag evidence are finite and stateless', () => {
  for (const scan of Object.values(audit.continuity)) {
    assert.equal(scan.finite, true);
    assert.equal(scan.orientationScan.finite, true);
    assert.equal(scan.forceEnergyDerivativeCheck.pass, true);
    assert.equal(scan.normalRegionGuardActivations, 0);
    assert.ok(scan.samples.every(sample => Number.isFinite(sample.energyKcalMol) && sample.forceOnA.every(Number.isFinite) && sample.torqueOnA.every(Number.isFinite)));
  }
  assert.equal(audit.partnerExchange.pass, true);
  assert.equal(audit.partnerExchange.historyIndependent, true);
  assert.equal(audit.drag.pass, true);
  assert.ok(audit.drag.slow.followFraction >= 0.6);
  assert.ok(audit.drag.fast.followFraction <= 0.3);
});
