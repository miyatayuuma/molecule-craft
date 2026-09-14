from pathlib import Path
p=Path('scripts/task-encyclopedia-seamless-zoom.py')
text=p.read_text()
old="replace_between('src/collection-ui.js',start,end,body+end)"
new="replace_between('src/collection-ui.js',start,end,body)"
if text.count(old)!=1: raise SystemExit(f'expected one boundary call, found {text.count(old)}')
p.write_text(text.replace(old,new))
