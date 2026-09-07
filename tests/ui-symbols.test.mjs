import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [supply,craftPanel]=await Promise.all([
  readFile(new URL('src/veil/supply.js',root),'utf8'),
  readFile(new URL('src/craft-panel.js',root),'utf8'),
]);

assert.match(supply,/if\(use!=='propellant'\)return 0/,'Only the burst/propellant tank may expose discrete tick marks');
assert.match(supply,/Math\.floor\(performance\.capacity\/performance\.moleculesPerBurst\)/,'Propellant tick count must follow full-tank burst count');
assert.match(supply,/styleTankMeter\(q\('veil-coolant-level'\),'coolant',null\)/,'Coolant tank must be normalized to a continuous bar');
assert.match(supply,/combustionLink\.textContent='🔥'/,'Combustion link should use a flame instead of the heat/bath symbol');
assert.match(supply,/clipPath=`inset\(0 \$\{\(1-value\)\*100\}% 0 0\)`/,'Segment positions must stay fixed while the propellant level falls');
assert.match(craftPanel,/idea=!discovered/,'Undiscovered craft targets should be treated as ideas');
assert.match(craftPanel,/idea=!!target&&!targetDiscovered/,'The craft summary should carry the idea state until discovery');
assert.match(craftPanel,/💡/,'Idea state must be visible without tutorial copy');

console.log('UI symbol contracts passed: flame combustion cue, burst-count ticks, continuous other tanks, and idea bulbs.');
