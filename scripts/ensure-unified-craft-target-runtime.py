from pathlib import Path

ui = Path('src/veil/ui.js')
text = ui.read_text()
import_line = "import { renderCraftTargetAtoms } from '../craft-panel.js?v=3';"
if import_line not in text:
    anchor = "import {combustionPacketFor,performanceFor} from './molecule-roles.js';"
    if anchor not in text:
        anchor = "import { combustionPacketFor,performanceFor } from './molecule-roles.js';"
    if anchor not in text:
        raise SystemExit('molecule-role import anchor missing')
    text = text.replace(anchor, anchor + '\n' + import_line, 1)
if 'pendingCraftId=null' not in text:
    anchor = 'anchorLock=null,returnState=null;'
    if anchor not in text:
        raise SystemExit('pending craft state anchor missing')
    text = text.replace(anchor, 'anchorLock=null,returnState=null,pendingCraftId=null;', 1)
ui.write_text(text)

test = Path('tests/unified-craft-target.test.mjs')
t = test.read_text()
marker = "assert.match(veilUi,/import \\{ renderCraftTargetAtoms \\} from '\\.\\.\\/craft-panel\\.js\\?v=3'/,'Field UI must import the shared target-atom renderer');"
if marker not in t:
    anchor = "assert.match(panel,/export function renderCraftTargetAtoms/,'Atom previews must share one renderer');"
    addition = anchor + "\n" + marker + "\nassert.match(veilUi,/pendingCraftId=null/,'Field UI must declare pending craft target state');"
    if anchor not in t:
        raise SystemExit('unified target test anchor missing')
    t = t.replace(anchor, addition, 1)
test.write_text(t)
