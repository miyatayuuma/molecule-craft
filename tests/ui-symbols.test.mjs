import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [supply,craftPanel,renderer]=await Promise.all([
  readFile(new URL('src/veil/supply.js',root),'utf8'),
  readFile(new URL('src/craft-panel.js',root),'utf8'),
  readFile(new URL('src/veil/renderer.js',root),'utf8'),
]);

// Keep these cues semantic: one flame for combustion, discrete ticks only where a tick means one BURST.
assert.match(supply,/if\(use!=='propellant'\)return 0/,'Only the burst/propellant tank may expose discrete tick marks');
assert.match(supply,/Math\.floor\(performance\.capacity\/performance\.moleculesPerBurst\)/,'Propellant tick count must follow full-tank burst count');
assert.match(supply,/styleTankMeter\(q\('veil-coolant-level'\),'coolant',null\)/,'Coolant tank must be normalized to a continuous bar');
assert.match(supply,/combustionLink\.textContent='🔥'/,'Combustion link should use a flame instead of the heat/bath symbol');
assert.match(supply,/clipPath=`inset\(0 \$\{\(1-value\)\*100\}% 0 0\)`/,'Segment positions must stay fixed while the propellant level falls');
assert.match(craftPanel,/idea=!discovered/,'Undiscovered craft targets should be treated as ideas');
assert.match(craftPanel,/idea=!!target&&!targetDiscovered/,'The craft summary should carry the idea state until discovery');
assert.match(craftPanel,/💡/,'Idea state must be visible without tutorial copy');
assert.match(renderer,/Signals read as emission/,'FIELD signals use emitted wavefront behavior');
assert.match(renderer,/Reward convergence is shown as oxygen-colored motes/,'FIELD reward uses converging resource behavior');
assert.doesNotMatch(renderer,/run\.time\*\.4\+i\*Math\.PI\*2\/3/,'FIELD signals must not render an unexplained triangle glyph');
assert.doesNotMatch(renderer,/OXYGEN_REWARD\.radius\+15/,'FIELD reward must not render as an unexplained ring marker');

console.log('UI symbol contracts passed: semantic propulsion/idea cues plus behavioral FIELD signal and reward signifiers.');
