import assert from 'node:assert/strict';
import {createResources} from '../src/veil/resources.js';
import {createRun,stepRun} from '../src/veil/expedition-run.js';
import {createUniverse} from '../src/veil/universe.js';
import {flightConfig} from '../src/veil/growth.js';
import {RARE_ANOMALIES,RARE_SURVEY_RUN_CONFIG,activeRareAnomalies,installRareSurvey,rareSurveyDiagnostics,rareSurveyUnlocked} from '../src/veil/rare-survey.js';

class MemoryStorage{
  constructor(entries=[]){this.map=new Map(entries);}
  getItem(key){return this.map.has(key)?this.map.get(key):null;}
  setItem(key,value){this.map.set(key,String(value));}
  removeItem(key){this.map.delete(key);}
}
const unlockNitrogen=resources=>{resources.state.progress.choCompleted=true;for(const id of ['nitrogen','ammonia'])if(!resources.state.recipes.includes(id))resources.state.recipes.push(id);resources.save();};
const createGame=(storage=new MemoryStorage())=>installRareSurvey(createResources({storage}));
const launch=(resources,seed=71)=>{const fuel=resources.prepareExpedition({region:'veil',rng:()=>.37}),map=createUniverse(seed,resources.state.elements,{capabilities:{combustionDrive:true,nitrogenField:true}});return createRun(map,flightConfig(resources.state),{fuel,predators:false});};
function collect(run,id){
  const site=run.rareSurvey.anomalies.find(item=>item.id===id);assert.ok(site,`missing run anomaly ${id}`);let events=[];
  for(let i=0;i<8&&!site.collected;i++){Object.assign(run.player,{x:site.x,y:site.y,vx:0,vy:0,speed:0,angle:-Math.PI/2});events.push(...stepRun(run,{x:0,y:0},.15,{}));}
  assert.equal(site.collected,true,`scan did not collect ${id}`);return events;
}

{
  const resources=createGame();assert.equal(rareSurveyUnlocked(resources.state),false);assert.deepEqual(activeRareAnomalies(resources.state),[]);
  const run=launch(resources);assert.equal(rareSurveyDiagnostics(run).unlocked,false);assert.equal(run.rareSurvey.anomalies.length,0,'fresh save must not spawn Rare anomalies');
}
{
  const resources=createGame();resources.state.progress.choCompleted=true;resources.state.recipes.push('nitrogen');resources.save();assert.equal(rareSurveyUnlocked(resources.state),false,'Nitrogen eligibility/N2 phase alone must not unlock Rare Survey');assert.equal(launch(resources).rareSurvey.anomalies.length,0);
}
{
  const resources=createGame();unlockNitrogen(resources);assert.equal(rareSurveyUnlocked(resources.state),true,'persistent NH3 discovery completes the Nitrogen chapter');
  const fuelA=resources.prepareExpedition({region:'veil',rng:()=>.1}),fuelB=resources.prepareExpedition({region:'oxygen',rng:()=>.9}),a=fuelA[RARE_SURVEY_RUN_CONFIG].anomalies,b=fuelB[RARE_SURVEY_RUN_CONFIG].anomalies;
  assert.equal(a.length,4);assert.deepEqual(a,b,'relaunch must not reroll authored Rare anomaly locations');assert.deepEqual(new Set(a.map(site=>site.region)),new Set(['veil','carbon','oxygen','nitrogen']));
  assert.deepEqual(a.map(({id,element,quantity})=>({id,element,quantity})),RARE_ANOMALIES.map(({id,element,quantity})=>({id,element,quantity})),'Rare quantities remain data-driven and finite');
}
{
  const storage=new MemoryStorage(),resources=createGame(storage);unlockNitrogen(resources);const target=RARE_ANOMALIES[0],run=launch(resources),events=collect(run,target.id);
  assert.ok(events.some(event=>event.type==='rareAnomalyScanStart'&&event.id===target.id));assert.ok(events.some(event=>event.type==='rareAnomalyCollected'&&event.element===target.element));assert.equal(run.elementDust[target.element],undefined,'Rare specimens must stay outside renewable dust cargo');
  const forced=resources.settleExpedition(run.elementDust,run.best,true,{insights:[]});assert.equal(forced.rareSurvey.committed.length,0);assert.deepEqual(forced.rareSurvey.lost.map(item=>item.id),[target.id]);assert.equal(resources.state.elements[target.element],0);assert.ok(!resources.state.rareSurvey?.claimedIds?.includes(target.id));
  const retry=launch(resources,72),same=retry.rareSurvey.anomalies.find(item=>item.id===target.id);assert.deepEqual({x:same.x,y:same.y},{x:target.x,y:target.y},'forced return must re-expose the identical persistent site');
}
{
  const storage=new MemoryStorage(),resources=createGame(storage);unlockNitrogen(resources);const target=RARE_ANOMALIES[1],run=launch(resources);collect(run,target.id);
  const result=resources.settleExpedition(run.elementDust,run.best,false,{insights:['hydrogen']});assert.deepEqual(result.rareSurvey.committed.map(item=>item.id),[target.id]);assert.equal(result.atoms[target.element],target.quantity);assert.equal(resources.state.elements[target.element],target.quantity);assert.ok(resources.state.rareSurvey.claimedIds.includes(target.id));assert.ok(result.committedInsights.includes('hydrogen'),'Normal Insight settlement must coexist with Rare settlement in the same return');assert.ok(resources.state.hints.includes('hydrogen'));
  const next=launch(resources,73);assert.ok(!next.rareSurvey.anomalies.some(item=>item.id===target.id),'claimed anomaly must never respawn on later launches');assert.equal(resources.canUseElement(target.element),true,'Rare element access requires committed stock');
  const reloaded=createGame(storage);assert.equal(reloaded.state.elements[target.element],target.quantity);assert.ok(reloaded.state.rareSurvey.claimedIds.includes(target.id));assert.equal(reloaded.canUseElement(target.element),true,'save/load must preserve claimed state and usable stock');assert.ok(!launch(reloaded,74).rareSurvey.anomalies.some(item=>item.id===target.id));
}
{
  const resources=createGame();unlockNitrogen(resources);const run=launch(resources,75);for(const site of RARE_ANOMALIES)collect(run,site.id);const result=resources.settleExpedition(run.elementDust,run.best,false,{insights:[]});assert.equal(result.rareSurvey.committed.length,RARE_ANOMALIES.length);
  for(const site of RARE_ANOMALIES)assert.equal(resources.state.elements[site.element],site.quantity);
  const exhausted=launch(resources,76);assert.equal(exhausted.rareSurvey.anomalies.length,0,'all finite anomalies claimed must leave no renewable Rare source');
}

console.log('Rare Survey foundation passed: NH3-complete unlock, fixed multi-region sites, scan/carry, forced loss, atomic normal claim, save/reload, Insight coexistence, and finite exhaustion.');
