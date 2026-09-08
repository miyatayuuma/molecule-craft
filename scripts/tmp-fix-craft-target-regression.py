from pathlib import Path
import re

root=Path('.')

app=root/'src/app.js'
s=app.read_text()
s=s.replace("pulse(`${ELEMENTS[symbol].name}を置きました`);return atom;","pulse(`${ELEMENTS[symbol].name}を置きました`);")
s=s.replace("refresh();pulse(`${template.nameJa}を置きました`);return expanded;","refresh();pulse(`${template.nameJa}を置きました`);return true;")
old="""function placeTargetPart(item){
  if(!item?.targetKey||targetDeployments.has(item.targetKey))return false;
  let ids;
  if(item.partId){const expanded=addCraftPart(item.partId);if(!expanded)return false;ids=expanded.ids;}
  else{const atom=addElement(item.element);if(!atom)return false;ids=[atom.id];}
  targetDeployments.set(item.targetKey,new Set(ids));refreshInfo();return true;
}"""
new="""function placeTargetPart(item){
  if(!item?.targetKey||targetDeployments.has(item.targetKey))return false;
  const before=new Set(molecule.atoms.map(atom=>atom.id));
  if(item.partId){if(!addCraftPart(item.partId))return false;}else addElement(item.element);
  const ids=molecule.atoms.filter(atom=>!before.has(atom.id)).map(atom=>atom.id);if(!ids.length)return false;
  targetDeployments.set(item.targetKey,new Set(ids));refreshInfo();return true;
}"""
assert old in s
s=s.replace(old,new)
app.write_text(s)

styles=root/'styles.css'
s=styles.read_text()
marker='/* Unified craft target strip. */'
assert marker in s
s=s[:s.index(marker)] + r'''/* Unified craft target strip. Keep this as the single final target-bar layout layer. */
.craft-target{flex:none;display:grid;grid-template-columns:auto minmax(72px,auto) minmax(0,1fr) auto;grid-template-rows:1fr 1fr;align-items:center;column-gap:9px;row-gap:0;min-height:64px;overflow:hidden;padding:8px 14px;border-bottom:1px solid #315263;background:#102735;color:#d7f4f7}
.craft-target .craft-emblem{grid-column:1;grid-row:1/3;align-self:center;width:25px;height:25px;overflow:visible;filter:drop-shadow(0 0 5px #75dfce38)}
.craft-target .craft-emblem path{fill:none;stroke:#75dfce;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.craft-target .craft-emblem-a{fill:#e9f4f9}.craft-target .craft-emblem-b{fill:#67d9c7}.craft-target .craft-emblem-c{fill:#ed7f82}
.craft-target-meta{grid-column:2;grid-row:1/3;display:flex;min-width:72px;max-width:150px;flex-direction:column;align-items:flex-start;justify-content:center;gap:1px;overflow:hidden}
.craft-target .craft-target-meta #craft-target-formula{display:block;max-width:100%;color:#8fe0df;font-size:14px;font-weight:750;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.craft-target .craft-target-meta #craft-target-name{display:block;max-width:100%;color:#a9c4ce;font-size:10px;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.craft-target .craft-target-atoms{grid-column:3;grid-row:1/3;display:flex;flex:none;flex-wrap:nowrap;width:100%;height:48px;min-width:0;margin:0;align-items:center;gap:6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
.craft-target .craft-target-atoms::-webkit-scrollbar{display:none}
.craft-target-part{position:relative;display:grid;place-items:center;flex:0 0 72px;width:72px;height:46px;min-width:72px;min-height:46px;padding:0;overflow:hidden;border:1px solid #4b7a76;border-radius:12px;background:#102b34;color:#f3fffd;font-size:11px;isolation:isolate}
.craft-target-part:hover{background:#173c43}
.craft-target-part-model{position:absolute;z-index:0;left:50%;top:50%;width:72px;height:48px;object-fit:cover;transform:translate(-50%,-50%) scale(1.35);filter:drop-shadow(0 2px 4px #0008);pointer-events:none;user-select:none}
.craft-target-part-formula{position:relative;z-index:1;display:block;max-width:66px;padding:1px 3px;color:#f7ffff;font-size:11px;font-weight:850;line-height:1.1;letter-spacing:-.02em;text-align:center;text-shadow:0 1px 2px #02070aff,0 0 5px #02070aff;white-space:nowrap;pointer-events:none}
.craft-target-part-formula[data-long="true"]{font-size:9px;letter-spacing:-.05em}
.craft-target>button#clear-craft-target{grid-column:4;grid-row:1/3;align-self:center;flex:none;min-width:34px;min-height:34px;margin:0;padding:3px 8px;background:transparent;border-color:#365968;font-size:18px}
@media(max-width:430px){.craft-target{grid-template-columns:auto minmax(58px,auto) minmax(0,1fr) auto;column-gap:6px;min-height:62px;padding:8px 10px}.craft-target-meta{min-width:58px;max-width:105px;align-items:flex-start}.craft-target .craft-target-meta #craft-target-formula{font-size:13px}.craft-target .craft-target-meta #craft-target-name{font-size:9px}.craft-target-part{flex-basis:66px;width:66px;min-width:66px}.craft-target-part-model{width:68px}.craft-target-part-formula{max-width:61px;font-size:10px}}
'''
styles.write_text(s)

index=root/'index.html'
s=index.read_text().replace('styles.css?v=41','styles.css?v=42').replace('src/app.js?v=46','src/app.js?v=47')
index.write_text(s)

contracts=root/'tests/source-contracts.test.mjs'
s=contracts.read_text().replace("src/app.js?v=46","src/app.js?v=47").replace(r'app\.js\?v=46',r'app\.js\?v=47').replace(r'styles\.css\?v=41',r'styles\.css\?v=42').replace("assert.match(app, /return expanded;/);","assert.doesNotMatch(app, /return expanded;/);\nassert.match(app, /return true;/);")
contracts.write_text(s)
