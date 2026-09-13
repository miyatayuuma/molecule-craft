from pathlib import Path

path=Path('scripts/tmp-ui-deexplanation-patch.py')
lines=path.read_text().splitlines()
replacement = r'''text = sub_once(text, r"assert\.match\(pendingSource,/`未作成の設計図 .*?navigation button'\);", "assert.match(pendingSource,/`設計図 \\\\${ids\\\\.length}件`/,'accessible pending count remains concise on the navigation button');\\nassert.doesNotMatch(pendingSource,/未作成の設計図|探索で見つけた、まだ作っていない分子/,'pending blueprints must not explain their state with visible prose');", 'pending test copy')'''
found=False
for index,line in enumerate(lines):
    if "'pending test copy')" in line:
        lines[index]=replacement
        found=True
        break
if not found:
    raise SystemExit('pending test patch line not found')
path.write_text('\n'.join(lines)+'\n')
