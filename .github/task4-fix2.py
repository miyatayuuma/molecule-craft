from pathlib import Path

def replace(path, old, new):
    p=Path(path); text=p.read_text()
    if old not in text: raise SystemExit(f'missing anchor in {path}: {old[:160]!r}')
    p.write_text(text.replace(old,new,1))

replace('src/veil/oxygen-routes.js',
"    [-8870,1],[-9050,2],[-9200,4],[-9300,12],[-9425,32],[-9550,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],",
"    [-8870,1],[-9050,2],[-9150,4],[-9225,12],[-9300,32],[-9400,48],\n    [-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0],")

replace('tests/oxygen-thermal-progression.test.mjs',
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9200,4],[-9300,12],[-9425,32],[-9550,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9200),y:-9200}).heat<=5,'Route C entry-to-ramp remains mild');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9400),y:-9400}).heat>=20,'Route C reaches meaningful heat earlier than the old profile');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9600),y:-9600}).heat,48,'Route C reaches the sustained max-heat section before the midpoint');",
"assert.deepEqual(OXYGEN_THERMAL.heatStops.map(stop=>[stop.y,stop.value]),[[-8870,1],[-9050,2],[-9150,4],[-9225,12],[-9300,32],[-9400,48],[-10480,48],[-10510,32],[-10540,8],[-10560,0],[-10670,0]]);\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9000),y:-9000}).heat<5,'Route C entry stays cool/slightly warm');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9150),y:-9150}).heat<=5,'Route C entry-to-ramp remains mild');\nassert.ok(environmentAt({x:oxygenRouteCenterAtY(routeC,-9300),y:-9300}).heat>=30,'Route C reaches meaningful heat early in the side route');\nassert.equal(environmentAt({x:oxygenRouteCenterAtY(routeC,-9450),y:-9450}).heat,48,'Route C reaches the sustained max-heat section well before the midpoint');")

print('Task 4 plateau moved to y=-9400')
