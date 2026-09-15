import fs from 'node:fs';

function replaceOnce(source,from,to,label){
  const first=source.indexOf(from);
  if(first<0)throw new Error(`Missing patch anchor: ${label}`);
  if(source.indexOf(from,first+from.length)>=0)throw new Error(`Ambiguous patch anchor: ${label}`);
  return source.slice(0,first)+to+source.slice(first+from.length);
}

const oxygenPath='src/veil/oxygen-routes.js';
let oxygen=fs.readFileSync(oxygenPath,'utf8');
oxygen=replaceOnce(oxygen,
`  mergeRecovery:Object.freeze({x:120,y:-10800,radius:330,top:-10640,bottom:-10900}),\n  deepProfiles:Object.freeze({`,
`  mergeRecovery:Object.freeze({x:120,y:-10800,radius:330,top:-10640,bottom:-10900}),\n  // Final CHO approach: a broad heat/reverse-flow wall. H2O makes sustained\n  // DRIVE the intended solution; an expert can still spend PULSE and use short\n  // DRIVE windows on the center line instead of meeting a recipe hard gate.\n  frontierWall:Object.freeze({\n    top:-11880,bottom:-12560,coreHalfWidth:150,fadeHalfWidth:320,\n    routePressure:330,offRoutePressure:500,combustionHeatFactor:1.4,maxHeat:50,pulsePressureMultiplier:1.45,\n    centerTop:Object.freeze({x:100,y:-11880}),centerBottom:Object.freeze({x:280,y:-12470}),\n    heatStops:freezeStops([[-11880,0],[-11960,50],[-12490,50],[-12560,0]]),\n  }),\n  deepProfiles:Object.freeze({`,
'frontier wall config');
oxygen=replaceOnce(oxygen,
`function mergeRecoveryAt(p){\n  const recovery=OXYGEN_THERMAL.mergeRecovery;\n  return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y<=recovery.top&&p.y>=recovery.bottom&&Math.hypot(p.x-recovery.x,p.y-recovery.y)<=recovery.radius;\n}\nexport function deepOxygenFrontierRecoveryAt(p){`,
`function mergeRecoveryAt(p){\n  const recovery=OXYGEN_THERMAL.mergeRecovery;\n  return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.y<=recovery.top&&p.y>=recovery.bottom&&Math.hypot(p.x-recovery.x,p.y-recovery.y)<=recovery.radius;\n}\nfunction frontierWallCenterXAtY(y){\n  const wall=OXYGEN_THERMAL.frontierWall;if(!Number.isFinite(y)||y>wall.top||y<wall.bottom)return null;\n  const a=wall.centerTop,b=wall.centerBottom;if(y<=b.y)return b.x;\n  const t=clamp((a.y-y)/(a.y-b.y),0,1);return a.x+(b.x-a.x)*t;\n}\nfunction frontierWallLateral(p){\n  const wall=OXYGEN_THERMAL.frontierWall,center=frontierWallCenterXAtY(p?.y);if(center===null||!Number.isFinite(p?.x))return 0;\n  const distance=Math.abs(p.x-center);if(distance<=wall.coreHalfWidth)return 1;if(distance>=wall.fadeHalfWidth)return 0;\n  return 1-smoothstep((distance-wall.coreHalfWidth)/(wall.fadeHalfWidth-wall.coreHalfWidth));\n}\nfunction frontierWallPressureAt(p){\n  const wall=OXYGEN_THERMAL.frontierWall,heat=profileAtY(wall.heatStops,p?.y);if(heat<=0)return null;\n  const lateral=frontierWallLateral(p),target=wall.offRoutePressure-(wall.offRoutePressure-wall.routePressure)*lateral;\n  return target*clamp(heat/wall.maxHeat,0,1);\n}\nexport function deepOxygenFrontierRecoveryAt(p){`,
'frontier wall helpers');
oxygen=replaceOnce(oxygen,
`  const belt=OXYGEN_THERMAL.sharedBelt,beltRecovery=beltRecoveryAt(p);\n  const beltHeat=beltRecovery?0:profileAtY(belt.heatStops,p.y)*beltLateral(p,belt);\n  const mergeRecovery=mergeRecoveryAt(p),frontierRecovery=deepOxygenFrontierRecoveryAt(p),recovery=mergeRecovery||frontierRecovery;`,
`  const belt=OXYGEN_THERMAL.sharedBelt,beltRecovery=beltRecoveryAt(p);\n  const beltHeat=beltRecovery?0:profileAtY(belt.heatStops,p.y)*beltLateral(p,belt);\n  const wall=OXYGEN_THERMAL.frontierWall,frontierWallHeat=profileAtY(wall.heatStops,p.y),frontierWallPressure=frontierWallPressureAt(p)??0,frontierWallPulsePressure=frontierWallPressure*Math.max(0,wall.pulsePressureMultiplier-1);\n  const mergeRecovery=mergeRecoveryAt(p),frontierRecovery=deepOxygenFrontierRecoveryAt(p),recovery=mergeRecovery||frontierRecovery;`,
'frontier wall heat');
oxygen=replaceOnce(oxygen,
`  const heat=Math.max(routeHeat,beltHeat,deepHeat),networkFactor=.71*clamp(routeHeat/48,0,1),beltFactor=routeHeat>0?0:belt.combustionHeatFactor*clamp(beltHeat/belt.maxHeat,0,1),deepFactor=3*clamp(deepThermalHeat/48,0,1);\n  const coolantLearning=!recovery&&Math.max(routeHeat,beltHeat)>=OXYGEN_THERMAL.learningHeat;\n  return {heat,routeHeat,beltHeat,deepHeat,deepThermalHeat,recovery,beltRecovery,mergeRecovery,frontierRecovery,coolantLearning,intensity:clamp(heat/48,0,1),combustionHeatFactor:1+Math.max(networkFactor,beltFactor,deepFactor)};`,
`  const heat=Math.max(routeHeat,beltHeat,deepHeat,frontierWallHeat),networkFactor=.71*clamp(routeHeat/48,0,1),beltFactor=routeHeat>0?0:belt.combustionHeatFactor*clamp(beltHeat/belt.maxHeat,0,1),deepFactor=3*clamp(deepThermalHeat/48,0,1),frontierWallFactor=wall.combustionHeatFactor*clamp(frontierWallHeat/wall.maxHeat,0,1);\n  const coolantLearning=!recovery&&Math.max(routeHeat,beltHeat,frontierWallHeat)>=OXYGEN_THERMAL.learningHeat;\n  return {heat,routeHeat,beltHeat,deepHeat,deepThermalHeat,frontierWallHeat,frontierWallPressure,frontierWallPulsePressure,recovery,beltRecovery,mergeRecovery,frontierRecovery,coolantLearning,intensity:clamp(heat/48,0,1),combustionHeatFactor:1+Math.max(networkFactor,beltFactor,deepFactor,frontierWallFactor)};`,
'frontier wall thermal integration');
fs.writeFileSync(oxygenPath,oxygen);

const universePath='src/veil/universe.js';
let universe=fs.readFileSync(universePath,'utf8');
universe=replaceOnce(universe,
`  const basePressure=routePressure??outer*255+pressureBand*310,baseFlowX=recovering?0:challenge?.flowX??(oxygenRoutePressure!==null?0:oxygen*(1-coolEddy)*Math.sin(time*1.7+p.y*.008)*48),revisitCurrent=revisitCurrentAt(map,p);\n  const oxygenAmbient=oxygen*(1-coolEddy)*3,environmentHeat=Math.max(thermal.heat,oxygenAmbient*(recovering?.2:1));\n  return {pressure:basePressure+vortex.y,flowX:baseFlowX+vortex.x+revisitCurrent.x,flowY:revisitCurrent.y,currentIntensity:revisitCurrent.intensity,traversableRoutePressure:oxygenRoutePressure,heat:Math.max(challenge?.heat??0,environmentHeat),combustionHeatFactor:thermal.combustionHeatFactor,coolantLearning:thermal.coolantLearning,intensity:thermal.intensity,eddy:coolEddy,vortex:vortex.intensity};`,
`  const basePressure=(routePressure??outer*255+pressureBand*310)+(thermal.frontierWallPressure??0),baseFlowX=recovering?0:challenge?.flowX??(oxygenRoutePressure!==null?0:oxygen*(1-coolEddy)*Math.sin(time*1.7+p.y*.008)*48),revisitCurrent=revisitCurrentAt(map,p);\n  const oxygenAmbient=oxygen*(1-coolEddy)*3,environmentHeat=Math.max(thermal.heat,oxygenAmbient*(recovering?.2:1));\n  return {pressure:basePressure+vortex.y,flowX:baseFlowX+vortex.x+revisitCurrent.x,flowY:revisitCurrent.y,currentIntensity:revisitCurrent.intensity,traversableRoutePressure:oxygenRoutePressure,frontierWallPressure:thermal.frontierWallPressure??0,frontierWallPulsePressure:thermal.frontierWallPulsePressure??0,heat:Math.max(challenge?.heat??0,environmentHeat),combustionHeatFactor:thermal.combustionHeatFactor,coolantLearning:thermal.coolantLearning,intensity:thermal.intensity,eddy:coolEddy,vortex:vortex.intensity};`,
'frontier wall physical pressure');
fs.writeFileSync(universePath,universe);

const enginePath='src/veil/engine.js';
let engine=fs.readFileSync(enginePath,'utf8');
engine=replaceOnce(engine,
`  const routePressure=environment?.traversableRoutePressure,movementEnvironment=Number.isFinite(routePressure)?{...environment,pressure:environment.pressure-routePressure}:environment;\n  const force={x:0,y:Number.isFinite(routePressure)?routePressure:0};`,
`  const routePressure=environment?.traversableRoutePressure,pulseWallPressure=p.boost>0?(environment?.frontierWallPulsePressure??0):0,movementEnvironment=Number.isFinite(routePressure)?{...environment,pressure:environment.pressure-routePressure+pulseWallPressure}:pulseWallPressure?{...environment,pressure:environment.pressure+pulseWallPressure}:environment;\n  const force={x:0,y:Number.isFinite(routePressure)?routePressure:0};`,
'frontier wall PULSE pressure');
fs.writeFileSync(enginePath,engine);

const growthPath='src/veil/growth.js';
let growth=fs.readFileSync(growthPath,'utf8');
growth=replaceOnce(growth,
`  if(!state.progress.frontier)return {text:'CH₄とO₂を充填して酸素の奥へ。水で冷却するか静かな渦で休もう。CO₂は反復噴射の選択肢。'};`,
`  if(!state.progress.frontier)return {text:'H₂Oを冷却剤に積み、酸素最深部の熱・逆風帯を越えよう。BURSTは緊急突破に残そう。'};`,
'frontier growth goal');
fs.writeFileSync(growthPath,growth);

const testPath='tests/oxygen-thermal-progression.test.mjs';
let test=fs.readFileSync(testPath,'utf8');
test=replaceOnce(test,
`const mergeHeat=environmentAt({x:120,y:-10800}).heat,deepWarm=environmentAt({x:180,y:-11200}).heat,challengeHeat=environmentAt({x:760,y:-11300}).heat,frontierHeat=environmentAt({x:100,y:-11920}).heat;`,
`const mergeHeat=environmentAt({x:120,y:-10800}).heat,deepWarm=environmentAt({x:180,y:-11200}).heat,challengeHeat=environmentAt({x:760,y:-11300}).heat,frontierHeat=environmentAt({x:140,y:-12020}).heat;`,
'frontier thermal sample');
test=replaceOnce(test,
`assert.ok(frontierHeat<5,'Deep thermal handoff fades before Frontier');`,
`assert.equal(frontierHeat,50,'Frontier approach now carries the shared thermal wall before CHO completion');`,
'frontier thermal assertion');
fs.writeFileSync(testPath,test);