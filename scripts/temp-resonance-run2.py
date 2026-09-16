from pathlib import Path
source=Path('scripts/temp-resonance-implement.py').read_text()
old="for i,(a,b,_) in enumerate(graph['edges']): graph['nodes'][a][connection_col].append(i); graph['nodes'][b][connection_col].append(i)"
new="for i,(a,b,_) in enumerate(graph['edges']):\n    ai=a if isinstance(a,int) else node_index[a]; bi=b if isinstance(b,int) else node_index[b]\n    graph['nodes'][ai][connection_col].append(i); graph['nodes'][bi][connection_col].append(i)"
if old not in source: raise SystemExit('graph endpoint patch pattern missing')
exec(compile(source.replace(old,new,1),'temp-resonance-implement.py','exec'),{})
