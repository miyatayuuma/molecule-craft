from pathlib import Path
p=Path('tests/oxygen-routes.test.mjs')
text=p.read_text()
text=text.replace("import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';\n", "import {simulateOxygenRoute} from '../scripts/simulate-oxygen-routes.mjs';\nimport {createFlight,moveFlight} from '../src/veil/engine.js';\nimport {DRIVES,flightConfig} from '../src/veil/growth.js';\nimport {environmentAt} from '../src/veil/universe.js';\n")
old="""  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds*.8,'direct BURST remains materially quicker than the normal skill bypass');
  assert.ok(drive.arrivalSeconds>=burst.arrivalSeconds*.8,`DRIVE-only must not become a clearly superior shortcut (${drive.arrivalSeconds.toFixed(2)}s vs ${burst.arrivalSeconds.toFixed(2)}s)`);
"""
new="""  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds*.8,'direct BURST remains materially quicker than the normal skill bypass');
"""
if old not in text: raise SystemExit('Task 3 total-duration assertion anchor missing')
text=text.replace(old,new,1)
marker="""test('one BURST does not trivialize both bands and the canonical shortcut never needs a third',()=>{
"""
insert=r'''test('localized gate traversal favors BURST over DRIVE without making DRIVE a hard failure',()=>{
  const cross=(gate,mode)=>{
    const config=flightConfig(),player=createFlight(config),dt=1/60,startY=gate.y+110,targetY=gate.y-110;
    Object.assign(player,{x:-320,y:startY,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});
    if(mode==='burst'){player.drive=DRIVES.hydrogen;player.boost=DRIVES.hydrogen.boostSeconds;}
    if(mode==='drive'){player.drive=DRIVES.combustion;player.combustion=true;}
    for(let frame=0;frame<8/dt;frame++){
      moveFlight(player,{x:0,y:-1},dt,{config,environment:environmentAt(player,frame*dt)});
      if(player.y<=targetY)return frame*dt;
    }
    return Infinity;
  };
  for(const gate of shortcut.gates){
    const burst=cross(gate,'burst'),drive=cross(gate,'drive');
    assert.ok(Number.isFinite(drive),'DRIVE-only remains physically able to cross each localized gate');
    assert.ok(Number.isFinite(burst),'BURST crosses each localized gate');
    assert.ok(burst<drive*.8,`BURST must beat DRIVE across the localized band (${burst.toFixed(2)}s vs ${drive.toFixed(2)}s at y=${gate.y})`);
  }
});

test('one BURST does not trivialize both bands and the canonical shortcut never needs a third',()=>{
'''
if marker not in text: raise SystemExit('Task 3 one-burst marker missing')
text=text.replace(marker,insert,1)
p.write_text(text)
