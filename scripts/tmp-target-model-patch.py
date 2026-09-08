from pathlib import Path

panel = Path('src/craft-panel.js')
text = panel.read_text()
old = """    if(item.partId){\n      const template=item.template,chip=container.ownerDocument.createElement('button');chip.type='button';chip.className='craft-target-part';chip.dataset.partId=item.partId;chip.textContent=template?.notation??template?.label??item.partId;chip.setAttribute('aria-label',`${template?.nameJa??chip.textContent}をクラフト台へ出す`);chip.style.cssText='display:inline-grid;place-items:center;flex:0 0 auto;min-height:31px;padding:0 9px;border:1px solid #4b7a76;border-radius:10px;background:#173b40;color:#bdf2e8;font-size:11px;font-weight:800;line-height:1;white-space:nowrap;';chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;\n    }\n"""
new = """    if(item.partId){\n      const template=item.template,chip=container.ownerDocument.createElement('button'),model=container.ownerDocument.createElement('img'),formula=container.ownerDocument.createElement('strong');\n      chip.type='button';chip.className='craft-target-part';chip.dataset.partId=item.partId;\n      model.className='craft-target-part-model';model.alt='';model.src=new URL(`../assets/models/part-${item.partId}.svg`,import.meta.url).href;model.addEventListener('error',()=>{model.hidden=true;},{once:true});\n      const notation=String(template?.notation??template?.label??item.partId).replace(/^[\\s–—-]+|[\\s–—-]+$/g,'')||item.partId;formula.className='craft-target-part-formula';formula.textContent=notation;\n      chip.setAttribute('aria-label',`${template?.nameJa??notation}をクラフト台へ出す`);chip.append(model,formula);chip.addEventListener('click',()=>onPlace(item));container.appendChild(chip);rendered.push({item,node:chip,slot:null});continue;\n    }\n"""
if old not in text:
    raise SystemExit('craft target part anchor missing')
text = text.replace(old, new, 1)
# Slightly enlarge target atoms too so atom and part shortcuts share one visual scale.
text = text.replace("renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms)", "renderCraftTargetParts(nodes.targetAtoms,targetParts,placedAtoms,{size:36,onPlace:onPlaceTargetPart}):renderCraftTargetAtoms(nodes.targetAtoms,record,placedAtoms,{size:36})", 1)
panel.write_text(text)

styles = Path('styles.css')
css = styles.read_text()
marker = '/* Craft target model parts. */'
if marker in css:
    raise SystemExit('target model styles already present')
css += """\n\n/* Craft target model parts. */\n.craft-target{min-height:60px;padding-top:8px;padding-bottom:8px}\n.craft-target .craft-target-atoms{height:46px;align-items:center}\n.craft-target-part{position:relative;display:grid;place-items:center;flex:0 0 72px;width:72px;height:46px;min-height:46px;padding:0;overflow:hidden;border:1px solid #4b7a76;border-radius:12px;background:#102b34;color:#f3fffd;isolation:isolate}\n.craft-target-part:hover{background:#173c43}\n.craft-target-part-model{position:absolute;z-index:0;left:50%;top:50%;width:72px;height:48px;object-fit:cover;transform:translate(-50%,-50%) scale(1.35);filter:drop-shadow(0 2px 4px #0008);pointer-events:none;user-select:none}\n.craft-target-part-formula{position:relative;z-index:1;max-width:66px;padding:1px 3px;color:#f7ffff;font-size:11px;font-weight:850;line-height:1.1;letter-spacing:-.02em;text-align:center;text-shadow:0 1px 2px #02070aff,0 0 5px #02070aff;white-space:nowrap;pointer-events:none}\n@media(max-width:430px){.craft-target{min-height:58px}.craft-target-part{flex-basis:66px;width:66px}.craft-target-part-model{width:68px}.craft-target-part-formula{max-width:61px;font-size:10px}}\n"""
styles.write_text(css)

index = Path('index.html')
html = index.read_text()
if 'styles.css?v=39' in html:
    html = html.replace('styles.css?v=39', 'styles.css?v=40', 1)
elif 'styles.css?v=40' not in html:
    raise SystemExit('styles version anchor missing')
index.write_text(html)

contracts = Path('tests/source-contracts.test.mjs')
source = contracts.read_text()
anchor = "assert.match(craftPanel, /onPlaceTargetPart/);"
addition = anchor + "\nassert.match(craftPanel, /part-\\$\\{item\\.partId\\}\\.svg/);\nassert.match(craftPanel, /craft-target-part-formula/);\nassert.match(index, /styles\\.css\\?v=40/);"
if anchor not in source:
    raise SystemExit('source contract anchor missing')
source = source.replace(anchor, addition, 1)
contracts.write_text(source)
