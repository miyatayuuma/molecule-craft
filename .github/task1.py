from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"missing replacement anchor in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1))


replace('src/veil/map.js', """export const HYDROGEN_REVISIT_ROUTE=Object.freeze({
  id:'hydrogen-revisit',label:'H revisit pocket',classification:'G0 / G1',densityTier:'very-high',revisit:true,
  knots:freezeKnots([[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]),spacing:20,lanes:3,value:VEIL.dustValue*2,
});
""", """export const HYDROGEN_REVISIT_ROUTE=Object.freeze({
  id:'hydrogen-revisit',label:'H revisit loop',classification:'G0 / G1',densityTier:'local-pocket',revisit:true,
  knots:freezeKnots([[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]),spacing:30,lanes:1,value:VEIL.dustValue,
  current:Object.freeze({width:180,force:90}),
});
export const HYDROGEN_REVISIT_POCKET=Object.freeze({
  id:'hydrogen-revisit-pocket',x:-900,y:-2700,radius:72,particles:50,value:2,primary:'H',secondary:'C',
});
""")

replace('src/veil/map.js', """export function createMap(seed=1,stock={}){
  const rng=random(seed),denseChoice=Math.floor(rng()*3),hDepletion=inventoryDepletion(stock,'H'),routes=DEFINITIONS.map(([id,label,knots,kind])=>{
""", """export function createMap(seed=1,stock={},{capabilities={}}={}){
  const rng=random(seed),denseChoice=Math.floor(rng()*3),hDepletion=inventoryDepletion(stock,'H'),depletion={H:hDepletion,C:inventoryDepletion(stock,'C'),O:inventoryDepletion(stock,'O')},revisitUnlocked=capabilities.combustionDrive===true,routes=DEFINITIONS.filter(([id])=>id!==HYDROGEN_REVISIT_ROUTE.id||revisitUnlocked).map(([id,label,knots,kind])=>{
""")

replace('src/veil/map.js', """    return {id,label,kind,points:revisit?sampleAuthoredLine(knots,profile.spacing):sampleLine(knots,kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing),revisit,densityTier:profile?.densityTier,classification:profile?.classification,spacing:profile?.spacing,lanes:profile?.lanes,value:profile?.value};
""", """    return {id,label,kind,points:revisit?sampleAuthoredLine(knots,profile.spacing):sampleLine(knots,kind==='dense'?VEIL.denseSpacing:VEIL.dustSpacing),revisit,densityTier:profile?.densityTier,classification:profile?.classification,spacing:profile?.spacing,lanes:profile?.lanes,value:profile?.value,width:profile?.current?.width};
""")

replace('src/veil/map.js', """  if(rng()<VEIL.rareChance){const route=routes.find(r=>r.id==='technical'),p=route.points[Math.floor(route.points.length*.6)];dust.push({...p,id:dust.length,route:route.id,kind:'rare',value:VEIL.rareValue*VEIL.dustPerH,ready:0});}
""", """  const revisit=routes.find(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),currents=[];
  if(revisit){
    currents.push({id:'hydrogen-revisit-current',route,width:HYDROGEN_REVISIT_ROUTE.current.width,force:HYDROGEN_REVISIT_ROUTE.current.force,speed:-HYDROGEN_REVISIT_ROUTE.current.force});
    const pocket=HYDROGEN_REVISIT_POCKET;
    for(let i=0;i<pocket.particles;i++){
      const element=i%5===0?pocket.secondary:pocket.primary;
      if(!keepDepletedSegment(depletion[element]??0,seed^0x52f4a3,`${pocket.id}:${element}`,i,{optional:true}))continue;
      const angle=i*2.399963,radius=Math.sqrt((i+.5)/pocket.particles)*pocket.radius,x=pocket.x+Math.cos(angle)*radius,y=pocket.y+Math.sin(angle)*radius;
      dust.push({id:dust.length,x,y,angle:-Math.PI/2,route:pocket.id,element,kind:element==='C'?'carbon':'normal',value:pocket.value,ready:0,pocket:pocket.id});
    }
  }
  if(rng()<VEIL.rareChance){const route=routes.find(r=>r.id==='technical'),p=route.points[Math.floor(route.points.length*.6)];dust.push({...p,id:dust.length,route:route.id,kind:'rare',value:VEIL.rareValue*VEIL.dustPerH,ready:0});}
""")

replace('src/veil/map.js', """  const revisit=routes.find(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),anchor=revisit?.points[Math.floor((revisit?.points.length??1)*.55)];
  if(anchor)labels.push({x:anchor.x,y:anchor.y,text:`${revisit.id} · ${revisit.densityTier} H · spacing ${revisit.spacing} / lanes ${revisit.lanes} / value ${revisit.value}`});
  return {seed,routes,dust,depletion:{H:hDepletion,C:inventoryDepletion(stock,'C'),O:inventoryDepletion(stock,'O')},fields:[{x:470+(rng()-.5)*80,y:-1700+(rng()-.5)*100,radius:VEIL.fieldRadius,phase:rng()*4,angle:.15}],labels};
""", """  const anchor=revisit?.points[Math.floor((revisit?.points.length??1)*.55)];
  if(anchor)labels.push({x:anchor.x,y:anchor.y,text:`${revisit.id} · post-DRIVE current ${HYDROGEN_REVISIT_ROUTE.current.force} · local H pocket`});
  return {seed,routes,dust,depletion,currents,capabilities:{combustionDrive:revisitUnlocked},fields:[{x:470+(rng()-.5)*80,y:-1700+(rng()-.5)*100,radius:VEIL.fieldRadius,phase:rng()*4,angle:.15}],labels};
""")

replace('src/veil/universe.js', """import { createMap, sampleAuthoredLine, sampleLine, random, keepDepletedSegment } from './map.js';
import { GROWTH } from './growth.js';
""", """import { createMap, sampleAuthoredLine, sampleLine, random, keepDepletedSegment } from './map.js';
import { routeFlowAt } from './route-kit.js';
import { GROWTH } from './growth.js';
""")

replace('src/veil/universe.js', """export const CARBON_REVISIT_ROUTE=Object.freeze({
  id:'carbon-revisit',label:'C revisit pocket',classification:'G0 / G1',densityTier:'very-high',revisit:true,
  knots:freezeKnots([[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]),spacing:22,lanes:3,value:GROWTH.density.carbon.value,
});
""", """export const CARBON_REVISIT_ROUTE=Object.freeze({
  id:'carbon-revisit',label:'C revisit loop',classification:'G0 / G1',densityTier:'local-pocket',revisit:true,
  knots:freezeKnots([[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]),spacing:30,lanes:1,value:GROWTH.density.carbon.value,
  current:Object.freeze({width:180,force:90}),
});
export const CARBON_REVISIT_POCKET=Object.freeze({
  id:'carbon-revisit-pocket',x:980,y:-6300,radius:78,particles:50,value:2,primary:'C',secondary:'H',
});
""")

replace('src/veil/universe.js', """export function createUniverse(seed=1,stock={},{harvestLayout=OXYGEN_HARVEST}={}){
  if(!Number.isFinite(harvestLayout.sideSpacing)||harvestLayout.sideSpacing<0||!Number.isInteger(harvestLayout.eddyAtoms)||harvestLayout.eddyAtoms<0||harvestLayout.eddyAtoms>1000)throw Error('Invalid oxygen harvest layout');
  const map=createMap(seed,stock),rng=random(seed^0x5ca1ab1e);map.universe=true;map.clusters=[];map.signals=[];
""", """export function createUniverse(seed=1,stock={},{harvestLayout=OXYGEN_HARVEST,capabilities={}}={}){
  if(!Number.isFinite(harvestLayout.sideSpacing)||harvestLayout.sideSpacing<0||!Number.isInteger(harvestLayout.eddyAtoms)||harvestLayout.eddyAtoms<0||harvestLayout.eddyAtoms>1000)throw Error('Invalid oxygen harvest layout');
  const revisitUnlocked=capabilities.combustionDrive===true,map=createMap(seed,stock,{capabilities}),rng=random(seed^0x5ca1ab1e);map.universe=true;map.clusters=[];map.signals=[];
""")

replace('src/veil/universe.js', """  for(const d of (map.depletion.H?createMap(seed):map).dust)if(d.shoulder)shoulders.set(key(d),[(rng()-.5)*13,(rng()-.5)*16]);
  for(const d of map.dust){d.element='H';if(d.shoulder){const noise=shoulders.get(key(d));d.x+=noise[0];d.y+=noise[1];}}
  for(const [id,label,knots,element]of ROUTES){
    const networkRoute=OXYGEN_ROUTES.find(route=>route.id===id),deepRoute=DEEP_OXYGEN_ROUTES.find(route=>route.id===id),authored=networkRoute??deepRoute,deep=!!deepRoute,frontier=id==='horizon',carbonRevisit=id===CARBON_REVISIT_ROUTE.id;
""", """  for(const d of (map.depletion.H?createMap(seed,{}, {capabilities}):map).dust)if(d.shoulder)shoulders.set(key(d),[(rng()-.5)*13,(rng()-.5)*16]);
  for(const d of map.dust){d.element??='H';if(d.shoulder){const noise=shoulders.get(key(d));d.x+=noise[0];d.y+=noise[1];}}
  for(const [id,label,knots,element]of ROUTES){
    const networkRoute=OXYGEN_ROUTES.find(route=>route.id===id),deepRoute=DEEP_OXYGEN_ROUTES.find(route=>route.id===id),authored=networkRoute??deepRoute,deep=!!deepRoute,frontier=id==='horizon',carbonRevisit=id===CARBON_REVISIT_ROUTE.id;
    if(carbonRevisit&&!revisitUnlocked)continue;
""")

replace('src/veil/universe.js', """    const route={id,label,element:geometry?null:element,sourceElement:element,kind:geometry?'field-flow':undefined,points,geometry,visual:geometry?{kind:'field-flow',color:'#8fc8d5',fieldLines:geometry.fieldLines,particleSpeed:.18}:null,routeDepletion:map.depletion[element]??0,lanes:activeLaneCount(profile.lanes,map.depletion[element]??0),authoredLanes:profile.lanes,spacing:profile.spacing,value:profile.value,optional:OPTIONAL_ROUTES.has(id),revisit:carbonRevisit,densityTier:carbonRevisit?CARBON_REVISIT_ROUTE.densityTier:undefined,classification:carbonRevisit?CARBON_REVISIT_ROUTE.classification:undefined};map.routes.push(route);
    const routeDepletion=map.depletion[element]??0,lanes=route.lanes,routeRng=carbonRevisit?random(seed^0x43a9d7b1):rng;
""", """    const route={id,label,element:geometry?null:element,sourceElement:element,kind:geometry?'field-flow':undefined,points,geometry,visual:geometry?{kind:'field-flow',color:'#8fc8d5',fieldLines:geometry.fieldLines,particleSpeed:.18}:null,routeDepletion:map.depletion[element]??0,lanes:activeLaneCount(profile.lanes,map.depletion[element]??0),authoredLanes:profile.lanes,spacing:profile.spacing,value:profile.value,optional:OPTIONAL_ROUTES.has(id),revisit:carbonRevisit,densityTier:carbonRevisit?CARBON_REVISIT_ROUTE.densityTier:undefined,classification:carbonRevisit?CARBON_REVISIT_ROUTE.classification:undefined};map.routes.push(route);
    if(carbonRevisit)map.currents.push({id:'carbon-revisit-current',route,width:CARBON_REVISIT_ROUTE.current.width,force:CARBON_REVISIT_ROUTE.current.force,speed:-CARBON_REVISIT_ROUTE.current.force});
    const routeDepletion=map.depletion[element]??0,lanes=route.lanes,routeRng=carbonRevisit?random(seed^0x43a9d7b1):rng;
""")

replace('src/veil/universe.js', """  // Orbiting O particles are both the distant cue and the provisional reward.
""", """  if(revisitUnlocked){
    const pocket=CARBON_REVISIT_POCKET;
    for(let i=0;i<pocket.particles;i++){
      const element=i%5===0?pocket.secondary:pocket.primary;
      if(!keepDepletedSegment(map.depletion[element]??0,seed^0x63c2d1,`${pocket.id}:${element}`,i,{optional:true}))continue;
      const angle=i*2.399963,radius=Math.sqrt((i+.5)/pocket.particles)*pocket.radius,x=pocket.x+Math.cos(angle)*radius,y=pocket.y+Math.sin(angle)*radius;
      map.dust.push({id:map.dust.length,x,y,angle:-Math.PI/2,route:pocket.id,element,kind:element==='C'?'carbon':'normal',value:pocket.value,ready:0,pocket:pocket.id});
    }
  }
  // Orbiting O particles are both the distant cue and the provisional reward.
""")

replace('src/veil/universe.js', """  const carbonRevisit=map.routes.find(route=>route.id===CARBON_REVISIT_ROUTE.id),carbonAnchor=carbonRevisit?.points[Math.floor((carbonRevisit?.points.length??1)*.48)];
  if(carbonAnchor)map.labels.push({x:carbonAnchor.x,y:carbonAnchor.y,text:`${carbonRevisit.id} · ${carbonRevisit.densityTier} C · spacing ${carbonRevisit.spacing} / lanes ${carbonRevisit.authoredLanes} / value ${carbonRevisit.value}`});
""", """  const carbonRevisit=map.routes.find(route=>route.id===CARBON_REVISIT_ROUTE.id),carbonAnchor=carbonRevisit?.points[Math.floor((carbonRevisit?.points.length??1)*.48)];
  if(carbonAnchor)map.labels.push({x:carbonAnchor.x,y:carbonAnchor.y,text:`${carbonRevisit.id} · post-DRIVE current ${CARBON_REVISIT_ROUTE.current.force} · local C pocket`});
""")

replace('src/veil/universe.js', """function band(y,top,bottom,fade){return clamp(Math.min((y-top)/fade,(bottom-y)/fade),0,1);}
export function environmentAt(p,time=0){
""", """function band(y,top,bottom,fade){return clamp(Math.min((y-top)/fade,(bottom-y)/fade),0,1);}
function revisitCurrentAt(map,p){
  let x=0,y=0,intensity=0;
  for(const current of map?.currents??[]){
    const flow=routeFlowAt(current.route,p,{speed:current.speed,radius:current.width/2});x+=flow.x;y+=flow.y;intensity=Math.max(intensity,flow.intensity);
  }
  return {x,y,intensity};
}
export function environmentAt(p,time=0,map=null){
""")

replace('src/veil/universe.js', """  const basePressure=routePressure??outer*255+pressureBand*310,baseFlowX=recovering?0:challenge?.flowX??(oxygenRoutePressure!==null?0:oxygen*(1-coolEddy)*Math.sin(time*1.7+p.y*.008)*48);
  const oxygenAmbient=oxygen*(1-coolEddy)*3,environmentHeat=Math.max(thermal.heat,oxygenAmbient*(recovering?.2:1));
  return {pressure:basePressure+vortex.y,flowX:baseFlowX+vortex.x,traversableRoutePressure:oxygenRoutePressure,heat:Math.max(challenge?.heat??0,environmentHeat),combustionHeatFactor:thermal.combustionHeatFactor,coolantLearning:thermal.coolantLearning,intensity:thermal.intensity,eddy:coolEddy,vortex:vortex.intensity};
""", """  const basePressure=routePressure??outer*255+pressureBand*310,baseFlowX=recovering?0:challenge?.flowX??(oxygenRoutePressure!==null?0:oxygen*(1-coolEddy)*Math.sin(time*1.7+p.y*.008)*48),revisitCurrent=revisitCurrentAt(map,p);
  const oxygenAmbient=oxygen*(1-coolEddy)*3,environmentHeat=Math.max(thermal.heat,oxygenAmbient*(recovering?.2:1));
  return {pressure:basePressure+vortex.y,flowX:baseFlowX+vortex.x+revisitCurrent.x,flowY:revisitCurrent.y,currentIntensity:revisitCurrent.intensity,traversableRoutePressure:oxygenRoutePressure,heat:Math.max(challenge?.heat??0,environmentHeat),combustionHeatFactor:thermal.combustionHeatFactor,coolantLearning:thermal.coolantLearning,intensity:thermal.intensity,eddy:coolEddy,vortex:vortex.intensity};
""")

replace('src/veil/engine.js', """  p.x=clamp(p.x+(p.vx+fx*resistance+(environment?.flowX??0))*dt,c.bounds.left,c.bounds.right);
  p.y=clamp(p.y+(p.vy+fy*resistance+(environment?.pressure??0))*dt,c.bounds.top,c.bounds.bottom);
""", """  p.x=clamp(p.x+(p.vx+fx*resistance+(environment?.flowX??0))*dt,c.bounds.left,c.bounds.right);
  p.y=clamp(p.y+(p.vy+fy*resistance+(environment?.pressure??0)+(environment?.flowY??0))*dt,c.bounds.top,c.bounds.bottom);
""")
replace('src/veil/engine.js', """  const environment=map.universe?environmentAt(p,run.time):null;
""", """  const environment=map.universe?environmentAt(p,run.time,map):null;
""")

replace('src/veil/ui.js', """import { DRIVES, MOLECULE_USES, REGIONS, flightConfig, growthGoal, propulsionGauge, propulsionSpeedMax } from './growth.js';
""", """import { DRIVES, MOLECULE_USES, REGIONS, driveAvailable, flightConfig, growthGoal, propulsionGauge, propulsionSpeedMax } from './growth.js';
""")
replace('src/veil/ui.js', """    createRun:({prepared})=>createRun(createUniverse(prepared.seed,resources.state.elements),flightConfig(resources.state),{fuel:prepared.fuel}),
""", """    createRun:({prepared})=>createRun(createUniverse(prepared.seed,resources.state.elements,{capabilities:{combustionDrive:driveAvailable(resources.state,'combustion')}}),flightConfig(resources.state),{fuel:prepared.fuel}),
""")

replace('scripts/export-field-map.mjs', """function routeCenterlinesSvg(universe){
  return universe.routes.map(route=>`<path id=\"route-${escapeXml(route.id)}\" data-route=\"${escapeXml(route.id)}\" data-element=\"${escapeXml(route.sourceElement??route.element??'H')}\" d=\"${pointPath(route.points)}\"/>`).join('\\n');
}
""", """function routeCenterlinesSvg(universe){
  return universe.routes.map(route=>`<path id=\"route-${escapeXml(route.id)}\" data-route=\"${escapeXml(route.id)}\" data-element=\"${escapeXml(route.sourceElement??route.element??'H')}\" d=\"${pointPath(route.points)}\"/>`).join('\\n');
}
function revisitDeltaSvg(universe){
  const routes=universe.routes.filter(route=>route.revisit),parts=['<metadata>post-DRIVE derived geometry; baseline remains pre-DRIVE</metadata>'];
  for(const route of routes)parts.push(`<path id=\"post-drive-route-${escapeXml(route.id)}\" data-revisit-route=\"${escapeXml(route.id)}\" d=\"${pointPath(route.points)}\"/>`);
  for(const current of universe.currents??[])parts.push(`<path data-revisit-current=\"${escapeXml(current.id)}\" data-force=\"${fmt(current.force)}\" data-width=\"${fmt(current.width)}\" d=\"${pointPath(current.route.points)}\"/>`);
  for(const id of ['hydrogen-revisit-pocket','carbon-revisit-pocket']){
    const dust=universe.dust.filter(item=>item.route===id),h=dust.filter(item=>item.element==='H'),c=dust.filter(item=>item.element==='C');
    parts.push(`<g data-revisit-pocket=\"${id}\" data-h-count=\"${h.length}\" data-c-count=\"${c.length}\"><path data-element=\"H\" d=\"${dustPath(h)}\"/><path data-element=\"C\" d=\"${dustPath(c)}\"/></g>`);
  }
  return parts.join('\\n');
}
""")

replace('scripts/export-field-map.mjs', """    `baseline: createUniverse(${BASELINE_SEED}, {H:0,C:0,O:0})`,
""", """    `baseline: createUniverse(${BASELINE_SEED}, {H:0,C:0,O:0}) · pre-DRIVE`,
    'post-DRIVE H/C revisit geometry is shown only in the dedicated delta layer',
""")

replace('scripts/export-field-map.mjs', """export function buildFieldMapSvg(){
  const config=flightConfig(),bounds=GROWTH.bounds,universe=createUniverse(BASELINE_SEED,{...BASELINE_STOCK});
""", """export function buildFieldMapSvg(){
  const config=flightConfig(),bounds=GROWTH.bounds,universe=createUniverse(BASELINE_SEED,{...BASELINE_STOCK}),postDriveUniverse=createUniverse(BASELINE_SEED,{...BASELINE_STOCK},{capabilities:{combustionDrive:true}});
""")

replace('scripts/export-field-map.mjs', """<metadata id=\"field-map-metadata\">baseline-seed=${BASELINE_SEED}; stock=H0,C0,O0; source-bounds=GROWTH.bounds; procedural element positions are a deterministic baseline snapshot, not invariant authored positions; DUST EATER has no authored map position; RETURN has no fixed world position.</metadata>\\n<style>""", """<metadata id=\"field-map-metadata\">baseline-seed=${BASELINE_SEED}; stock=H0,C0,O0; progression=pre-DRIVE baseline + post-DRIVE H/C delta; source-bounds=GROWTH.bounds; procedural element positions are a deterministic baseline snapshot, not invariant authored positions; DUST EATER has no authored map position; RETURN has no fixed world position.</metadata>\\n<style>""")

replace('scripts/export-field-map.mjs', """#layer-regions rect{opacity:.075}#playable-bounds rect{fill:none;stroke:#e7edf2;stroke-width:8}#route-centerlines path{fill:none;stroke:#b7c3ce;stroke-width:5;opacity:.72}#route-centerlines [data-element=\"H\"]{stroke:#8bc8dc}#route-centerlines [data-element=\"C\"]{stroke:#c7a676}#route-centerlines [data-element=\"O\"]{stroke:#d7a4a4}#route-widths rect""", """#layer-regions rect{opacity:.075}#playable-bounds rect{fill:none;stroke:#e7edf2;stroke-width:8}#route-centerlines path{fill:none;stroke:#b7c3ce;stroke-width:5;opacity:.72}#route-centerlines [data-element=\"H\"]{stroke:#8bc8dc}#route-centerlines [data-element=\"C\"]{stroke:#c7a676}#route-centerlines [data-element=\"O\"]{stroke:#d7a4a4}#layer-revisit-post-drive [data-revisit-route]{fill:none;stroke:#a7f0c5;stroke-width:8;stroke-dasharray:24 12}#layer-revisit-post-drive [data-revisit-current]{fill:none;stroke:#6fe3c5;stroke-opacity:.16;stroke-linecap:round}#layer-revisit-post-drive [data-revisit-pocket] path{fill:none;stroke-linecap:round;stroke-width:8}#layer-revisit-post-drive [data-revisit-pocket] [data-element=\"H\"]{stroke:#79d2ee}#layer-revisit-post-drive [data-revisit-pocket] [data-element=\"C\"]{stroke:#c79a62}#route-widths rect""")

replace('scripts/export-field-map.mjs', """${layer('layer-geometry','geometry',geometry)}\\n${layer('layer-elements-h','elements H',elementLayer(universe,'H'))}""", """${layer('layer-geometry','geometry',geometry)}\\n${layer('layer-revisit-post-drive','post-DRIVE H/C revisit delta',revisitDeltaSvg(postDriveUniverse))}\\n${layer('layer-elements-h','elements H',elementLayer(universe,'H'))}""")

replace('tests/field-map-export.test.mjs', """  'layer-grid','layer-regions','layer-geometry','playable-bounds','route-centerlines','route-widths','authored-gates',
""", """  'layer-grid','layer-regions','layer-geometry','layer-revisit-post-drive','playable-bounds','route-centerlines','route-widths','authored-gates',
""")

replace('tests/hc-revisit-routes.test.mjs', """import {DRIVES,flightConfig} from '../src/veil/growth.js';
import {HYDROGEN_REVISIT_ROUTE,createMap} from '../src/veil/map.js';
import {
  CARBON_DEEP_Y,CARBON_REVISIT_ROUTE,ENVIRONMENT_RECOVERY_CONTRACT,FIELD_SIGNALS,createUniverse,environmentAt,
} from '../src/veil/universe.js';
""", """import {DRIVES,driveAvailable,flightConfig} from '../src/veil/growth.js';
import {HYDROGEN_REVISIT_POCKET,HYDROGEN_REVISIT_ROUTE,createMap} from '../src/veil/map.js';
import {
  CARBON_DEEP_Y,CARBON_REVISIT_POCKET,CARBON_REVISIT_ROUTE,ENVIRONMENT_RECOVERY_CONTRACT,FIELD_SIGNALS,createUniverse,environmentAt,
} from '../src/veil/universe.js';
""")

start = Path('tests/hc-revisit-routes.test.mjs').read_text()
first = start.index("test('H/C revisit geometry is exact")
end = start.index("test('recovery is environmental only", first)
replacement = r"""test('H/C revisit geometry is derived from persistent COMBUSTION DRIVE availability',()=>{
  assert.deepEqual(HYDROGEN_REVISIT_ROUTE.knots,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  assert.deepEqual(CARBON_REVISIT_ROUTE.knots,[[840,-5540],[1080,-6000],[980,-6500],[650,-6900],[170,-7190]]);
  const preH=createMap(1,{H:0,C:0,O:0}),pre=createUniverse(1,{H:0,C:0,O:0});
  for(const map of [preH,pre]){
    assert.equal(routeBy(map,'hydrogen-revisit'),undefined);
    assert.equal(routeBy(map,'carbon-revisit'),undefined);
    assert.equal(map.dust.some(dust=>dust.route?.includes('revisit')),false);
    assert.equal((map.currents??[]).some(current=>current.id.includes('revisit')),false);
    assert.equal(map.labels.some(label=>label.text.includes('revisit')),false);
  }
  const state={recipes:['hydrogen','methane','oxygen']};
  assert.equal(driveAvailable({recipes:['hydrogen','methane']},'combustion'),false);
  assert.equal(driveAvailable(state,'combustion'),true);
  const reloaded=JSON.parse(JSON.stringify(state));
  assert.equal(driveAvailable(reloaded,'combustion'),true,'reload-equivalent persistent recipe state derives the same unlock');
  const capabilities={combustionDrive:driveAvailable(reloaded,'combustion')};
  const hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  const h=routeBy(hMap,'hydrogen-revisit'),c=routeBy(universe,'carbon-revisit');
  assert.ok(h&&c,'both revisit loops appear after COMBUSTION DRIVE is available');
  assert.ok(distance(h.points[0],HYDROGEN_REVISIT_ROUTE.knots[0])<=1&&distance(h.points.at(-1),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=1);
  assert.ok(distance(c.points[0],CARBON_REVISIT_ROUTE.knots[0])<=1&&distance(c.points.at(-1),CARBON_REVISIT_ROUTE.knots.at(-1))<=1);
  assert.ok(nearest(routeBy(hMap,'safe'),HYDROGEN_REVISIT_ROUTE.knots[0])<=31);
  assert.ok(nearest(routeBy(hMap,'detour'),HYDROGEN_REVISIT_ROUTE.knots.at(-1))<=31);
  assert.ok(nearest(routeBy(universe,'carbon-sweep'),CARBON_REVISIT_ROUTE.knots[0])<=31);
  assert.ok(nearest(routeBy(universe,'carbon-main'),CARBON_REVISIT_ROUTE.knots.at(-1))<=31);
  assert.equal(hMap.currents.find(current=>current.id==='hydrogen-revisit-current')?.force,90);
  assert.equal(universe.currents.find(current=>current.id==='carbon-revisit-current')?.force,90);
  assert.ok(environmentAt(h.points[Math.floor(h.points.length/2)],0,hMap).currentIntensity>0);
  assert.ok(environmentAt(c.points[Math.floor(c.points.length/2)],0,universe).currentIntensity>0);
  assert.equal(driveAvailable({...state,loadout:{}},'combustion'),true,'removing the current LOADOUT cannot relock geometry');
});

test('revisit resource reward is local, composition-specific, and stock-depleted independently of geometry',()=>{
  const capabilities={combustionDrive:true};
  const hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  const hPocket=hMap.dust.filter(dust=>dust.route===HYDROGEN_REVISIT_POCKET.id),cPocket=universe.dust.filter(dust=>dust.route===CARBON_REVISIT_POCKET.id);
  const sum=(dust,element)=>dust.filter(item=>item.element===element).reduce((total,item)=>total+item.value,0);
  assert.ok(sum(hPocket,'H')>sum(hPocket,'C')*3,'H revisit pocket is H-dominant');
  assert.ok(sum(cPocket,'C')>sum(cPocket,'H')*3,'C revisit pocket is C-dominant');
  assert.ok(hPocket.every(dust=>Math.hypot(dust.x-HYDROGEN_REVISIT_POCKET.x,dust.y-HYDROGEN_REVISIT_POCKET.y)<=HYDROGEN_REVISIT_POCKET.radius+1));
  assert.ok(cPocket.every(dust=>Math.hypot(dust.x-CARBON_REVISIT_POCKET.x,dust.y-CARBON_REVISIT_POCKET.y)<=CARBON_REVISIT_POCKET.radius+1));
  const highH=createMap(1,{H:800,C:400,O:0},{capabilities}),highC=createUniverse(1,{H:800,C:400,O:0},{capabilities});
  assert.ok(routeBy(highH,'hydrogen-revisit')&&routeBy(highC,'carbon-revisit'),'stock depletion never removes unlocked geometry');
  assert.ok(highH.currents.some(current=>current.id==='hydrogen-revisit-current')&&highC.currents.some(current=>current.id==='carbon-revisit-current'),'stock depletion never removes unlocked current');
  assert.ok(highH.dust.filter(dust=>dust.route===HYDROGEN_REVISIT_POCKET.id).length<hPocket.length);
  assert.ok(highC.dust.filter(dust=>dust.route===CARBON_REVISIT_POCKET.id).length<cPocket.length);
});

function traverseRoute(map,route,{drive=false,maxSeconds=45}={}){
  const config=flightConfig(),player=createFlight(config),dt=1/60,points=route.points;
  Object.assign(player,{x:points[0].x,y:points[0].y,angle:points[0].angle,vx:0,vy:0,speed:config.driftSpeed});
  let index=1;
  for(let frame=0;frame<maxSeconds/dt;frame++){
    const target=points[Math.min(index,points.length-1)],dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy);
    if(d<24){if(index===points.length-1)return frame*dt;index=Math.min(points.length-1,index+3);continue;}
    player.drive=drive?DRIVES.combustion:null;player.combustion=drive;
    moveFlight(player,{x:dx/d,y:dy/d},dt,{config,environment:environmentAt(player,frame*dt,map)});
  }
  return Infinity;
}

test('revisit currents stay skill-traversable while COMBUSTION DRIVE is materially faster',()=>{
  const capabilities={combustionDrive:true},hMap=createMap(1,{H:0,C:0,O:0},{capabilities}),universe=createUniverse(1,{H:0,C:0,O:0},{capabilities});
  for(const [map,id] of [[hMap,'hydrogen-revisit'],[universe,'carbon-revisit']]){
    const route=routeBy(map,id),normal=traverseRoute(map,route),drive=traverseRoute(map,route,{drive:true});
    assert.ok(Number.isFinite(normal),`${id} normal propulsion must complete`);
    assert.ok(drive<normal*.7,`${id} DRIVE should be at least 30% faster (${drive.toFixed(2)}s vs ${normal.toFixed(2)}s)`);
    assert.equal(route.requiredCapability,undefined);assert.equal(route.requires,undefined);
  }
});

"""
Path('tests/hc-revisit-routes.test.mjs').write_text(start[:first] + replacement + start[end:])

replace('tests/hc-revisit-routes.test.mjs', """  const svg=buildFieldMapSvg();
  assert.match(svg,/id=\"route-hydrogen-revisit\"/);
  assert.match(svg,/id=\"route-carbon-revisit\"/);
  assert.match(svg,/hydrogen-revisit · very-high H · spacing 20 \\/ lanes 3 \\/ value 2/);
  assert.match(svg,/carbon-revisit · very-high C · spacing 22 \\/ lanes 3 \\/ value 1/);
""", """  const svg=buildFieldMapSvg();
  assert.doesNotMatch(svg,/id=\"route-hydrogen-revisit\"/,'pre-DRIVE baseline must not contain H revisit');
  assert.doesNotMatch(svg,/id=\"route-carbon-revisit\"/,'pre-DRIVE baseline must not contain C revisit');
  assert.match(svg,/id=\"post-drive-route-hydrogen-revisit\"/);
  assert.match(svg,/id=\"post-drive-route-carbon-revisit\"/);
  assert.match(svg,/data-revisit-current=\"hydrogen-revisit-current\" data-force=\"90\" data-width=\"180\"/);
  assert.match(svg,/data-revisit-current=\"carbon-revisit-current\" data-force=\"90\" data-width=\"180\"/);
  assert.match(svg,/data-revisit-pocket=\"hydrogen-revisit-pocket\"/);
  assert.match(svg,/data-revisit-pocket=\"carbon-revisit-pocket\"/);
""")

h = Path('tests/h-economy-balance.test.mjs').read_text()
first = h.index("test('H revisit fixes")
end = h.index("test('phase demand separates", first)
replacement = r"""test('H revisit is a post-DRIVE local recovery pocket rather than fresh-save farm geometry',()=>{
  assert.deepEqual(HYDROGEN_REVISIT_ROUTE.knots,[[-520,-2200],[-930,-2450],[-850,-2950],[-800,-3090]]);
  const pre=createMap(SEED,{H:0,C:0,O:0});
  assert.equal(pre.routes.some(route=>route.id===HYDROGEN_REVISIT_ROUTE.id),false);
  const capabilities={combustionDrive:true},map=createMap(SEED,{H:0,C:0,O:0},{capabilities}),route=map.routes.find(item=>item.id===HYDROGEN_REVISIT_ROUTE.id),pocket=map.dust.filter(item=>item.route==='hydrogen-revisit-pocket');
  assert.ok(route&&pocket.length>0);
  const hUnits=pocket.filter(item=>item.element==='H').reduce((sum,item)=>sum+item.value,0),cUnits=pocket.filter(item=>item.element==='C').reduce((sum,item)=>sum+item.value,0);
  assert.ok(hUnits>cUnits*3,'localized revisit reward stays H-dominant');
  const ordinary=Math.max(...['safe','detour'].map(id=>{const candidate=map.routes.find(item=>item.id===id);return normalizedAtoms(routeUnits(map,id),routeLength(candidate));}));
  const revisitLine=normalizedAtoms(routeUnits(map,HYDROGEN_REVISIT_ROUTE.id),routeLength(route));
  assert.ok(revisitLine<=ordinary*1.2,'route-wide dust is no longer the high-density reward');
  const highStock=createMap(SEED,{H:800,C:400,O:0},{capabilities});
  assert.ok(highStock.routes.some(item=>item.id===HYDROGEN_REVISIT_ROUTE.id));
  assert.ok(highStock.currents.some(current=>current.id==='hydrogen-revisit-current'));
  assert.equal(highStock.dust.filter(item=>item.route==='hydrogen-revisit-pocket').length,0,'high stock suppresses the optional pocket without relocking terrain');
});

"""
Path('tests/h-economy-balance.test.mjs').write_text(h[:first] + replacement + h[end:])

replace('tests/h-economy-balance.test.mjs', """  const universe=createUniverse(SEED,{H:0,C:0,O:0}),hRevisit=routeUnits(universe,HYDROGEN_REVISIT_ROUTE.id,'H');
""", """  const universe=createUniverse(SEED,{H:0,C:0,O:0},{capabilities:{combustionDrive:true}}),hRevisit=routeUnits(universe,HYDROGEN_REVISIT_ROUTE.id,'H');
""")

print('Task 1 source/test transformations applied')
