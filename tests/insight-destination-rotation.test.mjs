import test from 'node:test';
import assert from 'node:assert/strict';
import {makeGraph} from './molecule-frontier-fixtures.mjs';
import {simulate,simulateNitrogenRepresentative,SCENARIOS} from '../scripts/simulate-expedition.mjs';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {createInitialResourcesState,loadPersistedResources,SCHEMA_VERSION} from '../src/veil/resources-persistence.js';
import {
  INSIGHT_DESTINATION_BALANCE_UNIT as UNIT,INSIGHT_DESTINATION_ORDER as DESTINATIONS,
  INSIGHT_DESTINATION_RESOURCE as RESOURCE,recordInsightDestination,scoreInsightDestinations,
} from '../src/veil/insight-destination.js';

const memory=(entries=[])=>{const data=new Map(entries);return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key),raw:key=>data.get(key)??null};};
const balanceStocks=(coverage=10)=>Object.fromEntries(Object.entries(UNIT).map(([element,unit])=>[element,unit*coverage]));
const graph=makeGraph({roots:['root'],nodes:[
  {id:'root',depth:0,branches:['root'],affinities:'H1'},
  {id:'candidate-a',depth:1,branches:['a'],affinities:'H1'},
  {id:'candidate-b',depth:1,branches:['b'],affinities:'C1'},
],edges:[['root','candidate-a'],['root','candidate-b']]});
const records=[{id:'hydrogen',atoms:['H','H']},{id:'root',atoms:['H']},{id:'candidate-a',atoms:['H','H']},{id:'candidate-b',atoms:['H','H','H']}];

function configured({history=[],stocks=balanceStocks(),destinations=DESTINATIONS,choCompleted=true}={}){
  const storage=memory(),value=createResources({storage});value.setCatalog(records);
  Object.assign(value.state.progress,{choCompleted,regions:[...destinations.filter(id=>id!=='nitrogen'),...(destinations.includes('nitrogen')?['nitrogen']:[])],checkpoint:'veil',foundElements:['H'],insightDestinationHistory:[...history]});
  Object.assign(value.state.elements,stocks);value.state.recipes=['hydrogen','root'];value.state.hints=[];value.setFrontierGraph(graph);
  return {value,storage};
}
function measuredRepresentativeYields(){
  const samples={veil:[],carbon:[],oxygen:[],nitrogen:[]},scenario={veil:SCENARIOS.find(row=>row.name==='saving'),carbon:SCENARIOS.find(row=>row.name==='normal'),oxygen:SCENARIOS.find(row=>row.name==='deep')};
  for(let seed=1;seed<=32;seed++){
    samples.veil.push(simulate({...scenario.veil,seed}).collected.H??0);samples.carbon.push(simulate({...scenario.carbon,seed}).collected.C??0);samples.oxygen.push(simulate({...scenario.oxygen,seed}).collected.O??0);samples.nitrogen.push(simulateNitrogenRepresentative(seed));
  }
  return Object.fromEntries(Object.entries(samples).map(([destination,values])=>{values.sort((a,b)=>a-b);const middle=values.length/2;return[destination,Math.round((values[middle-1]+values[middle])/2)];}));
}

test('fresh production FIELD measurements validate the fixed H/C/O/N balance units',()=>{
  const measured=measuredRepresentativeYields();assert.deepEqual(UNIT,{H:57,C:136,O:298,N:49});
  for(const destination of DESTINATIONS){const element=RESOURCE[destination],actual=measured[destination],expected=UNIT[element];assert.ok(Math.abs(actual-expected)/expected<=.2,`${destination} ${element}: production median ${actual} drifted from balance unit ${expected} by more than 20%`);}
});

test('balanced stock distributes 300 assignments evenly and never repeats before a full rotation',()=>{
  let history=[],stocks=balanceStocks(),counts=Object.fromEntries(DESTINATIONS.map(destination=>[destination,0])),sinceVisit=new Set();
  for(let index=0;index<300;index++){
    const scored=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks}),destination=scored.selectedDestination;
    assert.ok(!sinceVisit.has(destination),`balanced rotation repeated ${destination} before visiting every FIELD`);sinceVisit.add(destination);counts[destination]++;
    if(sinceVisit.size===DESTINATIONS.length)sinceVisit.clear();history=recordInsightDestination(history,destination);stocks[RESOURCE[destination]]+=UNIT[RESOURCE[destination]];
  }
  assert.deepEqual(counts,{veil:75,carbon:75,oxygen:75,nitrogen:75});
});

test('destination history stays canonical and bounded to the most recent eight assignments',()=>{
  const history=recordInsightDestination(['veil','carbon','oxygen','nitrogen','veil','carbon','oxygen','nitrogen'],'veil');
  assert.deepEqual(history,['carbon','oxygen','nitrogen','veil','carbon','oxygen','nitrogen','veil']);
  assert.deepEqual(recordInsightDestination(history,'frontier'),history,'the Oxygen subregion is never stored as an independent destination');
  const only=scoreInsightDestinations({availableDestinations:['veil'],history:[],stocks:{H:0}});assert.equal(only.medianCoverage,0);assert.equal(only.destinations[0].rotationScore,1);assert.equal(only.destinations[0].resourceBonus,0);
});

test('15% deadband preserves pure rotation while material O/N shortages move those destinations forward',()=>{
  const history=['veil','carbon'],balanced=balanceStocks(),mild={...balanced,O:UNIT.O*8.5};
  const mildScores=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks:mild}),pureScores=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks:balanced});
  assert.equal(mildScores.selectedDestination,pureScores.selectedDestination);assert.deepEqual(mildScores.destinations.map(row=>[row.destination,row.rotationScore,row.resourceBonus]),pureScores.destinations.map(row=>[row.destination,row.rotationScore,row.resourceBonus]));
  for(const element of ['O','N']){
    const stocks=balanceStocks();stocks[element]=UNIT[element]*6;let recent=[],selectedCount=0;
    for(let index=0;index<300;index++){
      const destination=scoreInsightDestinations({availableDestinations:DESTINATIONS,history:recent,stocks}).selectedDestination;
      if(destination===({O:'oxygen',N:'nitrogen'})[element])selectedCount++;recent=recordInsightDestination(recent,destination);
    }
    assert.ok(selectedCount>75&&selectedCount<300,`${element} shortage selected ${selectedCount}/300; it should rise above balanced 75 without monopolizing selection`);
  }
});

test('extreme shortage can override a recent visit and rare-element stock is ignored',()=>{
  const history=['veil','carbon','oxygen','nitrogen'],stocks=balanceStocks();stocks.O=0;
  const oxygen=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks});assert.equal(oxygen.selectedDestination,'oxygen');assert.ok(oxygen.destinations[0].resourceBonus>1);
  const withRare=scoreInsightDestinations({availableDestinations:DESTINATIONS,history,stocks:{...stocks,P:1e9,S:1e9,F:1e9,Cl:1e9}});
  assert.deepEqual(withRare,oxygen,'P/S/F/Cl must not affect normalized stock, score, or destination');
});

test('recipe choice is independent of H/C/O/N destination scoring and launch region',()=>{
  const balanced=configured(),shortOStocks=balanceStocks();shortOStocks.O=0;const shortage=configured({stocks:shortOStocks});
  const first=balanced.value.insightSeedDiagnostics(),second=shortage.value.insightSeedDiagnostics();
  assert.equal(first.seedId,second.seedId,'changing only resource stock must not alter recipe identity');assert.notEqual(first.hotDestination,second.hotDestination,'the independently scored FIELD may change');
  assert.equal(first.weighting.regionAffinity.region,null);assert.equal(second.weighting.regionAffinity.region,null);
  const recipe=first.seedId;balanced.value.prepareExpedition({region:'carbon'});assert.equal(balanced.value.frontierInsightDiagnostics().selectedCandidateId,recipe);assert.equal(balanced.value.frontierInsightDiagnostics().activeForRun,first.hotDestination==='carbon');
  const fresh=configured();fresh.value.prepareExpedition({region:'carbon'});assert.equal(fresh.value.frontierInsightDiagnostics().selectedCandidateId,recipe,'the same Graph state and RNG select the same recipe from another FIELD');
});

test('P/S/F/Cl stock cannot alter an ordinary recipe, destination, or score',()=>{
  const baseline=configured(),rareOnly=balanceStocks();Object.assign(rareOnly,{P:1e9,S:1e9,F:1e9,Cl:1e9});const altered=configured({stocks:rareOnly});
  const a=baseline.value.insightSeedDiagnostics(),b=altered.value.insightSeedDiagnostics();assert.equal(a.seedId,b.seedId);assert.equal(a.hotDestination,b.hotDestination);assert.deepEqual(a.destinationScores,b.destinationScores);assert.deepEqual(a.normalizedStock,b.normalizedStock);
});

test('destination eligibility excludes locked Nitrogen and enables it after CHO unlock',()=>{
  const {value}=configured({destinations:['veil','carbon','oxygen'],choCompleted:false,stocks:{...balanceStocks(),N:0}});
  value.state.progress.regions.push('nitrogen');
  assert.deepEqual(value.insightSeedDiagnostics().availableDestinations,['veil','carbon','oxygen']);
  value.state.progress.choCompleted=true;value.setFrontierGraph(graph);const next=value.insightSeedDiagnostics();assert.ok(next.availableDestinations.includes('nitrogen'));assert.equal(next.rawStock.N,0);
});

test('new seed assignment records once, retry/reload/failed return preserve the same seed and destination',()=>{
  const {value,storage}=configured(),seed=value.insightSeedDiagnostics(),history=[...value.state.progress.insightDestinationHistory];
  assert.equal(history.length,1);assert.equal(history.at(-1),seed.hotDestination);
  Object.assign(value.state.elements,{H:UNIT.H,C:0,O:0,N:0,P:1e9,S:1e9,F:1e9,Cl:1e9});assert.equal(value.save(),true);
  const reloaded=createResources({storage});reloaded.setCatalog(records);reloaded.setFrontierGraph(graph);assert.equal(reloaded.insightSeedDiagnostics().seedId,seed.seedId);assert.equal(reloaded.insightSeedDiagnostics().hotDestination,seed.hotDestination);assert.deepEqual(reloaded.state.progress.insightDestinationHistory,history);
  const other=seed.hotDestination==='veil'?'carbon':'veil';reloaded.prepareExpedition({region:other});reloaded.settleExpedition({H:0,C:0,O:0,N:0},0,true);
  assert.equal(reloaded.insightSeedDiagnostics().seedId,seed.seedId);assert.equal(reloaded.insightSeedDiagnostics().hotDestination,seed.hotDestination);assert.deepEqual(reloaded.state.progress.insightDestinationHistory,history,'failed/forced-return retry cannot advance rotation');
  reloaded.prepareExpedition({region:seed.hotDestination});reloaded.settleExpedition({H:0,C:0,O:0,N:0},0,false,{insights:[]});
  assert.equal(reloaded.insightSeedDiagnostics().seedId,seed.seedId);assert.equal(reloaded.insightSeedDiagnostics().hotDestination,seed.hotDestination);assert.deepEqual(reloaded.state.progress.insightDestinationHistory,history,'normal return without commit cannot advance rotation');
});

test('successful ordinary Insight commit advances the seed and history exactly once',()=>{
  const {value}=configured(),before=value.insightSeedDiagnostics(),history=value.state.progress.insightDestinationHistory.length;
  value.prepareExpedition({region:before.hotDestination});const result=value.settleExpedition({H:0,C:0,O:0,N:0},0,false,{insights:[before.seedId]});
  assert.deepEqual(result.committedInsights,[before.seedId]);const after=value.insightSeedDiagnostics();assert.notEqual(after.seedId,before.seedId);assert.notEqual(after.hotDestination,before.hotDestination);assert.equal(value.state.progress.insightDestinationHistory.length,history+1);assert.equal(value.state.progress.insightDestinationHistory.at(-1),after.hotDestination);
  const scoringHistory=value.state.progress.insightDestinationHistory.slice(0,-1),expected=scoreInsightDestinations({availableDestinations:after.availableDestinations,history:scoringHistory,stocks:value.state.elements});assert.equal(after.hotDestination,expected.selectedDestination,'commit-time replacement seed uses the latest stock and history snapshot');
});

test('current-schema save without history normalizes without resetting player progress',()=>{
  assert.equal(SCHEMA_VERSION,8);const original=createInitialResourcesState();Object.assign(original.progress,{choCompleted:true,regions:['veil','carbon','oxygen','nitrogen'],checkpoint:'nitrogen',foundElements:['H','C','O','N'],insightSeed:{id:'candidate-a',hotDestination:'carbon'}});original.recipes=['hydrogen','root'];original.hints=['candidate-b'];Object.assign(original.elements,{H:370,C:314,O:830,N:168});original.tanks.propellant={molecule:'hydrogen',amount:17};original.upgrades.oxygenTank=1;delete original.progress.insightDestinationHistory;
  const storage=memory([[RESOURCE_KEY,JSON.stringify(original)]]),loaded=loadPersistedResources(storage),state=loaded.state;
  assert.deepEqual(state.progress.insightDestinationHistory,[]);assert.equal(state.progress.choCompleted,true);assert.equal(state.progress.checkpoint,'nitrogen');assert.deepEqual(state.recipes,['hydrogen','root']);assert.deepEqual(state.hints,['candidate-b']);assert.deepEqual(state.elements,{...original.elements});assert.deepEqual(state.tanks.propellant,{molecule:'hydrogen',amount:17});assert.equal(state.upgrades.oxygenTank,1);assert.deepEqual(state.progress.insightSeed,original.progress.insightSeed);
  const restored=createResources({storage});restored.setCatalog(records);restored.setFrontierGraph(graph);assert.equal(restored.insightSeedDiagnostics().seedId,'candidate-a');assert.equal(restored.insightSeedDiagnostics().hotDestination,'carbon');assert.deepEqual(restored.state.progress.insightDestinationHistory,[],'existing seed destination is retained without retroactively adding it to history');
});
