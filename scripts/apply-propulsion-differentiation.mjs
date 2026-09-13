import {readFile,writeFile,unlink} from 'node:fs/promises';

async function replaceOnce(path,before,after){
  const source=await readFile(path,'utf8');
  const first=source.indexOf(before);
  if(first<0)throw new Error(`Patch anchor missing: ${path}`);
  if(source.indexOf(before,first+before.length)>=0)throw new Error(`Patch anchor is not unique: ${path}`);
  await writeFile(path,source.slice(0,first)+after+source.slice(first+before.length));
}

const fieldContract=`export const ENVIRONMENT_RECOVERY_CONTRACT=Object.freeze({
  kind:'environment-recovery',pressure:'reduced-or-zero',ambientThermal:'reduced',opportunity:'stop-and-reorient',
  excludes:Object.freeze(['dust-eater-suppression','dust-eater-despawn','threat-decay-bonus','capture-immunity','forced-enemy-distance','instant-heat-reset','instant-fuel-recovery']),
});`;
await replaceOnce('src/veil/universe.js',fieldContract,`${fieldContract}
// Compact shears turn BURST's high initial acceleration into a spatial advantage.
// They sit on existing short/skill lines and keep longer bypass routes physically open.
export const BURST_ADVANTAGE_FIELDS=Object.freeze([
  Object.freeze({id:'h-boundary-shear',x:530,y:-3800,radius:110,phase:1.75,angle:0,force:2600,cleanHalfWidth:50,route:'h-boundary',kind:'burst-advantage'}),
  Object.freeze({id:'oxygen-shortcut-shear',x:-320,y:-9700,radius:105,phase:1.75,angle:0,force:2600,cleanHalfWidth:50,route:'oxygen-shortcut',kind:'burst-advantage'}),
  Object.freeze({id:'deep-skill-shear',x:100,y:-11450,radius:105,phase:1.75,angle:Math.PI,force:2600,cleanHalfWidth:50,route:'oxygen-deep-skill',kind:'burst-advantage'}),
]);`);

const fieldPush=`  map.fields.push({x:720,y:-5540,radius:210,phase:rng()*4,angle:-.4});`;
await replaceOnce('src/veil/universe.js',fieldPush,`${fieldPush}
  // Clone authored fields because the engine stores frame-local intensity/active state on them.
  for(const field of BURST_ADVANTAGE_FIELDS){
    map.fields.push({...field});
    map.labels.push({x:field.x+field.radius+28,y:field.y-field.radius-24,text:\`BURST ADV · \${field.id} · short shear / force \${field.force} / clean ±\${field.cleanHalfWidth}\`});
  }`);

const fieldPhysics=`    const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);if(d<field.radius){const strength=c.fieldForce*(1-(d/field.radius)**2)*field.intensity;force.x+=Math.cos(field.angle??.12)*strength;force.y+=Math.sin(field.angle??.12)*strength;}`;
await replaceOnce('src/veil/engine.js',fieldPhysics,`    const dx=p.x-field.x,dy=p.y-field.y,d=Math.hypot(dx,dy);if(d<field.radius){const fieldForce=Number.isFinite(field.force)?Math.max(0,field.force):c.fieldForce,strength=fieldForce*(1-(d/field.radius)**2)*field.intensity;force.x+=Math.cos(field.angle??.12)*strength;force.y+=Math.sin(field.angle??.12)*strength;}`);

const rendererIntensity=`      const intensity=f.intensity??.7;
      const fog=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);`;
await replaceOnce('src/veil/renderer.js',rendererIntensity,`      const intensity=f.intensity??.7,forceCue=clamp(Math.sqrt((f.force??VEIL.fieldForce)/VEIL.fieldForce),1,1.8);
      const fog=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,r);`);
const rendererLine=`        ctx.strokeStyle='#889bc3';ctx.lineWidth=i%3===0?2:1;ctx.globalAlpha=(.09+intensity*.12)*(1-Math.abs(band)/r);`;
await replaceOnce('src/veil/renderer.js',rendererLine,`        ctx.strokeStyle='#889bc3';ctx.lineWidth=(i%3===0?2:1)*forceCue;ctx.globalAlpha=Math.min(.42,(.09+intensity*.12)*forceCue)*(1-Math.abs(band)/r);`);

const exporterFields=`function mapFieldsSvg(universe){
  return universe.fields.map((field,index)=>\`<circle data-map-field="\${index}" data-angle="\${fmt(field.angle??0)}" cx="\${fmt(field.x)}" cy="\${fmt(field.y)}" r="\${fmt(field.radius)}"/>\`).join('\\n');
}`;
await replaceOnce('scripts/export-field-map.mjs',exporterFields,`function mapFieldsSvg(universe){
  return universe.fields.map((field,index)=>{
    const circle=\`<circle data-map-field="\${index}" data-field-id="\${escapeXml(field.id??'')}" data-angle="\${fmt(field.angle??0)}" data-force="\${fmt(field.force??VEIL.fieldForce)}" cx="\${fmt(field.x)}" cy="\${fmt(field.y)}" r="\${fmt(field.radius)}"/>\`;
    if(field.kind!=='burst-advantage')return circle;
    const angle=field.angle??0,length=field.radius*.82,x2=field.x+Math.cos(angle)*length,y2=field.y+Math.sin(angle)*length;
    return \`<g data-burst-advantage="\${escapeXml(field.id)}" data-route="\${escapeXml(field.route)}" data-force="\${fmt(field.force)}" data-clean-half-width="\${fmt(field.cleanHalfWidth)}">\${circle}<line x1="\${fmt(field.x)}" y1="\${fmt(field.y)}" x2="\${fmt(x2)}" y2="\${fmt(y2)}"/><text x="\${fmt(field.x+field.radius+26)}" y="\${fmt(field.y-field.radius-22)}">BURST ADV · \${escapeXml(field.id)} · short shear · clean ±\${fmt(field.cleanHalfWidth)}</text></g>\`;
  }).join('\\n');
}`);

const exporterStyle=`.element{fill:none;stroke-linecap:round;opacity:.72}.element-h{stroke:#79d2ee;stroke-width:5}.element-c{stroke:#c79a62;stroke-width:7}.element-o{stroke:#e19090;stroke-width:6}#layer-hazards-fields circle{fill:#9f8fd0;stroke:#c0b4ec;stroke-width:4;opacity:.16}#layer-hazards-pressure path{fill:#6f8db7;stroke:none}`;
await replaceOnce('scripts/export-field-map.mjs',exporterStyle,`.element{fill:none;stroke-linecap:round;opacity:.72}.element-h{stroke:#79d2ee;stroke-width:5}.element-c{stroke:#c79a62;stroke-width:7}.element-o{stroke:#e19090;stroke-width:6}#layer-hazards-fields circle{fill:#9f8fd0;stroke:#c0b4ec;stroke-width:4;opacity:.16}#layer-hazards-fields [data-burst-advantage] circle{fill:#d6a4ff;stroke:#f0d8ff;stroke-width:6;opacity:.3}#layer-hazards-fields [data-burst-advantage] line{stroke:#f3d6ff;stroke-width:8;stroke-linecap:round}#layer-hazards-fields [data-burst-advantage] text{font:28px ui-monospace,SFMono-Regular,Consolas,monospace;fill:#f4e6ff;paint-order:stroke;stroke:#101820;stroke-width:8}#layer-hazards-pressure path{fill:#6f8db7;stroke:none}`);

const testImport=`import {EXPEDITION,THERMAL,VEIL} from '../src/veil/config.js';`;
await replaceOnce('tests/propulsion-differentiation.test.mjs',testImport,`import {EXPEDITION,THERMAL,VEIL} from '../src/veil/config.js';
import {buildFieldMapSvg} from '../scripts/export-field-map.mjs';`);
const mapAssertionAnchor=`  for(const route of [...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES]){
    assert.equal(route.requiredCapability,undefined,\`\${route.id} must not become a hard capability gate\`);
    assert.equal(route.requires,undefined,\`\${route.id} must remain physically open\`);
  }
});`;
await replaceOnce('tests/propulsion-differentiation.test.mjs',mapAssertionAnchor,`  for(const route of [...OXYGEN_ROUTES,...DEEP_OXYGEN_ROUTES]){
    assert.equal(route.requiredCapability,undefined,\`\${route.id} must not become a hard capability gate\`);
    assert.equal(route.requires,undefined,\`\${route.id} must remain physically open\`);
  }
  const svg=buildFieldMapSvg();
  for(const field of BURST_ADVANTAGE_FIELDS){
    assert.match(svg,new RegExp(\`data-burst-advantage="\${field.id}"[^>]*data-route="\${field.route}"[^>]*data-force="\${field.force}"[^>]*data-clean-half-width="\${field.cleanHalfWidth}"\`),\`developer map must identify \${field.id}\`);
  }
});`);

await unlink('scripts/apply-propulsion-differentiation.mjs');
