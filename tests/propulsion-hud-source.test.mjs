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
assert.match(ui,/output=Math\.max\(0,run\.player\.speed\)/,'FIELD OUTPUT reads the propulsion-side run.player.speed state, not final displacement');
assert.match(ui,/outputMax=propulsionSpeedMax\(run\.config\)/,'FIELD OUTPUT scale is configuration-derived');
assert.match(ui,/outputMeter\.id='veil-output-meter'/);
assert.match(ui,/outputMeter\.setAttribute\('role','meter'\)/);
assert.match(ui,/outputMeter\.setAttribute\('aria-label','推進出力'\)/);assert.match(ui,/outputMeter\.setAttribute\('aria-valuemax','100'\)/);assert.match(ui,/aria-valuenow/);
assert.match(ui,/q\('veil-heat'\)\.textContent='POWER'/,'Primary quantitative bar is explicitly labeled POWER');
assert.doesNotMatch(ui,/textContent='SPEED'|aria-label','現在速度'|veil-speed-meter/,'FIELD HUD must not present propulsion state as actual speed');
assert.match(ui,/heatRatio=Math\.max\(0,Math\.min\(1,run\.heat\/THERMAL\.overheatThreshold\)\)/,'Thermal presentation follows continuous canonical heat load');
assert.match(ui,/thermalHue=Math\.round\(190-185\*heatRatio\)/,'Thermal hue changes continuously with heat load');
assert.match(ui,/thermal\.style\.setProperty\('--thermal-hue',String\(thermalHue\)\)/);
assert.match(ui,/thermal\.style\.setProperty\('--thermal-intensity',heatRatio\.toFixed\(3\)\)/);
assert.match(ui,/thermalIndicators=\{normal:'',cooling:'❄ COOLING',hot:'♨ HOT',overheat:'♨ OVERHEAT'\}/,'Thermal states include non-color indicators');
assert.match(ui,/thermal\.dataset\.state=thermalState/);
assert.doesNotMatch(ui,/thermal\.style\.background=thermalState/,'Thermal panel color must not jump between discrete state backgrounds');
assert.match(veilCss,/\.veil-thermal\{--thermal-hue:190;--thermal-intensity:0/,'Thermal panel exposes continuous hue and intensity channels');
assert.match(veilCss,/\.veil-thermal:after\{[^}]*scaleX\(var\(--thermal-intensity\)\)/,'Thermal edge fill grows continuously with heat');
assert.match(veilCss,/\.veil-thermal>i span\{[^}]*background:#6ec7d1/,'OUTPUT bar keeps its own fixed propulsion color');
assert.doesNotMatch(veilCss,/\.veil-thermal\[data-state=(?:cooling|hot)\]>i span/,'Thermal states must not recolor the OUTPUT bar');
assert.match(ui,/thermalState==='overheat'\?thermalIndicators\.overheat/,'Overheat warning takes precedence over transient coolant notices');
assert.match(ui,/thermalNotice='❄ EMPTY'/,'Coolant depletion gets momentary in-HUD feedback from the existing event');
assert.match(ui,/event\.type==='coolantStart'/);assert.match(ui,/event\.type==='coolantEmpty'/);
assert.doesNotMatch(ui,/q\('veil-coolant-level'\)/,'Coolant amount is no longer a live primary HUD meter');
assert.match(gameShell,/#veil-coolant-level/,'Legacy coolant amount bar is pruned from FIELD chrome');
assert.doesNotMatch(gameShell,/#veil-thermal-state/,'Thermal state indicator remains visible');

assert.match(index,/id="veil-combustion-remaining" class="veil-drive-seconds">0秒<\/strong>/,'DRIVE seconds remain legible in the production DOM');
assert.match(index,/id="veil-fuel-model"/);assert.match(index,/id="veil-oxygen-model"/);
assert.match(index,/id="veil-shock-model"/);assert.match(index,/id="veil-burst-model"/);
assert.doesNotMatch(index,/HOLD DRIVE|paired-tanks/,'Action controls no longer display redundant labels or tank widgets');
assert.match(ui,/hudMolecule\(q\('veil-fuel-model'\),fuel\.molecule\)/,'FIELD uses the loaded fuel molecule thumbnail');
assert.match(ui,/hudMolecule\(q\('veil-oxygen-model'\),oxidizer\.molecule\)/,'FIELD shows oxygen as a smaller co-reactant');
assert.match(ui,/chargeArc\(boostButton,burstGauge\.remaining,burstGauge\.capacity\)/,'BURST count and arc use the same authoritative gauge');
assert.match(ui,/Math\.ceil\(Math\.max\(0,combustionGauge\.seconds\)\)/,'DRIVE seconds derive from the limiting-reagent burn plan');
assert.match(ui,/combustionButton\.setAttribute\('aria-disabled',String\(!combustion\|\|run\.overheated/,'Overheat still disables DRIVE');
assert.match(ui,/combustionButton\.addEventListener\('pointerdown',startCombustion\)/,'Pointer-hold DRIVE binding is unchanged');
assert.match(ui,/q\('veil-boost'\)\.addEventListener\('pointerdown'/,'BURST binding remains independent');
assert.match(ui,/q\('veil-resume'\).*root\.focus\(\)/,'Existing FIELD resume focus contract remains intact');
assert.doesNotMatch(gameShell,/#veil-combustion-remaining/,'DRIVE remaining time is not pruned as generic chrome');

// No new layout footprint is introduced: the existing responsive drive column
// widths remain the bounding geometry, while one coolant meter is removed.
assert.match(veilCss,/@media\(max-width:370px\)\{\.veil-thermal\{width:110px/);
assert.match(veilCss,/@media\(max-height:500px\)\{\.veil-thermal\{width:90px/);
assert.match(veilCss,/\.veil-drive-control #veil-combustion\{width:86px/);

console.log('Propulsion HUD source contract passed: molecule-based action controls, counts and seconds, POWER/thermal states, pointer bindings, and responsive bounds.');
