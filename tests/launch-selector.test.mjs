import assert from 'node:assert/strict';
import {launchDestinationLayout} from '../src/veil/supply.js';

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
