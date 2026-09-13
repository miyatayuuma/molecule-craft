from pathlib import Path
import re


def read(path):
    return Path(path).read_text()


def write(path, text):
    Path(path).write_text(text)


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing exact block: {label}')
    return text.replace(old, new, 1)


def sub_once(text, pattern, replacement, label, flags=0):
    text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'missing regex block: {label}')
    return text


# 1) Pending blueprints: remove visible explanatory title/subtitle.
path = 'src/pending-craft.js'
text = read(path)
pattern = r"    dialog=root\.createElement\('dialog'\);dialog\.id='pending-crafts-dialog';dialog\.className='sheet';dialog\.setAttribute\('aria-labelledby','pending-crafts-title'\);\n    const header=root\.createElement\('header'\);header\.className='sheet-header';\n    const heading=.*?\n    title\.id='pending-crafts-title'.*?header\.append\(heading,close\);"
replacement = "    dialog=root.createElement('dialog');dialog.id='pending-crafts-dialog';dialog.className='sheet';dialog.setAttribute('aria-label','設計図');\n    const header=root.createElement('header');header.className='sheet-header';\n    const close=root.createElement('button');\n    close.type='button';close.setAttribute('aria-label','設計図を閉じる');close.textContent='×';header.append(close);"
text = sub_once(text, pattern, replacement, 'pending visible explanation', re.S)
text = replace_once(text, "access.setAttribute('aria-label',ids.length?`未作成の設計図 ${ids.length}件`:'未作成の設計図なし')", "access.setAttribute('aria-label',ids.length?`設計図 ${ids.length}件`:'設計図なし')", 'pending access label')
write(path, text)


# 2) LOADOUT stock preview: show direct element chips, not a prose shortage banner.
path = 'src/veil/loadout-workstation.js'
text = read(path)
pattern = r"function shortageRatio\(chips\)\{.*?\n\}\n\nfunction syncStockPreview\(preview\)\{.*?\n\}\n\nfunction observeStockPreview"
replacement = "function syncStockPreview(preview){\n  if(!preview)return;\n  const chips=[...preview.children].filter(node=>node.dataset?.sufficient!==undefined);\n  if(!chips.length){preview.hidden=true;return;}\n  const insufficient=chips.some(chip=>chip.dataset.sufficient==='false');\n  preview.hidden=!insufficient;\n  for(const chip of chips){chip.hidden=false;chip.dataset.stockState=chip.dataset.sufficient==='false'?'short':'ready';}\n  if(insufficient)preview.setAttribute('aria-label','必要元素');else preview.removeAttribute('aria-label');\n}\n\nfunction observeStockPreview"
text = sub_once(text, pattern, replacement, 'stock preview functions', re.S)
text = replace_once(text, "#supply-dialog #loadout-stock-preview{display:grid!important;grid-template-columns:1fr!important;width:min(330px,calc(100% - 44px));min-height:0!important;margin:8px auto 0;padding:0!important}", "#supply-dialog #loadout-stock-preview{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px;width:min(330px,calc(100% - 44px));min-height:0!important;margin:8px auto 0;padding:0!important}", 'stock preview grid')
text = sub_once(text, r"\n#supply-dialog \.loadout-shortage-status\{[^\n]*\}\n#supply-dialog \.loadout-shortage-status>i\{[^\n]*\}\n#supply-dialog \.loadout-shortage-status>i>b\{[^\n]*\}", "\n#supply-dialog #loadout-stock-preview>[data-sufficient]{min-width:0;padding:6px 8px;border:1px solid #34505d;border-radius:9px;background:#0b202b;color:#c9d8dd;font-variant-numeric:tabular-nums;text-align:center}\n#supply-dialog #loadout-stock-preview>[data-sufficient='true']{opacity:.42}\n#supply-dialog #loadout-stock-preview>[data-sufficient='false']{border-color:#b97856;box-shadow:inset 0 0 0 1px #b9785633,0 0 9px #b9785622;color:#f0d2bf}", 'shortage status css')
text = text.replace("#supply-dialog .loadout-shortage-status{gap:8px;font-size:9.5px}", "#supply-dialog #loadout-stock-preview{grid-template-columns:repeat(2,minmax(0,1fr))!important}")
text = text.replace(",#supply-dialog .loadout-shortage-status>i>b", "")
if 'loadout-shortage-status' in text or '材料不足' in text:
    raise SystemExit('explanatory workstation shortage survived')
write(path, text)


# 3) LOADOUT launch shortage: direct have/need state and destination continuity.
path = 'src/veil/supply.js'
text = read(path)
text = replace_once(text, "return Object.entries(plan?.missing??{}).map(([element,row])=>({element,count:Math.max(0,(row?.need??0)-(row?.have??0))})).filter(item=>item.count>0);", "return Object.entries(plan?.missing??{}).map(([element,row])=>({element,have:Math.max(0,row?.have??0),need:Math.max(0,row?.need??0)})).filter(item=>item.have<item.need);", 'canonical shortage state')
text = replace_once(text, "partialGo.type='button';partialGo.className='primary';partialGo.textContent='この量で出る';", "partialGo.type='button';partialGo.className='primary';partialGo.textContent='出発';", 'partial action label')
text = replace_once(text, "const confirmation=launchConfirmationState(plan);partialRows.replaceChildren();partialPanel.dataset.fillState=confirmation.zeroFill?'ZERO':'PARTIAL';partialGo.textContent=confirmation.zeroFill?'この状態で出る':'この量で出る';\n    if(confirmation.zeroFill){const blocked=document.createElement('strong');blocked.textContent='搭載できません';blocked.dataset.fillUnavailable='true';Object.assign(blocked.style,{fontSize:'15px',lineHeight:'1.4',color:'#f1f7f9'});partialRows.append(blocked);}", "const confirmation=launchConfirmationState(plan);partialRows.replaceChildren();partialPanel.dataset.fillState=confirmation.zeroFill?'ZERO':'PARTIAL';partialGo.textContent='出発';", 'zero-fill prose')
old = "    if(confirmation.shortages.length){const shortage=document.createElement('p');shortage.dataset.launchShortage='true';shortage.textContent=`${confirmation.shortages.map(item=>`${item.element} が${item.count}個`).join('、')}足りません`;Object.assign(shortage.style,{margin:'2px 0 0',fontSize:'13px',fontWeight:'800',lineHeight:'1.45',color:'#ffd0a3',overflowWrap:'anywhere'});partialRows.append(shortage);}"
new = "    if(confirmation.shortages.length){const shortages=document.createElement('div');shortages.dataset.launchShortage='true';Object.assign(shortages.style,{display:'flex',gap:'7px',flexWrap:'wrap',margin:'2px 0 0'});for(const item of confirmation.shortages){const chip=document.createElement('span'),element=document.createElement('strong'),amount=document.createElement('b'),track=document.createElement('i'),fill=document.createElement('em');chip.dataset.element=item.element;Object.assign(chip.style,{display:'grid',gridTemplateColumns:'auto auto',alignItems:'center',gap:'6px',padding:'5px 7px',border:'1px solid #b97856',borderRadius:'9px',background:'#1d1817',fontVariantNumeric:'tabular-nums'});element.textContent=item.element;amount.textContent=`${item.have} / ${item.need}`;Object.assign(amount.style,{fontSize:'12px',fontWeight:'800'});Object.assign(track.style,{gridColumn:'1 / -1',display:'block',height:'3px',borderRadius:'3px',background:'#4b3026',overflow:'hidden'});Object.assign(fill.style,{display:'block',height:'100%',transformOrigin:'left',transform:`scaleX(${item.need?Math.min(1,item.have/item.need):0})`,background:'#d9956f'});track.append(fill);chip.append(element,amount,track);shortages.append(chip);}partialRows.append(shortages);}"
text = replace_once(text, old, new, 'shortage prose block')
old = "  function resetLaunchGesture({keepDestinations=false}={}){\n    const pointer=launchPointer;launchPointer=null;launchStart=null;launchDragged=0;\n    try{if(pointer!==null)launchHandle.releasePointerCapture(pointer);}catch{}\n    if(!keepDestinations)showLaunchDestinations(false);resetLaunchPosition();\n  }"
new = "  function resetLaunchGesture({keepDestinations=false}={}){\n    const pointer=launchPointer;launchPointer=null;launchStart=null;launchDragged=0;\n    try{if(pointer!==null)launchHandle.releasePointerCapture(pointer);}catch{}\n    if(!keepDestinations){showLaunchDestinations(false);resetLaunchPosition();}else launchHandle.style.cursor='grab';\n  }"
text = replace_once(text, old, new, 'launch reset')
old = "  function launchDestination(id){\n    resetLaunchGesture();if(!canOpen()||resources.blocked)return false;const select=q('expedition-anchor'),option=[...select.options].find(item=>item.value===id);if(!option)return false;select.value=id;select.dispatchEvent(new window.Event('change',{bubbles:true}));q('launch-veil').click();return true;\n  }"
new = "  function launchDestination(id){\n    const target=launchItems.find(item=>item.id===id);if(!target||!canOpen()||resources.blocked)return false;resetLaunchGesture({keepDestinations:true});setLaunchActive(target);showLaunchDestinations(true);shellCanvas.style.transition=reduced?'none':'transform .12s ease';shellCanvas.style.transform=`translate(${target.x}px,${target.y}px)`;const select=q('expedition-anchor'),option=[...select.options].find(item=>item.value===id);if(!option)return false;select.value=id;select.dispatchEvent(new window.Event('change',{bubbles:true}));q('launch-veil').click();return true;\n  }"
text = replace_once(text, old, new, 'launch destination selection retention')
if '搭載できません' in text or '足りません' in text:
    raise SystemExit('explanatory launch shortage survived')
write(path, text)


# 4) FIELD signifiers: emission and convergence motion instead of △ / ◎-like glyphs.
path = 'src/veil/renderer.js'
text = read(path)
old = "      ctx.strokeStyle='#bde6db';ctx.globalAlpha=.45;ctx.lineWidth=1;ctx.beginPath();ctx.arc(OXYGEN_REWARD.x,OXYGEN_REWARD.y,OXYGEN_REWARD.radius+15,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;"
new = "      // Reward convergence is shown as oxygen-colored motes physically streaming inward, not a marker glyph.\n      const rewardGlow=ctx.createRadialGradient(OXYGEN_REWARD.x,OXYGEN_REWARD.y,0,OXYGEN_REWARD.x,OXYGEN_REWARD.y,OXYGEN_REWARD.radius*1.2);rewardGlow.addColorStop(0,'rgba(255,148,77,.16)');rewardGlow.addColorStop(1,'rgba(255,148,77,0)');ctx.fillStyle=rewardGlow;ctx.fillRect(OXYGEN_REWARD.x-OXYGEN_REWARD.radius*1.2,OXYGEN_REWARD.y-OXYGEN_REWARD.radius*1.2,OXYGEN_REWARD.radius*2.4,OXYGEN_REWARD.radius*2.4);for(let i=0;i<9;i++){const phase=(run.time*.18+i/9)%1,r=OXYGEN_REWARD.radius*(1.05-phase*.82),a=i*2.399+run.time*.12;ctx.globalAlpha=.16+phase*.48;ctx.fillStyle='#ff944d';ctx.beginPath();ctx.arc(OXYGEN_REWARD.x+Math.cos(a)*r,OXYGEN_REWARD.y+Math.sin(a)*r,1.5+phase*2.1,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;"
text = replace_once(text, old, new, 'reward ring')
old = "      for(const signal of run.map.signals)if(!signal.ready){\n        const pulse=(run.time*.7)%1,radius=18+pulse*34;ctx.strokeStyle='#f1d28b';ctx.globalAlpha=(1-pulse)*.42;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(signal.x,signal.y,radius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.7;ctx.beginPath();for(let i=0;i<3;i++){const a=run.time*.4+i*Math.PI*2/3;i?ctx.lineTo(signal.x+Math.cos(a)*9,signal.y+Math.sin(a)*9):ctx.moveTo(signal.x+Math.cos(a)*9,signal.y+Math.sin(a)*9);}ctx.closePath();ctx.stroke();ctx.globalAlpha=1;\n      }"
new = "      for(const signal of run.map.signals)if(!signal.ready){\n        // Signals read as emission: a live core plus paired wavefronts, never an abstract triangle marker.\n        const pulse=(run.time*.7)%1,core=ctx.createRadialGradient(signal.x,signal.y,0,signal.x,signal.y,14);core.addColorStop(0,'rgba(241,210,139,.8)');core.addColorStop(.22,'rgba(241,210,139,.3)');core.addColorStop(1,'rgba(241,210,139,0)');ctx.fillStyle=core;ctx.globalAlpha=.8;ctx.fillRect(signal.x-14,signal.y-14,28,28);ctx.fillStyle='#f1d28b';ctx.beginPath();ctx.arc(signal.x,signal.y,2.6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#f1d28b';ctx.lineWidth=1.3;for(let wave=0;wave<3;wave++){const phase=(pulse+wave/3)%1,radius=9+phase*42;ctx.globalAlpha=(1-phase)*.36;ctx.beginPath();ctx.arc(signal.x,signal.y,radius,-.72,.72);ctx.stroke();ctx.beginPath();ctx.arc(signal.x,signal.y,radius,Math.PI-.72,Math.PI+.72);ctx.stroke();}ctx.globalAlpha=1;\n      }"
text = replace_once(text, old, new, 'signal triangle')
write(path, text)


# Tests.
path = 'tests/pending-craft.test.mjs'
text = read(path)
text = replace_once(text, "assert.match(pendingSource,/`未作成の設計図 \\${ids\\.length}件`/,'accessible pending count remains on the navigation button');", "assert.match(pendingSource,/`設計図 \\${ids\\.length}件`/,'accessible pending count remains concise on the navigation button');\nassert.doesNotMatch(pendingSource,/未作成の設計図|探索で見つけた、まだ作っていない分子/,'pending blueprints must not explain their state with visible prose');", 'pending test copy')
write(path, text)

path = 'tests/loadout-shortage-confirmation.test.mjs'
text = read(path)
text = replace_once(text, "assert.equal(shortage(state,'H').count,plan.missing.H.need-plan.missing.H.have,'shortage count must come from canonical plan.missing');", "assert.deepEqual(shortage(state,'H'),{element:'H',have:plan.missing.H.have,need:plan.missing.H.need},'shortage state must expose canonical have / need');", 'shortage test H')
text = replace_once(text, "for(const element of ['H','C','O'])assert.equal(shortage(state,element).count,plan.missing[element].need-plan.missing[element].have);", "for(const element of ['H','C','O'])assert.deepEqual(shortage(state,element),{element,have:plan.missing[element].have,need:plan.missing[element].need});", 'shortage test multi')
text = replace_once(text, "  assert.match(source,/搭載できません/);assert.match(source,/dataset\\.launchShortage/);assert.match(source,/item\\.actual} \/ \\${item\\.requested/,'quantity is presented as actual / requested rather than percentage-only');", "  assert.doesNotMatch(source,/搭載できません|足りません/,'visible shortage state must not use explanatory prose');assert.match(source,/dataset\\.launchShortage/);assert.match(source,/item\\.actual} \/ \\${item\\.requested/,'tank quantity is presented as actual / requested');assert.match(source,/item\\.have} \/ \\${item\\.need/,'element shortage is presented directly as have / need');", 'shortage source contract')
text = text.replace("console.log('LOADOUT shortage confirmation passed: FULL silence, canonical PARTIAL quantities/shortages, zero-fill, multi-element shortage, preview/commit parity, responsive layout and legacy terminology guard.');", "console.log('LOADOUT shortage confirmation passed: direct have/need state, no explanatory shortage prose, zero-fill, preview/commit parity and responsive layout.');")
write(path, text)

path = 'tests/loadout-workstation.test.mjs'
text = read(path)
text = text.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';", 1)
text += """

test('LOADOUT stock preview exposes element state without an explanatory shortage banner',async()=>{
  const source=await readFile(new URL('../src/veil/loadout-workstation.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/材料不足|loadout-shortage-status/);
  assert.match(source,/chip\.dataset\.stockState=chip\.dataset\.sufficient==='false'\?'short':'ready'/);
  assert.match(source,/preview\.setAttribute\('aria-label','必要元素'\)/);
  assert.match(source,/\[data-sufficient='false'\]/,'insufficient element chips receive direct visual state');
});
"""
write(path, text)

path = 'tests/launch-selector.test.mjs'
text = read(path)
anchor = "assert.match(source,/shellCanvas\\.style\\.transform=`translate/,'The visible explorer must follow the drag');\n"
addition = anchor + "assert.match(source,/resetLaunchGesture\\(\\{keepDestinations:true\\}\\)/,'Destination launch must preserve selector context through shortage confirmation');\nassert.match(source,/shellCanvas\\.style\\.transform=`translate\\(\\$\\{target\\.x\\}px,\\$\\{target\\.y\\}px\\)`/,'Explorer must stay parked on the selected destination while launch state is evaluated');\n"
text = replace_once(text, anchor, addition, 'launch selector test')
write(path, text)

path = 'tests/ui-symbols.test.mjs'
text = read(path)
text = replace_once(text, "const [supply,craftPanel]=await Promise.all([\n  readFile(new URL('src/veil/supply.js',root),'utf8'),\n  readFile(new URL('src/craft-panel.js',root),'utf8'),\n]);", "const [supply,craftPanel,renderer]=await Promise.all([\n  readFile(new URL('src/veil/supply.js',root),'utf8'),\n  readFile(new URL('src/craft-panel.js',root),'utf8'),\n  readFile(new URL('src/veil/renderer.js',root),'utf8'),\n]);", 'ui symbols imports')
anchor = "assert.match(craftPanel,/💡/,'Idea state must be visible without tutorial copy');\n"
addition = anchor + "assert.match(renderer,/Signals read as emission/,'FIELD signals use emitted wavefront behavior');\nassert.match(renderer,/Reward convergence is shown as oxygen-colored motes/,'FIELD reward uses converging resource behavior');\nassert.doesNotMatch(renderer,/run\\.time\\*\\.4\\+i\\*Math\\.PI\\*2\\/3/,'FIELD signals must not render an unexplained triangle glyph');\nassert.doesNotMatch(renderer,/OXYGEN_REWARD\\.radius\\+15/,'FIELD reward must not render as an unexplained ring marker');\n"
text = replace_once(text, anchor, addition, 'ui symbol field tests')
text = text.replace("console.log('UI symbol contracts passed: flame combustion cue, burst-count ticks, continuous other tanks, and idea bulbs.');", "console.log('UI symbol contracts passed: semantic propulsion/idea cues plus behavioral FIELD signal and reward signifiers.');")
write(path, text)

# Permanent read-only CI coverage.
path = '.github/workflows/repository-validation.yml'
text = read(path)
anchor = "      - name: Generated PWA freshness\n        run: node scripts/build-precache.mjs --check\n"
addition = "      - name: UI de-explanation regressions\n        run: |\n          node tests/loadout-shortage-confirmation.test.mjs\n          node tests/loadout-workstation.test.mjs\n          node tests/launch-selector.test.mjs\n          node tests/launch-pointer-lifecycle.test.mjs\n          node tests/ui-symbols.test.mjs\n      - name: Generated PWA freshness\n        run: node scripts/build-precache.mjs --check\n"
text = replace_once(text, anchor, addition, 'repository validation UI tests')
write(path, text)
