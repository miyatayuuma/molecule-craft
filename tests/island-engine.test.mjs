import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ISLAND_SAMPLES,SAMPLE_BY_ID,ISLAND_TARGETS,ISLAND_DISCOVERIES} from '../src/island-data.js?v=33';
import {createIslandState,unlockSample,collectSalt,applySample,ignite,drain,advanceIsland,stepIsland,resetIsland,habitatStress} from '../src/island-engine.js?v=33';
import {ISLAND_STORAGE_KEY,createIslandStorage,validateIslandSave,islandSnapshot} from '../src/island-save.js?v=33';

const setup=()=>{const w=createIslandState();for(const s of ISLAND_SAMPLES)unlockSample(w,s.id);return w;};
const found=(w,id)=>w.discoveries.some(d=>d.id===id);
const put=(w,id,target,dose=1)=>assert.equal(applySample(w,id,target,dose).ok,true);
function memory(){const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};}

test('the ten materials use existing recognized recipes, with salt kept ionic',async()=>{
  const db=JSON.parse(await readFile(new URL('../data/molecules.json',import.meta.url)));
  assert.equal(ISLAND_SAMPLES.length,10);
  for(const sample of ISLAND_SAMPLES.filter(s=>s.source==='craft'))assert.ok(db.some(r=>r.id===sample.id));
  assert.equal(SAMPLE_BY_ID.get('salt').source,'mineral');
  const w=createIslandState();assert.equal(applySample(w,'water','pond').ok,false,'Unknown bottles cannot be conjured');
  assert.equal(unlockSample(w,'not-in-slice'),false);assert.equal(collectSalt(w),true);assert.equal(collectSalt(w),false);
});

test('one water drop spreads to soil, plants and two creature species; records lag the effect',()=>{
  const w=setup();put(w,'water','pond',3);
  assert.ok(w.zones.pond.water>.9);assert.equal(w.discoveries.length,0);
  const originalPositions=w.creatures.map(c=>[c.x,c.z]);
  advanceIsland(w,.5);assert.equal(found(w,'water-spreads'),false);
  advanceIsland(w,4.5);
  assert.ok(w.zones.garden.water>.6);assert.ok(w.garden.vigor>.7);
  assert.ok(w.encounters.some(c=>c.id==='puddle'));assert.ok(w.encounters.some(c=>c.id==='leaf'));
  assert.ok(found(w,'water-spreads'));assert.ok(found(w,'garden-wakes'));
  assert.notDeepEqual(w.creatures.map(c=>[c.x,c.z]),originalPositions);
  assert.ok(w.creatures.filter(c=>c.species==='puddle').every(c=>c.behavior==='swim'));
});

test('same water has local outcomes; dry salt and pure water cannot power the metal cell',()=>{
  const w=setup();put(w,'water','garden');assert.equal(w.zones.pond.water,.03);
  put(w,'salt','cell');advanceIsland(w,2);assert.equal(w.power,0);assert.equal(w.zones.cell.dissolved,0);
  const pure=setup();put(pure,'water','cell',3);advanceIsland(pure,4);assert.equal(pure.power,0);
  put(w,'water','cell');advanceIsland(w,3);assert.ok(w.power>.9);assert.ok(found(w,'conductivity'));
  assert.ok(found(w,'salt-dissolves'));
});

test('property rules also work for a new, differently named solvent',()=>{
  const original=SAMPLE_BY_ID.get('ethanol'),id='test-new-solvent';
  SAMPLE_BY_ID.set(id,{...original,id});
  try{
    const a=setup(),b=setup();unlockSample(b,id);
    put(a,'ethanol','resin');put(b,id,'resin');
    assert.deepEqual(a.lens,b.lens);assert.equal(a.lens.resin,.4);
  }finally{SAMPLE_BY_ID.delete(id);}
});

test('lighting the cave has multiple physical routes; the dirty lens is visible state',()=>{
  const w=setup();put(w,'water','cell');put(w,'salt','cell');advanceIsland(w,3);
  assert.ok(w.power>.9);assert.equal(w.unlocks.cave,false,'Opaque lens still obscures the light');
  put(w,'water','resin');assert.equal(w.lens.dust,0);assert.equal(w.lens.resin,1);
  put(w,'acetone','resin');advanceIsland(w,3);assert.ok(w.unlocks.cave);assert.ok(found(w,'cave-light'));
  const thermal=setup();put(thermal,'ethanol','resin',3);put(thermal,'methane','burner',3);put(thermal,'oxygen','burner');ignite(thermal);advanceIsland(thermal,4);
  assert.equal(thermal.power,0);assert.ok(thermal.unlocks.cave,'Heat-powered lamp is an alternative to the metal cell');
});

test('fuel, available oxygen and ignition are separate; water and CO2 extinguish',()=>{
  const w=setup();put(w,'oxygen','burner');assert.equal(ignite(w),false);
  put(w,'methane','burner',3);assert.equal(w.burner.lit,false);
  w.zones.burner.oxygen=0;assert.equal(ignite(w),false);
  put(w,'oxygen','burner');assert.equal(ignite(w),true);advanceIsland(w,2);const heat=w.zones.burner.heat;
  put(w,'oxygen','burner');advanceIsland(w,2);assert.ok(w.zones.burner.heat>heat);assert.ok(found(w,'oxygen-boost'));
  put(w,'carbon-dioxide','burner',3);assert.equal(w.burner.lit,false);advanceIsland(w,2);assert.ok(found(w,'extinguish'));
  put(w,'oxygen','burner');put(w,'methane','burner');assert.ok(ignite(w));
  put(w,'water','burner',3);assert.equal(w.burner.lit,false);assert.equal(ignite(w),false);
  advanceIsland(w,10);assert.ok(ignite(w),'Drain holes prevent permanent wet-burner lockout');
});

test('acid/base changes the indicator, neutralizes in water, and retains conductive ions',()=>{
  const w=setup();put(w,'acetic-acid','crystal');assert.ok(w.zones.crystal.pH<5);
  put(w,'ammonia','crystal');assert.equal(w.flags.neutralized,false,'No aqueous reaction without water');
  put(w,'water','crystal');advanceIsland(w,2);
  assert.equal(w.zones.crystal.pH,7);assert.ok(found(w,'neutralize'));assert.ok(w.zones.crystal.weakIons>0);
  const cell=setup();put(cell,'water','cell');put(cell,'acetic-acid','cell');advanceIsland(cell,3);
  assert.ok(cell.power>.12&&cell.power<.4);assert.ok(found(cell,'weak-electrolyte'));
  const excess=setup();put(excess,'water','crystal');put(excess,'ammonia','crystal',3);put(excess,'acetic-acid','crystal');advanceIsland(excess,2);
  assert.ok(excess.zones.crystal.pH>8);assert.equal(found(excess,'neutralize'),false,'A blue crystal must not record returning to purple');
  put(excess,'acetic-acid','crystal');put(excess,'acetic-acid','crystal');advanceIsland(excess,2);
  assert.ok(found(excess,'neutralize'),'The same experiment becomes discoverable when the actual color returns');
});

test('overuse sends creatures away and flushing restores the habitat without resetting',()=>{
  const w=setup();put(w,'water','pond',3);advanceIsland(w,5);
  put(w,'salt','pond',3);put(w,'ammonia','pond',3);advanceIsland(w,3);
  assert.ok(habitatStress(w.zones.pond)>.4);assert.ok(w.creatures.some(c=>c.behavior==='flee'));assert.ok(found(w,'too-much'));
  assert.equal(drain(w,'pond'),true);put(w,'water','pond',3);put(w,'water','garden',3);advanceIsland(w,8);
  assert.ok(w.creatures.filter(c=>c.species==='puddle').every(c=>c.behavior==='swim'));assert.ok(found(w,'recovery'));
  assert.equal(drain(w,'burner'),false);
});

test('carbon and nitrogen help a hydrated garden; excess is not an unlimited health boost',()=>{
  const dry=setup();put(dry,'carbon-dioxide','garden');advanceIsland(dry,3);assert.ok(dry.garden.vigor<.2);
  assert.equal(found(dry,'carbon-growth'),false);
  const harmful=setup();put(harmful,'water','garden',3);put(harmful,'salt','garden',3);put(harmful,'carbon-dioxide','garden');advanceIsland(harmful,5);
  assert.equal(found(harmful,'carbon-growth'),false,'Adding carbon to a stressed plant is not a growth discovery');
  const w=setup();put(w,'water','garden',3);put(w,'carbon-dioxide','garden');put(w,'ammonia','garden');advanceIsland(w,8);
  assert.ok(w.garden.bloom>.65);assert.ok(found(w,'bloom'));assert.ok(found(w,'carbon-growth'));
  put(w,'ammonia','garden',3);put(w,'ammonia','garden',3);advanceIsland(w,3);
  assert.ok(w.garden.vigor<.5);assert.ok(w.creatures.some(c=>c.species==='leaf'&&c.behavior==='flee'));
});

test('eight environmental surprises are reachable without secret molecular-ID commands',()=>{
  const w=setup();put(w,'water','pond',3);put(w,'water','pond',3);advanceIsland(w,2);assert.ok(found(w,'rainbow'));assert.ok(w.waterfall>0);
  put(w,'hydrogen','flask');advanceIsland(w,2);assert.ok(found(w,'floating'));
  put(w,'water','crystal');put(w,'ammonia','crystal');put(w,'acetic-acid','crystal');advanceIsland(w,2);assert.ok(found(w,'neutralize'));
  put(w,'methane','burner',3);put(w,'oxygen','burner',3);put(w,'salt','burner');ignite(w);advanceIsland(w,3);assert.ok(found(w,'pinwheel'));assert.ok(found(w,'salt-flame'));
  put(w,'water','garden',3);put(w,'carbon-dioxide','garden');put(w,'ammonia','garden');advanceIsland(w,7);assert.ok(found(w,'bloom'));
  put(w,'water','cell');put(w,'salt','cell',3);put(w,'acetone','resin');put(w,'methane','burner',3);put(w,'oxygen','burner',3);ignite(w);advanceIsland(w,8);
  assert.ok(found(w,'crystal-garden'));assert.ok(found(w,'night-parade'));
  for(const d of ISLAND_DISCOVERIES.filter(d=>d.hidden))assert.ok(found(w,d.id),d.id);
  const drySalt=setup();put(drySalt,'water','cell');put(drySalt,'salt','cell',3);advanceIsland(drySalt,3);
  assert.equal(found(drySalt,'crystal-garden'),false,'Excess undissolved salt is not newly precipitated salt');
  put(drySalt,'methane','burner',3);put(drySalt,'oxygen','burner',3);ignite(drySalt);advanceIsland(drySalt,.8);
  assert.equal(drySalt.pending.some(d=>d.id==='crystal-garden'),false,'The discovery waits for visible crystal growth, not merely an active heater');
  advanceIsland(drySalt,8);assert.ok(found(drySalt,'crystal-garden'));
});

test('15 and 60fps have equivalent causal outcomes, with no giant background time jump',()=>{
  const worlds=[setup(),setup()];for(const w of worlds){put(w,'water','pond',3);put(w,'water','cell');put(w,'salt','cell');put(w,'acetone','resin');}
  for(const [i,rate]of [15,60].entries())for(let n=0;n<rate*8;n++)stepIsland(worlds[i],1/rate);
  const [a,b]=worlds;assert.ok(Math.abs(a.garden.vigor-b.garden.vigor)<.01);assert.deepEqual(a.discoveries.map(d=>d.id).sort(),b.discoveries.map(d=>d.id).sort());
  const before=a.clock;stepIsland(a,600);assert.ok(a.clock-before<.101);
});

test('discovery is idempotent; reset preserves knowledge and bottles only',()=>{
  const w=setup();for(let i=0;i<12;i++)put(w,'water','pond');advanceIsland(w,6);
  assert.equal(w.discoveries.filter(d=>d.id==='water-spreads').length,1);
  const copy=resetIsland(w);assert.deepEqual(copy.discoveries,w.discoveries);assert.deepEqual(copy.encounters,w.encounters);assert.deepEqual(copy.samples,w.samples);
  assert.equal(copy.zones.pond.water,.03);assert.equal(copy.experiments,0);assert.equal(copy.unlocks.cave,false);
});

test('save round trip includes creatures, pending discoveries and unlocks',()=>{
  const w=setup();put(w,'water','pond',3);put(w,'water','cell');put(w,'salt','cell');put(w,'acetone','resin');advanceIsland(w,5);put(w,'hydrogen','flask');
  const store=memory(),s=createIslandStorage({storage:store});s.read();assert.ok(s.write(w));
  const restored=createIslandStorage({storage:store}).read();assert.deepEqual(islandSnapshot(restored),islandSnapshot(w));
  advanceIsland(restored,2);assert.ok(found(restored,'floating'));assert.ok(restored.unlocks.cave);
});

test('future, malformed, cross-tab and quota failures preserve the existing save',()=>{
  for(const raw of ['{broken',JSON.stringify({schemaVersion:8})]) {
    const memoryStore=memory();memoryStore.setItem(ISLAND_STORAGE_KEY,raw);const s=createIslandStorage({storage:memoryStore});const w=s.read();putAfterUnlock(w);
    assert.equal(s.write(w),false);assert.equal(memoryStore.getItem(ISLAND_STORAGE_KEY),raw);assert.ok(s.message);
    assert.equal(s.allowReset(),raw==='{broken');
  }
  const store=memory(),a=createIslandStorage({storage:store}),b=createIslandStorage({storage:store});const wa=a.read(),wb=b.read();putAfterUnlock(wa);assert.ok(a.write(wa));
  assert.equal(b.write(wb),false);assert.ok(b.protected);assert.deepEqual(JSON.parse(store.getItem(ISLAND_STORAGE_KEY)),islandSnapshot(wa));
  const quota=createIslandStorage({storage:{getItem:()=>null,setItem:()=>{throw new Error('quota');}}});quota.read();assert.equal(quota.write(setup()),false);assert.ok(quota.message);
  const bad=islandSnapshot(setup());bad.zones.pond.water=Infinity;assert.throws(()=>validateIslandSave(bad));
});
function putAfterUnlock(w){unlockSample(w,'water');put(w,'water','pond');}

test('many mixed experiments remain finite, bounded and recoverable',()=>{
  const w=setup();let seed=37;const rng=()=>{seed=(seed*1664525+1013904223)>>>0;return seed;};
  for(let i=0;i<700;i++) {
    const sample=ISLAND_SAMPLES[rng()%ISLAND_SAMPLES.length],target=ISLAND_TARGETS[rng()%ISLAND_TARGETS.length];
    put(w,sample.id,target.id,rng()%2?1:3);if(i%7===0)ignite(w);if(i%11===0)drain(w,'pond');advanceIsland(w,.3);
    assert.doesNotThrow(()=>validateIslandSave(islandSnapshot(w)));
    assert.ok(w.pending.length<=24);assert.ok(w.events.length<=120);
  }
  for(const target of ['pond','cell','crystal']){drain(w,target);put(w,'water',target,3);}
  assert.doesNotThrow(()=>validateIslandSave(islandSnapshot(resetIsland(w))));
});
