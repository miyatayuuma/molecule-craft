import test from 'node:test';
import assert from 'node:assert/strict';
import {runPostAwakeningEconomyAudit} from '../scripts/audit-post-awakening-economy.mjs';

test('Theme F post-Awakening integrated economy remains production-green',()=>{
  // The existing destination-rotation test owns the 32-seed production
  // calibration. This regression focuses on the cross-system connections;
  // the full measurement remains the explicit audit-script path.
  const report=runPostAwakeningEconomyAudit({measureProduction:false});
  assert.equal(report.success.classification,'GREEN');
  assert.equal(report.baseline.productionBalanceChanged,false);
  assert.deepEqual(report.yields.medians,{H:57,C:136,O:298,N:49});
  assert.ok(Object.values(report.yields.calibration).every(row=>row.withinTwentyPercent));
  assert.deepEqual(Object.values(report.progression),['PASS','PASS','PASS','PASS','PASS','PASS','PASS','PASS',report.progression.softLockChecks]);
  assert.deepEqual(report.destinationRotation.balanced48,{veil:12,carbon:12,oxygen:12,nitrogen:12});
  for(const [element,row] of Object.entries(report.rareEconomy)){assert.ok(row.lowStock.selected>=1,`${element} has no low-stock supply`);assert.ok(row.lowStock.treatmentBatches>=1,`${element} cannot supply one Treatment batch`);assert.ok(row.replacedOrdinary>=0&&row.replacementFraction<=row.maxReplacementFraction,`${element} exceeded ordinary-resource replacement cap`);}
  assert.ok(report.rareEconomy.P.highStock.selected<=report.rareEconomy.P.lowStock.selected);
  assert.ok(report.s3Integration.nitromethane.event.remaining===2);
  assert.equal(report.s3Integration.oneWaveMultiPurpose,true);
  assert.ok(report.s3Integration.cases['A-intact-no-treatment'].rawElectricalIntensity>report.s3Integration.cases['B-fractured-no-treatment'].rawElectricalIntensity);
  assert.ok(report.s3Integration.cases['D-fractured-electrical-treatment'].rawElectricalIntensity>0);
  for(const scenario of Object.values(report.macro)){assert.equal(scenario.runCount,24);assert.equal(scenario.permanentStarvation,false);assert.ok(scenario.returnComparison.normal.runs>0);}
  console.log('Theme F integrated audit',JSON.stringify({yields:report.yields.medians,destinationRotation:report.destinationRotation.balanced48,rare:Object.fromEntries(Object.entries(report.rareEconomy).map(([id,row])=>[id,{low:row.lowStock.selected,high:row.highStock.selected}])),treatment:Object.fromEntries(Object.entries(report.treatment.passes).map(([id,row])=>[id,{after:row.chargeAfter,passes:row.expectedComparablePasses}])),macro:Object.fromEntries(Object.entries(report.macro).map(([id,row])=>[id,{start:row.startStock,end:row.endStock,events:row.importantEvents.length}]))}));
});
