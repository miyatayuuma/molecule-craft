import test from 'node:test';
import assert from 'node:assert/strict';
import {runChoFieldPolishSimulation} from '../scripts/simulate-cho-field-polish.mjs';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';

const report=runChoFieldPolishSimulation();
const total=values=>Object.values(values??{}).reduce((sum,value)=>sum+(value??0),0);

test('CHO progression materials still produce each critical insight phase',()=>{
  assert.deepEqual(report.progression,{hydrogen:true,methane:true,oxygen:true,water:true});
  assert.equal(report.fresh.hydrogen.returnType,'voluntary');
  assert.ok(report.fresh.hydrogen.net.H>0,'fresh H exploration remains net-positive without propulsion spend');
  assert.equal(report.fresh.carbon.returnType,'voluntary');
  assert.ok(report.fresh.carbon.collected.C>0,'Carbon progression still yields C during ordinary play');
});

test('post-DRIVE H/C revisit loops stay optional and materially reward DRIVE movement',()=>{
  for(const [id,metric] of Object.entries(report.revisit)){
    assert.ok(Number.isFinite(metric.normal)&&Number.isFinite(metric.drive),`${id} revisit remains traversable with and without DRIVE`);
    assert.ok(metric.driveRatio<=.7,`${id} DRIVE must remain at least 30% faster: ${JSON.stringify(metric)}`);
  }
});

test('H/O stock-dependent economy suppresses repeat farming while preserving C state',()=>{
  const [low,mid,high]=report.stock;
  assert.ok(low.aggregate.H>mid.aggregate.H&&mid.aggregate.H>high.aggregate.H,JSON.stringify(report.stock));
  assert.ok(low.aggregate.O>mid.aggregate.O&&mid.aggregate.O>high.aggregate.O,JSON.stringify(report.stock));
  assert.equal(high.pockets.hydrogenRevisit,0,'high H stock removes the revisit farm reward');
  assert.equal(high.pockets.recovery,0,'high O stock removes the recovery farm reward');
  assert.equal(high.pockets.merge,0,'high O stock removes the merge farm reward');
  assert.equal(low.pockets.carbonRevisit,high.pockets.carbonRevisit,'H/O depletion must not silently change C revisit reward');
});

test('Oxygen Network identities are capability-driven rather than reward-table driven',()=>{
  const profiles=report.oxygen.profiles;
  assert.deepEqual(profiles['oxygen-shortcut'],{lanes:1,value:2,pressure:0,gates:2});
  assert.deepEqual(profiles['oxygen-main'],{lanes:2,value:2,pressure:370,gates:0});
  assert.deepEqual(profiles['oxygen-side'],{lanes:2,value:2,pressure:0,gates:0});

  const shortcut=report.oxygen.shortcut;
  assert.ok(shortcut.normal.reached&&shortcut.burst.reached,'shortcut keeps both normal skill bypass and direct BURST traversal');
  assert.equal(shortcut.burst.burstUses,2,'shortcut identity is exactly two localized H2 BURSTs');
  assert.ok(shortcut.burst.arrivalSeconds<shortcut.normal.arrivalSeconds*.7,JSON.stringify(shortcut));

  const main=report.oxygen.main;
  assert.ok(main.normal.reached&&main.drive.reached,'main route cannot become a DRIVE hard gate');
  assert.ok(main.drive.arrivalSeconds<main.normal.arrivalSeconds*.7,JSON.stringify(main));
  assert.equal(main.drive.overheatEvents,0,'main stays the stable sustained-DRIVE route');

  const side=report.oxygen.side;
  assert.ok(side.normal.reached&&side.dryDrive.reached&&side.cooledDrive.reached,'side remains open to all three traversal modes');
  assert.ok(side.dryDrive.overheatEvents>=1,'dry held DRIVE is interrupted by sustained side thermal exposure');
  assert.equal(side.cooledDrive.overheatEvents,0,'water keeps held DRIVE below overheat');
  assert.ok(side.cooledDrive.coolantUsed>0,'water thermostat actually spends coolant');
  const oNetRatio=Math.max(main.drive.net.O,side.cooledDrive.net.O)/Math.min(main.drive.net.O,side.cooledDrive.net.O);
  assert.ok(oNetRatio<1.2,`main/side DRIVE reward should not create an O-farm route identity: ${oNetRatio}`);
});

test('Deep Oxygen to CHO completes with voluntary return and protected threat semantics remain live',()=>{
  const final=report.deepToCho;
  assert.ok(final.reached&&final.destinationReached&&final.choCompleted,'network -> Deep -> CHO production traversal completes');
  assert.equal(final.returnType,'voluntary');
  assert.equal(final.overheatEvents,0,'cooled main/deep traversal remains stable');
  assert.ok(final.combustionSeconds>0&&final.cost.C>0&&final.cost.O>0,'final traversal records real COMBUSTION spend');

  const threat=report.threat.overstay;
  assert.equal(report.threat.captured,true,'overstay must still end in DUST EATER capture');
  assert.equal(threat.returnType,'forced');
  assert.ok(threat.maxEaters>0&&threat.dangerContacts>0&&threat.minEaterDistance<=38,'global pursuit reaches contact');
  assert.ok(total(threat.loss)>0,'forced return still loses collected cargo');
});

test('developer map is a coherent pre-DRIVE baseline plus post-DRIVE delta',()=>{
  const svg=buildFieldMapSvg();
  assert.doesNotMatch(svg,/id="route-hydrogen-revisit"/,'baseline layer must remain pre-DRIVE');
  assert.doesNotMatch(svg,/id="route-carbon-revisit"/,'baseline layer must remain pre-DRIVE');
  assert.match(svg,/id="post-drive-route-hydrogen-revisit"/);
  assert.match(svg,/id="post-drive-route-carbon-revisit"/);
  assert.match(svg,/data-revisit-current="hydrogen-revisit-current"/);
  assert.match(svg,/data-revisit-current="carbon-revisit-current"/);
  assert.match(svg,/data-pressure-gate="oxygen-shortcut:0"[^>]*data-pressure="600"/);
  assert.match(svg,/data-pressure-gate="oxygen-shortcut:1"[^>]*data-pressure="600"/);
  assert.match(svg,/max-sampled-heat=50/);
  assert.match(svg,/data-rest-stop="oxygen-main"/);
  assert.match(svg,/data-challenge="pulse"/);
  assert.match(svg,/data-signal="oxygen-network"/);
  assert.match(svg,/data-density-route="oxygen-side" data-density-tier="medium-long"[^>]*data-lanes="2" data-value="2"/);
});

console.log('CHO FIELD polish production baseline',JSON.stringify(report,null,2));
