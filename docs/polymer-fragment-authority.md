# Polymer Fragment Authority — Task⑥

## Scope and authority

`data/polymer-fragment-authority.json` is the chemical-structure source for the 25 encyclopedia polymers. It contains source-mapped local fragments and route-derived repeat templates; it does not contain layout coordinates or rendered images. It validates one-to-one IDs against the catalog, routes and encyclopedia entries, and records each current encyclopedia number. Task④'s Sections E–H in `docs/planning/polymer-presentation-rebaseline.md` remain the planning contract.

The authority is pinned to source commit `3050fed9c89f16aed19c2323db94fef5f9f9765e`. Source molecule atoms and bonds are mapped from `data/molecules.json`. Route family and representative-sequence references come from `data/polymerization-routes.json`; actual graph edits are verified against `src/reaction-lab-polymerization.js` and `src/reaction-graph-edits.js`. Catalog class and topology map through `data/polymers.json` and `src/polymer-catalog.js`.

Twenty-four records are route-derived (`19 linear-repeat`, `5 copolymer-local-motif`). The phenol-formaldehyde record is an independent encyclopedia network motif because its finite gameplay sample has no declared network continuations. That motif never claims to be the gameplay sample. No production chemistry, sample lifecycle, viewer, morphology renderer or SVG asset is imported by the authority validator.

## Verification matrix

Every row was reviewed against its mapped source molecule(s), route transformations, backbone, labeled groups, boundary ports, qualifiers and overall local chemical plausibility. Atom and bond counts include explicitly mapped hydrogens retained in the drawing fragment.

| polymerId / routeId | Structural type; mapped local structure | Backbone and continuation | Functional or side-chain groups | Qualifiers and Task⑦ instructions |
|---|---|---|---|---|
| `polyethylene` / `polyethylene-coordination` | `linear-repeat`; ethene-derived –CH₂–CH₂– (6 atoms, 5 bonds) | Two backbone C atoms; left/right single C–C ports | None | No tacticity or stereochemistry claim; repeat template is not the finite four-unit sample. |
| `polypropylene` / `polypropylene-coordination` | `linear-repeat`; propene-derived –CH₂–CH(CH₃)– (9/8) | Two backbone C atoms; left/right C–C ports | Methyl substituent on one backbone carbon | Tacticity and stereochemistry unspecified; draw no wedges. |
| `ethylene-propylene-copolymer` / `ethylene-propylene-coordination` | `copolymer-local-motif`; route-local ethene → propene → ethene (21/20) | Six backbone C atoms; two segment-boundary C–C ports | Propene-derived methyl substituent | This is the route's local example only. Do not infer random/alternating/block architecture or a bulk ratio. |
| `polyisobutylene` / `polyisobutylene-cationic` | `linear-repeat`; isobutene-derived –CH₂–C(CH₃)₂– (12/11) | Two backbone C atoms; left/right C–C ports | Two geminal methyl substituents | No tacticity or stereochemistry assignment. |
| `polystyrene` / `polystyrene-radical` | `linear-repeat`; styrene-derived –CH₂–CH(phenyl)– (16/16) | Two vinyl backbone C atoms; left/right C–C ports | Pendant phenyl ring, source atoms 0–5 | Tacticity unspecified; phenyl is a side group, never part of the backbone. |
| `polyvinyl-chloride` / `polyvinyl-chloride-radical` | `linear-repeat`; vinyl chloride-derived –CH₂–CH(Cl)– (6/5) | Two backbone C atoms; left/right C–C ports | Covalent chlorine substituent | Tacticity and stereochemistry unassigned. |
| `polychlorotrifluoroethylene` / `polychlorotrifluoroethylene-radical` | `linear-repeat`; chlorotrifluoroethylene-derived C₂F₃Cl (6/5) | Two backbone C atoms; left/right C–C ports | Source-mapped F and Cl positions | Halogen positions come from the monomer graph; no stereochemistry claim. |
| `polyacrylonitrile` / `polyacrylonitrile-radical` | `linear-repeat`; acrylonitrile-derived –CH₂–CH(C≡N)– (7/6) | Two backbone C atoms; left/right C–C ports | Nitrile group | Tacticity unspecified; triple bond remains N≡C. |
| `polyacrylic-acid` / `polyacrylic-acid-radical` | `linear-repeat`; acrylic-acid-derived –CH₂–CH(COOH)– (9/8) | Two backbone C atoms; left/right C–C ports | Pendant carboxylic acid in the acid form | Tacticity unspecified; retain C=O and acid O–H bond order/placement. |
| `polyethylene-oxide` / `polyethylene-oxide-anionic-ring-opening` | `linear-repeat`; ethylene oxide ring-opening gives –CH₂–CH₂–O– (7/6) | Two backbone C atoms plus backbone O; left/right ether C–O ports | Backbone ether oxygen | Ring-opened topology; do not draw a closed epoxide ring. |
| `polyethylene-terephthalate` / `polyethylene-terephthalate-direct-polycondensation` | `linear-repeat`; terephthalic-acid + ethylene-glycol residues (22/22) | 12 backbone atoms; left/right ester C–O boundary ports | Aromatic terephthalate residue; ester links inside and across the repeat boundary | Explicit diacid/diol residue mapping; finite sample end groups are not the repeat template. |
| `polyethylene-adipate` / `polyethylene-adipate-direct-polycondensation` | `linear-repeat`; adipic-acid + ethylene-glycol residues (24/23) | 10 backbone atoms; left/right ester C–O boundary ports | Two ester linkages; aliphatic adipate residue | Preserve carbonyl orientation and acid/alcohol residue boundaries. |
| `polylactic-acid` / `polylactic-acid-direct-polycondensation` | `linear-repeat`; lactic-acid-derived –O–CH(CH₃)–C(O)– (9/8) | Three backbone atoms; left/right ester C–O ports | Methyl substituent; ester boundary | L/D configuration unspecified; no wedges and no single stereoisomer claim. |
| `polyglycolic-acid` / `polyglycolic-acid-direct-polycondensation` | `linear-repeat`; glycolic-acid-derived –O–CH₂–C(O)– (6/5) | Three backbone atoms; left/right ester C–O ports | Ester boundary | Acid/alcohol condensation boundary retained. |
| `phenol-formaldehyde-resin` / `phenol-formaldehyde-resole` | `network-junction`; independent four-phenol / three-methylene local motif (52/55) | No linear backbone; three outward ortho continuation ports | Four phenolic hydroxyls; three formaldehyde-derived methylene bridges | Independent literature-backed motif; selected local ortho/para example, not a unique cured resin or gameplay sample. See network report below. |
| `polyethylene-adipamide` / `polyethylene-adipamide-direct-polycondensation` | `linear-repeat`; adipic-acid + ethylenediamine residues (26/25) | 10 backbone atoms; left/right amide C–N ports | Amide linkages inside and across the repeat boundary | Preserve carbonyl C–N orientation and explicit diamine/diacid residue grouping. |
| `polybutadiene` / `polybutadiene-coordination-1-4` | `linear-repeat`; 1,4-addition –CH₂–CH=CH–CH₂– (10/9) | Four backbone C atoms; left/right C–C ports | Residual backbone C=C | Local 1,4 motif only; bulk regiosequence and cis/trans microstructure unspecified. No vulcanization or crosslink implied. |
| `styrene-butadiene-copolymer` / `styrene-butadiene-radical` | `copolymer-local-motif`; route-local 1,4-butadiene → styrene → 1,4-butadiene (36/36) | Ten backbone C atoms; two outer C–C ports | Two residual butadiene C=C groups; pendant styrene phenyl ring | Per-monomer site matching uses diene transforms for butadiene and the vinyl transform for styrene. Local route sequence only; bulk composition, butadiene microstructure, cis/trans and vulcanization unassigned. |
| `nitrile-butadiene-rubber` / `nitrile-butadiene-radical` | `copolymer-local-motif`; route-local 1,4-butadiene → acrylonitrile → 1,4-butadiene (27/26) | Ten backbone C atoms; two outer C–C ports | Nitrile group; two residual butadiene C=C groups | Local example only; no copolymer ratio, bulk sequence, cis/trans ratio or vulcanization state asserted. |
| `polyisoprene` / `polyisoprene-coordination-1-4` | `linear-repeat`; 1,4-addition –CH₂–C(CH₃)=CH–CH₂– (13/12) | Four backbone C atoms; left/right C–C ports | Methyl substituent; residual backbone C=C | Local 1,4 motif; cis/trans unspecified; no vulcanization or crosslink implied. |
| `butyl-rubber` / `butyl-rubber-cationic` | `copolymer-local-motif`; route-local isobutene → isoprene → isobutene (37/36) | Eight backbone C atoms; two outer C–C ports | Isobutene gem-dimethyl groups; isoprene methyl and residual C=C | Local sequence is not the material's composition ratio. Diene microstructure and vulcanization unspecified; no crosslink implied. |
| `polyvinylidene-fluoride` / `polyvinylidene-fluoride-radical` | `linear-repeat`; source-mapped C₂H₂F₂ (6/5) | Two backbone C atoms; left/right C–C ports | Two covalent F substituents on the source-mapped carbon | Regiochemistry varies; no crystal phase or stereochemistry selected. |
| `vinylidene-fluoride-hexafluoropropylene-copolymer` / `vinylidene-fluoride-hexafluoropropylene-radical` | `copolymer-local-motif`; route-local VDF → HFP → VDF (21/20) | Six backbone C atoms; first link is VDF `a0`–HFP `a0`; left continuation is VDF `a1` | Source-mapped F substituents on both components | Local sequence and representative regio arrangement only; no bulk composition, ratio or crystal phase claim. |
| `polytetrafluoroethylene` / `polytetrafluoroethylene-radical` | `linear-repeat`; tetrafluoroethylene-derived –CF₂–CF₂– (6/5) | Two backbone C atoms; left/right C–C ports | Four covalent F substituents | Source-mapped F count/positions; no stereochemical claim. |
| `nylon-6-6` / `nylon-6-6-direct-polycondensation` | `linear-repeat`; hexamethylenediamine + adipic-acid residues (38/37) | 14 backbone atoms; left/right amide C–N ports | Amide links inside and across repeat boundary | Explicit six- and four-methylene residue counts; finite route sample end groups are not the repeat template. |

Each record's `review.checks` contains seven individual entries with `status: "pass"`, a polymer-specific result, and evidence references: source monomer, route transform, backbone, functional groups, repeat or local ports, stereochemistry/regiochemistry, and overall plausibility. The validator rejects missing checks, non-PASS checks, empty results, and missing evidence references. `reviewScope` distinguishes this local structural review from claims about commercial composition or bulk material state.

## Network exception report: phenol-formaldehyde resole

The route `phenol-formaldehyde-resole` produces a finite gameplay graph without declared network continuation ports. That graph is not relabeled or extended. The encyclopedia motif is a separate, source-mapped structure with `source.kind = independent-encyclopedia-motif` and `routeSampleRelation = independent-motif-not-gameplay-polymer-sample`.

The motif contains a central phenol ring and three phenol arms joined by three formaldehyde-derived methylene carbons. The source phenol map is explicit: ring carbon 0 bears O6–H12; ortho sites are carbons 1 and 5; para is carbon 3. The central phenol uses its two ortho and one para sites (1, 5, 3) for the three bridges. Each arm is attached at its para carbon 3 and has an outward continuation at its mapped ortho carbon 1. The three bridge paths each run central Ar–CH₂–arm Ar, then around the arm ring to the ortho continuation atom.

For each bridge, formaldehyde source C0 is retained with H2 and H3. Formaldehyde O1 plus the two site hydrogens from the core and arm are accounted for as one water byproduct. The displaced arm ortho H7 is accounted for separately as the network boundary displacement represented by that continuation port. Each port means one future external single C–C bond. This makes the local graph valence-complete without adding hydrogens or bonds that are absent from the finite sample.

The current graph has three distinct connected branch paths and ports, valid source mappings, alternating phenolic ring bond orders, retained phenolic O–H bonds, three explicit water maps, and neutral-valence accounting. It has no linear backbone. It is one possible ortho/para methylene-linked local junction, not the unique structure of a fully cured resin; the drawing must retain that limitation and must not imply cure state or bulk network density.

Independent structural sources recorded on the motif:

- [Environment and Climate Change Canada / Health Canada, *Screening assessment — Phenol-formaldehyde resins group*](https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/screening-assessment-phenol-formaldehyde-resins-group.html): phenolic rings can be carbon-linked through ortho/para sites by formaldehyde-derived carbon; commercial structures vary.
- [P. W. King, R. H. Mitchell & A. R. Westwood (1974), *Structural analysis of phenolic resole resins*, DOI 10.1002/app.1974.070180412](https://doi.org/10.1002/app.1974.070180412): methylene and methylene-ether bridge structures depend on F/P ratio and catalyst.
- [S. So & A. Rudin (1990), *Analysis of the formation and curing reactions of resole phenolics*, DOI 10.1002/app.1990.070410118](https://doi.org/10.1002/app.1990.070410118): ortho/para methylolation and methylene versus ether linkages depend on catalyst, pH and cure chemistry.

These sources support the local linkage choice and its limitations. They do not establish that this particular finite motif is the unique or fully cured network architecture.

## Bond, atom and grouping schema

`data/polymer-fragment-authority.json` uses schema version 1.

- Each record carries its current `encyclopediaNumber`. Each atom has a stable local `id`, `element`, `formalCharge`, `role` and `source` reference (`componentRef`, `moleculeId`, `atomIndex`). Explicit hydrogens are retained unless a reaction-derived water or open boundary displaces them.
- Each bond has endpoints `a`/`b`, integer `order` 1–3 and provenance. Source bonds point back to a source molecule bond index. Route-transformed and route-formed bonds point to the exact transformation operation and route. Independent motif bonds point to cited structural sources and an authored operation.
- Each source component declares its molecule, sequence index where applicable and source atom count. Every source atom must be mapped once to a retained graph atom or an explicitly excluded atom with reason. Water groups map one O and two H source atoms.
- `backboneAtomRefs`, `sideChains`, `functionalGroups`, `repeatGroups` and `componentGroups` refer to stable local atom IDs. Each component group identifies its `sourceComponentRef`. Linear repeats cover every graph atom once with repeat grouping. Copolymers cover every atom once with component grouping and preserve the route's local sequence. Network records use junction and branch groups instead of a linear backbone.
- Continuation ports name the attached atom, direction/role, external bond order, required external valence, partner element and connection type. Boundary valence is included in neutral-valence checks. It is not a radical or hydrogen cap.
- `qualifiers` carry stereo, tacticity, cis/trans, diene microstructure, regiochemistry, local-sequence, bulk-composition, molecular-weight-distribution, vulcanization and crosslinking status. An unspecified stereo status also requires `drawing = no-stereo-wedges`.
- No 3D coordinates, pixel positions, morphology archetypes, `heroStrand`, synthetic long chain, renderer output, or runtime camera state is stored.

## Task⑦ validated drawing-input contract

Load and validate the authority and current sources with:

```sh
node scripts/polymer-fragment-authority.mjs
```

The script exits nonzero on the first-class diagnostics returned by `validatePolymerFragmentAuthority()`. Each diagnostic includes `code`, `polymerId`, `field` and a cause. `tests/polymer-fragment-authority.test.mjs` covers positive population and determinism plus deliberate corruptions.

For a renderer, import `readPolymerFragmentSources()` and pass one requested ID to `createPolymerDrawingInput(authority, polymerId, sources)`. That function validates the complete authority before returning an input with `validation.status = passed`. The input includes atom and bond graphs, backbone/junction atom refs, component/repeat/function/side-chain groups, continuation ports, sequence, qualifiers, caveats and source provenance. It contains no layout coordinates; Task⑦ can choose a 2D layout without changing the chemistry.

Renderer rules:

- Draw exactly the returned atoms and bonds, using the provided bond orders. Use source and local references only as provenance; do not invent atoms or repair an invalid graph.
- Use `backboneAtomRefs`, explicit group atom refs, and ports as authority for topology and labels. `repeatClosure` describes how one repeat joins the next; the graph itself remains one finite template.
- Treat `localSequence` as only the displayed local example. Never turn its order or count into a random/block/alternating claim or a commercial composition ratio.
- Do not add stereochemical wedges when qualifiers say unspecified. Keep cis/trans, tacticity, regioregularity and crystal phase unspecified when so marked.
- Treat `vulcanization = not-represented` and `crosslinking = not-implied` as explicit limits. For phenol-formaldehyde, show the independently reviewed local junction and three outward ports with its caveat; do not imply the gameplay sample or a unique cured resin.
- Do not depend on old morphology modules, a morphology renderer, bridge geometry, synthetic long-chain data, conformation simulation or camera state.

## Validation diagnostics and intended failures

The deterministic negative suite rejects unknown/duplicate IDs, missing source atoms, invalid/duplicate bonds, excess valence, bad ports or repeat boundaries, invalid component grouping, unsupported stereo or composition claims, incorrect diene residual C=C, a broken network path, fake phenolic ports, missing independent-source provenance, incorrect aromatic substitution, omitted or incomplete condensation-water mappings, the wrong VDF-HFP route link or continuation atom, and route/sample misrepresentation. Diagnostics are polymer- and field-specific.
