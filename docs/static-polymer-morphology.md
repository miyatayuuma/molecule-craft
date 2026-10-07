# Static polymer morphology

This is a representative, completed mesoscale material view. It does not claim a unique morphology for a polymer: molecular weight, tacticity, copolymer composition, temperature history, solvent and processing can change the observed structure. The profile qualification below is part of the production authority in `src/polymer-morphology-authority.js`; the table is its human-readable mirror.

The renderer shares five shape grammars. Semicrystalline plans place uneven local ordered patches among disordered chains. Amorphous plans use broad persistent loops. Flexible-chain plans use open, soft coils. Rigid/cohesive plans use longer local spans with loose association, without depicting manufactured fiber. The network plan uses a connected irregular graph with shared junctions. All plans are seeded and bounded; no molecular-dynamics or construction animation runs.

| Polymer | Archetype | Visual signature | Qualification |
|---|---|---|---|
| `polyethylene` | Semicrystalline domains | Flexible local lamellae and longer tie-like chains | Representative only; ordering depends on processing. |
| `polypropylene` | Semicrystalline domains | Bulkier contour turns through uneven ordered patches | Tacticity is unspecified. |
| `ethylene-propylene-copolymer` | Flexible coil ensemble | Mixed soft coils with intermittent contour character | No alternating or block sequence is asserted. |
| `polyisobutylene` | Flexible coil ensemble | Broad, loose coils | No molecular-weight distribution is assigned. |
| `polystyrene` | Amorphous entanglement | Bulky, broad amorphous loops | No crystal domains or processing state is asserted. |
| `polyvinyl-chloride` | Amorphous entanglement | Shorter persistent spans in a disordered ensemble | Tacticity and plasticizer state are unspecified. |
| `polychlorotrifluoroethylene` | Semicrystalline domains | Fluorinated local ordered patches with uneven boundaries | Crystallinity depends on grade and thermal history. |
| `polyacrylonitrile` | Rigid/cohesive ensemble | Persistent polar chains with loose local association | PAN polymer only; not carbonized or drawn fiber. |
| `polyacrylic-acid` | Flexible coil ensemble | Flexible polar-chain coils | Ionization, solvent and hydrogen-bond state are unspecified. |
| `polyethylene-oxide` | Semicrystalline domains | Flexible chains with modest local ordering | Crystallinity varies with molecular weight and conditions. |
| `polyethylene-terephthalate` | Rigid/cohesive ensemble | Persistent aromatic-containing spans with loose association | No drawn textile fiber or processing texture is shown. |
| `polyethylene-adipate` | Semicrystalline domains | Flexible ester chains with small uneven ordered patches | Crystallization is condition-dependent. |
| `polylactic-acid` | Semicrystalline domains | Local ordering mixed with disordered spans | Stereochemistry and thermal history are unspecified. |
| `polyglycolic-acid` | Semicrystalline domains | Compact local association across irregular domains | No manufactured fiber form is implied. |
| `phenol-formaldehyde-resin` | Connected network | Irregular 3D graph with explicit shared junctions | Route topology only; no additional curing chemistry is added. |
| `polyethylene-adipamide` | Rigid/cohesive ensemble | Persistent polyamide chains with local association | No drawn fiber or unique crystal form is claimed. |
| `polybutadiene` | Flexible coil ensemble | Loose, flexible unvulcanized coils | Sulfur crosslinks and curing are absent. |
| `styrene-butadiene-copolymer` | Flexible coil ensemble | Mixed soft coils with intermittent bulky contour accents | Sequence and vulcanization are unspecified. |
| `nitrile-butadiene-rubber` | Flexible coil ensemble | Flexible mixed coils with sparse polar association accents | Sequence, solvent and curing state are unspecified. |
| `polyisoprene` | Flexible coil ensemble | Long, broad unvulcanized coils | No sulfur-crosslinked network is shown. |
| `butyl-rubber` | Flexible coil ensemble | Loose bulky mixed-chain coils | Exact sequence and vulcanization are unspecified. |
| `polyvinylidene-fluoride` | Semicrystalline domains | Fluorinated local association among disordered chains | Phase and crystallinity depend on processing. |
| `vinylidene-fluoride-hexafluoropropylene-copolymer` | Flexible coil ensemble | Flexible fluorinated coils with interrupted local order | No exact sequence or phase fraction is asserted. |
| `polytetrafluoroethylene` | Semicrystalline domains | Persistent local ordered patches at varied orientations | Morphology depends on grade and processing. |
| `nylon-6-6` | Rigid/cohesive ensemble | Persistent polyamide chains with cohesive local association | No drawn textile fiber or fixed crystallite form is shown. |

## Rendering contract

- `src/polymer-morphology-authority.js` owns the one-to-one 25-polymer mapping.
- `src/polymer-morphology-plan.js` creates stable seeded plans with the actual connected hero member, bounds and rendering counters.
- `src/polymer-morphology-renderer.js` turns those plans into static, shared-buffer tube geometry and, for the network, shared-junction instances.
- `src/reaction-lab-viewer.js` uses the production renderer for the PE Task③ handoff after the existing long-chain hold. Other polymers do not start production morphology. The independent localhost-only `window.__reactionLabProbe.showMorphologyPreview()` contract remains available with `reactionLabTest=1`; preview cleanup restores the existing world, camera and viewer state.
- Production morphology is a completed static plan revealed as a whole. Task③ temporarily transfers ownership of the existing PE chain to the plan's `heroStrand` using only translation, rotation and uniform scale; it does not grow member chains or change chemistry. The representation transition and scientific scope are documented in `docs/polymer-morphology-bridge.md`.

The deterministic, geometry, resource and network checks are in `tests/polymer-morphology.test.mjs`. Static mobile and desktop production-context screenshots are produced by `tests/polymer-morphology-browser.test.mjs` and checked in under `docs/evidence/static-polymer-morphology/` (390×844 and 1280×900 for each review polymer).
