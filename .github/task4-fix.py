from pathlib import Path

def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:160]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/oxygen-routes.js',
"    [-8870,1],[-9050,2],[-9200,4],[-9400,12],[-9525,32],[-9650,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],",
"    [-8870,1],[-9050,2],[-9200,4],[-9300,12],[-9425,32],[-9550,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],")

replace('tests/oxygen-thermal-progression.test.mjs',
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9200,4],[-9400,12],[-9525,32],[-9650,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9300),y:-9300}).heat<12,'Route C still ramps before the sustained hot section');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9500),y:-9500}).heat>=20,'Route C reaches meaningful heat earlier than the old profile');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9700),y:-9700}).heat,48,'Route C reaches the sustained max-heat section before the midpoint');",
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9200,4],[-9300,12],[-9425,32],[-9550,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9200),y:-9200}).heat<=5,'Route C entry-to-ramp remains mild');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9400),y:-9400}).heat>=20,'Route C reaches meaningful heat earlier than the old profile');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9600),y:-9600}).heat,48,'Route C reaches the sustained max-heat section before the midpoint');")

replace('tests/oxygen-thermal-progression.test.mjs',
"const cDry=simulateRoute('oxygen-side',{combustion:true});\nassert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');",
"const cDry=simulateRoute('oxygen-side',{combustion:true});\nconsole.log('Task4 dry thermal metric',JSON.stringify({time:cDry.time,maxHeat:cDry.maxHeat,finalHeat:cDry.run.heat,strain:cDry.strain,overheats:cDry.overheats,packets:cDry.combustionPackets},null,2));\nassert.equal(cDry.strain.length,1,'Route C emits thermal strain exactly once');")
replace('tests/oxygen-thermal-progression.test.mjs',
"const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});\nassert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');",
"const cWet=simulateRoute('oxygen-side',{combustion:true,coolant:8});\nconsole.log('Task4 wet thermal metric',JSON.stringify({time:cWet.time,maxHeat:cWet.maxHeat,finalHeat:cWet.run.heat,coolantSpent:cWet.coolantSpent,coolantLeft:cWet.run.fuel.coolant.amount,overheats:cWet.overheats},null,2));\nassert.ok(cWet.coolantStarts.length>=1,'water thermostat should engage');")

print('Task 4 thermal plateau extended')
