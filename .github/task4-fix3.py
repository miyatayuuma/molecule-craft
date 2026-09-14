from pathlib import Path

def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:160]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/oxygen-routes.js',
"    [-8870,1],[-9050,2],[-9150,4],[-9225,12],[-9300,32],[-9400,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],",
"    [-8870,1],[-9000,2],[-9075,12],[-9140,32],[-9200,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],")
replace('tests/oxygen-thermal-progression.test.mjs',
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9150,4],[-9225,12],[-9300,32],[-9400,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9150),y:-9150}).heat<=5,'Route C entry-to-ramp remains mild');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9300),y:-9300}).heat>=30,'Route C reaches meaningful heat early in the side route');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9450),y:-9450}).heat,48,'Route C reaches the sustained max-heat section well before the midpoint');",
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9000,2],[-9075,12],[-9140,32],[-9200,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-8950),y:-8950}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9050),y:-9050}).heat<12,'Route C gives a short visible ramp before sustained heat');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9150),y:-9150}).heat>=30,'Route C reaches meaningful heat near the start of the side branch');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9250),y:-9250}).heat,48,'Route C reaches the sustained max-heat section early');")
print('Task 4 plateau moved to y=-9200')
