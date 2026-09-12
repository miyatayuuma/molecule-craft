import assert from 'node:assert/strict';
import {VEIL} from '../src/veil/config.js';
import {CRITICAL_INSIGHT_IDS,createRun,discardActiveInsight,discardRunInsights,stepRun,triggerInsight} from '../src/veil/expedition-run.js';
import {createResources} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const emptyMap=()=>({seed:29,dust:[],fields:[],labels:[],routes:[]});
const input={x:0,y:0};
const catalog=[
  {id:'ethane',formula:'C₂H₆',atoms:['C','C','H','H','H','H','H','H']},
  {id:'propane',formula:'C₃H₈',atoms:['C','C','C','H','H','H','H','H','H','H','H']},
];
function resources(){const value=createResources({storage:memory()});value.setCatalog(catalog);return value;}
const run=()=>createRun(emptyMap(),VEIL,{predators:false});
function advance(value,seconds,fps=60){const frames=Math.round(seconds*fps),events=[];for(let i=0;i<frames;i++)events.push(...stepRun(value,input,1/fps));return events;}
const settle=(value,flight,captured=false)=>value.settleExpedition({H:0,C:0,O:0},0,captured,{insights:flight.carriedInsights});

assert.deepEqual(CRITICAL_INSIGHT_IDS,['hydrogen','methane','oxygen','water'],'Critical progression is an explicit canonical ID set');

// Normal ideas start one five-second simulation-time analysis and do not touch
// persistent hints until a voluntary settlement commits the carried result.
{
  const value=resources(),flight=run(),started=triggerInsight(flight,'ethane',value.state);
  assert.deepEqual(started,{type:'insightAnalysisStart',id:'ethane'});assert.equal(flight.analysis.id,'ethane');assert.equal(flight.analysis.requiredDuration,5);assert.deepEqual(flight.carriedInsights,[]);assert.deepEqual(value.state.hints,[]);
  advance(flight,4.9);assert.ok(flight.analysis);assert.deepEqual(flight.carriedInsights,[]);assert.deepEqual(value.state.hints,[]);
  const events=advance(flight,.1);assert.equal(flight.analysis,null);assert.deepEqual(flight.carriedInsights,['ethane']);assert.ok(events.some(event=>event.type==='insightReady'&&event.id==='ethane'&&!event.critical));assert.deepEqual(value.state.hints,[]);
  const result=settle(value,flight);assert.deepEqual(result.committedInsights,['ethane']);assert.deepEqual(value.state.hints,['ethane']);
}

// The timer follows simulated run time, so common render rates complete at the
// same five-second boundary.
for(const fps of [15,30,60]){
  const value=resources(),flight=run();triggerInsight(flight,'ethane',value.state);advance(flight,5,fps);assert.equal(flight.analysis,null,`${fps}fps should finish analysis`);assert.deepEqual(flight.carriedInsights,['ethane']);
}

// A voluntary return begun before analysis completion discards only the active
// analysis. Nothing is committed for it.
{
  const value=resources(),flight=run();triggerInsight(flight,'ethane',value.state);advance(flight,2);assert.equal(discardActiveInsight(flight),'ethane');const result=settle(value,flight);assert.deepEqual(result.committedInsights,[]);assert.deepEqual(value.state.hints,[]);
}

// Capture never commits completed or critical carried insights.
{
  const value=resources(),flight=run();triggerInsight(flight,'ethane',value.state);advance(flight,5);assert.deepEqual(flight.carriedInsights,['ethane']);const result=settle(value,flight,true);assert.deepEqual(result.committedInsights,[]);assert.deepEqual(value.state.hints,[]);discardRunInsights(flight);assert.equal(flight.analysis,null);assert.deepEqual(flight.carriedInsights,[]);
}

// Critical progression bypasses the analysis slot but still remains run-local
// until voluntary return. Capture loses it.
for(const id of CRITICAL_INSIGHT_IDS){
  const value=resources(),flight=run(),ready=triggerInsight(flight,id,value.state);assert.deepEqual(ready,{type:'insightReady',id,critical:true});assert.equal(flight.analysis,null);assert.deepEqual(flight.carriedInsights,[id]);assert.ok(!value.state.hints.includes(id));
  const result=settle(value,flight);assert.deepEqual(result.committedInsights,[id]);assert.ok(value.state.hints.includes(id));

  const lostValue=resources(),lostRun=run();triggerInsight(lostRun,id,lostValue.state);const lost=settle(lostValue,lostRun,true);assert.deepEqual(lost.committedInsights,[]);assert.ok(!lostValue.state.hints.includes(id));
}

// Lost ideas are eligible again on a later run.
{
  const value=resources(),first=run();triggerInsight(first,'oxygen',value.state);settle(value,first,true);const second=run();assert.deepEqual(triggerInsight(second,'oxygen',value.state),{type:'insightReady',id:'oxygen',critical:true});
  const normalValue=resources(),normalFirst=run();triggerInsight(normalFirst,'ethane',normalValue.state);advance(normalFirst,5);settle(normalValue,normalFirst,true);const normalSecond=run();assert.deepEqual(triggerInsight(normalSecond,'ethane',normalValue.state),{type:'insightAnalysisStart',id:'ethane'});
}

// Only one normal analysis is active. Critical progression does not consume or
// replace that slot.
{
  const value=resources(),flight=run();triggerInsight(flight,'ethane',value.state);assert.equal(triggerInsight(flight,'propane',value.state),null);assert.equal(flight.analysis.id,'ethane');assert.deepEqual(flight.carriedInsights,[]);
  assert.deepEqual(triggerInsight(flight,'water',value.state),{type:'insightReady',id:'water',critical:true});assert.equal(flight.analysis.id,'ethane');assert.deepEqual(flight.carriedInsights,['water']);
}

// Persistent, active and carried duplicates are rejected.
{
  const hinted=resources();hinted.hint('ethane');assert.equal(triggerInsight(run(),'ethane',hinted.state),null);
  const crafted=resources();crafted.discover('propane');assert.equal(triggerInsight(run(),'propane',crafted.state),null);
  const value=resources(),flight=run();triggerInsight(flight,'water',value.state);assert.equal(triggerInsight(flight,'water',value.state),null);triggerInsight(flight,'ethane',value.state);assert.equal(triggerInsight(flight,'ethane',value.state),null);
}

// FIELD element discovery exposes only non-mutating critical candidates.
{
  const value=resources();assert.equal(value.findElementForExpedition('O'),true);assert.deepEqual(value.state.hints,[]);assert.deepEqual(value.progressionInsightCandidates().sort(),['oxygen','water']);assert.ok(!value.progressionInsightCandidates().includes('carbon-dioxide'));
  const h=resources();assert.deepEqual(h.progressionInsightCandidates({cargo:{H:2}}),['hydrogen']);
  const c=resources();c.findElementForExpedition('C');assert.deepEqual(c.progressionInsightCandidates(),['methane']);
}

// Signal success returns a candidate without granting a hint. The existing
// bonus path still grants atoms, but no longer leaks guaranteed hints in FIELD.
{
  const value=resources();value.findElementForExpedition('H');const before=[...value.state.hints],result=value.signal('veil',0,0);assert.equal(result.recipe,'ethane');assert.deepEqual(value.state.hints,before);
  const bonus=createResources({storage:memory()}),bonusBefore=[...bonus.state.hints],bonusResult=bonus.signal('veil',.999,.5);assert.ok(bonusResult.bonus);assert.deepEqual(bonus.state.hints,bonusBefore);assert.ok(bonus.state.elements.H>0);
}

// Expedition settlement suppresses legacy guaranteed() side effects. Only the
// carried list supplied by a normal return may expand persistent hints.
{
  const value=resources();value.findElementForExpedition('O');assert.deepEqual(value.state.hints,[]);const flight=run();flight.carriedInsights=['ethane'];const result=settle(value,flight);assert.deepEqual(result.committedInsights,['ethane']);assert.deepEqual(value.state.hints,['ethane']);assert.ok(!value.state.hints.includes('oxygen'));assert.ok(!value.state.hints.includes('water'));assert.ok(!value.state.hints.includes('carbon-dioxide'));
}

console.log('Expedition Insights passed: five-second run-local analysis, critical instant carry, return-only persistence, forced-loss recovery, concurrency, signal isolation and guaranteed-hint boundary.');
