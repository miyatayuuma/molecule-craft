// v8.5: preserve v8.4-safe behavior and improve multiple-bond readability.
const safeUrl = new URL('./app-v8-4-safe.js', import.meta.url);
const wrapperUrl = new URL('./app-v8-4.js', import.meta.url).href;
const appUrl = new URL('./app-v8.js', import.meta.url).href;
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(safeUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8.4-safe: ${response.status}`);
let loader = await response.text();

// This wrapper itself runs from a Blob, so make every local URL absolute.
loader = loader
  .replace("const wrapperUrl = new URL('./app-v8-4.js', import.meta.url);", `const wrapperUrl = new URL('${wrapperUrl}');`)
  .replace("const appUrl = new URL('./app-v8.js', import.meta.url).href;", `const appUrl = '${appUrl}';`)
  .replace("const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;", `const chemistryUrl = '${chemistryUrl}';`)
  .replace("const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;", `const bondingUrl = '${bondingUrl}';`);

const visualPatch = `
// v8.5 visual patch: keep chemical bond lengths unchanged; only change rendering.
code = code
  .replace(
    "const offsets=bond.order===1?[0]:bond.order===2?[-.06,.06]:[-.10,0,.10];",
    "const offsets=bond.order===1?[0]:bond.order===2?[-.09,.09]:[-.16,0,.16];"
  )
  .replace(
    "const baseColor=bond.order===1?0x94a3b8:bond.order===2?0xf59e0b:0xa78bfa;",
    "const baseColor=bond.order===1?0x94a3b8:bond.order===2?0xfbbf24:0xf472b6;"
  )
  .replace(
    "const shift=side.clone().multiplyScalar(offset),radius=(active?.036:.028)*(1-damage*.62),opacity=1-damage*.52;",
    "const shift=side.clone().multiplyScalar(offset),baseRadius=active?.034:(bond.order===1?.021:bond.order===2?.025:.027),radius=baseRadius*(1-damage*.62),opacity=1-damage*.52;"
  )
  .replace(
    "if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.009,radius),color,opacity);mesh.userData={bondKey:key};moleculeGroup.add(mesh);}",
    "if(damage<.82){const mesh=cylinderBetween(start.clone().add(shift),end.clone().add(shift),Math.max(.009,radius),color,opacity);mesh.userData={bondKey:key};if(bond.order>1&&!active){mesh.material.emissive=new THREE.Color(color);mesh.material.emissiveIntensity=bond.order===2?.34:.46;}moleculeGroup.add(mesh);}"
  )
  .replace(
    "const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*.095)",
    "const center=start.clone().lerp(end,.5);for(let pair=0;pair<bond.order;pair++){const pairSpacing=bond.order===1?.095:bond.order===2?.14:.16;const lateral=side.clone().multiplyScalar((pair-(bond.order-1)/2)*pairSpacing)"
  );
`;

const insertionPoint = "const blob = new Blob([code], { type: 'text/javascript' });";
if (!loader.includes(insertionPoint)) throw new Error('v8.4-safe loader signature not found');
loader = loader.replace(insertionPoint, `${visualPatch}\n${insertionPoint}`);

const blob = new Blob([loader], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
