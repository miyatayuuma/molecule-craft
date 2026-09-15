import fs from 'node:fs';
const path='src/encyclopedia-graph-view.js';
let text=fs.readFileSync(path,'utf8');
const from="const addChevron=(edge,visual)=>{const geometry=graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter,focusDiameter});if(!geometry)return;const chevron=svgEl(document,'polyline',{points:geometry.points,class:`graph-edge-chevron ${visual.relationClass}`,'data-edge-source':edge.from,'data-edge-target':edge.to,'data-relation':visual.relation});svg.append(chevron);";
const to="const addChevron=(edge,visual)=>{const geometry=graphEdgeChevronGeometry(edge,positions,{focusId,nodeDiameter,focusDiameter});if(!geometry)return;const chevron=svgEl(document,'polyline',{points:geometry.points,class:`graph-edge-chevron ${visual.relationClass}`});chevron.dataset.edgeSource=edge.from;chevron.dataset.edgeTarget=edge.to;chevron.dataset.relation=visual.relation;svg.append(chevron);";
if(!text.includes(from))throw new Error('Chevron attribute target not found');
text=text.replace(from,to);
fs.writeFileSync(path,text);
