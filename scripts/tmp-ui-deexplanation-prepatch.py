from pathlib import Path

path=Path('scripts/tmp-ui-deexplanation-patch.py')
lines=path.read_text().splitlines()
replacements={
    "'pending test copy')": r'''text = sub_once(text, r"assert\.match\(pendingSource,/`未作成の設計図 .*?navigation button'\);", "assert.match(pendingSource,/`設計図 \\\\${ids\\\\.length}件`/,'accessible pending count remains concise on the navigation button');\\nassert.doesNotMatch(pendingSource,/未作成の設計図|探索で見つけた、まだ作っていない分子/,'pending blueprints must not explain their state with visible prose');", 'pending test copy')''',
    "'shortage source contract')": r'''text = sub_once(text, r"  assert\.match\(source,/搭載できません/\);.*?percentage-only'\);", "  assert.doesNotMatch(source,/搭載できません|足りません/,'visible shortage state must not use explanatory prose');assert.match(source,/dataset\\\\.launchShortage/);assert.match(source,/item\\\\.actual} \\/ \\\\${item\\\\.requested/,'tank quantity is presented as actual / requested');assert.match(source,/item\\\\.have} \\/ \\\\${item\\\\.need/,'element shortage is presented directly as have / need');", 'shortage source contract')''',
}
found=set()
for index,line in enumerate(lines):
    for marker,replacement in replacements.items():
        if marker in line:
            lines[index]=replacement
            found.add(marker)
            break
missing=set(replacements)-found
if missing:
    raise SystemExit(f'patch lines not found: {sorted(missing)}')
path.write_text('\n'.join(lines)+'\n')
