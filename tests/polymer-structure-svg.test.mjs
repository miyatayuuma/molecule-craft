import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ELEMENTS } from '../src/chemistry.js';
import {
  POLYMER_2D_PILOT_IDS, POLYMER_2D_ROLLOUT_IDS, POLYMER_2D_PRODUCTION_IDS, POLYMER_STRUCTURE_SVG_VERSION, createPolymerStructureLayout,
  generatePolymerStructureAssets, renderPolymerStructureSvg, validatePolymerStructureSvg
} from '../scripts/polymer-structure-svg.mjs';
import { createPolymerDrawingInput, readPolymerFragmentSources, validatePolymerFragmentAuthority } from '../scripts/polymer-fragment-authority.mjs';

const { authority, sources } = await readPolymerFragmentSources();
const authorityValidation = validatePolymerFragmentAuthority(authority, sources);
const inputFor = id => createPolymerDrawingInput(authority, id, sources);
const renderFor = id => {
  const input = inputFor(id);
  const record = sources.polymers.find(polymer => polymer.id === id);
  return { input, svg: renderPolymerStructureSvg(input, { polymerName: record?.nameJa }) };
};
const elementsOf = (svg, name) => [...svg.matchAll(new RegExp('<g class="' + name + '(?: [^"]*)?"([^>]*)>([\\s\\S]*?)</g>', 'g'))];
const validNesting = svg => {
  const stack = [];
  for (const match of svg.matchAll(/<\/?([A-Za-z][A-Za-z0-9:-]*)(?:\s[^<>]*?)?\/?>/g)) {
    if (match[0].startsWith('</')) {
      if (stack.pop() !== match[1]) return false;
    } else if (!match[0].endsWith('/>')) stack.push(match[1]);
  }
  return stack.length === 0;
};

test('Task⑥ authority is 25/25 and every pilot uses its validated drawing input', () => {
  assert.equal(authorityValidation.ok, true);
  assert.equal(authorityValidation.count, 25);
  assert.deepEqual(POLYMER_2D_PILOT_IDS, [
    'polyethylene', 'polypropylene', 'polyvinyl-chloride', 'polystyrene',
    'polyethylene-terephthalate', 'nylon-6-6', 'polytetrafluoroethylene',
    'styrene-butadiene-copolymer', 'phenol-formaldehyde-resin'
  ]);
  for (const id of POLYMER_2D_PILOT_IDS) assert.equal(inputFor(id).validation.status, 'passed', id);
});

test('nine pilot SVGs preserve all graph identity and bond orders with deterministic bytes', async () => {
  for (const id of POLYMER_2D_PILOT_IDS) {
    const result = renderFor(id), input = result.input, svg = result.svg;
    assert.equal(validNesting(svg), true, id);
    assert.equal(validatePolymerStructureSvg(svg, input).ok, true, id);
    assert.match(svg, /viewBox="0 0 960 540"/);
    assert.match(svg, /<title id="polymer-title">/);
    assert.match(svg, /<desc id="polymer-description">/);
    assert.ok(svg.includes('data-polymer-id="' + id + '"'));
    assert.ok(svg.includes('data-structure-source-commit="' + authority.sourceCommit + '"'));
    assert.ok(svg.includes('data-generator-version="' + POLYMER_STRUCTURE_SVG_VERSION + '"'));
    assert.doesNotMatch(svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/, id + ' must contain only XML 1.0 characters');
    assert.equal(elementsOf(svg, 'atom-map').length, input.atoms.filter(atom => atom.element !== 'H').length, id);
    const bonds = elementsOf(svg, 'bond');
    assert.equal(bonds.length, input.bonds.length, id);
    for (let index = 0; index < bonds.length; index++) {
      const order = Number(bonds[index][1].match(/data-bond-order="([123])"/)[1]);
      assert.equal((bonds[index][2].match(/<path\b/g) || []).length, order, id + ' bond ' + index);
    }
    for (const atom of input.atoms.filter(atom => atom.element === 'H')) {
      assert.ok(svg.includes('&quot;id&quot;:&quot;' + atom.id + '&quot;,&quot;element&quot;:&quot;H&quot;'), id + ' ' + atom.id);
    }
    assert.match(svg, /layoutCoordinates&quot;:&quot;deterministic 2D drawing positions; not molecular coordinates/);
    assert.doesNotMatch(svg, /href=|<image\s|<script|marker-end/);
    assert.equal(renderFor(id).svg, svg, id + ' output bytes are deterministic');
    assert.equal(await readFile(new URL('../assets/models/polymer-' + id + '.svg', import.meta.url), 'utf8'), svg, id + ' generated asset');
  }
});

test('heteroatom labels use the chemistry palette and explicit carbon-bound hydrogens stay mapped', () => {
  const polypropylene = renderFor('polypropylene');
  assert.match(polypropylene.svg, /data-display="condensed-atom"/);
  assert.match(polypropylene.svg, new RegExp('fill="' + ELEMENTS.C.color + '"'));
  assert.match(renderFor('polyvinyl-chloride').svg, new RegExp('fill="' + ELEMENTS.Cl.color + '"'));
  const ptfe = renderFor('polytetrafluoroethylene').svg;
  assert.equal((ptfe.match(/data-element="F"/g) || []).length, 4);
  assert.match(ptfe, new RegExp('fill="' + ELEMENTS.F.color + '"'));
  for (const atom of polypropylene.input.atoms.filter(atom => atom.element === 'H')) {
    assert.ok(polypropylene.svg.includes('&quot;id&quot;:&quot;' + atom.id + '&quot;,&quot;element&quot;:&quot;H&quot;'));
  }
});

test('linear aromatic polyester polyamide and fluorinated structures retain their presentation rules', () => {
  const pe = renderFor('polyethylene').svg;
  assert.match(pe, /class="repeat-bracket"/);
  assert.match(pe, /data-repeat-count-notation="true"[^>]*>n<\/text>/);
  assert.equal((pe.match(/class="continuation-port"/g) || []).length, 2);
  const ps = renderFor('polystyrene').svg;
  assert.equal((ps.match(/class="aromatic-ring"/g) || []).length, 1);
  assert.match(ps, /フェニル環は主鎖に結合した側鎖/);
  const psResult = renderFor('polystyrene'), psRing = createPolymerStructureLayout(psResult.input).rings[0].atomRefs;
  const psRingDouble = psResult.input.bonds.find(bond => psRing.includes(bond.a) && psRing.includes(bond.b) && bond.order === 2);
  const psBondStart = ps.indexOf(`data-bond-ref="${psRingDouble.a}::${psRingDouble.b}"`);
  const psBondEnd = ps.indexOf('</g>', psBondStart);
  const psBondPaths = [...ps.slice(psBondStart, psBondEnd).matchAll(/d="M(-?[\d.]+) (-?[\d.]+)L/g)].map(match => ({ x: Number(match[1]), y: Number(match[2]) }));
  assert.equal(psBondPaths.length, 2);
  assert.ok(Math.hypot(psBondPaths[0].x - psBondPaths[1].x, psBondPaths[0].y - psBondPaths[1].y) >= 6.9, 'aromatic double-bond strokes need visible separation');
  const pet = renderFor('polyethylene-terephthalate').svg;
  assert.equal((pet.match(/class="aromatic-ring"/g) || []).length, 1);
  assert.match(pet, /テレフタレート残基/);
  assert.match(pet, /エチレングリコール残基/);
  assert.ok((pet.match(/data-bond-order="2"/g) || []).length >= 4);
  const nylon = renderFor('nylon-6-6').svg;
  assert.match(nylon, /アジピン酸残基/);
  assert.match(nylon, /ヘキサメチレンジアミン残基/);
  assert.equal((nylon.match(/data-display="heteroatom-group"/g) || []).length, 2);
  assert.ok((nylon.match(/data-bond-order="2"/g) || []).length >= 2);
});

test('SBR stays a local sequence example without a fixed repeat or composition ratio', () => {
  const result = renderFor('styrene-butadiene-copolymer'), svg = result.svg;
  assert.equal(result.input.representationType, 'copolymer-local-motif');
  assert.equal((svg.match(/class="aromatic-ring"/g) || []).length, 1);
  assert.equal((svg.match(/class="continuation-port"/g) || []).length, 2);
  assert.doesNotMatch(svg, /class="repeat-bracket"|data-repeat-count-notation/);
  assert.match(svg, /局所配列例：ブタジエン → スチレン → ブタジエン/);
  assert.match(svg, /組成比や配列規則を示しません/);
  assert.match(svg, /cis\/trans は未指定です/);
  assert.match(svg, /data-bond-order="2"/);
});

test('phenol-formaldehyde keeps the separate four-ring three-bridge network motif and caveat', () => {
  const result = renderFor('phenol-formaldehyde-resin'), input = result.input, svg = result.svg;
  assert.equal(input.provenance.kind, 'independent-encyclopedia-motif');
  assert.equal(input.provenance.routeSampleRelation, 'independent-motif-not-gameplay-polymer-sample');
  assert.equal((svg.match(/class="aromatic-ring"/g) || []).length, 4);
  assert.equal((svg.match(/class="continuation-port"/g) || []).length, 3);
  assert.equal((svg.match(/>CH₂<\/text>/g) || []).length, 3);
  assert.equal((svg.match(/>OH<\/text>/g) || []).length, 4);
  assert.doesNotMatch(svg, /class="repeat-bracket"|data-repeat-count-notation/);
  assert.match(svg, /実際の樹脂全体の構造や硬化状態を一意に示すものではありません。/);
  assert.match(svg, /PolymerSampleと同一の構造ではありません/);
  assert.match(svg, /ca-resole-ortho-para-2020/);
  const layout = createPolymerStructureLayout(input);
  for (const arm of ['phenol-arm-1', 'phenol-arm-2', 'phenol-arm-3']) {
    const ring = layout.rings.find(item => item.atomRefs.every(ref => ref.startsWith(arm + '.')));
    const minY = Math.min(...ring.atomRefs.map(ref => layout.atomPositions[ref].y));
    const maxY = Math.max(...ring.atomRefs.map(ref => layout.atomPositions[ref].y));
    const hydroxyl = layout.labels[arm + '.a6'];
    assert.ok(hydroxyl.y < minY || hydroxyl.y > maxY, arm + ' hydroxyl must sit outside its aromatic ring');
  }
});

test('negative gates reject unvalidated graphs false qualifiers invalid ports and out-of-bounds layouts', () => {
  const base = inputFor('polyethylene');
  const failed = structuredClone(base); failed.validation.status = 'failed';
  assert.throws(() => renderPolymerStructureSvg(failed), /AUTHORITY_NOT_VALIDATED/);
  const badOrder = structuredClone(base); badOrder.bonds[0].order = 4;
  assert.throws(() => createPolymerStructureLayout(badOrder), /BOND_ORDER/);
  const missingAtom = structuredClone(base); missingAtom.bonds[0].a = 'missing.atom';
  assert.throws(() => createPolymerStructureLayout(missingAtom), /BOND_ATOM_REFERENCE/);
  const badPort = structuredClone(base); badPort.continuationPorts[0].atomRef = 'missing.atom';
  assert.throws(() => createPolymerStructureLayout(badPort), /CONTINUATION_PORT/);
  const badClosure = structuredClone(base); badClosure.repeatClosure = null;
  assert.throws(() => createPolymerStructureLayout(badClosure), /REPEAT_BOUNDARY/);
  const wedge = structuredClone(base); wedge.qualifiers.stereochemistry.drawing = 'wedge';
  assert.throws(() => createPolymerStructureLayout(wedge), /STEREO_DRAWING/);
  assert.throws(() => createPolymerDrawingInput(authority, 'unknown', sources), /No validated drawing authority/);
  const copolymer = inputFor('styrene-butadiene-copolymer'); copolymer.qualifiers.bulkComposition = 'fixed-1-to-1';
  assert.throws(() => createPolymerStructureLayout(copolymer), /COPOLYMER_QUALIFIERS/);
  const network = inputFor('phenol-formaldehyde-resin'); network.continuationPorts.pop();
  assert.throws(() => createPolymerStructureLayout(network), /NETWORK_BRANCHES/);
  const fakeSource = inputFor('phenol-formaldehyde-resin'); fakeSource.provenance.kind = 'route-derived-repeat';
  assert.throws(() => createPolymerStructureLayout(fakeSource), /LAYOUT_FAILED/);
  const layout = createPolymerStructureLayout(base); layout._positions.set('repeat.a0', { x: 1000, y: 80 });
  assert.throws(() => renderPolymerStructureSvg(base, { layout }), /DRAWING_BOUNDS/);
  const svg = renderFor('polyethylene').svg;
  assert.throws(() => validatePolymerStructureSvg(svg + '<image href="https://example.test/a.png"/>', base), /External or embedded SVG dependencies/);
  assert.throws(() => validatePolymerStructureSvg(svg.replace(/<title[\s\S]*?<\/title>/, ''), base), /Accessible title and description/);
  assert.throws(() => validatePolymerStructureSvg(svg.replace('<g class="chemical-bonds"', '<g data-invalid="\u0000" class="chemical-bonds"'), base), /XML 1.0 forbidden control characters/);
});

test('production asset generator covers all 25 validated polymer paths', async () => {
  const root = new URL('..', import.meta.url).pathname;
  const result = await generatePolymerStructureAssets({ root });
  assert.equal(result.authorityCount, 25);
  assert.deepEqual(result.generated, POLYMER_2D_PRODUCTION_IDS);
  assert.equal(result.generatorVersion, POLYMER_STRUCTURE_SVG_VERSION);
  assert.equal(POLYMER_2D_ROLLOUT_IDS.length, 16);
  assert.equal(new Set(POLYMER_2D_PRODUCTION_IDS).size, 25);
  assert.deepEqual(new Set(POLYMER_2D_PRODUCTION_IDS), new Set(sources.polymers.map(record => record.id)));
  await assert.rejects(() => generatePolymerStructureAssets({ root, polymerIds: ['polyethylene', 'not-cataloged'] }), /not-cataloged.*validated 25-polymer/);
});

test('Task⑧: all 16 rollout diagrams preserve source-mapped chemistry and caveats', () => {
  for (const id of POLYMER_2D_ROLLOUT_IDS) {
    const { input, svg } = renderFor(id);
    assert.equal(input.validation.status, 'passed', id);
    assert.equal(validatePolymerStructureSvg(svg, input).atoms, input.atoms.length, id);
    assert.equal((svg.match(/class="continuation-port"/g) ?? []).length, input.continuationPorts.length, id);
    assert.match(svg, /data-structure-source-commit=/, id);
    assert.match(svg, /aria-labelledby="polymer-title polymer-description"/, id);
    assert.equal(renderFor(id).svg, svg, id + ' byte deterministic');
    if (input.representationType === 'copolymer-local-motif') {
      assert.match(svg, /組成比や配列規則を示しません/, id);
      assert.doesNotMatch(svg, /data-repeat-count-notation="true"/, id);
    } else if (input.representationType === 'linear-repeat') {
      assert.match(svg, /data-repeat-count-notation="true"/, id);
    }
  }
});
