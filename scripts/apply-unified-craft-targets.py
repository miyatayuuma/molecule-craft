from pathlib import Path
from textwrap import dedent
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old in text:
        p.write_text(text.replace(old, new, 1))
        return
    if new in text:
        return
    raise SystemExit(f"replacement anchor missing: {path}: {old[:100]!r}")


def append_once(path, marker, block):
    p = Path(path)
    text = p.read_text()
    if marker not in text:
        p.write_text(text.rstrip() + "\n\n" + dedent(block).strip() + "\n")


# Cache/version edges.
replace_once("index.html", "./styles.css?v=38", "./styles.css?v=39")
replace_once("index.html", "./veil.css?v=41", "./veil.css?v=42")
replace_once("index.html", "./src/app.js?v=44", "./src/app.js?v=45")
replace_once("src/app.js", "from './craft-connections.js?v=2'", "from './craft-connections.js?v=3'")
replace_once("src/app.js", "from './craft-panel.js?v=2'", "from './craft-panel.js?v=3'")
replace_once("src/craft-connections.js", "from './veil/ui.js'", "from './veil/ui.js?v=2'")

# One visual language for the active target and campaign entry points.
old_target = '<section id="craft-target" class="craft-target" aria-label="制作目標" hidden><div><small>制作目標</small><strong id="craft-target-name"></strong><span id="craft-target-formula"></span></div><div id="craft-target-atoms" class="craft-target-atoms"></div><button id="clear-craft-target" type="button" aria-label="制作目標を解除">×</button></section>'
new_target = '<section id="craft-target" class="craft-target" aria-label="制作目標" hidden><svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><strong id="craft-target-formula"></strong><div id="craft-target-atoms" class="craft-target-atoms"></div><span id="craft-target-name" hidden></span><button id="clear-craft-target" type="button" aria-label="制作目標を解除">×</button></section>'
replace_once("index.html", old_target, new_target)
replace_once(
    "index.html",
    '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><span id="cho-goal-label"></span></button>',
    '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><span id="cho-goal-label"></span><span id="cho-goal-atoms" class="craft-target-atoms" aria-hidden="true"></span></button>',
)
replace_once(
    "index.html",
    '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><span id="veil-to-craft-label">H₂</span></button></div>',
    '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><span id="veil-to-craft-label">H₂</span><span id="veil-to-craft-atoms" class="craft-target-atoms" aria-hidden="true"></span></button></div>',
)

# Share one required-atom renderer and gate the molecule name on discovery.
panel = Path("src/craft-panel.js")
text = panel.read_text()
if "export function renderCraftTargetAtoms" not in text:
    text = text.replace(
        "function styleTargetAtom(node,symbol,filled){",
        "function styleTargetAtom(node,symbol,filled,size=31){",
        1,
    )
    text = text.replace(
        "flex:0 0 31px;width:31px;height:31px;",
        "flex:0 0 ${size}px;width:${size}px;height:${size}px;",
        1,
    )
    text = text.replace(
        "font-size:12px;font-weight:800;",
        "font-size:${size<=27?10:12}px;font-weight:800;",
        1,
    )
    marker = "}\n\nexport function createCraftPanel(document){"
    helper = dedent("""
    }

    export function renderCraftTargetAtoms(container,record,placedAtoms=[],{size=31}={}){
      if(!container)return[];container.replaceChildren();const rendered=[];
      for(const slot of craftTargetSlots(record,placedAtoms)){const chip=container.ownerDocument.createElement('span');chip.className='craft-target-atom';chip.dataset.element=slot.symbol;chip.dataset.filled=String(slot.filled);chip.textContent=slot.symbol;chip.setAttribute('aria-label',`${ELEMENTS[slot.symbol]?.name??slot.symbol} ${slot.filled?'配置済み':'未配置'}`);styleTargetAtom(chip,slot.symbol,slot.filled,size);container.appendChild(chip);rendered.push({slot,node:chip});}
      return rendered;
    }

    export function createCraftPanel(document){
    """).lstrip()
    if marker not in text:
        raise SystemExit("craft-panel helper anchor missing")
    text = text.replace(marker, helper, 1)

if "targetDiscovered=false" not in text:
    pattern = re.compile(
        r"  function renderTarget\(record,placedAtoms,onClearTarget\)\{.*?\n  \}\n\n  function renderInfo",
        re.S,
    )
    replacement = dedent("""
      function renderTarget(record,placedAtoms,onClearTarget,{discovered=false}={}){
        clearTarget=onClearTarget??(()=>{});nodes.target.hidden=!record;if(!record){nodes.targetName.hidden=true;lastTargetKey='';lastTargetFilled={};return;}
        const displayName=record.commonNameJa??record.nameJa??record.name??'';nodes.targetName.textContent=discovered?displayName:'';nodes.targetName.hidden=!discovered;nodes.targetFormula.textContent=record.formula??'';nodes.target.setAttribute('aria-label',`${record.formula??'分子'}${discovered&&displayName?` ${displayName}`:''} 制作目標`);
        const rendered=renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms),key=record.id??record.formula??record.name??'target',sameTarget=key===lastTargetKey,filledNow={};
        for(const {slot,node:chip}of rendered){if(slot.filled)filledNow[slot.symbol]=(filledNow[slot.symbol]??0)+1;if(sameTarget&&slot.filled&&slot.index>=(lastTargetFilled[slot.symbol]??0)&&typeof chip.animate==='function')chip.animate([{transform:'scale(.82)'},{transform:'scale(1.09)'},{transform:'scale(1)'}],{duration:220,easing:'ease-out'});}
        lastTargetKey=key;lastTargetFilled=filledNow;
      }

      function renderInfo
    """).rstrip()
    text, n = pattern.subn(replacement, text, count=1)
    if n != 1:
        raise SystemExit("craft-panel renderTarget anchor missing")
    text = text.replace(
        "function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,onClearTarget,",
        "function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetDiscovered=false,onClearTarget,",
        1,
    )
    text = text.replace(
        "renderTarget(target,molecule.atoms,onClearTarget);",
        "renderTarget(target,molecule.atoms,onClearTarget,{discovered:targetDiscovered});",
        1,
    )
panel.write_text(text)

# Hinted, undiscovered campaign molecules are valid targets, but not discoveries.
replace_once(
    "src/app.js",
    "selectedAtomId=restored.selected;craftTargetId=resources.state.recipes.includes(restored.targetMoleculeId)?restored.targetMoleculeId:null;",
    "selectedAtomId=restored.selected;craftTargetId=(resources.state.recipes.includes(restored.targetMoleculeId)||resources.state.hints.includes(restored.targetMoleculeId))?restored.targetMoleculeId:null;",
)
replace_once(
    "src/app.js",
    "const record=resources.record(id);if(!record||!resources.state.recipes.includes(id)||interactionLocked()||dragState||activePointers.size)return false;",
    "const record=resources.record(id),targetable=resources.state.recipes.includes(id)||resources.state.hints.includes(id);if(!record||!targetable||interactionLocked()||dragState||activePointers.size)return false;",
)
replace_once(
    "src/app.js",
    "target:resources.record(craftTargetId),targetAvailable,",
    "target:resources.record(craftTargetId),targetDiscovered:resources.state.recipes.includes(craftTargetId),targetAvailable,",
)

# Field hints use the same atom renderer and become the pending target on return.
ui = Path("src/veil/ui.js")
text = ui.read_text()
if "import { renderCraftTargetAtoms }" not in text:
    text = text.replace(
        "import { combustionPacketFor,performanceFor } from './molecule-roles.js';",
        "import { combustionPacketFor,performanceFor } from './molecule-roles.js';\nimport { renderCraftTargetAtoms } from '../craft-panel.js?v=3';",
        1,
    )
if "pendingCraftId=null" not in text:
    text = text.replace(
        "anchorLock=null,returnState=null;",
        "anchorLock=null,returnState=null,pendingCraftId=null;",
        1,
    )
old_prompt = dedent("""
  function updatePrompt(){
    const goal=growthGoal(resources.state,{cargo:run?.collectedElements??{}}),cost=goal.id&&resources.costFor(goal.id),withCargo=el=>(resources.state.elements[el]??0)+(run?.collectedElements[el]??0);
    const affordable=cost&&Object.entries(cost).every(([el,n])=>withCargo(el)>=n),firstHydrogen=goal.id==='hydrogen'&&(run?.collectedElements.H??0)>=VEIL.firstCraftH;
    q('craft-resource-hint').textContent='';
    const goalAction=q('cho-goal-action');goalAction.hidden=!goal.id;q('cho-goal-label').textContent=goal.id?formula(goal.id):'';goalAction.setAttribute('aria-label',goal.id?`${formula(goal.id)}をクラフト`:'');
    const ready=active&&goal.id&&!has(goal.id)&&affordable&&(resources.state.hints.includes(goal.id)||firstHydrogen);
    q('veil-craft-prompt').hidden=!ready;if(ready){const record=resources.record(goal.id),label=record?.formula??'◉';q('veil-to-craft-label').textContent=label;q('veil-to-craft').setAttribute('aria-label',`${label}をクラフトするため戻る`);}
  }
""").strip()
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
if old_prompt in text:
    text = text.replace(old_prompt, new_prompt, 1)
elif new_prompt not in text:
    raise SystemExit("veil updatePrompt anchor missing")
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

# Keep source-contract cache assertions current.
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
