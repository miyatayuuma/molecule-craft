// v8.1 hotfix: keep the v8 interaction engine intact while replacing only
// the selected-atom attachment policy. This loader can be folded back into
// app-v8.js when the next structural revision is made.
const sourceUrl = new URL('./app-v8.js', import.meta.url);
const chemistryUrl = new URL('./chemistry.js', import.meta.url).href;
const bondingUrl = new URL('./bonding-model.js', import.meta.url).href;

const response = await fetch(sourceUrl, { cache: 'no-store' });
if (!response.ok) throw new Error(`Failed to load v8 engine: ${response.status}`);
let source = await response.text();

// A Blob module cannot resolve relative imports against the repository path,
// so make the two local module imports absolute before evaluating it.
source = source
  .replace("from './chemistry.js'", `from '${chemistryUrl}'`)
  .replace("from './bonding-model.js'", `from '${bondingUrl}'`);

const replacement = `function attachToSelected(symbol, centerId) {
  const center = atomById(centerId);
  if (!center) return addFreeAtom(symbol);

  // One palette tap always means one atom. Once the selected atom is full,
  // the same tap falls back to the normal floating-atom placement behavior.
  if (freeCapacity(centerId) <= 0) {
    pulse(\`${'${center.element}'} は満タン — ${'${symbol}'} を自由原子として追加\`);
    return addFreeAtom(symbol);
  }

  const centerPos = placements.get(centerId)?.position;
  if (!centerPos) return addFreeAtom(symbol);
  const direction = attachmentDirections(centerId, 1)[0] ?? new THREE.Vector3(1, 0, 0);
  const atom = molecule.addAtom(symbol);
  const dist = bondLengthByElements(center.element, symbol, 1) * 1.08;
  placements.set(atom.id, {
    position: centerPos.clone().add(direction.clone().multiplyScalar(dist)),
  });

  // Connect immediately, then let the valence solver decide whether the
  // chemically preferred final bond order is single/double/triple.
  molecule.setBond(centerId, atom.id, 1);
  optimizeBondOrders(molecule, [...connectedComponent(centerId)]);
  settleMolecule(78);

  // Keep the original atom selected so repeated taps fill it one atom at a time.
  selectedAtomId = centerId;
  pulse(\`${'${symbol}'} を選択原子へ追加・結合\`);
  if (navigator.vibrate) navigator.vibrate(12);
  refresh();
}

function attachmentDirections`;

const pattern = /function attachToSelected\(symbol, centerId\) \{[\s\S]*?\n\}\n\nfunction attachmentDirections/;
if (!pattern.test(source)) throw new Error('v8 attachment policy signature not found');
source = source.replace(pattern, replacement);

const blob = new Blob([source], { type: 'text/javascript' });
const blobUrl = URL.createObjectURL(blob);
try {
  await import(blobUrl);
} finally {
  URL.revokeObjectURL(blobUrl);
}
