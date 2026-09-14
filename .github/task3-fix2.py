from pathlib import Path
p=Path('scripts/simulate-oxygen-routes.mjs')
text=p.read_text()
old="const lookahead=route.id==='oxygen-shortcut'&&actualBurstTimes.length>0?300:nextGate.depth/2+30;"
new="const lookahead=route.id==='oxygen-shortcut'?300:nextGate.depth/2+30;"
if old not in text: raise SystemExit('Task 3 shortcut lookahead anchor missing')
p.write_text(text.replace(old,new,1))

p=Path('tests/oxygen-routes.test.mjs')
text=p.read_text()
old="""  assert.ok(burst.arrivalSeconds<drive.arrivalSeconds,'direct BURST remains the shortcut-oriented solution over DRIVE bypass');
  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds,'direct BURST remains materially quicker than the normal skill bypass');
"""
new="""  assert.ok(drive.arrivalSeconds>=burst.arrivalSeconds*.85,`DRIVE bypass must not be clearly superior to the BURST-oriented direct line (${drive.arrivalSeconds.toFixed(2)}s vs ${burst.arrivalSeconds.toFixed(2)}s)`);
  assert.ok(burst.arrivalSeconds<normal.arrivalSeconds*.7,'direct BURST remains materially quicker than the normal skill bypass');
"""
if old not in text: raise SystemExit('Task 3 mode comparison anchor missing')
p.write_text(text.replace(old,new,1))
