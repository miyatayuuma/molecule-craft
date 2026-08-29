// v8.3: safe hotfix. Preserve the v8 engine and palette; only change
// selected-atom attachment and atom deletion interaction policy.
const sourceUrl = new URL('./app-v8.js', import.meta.url);
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8 engine: ${response.status}`);
let source = await response.text();

source = source
  .replace("from './chemistry.js'", `from '${chemistryUrl}'`)
  .replace("from './bonding-model.js'", `from '${bondingUrl}'`);

// One palette tap = one atom. If selected atom is full, spawn a free atom.
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
const attachPattern = /function attachToSelected\(symbol, centerId\) \{[\s\S]*?\n\}\n\nfunction attachmentDirections/;
if (!attachPattern.test(source)) throw new Error('Attachment policy signature not found');
source = source.replace(attachPattern, attachReplacement);

// Atom taps select only. No repeated-tap atom damage.
const atomTapReplacement = `function handleAtomTap(id){
  selectedAtomId=id;
  atomTapState.clear();
  atomTapState.set(id,{count:1,time:performance.now()});
  pulse(\`${'${atomById(id)?.element??\'\'}'} を選択 · 元素ボタンでここへ追加\`);
}

function chooseTorsionForAtom`;
const atomTapPattern = /function handleAtomTap\(id\)\{[\s\S]*?\n\}\n\nfunction chooseTorsionForAtom/;
if (!atomTapPattern.test(source)) throw new Error('Atom tap signature not found');
source = source.replace(atomTapPattern, atomTapReplacement);

// Delete button removes the selected atom immediately. No damage/crack/mist staging.
const deletePattern = /document\.querySelector\('#delete-selected'\)\?\.addEventListener\('click', \(\) => \{[\s\S]*?\n  \}\);/;
const deleteReplacement = `document.querySelector('#delete-selected')?.addEventListener('click', () => {
    if (selectedAtomId == null) return;
    const id = selectedAtomId;
    const atom = atomById(id);
    if (!atom) return;
    molecule.removeAtom(id);
    placements.delete(id);
    atomDamage.delete(id);
    atomTapState.delete(id);
    selectedAtomId = null;
    lastCelebrated = '';
    settleMolecule(30);
    pulse(\`${'${atom.element}'} を削除しました\`);
    if (navigator.vibrate) navigator.vibrate(12);
    refresh();
  });`;
if (!deletePattern.test(source)) throw new Error('Delete button signature not found');
source = source.replace(deletePattern, deleteReplacement);

const blob = new Blob([source], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
