from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing: {path}: {old[:80]!r}')
    p.write_text(text.replace(old, new, 1))

# app.js: cache bust craft panel, track one-shot target deployments, and return spawn ids.
replace_once('src/app.js', "import { createCraftPanel } from './craft-panel.js?v=3';", "import { createCraftPanel } from './craft-panel.js?v=4';")
replace_once('src/app.js', "let collectionGame=null,collectionOpen=false,craftTargetId=null;", "let collectionGame=null,collectionOpen=false,craftTargetId=null;\nconst targetDeployments=new Map();let targetDeploymentTargetId=null;")
replace_once('src/app.js', "  pulse(`${ELEMENTS[symbol].name}を置きました`);\n}", "  pulse(`${ELEMENTS[symbol].name}を置きました`);return atom;\n}")
replace_once('src/app.js', "  refresh();pulse(`${template.nameJa}を置きました`);return true;\n}", "  refresh();pulse(`${template.nameJa}を置きました`);return expanded;\n}")
old = """function targetPartsFor(record){
  if(!record)return[];
  const state=collectionGame?.state,unlocked=state?.templates?.filter(template=>state.isUnlocked(template.id))??[];
  return decomposeTargetIntoAvailableParts(record,unlocked).map(item=>item.partId?{...item,template:collectionGame?.templateFor(item.partId)}:item);
}
function placeTargetPart(item){
  if(!item)return false;
  if(item.partId)return addCraftPart(item.partId);
  addElement(item.element);return true;
}
"""
new = """function targetPartKey(item){return`${item.partId??item.element}:${(item.atomIndices??[]).join(',')}`;}
function syncTargetDeployments(record){
  const targetId=record?.id??null;
  if(targetDeploymentTargetId!==targetId){targetDeployments.clear();targetDeploymentTargetId=targetId;}
  const active=new Set(molecule.atoms.map(atom=>atom.id));
  for(const [key,ids]of targetDeployments)if([...ids].every(id=>!active.has(id)))targetDeployments.delete(key);
}
function targetPartsFor(record){
  syncTargetDeployments(record);if(!record)return[];
  const state=collectionGame?.state,unlocked=state?.templates?.filter(template=>state.isUnlocked(template.id))??[];
  return decomposeTargetIntoAvailableParts(record,unlocked).map(item=>{const targetKey=targetPartKey(item);return item.partId?{...item,targetKey,template:collectionGame?.templateFor(item.partId)}:{...item,targetKey};}).filter(item=>!targetDeployments.has(item.targetKey));
}
function placeTargetPart(item){
  if(!item?.targetKey||targetDeployments.has(item.targetKey))return false;
  let ids;
  if(item.partId){const expanded=addCraftPart(item.partId);if(!expanded)return false;ids=expanded.ids;}
  else{const atom=addElement(item.element);if(!atom)return false;ids=[atom.id];}
  targetDeployments.set(item.targetKey,new Set(ids));refreshInfo();return true;
}
"""
replace_once('src/app.js', old, new)

# craft-panel.js: compact only genuinely long structural labels; keep bond dash marks.
panel = Path('src/craft-panel.js')
text = panel.read_text()
anchor = "\nexport function renderCraftTargetAtoms(container,record,placedAtoms=[],{size=31}={}){"
helper = """
function partCompositionFormula(template){
  const atoms=template?.atoms??[],counts=countElements(atoms),order=[];for(const symbol of atoms)if(!order.includes(symbol))order.push(symbol);
  return order.map(symbol=>`${symbol}${counts[symbol]>1?counts[symbol]:''}`).join('');
}
export function compactPartNotation(template){
  const raw=String(template?.notation??template?.label??template?.id??'').trim();if([...raw].length<=10)return raw;
  const leading=raw.match(/^[–—-]/)?.[0]??(template?.attachments?.length?'–':''),trailing=raw.match(/[–—-]$/)?.[0]??(template?.attachments?.length>1?'–':'');
  const formula=partCompositionFormula(template);return formula?`${leading}${formula}${trailing}`:raw;
}
"""
if anchor not in text:
    raise SystemExit('craft-panel helper anchor missing')
text = text.replace(anchor, helper + anchor, 1)
old = """      const notation=String(template?.notation??template?.label??item.partId).replace(/^[\\s–—-]+|[\\s–—-]+$/g,'')||item.partId;formula.className='craft-target-part-formula';formula.textContent=notation;
      chip.setAttribute('aria-label',`${template?.nameJa??notation}をクラフト台へ出す`);chip.append(model,formula);chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;
"""
new = """      const notation=compactPartNotation(template)||item.partId;formula.className='craft-target-part-formula';formula.textContent=notation;formula.dataset.long=String([...notation].length>8);
      chip.setAttribute('aria-label',`${template?.nameJa??notation}をクラフト台へ出す`);chip.append(model,formula);chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;
"""
if old not in text:
    raise SystemExit('craft-panel notation anchor missing')
text = text.replace(old, new, 1)
text = text.replace("function renderTarget(record,placedAtoms,onClearTarget,{discovered=false,targetParts=[],onPlaceTargetPart=()=>{}}={}){", "function renderTarget(record,placedAtoms,onClearTarget,{discovered=false,targetParts=null,onPlaceTargetPart=()=>{}}={}){", 1)
text = text.replace("const rendered=targetParts.length?renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{size:36,onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms,{size:36})", "const rendered=targetParts!==null?renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{size:31,onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms,{size:31})", 1)
text = text.replace("function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetParts=[],onPlaceTargetPart", "function renderInfo({keep,veilUI,focus,structures,selected,molecule,target,targetParts=null,onPlaceTargetPart", 1)
panel.write_text(text)

# index: stack formula/name and bump runtime cache keys.
index = Path('index.html')
text = index.read_text()
text = text.replace('./styles.css?v=40','./styles.css?v=41',1).replace('./src/app.js?v=45','./src/app.js?v=46',1)
old = '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><strong id="craft-target-formula"></strong><div id="craft-target-atoms" class="craft-target-atoms"></div><span id="craft-target-name" hidden></span><button id="clear-craft-target" type="button" aria-label="制作目標を解除">×</button>'
new = '<svg class="craft-emblem" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><path d="M9 9L23 13L14 24Z"/><circle class="craft-emblem-a" cx="9" cy="9" r="4.4"/><circle class="craft-emblem-b" cx="23" cy="13" r="4.7"/><circle class="craft-emblem-c" cx="14" cy="24" r="3.9"/></svg><div class="craft-target-meta"><strong id="craft-target-formula"></strong><span id="craft-target-name" hidden></span></div><div id="craft-target-atoms" class="craft-target-atoms"></div><button id="clear-craft-target" type="button" aria-label="制作目標を解除">×</button>'
if old not in text:
    raise SystemExit('index target anchor missing')
index.write_text(text.replace(old,new,1))

# CSS: final overrides keep target identity grouped and give materials their own scrolling lane.
styles = Path('styles.css')
text = styles.read_text()
text += r'''

/* Craft target hierarchy: identity left, available one-shot materials right. */
.craft-target{display:grid;grid-template-columns:auto minmax(72px,auto) minmax(0,1fr) auto;grid-template-rows:1fr 1fr;align-items:center;column-gap:9px;row-gap:0;min-height:64px;overflow:hidden;padding:8px 14px}
.craft-target .craft-emblem{grid-column:1;grid-row:1/3;align-self:center}
.craft-target-meta{grid-column:2;grid-row:1/3;display:flex;min-width:72px;max-width:150px;flex-direction:column;justify-content:center;gap:1px;overflow:hidden}
.craft-target .craft-target-meta #craft-target-formula{font-size:14px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.craft-target .craft-target-meta #craft-target-name{max-width:none;color:#a9c4ce;font-size:10px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.craft-target .craft-target-atoms{grid-column:3;grid-row:1/3;display:flex;width:100%;height:48px;min-width:0;margin:0;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.craft-target .craft-target-atoms::-webkit-scrollbar{display:none}
.craft-target>button#clear-craft-target{grid-column:4;grid-row:1/3;align-self:center;margin-left:0}
.craft-target-part-formula[data-long="true"]{font-size:9px;letter-spacing:-.05em}
@media(max-width:430px){.craft-target{grid-template-columns:auto minmax(58px,auto) minmax(0,1fr) auto;column-gap:6px;padding-inline:10px}.craft-target-meta{min-width:58px;max-width:105px}.craft-target .craft-target-meta #craft-target-formula{font-size:13px}.craft-target .craft-target-meta #craft-target-name{font-size:9px}}
'''
styles.write_text(text)

# Focused tests for display policy and contracts.
Path('tests/craft-target-display.test.mjs').write_text("""import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compactPartNotation} from '../src/craft-panel.js';
const templates=JSON.parse(await readFile(new URL('../data/craft-structures.json',import.meta.url)));
const part=id=>templates.find(item=>item.id===id);
assert.equal(compactPartNotation(part('n-butyl')),'–C4H9','Long chain notation compacts while retaining the attachment dash');
assert.equal(compactPartNotation(part('hydroxyl')),'–OH','Short functional-group notation stays structural');
assert.equal(compactPartNotation(part('phenyl')),'–C₆H₅','Already compact notation is preserved');
console.log('Craft target display policy passed.');
""")

contracts=Path('tests/source-contracts.test.mjs')
text=contracts.read_text().replace("src/app.js?v=45","src/app.js?v=46",1).replace("app\\.js\\?v=45","app\\.js\\?v=46",1).replace("styles\\.css\\?v=40","styles\\.css\\?v=41",1)
anchor="assert.match(craftPanel, /craft-target-part-formula/);"
addition=anchor+"\nassert.match(app, /const targetDeployments=new Map\\(\\)/);\nassert.match(app, /targetDeployments\\.set\\(item\\.targetKey,new Set\\(ids\\)\\)/);\nassert.match(app, /return expanded;/);\nassert.match(craftPanel, /compactPartNotation/);\nassert.match(index, /class=\\\"craft-target-meta\\\"/);"
if anchor not in text: raise SystemExit('contract anchor missing')
contracts.write_text(text.replace(anchor,addition,1))
