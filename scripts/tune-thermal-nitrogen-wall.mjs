import fs from 'node:fs';

function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);if(first<0)throw new Error(`Missing tune anchor: ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Ambiguous tune anchor: ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const oxygenPath='src/veil/oxygen-routes.js';
let oxygen=fs.readFileSync(oxygenPath,'utf8');
oxygen=replaceOnce(oxygen,
  'routePressure:330,offRoutePressure:500,combustionHeatFactor:1.4,maxHeat:50,',
  'routePressure:380,offRoutePressure:560,combustionHeatFactor:.8,maxHeat:50,',
  'frontier wall tuning');
fs.writeFileSync(oxygenPath,oxygen);

const testPath='tests/oxygen-frontier-wall.test.mjs';
let test=fs.readFileSync(testPath,'utf8');
test=replaceOnce(test,'assert.equal(wall.routePressure,330);','assert.equal(wall.routePressure,380);','route pressure expectation');
test=replaceOnce(test,'assert.equal(wall.offRoutePressure,500);','assert.equal(wall.offRoutePressure,560);','off-route pressure expectation');
test=replaceOnce(test,"assert.equal(center.traversableRoutePressure,330,'best frontier line still carries strong reverse pressure');","assert.equal(center.traversableRoutePressure,null,'frontier wall must bypass route-pressure anti-pinning protection');\nassert.equal(center.frontierWallPressure,380,'best frontier line carries the authored physical reverse pressure');",'center pressure expectation');
test=replaceOnce(test,"assert.equal(edge.traversableRoutePressure,500,'leaving the intended line should be substantially worse');","assert.equal(edge.traversableRoutePressure,null,'off-line wall pressure is also physical rather than route guidance');\nassert.equal(edge.frontierWallPressure,560,'leaving the intended line should be substantially worse');",'edge pressure expectation');
test=replaceOnce(test,"assert.ok(center.combustionHeatFactor>=2.35,'continuous DRIVE should accumulate heat rapidly in the frontier wall');","assert.ok(center.combustionHeatFactor>=1.75,'continuous DRIVE should accumulate heat across the sustained frontier wall');",'heat factor expectation');
fs.writeFileSync(testPath,test);