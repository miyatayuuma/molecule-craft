import {mkdir,readFile,writeFile} from 'node:fs/promises';
import process from 'node:process';

const root=new URL('../',import.meta.url);
const graphUrl=new URL('data/molecule-graph.proposed.json',root);
const outputUrl=new URL('docs/maps/molecule-graph-proposed.svg',root);
const graph=JSON.parse(await readFile(graphUrl,'utf8'));
const rowsToObjects=(columns,rows)=>rows.map(row=>Object.fromEntries(columns.map((key,index)=>[key,row[index]])));
const nodes=rowsToObjects(graph.nodeColumns,graph.nodes);
const endpointId=value=>Number.isInteger(value)?nodes[value]?.id:value;
const edges=rowsToObjects(graph.edgeColumns,graph.edges).map(edge=>({...edge,from:endpointId(edge.from),to:endpointId(edge.to)}));
const additions=new Set((graph.additions??[]).map(item=>item.id));
const sectorByCode=Object.fromEntries(Object.entries(graph.sectorCodes).map(([code,name])=>[Number(code),name]));
const familyByCode=Object.fromEntries(Object.entries(graph.familyCodes).map(([code,name])=>[Number(code),name]));
const roleByCode=graph.roleCodes??{};
const sectorAngle={N:-90,NE:-45,E:0,SE:45,S:90,SW:135,W:180,NW:-135};
const width=2600,height=2600,cx=width/2,cy=height/2;
const hash=text=>{let value=2166136261;for(const ch of text){value^=ch.codePointAt(0);value=Math.imul(value,16777619);}return value>>>0;};
const esc=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&apos;'}[ch]));
const position=node=>{
  const sector=sectorByCode[node.sectorCode]??'CENTER',h=hash(node.id);
  if(sector==='CENTER'){
    const angle=((h%360)-180)*Math.PI/180;
    const radius=70+node.depth*72+(h%37);
    return {x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius};
  }
  const jitter=((h%37)-18)*0.72;
  const angle=((sectorAngle[sector]??0)+jitter)*Math.PI/180;
  const radius=165+node.depth*82+((h>>>8)%45)-22;
  return {x:cx+Math.cos(angle)*radius,y:cy+Math.sin(angle)*radius};
};
const positions=new Map(nodes.map(node=>[node.id,position(node)]));
const degree=new Map(nodes.map(node=>[node.id,node.connectionEdgeIndexes.length]));
const roleNames=node=>[...node.roleCodes].map(code=>roleByCode[code]).filter(Boolean);
const nodeClass=node=>{
  const roles=new Set(roleNames(node));
  return additions.has(node.id)?'add':roles.has('ROOT')?'root':roles.has('HUB')?'hub':roles.has('BRIDGE')?'bridge':roles.has('LEAF')?'leaf':'branch';
};
const edgeLines=edges.map(edge=>{
  const a=positions.get(edge.from),b=positions.get(edge.to);
  if(!a||!b)throw new Error(`Unknown graph edge endpoint: ${String(edge.from)} -> ${String(edge.to)}`);
  return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="edge" data-relation="${esc(graph.relationCodes[edge.relationCode]??edge.relationCode)}"/>`;
}).join('\n');
const nodeGroups=nodes.map(node=>{
  const p=positions.get(node.id),klass=nodeClass(node),family=familyByCode[node.familyCode]??node.familyCode,roles=roleNames(node).join(',');
  const r=klass==='root'?17:klass==='hub'?14:klass==='add'?13:10;
  return `<g class="node ${klass}" data-id="${esc(node.id)}" data-family="${esc(family)}" data-roles="${esc(roles)}"><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/><text x="${p.x.toFixed(1)}" y="${(p.y-r-5).toFixed(1)}">${esc(node.id)}</text><title>${esc(`${node.id} · ${family} · ${roles||'BRANCH'} · depth ${node.depth} · degree ${degree.get(node.id)}`)}</title></g>`;
}).join('\n');
const sectorLabels=Object.entries(sectorAngle).map(([sector,deg])=>{
  const angle=deg*Math.PI/180,radius=1160;
  return `<text class="sector" x="${(cx+Math.cos(angle)*radius).toFixed(1)}" y="${(cy+Math.sin(angle)*radius).toFixed(1)}">${sector}</text>`;
}).join('\n');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Molecule Graph proposal developer map</title>
<desc id="desc">Developer-only overview of ${nodes.length} proposed molecule nodes and ${edges.length} undirected structural-neighbor edges.</desc>
<style>
:root{color-scheme:dark}.bg{fill:#081018}.ring{fill:none;stroke:#26394a;stroke-width:1;stroke-dasharray:7 11}.axis{stroke:#31495d;stroke-width:1}.edge{stroke:#60778a;stroke-width:1.2;stroke-opacity:.48}.node circle{fill:#25394a;stroke:#9bb4c8;stroke-width:1.4}.node text{fill:#d9e6ef;font:10px ui-monospace,SFMono-Regular,Menlo,monospace;text-anchor:middle}.node.root circle{fill:#245468;stroke:#c6f1ff;stroke-width:3}.node.hub circle{fill:#5a4530;stroke:#ffd59c;stroke-width:2.5}.node.bridge circle{fill:#3c465f;stroke:#b9c8ff;stroke-width:2}.node.leaf circle{fill:#29343d;stroke:#7d919e}.node.add circle{fill:#514167;stroke:#e0bdff;stroke-width:3}.sector{fill:#7890a3;font:700 18px ui-monospace,SFMono-Regular,Menlo,monospace;text-anchor:middle}.meta{fill:#cfe0ea;font:16px ui-monospace,SFMono-Regular,Menlo,monospace}.legend{fill:#9db1bf;font:13px ui-monospace,SFMono-Regular,Menlo,monospace}
</style>
<rect class="bg" width="100%" height="100%"/>
<g aria-hidden="true"><circle class="ring" cx="${cx}" cy="${cy}" r="360"/><circle class="ring" cx="${cx}" cy="${cy}" r="700"/><circle class="ring" cx="${cx}" cy="${cy}" r="1040"/><line class="axis" x1="${cx}" y1="80" x2="${cx}" y2="2520"/><line class="axis" x1="80" y1="${cy}" x2="2520" y2="${cy}"/>${sectorLabels}</g>
<g class="edges">${edgeLines}</g>
<g class="nodes">${nodeGroups}</g>
<g transform="translate(42 52)"><text class="meta">Molecule Graph proposal · ${nodes.length} nodes · ${edges.length} edges · ${graph.additions.length} ADD</text><text class="legend" y="24">ROOT cyan · HUB amber · BRIDGE blue · LEAF gray · ADD violet · radial distance ≈ graph depth · sector = weak family bias</text><text class="legend" y="44">Proposal only; structural QA, not the production encyclopedia layout.</text></g>
</svg>\n`;
if(process.argv.includes('--check')){
  let current='';try{current=await readFile(outputUrl,'utf8');}catch{}
  if(current!==svg){console.error('molecule-graph-proposed.svg is stale. Run node scripts/export-molecule-graph-proposal.mjs');process.exit(1);}
  console.log(`Molecule graph SVG is current (${nodes.length} nodes / ${edges.length} edges).`);
}else{
  await mkdir(new URL('docs/maps/',root),{recursive:true});
  await writeFile(outputUrl,svg);
  console.log(`Wrote docs/maps/molecule-graph-proposed.svg (${nodes.length} nodes / ${edges.length} edges).`);
}
