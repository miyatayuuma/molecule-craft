import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCapabilityPresentationState,tankCapabilityIntroduced} from '../src/veil/capability-unlock.js';

{
  const state=createCapabilityPresentationState();
  assert.equal(state.attention,false);assert.equal(state.pendingCount,0);assert.equal(state.tankSelectionHintShown,false);
  assert.equal(state.queue({id:'hydrogen',use:'propellant'}),true);assert.equal(state.attention,true);assert.equal(state.pendingCount,1);
  assert.equal(state.queue({id:'hydrogen',use:'propellant'}),true);assert.equal(state.pendingCount,1,'Duplicate notification does not duplicate the unlock animation');
  const first=state.open();assert.deepEqual(first.unlocks,[{id:'hydrogen',use:'propellant'}]);assert.equal(first.showHint,true);assert.equal(state.attention,false);assert.equal(state.tankSelectionHintShown,true);
  state.queue({id:'methane',use:'fuel'});const second=state.open();assert.deepEqual(second.unlocks,[{id:'methane',use:'fuel'}]);assert.equal(second.showHint,false,'Tank selection tutorial is session-local and shown only for the first capability');
  assert.equal(state.queue({id:'methanol',use:'unknown'}),false);assert.equal(state.attention,false);
}

{
  const empty={selectedLoadout:()=>({propellant:null,fuel:null,oxidizer:null,coolant:null}),state:{recipes:[]}};
  assert.equal(tankCapabilityIntroduced(empty,'propellant'),false);
  const selected={selectedLoadout:()=>({propellant:'carbon-dioxide',fuel:null,oxidizer:null,coolant:null}),state:{recipes:[]}};
  assert.equal(tankCapabilityIntroduced(selected,'propellant'),true,'Any persistent selected molecule introduces the visual tank role');
  const recipe={selectedLoadout:empty.selectedLoadout,state:{recipes:['methane']}};
  assert.equal(tankCapabilityIntroduced(recipe,'fuel'),true,'A crafted canonical primary-role molecule introduces the visual tank role');
  assert.equal(tankCapabilityIntroduced(recipe,'propellant'),false);
}

{
  const source=await readFile(new URL('../src/veil/capability-unlock.js',import.meta.url),'utf8');
  assert.match(source,/prefers-reduced-motion: reduce/);assert.match(source,/if\(reduced\|\|typeof button\.animate!==['"]function['"]\)/,'Reduced motion keeps the state transition while skipping moving tank animation');
  assert.match(source,/setAttribute\(['"]role['"],['"]status['"]\)/,'Capability assignment has a one-shot polite status announcement');
  assert.doesNotMatch(source,/\.focus\(/,'Capability presentation never steals keyboard focus');
  assert.match(source,/タップして分子を変更/);
}

console.log('Capability unlock passed: access attention queue, one-shot tank activation/tutorial state, dormant semantics, reduced-motion branch and no focus stealing.');
