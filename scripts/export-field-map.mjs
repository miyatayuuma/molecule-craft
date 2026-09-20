import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createUniverse,environmentAt} from '../src/veil/universe.js';
import {EXPEDITION,VEIL} from '../src/veil/config.js';
import {GROWTH,REGIONS,flightConfig,regionAt} from '../src/veil/growth.js';
import {
  DEEP_OXYGEN_ROUTES,OXYGEN_JUNCTION,OXYGEN_REWARD,OXYGEN_ROUTES,OXYGEN_VORTEX,
  OXYGEN_VORTEX_REWARD,OXYGEN_VORTEX_ROUTE,oxygenGateEnvelopeAt,oxygenPressureAt,oxygenRouteCenterAtY,
} from '../src/veil/oxygen-routes.js';
import {
  NITROGEN_CORE,NITROGEN_HAZARDS,NITROGEN_HIGH_DENSITY_POCKET,NITROGEN_INSIGHT_AREA,
  NITROGEN_RECOVERY_AREAS,NITROGEN_ROUTE,NITROGEN_ZONES,
} from '../src/veil/nitrogen-routes.js';
import {EXPEDITION_CHALLENGES,challengeCenter,challengeProfileAt,challengeWidthAt} from '../src/veil/expedition-challenges.js';
import {CHO_DESTINATION} from '../src/veil/cho-campaign.js';
import {RARE_ECOLOGY_AREA_CONFIG} from '../src/veil/rare-ecology.js';
import {ABRASIVE_PLUME} from '../src/veil/abrasive-field.js';
import {ELECTRICAL_FIELD} from '../src/veil/electrical-field.js';
import {SAFE_EXTRACTION_SITE} from '../src/veil/map.js';

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
  const bands=[];
  if(bounds.top<GROWTH.nitrogenY)bands.push({id:'nitrogen',top:bounds.top,bottom:GROWTH.nitrogenY});
  bands.push(
    {id:'frontier',top:Math.max(bounds.top,GROWTH.nitrogenY),bottom:GROWTH.frontierY},
    {id:'oxygen',top:GROWTH.frontierY,bottom:GROWTH.oxygenY},
    {id:'carbon',top:GROWTH.oxygenY,bottom:GROWTH.carbonY},
    {id:'veil',top:GROWTH.carbonY,bottom:bounds.bottom},
  );
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
  const fills={nitrogen:'#7082d6',frontier:'#b98bc8',oxygen:'#6fa7c7',carbon:'#c9a36b',veil:'#91a0ad'};
  return regionBands(bounds).map(band=>{
    const height=band.bottom-band.top;
    return `<g data-region="${band.id}" data-top="${band.top}" data-bottom="${band.bottom}"><rect x="${bounds.left}" y="${band.top}" width="${bounds.right-bounds.left}" height="${height}" fill="${fills[band.id]}"/><text class="region-label" x="${bounds.left+55}" y="${band.top+90}">${band.id.toUpperCase()}</text></g>`;
  }).join('\n');
}

function routeCenterlinesSvg(universe){
  return universe.routes.map(route=>`<path id="route-${escapeXml(route.id)}" data-route="${escapeXml(route.id)}" data-element="${escapeXml(route.sourceElement??route.element??'H')}" d="${pointPath(route.points)}"/>`).join('\n');
}
function revisitDeltaSvg(universe){
  const routes=universe.routes.filter(route=>route.revisit),parts=['<metadata>post-DRIVE derived geometry; baseline remains pre-DRIVE</metadata>'];
  for(const route of routes)parts.push(`<path id="post-drive-route-${escapeXml(route.id)}" data-revisit-route="${escapeXml(route.id)}" d="${pointPath(route.points)}"/>`);
  for(const current of universe.currents??[])parts.push(`<path data-revisit-current="${escapeXml(current.id)}" data-force="${fmt(current.force)}" data-width="${fmt(current.width)}" d="${pointPath(current.route.points)}"/>`);
  for(const id of ['hydrogen-revisit-pocket','carbon-revisit-pocket']){
    const dust=universe.dust.filter(item=>item.route===id),h=dust.filter(item=>item.element==='H'),c=dust.filter(item=>item.element==='C');
    parts.push(`<g data-revisit-pocket="${id}" data-h-count="${h.length}" data-c-count="${c.length}"><path data-element="H" d="${dustPath(h)}"/><path data-element="C" d="${dustPath(c)}"/></g>`);
  }
  return parts.join('\n');
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
    const centerX=oxygenRouteCenterAtY(route,gate.y)??route.x,envelope=oxygenGateEnvelopeAt(route,gate,{x:centerX,y:gate.y},BASELINE_SEED,index),outerHalfLength=gate.depth/2+6;
    parts.push(`<rect data-pressure-gate="${route.id}:${index}" data-pressure="${gate.pressure}" x="${fmt(centerX-route.width/2)}" y="${fmt(gate.y-gate.depth/2)}" width="${fmt(route.width)}" height="${fmt(gate.depth)}"/>`);
    parts.push(`<rect data-pressure-gate-falloff="${route.id}:${index}" data-hazard-type="mechanical" data-hazard-subtype="pressure" x="${fmt(envelope.center-envelope.halfWidth)}" y="${fmt(gate.y-outerHalfLength)}" width="${fmt(envelope.halfWidth*2)}" height="${fmt(outerHalfLength*2)}"/>`);
  }
  return parts.join('\n');
}

function elementLayer(universe,element,metadata='deterministic baseline snapshot: createUniverse(1, {H:0,C:0,O:0}); not invariant authored positions'){
  const points=universe.dust.filter(dust=>(dust.element??'H')===element);
  return `<metadata>${metadata}</metadata>\n<path class="element element-${element.toLowerCase()}" data-element="${element}" data-count="${points.length}" d="${dustPath(points)}"/>`;
}

function mapFieldsSvg(universe){
  return universe.fields.map((field,index)=>{
    const circle=`<circle data-map-field="${index}" data-field-id="${escapeXml(field.id??'')}" data-field-kind="${escapeXml(field.kind??'')}" data-hazard-type="${escapeXml(field.hazard?.type??'')}" data-hazard-subtype="${escapeXml(field.hazard?.subtype??'')}" data-angle="${fmt(field.angle??0)}" data-force="${fmt(field.force??VEIL.fieldForce)}" cx="${fmt(field.x)}" cy="${fmt(field.y)}" r="${fmt(field.radius)}"/>`;
    if(field.kind!=='burst-advantage')return circle;
    const angle=field.angle??0,length=field.radius*.82,x2=field.x+Math.cos(angle)*length,y2=field.y+Math.sin(angle)*length;
    return `<g data-burst-advantage="${escapeXml(field.id)}" data-route="${escapeXml(field.route)}" data-force="${fmt(field.force)}" data-clean-half-width="${fmt(field.cleanHalfWidth)}">${circle}<line x1="${fmt(field.x)}" y1="${fmt(field.y)}" x2="${fmt(x2)}" y2="${fmt(y2)}"/><text x="${fmt(field.x+field.radius+26)}" y="${fmt(field.y-field.radius-22)}">BURST ADV · ${escapeXml(field.id)} · short shear · clean ±${fmt(field.cleanHalfWidth)}</text></g>`;
  }).join('\n');
}

function abrasiveHazardSvg(){
  return `<metadata>post-Awakening only; production authority=ABRASIVE_PLUME; overlapping ellipses feed abrasiveSpatialAt()</metadata>\n${ABRASIVE_PLUME.lobes.map(lobe=>`<ellipse data-abrasive-lobe="${escapeXml(lobe.id)}" data-hazard-type="abrasive" data-hazard-subtype="particle-stream" data-base-intensity="${fmt(ABRASIVE_PLUME.baseIntensity)}" data-weight="${fmt(lobe.weight)}" cx="${fmt(lobe.x)}" cy="${fmt(lobe.y)}" rx="${fmt(lobe.rx)}" ry="${fmt(lobe.ry)}" transform="rotate(${fmt(lobe.angle*180/Math.PI)} ${fmt(lobe.x)} ${fmt(lobe.y)})"/>`).join('\n')}`;
}

function electricalHazardSvg(){
  return `<metadata>post-Awakening only; production authority=ELECTRICAL_FIELD; overlapping ellipses feed electricalSpatialAt()</metadata>\n${ELECTRICAL_FIELD.lobes.map(lobe=>`<ellipse data-electrical-lobe="${escapeXml(lobe.id)}" data-hazard-type="electrical" data-hazard-subtype="charged-region" data-base-intensity="${fmt(ELECTRICAL_FIELD.baseIntensity)}" data-weight="${fmt(lobe.weight)}" cx="${fmt(lobe.x)}" cy="${fmt(lobe.y)}" rx="${fmt(lobe.rx)}" ry="${fmt(lobe.ry)}" transform="rotate(${fmt(lobe.angle*180/Math.PI)} ${fmt(lobe.x)} ${fmt(lobe.y)})"/>`).join('\n')}`;
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
    const left=ys.map(y=>({x:challengeCenter(zone,y)-challengeWidthAt(zone,y),y})),right=[...ys].reverse().map(y=>({x:challengeCenter(zone,y)+challengeWidthAt(zone,y),y})),polygon=[...left,...right];
    const fade=36,organicYs=[];for(let y=zone.top-fade;y<zone.bottom+fade;y+=25)organicYs.push(y);organicYs.push(zone.bottom+fade);
    const organicLeft=organicYs.map(y=>{const profile=challengeProfileAt(zone,y,BASELINE_SEED);return {x:profile.center-profile.halfWidth,y};}),organicRight=[...organicYs].reverse().map(y=>{const profile=challengeProfileAt(zone,y,BASELINE_SEED);return {x:profile.center+profile.halfWidth,y};}),organic=[...organicLeft,...organicRight],types=zone.id==='thermal'?'mechanical thermal':'mechanical';
    return `<g data-challenge-envelope="${zone.id}"><path data-challenge="${zone.id}" data-anchor-x="${zone.centerX}" data-anchor-y="${zone.centerY}" data-half-width="${zone.width}" data-full-width="${zone.width*2}" d="${pointPath(polygon)} Z"/><path data-challenge-falloff="${zone.id}" data-hazard-types="${types}" d="${pointPath(organic)} Z"/></g>`;
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
    'oxygen-shortcut':'low-medium','oxygen-main':'medium-stable','oxygen-side':'medium-long',
    'oxygen-deep-safe':'medium','oxygen-deep-skill':'medium-high','oxygen-deep-thermal':'high-very-high',
  };
  return [...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES].map(route=>{
    const y=route.id.startsWith('oxygen-deep-')?-11340:-10100,x=oxygenRouteCenterAtY(route,y)??route.x;
    return `<g data-density-route="${route.id}" data-density-tier="${tiers[route.id]}" data-spacing="${route.spacing??20}" data-lanes="${route.lanes}" data-value="${route.value}"><text x="${fmt(x+30)}" y="${fmt(y-28)}">${escapeXml(route.id)} · ${tiers[route.id]} · spacing ${route.spacing??20} / lanes ${route.lanes} / value ${route.value}</text></g>`;
  }).join('\n');
}

function gameplaySvg(universe,config){
  const checkpoints=Object.entries(REGIONS).map(([id,region])=>`<g data-checkpoint="${id}"><circle cx="${region.x}" cy="${region.y}" r="26"/><text x="${region.x+38}" y="${region.y-18}">${escapeXml(region.name)} restart (${region.x},${region.y})</text></g>`).join('\n');
  const extractionSite=`<g data-safe-extraction-site="${escapeXml(SAFE_EXTRACTION_SITE.id)}" data-route="${escapeXml(SAFE_EXTRACTION_SITE.route)}"><circle cx="${fmt(SAFE_EXTRACTION_SITE.x)}" cy="${fmt(SAFE_EXTRACTION_SITE.y)}" r="${fmt(SAFE_EXTRACTION_SITE.radius)}"/><text x="${fmt(SAFE_EXTRACTION_SITE.x+SAFE_EXTRACTION_SITE.radius+32)}" y="${fmt(SAFE_EXTRACTION_SITE.y-20)}">SAFE EXTRACTION SITE (${SAFE_EXTRACTION_SITE.x},${SAFE_EXTRACTION_SITE.y})</text></g>`;
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
    layer('safe-extraction-site','Safe Extraction Site',extractionSite),
    layer('route-density','route density',routeDensitySvg()),
    layer('destination','destination',`<circle id="cho-destination" data-radius="${CHO_DESTINATION.radius}" cx="${CHO_DESTINATION.x}" cy="${CHO_DESTINATION.y}" r="${CHO_DESTINATION.radius}"/><text x="${CHO_DESTINATION.x+120}" y="${CHO_DESTINATION.y-35}">${escapeXml(CHO_DESTINATION.label)} (${CHO_DESTINATION.x},${CHO_DESTINATION.y})</text>`),
  ].join('\n');
}

function labelsSvg(universe){
  return universe.labels.map((label,index)=>`<text data-authored-label="${index}" x="${fmt(label.x)}" y="${fmt(label.y)}">${escapeXml(label.text)}</text>`).join('\n');
}
function rareEcologySvg(universe,bounds){
  const diagnostics=universe.rareEcology;if(!diagnostics?.eligible)throw new Error('Awakened Rare ecology diagnostics missing');
  return ['<metadata>Developer eligibility overlay only; exact Rare particle positions are intentionally omitted.</metadata>',...regionBands(bounds).filter(band=>band.id!=='frontier').map(band=>{
    const area=band.id==='oxygen'?'oxygen':band.id,config=RARE_ECOLOGY_AREA_CONFIG[area],diagnostic=diagnostics.areas[area];if(!config||!diagnostic)return '';
    return `<rect data-rare-ecology-area="${area}" data-element="${config.element}" data-base-density="${fmt(config.baseDensity)}" data-selected="${diagnostic.selected}" data-candidates="${diagnostic.candidates}" x="${bounds.left}" y="${band.top}" width="${bounds.right-bounds.left}" height="${band.bottom-band.top}"/>`;
  }).filter(Boolean)].join('\n');
}


function nitrogenFieldSvg(universe,bounds){
  const route=universe.routes.find(candidate=>candidate.id===NITROGEN_ROUTE.id),zones=universe.nitrogenZones??[],hazards=universe.nitrogenHazards??[],main=universe.dust.filter(item=>item.element==='N'&&item.route===NITROGEN_ROUTE.id),pocket=universe.dust.filter(item=>item.element==='N'&&item.route===NITROGEN_HIGH_DENSITY_POCKET.id),ambient=universe.dust.filter(item=>item.ambient),signal=universe.signals.find(item=>item.region==='nitrogen'),core=universe.nitrogenCore;
  if(!route)throw new Error('Nitrogen production route missing');if(zones.length!==NITROGEN_ZONES.length)throw new Error('Nitrogen production zone count mismatch');if(hazards.length!==NITROGEN_HAZARDS.length)throw new Error('Nitrogen production hazard count mismatch');
  const routeLayer=['<metadata>Developer geometry only; production renderer does not draw a Nitrogen route belt or corridor fill.</metadata>',...zones.map(zone=>`<path data-nitrogen-zone="${escapeXml(zone.id)}" data-zone-kind="${escapeXml(zone.kind)}" data-zone-width="${fmt(zone.width)}" d="${pointPath(zone.points)}" fill="none" stroke="#7189ef" stroke-width="6" stroke-dasharray="18 14" opacity=".56"/>`),`<path id="route-${escapeXml(route.id)}" data-route="${escapeXml(route.id)}" data-element="N" data-developer-only="true" d="${pointPath(route.points)}"/>`].join('\n');
  const hazardLayer=hazards.map(item=>`<circle data-nitrogen-hazard="${escapeXml(item.id)}" data-hazard-type="${escapeXml(item.type)}" data-hazard-subtype="${escapeXml(item.subtype)}" data-base-intensity="${fmt(item.baseIntensity)}" data-force="${fmt(item.force)}" data-heat="${fmt(item.heat)}" cx="${fmt(item.x)}" cy="${fmt(item.y)}" r="${fmt(item.radius)}"/>`).join('\n');
  const resourceLayer=[`<metadata>production nitrogen-enabled universe; stock N=0; route depletion=${fmt(route.routeDepletion??0)}</metadata>`,`<path class="element element-n" data-element="N" data-resource-area="mainline" data-count="${main.length}" d="${dustPath(main)}"/>`,`<circle data-resource-area="high-density-pocket" data-optional="true" data-particles="${NITROGEN_HIGH_DENSITY_POCKET.particles}" data-value="${NITROGEN_HIGH_DENSITY_POCKET.value}" cx="${fmt(NITROGEN_HIGH_DENSITY_POCKET.x)}" cy="${fmt(NITROGEN_HIGH_DENSITY_POCKET.y)}" r="${fmt(NITROGEN_HIGH_DENSITY_POCKET.radius)}"/>`,`<path class="element element-n" data-element="N" data-resource-area="high-density-pocket-particles" data-count="${pocket.length}" d="${dustPath(pocket)}"/>`,`<path data-resource-area="ambient-mix" data-count="${ambient.length}" d="${dustPath(ambient)}"/>`,...NITROGEN_RECOVERY_AREAS.map(area=>`<circle data-recovery-area="${escapeXml(area.id)}" cx="${fmt(area.x)}" cy="${fmt(area.y)}" r="${fmt(area.radius)}"/>`)].join('\n');
  const insightLayer=[`<circle data-critical-insight-area="${escapeXml(NITROGEN_INSIGHT_AREA.id)}" cx="${fmt(NITROGEN_INSIGHT_AREA.x)}" cy="${fmt(NITROGEN_INSIGHT_AREA.y)}" r="${fmt(NITROGEN_INSIGHT_AREA.radius)}"/>`,signal?`<circle data-signal="${escapeXml(signal.id)}" data-region="nitrogen" cx="${fmt(signal.x)}" cy="${fmt(signal.y)}" r="22"/>`:'',core?`<circle data-nitrogen-core="${escapeXml(core.id)}" data-fracture-radius="${fmt(core.fractureRadius)}" data-fractured="${core.fractured===true}" cx="${fmt(core.x)}" cy="${fmt(core.y)}" r="${fmt(core.radius)}"/>`:'' ].join('\n');
  const dynamicBoundary=`<rect data-progression="post-CHO" data-left="${bounds.left}" data-right="${bounds.right}" data-top="${bounds.top}" data-bottom="${bounds.bottom}" x="${bounds.left}" y="${bounds.top}" width="${bounds.right-bounds.left}" height="${bounds.bottom-bounds.top}"/>`;
  return ['<metadata>Post-CHO Nitrogen FIELD v2 derives from production geometry. Player-facing route belts/fills are intentionally absent.</metadata>',layer('dynamic-boundary','post-CHO dynamic boundary',dynamicBoundary),layer('nitrogen-route','Nitrogen developer centerline and nominal zones',routeLayer),layer('nitrogen-hazards','Nitrogen hazard cores and falloff authority',hazardLayer),layer('nitrogen-resources','Nitrogen resources, ambient mix and recovery areas',resourceLayer),layer('nitrogen-insight','Nitrogen Critical Insight and Core sites',insightLayer)].join('\n');
}

function legendSvg(bounds,universe,nitrogenUniverse,awakenedUniverse,dynamicBounds){
  const counts=Object.fromEntries(['H','C','O'].map(element=>[element,universe.dust.filter(dust=>(dust.element??'H')===element).length]));
  const nitrogenCount=nitrogenUniverse.dust.filter(dust=>dust.element==='N').length;
  const lines=[
    'CURRENT FIELD · developer map',
    `CHO bounds: left ${bounds.left} / right ${bounds.right} / top ${bounds.top} / bottom ${bounds.bottom}`,
    `post-CHO bounds: left ${dynamicBounds.left} / right ${dynamicBounds.right} / top ${dynamicBounds.top} / bottom ${dynamicBounds.bottom}`,
    `baseline: createUniverse(${BASELINE_SEED}, {H:0,C:0,O:0}) · pre-DRIVE`,
    'post-DRIVE H/C revisit geometry is shown only in the dedicated delta layer',
    'post-CHO Nitrogen geometry is shown only in the dedicated production-derived layer',
    `post-Awakening Rare ecology: ${Object.entries(RARE_ECOLOGY_AREA_CONFIG).map(([area,config])=>`${area}→${config.element} ${config.baseDensity}`).join(' · ')}`,
    'Rare ecology overlay shows eligible areas/density only; exact trace particle coordinates are intentionally hidden',
    `particles: H ${counts.H} · C ${counts.C} · O ${counts.O} · N ${nitrogenCount} (fresh N stock)`,
    'element positions are deterministic baseline snapshot, not invariant authored positions',
    `thermal: environmentAt() sampled every ${THERMAL_STEP} world units at time=0`,
    'environment heat != player thermal state',
    'DUST EATER: dynamic pursuit agent / no authored map position',
    `DUST EATER: safe ${EXPEDITION.safeSeconds}s · spawn distance ${EXPEDITION.eaterSpawnDistance} · thresholds ${EXPEDITION.eaterThresholds.join('/')}`,
    `RETURN: Safe Extraction Site at (${SAFE_EXTRACTION_SITE.x},${SAFE_EXTRACTION_SITE.y}); Insight may extract anywhere`,
    'checkpoint marks are REGIONS restart anchors, not physical checkpoint objects',
    'Oxygen challenge width in source is half-width; map shows full 2× width',
    'Route density annotations are authored spacing / lanes / value profiles.',
    'No inferred walls/corridor polygons are generated.',
  ];
  return `<rect class="legend-panel" x="1390" y="${dynamicBounds.top+70}" width="1450" height="${lines.length*92+100}" rx="24"/>\n${lines.map((line,index)=>`<text class="legend-text ${index===0?'legend-title':''}" x="1450" y="${dynamicBounds.top+150+index*92}">${escapeXml(line)}</text>`).join('\n')}`;
}

export function buildFieldMapSvg(){
  const config=flightConfig(),bounds=GROWTH.bounds,postChoConfig=flightConfig({progress:{choCompleted:true},elements:{N:0}}),dynamicBounds=postChoConfig.bounds;
  const universe=createUniverse(BASELINE_SEED,{...BASELINE_STOCK}),postDriveUniverse=createUniverse(BASELINE_SEED,{...BASELINE_STOCK},{capabilities:{combustionDrive:true}}),nitrogenUniverse=createUniverse(BASELINE_SEED,{...BASELINE_STOCK,N:0},{capabilities:{nitrogenField:true}}),awakenedUniverse=createUniverse(BASELINE_SEED,{...BASELINE_STOCK,N:0,P:0,S:0,F:0,Cl:0},{capabilities:{combustionDrive:true,nitrogenField:true,coreFractured:true,worldAwakened:true,rareEcologyEligible:true}});
  if(config.bounds!==bounds&&JSON.stringify(config.bounds)!==JSON.stringify(bounds))throw new Error('flightConfig bounds diverge from GROWTH.bounds');
  if(dynamicBounds.top>=bounds.top)throw new Error('post-CHO dynamic bounds must extend beyond CHO bounds');
  const view={left:dynamicBounds.left-100,top:dynamicBounds.top-100,right:2950,bottom:dynamicBounds.bottom+100};
  const width=view.right-view.left,height=view.bottom-view.top;
  const geometry=[
    layer('playable-bounds','playable bounds',`<rect data-left="${bounds.left}" data-right="${bounds.right}" data-top="${bounds.top}" data-bottom="${bounds.bottom}" x="${bounds.left}" y="${bounds.top}" width="${bounds.right-bounds.left}" height="${bounds.bottom-bounds.top}"/>`),
    layer('route-centerlines','route centerlines',routeCenterlinesSvg(universe)),
    layer('route-widths','route widths',routeWidthsSvg()),
    layer('authored-gates','authored gates',authoredGatesSvg()),
  ].join('\n');
  const gameplay=gameplaySvg(universe,config);
  return `<!-- Generated by scripts/export-field-map.mjs; do not edit. -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="${NS}" viewBox="${view.left} ${view.top} ${width} ${height}" width="900" height="${fmt(900*height/width)}" role="img" aria-labelledby="title desc">\n<title id="title">Molecule Craft current FIELD developer map</title>\n<desc id="desc">Coordinate-faithful deterministic developer map generated from current FIELD source.</desc>\n<metadata id="field-map-metadata">baseline-seed=${BASELINE_SEED}; stock=H0,C0,O0,N0; progression=pre-DRIVE CHO baseline + post-DRIVE H/C delta + post-CHO Nitrogen FIELD + post-Awakening Rare ecology eligibility; source-bounds=GROWTH.bounds + flightConfig(post-CHO).bounds; procedural element positions are deterministic baseline snapshots, not invariant authored positions; DUST EATER is an agent with no authored map position; Safe Extraction Site is fixed authored production geometry.</metadata>\n<style>\n.major-grid{stroke:#334151;stroke-width:2;opacity:.34}.grid-labels,.axis-label,.legend-text,.region-label,#layer-labels text,#layer-gameplay text{font:32px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#d9e2ea}.axis{stroke:#91a4b5;stroke-width:5;opacity:.7}.origin{fill:#fff;stroke:#17212b;stroke-width:8}.region-label{font-size:48px;font-weight:700;opacity:.58}.legend-title{font-size:46px;font-weight:800}.legend-panel{fill:#101922;stroke:#617487;stroke-width:4;opacity:.96}\n#layer-regions rect{opacity:.075}#playable-bounds rect{fill:none;stroke:#e7edf2;stroke-width:8}#route-centerlines path{fill:none;stroke:#b7c3ce;stroke-width:5;opacity:.72}#route-centerlines [data-element="H"]{stroke:#8bc8dc}#route-centerlines [data-element="C"]{stroke:#c7a676}#route-centerlines [data-element="O"]{stroke:#d7a4a4}#layer-revisit-post-drive [data-revisit-route]{fill:none;stroke:#a7f0c5;stroke-width:8;stroke-dasharray:24 12}#layer-revisit-post-drive [data-revisit-current]{fill:none;stroke:#6fe3c5;stroke-opacity:.16;stroke-linecap:round}#layer-revisit-post-drive [data-revisit-pocket] path{fill:none;stroke-linecap:round;stroke-width:8}#layer-revisit-post-drive [data-revisit-pocket] [data-element="H"]{stroke:#79d2ee}#layer-revisit-post-drive [data-revisit-pocket] [data-element="C"]{stroke:#c79a62}#route-widths rect{fill:#8db6c7;stroke:#a6cad7;stroke-width:2;opacity:.09}#route-widths path{fill:none;stroke:#a6cad7;stroke-linecap:round;stroke-linejoin:round;opacity:.09}#authored-gates rect{fill:#e1b267;stroke:#f1cb88;stroke-width:5;opacity:.25}#authored-gates [data-pressure-gate-falloff]{fill:#e8c78f;stroke:#ffe1aa;stroke-width:3;stroke-dasharray:14 10;opacity:.08}#authored-gates line{stroke:#ffdb95;stroke-width:9;stroke-dasharray:24 16}\n.element{fill:none;stroke-linecap:round;opacity:.72}.element-h{stroke:#79d2ee;stroke-width:5}.element-c{stroke:#c79a62;stroke-width:7}.element-o{stroke:#e19090;stroke-width:6}.element-n{stroke:#8da3ff;stroke-width:6}#layer-hazards-fields circle{fill:#9f8fd0;stroke:#c0b4ec;stroke-width:4;opacity:.16}#layer-hazards-fields [data-burst-advantage] circle{fill:#d6a4ff;stroke:#f0d8ff;stroke-width:6;opacity:.3}#layer-hazards-fields [data-burst-advantage] line{stroke:#f3d6ff;stroke-width:8;stroke-linecap:round}#layer-hazards-fields [data-burst-advantage] text{font:28px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#f4e6ff;paint-order:stroke;stroke:#101820;stroke-width:8}#layer-hazards-pressure path{fill:#6f8db7;stroke:none}#layer-hazards-challenges path{fill:#d58a61;stroke:#f0a77e;stroke-width:5;opacity:.17}#layer-hazards-challenges [data-challenge-falloff]{fill:#d9a17e;stroke:#ffd0aa;stroke-width:3;stroke-dasharray:16 12;opacity:.08}#layer-hazards-vortex circle{fill:none;stroke:#7ebfca;stroke-width:6;opacity:.42}#layer-hazards-vortex [data-vortex="core"]{fill:#7ebfca;opacity:.18}#layer-thermal path{fill:#e86945;stroke:none}#layer-gameplay circle,#layer-gameplay rect{fill:none;stroke:#f4e1a0;stroke-width:7}#signals circle{stroke:#d5b2ff}#destination circle{stroke:#f2c45b;stroke-width:12}#safe-extraction-site circle{fill:#8de4bd;fill-opacity:.12;stroke:#8de4bd;stroke-width:10;stroke-dasharray:22 14}#safe-extraction-site text{font:28px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#b9f6d9;paint-order:stroke;stroke:#101820;stroke-width:8}#route-density text{font-size:27px;fill:#d7e6cf;paint-order:stroke;stroke:#101820;stroke-width:8}#layer-labels text{font-size:34px;paint-order:stroke;stroke:#101820;stroke-width:10;stroke-linejoin:round}.annotation{font:30px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#cbd7e1}\n#dynamic-boundary rect{fill:none;stroke:#8097ff;stroke-width:8;stroke-dasharray:28 16}#nitrogen-route [data-route]{fill:none;stroke:#8da3ff;stroke-width:7;opacity:.88}#nitrogen-route [data-route-width]{fill:none;stroke:#7189ef;stroke-linecap:round;stroke-linejoin:round;opacity:.1}#nitrogen-hazards circle{fill:#728cff;stroke:#aebcff;stroke-width:5;opacity:.18}#nitrogen-resources [data-resource-area="high-density-pocket"]{fill:#7d95ff;stroke:#b7c3ff;stroke-width:5;opacity:.12}#nitrogen-insight [data-critical-insight-area]{fill:#c89cff;stroke:#e1c5ff;stroke-width:7;opacity:.18}#nitrogen-insight [data-signal]{fill:none;stroke:#e3c8ff;stroke-width:6}#layer-managed-rare-ecology rect{fill:#f0c66a;stroke:#ffe0a0;stroke-width:4;stroke-dasharray:26 16;opacity:.045}#layer-abrasive-hazard ellipse{fill:#b9ad8e;stroke:#e0d5b7;stroke-width:5;stroke-dasharray:18 12;opacity:.11}#layer-electrical-hazard ellipse{fill:#87aee8;stroke:#c7ddff;stroke-width:5;stroke-dasharray:12 10;opacity:.1}\n</style>\n${layer('layer-grid','grid',gridSvg(dynamicBounds))}\n${layer('layer-regions','regions',regionSvg(dynamicBounds),{'data-carbon-y':GROWTH.carbonY,'data-oxygen-y':GROWTH.oxygenY,'data-frontier-y':GROWTH.frontierY,'data-nitrogen-y':GROWTH.nitrogenY})}\n${layer('layer-geometry','geometry',geometry)}\n${layer('layer-revisit-post-drive','post-DRIVE H/C revisit delta',revisitDeltaSvg(postDriveUniverse))}\n${layer('layer-nitrogen-field','post-CHO Nitrogen FIELD',nitrogenFieldSvg(nitrogenUniverse,dynamicBounds))}\n${layer('layer-managed-rare-ecology','post-Awakening managed Rare ecology eligibility',rareEcologySvg(awakenedUniverse,dynamicBounds))}\n${layer('layer-abrasive-hazard','post-Awakening Abrasive hazard',abrasiveHazardSvg())}\n${layer('layer-electrical-hazard','post-Awakening Electrical hazard',electricalHazardSvg())}\n${layer('layer-elements-h','elements H',elementLayer(universe,'H'))}\n${layer('layer-elements-c','elements C',elementLayer(universe,'C'))}\n${layer('layer-elements-o','elements O',elementLayer(universe,'O'))}\n${layer('layer-hazards-fields','hazards: map fields',mapFieldsSvg(universe))}\n${layer('layer-hazards-pressure','hazards: oxygen pressure',sampledPressureSvg(bounds))}\n${layer('layer-hazards-challenges','hazards: challenges',challengeSvg())}\n${layer('layer-hazards-vortex','hazards: vortex',vortexSvg())}\n${layer('layer-agents-dust-eater','agents: DUST EATER','<metadata>DUST EATER: dynamic pursuit agent / no authored map position; excluded from environmental hazard taxonomy</metadata>')}\n${layer('layer-thermal','thermal',thermalSvg(bounds))}\n${layer('layer-gameplay','gameplay points',gameplay)}\n${layer('layer-labels','labels',`${labelsSvg(universe)}\n${labelsSvg({labels:nitrogenUniverse.labels.filter(label=>label.y<GROWTH.nitrogenY)})}`)}\n${layer('layer-annotations','annotations',`<text class="annotation" x="${bounds.left+40}" y="${dynamicBounds.top+55}">Y increases downward exactly as FIELD source coordinates; no axis inversion.</text>\n${legendSvg(bounds,universe,nitrogenUniverse,awakenedUniverse,dynamicBounds)}`)}\n</svg>\n`;
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
