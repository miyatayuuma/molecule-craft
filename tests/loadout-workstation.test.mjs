import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { LOADOUT_SLOT_GEOMETRY } from '../src/veil/loadout-workstation.js';

const DRIVE_USES=['fuel','oxidizer','coolant'];
const right=slot=>Number((slot.left+slot.width).toFixed(2));

test('LOADOUT DRIVE slots share one fixed boundary frame',()=>{
  const slots=DRIVE_USES.map(use=>LOADOUT_SLOT_GEOMETRY[use]);
  assert.equal(new Set(slots.map(slot=>slot.width)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.height)).size,1);
  assert.equal(new Set(slots.map(slot=>slot.top)).size,1);
  assert.equal(slots[0].width,10.0);
  assert.equal(slots[0].height,27);
  assert.equal(slots[0].top,38);
});

test('LOADOUT DRIVE boundaries use the tuned horizontal positions',()=>{
  const fuel=LOADOUT_SLOT_GEOMETRY.fuel;
  const oxidizer=LOADOUT_SLOT_GEOMETRY.oxidizer;
  const coolant=LOADOUT_SLOT_GEOMETRY.coolant;
  assert.deepEqual(
    [fuel.left,right(fuel),oxidizer.left,right(oxidizer),coolant.left,right(coolant)],
    [60.1,70.1,72.2,82.2,83.8,93.8],
  );
});

test('LOADOUT slot rectangles stay centered on their schematic anchors',()=>{
  for(const use of ['propellant','shock',...DRIVE_USES]){
    const slot=LOADOUT_SLOT_GEOMETRY[use];
    assert.equal(Number((slot.left+slot.width/2).toFixed(2)),slot.centerX);
    assert.equal(slot.labelX,slot.centerX);
  }
});

test('LOADOUT PULSE boundary is shifted right and down',()=>{
  const pulse=LOADOUT_SLOT_GEOMETRY.propellant;
  assert.deepEqual(
    {left:pulse.left,width:pulse.width,top:pulse.top,height:pulse.height},
    {left:10.6,width:10.9,top:38.5,height:27},
  );
});

test('LOADOUT BASE STOCK is read-only, shares the CRAFT atom primitive and owns a machine intake anchor',async()=>{
  const [source,progression,supply,transaction,shell]=await Promise.all([
    readFile(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8'),
    readFile(new URL('../src/element-progression.js',import.meta.url),'utf8'),
    readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8'),
    readFile(new URL('../src/veil/launch-transaction.js',import.meta.url),'utf8'),
    readFile(new URL('../src/game-shell.js',import.meta.url),'utf8'),
  ]);
  assert.match(source,/createElement\('div'\);token\.className='loadout-element-token'/,'LOADOUT stock uses non-interactive containers rather than buttons');
  assert.match(source,/atom\.className='atom-preview'/,'LOADOUT reuses the CRAFT atom visual primitive');
  assert.match(source,/token\.hidden=!unlocked/,'locked elements are not exposed while zero stock remains representable');
  assert.match(progression,/symbol:'N'.*color:'#3b82f6'/,'shared element presentation metadata owns atom colour');
  assert.match(source,/dataset\.launchIntakeAnchor='true'/,'machine visual owns an explicit synthesis intake anchor');
  assert.match(source,/canvasRect=canvas\?\.getBoundingClientRect\(\)/,'intake anchor follows the visible collector-shell canvas translation');
  assert.match(source,/source\?\.getBoundingClientRect\(\)/,'transfer starts from the rendered element atom');
  assert.match(source,/targetRect\.left\+targetRect\.width\/2/,'transfer ends at the rendered intake anchor');
  assert.match(supply,/cost:supply\?\.plan\?\.cost/,'presentation consumes the committed supply plan rather than a pre-transaction preview');
  assert.match(supply,/syncLoadoutElementStock\(resources,document\)/,'LOADOUT stock reads authoritative resource state');
  assert.match(transaction,/await presentSupply\(supply\)/,'presentation occurs only after supply staging succeeds');
  assert.match(shell,/preserveShellClose/,'machine remains visible through the committed transfer presentation');
  assert.doesNotMatch(supply,/24\+\(index%4\)\*18|rect\.width\*\(\.52/,'legacy pseudo-position synthesis animation is removed');
});

test('LOADOUT owns no direct Encyclopedia navigation affordance or relay',async()=>{
  const [html,supply]=await Promise.all([
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../src/veil/supply.js',import.meta.url),'utf8'),
  ]);
  const loadout=html.match(/<dialog id="supply-dialog"[\s\S]*?<\/dialog>/)?.[0]??'';
  assert.ok(loadout,'LOADOUT dialog remains present');
  assert.doesNotMatch(loadout,/id="tank-open-collection"/);
  assert.doesNotMatch(loadout,/id="oxygen-co2-hint"/);
  assert.doesNotMatch(loadout,/>図鑑<|図鑑で見る/);
  assert.match(loadout,/<div class="tank-model-caption"><span id="tank-model-name"><\/span><\/div>/,'model caption remains without an empty action slot');
  assert.match(loadout,/<div id="oxygen-route-chart"><\/div><div id="oxygen-route-notes"><\/div><\/details>/,'route guide remains complete without an orphan action slot');
  assert.doesNotMatch(supply,/molecule-craft:open-molecule|openCollection|tank-open-collection|oxygen-co2-hint/);
});
