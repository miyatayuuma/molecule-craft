import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,beginBurst,setCombustionHeld,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,triggerInsight} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {NITROGEN_ENTRY,NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_PULSES,NITROGEN_ROUTE,nitrogenInsightAreaAt} from '../src/veil/nitrogen-routes.js';
import {AMMONIA_MOLECULE_ID,NITROGEN_MOLECULE_ID,nitrogenChapterState} from '../src/veil/nitrogen-progression.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const catalog=[{id:NITROGEN_MOLECULE_ID,formula:'N₂',atoms:['N','N']},{id:AMMONIA_MOLECULE_ID,formula:'NH₃',atoms:['N','H','H','H']}];
const graphRaw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')),graph=createMoleculeGraph(graphRaw);
const postChoState=N=>({progress:{choCompleted:true},elements:{N},recipes:[]});
const mainN=map=>map.dust.filter(dust=>dust.route===NITROGEN_ROUTE.id&&dust.element==='N').reduce((sum,dust)=>sum+dust.value,0);
const pocketN=map=>map.dust.filter(dust=>dust.route===NITROGEN_HIGH_DENSITY_POCKET.id&&dust.element==='N').reduce((sum,dust)=>sum+dust.value,0);

function nitrogenRun(stock=0,{fuel={},predators=false}={}){
  const map=createUniverse(41,{H:0,C:0,N:stock,O:0},{capabilities:{combustionDrive:true}}),config=flightConfig(postChoState(stock)),run=createRun(map,config,{fuel,predators});
  const start=NITROGEN_ROUTE.points[0];Object.assign(run.player,{x:start.x,y:start.y,angle:start.angle,vx:0,vy:0,speed:config.driftSpeed});run.region='nitrogen';
  return run;
}

function simulate(mode){
  const fuel=mode==='hydrogen'?{propellant:{molecule:'hydrogen',amount:120}}:mode==='nitrogen'?{propellant:{molecule:'nitrogen',amount:80}}:mode==='combustion'?{fuel:{molecule:'methane',amount:18},oxidizer:{molecule:'oxygen',amount:36},coolant:{molecule:'water',amount:80}}:{};
  const run=nitrogenRun(0,{fuel}),points=NITROGEN_ROUTE.points,last=points.at(-1),burstSchedule=mode==='hydrogen'?[.18,.50,.81]:mode==='nitrogen'?NITROGEN_PULSES.map(pulse=>pulse.progress):[],systems={consumeCombustion:()=>true,consumeCoolant:()=>true};
  if(mode==='combustion')setCombustionHeld(run,true);
  let targetIndex=2,nextBurst=0,driveSeconds=0,maxLateralError=0;
  while(run.time<70){
    const target=points[Math.min(points.length-1,targetIndex)],dx=target.x-run.player.x,dy=target.y-run.player.y,distance=Math.hypot(dx,dy)||1,progress=targetIndex/(points.length-1);
    if(distance<85&&targetIndex<points.length-1)targetIndex=Math.min(points.length-1,targetIndex+2);
    if(nextBurst<burstSchedule.length&&progress>=burstSchedule[nextBurst]&&run.player.boost<=0&&run.player.cooldown<=0){if(beginBurst(run,()=>true))nextBurst++;}
    const before=run.time,events=stepRun(run,{x:dx/distance,y:dy/distance},1/30,systems);driveSeconds+=run.player.combustion?run.time-before:0;
    const nearest=points.slice(Math.max(0,targetIndex-8),Math.min(points.length,targetIndex+9)).reduce((best,point)=>Math.min(best,Math.hypot(run.player.x-point.x,run.player.y-point.y)),Infinity);maxLateralError=Math.max(maxLateralError,nearest);
    if(events.some(event=>event.type==='capture'))break;
    if(Math.hypot(run.player.x-last.x,run.player.y-last.y)<115&&targetIndex>=points.length-3)break;
  }
  return {success:Math.hypot(run.player.x-last.x,run.player.y-last.y)<150,time:Number(run.time.toFixed(2)),bursts:run.telemetry.burstUses,driveSeconds:Number(driveSeconds.toFixed(2)),nAtoms:run.collectedElements.N,maxLateralError:Number(maxLateralError.toFixed(1)),run};
}

test('Nitrogen geometry is absent pre-CHO and composed only for post-CHO flight config',()=>{
  const base=createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true}});assert.equal(base.routes.some(route=>route.id===NITROGEN_ROUTE.id),false,'base universe remains CHO-only');
  const pre=createRun(createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true}}),flightConfig({progress:{choCompleted:false},elements:{N:0}}),{predators:false});assert.equal(pre.map.routes.some(route=>route.id===NITROGEN_ROUTE.id),false);assert.equal(pre.config.bounds.top,-12750);
  const post=nitrogenRun();assert.equal(post.map.routes.some(route=>route.id===NITROGEN_ROUTE.id),true);assert.deepEqual(post.config.bounds,NITROGEN_REGION_BOUNDS);assert.equal(post.map.fields.filter(field=>field.kind==='nitrogen-pulse').length,6);
  assert.ok(NITROGEN_ROUTE.points.every(point=>point.y<=NITROGEN_ENTRY.y+1&&point.y>=NITROGEN_REGION_BOUNDS.top),'Nitrogen route stays within the post-CHO extension');
});

test('Nitrogen starter yield is bounded and inventory depletion suppresses field density',()=>{
  const fresh=nitrogenRun(0).map,belowThin=nitrogenRun(250).map,full=nitrogenRun(425).map;
  const freshMain=mainN(fresh),belowMain=mainN(belowThin),fullMain=mainN(full),freshPocket=pocketN(fresh),belowPocket=pocketN(belowThin),fullPocket=pocketN(full);
  assert.ok(freshMain>=80&&freshMain<=130,`fresh mainline starter yield ${freshMain} should stay near 80-120 N`);
  assert.ok(freshPocket>0,'fresh stock exposes the optional high-density pocket');
  assert.ok(belowThin.depletion.N>0&&belowThin.depletion.N<.58,'250 N is depleted but remains below the shared segment-thinning threshold');
  assert.equal(belowMain,freshMain,'shared depletion contract does not thin route segments below its threshold');
  assert.equal(belowPocket,freshPocket,'optional pocket stays intact below the shared thinning threshold');
  assert.equal(full.depletion.N,1,'425 N reaches the existing N depletion ceiling');
  assert.equal(fullPocket,0,'high-density optional pocket disappears at full depletion');
  assert.ok(fullMain+fullPocket<freshMain+freshPocket,'full inventory materially suppresses Nitrogen FIELD yield');
  console.log('Nitrogen resource balance',JSON.stringify({fresh:{main:freshMain,pocket:freshPocket,depletion:fresh.depletion.N},belowThin:{main:belowMain,pocket:belowPocket,depletion:belowThin.depletion.N},full:{main:fullMain,pocket:fullPocket,depletion:full.depletion.N}}));
});

test('Nitrogen pulse corridor remains passable by normal, H2, N2 and combustion propulsion',()=>{
  const normal=simulate('normal'),hydrogen=simulate('hydrogen'),nitrogen=simulate('nitrogen'),combustion=simulate('combustion');
  for(const [name,result]of Object.entries({normal,hydrogen,nitrogen,combustion}))assert.equal(result.success,true,`${name} must complete the Nitrogen mainline without a hard gate`);
  assert.ok(hydrogen.bursts>0&&hydrogen.bursts<=3,'H2 crosses the stress corridor with roughly three large BURSTs');
  assert.ok(nitrogen.bursts>=5&&nitrogen.bursts>hydrogen.bursts,'N2 uses smaller, more frequent pulses aligned to corridor cadence');
  assert.ok(combustion.driveSeconds>0,'COMBUSTION DRIVE remains physically usable');
  console.log('Nitrogen traversal balance',JSON.stringify({normal:{time:normal.time,nAtoms:normal.nAtoms,error:normal.maxLateralError},hydrogen:{time:hydrogen.time,bursts:hydrogen.bursts,nAtoms:hydrogen.nAtoms,error:hydrogen.maxLateralError},nitrogen:{time:nitrogen.time,bursts:nitrogen.bursts,nAtoms:nitrogen.nAtoms,error:nitrogen.maxLateralError},combustion:{time:combustion.time,driveSeconds:combustion.driveSeconds,nAtoms:combustion.nAtoms,error:combustion.maxLateralError}}));
});

test('N2 Critical Insight uses existing engagement gate, run-local carry, return commit and forced-return loss',()=>{
  const storage=memory(),value=createResources({storage});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.prepareExpedition({region:'nitrogen',rng:()=>.5});
  const early={time:FIELD_INSIGHT_MIN_SECONDS-1,insightEngagementSatisfied:false,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,foundElements:['N']};assert.deepEqual(value.signal('nitrogen',.1,.2,{runContext:early}),{deferred:true,critical:true},'launch/early traversal cannot emit N2');
  value.findElementForExpedition('N');const engaged={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,foundElements:['N']},opportunity=value.signal('nitrogen',.1,.2,{runContext:engaged});assert.equal(opportunity.recipe,NITROGEN_MOLECULE_ID);
  const carried={captured:false,carriedInsights:[],analysis:null,events:[]};assert.equal(triggerInsight(carried,NITROGEN_MOLECULE_ID,value.state)?.critical,true);assert.deepEqual(carried.carriedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(!value.state.hints.includes(NITROGEN_MOLECULE_ID),'acquisition remains run-local');
  const before=value.state.elements.N,normal=value.settleExpedition({H:0,C:0,N:96,O:0},0,false,{insights:carried.carriedInsights});assert.ok(normal.committedInsights.includes(NITROGEN_MOLECULE_ID));assert.ok(value.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(value.state.elements.N-before,96);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,8);

  const forced=createResources({storage:memory()});forced.setCatalog(catalog);forced.setFrontierGraph(graph);forced.state.progress.choCompleted=true;forced.findElementForExpedition('N');forced.prepareExpedition({region:'nitrogen'});const lostRun={captured:false,carriedInsights:[],analysis:null,events:[]};triggerInsight(lostRun,NITROGEN_MOLECULE_ID,forced.state);const loss=forced.settleExpedition({H:0,C:0,N:100,O:0},0,true,{insights:lostRun.carriedInsights});assert.deepEqual(loss.committedInsights,[]);assert.ok(!forced.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(loss.lost.N,15);assert.equal(loss.kept.N,85);
  console.log('Nitrogen insight lifecycle',JSON.stringify({timingSeconds:engaged.time,minimumDistance:FIELD_INSIGHT_MIN_DISTANCE,normalCommit:normal.committedInsights,forcedLostN:loss.lost.N}));
});

test('authored N2 signal area is late enough for distance engagement and early crossings are replayed after the existing gate',()=>{
  const entry=NITROGEN_ROUTE.points[0],distance=Math.hypot(NITROGEN_INSIGHT_AREA.x-entry.x,NITROGEN_INSIGHT_AREA.y-entry.y);assert.ok(distance>FIELD_INSIGHT_MIN_DISTANCE);assert.ok(nitrogenInsightAreaAt(NITROGEN_INSIGHT_AREA));
  const run=nitrogenRun();run.insightEngagementOrigin={x:run.player.x,y:run.player.y};run.player.x=NITROGEN_INSIGHT_AREA.x;run.player.y=NITROGEN_INSIGHT_AREA.y;run.time=FIELD_INSIGHT_MIN_SECONDS-2;run.insightEngagementMaxDistance=distance;const signal=run.map.signals.find(item=>item.region==='nitrogen');signal.x=run.player.x;signal.y=run.player.y;
  const earlyEvents=stepRun(run,{x:0,y:0},1/60);assert.ok(earlyEvents.some(event=>event.type==='signal'&&event.region==='nitrogen'));assert.ok(run.deferredNitrogenSignal,'early signal is retained run-locally');run.time=FIELD_INSIGHT_MIN_SECONDS;run.insightEngagementSatisfied=true;const replay=stepRun(run,{x:0,y:0},1/60);assert.ok(replay.some(event=>event.type==='signal'&&event.region==='nitrogen'),'existing engagement satisfaction replays the authored opportunity');assert.equal(run.deferredNitrogenSignal,null);
});

test('N2 discovery exposes existing LOADOUT roles and Nitrogen launch prioritizes ordinary direct-frontier NH3',()=>{
  const value=createResources({storage:memory()});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.findElementForExpedition('N');value.hint(NITROGEN_MOLECULE_ID);assert.deepEqual(value.discoverWithLoadout(NITROGEN_MOLECULE_ID,null),{learned:true,assignedUse:null});
  assert.ok(value.tankCatalog('propellant').some(record=>record.id===NITROGEN_MOLECULE_ID));assert.ok(value.tankCatalog('coolant').some(record=>record.id===NITROGEN_MOLECULE_ID));
  value.prepareExpedition({region:'nitrogen',rng:()=>.99});const diagnostic=value.frontierInsightDiagnostics();assert.equal(diagnostic.selectedCandidateId,AMMONIA_MOLECULE_ID);assert.equal(diagnostic.weightingRegion,'nitrogen-chapter');
  const engaged={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+500,foundElements:['N']},opportunity=value.signal('nitrogen',.9,.9,{runContext:engaged});assert.equal(opportunity.recipe,AMMONIA_MOLECULE_ID);assert.equal(opportunity.frontier,true);
  value.hint(AMMONIA_MOLECULE_ID);value.discover(AMMONIA_MOLECULE_ID);assert.equal(nitrogenChapterState(value.state).stage,'complete');
  console.log('Nitrogen frontier balance',JSON.stringify({selected:diagnostic.selectedCandidateId,weighting:diagnostic.weightingRegion,availableAfterN2:true,chapter:nitrogenChapterState(value.state).stage}));
});
