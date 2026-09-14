from pathlib import Path


def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:140]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/oxygen-routes.js',
"    gates:[{y:-9700,depth:94,pressure:600}],pressure:0,lanes:1,value:2},",
"    gates:[{y:-9400,depth:72,pressure:600},{y:-10000,depth:72,pressure:600}],pressure:0,lanes:1,value:2},")

replace('scripts/simulate-oxygen-routes.mjs',
"    knots=[...route.knots.slice(0,2),[-300,-9020],[-470,-9120],[-470,-9390],[-300,-9530],...route.knots.slice(2)];",
"    knots=[...route.knots.slice(0,2),[-300,-9020],[-470,-9120],[-470,-10090],[-300,-10170],...route.knots.slice(2)];")
replace('scripts/simulate-oxygen-routes.mjs',
"    // Leave the strong gate's width, cross the surrounding 370 current, rejoin.",
"    // Leave both localized gate widths, cross the surrounding 370 current, then rejoin after gate 2.")

replace('tests/field-map-export.test.mjs',
"  assert.deepEqual(burst.gates,[{y:-9700,depth:94,pressure:600}]);\n  assert.equal(burst.pressure,0);\n  assert.equal(oxygenPressureAt({x:-320,y:-9400}),0,'BURST route outside the chokepoint stays quiet');\n  assert.equal(oxygenPressureAt({x:-320,y:-9700}),600,'BURST chokepoint keeps the existing strong pressure');\n  assert.equal(oxygenPressureAt({x:-320,y:-9650}),0,'BURST gate remains localized');",
"  assert.deepEqual(burst.gates,[{y:-9400,depth:72,pressure:600},{y:-10000,depth:72,pressure:600}]);\n  assert.equal(burst.pressure,0);\n  assert.equal(oxygenPressureAt({x:-320,y:-9300}),0,'BURST route before gate 1 stays quiet');\n  assert.equal(oxygenPressureAt({x:-320,y:-9400}),600,'gate 1 keeps the strong localized pressure');\n  assert.equal(oxygenPressureAt({x:-320,y:-9700}),0,'pulse/shear corridor between gates has no route pressure');\n  assert.equal(oxygenPressureAt({x:-320,y:-10000}),600,'gate 2 keeps the strong localized pressure');\n  assert.equal(oxygenPressureAt({x:-320,y:-10100}),0,'BURST route after gate 2 returns to quiet');")

replace('tests/field-map-export.test.mjs',
"  const shortcutNormal=traverse({x:-530,y:-9600,targetY:-9800,maxSeconds:6}),shortcutBurst=traverse({x:-320,y:-9600,targetY:-9800,burst:true,maxSeconds:4});\n  assert.ok(Number.isFinite(shortcutNormal),'normal thrust must cross the localized BURST chokepoint');\n  assert.ok(shortcutBurst<shortcutNormal*.7,`BURST must materially ease the chokepoint (${shortcutBurst.toFixed(2)}s vs ${shortcutNormal.toFixed(2)}s)`);",
"  const shortcutNormal=traverse({x:-530,y:-9320,targetY:-9500,maxSeconds:6}),shortcutBurst=traverse({x:-320,y:-9320,targetY:-9500,burst:true,maxSeconds:4});\n  assert.ok(Number.isFinite(shortcutNormal),'normal thrust must retain a skill bypass around gate 1');\n  assert.ok(shortcutBurst<shortcutNormal*.7,`BURST must materially ease direct gate 1 traversal (${shortcutBurst.toFixed(2)}s vs ${shortcutNormal.toFixed(2)}s)`);")

replace('tests/field-map-export.test.mjs',
"  assert.match(svg,/data-pressure-gate=\"oxygen-shortcut:0\" data-pressure=\"600\" x=\"-435\" y=\"-9747\" width=\"230\" height=\"94\"/);",
"  assert.match(svg,/data-pressure-gate=\"oxygen-shortcut:0\" data-pressure=\"600\" x=\"-435\" y=\"-9436\" width=\"230\" height=\"72\"/);\n  assert.match(svg,/data-pressure-gate=\"oxygen-shortcut:1\" data-pressure=\"600\" x=\"-435\" y=\"-10036\" width=\"230\" height=\"72\"/);")

replace('tests/oxygen-field-integration.test.mjs',
"const gate=environmentAt({x:-320,y:-9700},.6);\nassert.equal(gate.traversableRoutePressure,600,'route-owned pressure stays in the traversable current channel');\nassert.equal(gate.pressure,600,'pulse overlay must not weaken or add to the 600 pressure gate');\nconst pulseOnly=environmentAt({x:-320,y:-9500},.6);\nassert.ok(pulseOnly.pressure>0&&pulseOnly.pressure<=410,'pulse periphery retains dynamic challenge pressure');",
"for(const y of [-9400,-10000]){\n  const gate=environmentAt({x:-320,y},.6);\n  assert.equal(gate.traversableRoutePressure,600,`route-owned pressure stays localized at ${y}`);\n  assert.equal(gate.pressure,600,'challenge overlays must not add to a 600 pressure band');\n}\nconst pulseOnly=environmentAt({x:-320,y:-9700},.6);\nassert.equal(pulseOnly.traversableRoutePressure,0,'the pulse/shear center is a pressure-free corridor between gate bands');\nassert.ok(pulseOnly.pressure>0&&pulseOnly.pressure<=410,'the existing pulse challenge remains readable without route-pressure stacking');")

Path('tests/oxygen-routes.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';
import {BURST_ADVANTAGE_FIELDS} from '../src/veil/universe.js';
import {EXPEDITION_CHALLENGES} from '../src/veil/expedition-challenges.js';
import {OXYGEN_ROUTES,oxygenPressureAt} from '../src/veil/oxygen-routes.js';

const routes=Object.fromEntries(OXYGEN_ROUTES.map(route=>[route.id,route]));
const shortcut=routes['oxygen-shortcut'];
const noPredators={predators:false,start:'junction',maxSeconds:45};

test('shortcut is a two-stage localized 600-pressure corridor around the existing pulse/shear field',()=>{
  assert.deepEqual(shortcut.knots,[[120,-8700],[-320,-9000],[-320,-10350],[120,-10670]]);
  assert.equal(shortcut.width,230);
  assert.deepEqual(shortcut.gates,[{y:-9400,depth:72,pressure:600},{y:-10000,depth:72,pressure:600}]);
  assert.equal(shortcut.pressure,0);
  assert.equal(oxygenPressureAt({x:-320,y:-9400}),600);
  assert.equal(oxygenPressureAt({x:-320,y:-10000}),600);
  assert.equal(oxygenPressureAt({x:-320,y:-9700}),0,'route pressure clears around the existing pulse/shear center');
  assert.equal(oxygenPressureAt({x:-320,y:-9300}),0);
  assert.equal(oxygenPressureAt({x:-320,y:-10100}),0);
  const shear=BURST_ADVANTAGE_FIELDS.find(field=>field.id==='oxygen-shortcut-shear');
  const pulse=EXPEDITION_CHALLENGES.find(challenge=>challenge.id==='pulse');
  assert.deepEqual({x:shear.x,y:shear.y,radius:shear.radius},{x:-320,y:-9700,radius:105});
  assert.deepEqual({top:pulse.top,bottom:pulse.bottom,centerY:pulse.centerY},{top:-9850,bottom:-9450,centerY:-9650});
  for(const gate of shortcut.gates)assert.ok(Math.abs(gate.y-shear.y)>gate.depth/2+shear.radius,'pressure band must not stack on the compact shear field');
  assert.ok(shortcut.gates[0].y>pulse.bottom&&shortcut.gates[1].y<pulse.top,'pulse challenge remains between the two gate centers');
});

test('normal and DRIVE retain bypass traversal while direct H2 BURST is the shortcut-optimal line',()=>{
  const normal=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:null,drive:false,detour:true,...noPredators});
  const drive=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:null,drive:true,detour:true,...noPredators});
  const burst=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',drive:false,...noPredators});
  console.log('Task3 shortcut modes',JSON.stringify({normal,drive,burst},null,2));
  assert.equal(normal.reached,true,'normal propulsion keeps a skill bypass around both pressure bands');
  assert.equal(drive.reached,true,'DRIVE-only traversal remains possible without making DRIVE a gate requirement');
  assert.equal(burst.reached,true,'H2 direct shortcut traversal succeeds');
  assert.equal(burst.burstUses,2,'the direct corridor consumes one H2 BURST per localized gate');
  assert.deepEqual(burst.currentCrossings,['oxygen-shortcut:0','oxygen-shortcut:1']);
  assert.ok(burst.arrivalSeconds<drive.arrivalSeconds,'direct BURST remains the shortcut-oriented solution over DRIVE bypass');
  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds,'direct BURST remains materially quicker than the normal skill bypass');
  assert.equal(shortcut.requiredCapability,undefined);
  assert.equal(shortcut.requires,undefined);
});

test('one BURST does not trivialize both bands and no successful canonical run needs three BURSTs',()=>{
  const canonical=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',...noPredators});
  assert.equal(canonical.burstUses,2);
  const oneBurst=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',burstTimes:[canonical.actualBurstTimes[0]],...noPredators});
  console.log('Task3 one-burst control',JSON.stringify(oneBurst,null,2));
  assert.ok(!oneBurst.reached||oneBurst.arrivalSeconds>canonical.arrivalSeconds*1.25,'one BURST must not erase the two-stage terrain');
  assert.ok(canonical.burstUses<=2,'canonical shortcut must never require a third BURST');
});

test('two-BURST shortcut traversal is stable at 30/60fps and multiple seeds',()=>{
  for(const seed of [1,71,2026])for(const fps of [30,60]){
    const report=simulateOxygenRoute({routeId:'oxygen-shortcut',propellant:'hydrogen',seed,fps,...noPredators});
    assert.equal(report.reached,true,`seed ${seed} @ ${fps}fps reaches merge`);
    assert.equal(report.burstUses,2,`seed ${seed} @ ${fps}fps uses exactly two BURSTs`);
    assert.equal(report.currentCrossings.length,2,`seed ${seed} @ ${fps}fps crosses both pressure bands`);
    assert.equal(report.overheatEvents,0);
  }
});

test('main and side route identities are untouched by the shortcut gate split',()=>{
  assert.deepEqual(routes['oxygen-main'].knots,[[120,-8700],[300,-9100],[350,-9600],[260,-10150],[120,-10670]]);
  assert.deepEqual([routes['oxygen-main'].pressure,routes['oxygen-main'].lanes,routes['oxygen-main'].value],[370,2,2]);
  assert.deepEqual(routes['oxygen-main'].restStops,[{x:300,y:-9750,depth:180}]);
  assert.deepEqual(routes['oxygen-side'].knots,[[120,-8700],[780,-9000],[850,-10350],[120,-10670]]);
  assert.deepEqual([routes['oxygen-side'].pressure,routes['oxygen-side'].lanes,routes['oxygen-side'].value],[0,2,2]);
  assert.deepEqual(routes['oxygen-side'].gates,[]);
});
''')

print('Task 3 transforms applied')
