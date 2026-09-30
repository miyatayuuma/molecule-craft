import {createUniverse} from '../../src/veil/universe.js';
import {createRun,stepRun} from '../../src/veil/expedition-run.js';
import {OXYGEN_VORTEX} from '../../src/veil/oxygen-routes.js';
import {flightConfig} from '../../src/veil/growth.js';

export const COUNTERS=['simulationFrames','simulationSeconds','assistScanned','assistNearby','pickupScanned','pickupDistanceTests','pickupHits','dynamicScanned','dynamicUpdated','clusterUpdated','renderFrames','renderScanned','renderNotReady','renderOffscreen','rendered','glowDraws','centerDraws','flowStrokes','carbonDraws','assistMs','pickupMs','dynamicMs','dustRenderMs'];
export function diagnostics({timing=false}={}){return {...Object.fromEntries(COUNTERS.map(key=>[key,0])),pickups:[],...(timing?{clock:()=>performance.now()}: {})};}
export const SCENARIOS=Object.freeze(['normal','dense','awakened','dynamic-heavy']);
export function fixture(name='normal',{instrument=true,timing=false}={}){
  if(!SCENARIOS.includes(name))throw Error(`Unknown fixture ${name}`);
  const awakened=name==='awakened',capabilities={combustionDrive:true,nitrogenField:true,coreFractured:awakened,worldAwakened:awakened,rareEcologyEligible:awakened};
  const state={elements:{},progress:{choCompleted:true,...capabilities}},map=createUniverse(41,{}, {capabilities});
  // Test-only 3x stress: deep copies preserve authored fields and shared cluster identity.
  // Copies have distinct IDs and deterministic offsets; no production constants change.
  if(name==='dense'){
    const originals=[...map.dust];let id=Math.max(...originals.map(d=>d.id))+1;
    for(let layer=1;layer<=2;layer++)for(const source of originals){
      const d=structuredClone(source),dx=layer*3,dy=-layer*3;Object.assign(d,{id:id++,x:d.x+dx,y:d.y+dy});
      if(Number.isFinite(d.baseX)){d.baseX+=dx;d.baseY+=dy;}
      if(d.vortex)d.vortex.phase+=layer*.003;
      if(d.cluster!==undefined)map.clusters[d.cluster].particles.push(d);
      map.dust.push(d);
    }
  }
  const run=createRun(map,flightConfig(state),{predators:true});
  if(name==='dynamic-heavy')Object.assign(run.player,{x:OXYGEN_VORTEX.center.x,y:OXYGEN_VORTEX.center.y});
  if(awakened){const rare=map.dust.find(d=>d.rareEcology);Object.assign(run.player,{x:rare.x,y:rare.y});}
  if(instrument)run.particleDiagnostics=diagnostics({timing});
  return run;
}
export function population(run,screen=null,{width=390,height=844}={}){
  const count={totalDust:run.map.dust.length,visibleDust:0,visibleReadyDust:0,readyDust:0,flowDust:0,vortexDust:0,dynamicDust:0,clusterDust:0,rareDust:0,rareEcologyDust:0};
  for(const d of run.map.dust){const ready=d.ready<=run.time,q=screen?.(d.x,d.y),visible=q&&q.x>=0&&q.x<=width&&q.y>=0&&q.y<=height;count.readyDust+=+ready;count.visibleDust+=+!!visible;count.visibleReadyDust+=+(!!visible&&ready);count.dynamicDust+=+!!(d.flow||d.vortex);count.flowDust+=+!!d.flow;count.vortexDust+=+!!d.vortex;count.clusterDust+=+(d.cluster!==undefined);count.rareDust+=+(d.kind==='rare'||d.rareEcology===true);count.rareEcologyDust+=+(d.rareEcology===true);}
  return {...count,viewportInsideRatio:count.visibleDust/count.totalDust,viewportOutsideRatio:1-count.visibleDust/count.totalDust};
}
export function inputAt(frame){const angle=-Math.PI/2+Math.sin(frame/75)*.35;return {x:Math.cos(angle),y:Math.sin(angle)};}
export function trace(name,{instrument=true,frames=3600}={}){
  const run=fixture(name,{instrument}),pickups=[],regions=[],hazards=[];
  // Observer uses consumed-ready transitions when instrumentation is disabled, preserving map order.
  for(let frame=0;frame<frames;frame++){
    const before=run.map.dust.map(d=>d.ready),events=stepRun(run,inputAt(frame),1/60);
    for(let i=0;i<run.map.dust.length;i++){const d=run.map.dust[i];if(before[i]<=run.time-1/60+1e-10&&d.ready>run.time&&d.ready!==before[i])pickups.push({id:d.id,frame,element:d.element??'H',value:d.value,rare:d.rareEcology===true});}
    for(const e of events)if(e.type==='region')regions.push({frame,region:e.region});
    const key=JSON.stringify((run.currentHazards??[]).map(h=>({type:h.type,intensity:h.effectiveIntensity??h.intensity})));if(hazards.at(-1)?.key!==key)hazards.push({frame,key});
  }
  return {run,signature:{player:{x:run.player.x,y:run.player.y,vx:run.player.vx,vy:run.player.vy},units:run.elementDust,elements:run.collectedElements,pickups,chain:run.chain,best:run.best,respawn:run.map.dust.filter(d=>d.ready!==0).map(d=>({id:d.id,ready:Number.isFinite(d.ready)?d.ready:'Infinity'})),regions,hazards,captured:run.captured,forcedReturn:run.forcedReturn}};
}
export function assertSignature(assert,actual,expected,path='signature'){
  if(typeof expected==='number'){assert.ok(Math.abs(actual-expected)<=1e-8,`${path}: ${actual} != ${expected}`);return;}
  if(expected&&typeof expected==='object'){assert.deepEqual(Object.keys(actual),Object.keys(expected),path);for(const key of Object.keys(expected))assertSignature(assert,actual[key],expected[key],`${path}.${key}`);return;}
  assert.equal(actual,expected,path);
}
