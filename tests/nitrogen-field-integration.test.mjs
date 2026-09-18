import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,beginBurst,setCombustionHeld,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,triggerInsight} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {NITROGEN_ENTRY,NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,NITROGEN_PULSES,NITROGEN_ROUTE,NITROGEN_WORLD_SEED,nitrogenInsightAreaAt} from '../src/veil/nitrogen-routes.js';
import {AMMONIA_MOLECULE_ID,NITROGEN_MOLECULE_ID,nitrogenChapterState} from '../src/veil/nitrogen-progression.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const catalog=[{id:NITROGEN_MOLECULE_ID,formula:'N₂',atoms:['N','N']},{id:AMMONIA_MOLECULE_ID,formula:'NH₃',atoms:['N','H','H','H']}];
const graphRaw=JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')),graph=createMoleculeGraph(graphRaw);
const postChoState=N=>({progress:{choCompleted:true},elements:{N},recipes:[]});
const mainN=map=>map.dust.filter(dust=>dust.route===NITROGEN_ROUTE.id&&dust.element==='N').reduce((sum,dust)=>sum+dust.value,0);
const pocketN=map=>map.dust.filter(dust=>dust.route===NITROGEN_HIGH_DENSITY_POCKET.id&&dust.element==='N').reduce((sum,dust)=>sum+dust.value,0);

function nitrogenRun(stock=0,{fuel={},predators=false}={}){
  const map=createUniverse(41,{H:0,C:0,N:stock,O:0},{capabilities:{combustionDrive:true,nitrogenField:true}}),config=flightConfig(postChoState(stock)),run=createRun(map,config,{fuel,predators});
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
  const post=nitrogenRun();assert.equal(post.map.routes.some(route=>route.id===NITROGEN_ROUTE.id),true);assert.deepEqual(post.config.bounds,NITROGEN_REGION_BOUNDS);assert.ok(post.map.nitrogenHazards.length>=8);assert.equal(post.map.fields.some(field=>field.kind==='nitrogen-pulse'),false,'Nitrogen v2 hazards are environment fields rather than legacy trigger circles');
  assert.ok(NITROGEN_ROUTE.points.every(point=>point.y<=NITROGEN_ENTRY.y+1&&point.y>=NITROGEN_REGION_BOUNDS.top),'Nitrogen route stays within the post-CHO extension');
});

test('Nitrogen environment and depletion layout do not reroll when launch seed changes',()=>{
  const stock={H:0,C:0,N:250,O:0},a=createUniverse(41,stock,{capabilities:{combustionDrive:true,nitrogenField:true}}),b=createUniverse(987654,stock,{capabilities:{combustionDrive:true,nitrogenField:true}});
  assert.equal(a.nitrogenEnvironmentSeed,NITROGEN_WORLD_SEED);assert.equal(b.nitrogenEnvironmentSeed,NITROGEN_WORLD_SEED);
  const visuals=map=>map.nitrogenVisuals.map(item=>[item.hazardId,item.x,item.y,item.spatial,item.recoveryScale]);
  assert.deepEqual(visuals(a),visuals(b),'organic hazard samples must be stable across return/relaunch');
  const nLayout=map=>map.dust.filter(item=>item.element==='N'&&(item.route===NITROGEN_ROUTE.id||item.route===NITROGEN_HIGH_DENSITY_POCKET.id)).map(item=>[item.route,item.x,item.y,item.value]);
  assert.deepEqual(nLayout(a),nLayout(b),'N depletion must not offer launch-seed reroll farming');
});

test('Nitrogen ambient composition remains visible at saturated CHO stock without becoming a reroll target',()=>{
  const saturated={H:1200,C:1200,N:1200,O:1200},a=createUniverse(41,saturated,{capabilities:{combustionDrive:true,nitrogenField:true}}),b=createUniverse(987654,saturated,{capabilities:{combustionDrive:true,nitrogenField:true}});
  const ambient=map=>map.dust.filter(item=>String(item.route??'').startsWith('nitrogen-ambient-')).map(item=>[item.route,item.x,item.y,item.element]);
  assert.ok(ambient(a).length>0,'mixed H/C/O traces must remain visible even when CHO stock is saturated');assert.ok(new Set(ambient(a).map(item=>item[3])).size>=2,'Nitrogen should not collapse visually into an N-only particle belt');assert.deepEqual(ambient(a),ambient(b),'ambient composition uses the persistent Nitrogen world seed, not launch RNG');
});

test('Nitrogen starter yield is bounded and inventory depletion gradually suppresses optional farming while retaining mainline supply',()=>{
  const fresh=nitrogenRun(0).map,mid=nitrogenRun(250).map,full=nitrogenRun(425).map;
  const freshMain=mainN(fresh),midMain=mainN(mid),fullMain=mainN(full),freshPocket=pocketN(fresh),midPocket=pocketN(mid),fullPocket=pocketN(full);
  assert.ok(freshMain>=80&&freshMain<=130,`fresh mainline starter yield ${freshMain} should stay near 80-120 N`);
  assert.ok(freshPocket>0,'fresh stock exposes the optional high-density pocket');
  assert.ok(mid.depletion.N>0&&mid.depletion.N<1,'mid stock enters N depletion');
  assert.ok(midMain>0&&midMain<freshMain,'mainline N thins gradually at mid stock');
  assert.ok(midPocket>=0&&midPocket<freshPocket,'optional high-density N thins faster than fresh stock');
  assert.equal(full.depletion.N,1,'425 N reaches the existing N depletion ceiling');
  assert.equal(fullPocket,0,'high-density optional pocket disappears at full depletion');
  assert.ok(fullMain>0,'mainline N never disappears completely');
  assert.ok(fullMain<midMain,'mainline supply continues thinning toward the depletion ceiling');
  assert.ok(fullMain+fullPocket<midMain+midPocket&&midMain+midPocket<freshMain+freshPocket,'aggregate N yield decreases monotonically with stock');
  console.log('Nitrogen resource balance',JSON.stringify({fresh:{main:freshMain,pocket:freshPocket,depletion:fresh.depletion.N},mid:{main:midMain,pocket:midPocket,depletion:mid.depletion.N},full:{main:fullMain,pocket:fullPocket,depletion:full.depletion.N}}));
});

test('Nitrogen v2 is a long open field whose difficulty comes from overlapping hazard composition',()=>{
  const run=nitrogenRun(),routeLength=NITROGEN_ROUTE.points.slice(1).reduce((sum,point,index)=>sum+Math.hypot(point.x-NITROGEN_ROUTE.points[index].x,point.y-NITROGEN_ROUTE.points[index].y),0),types=new Set(run.map.nitrogenHazards.map(item=>item.type)),subtypes=new Set(run.map.nitrogenHazards.map(item=>item.subtype));
  assert.ok(routeLength>7000,'Deep Nitrogen must be materially longer than the old corridor');assert.ok(types.has('mechanical')&&types.has('thermal'));assert.ok(subtypes.has('pressure')&&subtypes.has('shear')&&subtypes.has('turbulence'));assert.ok(run.map.nitrogenZones.every(zone=>zone.width>=700),'readability comes from broad open space rather than narrow walls');
});

test('N2 Critical Insight uses existing engagement gate, run-local carry, return commit and forced-return loss',()=>{
  const storage=memory(),value=createResources({storage});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.prepareExpedition({region:'nitrogen',rng:()=>.5});
  const early={time:FIELD_INSIGHT_MIN_SECONDS-1,insightEngagementSatisfied:false,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{N:1}};assert.deepEqual(value.signal('nitrogen',.1,.2,{runContext:early}),{deferred:true,critical:true},'N pickup cannot bypass the engagement gate');
  value.findElementForExpedition('N');const noPickup={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{N:0}};assert.deepEqual(value.signal('nitrogen',.1,.2,{runContext:noPickup}),{deferred:true,critical:true},'persistent N discovery cannot substitute for current-run collection');
  const engaged={...noPickup,collectedElements:{N:1}},opportunity=value.signal('nitrogen',.1,.2,{runContext:engaged});assert.equal(opportunity.recipe,NITROGEN_MOLECULE_ID);
  const carried={captured:false,carriedInsights:[],analysis:null,events:[]};assert.equal(triggerInsight(carried,NITROGEN_MOLECULE_ID,value.state)?.critical,true);assert.deepEqual(carried.carriedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(!value.state.hints.includes(NITROGEN_MOLECULE_ID),'acquisition remains run-local');
  const before=value.state.elements.N,normal=value.settleExpedition({H:0,C:0,N:96,O:0},0,false,{insights:carried.carriedInsights});assert.ok(normal.committedInsights.includes(NITROGEN_MOLECULE_ID));assert.ok(value.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(value.state.elements.N-before,96);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,8);

  const forced=createResources({storage:memory()});forced.setCatalog(catalog);forced.setFrontierGraph(graph);forced.state.progress.choCompleted=true;forced.findElementForExpedition('N');forced.prepareExpedition({region:'nitrogen'});const lostRun={captured:false,carriedInsights:[],analysis:null,events:[]};triggerInsight(lostRun,NITROGEN_MOLECULE_ID,forced.state);const loss=forced.settleExpedition({H:0,C:0,N:100,O:0},0,true,{insights:lostRun.carriedInsights});assert.deepEqual(loss.committedInsights,[]);assert.ok(!forced.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(loss.lost.N,15);assert.equal(loss.kept.N,85);
  console.log('Nitrogen insight lifecycle',JSON.stringify({timingSeconds:engaged.time,minimumDistance:FIELD_INSIGHT_MIN_DISTANCE,normalCommit:normal.committedInsights,forcedLostN:loss.lost.N}));
});

test('authored N2 signal geometry stays fixed but cannot be picked before marker claimability',()=>{
  const entry=NITROGEN_ROUTE.points[0],distance=Math.hypot(NITROGEN_INSIGHT_AREA.x-entry.x,NITROGEN_INSIGHT_AREA.y-entry.y);assert.ok(distance>FIELD_INSIGHT_MIN_DISTANCE);assert.ok(nitrogenInsightAreaAt(NITROGEN_INSIGHT_AREA));
  const run=nitrogenRun();run.insightEngagementOrigin={x:run.player.x,y:run.player.y};run.player.x=NITROGEN_INSIGHT_AREA.x;run.player.y=NITROGEN_INSIGHT_AREA.y;run.time=FIELD_INSIGHT_MIN_SECONDS-2;run.insightEngagementMaxDistance=distance;const signal=run.map.signals.find(item=>item.region==='nitrogen');signal.x=run.player.x;signal.y=run.player.y;signal.claimable=false;
  const earlyEvents=stepRun(run,{x:0,y:0},1/60);assert.ok(!earlyEvents.some(event=>event.type==='signal'),'hidden/non-claimable geometry cannot be consumed');assert.equal(signal.ready,false);
  run.collectedElements.N=1;run.foundElements.push('N');run.time=FIELD_INSIGHT_MIN_SECONDS;run.insightEngagementSatisfied=true;signal.claimable=true;const claimed=stepRun(run,{x:0,y:0},1/60);assert.ok(claimed.some(event=>event.type==='signal'&&event.region==='nitrogen'),'claimable marker pickup emits the existing signal event');assert.equal(signal.ready,true);assert.equal(signal.claimable,false);
});

test('N2 discovery exposes existing LOADOUT roles and Nitrogen launch prioritizes ordinary direct-frontier NH3',()=>{
  const value=createResources({storage:memory()});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.findElementForExpedition('N');value.hint(NITROGEN_MOLECULE_ID);assert.deepEqual(value.discoverWithLoadout(NITROGEN_MOLECULE_ID,null),{learned:true,assignedUse:null});
  assert.ok(value.tankCatalog('propellant').some(record=>record.id===NITROGEN_MOLECULE_ID));assert.ok(value.tankCatalog('coolant').some(record=>record.id===NITROGEN_MOLECULE_ID));
  value.prepareExpedition({region:'nitrogen',rng:()=>.99});const diagnostic=value.frontierInsightDiagnostics();assert.equal(diagnostic.selectedCandidateId,AMMONIA_MOLECULE_ID);assert.equal(diagnostic.weightingRegion,'nitrogen-chapter');
  const engaged={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+500,foundElements:['N']},opportunity=value.signal('nitrogen',.9,.9,{runContext:engaged});assert.equal(opportunity.recipe,AMMONIA_MOLECULE_ID);assert.equal(opportunity.frontier,true);
  value.hint(AMMONIA_MOLECULE_ID);value.discover(AMMONIA_MOLECULE_ID);assert.equal(nitrogenChapterState(value.state).stage,'complete');
  console.log('Nitrogen frontier balance',JSON.stringify({selected:diagnostic.selectedCandidateId,weighting:diagnostic.weightingRegion,availableAfterN2:true,chapter:nitrogenChapterState(value.state).stage}));
});

test('FIELD HUD exposes N through canonical element authority and production launch enables Nitrogen FIELD composition',async()=>{
  const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
  assert.match(uiSource,/\['C','N','O'\].*resources\.canUseElement\(el\)/s);
  assert.match(uiSource,/event\.element==='N'\?'Nを発見/);
  assert.match(uiSource,/nitrogenField:config\.nitrogenField===true/,'production launch must pass post-CHO Nitrogen capability into createUniverse');
});


test('N dust pickup is run-local cargo, is single-consume until respawn, settles to BASE STOCK, obeys forced loss and persists after reload',()=>{
  const run=nitrogenRun(),dust=run.map.dust.find(item=>item.element==='N');assert.ok(dust);Object.assign(run.player,{x:dust.x,y:dust.y,vx:0,vy:0,speed:0});const before=run.collectedElements.N,events=stepRun(run,{x:0,y:0},1/60);assert.ok(run.collectedElements.N>before);assert.ok(run.elementDust.N>0);assert.ok(events.some(event=>event.type==='pickup'&&event.elements.N>0));
  const pickedAtoms=run.collectedElements.N,pickedUnits=run.elementDust.N,readyAfterPickup=dust.ready;assert.ok(readyAfterPickup>run.time);const duplicateEvents=stepRun(run,{x:0,y:0},1/60);assert.equal(run.collectedElements.N,pickedAtoms);assert.equal(run.elementDust.N,pickedUnits);assert.ok(!duplicateEvents.some(event=>event.type==='pickup'&&event.elements.N>0),'same N dust cannot be collected again on later frames before respawn');
  const storage=memory(),normal=createResources({storage});normal.setCatalog(catalog);normal.state.progress.choCompleted=true;const settled=normal.settleExpedition({H:0,C:0,N:run.elementDust.N,O:0},0,false);assert.equal(settled.atoms.N,run.elementDust.N);const stock=normal.state.elements.N;assert.ok(stock>0);const reloaded=createResources({storage});reloaded.setCatalog(catalog);assert.equal(reloaded.state.elements.N,stock,'N BASE STOCK survives schema-v8 reload');
  const forced=createResources({storage:memory()});forced.setCatalog(catalog);forced.state.progress.choCompleted=true;const loss=forced.settleExpedition({H:0,C:0,N:100,O:0},0,true);assert.equal(loss.lost.N,15);assert.equal(loss.kept.N,85);assert.equal(forced.state.elements.N,85);
});
