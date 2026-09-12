import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadoutCandidateCards} from '../src/veil/supply.js';

const candidates=Object.freeze([
  Object.freeze({id:'hydrogen'}),
  Object.freeze({id:'methane'}),
  Object.freeze({id:'oxygen'}),
]);
const ids=view=>view.map(item=>item.record.id);
const selectedIds=view=>view.filter(item=>item.selected).map(item=>item.record.id);

test('LOADOUT candidate order is independent from selection and loaded state',()=>{
  const baseline=loadoutCandidateCards(candidates);
  const methaneSelected=loadoutCandidateCards(candidates,{loadoutId:'methane',loadedId:'hydrogen'});
  const oxygenSelected=loadoutCandidateCards(candidates,{loadoutId:'oxygen',loadedId:'hydrogen'});

  assert.deepEqual(ids(baseline),['hydrogen','methane','oxygen']);
  assert.deepEqual(ids(methaneSelected),ids(baseline));
  assert.deepEqual(ids(oxygenSelected),ids(baseline));
  assert.deepEqual(selectedIds(baseline),[]);
  assert.deepEqual(selectedIds(methaneSelected),['methane']);
  assert.deepEqual(selectedIds(oxygenSelected),['oxygen']);
  assert.equal(methaneSelected.find(item=>item.record.id==='hydrogen').loaded,true);
  assert.deepEqual(candidates.map(item=>item.id),['hydrogen','methane','oxygen'],'candidate input remains canonical and unmodified');
});

test('LOADOUT card renderer preserves candidate DOM order and keeps focus separate from selection',()=>{
  const source=readFileSync(new URL('../src/veil/supply.js',import.meta.url),'utf8');
  const start=source.indexOf('function renderCandidates');
  const end=source.indexOf('function renderTankDetail',start);
  assert.notEqual(start,-1);
  assert.notEqual(end,-1);
  const render=source.slice(start,end);

  assert.doesNotMatch(render,/\.sort\s*\(/,'selection must not re-sort candidates');
  assert.match(render,/loadoutCandidateCards\(list,\{loadoutId,loadedId\}\)/,'renderer must consume the stable candidate view');
  assert.match(render,/setAttribute\('aria-pressed',String\(selected\)\)/,'selected state remains semantic and independent from order');
  assert.match(render,/state\.textContent=selected\?'選択中':loaded\?'残量あり':''/,'selected state remains visible without relying on color');
  assert.doesNotMatch(render,/\.focus\s*\(/,'rendering selection must not move keyboard focus');
});

test('LOADOUT responsive CSS does not visually re-order molecule cards',()=>{
  const css=readFileSync(new URL('../veil.css',import.meta.url),'utf8');
  const cardRules=[...css.matchAll(/[^{}]*\.tank-molecules[^{}]*\{([^{}]*)\}/g)].map(match=>match[1]).join('\n');
  assert.doesNotMatch(cardRules,/(?:^|;)\s*order\s*:/,'desktop/mobile card order must follow DOM order');
  assert.match(css,/\.tank-molecules button\[aria-pressed=true\]\{[^}]*border-color:[^}]*background:/,'selected cards keep the existing non-positional visual state');
});
