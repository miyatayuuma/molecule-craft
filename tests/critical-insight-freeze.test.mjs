import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMoleculeGraph} from '../src/molecule-graph.js';
import {createUniverse} from '../src/veil/universe.js';
import {createRun,FIELD_INSIGHT_MIN_DISTANCE,FIELD_INSIGHT_MIN_SECONDS,stepRun,triggerInsight} from '../src/veil/expedition-run.js';
import {flightConfig} from '../src/veil/growth.js';
import {createResources} from '../src/veil/resources.js';
import {syncFieldInsightMarkerClaimability} from '../src/veil/signal-claimability.js';
import {NITROGEN_INSIGHT_AREA} from '../src/veil/nitrogen-routes.js';
import {NITROGEN_MOLECULE_ID} from '../src/veil/nitrogen-progression.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const database=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url),'utf8'));
const graph=createMoleculeGraph(JSON.parse(await readFile(new URL('../data/molecule-graph.json',import.meta.url),'utf8')));

function makeResources(){
  const value=createResources({storage:memory()});value.setCatalog(database);value.setFrontierGraph(graph);
  value.state.progress.choCompleted=true;
  value.state.recipes=['hydrogen','methane','oxygen','water'];
  value.state.progress.foundElements=['H','C','O'];
  value.prepareExpedition({region:'nitrogen',rng:()=>.5});
  return value;
}
function makeCriticalRun(){
  const map=createUniverse(71,{H:0,C:0,N:0,O:0},{capabilities:{combustionDrive:true}}),config=flightConfig({progress:{choCompleted:true},elements:{N:0}}),run=createRun(map,config,{predators:false});
  run.region='nitrogen';run.time=FIELD_INSIGHT_MIN_SECONDS+.5;run.insightEngagementOrigin={x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y+FIELD_INSIGHT_MIN_DISTANCE+100};run.insightEngagementMaxDistance=FIELD_INSIGHT_MIN_DISTANCE+100;run.insightEngagementSatisfied=true;run.elementDust.N=1;run.collectedElements.N=1;run.foundElements.push('N');
  Object.assign(run.player,{x:NITROGEN_INSIGHT_AREA.x,y:NITROGEN_INSIGHT_AREA.y,angle:0,vx:0,vy:0,speed:config.driftSpeed});
  return run;
}
function driveFrame(value,run,input={x:0,y:0},dt=1/60){
  const excludeIds=new Set(run.carriedInsights);if(run.analysis?.id)excludeIds.add(run.analysis.id);
  syncFieldInsightMarkerClaimability(run,signal=>value.signalClaimability(signal.region,signal.roll,signal.choice,{excludeIds,runContext:run}));
  const insightEvents=[];
  for(const event of stepRun(run,input,dt)){
    if(event.type!=='signal')continue;
    const result=value.signal(event.region,event.roll,event.choice,{excludeIds,runContext:run,claimableOnly:true});
    if(!result?.recipe||!value.insightRecipeEligible(result.recipe,{runContext:run}))continue;
    const insight=triggerInsight(run,result.recipe,value.state);if(insight)insightEvents.push(insight);
  }
  syncFieldInsightMarkerClaimability(run,signal=>value.signalClaimability(signal.region,signal.roll,signal.choice,{excludeIds:new Set(run.carriedInsights),runContext:run}));
  return insightEvents;
}

function acquireCritical(value=makeResources(),run=makeCriticalRun()){
  const signal=run.map.signals.find(item=>item.region==='nitrogen');assert.ok(signal,'Nitrogen FIELD must include the authored Critical Insight signal');
  const events=driveFrame(value,run);assert.deepEqual(events,[{type:'insightReady',id:NITROGEN_MOLECULE_ID,critical:true}]);assert.deepEqual(run.carriedInsights,[NITROGEN_MOLECULE_ID]);assert.equal(signal.ready,true);assert.equal(signal.claimable,false);
  return {value,run,signal,events};
}

test('Critical Insight contact is consumed once and FIELD simulation keeps advancing on repeated frames',()=>{
  const {value,run,signal}=acquireCritical(),start={time:run.time,x:run.player.x,y:run.player.y};let criticalEvents=1;
  for(let frame=0;frame<180;frame++)criticalEvents+=driveFrame(value,run,{x:1,y:0}).filter(event=>event.type==='insightReady'&&event.critical).length;
  assert.equal(criticalEvents,1,'remaining on and around the pickup point must not retrigger the Critical Insight');
  assert.equal(signal.ready,true,'claimed opportunity stays consumed for the run');assert.equal(signal.claimable,false,'consumed opportunity stays non-claimable');
  assert.ok(run.time>start.time+2.9,'simulation time continues after Critical pickup');assert.ok(run.player.x>start.x+40,'movement continues after Critical pickup');assert.ok(Number.isFinite(run.player.y)&&run.player.y!==undefined);
});

test('Critical Insight normal return commits after continued FIELD play',()=>{
  const {value,run}=acquireCritical();for(let frame=0;frame<60;frame++)driveFrame(value,run,{x:1,y:0});
  const result=value.settleExpedition(run.elementDust,run.best,false,{destinationReached:run.destinationReached,insights:run.carriedInsights});
  assert.deepEqual(result.committedInsights,[NITROGEN_MOLECULE_ID]);assert.ok(value.state.hints.includes(NITROGEN_MOLECULE_ID));
});

test('Critical Insight forced return still loses the carried idea after continued FIELD play',()=>{
  const {value,run}=acquireCritical();for(let frame=0;frame<60;frame++)driveFrame(value,run,{x:1,y:0});
  const result=value.settleExpedition(run.elementDust,run.best,true,{destinationReached:run.destinationReached,insights:run.carriedInsights});
  assert.deepEqual(result.committedInsights,[]);assert.ok(!value.state.hints.includes(NITROGEN_MOLECULE_ID));
});

test('ordinary frontier Insight keeps the analysis lifecycle',()=>{
  const value=createResources({storage:memory()});value.setCatalog(database);value.setFrontierGraph(graph);value.state.recipes=['methane'];value.state.progress.foundElements=['H','C'];value.prepareExpedition({region:'carbon',rng:()=>0});
  const id=value.frontierInsightDiagnostics().selectedCandidateId;assert.ok(id,'test needs a direct Graph-frontier candidate');
  const run=createRun({seed:3,dust:[],fields:[],labels:[],routes:[],signals:[]},flightConfig(value.state),{predators:false});
  const started=triggerInsight(run,id,value.state);assert.deepEqual(started,{type:'insightAnalysisStart',id});
  for(let frame=0;frame<300;frame++)stepRun(run,{x:0,y:0},1/60);
  assert.equal(run.analysis,null);assert.deepEqual(run.carriedInsights,[id]);
});

console.log('Critical Insight FIELD regression passed: one-shot pickup, repeated-frame movement, return contracts, and ordinary analysis continuation.');
