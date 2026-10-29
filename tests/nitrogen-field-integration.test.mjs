import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,stepRun,beginBurst,setCombustionHeld,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,triggerInsight} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {syncFieldInsightMarkerClaimability} from '../src/veil/signal-claimability.js';
import {NITROGEN_ENTRY,NITROGEN_REGION_BOUNDS} from '../src/veil/nitrogen-config.js';
import {NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_ANCHORS,NITROGEN_INSIGHT_AREA,NITROGEN_PULSE_FIELD,NITROGEN_ROUTE,NITROGEN_SIDE_ROUTE,NITROGEN_WORLD_SEED,NITROGEN_ZONES,nitrogenInsightAreaAt} from '../src/veil/nitrogen-routes.js';
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

test('Nitrogen geometry is absent pre-CHO and composed only for post-CHO flight config',()=>{
  const base=createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true}});assert.equal(base.routes.some(route=>route.id===NITROGEN_ROUTE.id),false,'base universe remains CHO-only');
  const pre=createRun(createUniverse(41,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true}}),flightConfig({progress:{choCompleted:false},elements:{N:0}}),{predators:false});assert.equal(pre.map.routes.some(route=>route.id===NITROGEN_ROUTE.id),false);assert.equal(pre.config.bounds.top,-12750);
  const post=nitrogenRun();assert.equal(post.map.routes.some(route=>route.id===NITROGEN_ROUTE.id),true);assert.deepEqual(post.config.bounds,NITROGEN_REGION_BOUNDS);assert.equal(post.map.nitrogenHazards.length,6);assert.equal(post.map.fields.some(field=>field.kind==='nitrogen-pulse'),false);assert.equal(post.map.fields.find(field=>field.id===NITROGEN_PULSE_FIELD.id)?.kind,'burst-advantage');assert.ok(post.map.routes.some(route=>route.id===NITROGEN_SIDE_ROUTE.id&&route.optional));
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
  assert.equal(freshMain,96);assert.equal(freshPocket,72,'fresh stock exposes the full optional high-density pocket');
  assert.ok(mid.depletion.N>0&&mid.depletion.N<1,'mid stock enters N depletion');
  assert.ok(midMain>=68&&midMain<=72&&midMain<freshMain,'mainline N thins gradually at mid stock');
  assert.ok(midPocket>=42&&midPocket<=46&&midPocket<freshPocket,'optional high-density N thins faster than fresh stock');
  assert.equal(full.depletion.N,1,'425 N reaches the existing N depletion ceiling');assert.ok(fullMain>=27&&fullMain<=31);
  assert.equal(fullPocket,0,'high-density optional pocket disappears at full depletion');
  assert.ok(fullMain>0,'mainline N never disappears completely');
  assert.ok(fullMain<midMain,'mainline supply continues thinning toward the depletion ceiling');
  assert.ok(fullMain+fullPocket<midMain+midPocket&&midMain+midPocket<freshMain+freshPocket,'aggregate N yield decreases monotonically with stock');
  console.log('Nitrogen resource balance',JSON.stringify({fresh:{main:freshMain,pocket:freshPocket,depletion:fresh.depletion.N},mid:{main:midMain,pocket:midPocket,depletion:mid.depletion.N},full:{main:fullMain,pocket:fullPocket,depletion:full.depletion.N}}));
});

test('Nitrogen v3 uses compact gameplay sections with a short, bounded main route',()=>{
  const run=nitrogenRun(),routeLength=NITROGEN_ROUTE.length,types=new Set(run.map.nitrogenHazards.map(item=>item.type)),subtypes=new Set(run.map.nitrogenHazards.map(item=>item.subtype));
  assert.ok(routeLength>=5300&&routeLength<=5400,`v3 main route length ${routeLength}`);assert.equal(run.map.nitrogenZones.length,6);assert.deepEqual(NITROGEN_ZONES.map(zone=>zone.id),['entry-pocket','drive-channel','choice-shelf','pulse-lip','insight-basin','core-approach']);assert.ok(types.has('mechanical')&&types.has('thermal'));assert.ok(subtypes.has('pressure')&&subtypes.has('shear')&&subtypes.has('turbulence'));assert.ok(NITROGEN_ROUTE.points.every(point=>point.y>=NITROGEN_REGION_BOUNDS.top&&point.y<=NITROGEN_REGION_BOUNDS.bottom));
});

test('N2 Critical Insight uses existing engagement gate, run-local carry, return commit and forced-return loss',()=>{
  const storage=memory(),value=createResources({storage});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.prepareExpedition({region:'nitrogen',rng:()=>.5});
  const early={time:FIELD_INSIGHT_MIN_SECONDS-1,insightEngagementSatisfied:false,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{N:1}};assert.deepEqual(value.signal('nitrogen',.1,.2,{runContext:early}),{deferred:true,critical:true},'N pickup cannot bypass the engagement gate');
  value.findElementForExpedition('N');const noPickup={time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+200,collectedElements:{N:0}};assert.deepEqual(value.signal('nitrogen',.1,.2,{runContext:noPickup}),{deferred:true,critical:true},'persistent N discovery cannot substitute for current-run collection');
  const engaged={...noPickup,collectedElements:{N:1}},opportunity=value.signal('nitrogen',.1,.2,{runContext:engaged});assert.equal(opportunity.recipe,NITROGEN_MOLECULE_ID);
  const carried={captured:false,carriedInsights:[],analysis:null,events:[]};assert.equal(triggerInsight(carried,NITROGEN_MOLECULE_ID,value.state)?.critical,true);assert.deepEqual(carried.carriedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(!value.state.hints.includes(NITROGEN_MOLECULE_ID),'acquisition remains run-local');
  const before=value.state.elements.N,normal=value.settleExpedition({H:0,C:0,N:96,O:0},0,false,{insights:carried.carriedInsights});assert.ok(normal.committedInsights.includes(NITROGEN_MOLECULE_ID));assert.ok(value.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(value.state.elements.N-before,96);assert.equal(JSON.parse(storage.raw(RESOURCE_KEY)).schemaVersion,9);

  const forced=createResources({storage:memory()});forced.setCatalog(catalog);forced.setFrontierGraph(graph);forced.state.progress.choCompleted=true;forced.findElementForExpedition('N');forced.prepareExpedition({region:'nitrogen'});const lostRun={captured:false,carriedInsights:[],analysis:null,events:[]};triggerInsight(lostRun,NITROGEN_MOLECULE_ID,forced.state);const loss=forced.settleExpedition({H:0,C:0,N:100,O:0},0,true,{insights:lostRun.carriedInsights});assert.deepEqual(loss.committedInsights,[]);assert.ok(!forced.state.hints.includes(NITROGEN_MOLECULE_ID));assert.equal(loss.lost.N,15);assert.equal(loss.kept.N,85);
  console.log('Nitrogen insight lifecycle',JSON.stringify({timingSeconds:engaged.time,minimumDistance:FIELD_INSIGHT_MIN_DISTANCE,normalCommit:normal.committedInsights,forcedLostN:loss.lost.N}));
});

test('authored N2 signal geometry stays fixed but cannot be picked before marker claimability',()=>{
  const entry=NITROGEN_ROUTE.points[0],distance=Math.hypot(NITROGEN_INSIGHT_AREA.x-entry.x,NITROGEN_INSIGHT_AREA.y-entry.y);assert.ok(distance>FIELD_INSIGHT_MIN_DISTANCE);assert.ok(nitrogenInsightAreaAt(NITROGEN_INSIGHT_AREA));
  const run=nitrogenRun();run.insightEngagementOrigin={x:run.player.x,y:run.player.y};run.player.x=NITROGEN_INSIGHT_AREA.x;run.player.y=NITROGEN_INSIGHT_AREA.y;run.time=FIELD_INSIGHT_MIN_SECONDS-2;run.insightEngagementMaxDistance=distance;const signal=run.map.signals.find(item=>item.region==='nitrogen'&&item.id===NITROGEN_INSIGHT_ANCHORS[0].id);signal.x=run.player.x;signal.y=run.player.y;signal.claimable=false;
  const earlyEvents=stepRun(run,{x:0,y:0},1/60);assert.ok(!earlyEvents.some(event=>event.type==='signal'),'hidden/non-claimable geometry cannot be consumed');assert.equal(signal.ready,false);
  run.collectedElements.N=1;run.foundElements.push('N');run.time=FIELD_INSIGHT_MIN_SECONDS;run.insightEngagementSatisfied=true;signal.claimable=true;const claimed=stepRun(run,{x:0,y:0},1/60);assert.ok(claimed.some(event=>event.type==='signal'&&event.region==='nitrogen'),'claimable marker pickup emits the existing signal event');assert.equal(signal.ready,true);assert.equal(signal.claimable,false);
});

test('three N2 resonance anchors keep the 20s, 1200-distance and current-run-N gates and expose only the nearest once',()=>{
  const value=createResources({storage:memory()});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.prepareExpedition({region:'nitrogen'});
  const run=nitrogenRun(),anchors=run.map.signals.filter(signal=>signal.nitrogenCritical),evaluate=signal=>value.signalClaimability(signal.region,signal.roll,signal.choice,{runContext:run});
  assert.equal(anchors.length,3);run.player.x=80;run.player.y=-16980;run.insightEngagementOrigin={x:280,y:-12920};run.insightEngagementMaxDistance=1300;run.time=FIELD_INSIGHT_MIN_SECONDS-1;
  syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(anchors.filter(signal=>signal.claimable).length,0,'elapsed-time gate blocks every resonance anchor');
  run.time=FIELD_INSIGHT_MIN_SECONDS;run.insightEngagementMaxDistance=FIELD_INSIGHT_MIN_DISTANCE-1;syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(anchors.filter(signal=>signal.claimable).length,0,'distance gate blocks every resonance anchor');
  run.insightEngagementMaxDistance=FIELD_INSIGHT_MIN_DISTANCE;run.insightEngagementSatisfied=true;syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(anchors.filter(signal=>signal.claimable).length,0,'persistent N knowledge cannot replace current-run cargo');
  run.collectedElements.N=1;run.foundElements.push('N');const selected=syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(selected.signal.id,NITROGEN_INSIGHT_ANCHORS[1].id);assert.deepEqual(anchors.filter(signal=>signal.claimable).map(signal=>signal.id),[NITROGEN_INSIGHT_ANCHORS[1].id]);
  const events=stepRun(run,{x:0,y:0},1/60);assert.ok(events.some(event=>event.type==='signal'&&event.region==='nitrogen'));assert.equal(selected.signal.ready,true);
  const opportunity=value.signal('nitrogen',selected.signal.roll,selected.signal.choice,{runContext:run,claimableOnly:true});assert.equal(opportunity.recipe,NITROGEN_MOLECULE_ID);assert.equal(triggerInsight(run,opportunity.recipe,value.state)?.critical,true);
  syncFieldInsightMarkerClaimability(run,evaluate);assert.equal(anchors.filter(signal=>signal.claimable).length,0,'one anchor claim consumes the run’s single N₂ opportunity');assert.deepEqual(run.carriedInsights,[NITROGEN_MOLECULE_ID]);
});

test('N2 discovery exposes existing LOADOUT roles and NH3 follows generic destination rotation',()=>{
  const value=createResources({storage:memory()});value.setCatalog(catalog);value.setFrontierGraph(graph);value.state.progress.choCompleted=true;value.findElementForExpedition('N');value.hint(NITROGEN_MOLECULE_ID);assert.deepEqual(value.discoverWithLoadout(NITROGEN_MOLECULE_ID,null),{learned:true,assignedUse:null});
  assert.ok(value.tankCatalog('propellant').some(record=>record.id===NITROGEN_MOLECULE_ID));assert.ok(value.tankCatalog('coolant').some(record=>record.id===NITROGEN_MOLECULE_ID));
  value.prepareExpedition({region:'nitrogen',rng:()=>.99});const diagnostic=value.frontierInsightDiagnostics();assert.equal(diagnostic.selectedCandidateId,AMMONIA_MOLECULE_ID);assert.equal(diagnostic.weightingRegion,null);assert.notEqual(diagnostic.hotDestination,'nitrogen','NH3 destination comes from generic stock rotation, not chapter identity');assert.equal(diagnostic.activeForRun,false,'Nitrogen launch cannot bypass a different persisted destination');
  value.prepareExpedition({region:diagnostic.hotDestination});const engaged={region:diagnostic.hotDestination,time:FIELD_INSIGHT_MIN_SECONDS+1,insightEngagementSatisfied:true,insightEngagementMaxDistance:FIELD_INSIGHT_MIN_DISTANCE+500,foundElements:['N']},opportunity=value.signal(diagnostic.hotDestination,.9,.9,{runContext:engaged});assert.equal(opportunity.recipe,AMMONIA_MOLECULE_ID);assert.equal(opportunity.frontier,true);
  value.hint(AMMONIA_MOLECULE_ID);value.discover(AMMONIA_MOLECULE_ID);assert.equal(nitrogenChapterState(value.state).stage,'complete');
  console.log('Nitrogen frontier balance',JSON.stringify({selected:diagnostic.selectedCandidateId,weighting:diagnostic.weightingRegion,destination:diagnostic.hotDestination,availableAfterN2:true,chapter:nitrogenChapterState(value.state).stage}));
});

test('FIELD HUD exposes N through canonical element authority and production launch enables Nitrogen FIELD composition',async()=>{
  const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
  assert.match(uiSource,/\['C','N','O',\.\.\.RARE_ECOLOGY_ELEMENTS\].*resources\.canUseElement\(el\)/s);
  assert.match(uiSource,/event\.element==='N'\?'Nを発見/);
  assert.match(uiSource,/nitrogenField:config\.nitrogenField===true/,'production launch must pass post-CHO Nitrogen capability into createUniverse');
});


test('N dust pickup is run-local cargo, is single-consume until respawn, settles to BASE STOCK, obeys forced loss and persists after reload',()=>{
  const run=nitrogenRun(),dust=run.map.dust.find(item=>item.element==='N');assert.ok(dust);Object.assign(run.player,{x:dust.x,y:dust.y,vx:0,vy:0,speed:0});const before=run.collectedElements.N,events=stepRun(run,{x:0,y:0},1/60);assert.ok(run.collectedElements.N>before);assert.ok(run.elementDust.N>0);assert.ok(events.some(event=>event.type==='pickup'&&event.elements.N>0));
  const pickedAtoms=run.collectedElements.N,pickedUnits=run.elementDust.N,readyAfterPickup=dust.ready;assert.ok(readyAfterPickup>run.time);const duplicateEvents=stepRun(run,{x:0,y:0},1/60);assert.equal(run.collectedElements.N,pickedAtoms);assert.equal(run.elementDust.N,pickedUnits);assert.ok(!duplicateEvents.some(event=>event.type==='pickup'&&event.elements.N>0),'same N dust cannot be collected again on later frames before respawn');
  const storage=memory(),normal=createResources({storage});normal.setCatalog(catalog);normal.state.progress.choCompleted=true;const settled=normal.settleExpedition({H:0,C:0,N:run.elementDust.N,O:0},0,false);assert.equal(settled.atoms.N,run.elementDust.N);const stock=normal.state.elements.N;assert.ok(stock>0);const reloaded=createResources({storage});reloaded.setCatalog(catalog);assert.equal(reloaded.state.elements.N,stock,'N BASE STOCK survives schema-v9 reload');
  const forced=createResources({storage:memory()});forced.setCatalog(catalog);forced.state.progress.choCompleted=true;const loss=forced.settleExpedition({H:0,C:0,N:100,O:0},0,true);assert.equal(loss.lost.N,15);assert.equal(loss.kept.N,85);assert.equal(forced.state.elements.N,85);
});
