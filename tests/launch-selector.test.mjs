import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {launchDestinationLayout} from '../src/veil/supply.js';

const source=await readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8');
assert.match(source,/collector-launch-handle/,'Explorer launch must have a dedicated touch target');
assert.match(source,/launchHandle\.addEventListener\('pointerdown',beginLaunch\)/,'Drag must start from the dedicated touch target');
assert.match(source,/shellCanvas\.style\.transform=`translate/,'The visible explorer must follow the drag');
const ids=['veil','carbon','oxygen','frontier','veil','carbon'];
for(let count=1;count<=5;count++){
  const layout=launchDestinationLayout(ids.slice(0,count));
  assert.equal(layout.length,count);
  assert.equal(new Set(layout.map(({x,y})=>`${x.toFixed(6)},${y.toFixed(6)}`)).size,count);
  for(const point of layout)assert.ok(Math.abs(Math.hypot(point.x,point.y)-66)<1e-8);
}
assert.equal(launchDestinationLayout(ids).length,5,'Destination fan stays readable when more regions are added');
assert.deepEqual(launchDestinationLayout(['unknown','veil']).map(({id})=>id),['veil']);
console.log('Explorer launch selector passed: 1–5 radial destinations, fixed radius, and five-destination cap.');
