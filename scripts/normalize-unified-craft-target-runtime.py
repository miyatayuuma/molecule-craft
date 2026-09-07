from pathlib import Path
import re

ui = Path('src/veil/ui.js')
text = ui.read_text()

import_line = "import { renderCraftTargetAtoms } from '../craft-panel.js?v=3';"
if import_line not in text:
    anchor = "import { combustionPacketFor,performanceFor } from './molecule-roles.js';"
    if anchor not in text:
        raise SystemExit('molecule-role import anchor missing')
    text = text.replace(anchor, anchor + '\n' + import_line, 1)

state_old = "anchor='continue',anchorLock=null,returnState=null;"
state_new = "anchor='continue',anchorLock=null,returnState=null,pendingCraftId=null;"
if state_new not in text:
    if state_old not in text:
        raise SystemExit('veil runtime state anchor missing')
    text = text.replace(state_old, state_new, 1)

canonical = "    const pending=pendingCraftId;pendingCraftId=null;run=null;anchorLock=null;returnState=null;onCraft();updateCraft();q('launch-veil').focus();if(pending)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:pending,source:'field'}}));"
pattern = re.compile(r"(    q\('craft-last-run'\)\.textContent=[^\n]*\n)    [^\n]*\n  \}\n  function beginReturn")
match = pattern.search(text)
if not match:
    raise SystemExit('finish normalization anchor missing')
text = pattern.sub(lambda m: m.group(1) + canonical + "\n  }\n  function beginReturn", text, count=1)
ui.write_text(text)

test = Path('tests/unified-craft-target.test.mjs')
t = test.read_text()
anchor = "assert.match(panel,/export function renderCraftTargetAtoms/,'Atom previews must share one renderer');"
extra = """assert.match(veilUi,/import \\{ renderCraftTargetAtoms \\} from '\\.\\.\\/craft-panel\\.js\\?v=3'/,'Field UI must import the shared atom renderer');
assert.match(veilUi,/returnState=null,pendingCraftId=null/,'Field UI must declare pending target state');
assert.equal((veilUi.match(/const pending=pendingCraftId/g)??[]).length,1,'Return must carry the pending target exactly once');
assert.equal((veilUi.match(/source:'field'/g)??[]).length,1,'Field target dispatch must occur exactly once');"""
if "Return must carry the pending target exactly once" not in t:
    if anchor not in t:
        raise SystemExit('unified target test anchor missing')
    t = t.replace(anchor, anchor + '\n' + extra, 1)
test.write_text(t)
