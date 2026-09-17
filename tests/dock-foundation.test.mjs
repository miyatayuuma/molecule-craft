import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {SCHEMA_VERSION,createInitialResourcesState} from '../src/veil/resources-persistence.js';
import {oxygenCapacity,oxygenUpgradeProcesses} from '../src/veil/tank-upgrades.js';
import {normalizeDockResourceEnvelope,inferLegacyOxygenUpgradeLevel,migrateDockStorage} from '../src/veil/dock-migration.js';

const records=[
  {id:'oxygen',atoms:['O','O']},{id:'ethene',atoms:['C','C','H','H','H','H']},{id:'propene',atoms:['C','C','C',...Array(6).fill('H')]},
  {id:'phenol',atoms:[...Array(6).fill('C'),...Array(6).fill('H'),'O']},{id:'formaldehyde',atoms:['C','O','H','H']},
];
const memory=()=>{const data=new Map();return{data,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)}};
const storage=memory(),resources=createResources({storage});resources.setCatalog(records);resources.collect({H:1000,C:1000,O:1000});resources.discover('oxygen');

assert.equal(resources.state.upgrades.oxygenTank,0);assert.equal(oxygenCapacity(resources.state.upgrades.oxygenTank),36);
resources.discover('ethene');let processes=oxygenUpgradeProcesses(resources.state);assert.equal(processes[0].chemistryReady,false);assert.equal(processes[0].available,false);assert.equal(resources.state.upgrades.oxygenTank,0,'single recipe discovery must not auto-upgrade');
resources.discover('propene');processes=oxygenUpgradeProcesses(resources.state);assert.equal(processes[0].available,true);assert.equal(processes[1].sequenceReady,false);assert.equal(resources.state.upgrades.oxygenTank,0,'all Seal chemistry only unlocks the DOCK process');assert.equal(oxygenCapacity(resources.state.upgrades.oxygenTank),36);
assert.ok(resources.upgradeOxygenTank());assert.equal(resources.state.upgrades.oxygenTank,1);assert.equal(oxygenCapacity(resources.state.upgrades.oxygenTank),48);
resources.discover('phenol');resources.discover('formaldehyde');processes=oxygenUpgradeProcesses(resources.state);assert.equal(processes[0].completed,true);assert.equal(processes[1].available,true);assert.equal(resources.state.upgrades.oxygenTank,1,'Composite chemistry discovery must not auto-upgrade');
assert.ok(resources.upgradeOxygenTank());assert.equal(resources.state.upgrades.oxygenTank,2);assert.equal(oxygenCapacity(resources.state.upgrades.oxygenTank),72);assert.equal(resources.upgradeOxygenTank(),false,'completed permanent modifications cannot execute again');

const freshWithUpgrade=level=>{const state=createInitialResourcesState();state.upgrades.oxygenTank=level;return state;};
const levelOne={...resources.snapshot(),schemaVersion:7,upgrades:{oxygenTank:1}},normalizedOne=normalizeDockResourceEnvelope(levelOne);assert.equal(normalizedOne.changed,true);assert.equal(normalizedOne.state.schemaVersion,SCHEMA_VERSION);assert.deepEqual(normalizedOne.state,freshWithUpgrade(1),'legacy 48 save must preserve only its permanent O2 upgrade across the pre-v8 hard boundary');
const levelTwo={...resources.snapshot(),schemaVersion:7,upgrades:{oxygenTank:2}},normalizedTwo=normalizeDockResourceEnvelope(levelTwo);assert.deepEqual(normalizedTwo.state,freshWithUpgrade(2),'legacy 72 save must preserve only its permanent O2 upgrade across the pre-v8 hard boundary');
const inferred48={...levelOne,upgrades:{},tanks:{...levelOne.tanks,oxidizer:{molecule:'oxygen',amount:48,capacity:48}}};assert.equal(inferLegacyOxygenUpgradeLevel(inferred48),1);assert.deepEqual(normalizeDockResourceEnvelope(inferred48).state,freshWithUpgrade(1));
const inferred72={...levelTwo,upgrades:{},tanks:{...levelTwo.tanks,oxidizer:{molecule:'oxygen',amount:60,capacity:72}}};assert.equal(inferLegacyOxygenUpgradeLevel(inferred72),2);assert.deepEqual(normalizeDockResourceEnvelope(inferred72).state,freshWithUpgrade(2));
const current=resources.snapshot();assert.equal(normalizeDockResourceEnvelope(current).changed,false,'current schema state is never rewritten by DOCK migration');const corrupt={...current,upgrades:{oxygenTank:3}};assert.equal(normalizeDockResourceEnvelope(corrupt).changed,false,'invalid current upgrade state remains protected instead of silently rewritten');

const migratedStore=memory();migratedStore.setItem(RESOURCE_KEY,JSON.stringify(levelTwo));migratedStore.setItem('molecule-craft.collection.v1','legacy-collection');migratedStore.setItem('molecule-craft.workspace.v1','legacy-workspace');const migration=migrateDockStorage(migratedStore);assert.equal(migration.changed,true);assert.equal(migratedStore.getItem('molecule-craft.collection.v1'),null);assert.equal(migratedStore.getItem('molecule-craft.workspace.v1'),null);const reloaded=createResources({storage:migratedStore});reloaded.setCatalog(records);assert.equal(reloaded.blocked,false);assert.deepEqual(reloaded.state,freshWithUpgrade(2));assert.equal(reloaded.tankStatus('oxidizer','oxygen').capacity,72);
console.log('DOCK foundation state regression passed: explicit unlock/action, 36→48→72 ordering, persistence authority and legacy upgrade-only preservation.');
