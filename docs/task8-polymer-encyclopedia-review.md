# Task⑧ Polymer Encyclopedia Review Record

## Scope and authority

This is the per-entry structural, content and visual review record for Task⑧. Chemical identity, atom/bond graph, repeat/component grouping, continuations and qualifiers remain governed by `data/polymer-fragment-authority.json` (Task⑥). Layout hints alter drawing orientation only. The figures are local 2D structural examples; they do not represent a whole polymer sample, bulk morphology, molecular-weight distribution or a unique material grade.

The renderer is `task8-2d-v4`. Its VDF/HFP drawing hint rotates the mapped F branches at `unit-1.a1` by 150°; it changes neither atom/bond authority nor component sequence. The prior 60° layout showed a crowded central HFP branch in the actual screenshot review, so the diagram was corrected and all 25 assets were regenerated.

## Per-polymer review matrix

For each row, the structural review checks atom/bond identity, element labels, bond order, functional groups, main-chain readability, grouping, repeat boundaries or local sequence, continuation ports, qualifiers and clipping. The content review checks structure explanation, structure–property cause, representative applications, limits and consistency with the figure. The mobile and desktop columns are marked after the current Task⑧ Chromium artifact has been visually reviewed.

| # | Polymer ID | Polymer-specific focal review | Visual review, 390×844 / 1280×900 | Figure/content review |
|---:|---|---|---|---|
| 1 | `polyethylene` | Carbon main chain; –CH₂–CH₂– bracket, *n* and two continuation ports | PASS (390×844 and 1280×900) | PASS |
| 2 | `polypropylene` | Methyl branch on alternating backbone carbon; no tacticity assertion | PASS (390×844 and 1280×900) | PASS |
| 3 | `polyvinyl-chloride` | Backbone C–Cl substituent placement | PASS (390×844 and 1280×900) | PASS |
| 4 | `polystyrene` | Pendant phenyl ring; aromatic bond pattern distinct from backbone | PASS (390×844 and 1280×900) | PASS |
| 5 | `polyethylene-terephthalate` | Terephthalate and ethylene-glycol residues; ester and carbonyl bonds | PASS (390×844 and 1280×900) | PASS |
| 6 | `nylon-6-6` | Hexamethylene/adipate residues; amide N–H and carbonyl | PASS (390×844 and 1280×900) | PASS |
| 7 | `polytetrafluoroethylene` | –CF₂–CF₂– repeat with four correctly mapped F substituents | PASS (390×844 and 1280×900) | PASS |
| 8 | `styrene-butadiene-copolymer` | Styrene pendant phenyl plus butadiene residual C=C; local motif only, no ratio or fixed repeat | PASS (390×844 and 1280×900) | PASS |
| 9 | `phenol-formaldehyde-resin` | Independent 4-ring/3-methylene-bridge junction, three branch ports, not the gameplay sample | PASS (390×844 and 1280×900) | PASS |
| 10 | `ethylene-propylene-copolymer` | E–P–E local sequence and propylene methyl branch; no bulk composition claim | PASS (390×844 and 1280×900) | PASS |
| 11 | `polyisobutylene` | Gem-dimethyl substitution on one backbone carbon | PASS (390×844 and 1280×900) | PASS |
| 12 | `polychlorotrifluoroethylene` | Three F and one Cl per CTFE-derived repeat, in source-mapped positions | PASS (390×844 and 1280×900) | PASS |
| 13 | `polyacrylonitrile` | Pendant nitrile C≡N; triple bond visually distinct from a carboxyl group | PASS (390×844 and 1280×900) | PASS |
| 14 | `polyacrylic-acid` | Pendant –C(=O)OH; carbonyl and O–H group both explicit | PASS (390×844 and 1280×900) | PASS |
| 15 | `polyethylene-oxide` | Ether oxygen is part of the main chain | PASS (390×844 and 1280×900) | PASS |
| 16 | `polyethylene-adipate` | Aliphatic polyester; ester direction and carbonyls; no aromatic ring | PASS (390×844 and 1280×900) | PASS |
| 17 | `polylactic-acid` | Methyl side group and ester main chain; no L/D configuration asserted | PASS (390×844 and 1280×900) | PASS |
| 18 | `polyglycolic-acid` | Ester main chain crosses the repeat boundary correctly | PASS (390×844 and 1280×900) | PASS |
| 19 | `polyethylene-adipamide` | Ethylenediamine/adipate residues with amide, N–H and C=O bonds | PASS (390×844 and 1280×900) | PASS |
| 20 | `polybutadiene` | 1,4-addition motif with residual backbone C=C; cis/trans not fixed | PASS (390×844 and 1280×900) | PASS |
| 21 | `nitrile-butadiene-rubber` | Nitrile side group plus diene-derived residual C=C in a local copolymer motif | PASS (390×844 and 1280×900) | PASS |
| 22 | `polyisoprene` | Methyl branch and residual C=C; no cis/trans assignment | PASS (390×844 and 1280×900) | PASS |
| 23 | `butyl-rubber` | Isobutylene/isoprene local sequence; gem-dimethyl, residual C=C and no ratio claim | PASS (390×844 and 1280×900) | PASS |
| 24 | `polyvinylidene-fluoride` | Two F atoms on the mapped CF₂ backbone carbon; regiochemistry caveat retained | PASS (390×844 and 1280×900) | PASS |
| 25 | `vinylidene-fluoride-hexafluoropropylene-copolymer` | VDF–HFP–VDF local sequence, HFP fluorine positions, composition caveat and 150° drawing-only branch hint | PASS (390×844 and 1280×900) | PASS |

## Visual evidence and acceptance

The browser job drives the actual Collection detail view in headless Chromium at **390×844** and **1280×900** for all 25 entries. It saves 50 full-screen screenshots and 50 image-stage crops, verifies that each known SVG loads with its accessible name and expected ID, confirms all four education fields are open, and checks image bounds and horizontal overflow. It then builds five structure-crop contact sheets and five full-screen contact sheets (five entries per sheet). The individual PNGs and contact sheets are attached to the Task⑧ GitHub Actions artifact; filenames follow `test-results/task8-polymer-visual-qa/{polymerId}-{mobile|desktop}.png` and `...-{mobile|desktop}-model.png`.

The final v4 Chromium artifact was visually inspected at the contact-sheet level for all 25 mobile/desktop pairs and all 25 structure crops. Atom labels and bond orders remain legible at the rendered detail size; functional groups, main-chain paths, repeat brackets/local copolymer groupings and continuation markers are distinguishable; the explanatory notes match the figure; no material overlap or clipping was observed. The VDF/HFP HFP-branch orientation was specifically checked after the 60°→150° correction. All 25 rows passed both visual sizes and figure/content consistency review.

Evidence reviewed: GitHub Actions run [37903016736](https://github.com/miyatayuuma/molecule-craft/actions/runs/37903016736), artifact `polymer-encyclopedia-task8-evidence` (50 full-screen screenshots, 50 structure crops, 10 contact sheets; artifact id `11603806476`). Individual source PNGs are retained in that artifact using the paths listed above.

## Content sources checked for specialist claims

The explanations use the validated structure graph for identity and show material-grade, processing and bulk-state limits. Commercial examples and less-common property claims were checked against manufacturer, regulator or technical literature sources, including:

- Daikin, NEOFLON PCTFE properties and applications: <https://www.daikinchemicals.com/solutions/products/fluoropolymers/neoflon-pctfe.html>
- Nippon Shokubai, polyacrylic acid / sodium polyacrylate uses and molecular-weight dependence: <https://www.shokubai.co.jp/en/products/detail/polyacrylic-acid-guide/>
- Toray, PAN-based carbon-fiber precursor example: <https://www.toray.com/ir/pdf/lib/lib_a078.pdf>
- ExxonMobil, butyl composition, air-barrier behavior and uses: <https://www.exxonmobilchemical.com/en/products/butyl/butyl-rubber>
- Arkema, flexible PVDF-HFP copolymers: <https://www.arkema.com/global/en/products/product-finder/product/technicalpolymers/kynar-pvdf-family/kynar-flex-pvdf/>
- Corbion, PLA material family and commercial markets: <https://www.corbion.com/products/bioplastic-products>
- FDA 510(k) record for an absorbable PGA suture: <https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfpmn/pmn.cfm?id=K172659>
- Peer-reviewed report on polyethylene adipate polyester diols in polyurethane systems: <https://pmc.ncbi.nlm.nih.gov/articles/PMC7442140/>
- Canadian government assessment and cited structural literature for phenol-formaldehyde resin motifs: <https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/screening-assessment-phenol-formaldehyde-resins-group.html>

Use examples are representative rather than exhaustive. The review does not infer a grade, property value, commercial copolymer ratio or bulk morphology from a local structural drawing.
