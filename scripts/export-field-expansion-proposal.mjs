import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  ANCHORS,CHALLENGE_INTENTS,DENSITY_INTENTS,GATE_MARKERS,GATE_TAXONOMY,
  PROPOSAL_NOTICE,RECOVERY_ZONES,ROUTES,SIGNAL_INTENTS,THERMAL_INTENTS,
} from './field-expansion-proposal-data.mjs';

const ROOT=new URL('../',import.meta.url);
const CURRENT_URL=new URL('docs/maps/current-field.svg',ROOT);
const OUTPUT_URL=new URL('docs/maps/field-expansion-proposal.svg',ROOT);
const NS='http://www.inkscape.org/namespaces/inkscape';

const fmt=value=>{
  if(!Number.isFinite(value))throw new TypeError(`Non-finite SVG coordinate: ${value}`);
  const rounded=Math.round(value*1000)/1000;
  return Object.is(rounded,-0)?'0':String(rounded);
};
const escapeXml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const attrs=values=>Object.entries(values).filter(([,value])=>value!==undefined&&value!==null).map(([key,value])=>`${key}="${escapeXml(value)}"`).join(' ');
const layer=(id,label,body,extra={})=>`<g ${attrs({id,'inkscape:groupmode':'layer','inkscape:label':label,...extra})}>\n${body}\n</g>`;
const pathData=points=>`M ${points.map(([x,y])=>`${fmt(x)} ${fmt(y)}`).join(' L ')}`;

function currentViewBox(currentSvg){
  const match=currentSvg.match(/<svg\b[^>]*\bviewBox="([^"]+)"/);
  if(!match)throw new Error('docs/maps/current-field.svg has no viewBox');
  const values=match[1].trim().split(/\s+/).map(Number);
  if(values.length!==4||values.some(value=>!Number.isFinite(value)))throw new Error(`Invalid current FIELD viewBox: ${match[1]}`);
  const [left,top,width,height]=values;
  return {left,top,width,height,right:left+width,bottom:top+height,value:values.map(fmt).join(' ')};
}

function routeSvg(route){
  return `<path id="${route.id}" class="proposal-route" data-gate-class="${escapeXml(route.gateClass)}" data-width-intent="${escapeXml(route.widthIntent)}" data-role="${escapeXml(route.role)}" d="${pathData(route.points)}"/>`;
}

function recoverySvg(){
  return RECOVERY_ZONES.map(zone=>`<ellipse id="${zone.id}" data-label="${escapeXml(zone.label)}" data-semantics="low environmental pressure; low heat; route decision point; future predator-pressure reduction candidate" cx="${zone.x}" cy="${zone.y}" rx="${zone.rx}" ry="${zone.ry}"/>`).join('\n');
}

function densitySvg(element){
  return DENSITY_INTENTS.filter(zone=>zone.element===element).map(zone=>`<ellipse id="${zone.id}" data-element="${element}" data-density-intent="${escapeXml(zone.level)}" data-label="${escapeXml(zone.label)}" cx="${zone.x}" cy="${zone.y}" rx="${zone.rx}" ry="${zone.ry}"/>`).join('\n');
}

function thermalIntentSvg(){
  return `<metadata>relative thermal design intent only; proposal only; no canonical heat values; environmentAt() is unchanged</metadata>\n${THERMAL_INTENTS.map(zone=>`<ellipse id="${zone.id}" class="thermal-intent thermal-${zone.kind}" data-thermal-intent="${zone.kind}" data-label="${escapeXml(zone.label)}" cx="${zone.x}" cy="${zone.y}" rx="${zone.rx}" ry="${zone.ry}"/>`).join('\n')}`;
}
function gateSvg(){
  return GATE_MARKERS.map(marker=>`<g id="${marker.id}" class="gate-marker gate-${marker.gate.toLowerCase()}" data-route="${marker.route}" data-gate="${marker.gate}" data-label="${escapeXml(marker.label)}"${marker.candidate?' data-candidate="true"':''}><circle cx="${marker.x}" cy="${marker.y}" r="29"/><text x="${marker.x+38}" y="${marker.y-12}">${marker.gate}${marker.candidate?'?':''}</text></g>`).join('\n');
}
function challengeSvg(){
  return `<metadata>Current challenge footprints remain visible in the faint CURRENT reference; these markers are placement intent only and do not change rewards or logic.</metadata>\n${CHALLENGE_INTENTS.map(item=>`<g id="${item.id}" data-challenge-intent="${item.type}" data-route="${item.route}" data-label="${escapeXml(item.label)}"><path class="challenge-diamond" d="M ${item.x} ${item.y-34} L ${item.x+34} ${item.y} L ${item.x} ${item.y+34} L ${item.x-34} ${item.y} Z"/><text x="${item.x+44}" y="${item.y-12}">${item.type}</text></g>`).join('\n')}`;
}
function signalSvg(){
  return `<metadata>Signal candidate zones and relative complexity only; signal selection/unlock rules remain undefined for a later task.</metadata>\n${SIGNAL_INTENTS.map(item=>`<g id="${item.id}" data-signal-intent="candidate" data-complexity="${item.complexity}" data-label="${escapeXml(item.label)}"><circle cx="${item.x}" cy="${item.y}" r="${item.r}"/><text x="${item.x+item.r+20}" y="${item.y-10}">signal · ${item.complexity}</text></g>`).join('\n')}`;
}
function anchorsSvg(){
  return Object.entries(ANCHORS).map(([id,anchor])=>{
    if(id==='currentVortexApprox')return `<g id="anchor-${id}" data-current-reference="true"><circle class="vortex-reference" cx="${anchor.x}" cy="${anchor.y}" r="210"/><text x="${anchor.x-360}" y="${anchor.y-250}">${escapeXml(anchor.label)} ≈ (${anchor.x},${anchor.y})</text></g>`;
    return `<g id="anchor-${id}" data-anchor="${id}" data-coordinate="(${anchor.x},${anchor.y})"><circle class="anchor-marker" cx="${anchor.x}" cy="${anchor.y}" r="22"/><text x="${anchor.x+34}" y="${anchor.y-24}">${escapeXml(anchor.label)} (${anchor.x},${anchor.y})</text></g>`;
  }).join('\n');
}

function routeLabelsSvg(){
  return Object.values(ROUTES).map(route=>{
    const index=Math.min(1,route.points.length-1),[x,y]=route.points[index];
    return `<text data-route-label="${route.id}" x="${x+38}" y="${y-42}">${escapeXml(route.label)} · ${escapeXml(route.gateClass)}</text>`;
  }).join('\n');
}

function legendSvg(view){
  const x=1400,y=view.top+90,width=1450;
  const gateLines=Object.entries(GATE_TAXONOMY).map(([gate,label],index)=>`<text class="legend-line gate-legend-${gate.toLowerCase()}" x="${x+70}" y="${y+630+index*82}">${gate} · ${escapeXml(label)}</text>`).join('\n');
  const designLines=[
    'CURRENT = faint docs/maps/current-field.svg reference',
    'PROPOSED = bright centerlines / intent overlays',
    'Centerline visual width is NOT a collision/corridor width.',
    'Thermal zones are relative intent; no heat numbers are locked.',
    'Density zones are resource-distribution intent; spawn is unchanged.',
    'Recovery rhythm: danger → recovery → choice → danger.',
    'Hard gates are intentionally sparse; G3 marks candidates only where labeled.',
    'Challenge diamonds compare against CURRENT challenge footprints underneath.',
  ];
  return `<rect class="legend-panel" x="${x}" y="${y}" width="${width}" height="1520" rx="24"/>\n<text class="legend-title" x="${x+70}" y="${y+100}">FIELD EXPANSION · PROPOSED</text>\n<text class="proposal-warning" x="${x+70}" y="${y+180}">${escapeXml(PROPOSAL_NOTICE)}</text>\n<text class="legend-line" x="${x+70}" y="${y+285}">Progression: H₂ → CH₄ → O₂ → H₂O</text>\n<text class="legend-line" x="${x+70}" y="${y+365}">H₂ BURST · CH₄ + O₂ COMBUSTION DRIVE · H₂O coolant</text>\n<text class="legend-subtitle" x="${x+70}" y="${y+500}">Gate taxonomy</text>\n${gateLines}\n<text class="legend-subtitle" x="${x+70}" y="${y+1010}">Design contract</text>\n${designLines.map((line,index)=>`<text class="legend-line small" x="${x+70}" y="${y+1090+index*52}">${escapeXml(line)}</text>`).join('\n')}`;
}

export function buildFieldExpansionProposalSvg(currentSvg){
  const view=currentViewBox(currentSvg);
  const height=900*view.height/view.width;
  const routeLayers=Object.values(ROUTES).map(route=>layer(route.layer,route.label,routeSvg(route),{'data-proposal-route':route.id})).join('\n');
  return `<!-- Generated by scripts/export-field-expansion-proposal.mjs; do not edit. -->\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="${NS}" viewBox="${view.value}" width="900" height="${fmt(height)}" role="img" aria-labelledby="title desc">\n<title id="title">Molecule Craft FIELD expansion proposed overlay</title>\n<desc id="desc">Coordinate-based design lock overlay comparing the current FIELD map with proposed revisit, Oxygen, Deep Oxygen, recovery, density, thermal, gate, challenge and signal intent.</desc>\n<metadata id="field-expansion-proposal-metadata">${escapeXml(PROPOSAL_NOTICE)}; current-reference=docs/maps/current-field.svg; same viewBox/world-coordinate system; production gameplay is not modified by this artifact.</metadata>\n<style>\ntext{font:28px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#e8eef4;paint-order:stroke;stroke:#0e151d;stroke-width:8;stroke-linejoin:round}.proposal-route{fill:none;stroke:#eff5f8;stroke-width:12;stroke-dasharray:34 18;stroke-linecap:round;stroke-linejoin:round}.proposal-node{fill:#eff5f8;stroke:#0e151d;stroke-width:5}.anchor-marker{fill:#fff;stroke:#5e7182;stroke-width:7}.vortex-reference{fill:none;stroke:#72b8c5;stroke-width:9;stroke-dasharray:22 18}.legend-panel{fill:#0b131b;stroke:#7f93a5;stroke-width:5;opacity:.97}.legend-title{font-size:50px;font-weight:800;stroke-width:11}.legend-subtitle{font-size:38px;font-weight:800}.legend-line{font-size:28px}.legend-line.small{font-size:23px}.proposal-warning{font-size:30px;font-weight:800;fill:#ffcf70}.gate-g0 circle{fill:#70c890}.gate-g1 circle{fill:#69b9df}.gate-g2 circle{fill:#d5ad61}.gate-g3 circle{fill:#e27474}.gate-marker circle{stroke:#101923;stroke-width:7}.gate-marker text{font-size:24px}.gate-legend-g0{fill:#8fe0aa}.gate-legend-g1{fill:#8fd2ef}.gate-legend-g2{fill:#f0cb83}.gate-legend-g3{fill:#f59a9a}#layer-proposed-h-revisit .proposal-route{stroke:#78d7ed}#layer-proposed-c-revisit .proposal-route{stroke:#d7a66c}#layer-proposed-oxygen-entry .proposal-route{stroke:#89dfc0;stroke-width:18}#layer-proposed-oxygen-burst .proposal-route{stroke:#79cdeb}#layer-proposed-oxygen-drive .proposal-route{stroke:#f0ce73;stroke-width:18}#layer-proposed-oxygen-thermal .proposal-route{stroke:#ef9a68;stroke-width:18}#layer-proposed-deep-safe .proposal-route{stroke:#8fcf9e;stroke-width:18}#layer-proposed-deep-skill .proposal-route{stroke:#d0b6f0}#layer-proposed-deep-thermal .proposal-route{stroke:#ef7f66;stroke-width:18}#layer-proposed-recovery ellipse{fill:#6ed39c;fill-opacity:.14;stroke:#8ce6b4;stroke-width:8;stroke-dasharray:20 14}#layer-proposed-recovery text{font-size:24px}.density-zone ellipse,#layer-proposed-density-h ellipse,#layer-proposed-density-c ellipse,#layer-proposed-density-o ellipse{fill-opacity:.055;stroke-width:5;stroke-dasharray:12 18}#layer-proposed-density-h ellipse{fill:#68d6ef;stroke:#68d6ef}#layer-proposed-density-c ellipse{fill:#d7a66c;stroke:#d7a66c}#layer-proposed-density-o ellipse{fill:#e98f8f;stroke:#e98f8f}#layer-proposed-density-h text,#layer-proposed-density-c text,#layer-proposed-density-o text{font-size:20px;opacity:.78}.thermal-intent ellipse{stroke-width:6;stroke-dasharray:28 18;fill-opacity:.07}.thermal-intent text{font-size:21px}.thermal-cool-neutral ellipse{fill:#76cfe5;stroke:#76cfe5}.thermal-warm ellipse{fill:#eac06e;stroke:#eac06e}.thermal-hot-learning ellipse{fill:#ef8b58;stroke:#ef8b58}.thermal-high-thermal ellipse{fill:#e75e4d;stroke:#e75e4d}.thermal-recovery ellipse{fill:#67cd94;stroke:#67cd94}.challenge-diamond{fill:#dca6ff;stroke:#f0d1ff;stroke-width:8}#layer-proposed-challenges text,#layer-proposed-signals text{font-size:23px}#layer-proposed-signals circle{fill:#bca1e8;fill-opacity:.07;stroke:#c8b4ed;stroke-width:7;stroke-dasharray:15 13}#layer-proposed-labels text{font-size:24px}\n</style>\n${layer('layer-current-reference','CURRENT reference',`<metadata>CURRENT · docs/maps/current-field.svg · exact same world-coordinate viewBox</metadata>\n<image id="current-field-reference" href="current-field.svg" x="${view.left}" y="${view.top}" width="${view.width}" height="${view.height}" opacity=".18" preserveAspectRatio="none"/>\n<text x="${view.left+70}" y="${view.top+95}">CURRENT REFERENCE · faint</text>`)}\n${routeLayers}\n${layer('layer-proposed-recovery','PROPOSED recovery zones',recoverySvg())}\n${layer('layer-proposed-density-h','PROPOSED density H',densitySvg('H'),{class:'density-zone'})}\n${layer('layer-proposed-density-c','PROPOSED density C',densitySvg('C'),{class:'density-zone'})}\n${layer('layer-proposed-density-o','PROPOSED density O',densitySvg('O'),{class:'density-zone'})}\n${layer('layer-proposed-thermal','PROPOSED relative thermal intent',thermalIntentSvg())}\n${layer('layer-proposed-gates','PROPOSED gate taxonomy',gateSvg())}\n${layer('layer-proposed-challenges','PROPOSED challenge placement intent',challengeSvg())}\n${layer('layer-proposed-signals','PROPOSED signal candidate intent',signalSvg())}\n${layer('layer-proposed-labels','PROPOSED labels',`${anchorsSvg()}\n${routeLabelsSvg()}\n${legendSvg(view)}`)}\n</svg>\n`;
}

export async function exportFieldExpansionProposal({check=false}={}){
  const current=await readFile(CURRENT_URL,'utf8');
  const svg=buildFieldExpansionProposalSvg(current);
  if(check){
    let committed='';
    try{committed=await readFile(OUTPUT_URL,'utf8');}catch(error){if(error?.code!=='ENOENT')throw error;}
    if(committed!==svg){
      console.error('docs/maps/field-expansion-proposal.svg is stale. Run: node scripts/export-field-expansion-proposal.mjs');
      process.exitCode=1;
      return false;
    }
    console.log('FIELD expansion proposal map is current: docs/maps/field-expansion-proposal.svg');
    return true;
  }
  await mkdir(dirname(fileURLToPath(OUTPUT_URL)),{recursive:true});
  await writeFile(OUTPUT_URL,svg,'utf8');
  console.log('Wrote docs/maps/field-expansion-proposal.svg');
  return true;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=new Set(process.argv.slice(2)),unknown=[...args].filter(arg=>arg!=='--check');
  if(unknown.length){console.error(`Unknown argument(s): ${unknown.join(', ')}`);process.exitCode=2;}
  else await exportFieldExpansionProposal({check:args.has('--check')});
}
