import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  FIELD_RESPONSIBILITY_AUDIT,HAZARD_TYPES,HAZARD_SUBTYPES,PRODUCTION_HAZARD_FAMILIES,
  defineHazard,deterministicNoise1D,organicCorridorInfluence,
} from '../src/veil/hazards.js';
import {VEIL} from '../src/veil/config.js';
import {createMap} from '../src/veil/map.js';
import {createUniverse,environmentAt,BURST_ADVANTAGE_FIELDS} from '../src/veil/universe.js';
import {createRun,stepRun} from '../src/veil/engine.js';
import {
  EXPEDITION_CHALLENGES,challengeCenter,challengeEnvironment,challengeInfluenceAt,challengeProfileAt,
} from '../src/veil/expedition-challenges.js';
import {
  OXYGEN_ROUTES,OXYGEN_THERMAL,OXYGEN_VORTEX,oxygenGateEnvelopeAt,oxygenPressureAt,oxygenThermalAt,
} from '../src/veil/oxygen-routes.js';

assert.deepEqual(Object.values(HAZARD_TYPES),['mechanical','thermal','abrasive','electrical']);
assert.deepEqual(HAZARD_SUBTYPES.mechanical,['pressure','shear','turbulence','vortex']);
assert.deepEqual(HAZARD_SUBTYPES.thermal,['hot-zone','gradient']);
assert.deepEqual(HAZARD_SUBTYPES.abrasive,['particle-stream']);
assert.deepEqual(HAZARD_SUBTYPES.electrical,['arc','charged-region']);
assert.throws(()=>defineHazard('bad','chemical','acid'),/Unknown hazard type/);
assert.equal(PRODUCTION_HAZARD_FAMILIES.some(item=>item.type==='abrasive'),false,'no dummy abrasive production zone is added');
assert.equal(PRODUCTION_HAZARD_FAMILIES.some(item=>item.type==='electrical'),false,'no dummy electrical production zone is added');

const audit=FIELD_RESPONSIBILITY_AUDIT;
assert.ok(audit.agents.some(item=>item.source==='Dust Eater'));
assert.ok(audit.structures.some(item=>item.source.includes('Rare Survey')));
assert.ok(audit.structures.some(item=>item.source.includes('resource dust')));
assert.ok(audit.progressionMechanisms.some(item=>item.source.includes('Insight')));
assert.ok(audit.environmentalHazards.every(item=>!item.source.includes('Dust Eater')));

const map=createMap(73,{H:0,C:0,O:0},{capabilities:{combustionDrive:true}});
assert.ok(map.fields.length>0&&map.fields.every(field=>field.hazard?.type==='mechanical'),'all generic force fields expose mechanical hazard authority');
assert.ok(map.currents.length>0&&map.currents.every(current=>current.hazard?.type==='mechanical'),'revisit currents expose mechanical hazard authority');
const universe=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
for(const field of BURST_ADVANTAGE_FIELDS)assert.equal(field.hazard?.subtype,'shear');
assert.ok(universe.fields.filter(field=>field.kind==='nitrogen-pulse').every(field=>field.hazard?.subtype==='shear'));
assert.ok(universe.currents.every(current=>current.hazard?.type==='mechanical'));
assert.equal(universe.dust.some(dust=>dust.hazard),false,'resource particles remain resources rather than abrasive hazards');

const pulse=EXPEDITION_CHALLENGES.find(item=>item.id==='pulse'),pulseY=(pulse.top+pulse.bottom)/2,pulsePoint={x:challengeCenter(pulse,pulseY),y:pulseY};
const pulseEnv=challengeEnvironment(pulsePoint,0,73);
assert.ok(pulseEnv.hazards.some(hazard=>hazard.type==='mechanical'&&hazard.subtype==='pressure'));
const curve=EXPEDITION_CHALLENGES.find(item=>item.id==='curve'),curveY=curve.bottom-125,curvePoint={x:challengeCenter(curve,curveY),y:curveY};
const curveEnv=challengeEnvironment(curvePoint,0,73);
assert.ok(curveEnv.hazards.some(hazard=>hazard.subtype==='shear'));
const thermalChallenge=EXPEDITION_CHALLENGES.find(item=>item.id==='thermal'),thermalPoint={x:challengeCenter(thermalChallenge,thermalChallenge.centerY),y:thermalChallenge.centerY};
const thermalChallengeEnv=challengeEnvironment(thermalPoint,0,73);
assert.ok(thermalChallengeEnv.hazards.some(hazard=>hazard.type==='thermal'));
assert.equal(challengeEnvironment({x:pulsePoint.x+1200,y:pulsePoint.y},0,73),null);

const profileA=challengeProfileAt(pulse,pulseY,73),profileB=challengeProfileAt(pulse,pulseY,73),profileOtherSeed=challengeProfileAt(pulse,pulseY,74);
assert.deepEqual(profileA,profileB,'organic challenge envelope is deterministic for a world seed');
assert.notDeepEqual(profileA,profileOtherSeed,'world seed can vary organic envelope without launch reroll');
const centerInfluence=challengeInfluenceAt(pulse,{x:profileA.center,y:pulseY},73).intensity;
const midInfluence=challengeInfluenceAt(pulse,{x:profileA.center+profileA.halfWidth*.5,y:pulseY},73).intensity;
const edgeInfluence=challengeInfluenceAt(pulse,{x:profileA.center+profileA.halfWidth*.98,y:pulseY},73).intensity;
assert.ok(centerInfluence>midInfluence&&midInfluence>edgeInfluence&&edgeInfluence>0,'challenge falloff weakens continuously toward the organic edge');
const outsideInfluence=challengeInfluenceAt(pulse,{x:profileA.center+profileA.halfWidth*1.2,y:pulseY},73).intensity;
assert.equal(outsideInfluence,0);

const shortcut=OXYGEN_ROUTES.find(route=>route.id==='oxygen-shortcut'),gate=shortcut.gates[0];
const gateCenter={x:-320,y:gate.y},gateA=oxygenGateEnvelopeAt(shortcut,gate,gateCenter,73,0),gateB=oxygenGateEnvelopeAt(shortcut,gate,gateCenter,73,0),gateOtherSeed=oxygenGateEnvelopeAt(shortcut,gate,gateCenter,74,0);
assert.deepEqual(gateA,gateB,'localized pressure envelope is stable across reload/relaunch for one world seed');
assert.notEqual(gateA.halfWidth,gateOtherSeed.halfWidth,'localized pressure boundary has deterministic seed variation');
assert.equal(gateA.intensity,1,'authored gate center remains full strength');
assert.equal(oxygenPressureAt(gateCenter,73),600,'organic boundary does not reduce the authored gate core');
const gateEdge=oxygenGateEnvelopeAt(shortcut,gate,{x:gateA.center+gateA.halfWidth*.9,y:gate.y},73,0).intensity;
assert.ok(gateEdge>0&&gateEdge<.1,'localized pressure gate has a weak precursor near its edge');
assert.equal(oxygenGateEnvelopeAt(shortcut,gate,{x:gateA.center+gateA.halfWidth*1.2,y:gate.y},73,0).intensity,0);
assert.equal(oxygenPressureAt({x:-320,y:-9360},73),0,'existing safe gap remains safe');

const mainRoute=OXYGEN_ROUTES.find(route=>route.id==='oxygen-main'),mainPressure=environmentAt({x:320,y:-9400},0,universe);
assert.ok(mainPressure.hazards.some(hazard=>hazard.type==='mechanical'&&hazard.subtype==='pressure'));
const vortexPoint={x:OXYGEN_VORTEX.center.x+350,y:OXYGEN_VORTEX.center.y};
assert.ok(environmentAt(vortexPoint,0,universe).hazards.some(hazard=>hazard.type==='mechanical'&&hazard.subtype==='vortex'));
const thermalRoute=OXYGEN_ROUTES.find(route=>route.id===OXYGEN_THERMAL.routeId),thermalSample=oxygenThermalAt({x:thermalRoute.x,y:-9600},73);
assert.ok(thermalSample.hazards.some(hazard=>hazard.type==='thermal'));
assert.ok(environmentAt({x:thermalRoute.x,y:-9600},0,universe).hazards.some(hazard=>hazard.type==='thermal'));
assert.equal(environmentAt({x:0,y:180},0,universe).hazards.some(hazard=>hazard.type==='abrasive'||hazard.type==='electrical'),false);

const gateRun=createRun(createMap(73),VEIL,{predators:false});Object.assign(gateRun.player,{x:VEIL.gate.x,y:VEIL.gate.y,angle:-Math.PI/2,vx:0,vy:-VEIL.speed,speed:VEIL.speed});
stepRun(gateRun,{x:0,y:-1},1/60,{});
assert.ok(gateRun.currentHazards.some(hazard=>hazard.type==='mechanical'&&hazard.subtype==='pressure'),'run exposes local hazard samples for future equipment mitigation');
assert.equal(gateRun.currentHazards.some(hazard=>hazard.id.includes('eater')),false,'Dust Eater never enters environmental currentHazards');

const universeReload=createUniverse(73,{H:0,C:0,O:0,N:0},{capabilities:{combustionDrive:true,nitrogenField:true}});
const probe={x:challengeCenter(pulse,pulseY),y:pulseY};
assert.deepEqual(environmentAt(probe,.4,universe).hazards,environmentAt(probe,.4,universeReload).hazards,'reload/relaunch with the same world seed preserves hazard distribution');
assert.equal(deterministicNoise1D(73,'probe',-9000,180),deterministicNoise1D(73,'probe',-9000,180));
const genericEnvelope=organicCorridorInfluence({seed:73,id:'probe',x:0,y:0,centerX:0,centerY:0,halfWidth:100,halfLength:100,edgeFade:20,widthJitter:.1});
assert.ok(genericEnvelope.intensity>0&&genericEnvelope.intensity<=1);

const rendererSource=await readFile(new URL('../src/veil/renderer.js',import.meta.url),'utf8');
assert.match(rendererSource,/drawChallengeCurrents\(ctx,run\.time,run\.map\.seed/,'challenge visuals use the same seeded organic authority as gameplay');
assert.match(rendererSource,/oxygenGateEnvelopeAt/,'localized gate visuals use the same organic pressure envelope as gameplay');

const hazardSource=await readFile(new URL('../src/veil/hazards.js',import.meta.url),'utf8');
assert.doesNotMatch(hazardSource,/H3PO4|H2SO4|CH2F2|upgrade/i,'FIELD hazard authority contains no chemistry-specific mitigation knowledge');

console.log('FIELD hazard taxonomy passed: stable four-type contract, production mechanical/thermal authority, non-hazard responsibility split, deterministic organic falloff, no launch reroll and future mitigation-ready currentHazards.');
