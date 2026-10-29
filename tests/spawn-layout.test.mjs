import assert from 'node:assert/strict';
import {planSpawn,projectSpawnSphere} from '../src/spawn-layout.js';
const viewport={width:390,height:430,insets:{left:18,right:18,top:88,bottom:72}};
const atom={x:0,y:0,z:0,radius:.6},base={...viewport,parts:[atom],distance:5};
const inside=plan=>{assert.ok(plan);assert.ok(plan.bounds.left>=18-1e-6&&plan.bounds.right<=372+1e-6&&plan.bounds.top>=88-1e-6&&plan.bounds.bottom<=358+1e-6);};
const empty=planSpawn(base);inside(empty);assert.equal(empty.distance,5);assert.equal(empty.x,0);assert.equal(empty.y,0);
for(const anchor of [{x:2,y:0,z:0},{x:-2,y:0,z:0},{x:0,y:2,z:0},{x:0,y:-2,z:0},{x:100,y:100,z:0}]){
  const options={...base,anchor,obstacles:[{...anchor,radius:.6}]},before=JSON.stringify(options),plan=planSpawn(options);
  inside(plan);assert.equal(plan.distance,5,'Visible empty space must win over an off-screen selection');assert.equal(JSON.stringify(options),before);
}
// A hollow-looking area crossed by a bond is not a usable spawn slot.
const crossing=planSpawn({...base,distance:6,bonds:[{a:{x:-2,y:0,z:0,radius:.07},b:{x:2,y:0,z:0,radius:.07}}]});
inside(crossing);assert.equal(crossing.distance,6);assert.ok(Math.abs(crossing.y)>.6);
// A long part fits as a whole, not merely its connection atom.
const part=planSpawn({...base,parts:[{x:-1,y:0,z:0,radius:.35},{x:1,y:0,z:.2,radius:.35}],anchor:{x:2,y:1,z:0}});
inside(part);assert.equal(part.distance,5);
const tiny=planSpawn({...base,distance:1.2});inside(tiny);assert.ok(tiny.zoomed&&tiny.distance>1.2&&tiny.distance<2.6);
const packed={...base,obstacles:Array.from({length:30},(_,i)=>({x:(i%6-2.5)*1.3,y:(Math.floor(i/6)-2)*1.3,z:0,radius:.6}))};
const expanded=planSpawn(packed);inside(expanded);assert.ok(expanded.distance>5);assert.ok(Math.abs(expanded.x)>3.25||Math.abs(expanded.y)>2.6,'Crowded view must expand outward');
assert.equal(planSpawn({...packed,maxDistance:5}),null,'A full, capped view must not silently overlap');
assert.equal(planSpawn({...base,obstacles:[{x:100,y:100,z:0,radius:.6},{x:0,y:0,z:100,radius:.6}]}).distance,5,'Distant debris must not trigger a zoom');
for(const dimensions of [{width:320,height:430},{width:900,height:430}]){const p=planSpawn({...base,...dimensions});assert.ok(p&&!p.zoomed);}
assert.equal(planSpawn({...base,width:0}),null);
assert.equal(planSpawn({...base,insets:{top:400,bottom:100}}),null);
const sphere=projectSpawnSphere({x:0,y:0,z:0,radius:1},5,100,400,400);
assert.ok(Math.abs(sphere.right-200-100/Math.sqrt(24))<1e-9,'Sphere silhouette must include its tangent, not only its center');
console.log('Spawn layout passed: empty/edge/off-screen selection, whole parts, bond gaps, crowded expansion, capped failure and mobile/landscape bounds.');
