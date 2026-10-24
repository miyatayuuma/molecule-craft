import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {measure,initial} from '../scripts/analyze-polymer-task5-orientation-feasibility.mjs';
import {pngPixels,maskColor} from './helpers/polymer-task5-visual.mjs';

const base=new URL('../docs/validation/polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/',import.meta.url);
test('frozen native boundary identifies H5 as bond33 shadow owner while endpoint-only cylinder has enough area',()=>{
 const row=JSON.parse(gunzipSync(fs.readFileSync(new URL('boundary-30-0.json.gz',base)))),native=pngPixels(fs.readFileSync(new URL('boundary-30-0-id.png',base))),before=JSON.stringify(initial.graph),b=initial.graph.bonds[33];
 const endpoint=measure(row.pose,30,m=>m.kind==='bond'?m.index===33:m.index===b.a||m.index===b.b),area=endpoint.grade.bonds.find(b=>b.index===33);
 assert.ok(area.visiblePixels>=area.requiredPixels);
 let h5=0,other=0;
 for(let i=0;i<endpoint.raster.ids.length;i++)if(endpoint.raster.ids[i]===1057){const j=i*native.channels,color=(native.pixels[j]<<16)|(native.pixels[j+1]<<8)|native.pixels[j+2];if(color===maskColor(6))h5++;else if(color!==maskColor(1057))other++;}
 assert.equal(h5,89,'native mask, not a newly predicted owner');assert.equal(other,0);
 assert.equal(JSON.stringify(initial.graph),before,'diagnostic visibility filtering cannot mutate graph');
});
