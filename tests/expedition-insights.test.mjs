import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {VEIL} from '../src/veil/config.js';
import {growthGoal} from '../src/veil/growth.js';
import {CRITICAL_INSIGHT_IDS,createRun,discardActiveInsight,discardRunInsights,stepRun,triggerInsight} from '../src/veil/expedition-run.js';
import {CRITICAL_INSIGHT_STARTER_COUNTS,criticalInsightStarterCount,createResources} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const emptyMap=()=>({seed:29,dust:[],fields:[],labels:[],routes:[]});
const input={x:0,y:0};
const catalog=[
  {id:'ethane',formula:'C₂H₆',atoms:['C','C','H','H','H','H','H','H']},
  {id:'propane',formula:'C₃H₈',atoms:['C','C','C','H','H','H','H','H','H','H','H']},
  {id:'carbon-dioxide',formula:'CO₂',atoms:['C','O','O']},
];
function resources(){const value=createResources({storage:memory()});value.setCatalog(catalog);return value;}
const run=()=>createRun(emptyMap(),VEIL,{predators:false});
function advance(value,seconds,fps=60){const frames=Math.round(seconds*fps),events=[];for(let i=0;i<frames;i++)events.push(...stepRun(value,input,1/fps));return events;}
const settle=(value,flight,captured=false)=>value.settleExpedition({H:0,C:0,O:0},0,captured,{insights:flight.carriedInsights});
const starterCost=(value,id)=>value.costFor(id,criticalInsightStarterCount(id));

assert.deepEqual(CRITICAL_INSIGHT_IDS,['hydrogen','methane','oxygen','water'],'Critical progression is an explicit canonical ID set');
assert.deepEqual(CRITICAL_INSIGHT_STARTER_COUNTS,{hydrogen:80,methane:4,oxygen:8,water:8},'starter operational loads are canonical molecule counts');

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

// H₂ needs two BURSTs worth of atoms. BASE STOCK, FIELD cargo and refundable
// workspace atoms are additive; molecules already committed to tanks are not.
{
  const value=resources(),cost=starterCost(value,'hydrogen');assert.deepEqual(cost,{H:160});
  value.state.elements.H=cost.H-1;assert.deepEqual(value.progressionInsightCandidates(),[]);
  value.state.elements.H=cost.H;assert.deepEqual(value.progressionInsightCandidates(),['hydrogen']);

  const split=resources();split.state.elements.H=cost.H-2;split.state.workspace={atoms:[{element:'H'}]};assert.deepEqual(split.progressionInsightCandidates({cargo:{H:1}}),['hydrogen']);
  const tanked=resources();tanked.state.tanks.propellant={molecule:'hydrogen',amount:criticalInsightStarterCount('hydrogen')};assert.deepEqual(tanked.progressionInsightCandidates(),[],'tank molecules are not decomposed into craft atoms');
}

// CH₄ follows completed H₂ and C discovery, then requires four molecules worth
// of C/H. C discovery by itself is not sufficient.
{
  const value=resources(),cost=starterCost(value,'methane');assert.deepEqual(cost,{C:4,H:16});value.discover('hydrogen');value.findElementForExpedition('C');Object.assign(value.state.elements,cost);value.state.elements.H--;assert.ok(!value.progressionInsightCandidates().includes('methane'));value.state.elements.H++;assert.ok(value.progressionInsightCandidates().includes('methane'));
  const cOnly=resources();cOnly.findElementForExpedition('C');Object.assign(cOnly.state.elements,cost);assert.ok(!cOnly.progressionInsightCandidates().includes('methane'));
}

// O₂ follows completed CH₄ and O discovery, then requires eight molecules worth
// of O. O discovery and inventory alone cannot skip the sequence.
{
  const value=resources(),cost=starterCost(value,'oxygen');assert.deepEqual(cost,{O:16});value.discover('methane');value.findElementForExpedition('O');value.state.elements.O=cost.O-1;assert.ok(!value.progressionInsightCandidates().includes('oxygen'));value.state.elements.O++;assert.ok(value.progressionInsightCandidates().includes('oxygen'));
  const noMethane=resources();noMethane.findElementForExpedition('O');noMethane.state.elements.O=cost.O;assert.ok(!noMethane.progressionInsightCandidates().includes('oxygen'));
}

// H₂O needs completed CH₄ + O₂, eight coolant molecules worth of atoms, and two
// actual DRIVE thermal interruptions. HOT/thermal strain alone is insufficient.
{
  const value=resources(),cost=starterCost(value,'water');assert.deepEqual(cost,{O:8,H:16});value.discover('methane');value.discover('oxygen');value.findElementForExpedition('O');Object.assign(value.state.elements,cost);assert.ok(!value.progressionInsightCandidates().includes('water'));value.state.progress.thermalStrainExperienced=true;assert.ok(!value.progressionInsightCandidates().includes('water'));assert.equal(value.recordDriveThermalInterruption(),true);assert.ok(!value.progressionInsightCandidates().includes('water'));assert.equal(value.recordDriveThermalInterruption(),true);value.state.elements.O--;assert.ok(!value.progressionInsightCandidates().includes('water'));value.state.elements.O++;assert.ok(value.progressionInsightCandidates().includes('water'));
  const oOnly=resources();oOnly.findElementForExpedition('O');Object.assign(oOnly.state.elements,cost);oOnly.state.progress.thermalStrainExperienced=true;oOnly.recordDriveThermalInterruption();oOnly.recordDriveThermalInterruption();assert.ok(!oOnly.progressionInsightCandidates().includes('water'));
}

// Thermal/DRIVE experience survives capture while the H₂O idea remains
// run-local and can be offered again from BASE STOCK on the next launch.
{
  const value=resources(),cost=starterCost(value,'water');value.discover('methane');value.discover('oxygen');Object.assign(value.state.elements,cost);assert.equal(value.recordThermalStrain(),true);assert.equal(value.recordDriveThermalInterruption(),true);assert.equal(value.recordDriveThermalInterruption(),true);assert.deepEqual(value.progressionInsightCandidates(),['water']);const flight=run();assert.deepEqual(triggerInsight(flight,'water',value.state),{type:'insightReady',id:'water',critical:true});settle(value,flight,true);assert.equal(value.state.progress.thermalStrainExperienced,true);assert.equal(value.state.progress.driveThermalInterruptions,2);assert.ok(!value.state.hints.includes('water'));assert.deepEqual(value.progressionInsightCandidates(),['water']);
  const next=run(),id=value.progressionInsightCandidates()[0];assert.deepEqual(triggerInsight(next,id,value.state),{type:'insightReady',id:'water',critical:true});
}

// Current gameplay no longer runs legacy guaranteed hints. The old behavior is
// retained only behind the migration-only migrateDiscoveries flag.
{
  const current=resources();current.state.elements.H=2;current.findElement('C');current.findElement('O');current.setCatalog(catalog);for(const id of [...CRITICAL_INSIGHT_IDS,'carbon-dioxide'])assert.ok(!current.state.hints.includes(id),`${id} must not be current guaranteed progression`);
  current.hint('carbon-dioxide');current.findElement('O');assert.ok(current.state.hints.includes('carbon-dioxide'),'existing CO₂ acquisition is preserved');

  const legacy=createResources({storage:memory()});legacy.state.migrateDiscoveries=true;legacy.state.elements.H=2;legacy.state.progress.foundElements.push('C','O');legacy.setCatalog(catalog);for(const id of [...CRITICAL_INSIGHT_IDS,'carbon-dioxide'])assert.ok(legacy.state.hints.includes(id),`${id} legacy import compatibility`);
}

// Guidance exposes a craft target only after its insight. Before H₂O insight it
// sends the player to use COMBUSTION DRIVE without naming water/coolant.
{
  const value=resources();assert.equal(growthGoal(value.state).id,undefined);value.discover('hydrogen');value.findElementForExpedition('C');assert.equal(growthGoal(value.state).id,undefined);value.hint('methane');assert.equal(growthGoal(value.state).id,'methane');value.discover('methane');value.findElementForExpedition('O');assert.equal(growthGoal(value.state).id,undefined);value.hint('oxygen');assert.equal(growthGoal(value.state).id,'oxygen');value.discover('oxygen');const before=growthGoal(value.state);assert.equal(before.id,undefined);assert.ok(!/H₂O|水|冷却/.test(before.text));assert.match(before.text,/COMBUSTION DRIVE/);value.state.progress.thermalStrainExperienced=true;assert.equal(growthGoal(value.state).id,undefined);value.hint('water');assert.equal(growthGoal(value.state).id,'water');
}

// FIELD launch re-evaluates critical readiness immediately and the historical
// hintless H₂ craft shortcut no longer exists in the UI source.
{
  const ui=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8'),launch=ui.slice(ui.indexOf('function launch'),ui.indexOf('function finish'));
  assert.ok(launch.includes('offerProgressionInsights();'),'launch must offer critical progression without an extra pickup');assert.ok(!ui.includes('firstCraftH'));assert.ok(!ui.includes('firstHydrogen'));
}

// Signal success returns a candidate without granting a hint. The existing
// bonus path still grants atoms, but no longer leaks guaranteed hints in FIELD.
{
  const value=resources();value.findElementForExpedition('H');value.findElementForExpedition('C');const before=[...value.state.hints],result=value.signal('carbon',0,0);assert.equal(result.recipe,'ethane');assert.deepEqual(value.state.hints,before);
  const bonus=createResources({storage:memory()}),bonusBefore=[...bonus.state.hints],bonusResult=bonus.signal('veil',.999,.5);assert.ok(bonusResult.bonus);assert.deepEqual(bonus.state.hints,bonusBefore);assert.ok(bonus.state.elements.H>0);
}

// Expedition settlement commits only carried ideas on voluntary return. Raw
// element discovery during settlement cannot recreate critical/CO₂ hints.
{
  const value=resources();value.findElementForExpedition('O');assert.deepEqual(value.state.hints,[]);const flight=run();flight.carriedInsights=['ethane'];const result=settle(value,flight);assert.deepEqual(result.committedInsights,['ethane']);assert.deepEqual(value.state.hints,['ethane']);assert.ok(!value.state.hints.includes('oxygen'));assert.ok(!value.state.hints.includes('water'));assert.ok(!value.state.hints.includes('carbon-dioxide'));
}

console.log('Expedition Insights passed: run-local lifecycle, operational critical readiness, sequence gates, delayed thermal H₂O unlock, launch reacquisition, legacy isolation, guidance and signal boundary.');
