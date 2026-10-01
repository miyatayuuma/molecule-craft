import {fixture,inputAt} from '../tests/helpers/field-particle-fixtures.mjs';
import {stepRun} from '../src/veil/expedition-run.js';
import {createDustSpatialIndex} from '../src/veil/dust-spatial-index.js';
const result=[];
for(const cellSize of [32,64,96,128])for(const name of ['normal','dense','awakened','dynamic-heavy']){
  const run=fixture(name,{instrument:false}),index=createDustSpatialIndex(run.map.dust,{cellSize}),moving=run.map.dust.filter(d=>d.flow||d.vortex),samples=[];let candidates=0,cellMoves=0;
  for(let frame=0;frame<360;frame++){
    const old={x:run.player.x,y:run.player.y};stepRun(run,inputAt(frame),1/60);const start=performance.now();
    for(const d of moving)cellMoves+=+index.update(d);
    for(const c of run.map.clusters)if(run.time-c.burstAt>=0&&run.time-c.burstAt<=40)for(const d of c.particles)cellMoves+=+index.update(d);
    candidates+=index.queryCircle(old.x,old.y,run.config.assistRadius).length+index.querySegment(old,run.player,run.config.suctionRadius).length;samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);result.push({cellSize,name,candidates,cellMoves,medianMs:samples[180],p95Ms:samples[341]});
}
console.log(JSON.stringify(result,null,2));
