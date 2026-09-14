from pathlib import Path

def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:160]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/oxygen-routes.js',
"    [-8870,1],[-9050,2],[-9200,4],[-9500,12],[-9700,32],[-9800,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],",
"    [-8870,1],[-9050,2],[-9200,4],[-9400,12],[-9525,32],[-9650,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],")

replace('tests/oxygen-thermal-progression.test.mjs',
"import {OXYGEN_ROUTES,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';",
"import {OXYGEN_ROUTES,OXYGEN_THERMAL,oxygenRouteCenterAtY} from '../src/veil/oxygen-routes.js';")
replace('tests/oxygen-thermal-progression.test.mjs',
"assert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9500),y:-9500}).heat<20,'Route C warm section rises gradually');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-10050),y:-10050}).heat>=35,'Route C learning section is high thermal');",
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9200,4],[-9400,12],[-9525,32],[-9650,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9300),y:-9300}).heat<12,'Route C still ramps before the sustained hot section');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9500),y:-9500}).heat>=20,'Route C reaches meaningful heat earlier than the old profile');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9700),y:-9700}).heat,48,'Route C reaches the sustained max-heat section before the midpoint');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-10050),y:-10050}).heat>=35,'Route C learning section remains high thermal');")

old="""// Scenario A: fastest clean centerline DRIVE learns HOT late in Route C, once,
// with meaningful reaction time before any overheat. Keep a modest spatial
// tolerance because the event is emitted by integrated ship motion, not a gate.
const cDry=simulateRoute('oxygen-side',{combustion:true});
assert.ok(cDry.frontHalfMaxHeat<THERMAL.hotThreshold,'Route C front half must remain below HOT');
assert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');
assert.equal(cDry.strain[0].combustion,true,'thermal strain crossing happens with COMBUSTION active');
assert.ok(cDry.strain[0].y<=-10180&&cDry.strain[0].y>=-10480,`thermal strain should occur near the HOT-learning/deep boundary, got y=${cDry.strain[0].y}`);
assert.ok(cDry.strain[0].heat<THERMAL.hotThreshold+4,'HOT crossing must not jump straight toward overheat');
assert.ok(!cDry.overheats.length||cDry.overheats[0].time-cDry.strain[0].time>.75,'thermal strain must leave reaction time before overheat');
assert.ok(cDry.run.player.y<-10600,'no-coolant Route C can still reach the network merge');
assert.ok(cDry.combustionPackets>0,'production methane/oxygen packets are consumed');

// Scenario B: the canonical eight-water starter engages the thermostat, spends
// coolant gradually and reaches the merge with a large, perceptible heat margin.
const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});
assert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');
assert.ok(cWet.coolantSpent>0&&cWet.coolantSpent<8,'eight water molecules must help without being exhausted before the merge');
assert.ok(cWet.run.heat<cDry.run.heat-25,`H2O should create a clear heat gap: dry=${cDry.run.heat}, wet=${cWet.run.heat}`);
assert.ok(cWet.run.heat<THERMAL.hotThreshold,'H2O x8 should keep the intended Route C traversal stable');
assert.equal(cWet.overheats.length,0,'H2O x8 should sustain DRIVE through Route C');
assert.ok(cWet.run.player.combustion,'COMBUSTION remains active at the merge with coolant');
"""
new="""// Scenario A: sustained dry DRIVE now reaches thermal strain and a real
// interruption before the merge. The route remains physically open because the
// held input coasts/cools and resumes after recovery instead of becoming a hard gate.
const cDry=simulateRoute('oxygen-side',{combustion:true});
assert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');
assert.equal(cDry.strain[0].combustion,true,'thermal strain crossing happens with COMBUSTION active');
assert.ok(cDry.strain[0].heat<THERMAL.hotThreshold+4,'HOT crossing must not jump straight toward overheat');
assert.ok(cDry.overheats.length>=1,'dry continuous DRIVE must be thermally interrupted before the merge');
assert.ok(cDry.overheats.every(event=>event.driveInterrupted),'dry Route C overheat is a DRIVE interruption');
assert.ok(cDry.overheats[0].time-cDry.strain[0].time>.75,'thermal strain must leave reaction time before overheat');
assert.ok(cDry.run.player.y<-10600,'coast/recovery/re-acceleration still reaches the network merge');
assert.ok(cDry.combustionPackets>0,'production methane/oxygen packets are consumed');

// Scenario B: the canonical eight-water starter engages the thermostat, spends
// coolant gradually and keeps held DRIVE continuous through the merge.
const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});
assert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');
assert.ok(cWet.coolantSpent>0&&cWet.coolantSpent<8,'eight water molecules must help without being exhausted before the merge');
assert.ok(cWet.maxHeat<THERMAL.overheatThreshold,'H2O x8 keeps Route C below overheat');
assert.equal(cWet.overheats.length,0,'H2O x8 should sustain DRIVE through Route C');
assert.ok(cWet.run.player.y<-10600,'cooled continuous DRIVE reaches the network merge');
assert.ok(cWet.run.player.combustion,'COMBUSTION remains active at the merge with coolant');
"""
replace('tests/oxygen-thermal-progression.test.mjs',old,new)

# Keep the handoff assertion but make it about interruption count/timing rather than
# assuming Task 3's old route-local heat was insufficient to overheat before merge.
replace('tests/oxygen-thermal-progression.test.mjs',
"// Continue the same held DRIVE into the recovery/deep handoff. The dry run must\n// lose sustained combustion first; the water starter buys materially more time.\nconst cDryDeep=simulateRoute('oxygen-side',{combustion:true,continueDeep:true});",
"// Continue the same held DRIVE into the recovery/deep handoff. The dry run has\n// already been interrupted on Route C; water must still postpone any later overheat.\nconst cDryDeep=simulateRoute('oxygen-side',{combustion:true,continueDeep:true});")

print('Task 4 transforms applied')
