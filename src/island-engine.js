import {ISLAND_TARGETS, TARGET_BY_ID, SAMPLE_BY_ID, DISCOVERY_BY_ID, ISLAND_SPECIES} from './island-data.js?v=33';

export const clamp = (n, lo=0, hi=1) => Math.max(lo, Math.min(hi, n));
const approach = (a, b, speed, dt) => a + (b-a) * (1-Math.exp(-speed*dt));
const has = (target, tag) => target.tags.includes(tag);
const zone = () => ({water:0, salt:0, acid:0, base:0, nutrient:0, carbon:0,
  toxin:0, oxygen:.45, fuel:0, heat:0, lift:0, dissolved:0, weakIons:0, conductivity:0, pH:7});

export function createIslandState() {
  const zones = Object.fromEntries(ISLAND_TARGETS.map(t => [t.id, zone()]));
  zones.pond.water=.03; zones.garden.water=.035; zones.garden.carbon=.12;
  return {
    schemaVersion:1, clock:0, experiments:0, zones,
    garden:{vigor:.06, bloom:0}, burner:{lit:false, scorch:0},
    lens:{dust:.6, resin:1}, power:0, caveLight:0, waterfall:0,
    unlocks:{cave:false, marsh:false}, samples:[], discoveries:[], encounters:[],
    pending:[], events:[], nextEvent:0, flags:{wasHarmful:false, neutralized:false, evaporatedSalt:0},
    creatures:ISLAND_SPECIES.flatMap((s,i) => [0,1].map(j => ({
      id:`${s.id}-${j}`, species:s.id, x:[-3.35,-3.3,.3][i]+j*.52,
      z:[2,-1.8,-2.45][i]+j*.24, behavior:'rest', active:i!==2,
    }))),
    preferences:{muted:false, scene:'island', selected:null, dose:1},
  };
}

function emit(world, type, target, extra={}) {
  world.events.push({id:++world.nextEvent, type, target, at:world.clock, ...extra});
  if (world.events.length>120) world.events.splice(0,world.events.length-120);
}
function discover(world, id, target, kind='phenomenon') {
  const list=kind==='creature'?world.encounters:world.discoveries;
  if (list.some(item=>item.id===id) || world.pending.some(item=>item.id===id&&item.kind===kind)) return;
  world.pending.push({id, kind, target, at:world.clock+1.25});
}
function completeDiscoveries(world) {
  const due=world.pending.filter(p=>p.at<=world.clock);
  world.pending=world.pending.filter(p=>p.at>world.clock);
  for (const item of due) {
    const list=item.kind==='creature'?world.encounters:world.discoveries;
    if (list.some(d=>d.id===item.id)) continue;
    list.push({id:item.id, at:world.clock, target:item.target});
    emit(world,'discovery',item.target,{discovery:item.id, kind:item.kind});
  }
}
export function unlockSample(world, id) {
  if (!SAMPLE_BY_ID.has(id)||world.samples.includes(id)) return false;
  world.samples.push(id); return true;
}
export function collectSalt(world) {
  const added=unlockSample(world,'salt');
  emit(world,'collect','salt-rock',{sample:'salt'}); return added;
}

// Each rule matches properties × target tags × current local environment.
// No molecular-ID switch is used; a new sample can reuse every applicable rule.
export const REACTION_RULES = Object.freeze([
  {
    id:'hydration', test:({p})=>p.hydration>0,
    apply(c) {
      const {world,w,p,target,amount}=c, added=.3*p.hydration*amount;
      if (has(target,'pond')||has(target,'soil')||has(target,'aqueous')||has(target,'cave')) {
        w.water+=added; emit(world,'water',target.id,{amount});
        if (has(target,'pond')||has(target,'soil')) discover(world,'water-spreads',target.id);
        // A full vessel spills its contents; fresh water flushes salt/toxin too.
        const capacity=has(target,'pond')?1.2:has(target,'soil')?1:1.15;
        if (w.water>capacity) {
          const excess=w.water-capacity, retain=capacity/w.water;
          for (const key of ['salt','acid','base','toxin','nutrient','weakIons']) w[key]*=retain;
          w.water=capacity;
          if (has(target,'pond')) {world.waterfall=clamp(world.waterfall+excess*3,0,2);discover(world,'rainbow','pond');world.unlocks.marsh=true;}
          emit(world,'overflow',target.id,{amount:excess});
        }
      }
      if (has(target,'burner')) {
        const hot=w.heat>.15||world.burner.lit;
        w.water=clamp(w.water+added); w.heat=Math.max(0,w.heat-added*2.8);
        world.burner.lit=false; world.burner.scorch=Math.max(0,world.burner.scorch-added);
        emit(world,hot?'steam':'water',target.id);
        if (hot) discover(world,'extinguish',target.id);
      }
      if (has(target,'resin')) {
        world.lens.dust=Math.max(0,world.lens.dust-added*2);
        emit(world,'water',target.id);
      }
      // Rainwater on the glass simply runs off; not every liquid inflates it.
      if (has(target,'balloon')) emit(world,'water',target.id);
    },
  },
  {
    id:'crystal-deposit', test:({p})=>p.crystal>0,
    apply({world,w,p,target,amount}) {
      w.salt=clamp(w.salt+.24*p.crystal*amount,0,4);
      emit(world,'salt',target.id,{amount});
      if (has(target,'burner')&&world.burner.lit) discover(world,'salt-flame','burner');
    },
  },
  {
    id:'gas-environment', test:({p})=>p.oxygenRole!==0,
    apply({world,w,p,target,amount}) {
      const before=w.oxygen;
      w.oxygen=clamp(w.oxygen+.58*p.oxygenRole*amount,0,1.6);
      emit(world,p.oxygenRole>0?'oxygen':'gas',target.id,{amount});
      if (has(target,'burner')&&world.burner.lit) {
        if (p.oxygenRole>0 && w.oxygen>before+.2) discover(world,'oxygen-boost','burner');
        if (w.oxygen<.12) {world.burner.lit=false;discover(world,'extinguish','burner');emit(world,'steam','burner');}
      }
    },
  },
  {
    id:'fuel', test:({p})=>p.flammability>0,
    apply({world,w,p,target,amount}) {
      w.fuel=clamp(w.fuel+p.flammability*.7*amount,0,6);
      if (has(target,'burner')) {
        // A retained flame is an ignition source. Fuel alone never ignites.
        w.water=Math.max(0,w.water-.15*amount);
        emit(world,p.phase==='gas'?'gas':'liquid',target.id,{amount});
      }
    },
  },
  {
    id:'solvent', test:({p,target})=>p.solventPower>0&&has(target,'resin'),
    apply({world,p,amount,target}) {
      world.lens.dust=0;world.lens.resin=Math.max(0,world.lens.resin-p.solventPower*amount);
      emit(world,'clean',target.id,{amount});
      if (world.lens.resin<.1) discover(world,'solvent',target.id);
    },
  },
  {
    id:'acid-base', test:({p,target})=>(p.acidity>0||p.basicity>0)&&!has(target,'burner'),
    apply({world,w,p,target,amount}) {
      w.acid=clamp(w.acid+p.acidity*.35*amount,0,3);
      w.base=clamp(w.base+p.basicity*.35*amount,0,3);
      w.weakIons=clamp(w.weakIons+p.conductivityEffect*.7*amount,0,3);
      // Reactions take place in water, including when water is added later.
      if (has(target,'indicator')) emit(world,'tint',target.id,{amount});
    },
  },
  {
    id:'biological', test:({p,target})=>(p.carbonFeed>0||p.nutrientRole>0)&&has(target,'soil'),
    apply({world,w,p,target,amount}) {
      w.carbon=clamp(w.carbon+p.carbonFeed*.4*amount,0,2);
      w.nutrient=clamp(w.nutrient+p.nutrientRole*.2*amount,0,2);
      emit(world,'nutrient',target.id,{amount});
    },
  },
  {
    id:'local-exposure', test:({p,target})=>p.toxicity>0&&!has(target,'burner')&&!has(target,'resin'),
    apply({w,p,amount}) {w.toxin=clamp(w.toxin+p.toxicity*.36*amount,0,3);},
  },
  {
    id:'balloon', test:({p,target})=>p.phase==='gas'&&has(target,'balloon'),
    apply({world,w,p,amount}) {
      w.lift=clamp(w.lift+p.buoyancy*.7*amount-(p.buoyancy?0:.22*amount),0,1.5);
      emit(world,'bubble','flask',{amount});
      if (w.lift>.5) discover(world,'floating','flask');
    },
  },
  {
    id:'gas-release', test:({p,target})=>p.phase==='gas'&&!has(target,'burner')&&!has(target,'balloon'),
    apply({world,w,target,amount}) {emit(world,w.water>.1?'bubble':'gas',target.id,{amount});},
  },
]);

export function applySample(world, sampleId, targetId, dose=1) {
  const sample=SAMPLE_BY_ID.get(sampleId),target=TARGET_BY_ID.get(targetId);
  if (!sample||!target||!world.samples.includes(sampleId)) return {ok:false,reason:'unavailable'};
  const amount=dose===3?3:1, w=world.zones[targetId];
  const context={world,w,p:sample.properties,target,amount};
  emit(world,'drop',targetId,{sample:sampleId,amount});
  const applied=[];
  for (const rule of REACTION_RULES) if (rule.test(context)) {rule.apply(context);applied.push(rule.id);}
  if (!applied.length) emit(world,sample.properties.phase==='gas'?'gas':'bounce',targetId,{sample:sampleId});
  world.experiments++;
  deriveChemistry(world,0);
  return {ok:true,rules:applied};
}
export function ignite(world) {
  const w=world.zones.burner;emit(world,'spark','burner');
  if (w.fuel<.03||w.oxygen<.12||w.water>.3) return false;
  world.burner.lit=true;w.heat=Math.max(w.heat,.2);
  emit(world,'fire','burner');discover(world,'combustion','burner');
  if (w.salt>.05) discover(world,'salt-flame','burner');
  return true;
}
export function drain(world, targetId) {
  const target=TARGET_BY_ID.get(targetId),w=world.zones[targetId];
  if (!target||!has(target,'aqueous')) return false;
  // The visible drain removes a proportional mixture, not selectively salt.
  for (const key of ['water','salt','acid','base','toxin','nutrient','fuel','weakIons']) w[key]*=.15;
  emit(world,'drain',targetId);deriveChemistry(world,0);return true;
}

function deriveChemistry(world,dt) {
  for (const target of ISLAND_TARGETS) {
    const w=world.zones[target.id],wasDissolved=w.dissolved;
    w.dissolved=Math.min(w.salt,w.water*.8);
    w.conductivity=clamp((w.dissolved*3+w.weakIons)/(w.water+.3))*clamp(w.water/.22);
    w.pH=clamp(7+(w.base-w.acid)*3/(w.water+.25),2,12);
    if (w.dissolved>wasDissolved+.015) {emit(world,'dissolve',target.id);discover(world,'salt-dissolves',target.id);}
    if (w.water>.08&&w.acid>.03&&w.base>.03) {
      const neutral=Math.min(w.acid,w.base);w.acid-=neutral;w.base-=neutral;
      w.toxin=Math.max(0,w.toxin-neutral*.25);
      if (has(target,'indicator')) {
        world.flags.neutralized=true;emit(world,'neutralize',target.id);
        if(Math.abs(w.pH-7)<.55)discover(world,'neutralize',target.id);
      }
    }
    if (dt>0) {
      w.toxin=Math.max(0,w.toxin-dt*.006);
      // A passing puff disperses outdoors. The covered burner retains its gas
      // longer so a player has time to add oxygen and then press ignition.
      w.oxygen=approach(w.oxygen,.45,has(target,'burner')?.045:has(target,'aqueous')?.12:.24,dt);
      if (!has(target,'burner')) w.fuel=Math.max(0,w.fuel-dt*.015);
      if (has(target,'soil')) {w.water=Math.max(.02,w.water-dt*.00045);w.base=Math.max(0,w.base-dt*.001);}
    }
  }
}
export function habitatStress(w) {
  return clamp((w.salt/(w.water+.2)-.42)*1.2)+
    clamp(w.toxin/(w.water+.4)-.45)+
    clamp(Math.abs(w.base-w.acid)/(w.water+.25)-.7)+
    (w.oxygen<.13?.8:0);
}
function updateCreatures(world,dt) {
  const pond=world.zones.pond,garden=world.zones.garden,cave=world.zones.cave;
  let fleeing=false,parade=0;
  for (let i=0;i<world.creatures.length;i++) {
    const c=world.creatures[i],phase=world.clock*.42+i*2.3;
    let bx,bz,behavior='rest',active=true;
    if (c.species==='puddle') {
      const safe=habitatStress(pond)<.4;
      behavior=!safe?'flee':pond.water>.3?'swim':'rest';
      [bx,bz]=behavior==='swim'?[-2.2,1.1]:[-3.5,2];
    } else if (c.species==='leaf') {
      const safe=habitatStress(garden)<.4;
      behavior=!safe?'flee':world.garden.vigor>.35?'graze':'rest';
      [bx,bz]=behavior==='graze'?[-2.65,-1.4]:[-3.7,-1.9];
    } else {
      active=world.unlocks.cave;
      behavior=habitatStress(cave)>.4?'flee':world.caveLight>.2&&pond.water>.4&&habitatStress(pond)<.4?'glow':'rest';
      [bx,bz]=behavior==='glow'?[-.85,.9]:behavior==='flee'?[1.6,-.9]:[.6,-2.35];
      if (behavior==='glow') parade++;
    }
    c.active=active;
    if (behavior==='flee'&&active) fleeing=true;
    if (c.behavior!==behavior&&active) {emit(world,'creature',c.species==='puddle'?'pond':c.species==='leaf'?'garden':'cave',{species:c.species,behavior});}
    c.behavior=behavior;
    const moving=!['rest','flee'].includes(behavior),r=moving?.45:.15;
    c.x=approach(c.x,bx+Math.cos(phase)*r+(i%2)*.25,behavior==='flee'?1.2:.65,dt);
    c.z=approach(c.z,bz+Math.sin(phase)*r,behavior==='flee'?1.2:.65,dt);
    if (active&&moving) discover(world,c.species,c.species==='puddle'?'pond':c.species==='leaf'?'garden':'cave','creature');
  }
  if (fleeing) {world.flags.wasHarmful=true;discover(world,'too-much','pond');}
  else if (world.flags.wasHarmful&&pond.water>.25&&world.garden.vigor>.25) discover(world,'recovery','pond');
  if (parade>=2) discover(world,'night-parade','cave');
}

// Simulation runs only while the island is visible. Fixed small steps make the
// same experiment behave the same at 15/30/60fps and after a scene round trip.
export function stepIsland(world,dt) {
  if (!Number.isFinite(dt)||dt<=0) return;
  dt=Math.min(dt,.1);world.clock+=dt;
  deriveChemistry(world,dt);
  const pond=world.zones.pond,garden=world.zones.garden,cell=world.zones.cell,burner=world.zones.burner;
  // The tray has drain holes, so quenching can never permanently lock ignition.
  burner.water=Math.max(0,burner.water-dt*.08);
  const sand=world.zones.soil;
  if(sand.water>.5){const flow=(sand.water-.5)*dt*.25;sand.water-=flow;pond.water=Math.min(1.2,pond.water+flow);}
  if (pond.water>.36) {
    garden.water=approach(garden.water,Math.max(garden.water,pond.water*.75),.75,dt);
    garden.salt=approach(garden.salt,pond.salt*.55,.18,dt);
    garden.toxin=approach(garden.toxin,pond.toxin*.4,.12,dt);
  }
  const healthy=clamp((garden.water-.09)*2.6)*clamp(1-habitatStress(garden));
  const growth=healthy*(.75+Math.min(.45,garden.carbon*.35)+Math.min(.2,garden.nutrient*.3));
  world.garden.vigor=approach(world.garden.vigor,growth,1.1,dt);
  const canBloom=growth>.78&&garden.nutrient>.09&&garden.carbon>.18;
  world.garden.bloom=approach(world.garden.bloom,canBloom?1:0,.35,dt);
  if (world.garden.vigor>.45) discover(world,'garden-wakes','garden');
  if (world.garden.vigor>.78&&garden.carbon>.18&&healthy>.8) discover(world,'carbon-growth','garden');
  if (world.garden.bloom>.65) discover(world,'bloom','garden');
  if (world.burner.lit) {
    if (burner.fuel<.015||burner.oxygen<.07||burner.water>.3) world.burner.lit=false;
    else {
      const rate=Math.min(burner.fuel/dt,.07+.075*burner.oxygen);
      burner.fuel=Math.max(0,burner.fuel-rate*dt);
      burner.oxygen=Math.max(0,burner.oxygen-rate*.22*dt);
      const strength=clamp(.45+burner.oxygen*.9+burner.fuel*.14,0,2);
      burner.heat=approach(burner.heat,strength,2,dt);
      burner.water=Math.max(0,burner.water-dt*.06);
      if (burner.salt>.05) discover(world,'salt-flame','burner');
      if (burner.heat>1.45) {discover(world,'pinwheel','burner');world.burner.scorch=clamp(world.burner.scorch+dt*.02);}
    }
  } else burner.heat=approach(burner.heat,0,1.3,dt);
  // A visible heat pipe warms the cell; evaporation leaves salt behind.
  if (burner.heat>.45&&cell.water>0) {
    const dissolvedBefore=Math.min(cell.salt,cell.water*.8);
    cell.water=Math.max(0,cell.water-dt*.012*burner.heat);
    const precipitated=Math.max(0,dissolvedBefore-Math.min(cell.salt,cell.water*.8));
    world.flags.evaporatedSalt=clamp(world.flags.evaporatedSalt+precipitated,0,2);
    if (world.flags.evaporatedSalt>.035) discover(world,'crystal-garden','cell');
  }
  const power=cell.water>.08?cell.conductivity:0;
  world.power=approach(world.power,power,2.3,dt);
  if (world.power>.4&&cell.dissolved>.02) discover(world,'conductivity','cell');
  if (world.power>.12&&cell.dissolved<.02&&cell.weakIons>.03) discover(world,'weak-electrolyte','cell');
  const light=Math.max(world.power,burner.heat*.5)*(1-world.lens.resin*.88)*(1-world.lens.dust*.25);
  world.caveLight=approach(world.caveLight,light,1.8,dt);
  if (world.caveLight>.32) {world.unlocks.cave=true;discover(world,'cave-light','cave');}
  world.waterfall=Math.max(0,world.waterfall-dt*.05);
  world.zones.flask.lift=Math.max(0,world.zones.flask.lift-dt*.001);
  updateCreatures(world,dt);completeDiscoveries(world);
}
export function advanceIsland(world,seconds) {
  if (!Number.isFinite(seconds)||seconds<=0) return;
  const steps=Math.ceil(Math.min(seconds,60)/.05),dt=Math.min(seconds,60)/steps;
  for(let i=0;i<steps;i++)stepIsland(world,dt);
}
export function takeIslandEvents(world) {return world.events.splice(0);}
export function resetIsland(world) {
  const next=createIslandState();
  // Experiments reset, knowledge and crafted bottles do not disappear.
  next.samples=[...world.samples];next.discoveries=world.discoveries.map(d=>({...d}));
  next.encounters=world.encounters.map(d=>({...d}));next.preferences={...world.preferences};
  return next;
}
export function describeTarget(world,id) {
  const t=TARGET_BY_ID.get(id);if(!t)return '';
  const w=world.zones[id];
  if(id==='pond')return habitatStress(w)>.4?'生き物が岸へ避難している。':w.water>.8?'水がふちまで届きそう。':w.water>.2?'水面がゆれている。':t.note;
  if(id==='garden')return world.garden.bloom>.5?'花がひらいた。葉のあいだに小さな影。':world.garden.vigor>.4?'葉がぴんと立っている。':t.note;
  if(id==='cell')return w.water<.08?'金属板の下は、からっぽ。':world.power>.35?'線の中を光が走っている。':'金属板は水に触れている。光はまだ弱い。';
  if(id==='burner')return world.burner.lit?'炎が風車を動かしている。':w.water>.3?'コンロがぬれている。水が引くまでひと休み。':w.fuel>.03?'燃料がたまっている。':'スイッチを押すと、火花が飛ぶ。';
  if(id==='cave')return world.caveLight>.32?'奥の貝が、ゆっくり動きだした。':world.unlocks.cave?'道は開いている。明かりは消えている。':t.note;
  if(id==='resin')return world.lens.resin<.1?'レンズが透きとおっている。':world.lens.dust<.1?'ほこりは落ちた。べたべたは残っている。':t.note;
  if(id==='crystal')return w.pH<6?'結晶が赤桃色に。':w.pH>8?'結晶が青くなった。':t.note;
  if(id==='flask')return w.lift>.4?'風船がフラスコを引っぱっている。':t.note;
  return w.water>.2?'砂の色が濃くなった。':t.note;
}
