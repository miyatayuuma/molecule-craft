from pathlib import Path

ui=Path('src/collection-ui.js')
s=ui.read_text()
old="""  function preview(record,name){
    const host=el('div',null,'collection-model');installDetailGraphReturn(host,record,name);detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
"""
new="""  function preview(record,name,{graphReturn=false}={}){
    const host=el('div',null,'collection-model');if(graphReturn)installDetailGraphReturn(host,record,name);detail.appendChild(host);host.appendChild(el('p','模型を準備しています…','model-status'));
"""
if old not in s: raise SystemExit('preview graph-return anchor missing')
s=s.replace(old,new,1)
old="preview(record,moleculeDisplayName(record));"
new="preview(record,moleculeDisplayName(record),{graphReturn:true});"
if old not in s: raise SystemExit('molecule preview call anchor missing')
s=s.replace(old,new,1)
ui.write_text(s)

test=Path('tests/encyclopedia-graph-ui.test.mjs')
s=test.read_text()
anchor="assert.match(collectionUISource,/returnMoleculeDetailToGraph/);\n"
insert="assert.match(collectionUISource,/function preview\\(record,name,\\{graphReturn=false\\}=\\{\\}\\)/,'shared preview defaults to no Graph return');\nassert.match(collectionUISource,/preview\\(record,moleculeDisplayName\\(record\\),\\{graphReturn:true\\}\\)/,'only molecule Detail opts into Graph return');\n"
if anchor not in s: raise SystemExit('test transition anchor missing')
s=s.replace(anchor,anchor+insert,1)
test.write_text(s)
