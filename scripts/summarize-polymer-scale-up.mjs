import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const directory=process.argv[2]??'test-results/polymer-scale-up',pairs=[];
function distribution(values){assert.ok(values.length>=5,'Insufficient profile frames');const sorted=values.toSorted((a,b)=>a-b);return{n:sorted.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],peak:sorted.at(-1)};}
function select(profile,phases){const indices=profile.phase.flatMap((p,i)=>phases.includes(p)?[i]:[]);return Object.fromEntries(['update','render','frame'].map(key=>[key,distribution(indices.map(i=>profile[key][i]))]));}
for(let run=1;run<=3;run++){
  const base=JSON.parse(await readFile(`${directory}/baseline-mobile-${run}.json`)),task=JSON.parse(await readFile(`${directory}/cinematic-mobile-${run}.json`));assert.equal(base.length,9);assert.equal(task.length,9);
  for(const row of task){const old=base.find(b=>b.routeId===row.routeId);assert.ok(old);assert.deepEqual(old.viewport,row.viewport);assert.ok(row.profile);assert.ok(old.profile);
    for(const phase of ['bulk-feed','scale-out','ensemble-growth','morphology-hold','collapse'])assert.ok(row.profile.phase.includes(phase),`${row.routeId}: missing phase ${phase}`);
    assert.equal(row.cinematic.objectCount,0);assert.equal(row.cinematic.geometryCount,0);
    pairs.push({run,routeId:row.routeId,baseline:select(old.profile,['settle','dock','hold']),cinematic:select(row.profile,['bulk-feed','scale-out','ensemble-growth','morphology-hold','collapse']),hold:select(row.profile,['morphology-hold'])});
  }
}
const desktop=JSON.parse(await readFile(`${directory}/profile-1280.json`));assert.equal(desktop.length,9);
await writeFile(`${directory}/summary.json`,JSON.stringify({units:'milliseconds; render is CPU preparation/submission, not GPU completion',baselinePasses:3,cinematicPasses:3,mobile:[390,844],desktop:[1280,900],pairs},null,2));
for(const row of pairs)console.log(`${row.run} ${row.routeId}: baseline/new update p95 ${row.baseline.update.p95.toFixed(3)}/${row.cinematic.update.p95.toFixed(3)}; render p95 ${row.baseline.render.p95.toFixed(3)}/${row.cinematic.render.p95.toFixed(3)}; interval p95 ${row.baseline.frame.p95.toFixed(3)}/${row.cinematic.frame.p95.toFixed(3)}`);
