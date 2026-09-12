import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {EXPEDITION,VEIL} from '../src/veil/config.js';
import {GROWTH,REGIONS,flightConfig,regionAt} from '../src/veil/growth.js';
import {
  DEEP_OXYGEN_ROUTES,OXYGEN_JUNCTION,OXYGEN_REWARD,OXYGEN_ROUTES,OXYGEN_VORTEX,
  OXYGEN_VORTEX_REWARD,OXYGEN_VORTEX_ROUTE,oxygenPressureAt,oxygenRouteCenterAtY,
} from '../src/veil/oxygen-routes.js';
import {EXPEDITION_CHALLENGES,challengeCenter} from '../src/veil/expedition-challenges.js';
import {CHO_DESTINATION} from '../src/veil/cho-campaign.js';

const ROOT=new URL('../',import.meta.url);
const OUTPUT_URL=new URL('docs/maps/current-field.svg',ROOT);
const BASELINE_SEED=1;
const BASELINE_STOCK=Object.freeze({H:0,C:0,O:0});
const THERMAL_STEP=50;
const PRESSURE_STEP=50;
const NS='http://www.inkscape.org/namespaces/inkscape';

const fmt=value=>{
  if(!Number.isFinite(value))throw new TypeError(`Non-finite SVG coordinate: ${value}`);
  const rounded=Math.round(value*1000)/1000;
  return Object.is(rounded,-0)?'0':String(rounded);
};
const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const attrs=values=>Object.entries(values).filter(([,value])=>value!==undefined&&value!==null).map(([key,value])=>`${key}="${escapeXml(value)}"`).join(' ');
const layer=(id,label,body,extra={})=>`<g ${attrs({id,'inkscape:groupmode':'layer','inkscape:label':label,...extra})}>\n${body}\n</g>`;
const pointPath=points=>points.length?`M ${points.map(point=>`${fmt(point.x)} ${fmt(point.y)}`).join(' L ')}`:'';
const dustPath=points=>{
  let previous=null,path='';
  for(const point of points){
    if(!previous)path+=`M${fmt(point.x)} ${fmt(point.y)}h.01`;
    else path+=`m${fmt(point.x-previous.x-.01)} ${fmt(point.y-previous.y)}h.01`;
    previous=point;
  }
  return path;
};
const rectPath=cells=>{
  const runs=[];
  for(const cell of cells){
    const previous=runs.at(-1);
    if(previous&&previous.y===cell.y&&previous.height===cell.height&&previous.x+previous.width===cell.x)previous.width+=cell.width;
    else runs.push({...cell});
  }
  return runs.map(cell=>`M${fmt(cell.x)} ${fmt(cell.y)}h${fmt(cell.width)}v${fmt(cell.height)}h-${fmt(cell.width)}Z`).join('');
};

function regionBands(bounds){
  const bands=[
    {id:'frontier',top:bounds.top,bottom:GROWTH.frontierY},
    {id:'oxygen',top:GROWTH.frontierY,bottom:GROWTH.oxygenY},
    {id:'carbon',top:GROWTH.oxygenY,bottom:GROWTH.carbonY},
    {id:'veil',top:GROWTH.carbonY,bottom:bounds.bottom},
  ];
  for(const band of bands){
    const sample=(band.top+band.bottom)/2;
    if(regionAt(sample)!==band.id)throw new Error(`Region boundary mismatch for ${band.id} at y=${sample}`);
  }
  return bands;
}

function gridSvg(bounds){
  const lines=[],labels=[];
  const startX=Math.ceil(bounds.left/500)*500,endX=Math.floor(bounds.right/500)*500;
  const startY=Math.ceil(bounds.top/500)*500,endY=Math.floor(bounds.bottom/500)*500;
  for(let x=startX;x<=endX;x+=500){
    lines.push(`<line x1="${x}" y1="${bounds.top}" x2="${x}" y2="${bounds.bottom}"/>`);
    labels.push(`<text x="${x+12}" y="${bounds.bottom-28}">x ${x}</text>`);
  }
  for(let y=startY;y<=endY;y+=500){
    lines.push(`<line x1="${bounds.left}" y1="${y}" x2="${bounds.right}" y2="${y}"/>`);
    labels.push(`<text x="${bounds.left+18}" y="${y-12}">y ${y}</text>`);
  }
  return [
    '<g class="major-grid">',...lines,'</g>',
    '<g class="grid-labels">',...labels,'</g>',
    `<line class="axis" x1="0" y1="${bounds.top}" x2="0" y2="${bounds.bottom}"/>`,
    `<line class="axis" x1="${bounds.left}" y1="0" x2="${bounds.right}" y2="0"/>`,
    '<circle class="origin" cx="0" cy="0" r="18"/>',
    '<text class="axis-label" x="28" y="-28">origin (0,0)</text>',
  ].join('\n');
}

function regionSvg(bounds){
  const fills={frontier:'#b98bc8',oxygen:'#6fa7c7',carbon:'#c9a36b',veil:'#91a0ad'};
  return regionBands(bounds).map(band=>{
    const height=band.bottom-band.top;
    return `<g data-region="${band.id}" data-top="${band.top}" data-bottom="${band.bottom}"><rect x="${bounds.left}" y="${band.top}" width="${bounds.right-bounds.left}" height="${height}" fill="${fills[band.id]}"/><text class="region-label" x="${bounds.left+55}" y="${band.top+90}">${band.id.toUpperCase()}</text></g>`;
  }).join('\n');
}

function routeCenterlinesSvg(universe){
  return universe.routes.map(route=>`<path id="route-${escapeXml(route.id)}" data-route="${escapeXml(route.id)}" data-element="${escapeXml(route.sourceElement??route.element??'H')}" d="${pointPath(route.points)}"/>`).join('\n');
}

function routeWidthsSvg(){
  const routePaths=[...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES].map(route=>`<path data-route-width="${route.id}" d="${pointPath(route.knots.map(([x,y])=>({x,y})))}" stroke-width="${fmt(route.width)}"/>`);
  const vortex=`<path data-route-width="${OXYGEN_VORTEX_ROUTE.id}" d="${pointPath(OXYGEN_VORTEX_ROUTE.points)}" stroke-width="${fmt(OXYGEN_VORTEX_ROUTE.width)}"/>`;
  return [...routePaths,vortex].join('\n');
}

function authoredGatesSvg(){
  const h=VEIL.gate;
  const parts=[
    `<rect id="h-boundary-current" data-gate="h-boundary" x="${fmt(h.x-h.width/2)}" y="${fmt(h.y-h.height)}" width="${fmt(h.width)}" height="${fmt(h.height*2)}"/>`,
    `<line id="h-boundary-crossing-line" x1="${fmt(h.x-h.width/2)}" y1="${fmt(h.y-50)}" x2="${fmt(h.x+h.width/2)}" y2="${fmt(h.y-50)}"/>`,
  ];
  for(const route of OXYGEN_ROUTES)for(const [index,gate] of (route.gates??[]).entries()){
    const centerX=oxygenRouteCenterAtY(route,gate.y)??route.x;
    parts.push(`<rect data-pressure-gate="${route.id}:${index}" data-pressure="${gate.pressure}" x="${fmt(centerX-route.width/2)}" y="${fmt(gate.y-gate.depth/2)}" width="${fmt(route.width)}" height="${fmt(gate.depth)}"/>`);
  }
  return parts.join('\n');
}

function elementLayer(universe,element){
  const points=universe.dust.filter(dust=>(dust.element??'H')===element);
  return `<metadata>deterministic baseline snapshot: createUniverse(1, {H:0,C:0,O:0}); not invariant authored positions</metadata>\n<path class="element element-${element.toLowerCase()}" data-element="${element}" data-count="${points.length}" d="${dustPath(points)}"/>`;
}

function mapFieldsSvg(universe){
  return universe.fields.map((field,index)=>`<circle data-map-field="${index}" data-angle="${fmt(field.angle??0)}" cx="${fmt(field.x)}" cy="${fmt(field.y)}" r="${fmt(field.radius)}"/>`).join('\n');
}

function sampledPressureSvg(bounds){
  const buckets=Array.from({length:10},()=>[]),samples=[];
  for(let y=-10850;y<-8700;y+=PRESSURE_STEP){
    for(let x=bounds.left;x<bounds.right;x+=PRESSURE_STEP){
      const point={x:x+PRESSURE_STEP/2,y:y+PRESSURE_STEP/2},pressure=oxygenPressureAt(point);
      if(pressure>0)samples.push({x,y,width:PRESSURE_STEP,height:PRESSURE_STEP,value:pressure});
    }
  }
  const max=Math.max(0,...samples.map(sample=>sample.value));
  for(const sample of samples){const index=Math.min(9,Math.max(0,Math.ceil(sample.value/max*10)-1));buckets[index].push(sample);}
  return buckets.map((cells,index)=>cells.length?`<path data-pressure-bin="${index+1}" fill-opacity="${fmt(.08+(index+1)*.045)}" d="${rectPath(cells)}"/>`:'').filter(Boolean).join('\n');
}

function challengeSvg(){
  return EXPEDITION_CHALLENGES.map(zone=>{
    const ys=[];for(let y=zone.top;y<zone.bottom;y+=25)ys.push(y);ys.push(zone.bottom);
    const left=ys.map(y=>({x:challengeCenter(zone,y)-zone.width,y}));
    const right=[...ys].reverse().map(y=>({x:challengeCenter(zone,y)+zone.width,y}));
    const polygon=[...left,...right];
    return `<path data-challenge="${zone.id}" data-anchor-x="${zone.centerX}" data-anchor-y="${zone.centerY}" data-half-width="${zone.width}" data-full-width="${zone.width*2}" d="${pointPath(polygon)} Z"/>`;
  }).join('\n');
}

function vortexSvg(){
  return [
    `<circle data-vortex="influence" cx="${OXYGEN_VORTEX.center.x}" cy="${OXYGEN_VORTEX.center.y}" r="${OXYGEN_VORTEX.influenceRadius}"/>`,
    `<circle data-vortex="outer" cx="${OXYGEN_VORTEX.center.x}" cy="${OXYGEN_VORTEX.center.y}" r="${OXYGEN_VORTEX.outerRadius}"/>`,
    `<circle data-vortex="core" cx="${OXYGEN_VORTEX.center.x}" cy="${OXYGEN_VORTEX.center.y}" r="${OXYGEN_VORTEX.coreRadius}"/>`,
    `<circle data-vortex="reward" cx="${OXYGEN_VORTEX_REWARD.x}" cy="${OXYGEN_VORTEX_REWARD.y}" r="${OXYGEN_VORTEX_REWARD.radius}"/>`,
  ].join('\n');
}

function thermalSvg(bounds){
  const samples=[];
  for(let y=bounds.top;y<bounds.bottom;y+=THERMAL_STEP){
    for(let x=bounds.left;x<bounds.right;x+=THERMAL_STEP){
      const width=Math.min(THERMAL_STEP,bounds.right-x),height=Math.min(THERMAL_STEP,bounds.bottom-y);
      const heat=environmentAt({x:x+width/2,y:y+height/2},0).heat;
      if(heat>0)samples.push({x,y,width,height,heat});
    }
  }
  const max=Math.max(0,...samples.map(sample=>sample.heat)),buckets=Array.from({length:12},()=>[]);
  for(const sample of samples){const index=Math.min(11,Math.max(0,Math.ceil(sample.heat/max*12)-1));buckets[index].push(sample);}
  return [`<metadata>sample=${THERMAL_STEP} world units; source=environmentAt(point, 0); environment heat != player thermal state; max-sampled-heat=${fmt(max)}</metadata>`,...buckets.map((cells,index)=>cells.length?`<path data-heat-bin="${index+1}" fill-opacity="${fmt(.035+(index+1)*.035)}" d="${rectPath(cells)}"/>`:'').filter(Boolean)].join('\n');
}

function routeDensitySvg(){
  const tiers={
    'oxygen-shortcut':'low-medium','oxygen-main':'medium-stable','oxygen-side':'high',
    'oxygen-deep-safe':'medium','oxygen-deep-skill':'medium-high','oxygen-deep-thermal':'high-very-high',
  };
  return [...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES].map(route=>{
    const y=route.id.startsWith('oxygen-deep-')?-11340:-10100,x=oxygenRouteCenterAtY(route,y)??route.x;
    return `<g data-density-route="${route.id}" data-density-tier="${tiers[route.id]}" data-spacing="${route.spacing??20}" data-lanes="${route.lanes}" data-value="${route.value}"><text x="${fmt(x+30)}" y="${fmt(y-28)}">${escapeXml(route.id)} · ${tiers[route.id]} · spacing ${route.spacing??20} / lanes ${route.lanes} / value ${route.value}</text></g>`;
  }).join('\n');
}

function gameplaySvg(universe,config){
  const checkpoints=Object.entries(REGIONS).map(([id,region])=>`<g data-checkpoint="${id}"><circle cx="${region.x}" cy="${region.y}" r="26"/><text x="${region.x+38}" y="${region.y-18}">${escapeXml(region.name)} restart (${region.x},${region.y})</text></g>`).join('\n');
  const restStops=OXYGEN_ROUTES.flatMap(route=>(route.restStops??[]).map(stop=>{
    const centerX=stop.x??oxygenRouteCenterAtY(route,stop.y)??route.x;
    return `<rect data-rest-stop="${route.id}" x="${fmt(centerX-route.width/2)}" y="${fmt(stop.y-stop.depth/2)}" width="${route.width}" height="${stop.depth}"/>`;
  })).join('\n');
  const signals=`<metadata>seeded runtime positions; data-anchor-* are authored FIELD_SIGNALS points; jitter is deterministic and capped at +/-30 world units</metadata>\n${universe.signals.map(signal=>`<g data-signal="${signal.id}" data-region="${signal.region}" data-complexity="${signal.complexity??''}" data-anchor-x="${signal.anchorX}" data-anchor-y="${signal.anchorY}" data-jitter-x="${fmt(signal.x-signal.anchorX)}" data-jitter-y="${fmt(signal.y-signal.anchorY)}"><circle cx="${fmt(signal.x)}" cy="${fmt(signal.y)}" r="22"/><text x="${fmt(signal.x+35)}" y="${fmt(signal.y-18)}">${escapeXml(signal.complexity??signal.region)} signal baseline</text></g>`).join('\n')}`;
  return [
    layer('spawn','spawn',`<circle id="field-spawn" cx="${config.spawn.x}" cy="${config.spawn.y}" r="34"/><text x="${config.spawn.x+45}" y="${config.spawn.y-24}">FIELD spawn (${config.spawn.x},${config.spawn.y})</text>`),
    layer('checkpoints','checkpoints',checkpoints),
    layer('gates','gates',`<circle id="h-boundary-gate-marker" data-marker="gate-center-label" cx="${VEIL.gate.x}" cy="${VEIL.gate.y}" r="28"/><text x="${VEIL.gate.x+42}" y="${VEIL.gate.y-20}">H boundary gate center</text>`),
    layer('junctions','junctions',`<circle id="oxygen-junction" cx="${OXYGEN_JUNCTION.x}" cy="${OXYGEN_JUNCTION.y}" r="28"/><text x="${OXYGEN_JUNCTION.x+40}" y="${OXYGEN_JUNCTION.y-20}">Oxygen junction</text>`),
    layer('rest-stops','rest stops',restStops),
    layer('rewards','rewards',`<circle id="oxygen-reward" cx="${OXYGEN_REWARD.x}" cy="${OXYGEN_REWARD.y}" r="${OXYGEN_REWARD.radius}"/><circle id="vortex-reward" cx="${OXYGEN_VORTEX_REWARD.x}" cy="${OXYGEN_VORTEX_REWARD.y}" r="${OXYGEN_VORTEX_REWARD.radius}"/>`),
    layer('signals','signals',signals),
    layer('route-density','route density',routeDensitySvg()),
    layer('destination','destination',`<circle id="cho-destination" data-radius="${CHO_DESTINATION.radius}" cx="${CHO_DESTINATION.x}" cy="${CHO_DESTINATION.y}" r="${CHO_DESTINATION.radius}"/><text x="${CHO_DESTINATION.x+120}" y="${CHO_DESTINATION.y-35}">${escapeXml(CHO_DESTINATION.label)} (${CHO_DESTINATION.x},${CHO_DESTINATION.y})</text>`),
  ].join('\n');
}

function labelsSvg(universe){
  return universe.labels.map((label,index)=>`<text data-authored-label="${index}" x="${fmt(label.x)}" y="${fmt(label.y)}">${escapeXml(label.text)}</text>`).join('\n');
}

function legendSvg(bounds,universe){
  const counts=Object.fromEntries(['H','C','O'].map(element=>[element,universe.dust.filter(dust=>(dust.element??'H')===element).length]));
  const lines=[
    'CURRENT FIELD · developer map',
    `bounds: left ${bounds.left} / right ${bounds.right} / top ${bounds.top} / bottom ${bounds.bottom}`,
    `baseline: createUniverse(${BASELINE_SEED}, {H:0,C:0,O:0})`,
    `particles: H ${counts.H} · C ${counts.C} · O ${counts.O}`,
    'element positions are deterministic baseline snapshot, not invariant authored positions',
    `thermal: environmentAt() sampled every ${THERMAL_STEP} world units at time=0`,
    'environment heat != player thermal state',
    'DUST EATER: dynamic pursuit hazard / no authored map position',
    `DUST EATER: safe ${EXPEDITION.safeSeconds}s · spawn distance ${EXPEDITION.eaterSpawnDistance} · thresholds ${EXPEDITION.eaterThresholds.join('/')}`,
    'RETURN: global player action / no fixed world position',
    'checkpoint marks are REGIONS restart anchors, not physical checkpoint objects',
    'Oxygen challenge width in source is half-width; map shows full 2× width',
    'Route density annotations are authored spacing / lanes / value profiles.',
    'No inferred walls/corridor polygons are generated.',
  ];
  return `<rect class="legend-panel" x="1390" y="${bounds.top+70}" width="1450" height="${lines.length*92+100}" rx="24"/>\n${lines.map((line,index)=>`<text class="legend-text ${index===0?'legend-title':''}" x="1450" y="${bounds.top+150+index*92}">${escapeXml(line)}</text>`).join('\n')}`;
}

export function buildFieldMapSvg(){
  const config=flightConfig(),bounds=GROWTH.bounds,universe=createUniverse(BASELINE_SEED,{...BASELINE_STOCK});
  if(config.bounds!==bounds&&JSON.stringify(config.bounds)!==JSON.stringify(bounds))throw new Error('flightConfig bounds diverge from GROWTH.bounds');
  const view={left:bounds.left-100,top:bounds.top-100,right:2950,bottom:bounds.bottom+100};
  const width=view.right-view.left,height=view.bottom-view.top;
  const geometry=[
    layer('playable-bounds','playable bounds',`<rect data-left="${bounds.left}" data-right="${bounds.right}" data-top="${bounds.top}" data-bottom="${bounds.bottom}" x="${bounds.left}" y="${bounds.top}" width="${bounds.right-bounds.left}" height="${bounds.bottom-bounds.top}"/>`),
    layer('route-centerlines','route centerlines',routeCenterlinesSvg(universe)),
    layer('route-widths','route widths',routeWidthsSvg()),
    layer('authored-gates','authored gates',authoredGatesSvg()),
  ].join('\n');
  const gameplay=gameplaySvg(universe,config);
  return `<!-- Generated by scripts/export-field-map.mjs; do not edit. -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="${NS}" viewBox="${view.left} ${view.top} ${width} ${height}" width="900" height="${fmt(900*height/width)}" role="img" aria-labelledby="title desc">\n<title id="title">Molecule Craft current FIELD developer map</title>\n<desc id="desc">Coordinate-faithful deterministic developer map generated from current FIELD source.</desc>\n<metadata id="field-map-metadata">baseline-seed=${BASELINE_SEED}; stock=H0,C0,O0; source-bounds=GROWTH.bounds; procedural element positions are a deterministic baseline snapshot, not invariant authored positions; DUST EATER has no authored map position; RETURN has no fixed world position.</metadata>\n<style>\n.major-grid{stroke:#334151;stroke-width:2;opacity:.34}.grid-labels,.axis-label,.legend-text,.region-label,#layer-labels text,#layer-gameplay text{font:32px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#d9e2ea}.axis{stroke:#91a4b5;stroke-width:5;opacity:.7}.origin{fill:#fff;stroke:#17212b;stroke-width:8}.region-label{font-size:48px;font-weight:700;opacity:.58}.legend-title{font-size:46px;font-weight:800}.legend-panel{fill:#101922;stroke:#617487;stroke-width:4;opacity:.96}\n#layer-regions rect{opacity:.075}#playable-bounds rect{fill:none;stroke:#e7edf2;stroke-width:8}#route-centerlines path{fill:none;stroke:#b7c3ce;stroke-width:5;opacity:.72}#route-centerlines [data-element="H"]{stroke:#8bc8dc}#route-centerlines [data-element="C"]{stroke:#c7a676}#route-centerlines [data-element="O"]{stroke:#d7a4a4}#route-widths rect{fill:#8db6c7;stroke:#a6cad7;stroke-width:2;opacity:.09}#route-widths path{fill:none;stroke:#a6cad7;stroke-linecap:round;stroke-linejoin:round;opacity:.09}#authored-gates rect{fill:#e1b267;stroke:#f1cb88;stroke-width:5;opacity:.25}#authored-gates line{stroke:#ffdb95;stroke-width:9;stroke-dasharray:24 16}\n.element{fill:none;stroke-linecap:round;opacity:.72}.element-h{stroke:#79d2ee;stroke-width:5}.element-c{stroke:#c79a62;stroke-width:7}.element-o{stroke:#e19090;stroke-width:6}#layer-hazards-fields circle{fill:#9f8fd0;stroke:#c0b4ec;stroke-width:4;opacity:.16}#layer-hazards-pressure path{fill:#6f8db7;stroke:none}#layer-hazards-challenges path{fill:#d58a61;stroke:#f0a77e;stroke-width:5;opacity:.17}#layer-hazards-vortex circle{fill:none;stroke:#7ebfca;stroke-width:6;opacity:.42}#layer-hazards-vortex [data-vortex="core"]{fill:#7ebfca;opacity:.18}#layer-thermal path{fill:#e86945;stroke:none}#layer-gameplay circle,#layer-gameplay rect{fill:none;stroke:#f4e1a0;stroke-width:7}#signals circle{stroke:#d5b2ff}#destination circle{stroke:#f2c45b;stroke-width:12}#route-density text{font-size:27px;fill:#d7e6cf;paint-order:stroke;stroke:#101820;stroke-width:8}#layer-labels text{font-size:34px;paint-order:stroke;stroke:#101820;stroke-width:10;stroke-linejoin:round}.annotation{font:30px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#cbd7e1}\n</style>\n${layer('layer-grid','grid',gridSvg(bounds))}\n${layer('layer-regions','regions',regionSvg(bounds),{'data-carbon-y':GROWTH.carbonY,'data-oxygen-y':GROWTH.oxygenY,'data-frontier-y':GROWTH.frontierY})}\n${layer('layer-geometry','geometry',geometry)}\n${layer('layer-elements-h','elements H',elementLayer(universe,'H'))}\n${layer('layer-elements-c','elements C',elementLayer(universe,'C'))}\n${layer('layer-elements-o','elements O',elementLayer(universe,'O'))}\n${layer('layer-hazards-fields','hazards: map fields',mapFieldsSvg(universe))}\n${layer('layer-hazards-pressure','hazards: oxygen pressure',sampledPressureSvg(bounds))}\n${layer('layer-hazards-challenges','hazards: challenges',challengeSvg())}\n${layer('layer-hazards-vortex','hazards: vortex',vortexSvg())}\n${layer('layer-hazards-dust-eater','hazards: DUST EATER','<metadata>DUST EATER: dynamic pursuit hazard / no authored map position</metadata>')}\n${layer('layer-thermal','thermal',thermalSvg(bounds))}\n${layer('layer-gameplay','gameplay points',gameplay)}\n${layer('layer-labels','labels',labelsSvg(universe))}\n${layer('layer-annotations','annotations',`<text class="annotation" x="${bounds.left+40}" y="${bounds.top+55}">Y increases downward exactly as FIELD source coordinates; no axis inversion.</text>\n${legendSvg(bounds,universe)}`)}\n</svg>\n`;
}

export async function exportFieldMap({check=false}={}){
  const svg=buildFieldMapSvg();
  if(check){
    let committed='';
    try{committed=await readFile(OUTPUT_URL,'utf8');}catch(error){if(error?.code!=='ENOENT')throw error;}
    if(committed!==svg){console.error('docs/maps/current-field.svg is stale. Run: node scripts/export-field-map.mjs');process.exitCode=1;return false;}
    console.log('FIELD map is current: docs/maps/current-field.svg');return true;
  }
  await mkdir(dirname(fileURLToPath(OUTPUT_URL)),{recursive:true});
  await writeFile(OUTPUT_URL,svg,'utf8');
  console.log('Wrote docs/maps/current-field.svg');return true;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=new Set(process.argv.slice(2)),unknown=[...args].filter(arg=>arg!=='--check');
  if(unknown.length){console.error(`Unknown argument(s): ${unknown.join(', ')}`);process.exitCode=2;}
  else await exportFieldMap({check:args.has('--check')});
}
