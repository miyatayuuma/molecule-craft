from pathlib import Path
p=Path('src/veil/map.js')
text=p.read_text()
old="currents.push({id:'hydrogen-revisit-current',route,width:HYDROGEN_REVISIT_ROUTE.current.width,force:HYDROGEN_REVISIT_ROUTE.current.force,speed:-HYDROGEN_REVISIT_ROUTE.current.force});"
new="currents.push({id:'hydrogen-revisit-current',route:revisit,width:HYDROGEN_REVISIT_ROUTE.current.width,force:HYDROGEN_REVISIT_ROUTE.current.force,speed:-HYDROGEN_REVISIT_ROUTE.current.force});"
if old not in text: raise SystemExit('H revisit current anchor missing')
p.write_text(text.replace(old,new,1))
