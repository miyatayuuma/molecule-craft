from pathlib import Path

test=Path('tests/signal-eligibility.test.mjs')
s=test.read_text()
old="// FIELD constructs the exclusion set from both active analysis and carried\n// insights, and passes only that set into resources.signal().\n"
new="// FIELD constructs the exclusion set from both active analysis and carried\n// insights, and passes it together with current-run engagement context.\n"
if old not in s: raise SystemExit('signal contract comment anchor missing')
s=s.replace(old,new,1)
old="assert.match(uiSource,/resources\\.signal\\(event\\.region,event\\.roll,event\\.choice,\\{excludeIds\\}\\)/);"
new="assert.match(uiSource,/resources\\.signal\\(event\\.region,event\\.roll,event\\.choice,\\{excludeIds,runContext:run\\}\\)/);"
if old not in s: raise SystemExit('signal contract assertion anchor missing')
test.write_text(s.replace(old,new,1))
