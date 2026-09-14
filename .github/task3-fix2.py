from pathlib import Path
p=Path('tests/oxygen-routes.test.mjs')
text=p.read_text()
text=text.replace("import {createFlight,moveFlight} from '../src/veil/engine.js';", "import {createRun,stepRun} from '../src/veil/engine.js';")
text=text.replace("import {environmentAt} from '../src/veil/universe.js';", "import {createUniverse} from '../src/veil/universe.js';")
old=r'''  const cross=(gate,mode)=>{
    const config=flightConfig(),player=createFlight(config),dt=1/60,startY=gate.y+110,targetY=gate.y-110;
    Object.assign(player,{x:-320,y:startY,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});
    if(mode==='burst'){player.drive=DRIVES.hydrogen;player.boost=DRIVES.hydrogen.boostSeconds;}
    if(mode==='drive'){player.drive=DRIVES.combustion;player.combustion=true;}
    for(let frame=0;frame<8/dt;frame++){
      moveFlight(player,{x:0,y:-1},dt,{config,environment:environmentAt(player,frame*dt)});
      if(player.y<=targetY)return frame*dt;
    }
    return Infinity;
  };
'''
new=r'''  const cross=(gate,mode)=>{
    const config=flightConfig(),dt=1/60,startY=gate.y+110,targetY=gate.y-110;
    const fuel=mode==='drive'?{fuel:{molecule:'methane',amount:18,capacity:18},oxidizer:{molecule:'oxygen',amount:36,capacity:36}}:{};
    const run=createRun(createUniverse(1,{H:0,C:0,O:0}),config,{fuel,predators:false});
    Object.assign(run.player,{x:-320,y:startY,angle:-Math.PI/2,vx:0,vy:-config.speed,speed:config.speed});run.region='oxygen';
    if(mode==='burst'){run.player.drive=DRIVES.hydrogen;run.player.boost=DRIVES.hydrogen.boostSeconds;}
    if(mode==='drive')run.driveHeld=true;
    const systems=mode==='drive'?{consumeCombustion:()=>true}:{};
    for(let frame=0;frame<8/dt;frame++){
      stepRun(run,{x:0,y:-1},dt,systems);
      if(run.player.y<=targetY)return run.time;
    }
    return Infinity;
  };
'''
if old not in text: raise SystemExit('Task 3 local traversal helper anchor missing')
p.write_text(text.replace(old,new,1))
