import assert from 'node:assert/strict';
import {createResources,RESOURCE_KEY} from '../src/veil/resources.js';
import {SCHEMA_VERSION} from '../src/veil/resources-persistence.js';
import {oxygenCapacity,oxygenUpgradeProcesses} from '../src/veil/tank-upgrades.js';
import {normalizeDockResourceEnvelope,inferLegacyOxygenUpgradeLevel} from '../src/veil/dock-migration.js';

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

const levelOne={...resources.snapshot(),schemaVersion:7,upgrades:{oxygenTank:1}},normalizedOne=normalizeDockResourceEnvelope(levelOne);assert.equal(normalizedOne.changed,true);assert.equal(normalizedOne.state.schemaVersion,SCHEMA_VERSION);assert.equal(normalizedOne.state.upgrades.oxygenTank,1,'legacy 48 save must remain level 1');
const levelTwo={...resources.snapshot(),schemaVersion:7,upgrades:{oxygenTank:2}},normalizedTwo=normalizeDockResourceEnvelope(levelTwo);assert.equal(normalizedTwo.state.upgrades.oxygenTank,2,'legacy 72 save must remain level 2');
const inferred48={...levelOne,upgrades:{},tanks:{...levelOne.tanks,oxidizer:{molecule:'oxygen',amount:48,capacity:48}}};assert.equal(inferLegacyOxygenUpgradeLevel(inferred48),1);assert.equal(normalizeDockResourceEnvelope(inferred48).state.upgrades.oxygenTank,1);
const inferred72={...levelTwo,upgrades:{},tanks:{...levelTwo.tanks,oxidizer:{molecule:'oxygen',amount:60,capacity:72}}};assert.equal(inferLegacyOxygenUpgradeLevel(inferred72),2);assert.equal(normalizeDockResourceEnvelope(inferred72).state.upgrades.oxygenTank,2);
const corrupt={...resources.snapshot(),upgrades:{oxygenTank:3}};assert.equal(normalizeDockResourceEnvelope(corrupt).changed,false,'invalid explicit upgrade state remains protected instead of silently rewritten');

const migratedStore=memory();migratedStore.setItem(RESOURCE_KEY,normalizedTwo.serialized);const reloaded=createResources({storage:migratedStore});reloaded.setCatalog(records);assert.equal(reloaded.blocked,false);assert.equal(reloaded.state.upgrades.oxygenTank,2);assert.equal(reloaded.tankStatus('oxidizer','oxygen').capacity,72);
console.log('DOCK foundation state regression passed: explicit unlock/action, 36→48→72 ordering, persistence authority and legacy preservation.');
