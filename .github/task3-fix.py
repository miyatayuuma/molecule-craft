from pathlib import Path
p=Path('scripts/simulate-oxygen-routes.mjs')
text=p.read_text()
old="""    }else if(!resting&&Math.abs(p.x-route.x)<route.width/2)for(const gate of route.gates){
      if(p.y>gate.y&&p.y<gate.y+gate.depth/2+30)fire();
    }
"""
new="""    }else if(!resting&&Math.abs(p.x-route.x)<route.width/2&&route.gates.length){
      const nextGate=route.gates[Math.min(actualBurstTimes.length,route.gates.length-1)];
      const lookahead=route.id==='oxygen-shortcut'&&actualBurstTimes.length>0?300:nextGate.depth/2+30;
      if(actualBurstTimes.length<route.gates.length&&p.y>nextGate.y&&p.y<nextGate.y+lookahead)fire();
    }
"""
if old not in text: raise SystemExit('canonical BURST policy anchor missing')
p.write_text(text.replace(old,new,1))
