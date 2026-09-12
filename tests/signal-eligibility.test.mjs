import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CRITICAL_INSIGHT_IDS} from '../src/veil/expedition-run.js';
import {CHALLENGE_INSIGHT_IDS,EXPEDITION_CHALLENGES,challengeCenter,recordChallengePassage} from '../src/veil/expedition-challenges.js';
import {GROWTH,REGIONS,REGION_ORDER} from '../src/veil/growth.js';
import {createResources,minimumSignalRegionFor,regionRank,signalCandidateEligible} from '../src/veil/resources.js';

const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};};
const H1={id:'hydrogen-trimer',atoms:['H','H','H']};
const H2={id:'hydrogen-chain',atoms:['H','H','H','H']};
const H3={id:'hydrogen-cluster',atoms:['H','H','H','H','H']};
const C1={id:'ethane',atoms:['C','C','H','H','H','H','H','H']};
const O1={id:'carbon-monoxide',atoms:['C','O']};
const regionalCatalog=[H1,C1,O1];
const make=(catalog=regionalCatalog)=>{const value=createResources({storage:memory()});value.setCatalog(catalog);return value;};
const eligible=(record,region,{unlocked=new Set(['H','C','O']),recipes=[],hints=[],excludeIds=new Set()}={})=>signalCandidateEligible(record,{region,recipes,hints,excludeIds,canUseElement:element=>unlocked.has(element)});

// FIELD region order is an explicit progression rank and stays aligned with the
// current authored region keys.
assert.deepEqual(REGION_ORDER,['veil','carbon','oxygen','frontier']);
assert.deepEqual(Object.keys(REGIONS),REGION_ORDER);
for(const [rank,region] of REGION_ORDER.entries())assert.equal(regionRank(region),rank);
assert.equal(regionRank('unknown'),-1);

// Minimum signal region is derived from H/C/O composition, not DB metadata.
assert.equal(minimumSignalRegionFor(H1),'veil');
assert.equal(minimumSignalRegionFor(C1),'carbon');
assert.equal(minimumSignalRegionFor(O1),'oxygen');
assert.equal(minimumSignalRegionFor({id:'pure-carbon',atoms:['C','C']}),'carbon');
assert.equal(minimumSignalRegionFor({id:'oxygen-only',atoms:['O','O','O']}),'oxygen');
assert.equal(minimumSignalRegionFor({id:'nitrogen-test',atoms:['N','H']}),null);
assert.equal(minimumSignalRegionFor({id:'empty-test',atoms:[]}),null);

// Critical progression and challenge-owned rewards are never generic signals.
const challengeRewards=EXPEDITION_CHALLENGES.flatMap(challenge=>challenge.rewards);
assert.deepEqual(CHALLENGE_INSIGHT_IDS,[...new Set(challengeRewards)]);
for(const id of CRITICAL_INSIGHT_IDS)assert.equal(eligible({id,atoms:['H']},'frontier'),false,`${id} is critical-owned`);
for(const id of CHALLENGE_INSIGHT_IDS)assert.equal(eligible({id,atoms:['H']},'frontier'),false,`${id} is challenge-owned`);

// Challenge traversal still emits the curated reward list once, unchanged.
for(const challenge of EXPEDITION_CHALLENGES){
  const startY=challenge.bottom-1,endY=challenge.top-1;
  const run={map:{universe:true},player:{x:challengeCenter(challenge,startY),y:startY},events:[]};
  recordChallengePassage(run,{x:challengeCenter(challenge,challenge.bottom+1),y:challenge.bottom+1});
  run.player.x=challengeCenter(challenge,endY);run.player.y=endY;
  recordChallengePassage(run,{x:challengeCenter(challenge,startY),y:startY});
  assert.deepEqual(run.events,[{type:'inspiration',rewards:challenge.rewards}]);
  recordChallengePassage(run,{x:challengeCenter(challenge,startY),y:startY});assert.equal(run.events.length,1);
}

// Eligibility is cumulative by region, but required FIELD elements must still
// be discovered. Oxygen-bearing records cannot leak into Carbon Drift.
assert.equal(eligible(H1,'veil'),true);assert.equal(eligible(C1,'veil'),false);assert.equal(eligible(O1,'veil'),false);
assert.equal(eligible(H1,'carbon'),true);assert.equal(eligible(C1,'carbon'),true);assert.equal(eligible(O1,'carbon'),false);
assert.equal(eligible(H1,'oxygen'),true);assert.equal(eligible(C1,'oxygen'),true);assert.equal(eligible(O1,'oxygen'),true);
assert.equal(eligible(H1,'frontier'),true);assert.equal(eligible(C1,'frontier'),true);assert.equal(eligible(O1,'frontier'),true);
assert.equal(eligible(C1,'carbon',{unlocked:new Set(['H'])}),false);
assert.equal(eligible(O1,'oxygen',{unlocked:new Set(['H','C'])}),false);
assert.equal(eligible(C1,'oxygen',{unlocked:new Set(['H','C'])}),true);

// Persistent and caller-supplied run-local exclusions share the same semantic
// candidate gate; the resources layer receives IDs only, never a run object.
assert.equal(eligible(H1,'frontier',{hints:[H1.id]}),false);
assert.equal(eligible(H1,'frontier',{recipes:[H1.id]}),false);
assert.equal(eligible(H1,'frontier',{excludeIds:new Set([H1.id])}),false);
assert.equal(eligible({id:'dozen-hydrogen',atoms:Array(12).fill('H')},'veil'),true);
assert.equal(eligible({id:'thirteen-hydrogen',atoms:Array(13).fill('H')},'veil'),false);

// Resource-level candidate selection honors the same cumulative region rules.
function signalAt(region,unlocks=[]){const value=make();for(const element of unlocks)value.findElementForExpedition(element);const before=[...value.state.hints],result=value.signal(region,0,.999);assert.deepEqual(value.state.hints,before);return result;}
assert.equal(signalAt('veil').recipe,H1.id);
assert.equal(signalAt('carbon',['C']).recipe,C1.id);
assert.equal(signalAt('oxygen',['C','O']).recipe,O1.id);
assert.equal(signalAt('frontier',['C','O']).recipe,O1.id);

// Reaching a region alone does not unlock its element for signal purposes.
{
  const lockedCarbon=make([C1]);assert.ok(lockedCarbon.signal('carbon',0,0).bonus);
  const openCarbon=make([C1]);openCarbon.findElementForExpedition('C');assert.equal(openCarbon.signal('carbon',0,0).recipe,C1.id);
  const lockedOxygen=make([O1]);lockedOxygen.findElementForExpedition('C');assert.ok(lockedOxygen.signal('oxygen',0,0).bonus);
  const openOxygen=make([O1]);openOxygen.findElementForExpedition('C');openOxygen.findElementForExpedition('O');assert.equal(openOxygen.signal('oxygen',0,0).recipe,O1.id);
}

// Existing persistent knowledge and current-run analysis/carry IDs cannot be
// redrawn. A successful signal therefore advances to another eligible idea.
{
  const persistent=make([H1,H2,H3]);persistent.hint(H1.id);persistent.discover(H2.id);assert.equal(persistent.signal('veil',0,0).recipe,H3.id);
  const local=make([H1,H2,H3]),before=[...local.state.hints];assert.equal(local.signal('veil',0,0,{excludeIds:new Set([H1.id,H2.id])}).recipe,H3.id);assert.deepEqual(local.state.hints,before);
}

// Injected choice keeps the existing floor(choice * candidates.length)
// deterministic selection contract after filtering.
for(const [choice,id] of [[0,H1.id],[.5,H2.id],[.999,H3.id]])assert.equal(make([H1,H2,H3]).signal('veil',0,choice).recipe,id);

// Chance, three-attempt pity and 45-collected cooldown semantics are unchanged.
assert.equal(GROWTH.signalChance,.38);assert.equal(GROWTH.signalPity,3);
{
  const pity=make([H1]);
  for(let attempt=1;attempt<=3;attempt++){
    const result=pity.signal('veil',.999,0);if(attempt<3){assert.ok(result.bonus);assert.equal(pity.state.progress.signalMisses,attempt);pity.collect(45,0);}else{assert.equal(result.recipe,H1.id);assert.equal(pity.state.progress.signalMisses,0);}
  }
}
{
  const cooldown=make([H1,H2]);assert.equal(cooldown.signal('veil',0,0).recipe,H1.id);assert.deepEqual(cooldown.signal('veil',0,0),{repeat:true});cooldown.collect(44,0);assert.deepEqual(cooldown.signal('veil',0,0),{repeat:true});cooldown.collect(1,0);assert.equal(cooldown.signal('veil',0,.999).recipe,H2.id);
}

// No eligible candidate and ordinary misses retain the existing material bonus
// path without leaking a persistent hint from guaranteed progression.
{
  const none=make([]),before=[...none.state.hints],misses=none.state.progress.signalMisses,result=none.signal('veil',0,0);assert.deepEqual(result.bonus,{H:10});assert.deepEqual(none.state.hints,before);assert.equal(none.state.progress.signalMisses,misses);
  const miss=make([H1]),missBefore=[...miss.state.hints],missResult=miss.signal('veil',.999,0);assert.deepEqual(missResult.bonus,{H:10});assert.deepEqual(miss.state.hints,missBefore);assert.equal(miss.state.progress.signalMisses,1);
}

// FIELD constructs the exclusion set from both active analysis and carried
// insights, and passes only that set into resources.signal().
const uiSource=await readFile(new URL('../src/veil/ui.js',import.meta.url),'utf8');
assert.match(uiSource,/const excludeIds=new Set\(run\.carriedInsights\)/);
assert.match(uiSource,/run\.analysis\?\.id\)excludeIds\.add\(run\.analysis\.id\)/);
assert.match(uiSource,/resources\.signal\(event\.region,event\.roll,event\.choice,\{excludeIds\}\)/);

console.log('Regional signal eligibility passed: source ownership, cumulative region rank, element unlock, persistent/run-local exclusions, deterministic choice, bonus, pity and cooldown.');
