from pathlib import Path
p=Path('tests/encyclopedia-chemistry-visual-browser.test.mjs')
s=p.read_text()
old='node.querySelectorAll(`[data-resonance-contributor="${c}"][data-resonance-branch="${branch}"]`).length'
new='node.querySelectorAll(\'[data-resonance-contributor="\'+c+\'"][data-resonance-branch="\'+branch+\'"]\').length'
if old not in s:
    raise SystemExit('selector anchor missing')
p.write_text(s.replace(old,new))
