// v8.2: v8 interaction engine with one-at-a-time attachment and no atom-tap destruction.
const sourceUrl = new URL('./app-v8.js', import.meta.url);
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8 engine: ${response.status}`);
let source = await response.text();

source = source
  .replace("from './chemistry.js'", `from '${chemistryUrl}'`)
  .replace("from './bonding-model.js'", `from '${bondingUrl}'`)
  .replace('const atomDamage = new Map();\n', '')
  .replace('const atomTapState = new Map();\n', '')
  .replace('const effectGroup = new THREE.Group();\n', '')
  .replace('scene.add(moleculeGroup, interactionGroup, effectGroup);', 'scene.add(moleculeGroup, interactionGroup);')
  .replace('molecule.clear(); placements.clear(); bondDamage.clear(); atomDamage.clear(); atomTapState.clear();', 'molecule.clear(); placements.clear(); bondDamage.clear();')
  .replace("const now = performance.now();\n    atomDamage.set(selectedAtomId, { damage: 0.86, lastHit: now, lastUpdate: now });\n    damageAtom(selectedAtomId, true);", "removeSelectedAtom();")
  .replace("} else if(isTap) {\n    handleAtomTap(state.atomId);\n  } else {", "} else if(isTap) {\n    selectedAtomId=state.atomId;\n    pulse(`${atomById(state.atomId)?.element??''} を選択 · 元素ボタンでここへ追加`);\n  } else {")
  .replace('updateEffects(now);', '');

const attachReplacement = `function attachToSelected(symbol, centerId) {
  const center = atomById(centerId);
  if (!center) return addFreeAtom(symbol);
  if (freeCapacity(centerId) <= 0) {
    pulse(\`${'${center.element}'} は満タン — ${'${symbol}'} を自由原子として追加\`);
    return addFreeAtom(symbol);
  }
  const centerPos = placements.get(centerId)?.position;
  if (!centerPos) return addFreeAtom(symbol);
  const direction = attachmentDirections(centerId, 1)[0] ?? new THREE.Vector3(1, 0, 0);
  const atom = molecule.addAtom(symbol);
  const dist = bondLengthByElements(center.element, symbol, 1) * 1.08;
  placements.set(atom.id, { position: centerPos.clone().add(direction.clone().multiplyScalar(dist)) });
  molecule.setBond(centerId, atom.id, 1);
  optimizeBondOrders(molecule, [...connectedComponent(centerId)]);
  settleMolecule(78);
  selectedAtomId = centerId;
  pulse(\`${'${symbol}'} を選択原子へ追加・結合\`);
  if (navigator.vibrate) navigator.vibrate(12);
  refresh();
}

function attachmentDirections`;
source = source.replace(/function attachToSelected\(symbol, centerId\) \{[\s\S]*?\n\}\n\nfunction attachmentDirections/, attachReplacement);

source = source.replace(/function handleAtomTap\(id\)\{[\s\S]*?\n\}\n\nfunction chooseTorsionForAtom/, 'function chooseTorsionForAtom');
source = source.replace(/function atomBreakTaps\(element\)\{[\s\S]*?function damageAtom\(id,force\)\{[\s\S]*?\nfunction recoverDamage/, 'function recoverDamage');
source = source.replace(/function spawnMist\(position,color\)\{[\s\S]*?\nfunction updateEffects\(now\)\{[\s\S]*?\n\nfunction settleMolecule/, 'function settleMolecule');
source = source.replace(/function addAtomCracks\(origin,radius,damage\)\{[\s\S]*?\nfunction addElectron/, 'function addElectron');

source = source.replace(/function recoverDamage\(now\)\{[\s\S]*?\n\nfunction settleMolecule/, `function recoverDamage(now){
  let changed=false;
  for(const[key,state]of[...bondDamage]){
    const d=currentDamage(state,now);
    if(d<=.002){bondDamage.delete(key);changed=true;}
    else if(Math.abs(d-state.damage)>.004){state.damage=d;state.lastUpdate=now;changed=true;}
  }
  if(changed)renderMolecule();
}

function removeSelectedAtom(){
  const id=selectedAtomId;
  const atom=atomById(id);
  if(!atom)return;
  molecule.removeAtom(id);
  placements.delete(id);
  selectedAtomId=null;
  lastCelebrated='';
  settleMolecule(30);
  pulse(`${atom.element} を削除しました`);
  if(navigator.vibrate)navigator.vibrate(12);
  refresh();
}

function settleMolecule`);

source = source.replace(/function renderAtom\(atom,flash\)\{[\s\S]*?\nfunction addAtomCracks/, `function renderAtom(atom,flash){
  const p=placements.get(atom.id);if(!p)return;
  const cfg=ELEMENTS[atom.element],selected=atom.id===selectedAtomId;
  const core=new THREE.Mesh(new THREE.SphereGeometry(cfg.radius*1.06,32,24),new THREE.MeshStandardMaterial({color:cfg.color,roughness:.22,metalness:.03,emissive:flash?0x38bdf8:selected?0x075985:0,emissiveIntensity:flash?.72:selected?.55:0}));
  core.position.copy(p.position);core.userData={atomCore:true,atomId:atom.id};moleculeGroup.add(core);
  if(selected){const ring=new THREE.Mesh(new THREE.TorusGeometry(cfg.radius*1.34,.022,10,34),new THREE.MeshBasicMaterial({color:0x7dd3fc,transparent:true,opacity:.72,depthTest:false}));ring.position.copy(p.position);ring.quaternion.copy(camera.quaternion);moleculeGroup.add(ring);}
  const used=molecule.bondOrderForAtom(atom.id),singles=unpairedElectronCount(atom.element,used),lps=lonePairCount(atom.element,used),total=Math.max(1,singles+lps+molecule.neighbors(atom.id).length),dirs=electronDirections(total),shellR=valenceShellRadius(atom.element,cfg.radius*1.02);
  for(let i=0;i<singles;i++)addElectron(atom.id,p.position,dirs[i%dirs.length],shellR,selected);
  for(let i=0;i<lps;i++)addLonePair(p.position,dirs[(singles+i)%dirs.length],shellR);
}
function addAtomCracks`);
source = source.replace(/function addAtomCracks\(origin,radius,damage\)\{[\s\S]*?\nfunction addElectron/, 'function addElectron');

if (source.includes('damageAtom(') || source.includes('atomDamage') || source.includes('handleAtomTap(')) {
  throw new Error('Atom destruction removal did not fully apply');
}

const blob = new Blob([source], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try { await import(blobUrl); } finally { URL.revokeObjectURL(blobUrl); }
