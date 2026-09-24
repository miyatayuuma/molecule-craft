import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {createUniverse} from '../src/veil/universe.js';
import {flightConfig,growthGoal} from '../src/veil/growth.js';
import {CHO_DESTINATION,recordChoDestination,isCHO} from '../src/veil/cho-campaign.js';
import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';

const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};};
const empty=createResources({storage:memory()});assert.equal(growthGoal(empty.state).id,undefined);empty.collect({H:160});assert.deepEqual(empty.progressionInsightCandidates(),['hydrogen'],'160 H atoms unlock the current H2 critical Insight starter');
const storage=memory(),r=createResources({storage});r.visit('frontier');r.save();
assert.equal(r.state.progress.choCompleted,false,'A region visit is not completion');
r.settleExpedition({H:3},0,false);assert.equal(r.state.progress.choCompleted,false);
r.settleExpedition({O:12},0,true,{destinationReached:true});assert.equal(r.state.progress.choCompleted,false,'Capture loses the current attempt');
r.settleExpedition({O:3},0,false);assert.equal(r.state.progress.choCompleted,false,'A later safe return cannot use an earlier destination attempt');
const success=r.settleExpedition({O:12},0,false,{destinationReached:true});assert.equal(success.completedNow,true);assert.equal(r.state.progress.choCompleted,true);
assert.equal(createResources({storage}).state.progress.choCompleted,true);
assert.equal(r.settleExpedition({},0,false,{destinationReached:true}).completedNow,false,'Ending is first-completion only');
assert.match(growthGoal(r.state).text,/Nitrogen FIELDでNを集め/);
const current=JSON.parse(storage.getItem(RESOURCE_KEY));delete current.progress.choCompleted;storage.setItem(RESOURCE_KEY,JSON.stringify(current));
const tolerated=createResources({storage});assert.equal(tolerated.state.progress.choCompleted,undefined);assert.equal(tolerated.state.progress.frontier,true);assert.equal(tolerated.settleExpedition({},0,false,{destinationReached:true}).completedNow,true);assert.equal(tolerated.state.progress.choCompleted,true);
tolerated.reset(['exploration']);assert.equal(tolerated.state.progress.choCompleted,false);
const nonCurrent=JSON.parse(storage.getItem(RESOURCE_KEY));nonCurrent.schemaVersion=99;const raw=JSON.stringify(nonCurrent);storage.setItem(RESOURCE_KEY,raw);const reset=createResources({storage});assert.equal(reset.blocked,false);assert.equal(reset.state.progress.choCompleted,false);assert.notEqual(storage.getItem(RESOURCE_KEY),raw);assert.equal(JSON.parse(storage.getItem(RESOURCE_KEY)).schemaVersion,9);
const broken=memory();let fail=false;const quota={...broken,setItem:(k,v)=>{if(fail)throw Error('quota');broken.setItem(k,v);}};
const failing=createResources({storage:quota});failing.save();const before=failing.snapshot();fail=true;
assert.equal(failing.settleExpedition({O:9},0,false,{destinationReached:true}),null);assert.deepEqual(failing.snapshot(),before,'Ending and loot roll back together');
assert.equal(createResources({storage:memory()}).settleExpedition({},0,false,{destinationReached:'yes'}),null);
const session=createResources({storage:null});assert.equal(session.settleExpedition({},0,false,{destinationReached:true}).completedNow,true);

for(const fps of [30,60]){
 const run=createRun(createUniverse(1),flightConfig());const d=CHO_DESTINATION;
 Object.assign(run.player,{x:d.x,y:d.y,angle:-Math.PI/2});
 assert.ok(stepRun(run,{x:0,y:0},1/fps).some(e=>e.type==='choDestination'));assert.ok(run.destinationReached);
 assert.equal(stepRun(run,{x:0,y:0},1/fps).filter(e=>e.type==='choDestination').length,0);
 run.eaters.push({id:0,x:run.player.x,y:run.player.y,angle:0,speed:0,vx:0,vy:0,phase:0,trail:[]});stepRun(run,{x:0,y:0},1/fps);assert.ok(run.captured,'Arrival does not disable contacts');
 const crossing=createRun(createUniverse(1),flightConfig(),{predators:false});Object.assign(crossing.player,{x:d.x+150,y:d.y});recordChoDestination(crossing,{x:d.x-150,y:d.y});assert.ok(crossing.destinationReached,'Segment crossing cannot skip the destination');
}
assert.ok(isCHO(['H','C','O']));assert.equal(isCHO(['H','N']),false);
const options={routeId:'oxygen-main',drive:true,coolant:'water',rest:true,policy:'continuous'};
for(const propellant of ['hydrogen','carbon-dioxide']){
 const report=simulateOxygenRoute({...options,propellant,destination:'final'});assert.ok(report.reached,JSON.stringify(report));assert.ok(report.destinationReached);assert.ok(report.choCompleted);assert.equal(report.returnType,'voluntary');assert.equal(report.burstUses,0);
}
const sideFinal=simulateOxygenRoute({...options,routeId:'oxygen-side',propellant:'carbon-dioxide',predators:false,destination:'final'});
assert.ok(sideFinal.reached&&sideFinal.destinationReached&&sideFinal.choCompleted,'Side route must remain a valid path into Deep/CHO');assert.equal(sideFinal.returnType,'voluntary');assert.ok(sideFinal.accountingConsistent);
console.log('CHO campaign: destination, captured/late return, transactional ending, current persistence reset semantics, and route-independent CHO completion passed.');
