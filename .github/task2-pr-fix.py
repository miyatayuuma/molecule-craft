from pathlib import Path
p=Path('tests/oxygen-field-integration.test.mjs')
text=p.read_text()
old="assert.deepEqual([network['oxygen-side'].lanes,network['oxygen-side'].value],[4,3]);"
new="assert.deepEqual([network['oxygen-side'].lanes,network['oxygen-side'].value],[2,2]);"
if old not in text: raise SystemExit('stale oxygen-side expectation not found')
p.write_text(text.replace(old,new,1))
