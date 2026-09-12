import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const [ui,growth,gameShell,loadoutPreview,veilCss,index]=await Promise.all([
  readFile(new URL('src/veil/ui.js',root),'utf8'),
  readFile(new URL('src/veil/growth.js',root),'utf8'),
  readFile(new URL('src/game-shell.js',root),'utf8'),
  readFile(new URL('src/veil/loadout-preview.js',root),'utf8'),
  readFile(new URL('veil.css',root),'utf8'),
  readFile(new URL('index.html',root),'utf8'),
]);

assert.match(loadoutPreview,/charges\.append\(chargeRow\(candidate\.fullShots\)\)/,'LOADOUT PULSE renders canonical maximum capability');
assert.doesNotMatch(loadoutPreview,/ghost|current\.shots/,'LOADOUT PULSE has no fill-dependent ghost dots');

assert.match(growth,/export function propulsionSpeedMax\(config=GROWTH\.flight\)/);
assert.match(growth,/Object\.values\(DRIVES\).*boostSpeed/,'Speed scale follows configured propulsion drives');
assert.match(ui,/speed=Math\.max\(0,run\.player\.speed\)/,'FIELD HUD reads canonical run.player.speed');
assert.match(ui,/speedMax=propulsionSpeedMax\(run\.config\)/,'FIELD HUD scale is configuration-derived');
assert.match(ui,/speedMeter\.id='veil-speed-meter'/);
assert.match(ui,/speedMeter\.setAttribute\('role','meter'\)/);
assert.match(ui,/aria-valuemax/);assert.match(ui,/aria-valuenow/);
assert.match(ui,/q\('veil-heat'\)\.textContent='SPEED'/,'Primary quantitative bar is explicitly labeled SPEED');
assert.match(ui,/thermalIndicators=\{normal:'',cooling:'❄ COOLING',hot:'♨ HOT',overheat:'♨ OVERHEAT'\}/,'Thermal states include non-color indicators');
assert.match(ui,/thermal\.dataset\.state=thermalState/);
assert.match(ui,/thermalState==='cooling'.*thermalState==='hot'/,'Cooling and hot states tint the HUD box background');
assert.match(ui,/thermalNotice='❄ EMPTY'/,'Coolant depletion gets momentary in-HUD feedback from the existing event');
assert.match(ui,/event\.type==='coolantStart'/);assert.match(ui,/event\.type==='coolantEmpty'/);
assert.doesNotMatch(ui,/q\('veil-coolant-level'\)/,'Coolant amount is no longer a live primary HUD meter');
assert.match(gameShell,/#veil-coolant-level/,'Legacy coolant amount bar is pruned from FIELD chrome');
assert.doesNotMatch(gameShell,/#veil-thermal-state/,'Thermal state indicator remains visible');

assert.match(index,/id="veil-combustion-remaining">HOLD DRIVE<\/small>/,'DRIVE hold affordance remains in production DOM');
assert.match(index,/data-role="fuel"/);assert.match(index,/data-role="oxidizer"/);
assert.match(ui,/combustionButton\.addEventListener\('pointerdown',startCombustion\)/,'Pointer-hold DRIVE binding is unchanged');
assert.match(ui,/q\('veil-boost'\)\.addEventListener\('pointerdown'/,'BURST binding remains independent');

// No new layout footprint is introduced: the existing responsive drive column
// widths remain the bounding geometry, while one coolant meter is removed.
assert.match(veilCss,/@media\(max-width:370px\)\{\.veil-thermal\{width:110px/);
assert.match(veilCss,/@media\(max-height:500px\)\{\.veil-thermal\{width:90px/);
assert.match(veilCss,/@media\(max-width:370px\).*#veil-combustion\{width:110px/);

console.log('Propulsion HUD source contract passed: max PULSE dots, canonical speed meter, thermal states, coolant feedback, DRIVE/BURST bindings, and responsive bounds.');
