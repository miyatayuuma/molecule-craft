from pathlib import Path
from textwrap import dedent
import re


def append_once(path, marker, block):
    p = Path(path)
    text = p.read_text()
    if marker not in text:
        p.write_text(text.rstrip() + "\n\n" + dedent(block).strip() + "\n")


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old in text:
        p.write_text(text.replace(old, new, 1))
        return
    if new in text:
        return
    raise SystemExit(f"replacement anchor missing: {path}: {old[:100]!r}")


# Replace the compact prompt function by structure rather than exact whitespace.
ui = Path("src/veil/ui.js")
text = ui.read_text()
new_prompt = dedent("""
  function updatePrompt(){
    const goal=growthGoal(resources.state,{cargo:run?.collectedElements??{}}),record=goal.id?resources.record(goal.id):null,cost=goal.id&&resources.costFor(goal.id),withCargo=el=>(resources.state.elements[el]??0)+(run?.collectedElements[el]??0);
    const affordable=cost&&Object.entries(cost).every(([el,n])=>withCargo(el)>=n),firstHydrogen=goal.id==='hydrogen'&&(run?.collectedElements.H??0)>=VEIL.firstCraftH;
    q('craft-resource-hint').textContent='';
    const goalAction=q('cho-goal-action');goalAction.hidden=!goal.id;q('cho-goal-label').textContent=goal.id?formula(goal.id):'';goalAction.setAttribute('aria-label',goal.id?`${formula(goal.id)}をクラフト`:'');renderCraftTargetAtoms(q('cho-goal-atoms'),record,[],{size:26});
    const ready=active&&goal.id&&!has(goal.id)&&affordable&&(resources.state.hints.includes(goal.id)||firstHydrogen);
    q('veil-craft-prompt').hidden=!ready;if(ready){const label=record?.formula??'◉';q('veil-to-craft-label').textContent=label;q('veil-to-craft').setAttribute('aria-label',`${label}をクラフトするため戻る`);renderCraftTargetAtoms(q('veil-to-craft-atoms'),record,[],{size:24});}else q('veil-to-craft-atoms')?.replaceChildren();
  }
""").strip()
if "renderCraftTargetAtoms(q('cho-goal-atoms')" not in text:
    pattern = re.compile(r"  function updatePrompt\(\)\{.*?\n  \}\n  function notice", re.S)
    replacement = "  " + new_prompt.replace("\n", "\n  ") + "\n  function notice"
    text, n = pattern.subn(replacement, text, count=1)
    if n != 1:
        raise SystemExit("veil updatePrompt structural anchor missing")

old_finish = "run=null;anchorLock=null;returnState=null;onCraft();updateCraft();q('launch-veil').focus();"
new_finish = "const pending=pendingCraftId;pendingCraftId=null;run=null;anchorLock=null;returnState=null;onCraft();updateCraft();q('launch-veil').focus();if(pending)window.dispatchEvent(new window.CustomEvent('molecule-craft:craft-molecule',{detail:{id:pending,source:'field'}}));"
if old_finish in text:
    text = text.replace(old_finish, new_finish, 1)
elif new_finish not in text:
    raise SystemExit("veil finish anchor missing")

old_listener = "q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',()=>beginReturn(false));q('veil-to-craft').addEventListener('click',()=>beginReturn(false));"
new_listener = "q('launch-veil').addEventListener('click',launch);q('veil-return').addEventListener('click',()=>beginReturn(false));q('veil-to-craft').addEventListener('click',()=>{const goal=growthGoal(resources.state,{cargo:run?.collectedElements??{}}),id=goal.id??null;if(id&&beginReturn(false))pendingCraftId=id;});"
if old_listener in text:
    text = text.replace(old_listener, new_listener, 1)
elif new_listener not in text:
    raise SystemExit("veil craft-return anchor missing")
ui.write_text(text)

append_once(
    "styles.css",
    "/* Unified craft target strip. */",
    """
    /* Unified craft target strip. */
    .craft-target{display:flex;align-items:center;flex-wrap:nowrap;gap:8px;overflow-x:auto;padding:7px 14px}
    .craft-target .craft-emblem{width:25px;height:25px;flex:none;overflow:visible;filter:drop-shadow(0 0 5px #75dfce38)}
    .craft-target .craft-emblem path{fill:none;stroke:#75dfce;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
    .craft-target .craft-emblem-a{fill:#e9f4f9}.craft-target .craft-emblem-b{fill:#67d9c7}.craft-target .craft-emblem-c{fill:#ed7f82}
    .craft-target #craft-target-formula{flex:none;color:#8fe0df;font-size:15px;font-weight:750;white-space:nowrap}
    .craft-target .craft-target-atoms{display:flex;flex:none;flex-wrap:nowrap;align-items:center;gap:5px;width:auto;margin-left:0;order:initial}
    .craft-target #craft-target-name{min-width:0;max-width:180px;overflow:hidden;text-overflow:ellipsis;color:#a9c4ce;font-size:11px;white-space:nowrap}
    .craft-target>button{flex:none;margin-left:auto}
    @media(max-width:430px){.craft-target{flex-wrap:nowrap;gap:6px}.craft-target .craft-target-atoms{width:auto;order:initial}.craft-target #craft-target-name{max-width:110px}}
    """,
)
append_once(
    "veil.css",
    "/* Unified craft-goal atom previews. */",
    """
    /* Unified craft-goal atom previews. */
    .cho-goal-action{max-width:calc(100% - 28px);flex-wrap:nowrap;justify-content:flex-start;overflow-x:auto}
    #cho-goal-action .craft-target-atoms,.veil-prompt .craft-target-atoms{display:flex;flex:none;flex-wrap:nowrap;align-items:center;gap:4px;margin-left:2px}
    .veil-prompt .craft-emblem-action{max-width:100%;overflow-x:auto;justify-content:flex-start}
    #craft-target:not([hidden])~#cho-goal-action{display:none}
    """,
)

replace_once(
    "tests/source-contracts.test.mjs",
    "readFile(new URL('src/app.js?v=44', root), 'utf8')",
    "readFile(new URL('src/app.js?v=45', root), 'utf8')",
)
replace_once(
    "tests/source-contracts.test.mjs",
    '/<script type="module" src="\\.\\/src\\/app\\.js\\?v=44"><\\/script>/',
    '/<script type="module" src="\\.\\/src\\/app\\.js\\?v=45"><\\/script>/',
)

Path("tests/unified-craft-target.test.mjs").write_text(
    dedent(r'''
    import assert from 'node:assert/strict';
    import {readFile} from 'node:fs/promises';
    import {craftTargetSlots} from '../src/craft-panel.js';

    const root=new URL('../',import.meta.url);
    const [index,app,panel,veilUi,styles,veilCss]=await Promise.all([
      readFile(new URL('index.html',root),'utf8'),
      readFile(new URL('src/app.js',root),'utf8'),
      readFile(new URL('src/craft-panel.js',root),'utf8'),
      readFile(new URL('src/veil/ui.js',root),'utf8'),
      readFile(new URL('styles.css',root),'utf8'),
      readFile(new URL('veil.css',root),'utf8'),
    ]);

    assert.match(index,/id="craft-target"[^>]*>[\s\S]*?class="craft-emblem"[\s\S]*?id="craft-target-formula"[\s\S]*?id="craft-target-atoms"[\s\S]*?id="craft-target-name" hidden/,'Active target must read emblem → formula → atom models → optional name');
    assert.match(index,/id="cho-goal-atoms"/);
    assert.match(index,/id="veil-to-craft-atoms"/);
    assert.match(app,/resources\.state\.recipes\.includes\(id\)\|\|resources\.state\.hints\.includes\(id\)/,'Hinted undiscovered molecules must be targetable');
    assert.match(app,/targetDiscovered:resources\.state\.recipes\.includes\(craftTargetId\)/,'Discovery state must be explicit when rendering the target');
    assert.match(panel,/nodes\.targetName\.hidden=!discovered/,'Undiscovered target names must stay hidden');
    assert.match(panel,/export function renderCraftTargetAtoms/,'Atom previews must share one renderer');
    assert.match(veilUi,/renderCraftTargetAtoms\(q\('cho-goal-atoms'\)/);
    assert.match(veilUi,/renderCraftTargetAtoms\(q\('veil-to-craft-atoms'\)/);
    assert.match(veilUi,/pendingCraftId=id/);
    assert.match(veilUi,/source:'field'/,'Field-return hint must become the same craft target after return');
    assert.match(styles,/Unified craft target strip/);
    assert.match(veilCss,/#craft-target:not\(\[hidden\]\)~#cho-goal-action/,'Campaign shortcut must not duplicate an active target');
    assert.deepEqual(craftTargetSlots({atoms:['C','H','H','H','H']},[]).map(x=>x.symbol),['C','H','H','H','H']);

    console.log('Unified craft target tests passed.');
    ''').lstrip()
)
