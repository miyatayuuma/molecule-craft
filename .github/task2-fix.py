from pathlib import Path
p=Path('tests/h-economy-balance.test.mjs')
text=p.read_text()
old="    {name:'mid',H:410,O:190},"
new="    {name:'mid',H:540,O:250},"
if old not in text: raise SystemExit('Task 2 mid-stock test anchor missing')
p.write_text(text.replace(old,new,1))
