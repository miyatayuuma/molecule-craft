# Molecule Craft Polymer Integrated Production Closure — Task⑩

**Status: IN PROGRESS — PR #341.** This report is finalized only after the integrated browser run, same-condition performance comparison, required CI, and main merge have completed.

## 1. Executive summary

Task⑩ validates the Task④–⑨ polymer production system as one gameplay path. It adds browser coverage for actual pointer polymerization through discovery, Encyclopedia, reload, Engineering fabrication, Collector Shell activation, and FIELD effects. It also profiles finite completion against the immutable Task⑨ main baseline.

No production chemistry, route authority, polymer structures, SVGs, save schema, Engineering recipes, or FIELD mitigation factors are changed in this closure branch.

## 2. Final architecture

```text
Exact Feed → actual monomer instances → pointer graph transforms → finite PolymerSample
          → discovery coordinator → Polymer Collection / Encyclopedia → persistent discovery
          → Engineering fabrication → Collector Shell selection → FIELD effect
```

| Authority | Owner |
|---|---|
| Exact Feed, route recognition, transformation and finite graph evidence | `data/polymerization-routes.json`, `src/reaction-lab-polymerization.js` |
| Finite Sample presentation and event lifecycle | `src/reaction-lab-polymer-presentation.js`, `src/reaction-lab-viewer.js` |
| Discovery and saved polymer order | `src/reaction-lab-discovery.js`, `src/polymer-collection-state.js`, `src/polymer-collection-persistence.js` |
| Polymer identity and educational content | `src/polymer-catalog.js`, `src/polymer-encyclopedia.js`, `data/polymers.json`, `data/polymer-encyclopedia.json` |
| Structural drawings and SVG generation | `data/polymer-fragment-authority.json`, `scripts/polymer-fragment-authority.mjs`, `scripts/polymer-structure-svg.mjs` |
| Fabrication and persistent application unlocks | `src/engineering-fabrication.js` |
| Active Collector Shell applications and FIELD mitigation | `src/veil/collector-applications.js` |

## 3. Tasks④–⑨ reconciliation

| Task | Merged PR | Current production authority |
|---|---:|---|
| ④ Integrated closure contract | #335 | Exact route chemistry and finite graph are gameplay authorities. |
| ⑤ Finite PolymerSample | #336 | Completion retains the finite route-authored graph and bounded feedback. |
| ⑥ Structural authority and Encyclopedia content | #337 | 25 polymer records and educational entry content. |
| ⑦ Validated structural SVG generation | #338 | Deterministic structure SVGs derived from the 25-row authority. |
| ⑧ Visual and content review | #339 | 25 entries reviewed at mobile and desktop viewports. |
| ⑨ Legacy morphology removal | #340 | Retired morphology modules, previews, and runtime paths are removed. |

Task⑩ adds acceptance evidence and performance measurement; it does not restore the retired morphology path.

## 4. Chemistry coverage

The current route authority contains **25 unique routes**, **25 unique polymer IDs**, and **25 catalog records**. The existing route fixtures validate the exact representative sequences, source atom mapping, atom and bond conservation, byproducts, continuation behavior, sample identity, and completion evidence for every route.

Mechanism families partition the routes into 5 coordination, 2 cationic, 10 radical, 1 anionic ring-opening, 6 step-growth polycondensation, and 1 condensation-network route. The 17 coordination/cationic/radical chain-growth routes include 5 copolymer routes. These latter counts overlap.

| Route ID | Polymer ID | Route family | Fixture result |
|---|---|---|---|
| `polyethylene-coordination` | `polyethylene` | Coordination chain growth | PENDING CI |
| `polypropylene-coordination` | `polypropylene` | Coordination chain growth | PENDING CI |
| `ethylene-propylene-coordination` | `ethylene-propylene-copolymer` | Coordination copolymerization | PENDING CI |
| `polyisobutylene-cationic` | `polyisobutylene` | Cationic chain growth | PENDING CI |
| `polystyrene-radical` | `polystyrene` | Radical chain growth | PENDING CI |
| `polyvinyl-chloride-radical` | `polyvinyl-chloride` | Radical chain growth | PENDING CI |
| `polychlorotrifluoroethylene-radical` | `polychlorotrifluoroethylene` | Radical chain growth | PENDING CI |
| `polyacrylonitrile-radical` | `polyacrylonitrile` | Radical chain growth | PENDING CI |
| `polyacrylic-acid-radical` | `polyacrylic-acid` | Radical chain growth | PENDING CI |
| `polyethylene-oxide-anionic-ring-opening` | `polyethylene-oxide` | Anionic ring-opening | PENDING CI |
| `polyethylene-terephthalate-direct-polycondensation` | `polyethylene-terephthalate` | Step-growth esterification | PENDING CI |
| `polyethylene-adipate-direct-polycondensation` | `polyethylene-adipate` | Step-growth esterification | PENDING CI |
| `polylactic-acid-direct-polycondensation` | `polylactic-acid` | Direct polycondensation | PENDING CI |
| `polyglycolic-acid-direct-polycondensation` | `polyglycolic-acid` | Direct polycondensation | PENDING CI |
| `phenol-formaldehyde-resole` | `phenol-formaldehyde-resin` | Condensation network | PENDING CI |
| `polyethylene-adipamide-direct-polycondensation` | `polyethylene-adipamide` | Step-growth amidation | PENDING CI |
| `polybutadiene-coordination-1-4` | `polybutadiene` | Coordination 1,4 diene growth | PENDING CI |
| `styrene-butadiene-radical` | `styrene-butadiene-copolymer` | Radical copolymerization | PENDING CI |
| `nitrile-butadiene-radical` | `nitrile-butadiene-rubber` | Radical copolymerization | PENDING CI |
| `polyisoprene-coordination-1-4` | `polyisoprene` | Coordination 1,4 diene growth | PENDING CI |
| `butyl-rubber-cationic` | `butyl-rubber` | Cationic copolymerization | PENDING CI |
| `polyvinylidene-fluoride-radical` | `polyvinylidene-fluoride` | Radical chain growth | PENDING CI |
| `vinylidene-fluoride-hexafluoropropylene-radical` | `vinylidene-fluoride-hexafluoropropylene-copolymer` | Radical copolymerization | PENDING CI |
| `polytetrafluoroethylene-radical` | `polytetrafluoroethylene` | Radical chain growth | PENDING CI |
| `nylon-6-6-direct-polycondensation` | `nylon-6-6` | Step-growth amidation | PENDING CI |

Local command: `node --test tests/polymerization-routes.test.mjs tests/reaction-lab-polymerization.test.mjs tests/reaction-lab-polymerization-fixtures.test.mjs tests/reaction-lab-polymer-discovery.test.mjs`.

## 5. Production gameplay and finite Sample

The browser acceptance gate uses actual pointer drags on nine representative routes at both **390×844** and **1280×900**:

| Route | Representative chemistry |
|---|---|
| `polyethylene-coordination` | Coordination addition |
| `ethylene-propylene-coordination` | Coordination copolymerization |
| `polyethylene-oxide-anionic-ring-opening` | Anionic ring opening |
| `polyethylene-terephthalate-direct-polycondensation` | Polycondensation |
| `phenol-formaldehyde-resole` | Condensation network |
| `styrene-butadiene-radical` | Radical copolymerization |
| `butyl-rubber-cationic` | Cationic copolymerization |
| `nylon-6-6-direct-polycondensation` | Polycondensation |
| `polystyrene-radical` | Radical addition |

The browser assertions cover FEED entry, environment gates, real pointer commits, finite graph identity, atom/bond rendering, byproduct/sample evidence, 650 ms normal and 250 ms reduced-motion feedback, new and known Encyclopedia paths, next-FEED purge, close/reopen, close-before-ready, and viewer disposal. Ready completion performs no additional layout; retired module requests remain zero.

The continuous progression E2E begins from a checkpoint produced by production progression APIs and verifies four polymer routes through Collection SVG loading, Engineering UI actions, persistence, Collector Shell selection, and FIELD feedback. It does not seed polymer discoveries, fabricated applications, or active application state. Browser results: PENDING FINAL RUN.

## 6. Discovery, Encyclopedia, and persistence

- New polymer discovery is accepted from the completed PolymerSample and saved in discovery order.
- Known polymer navigation uses the existing Collection entry and does not create a duplicate discovery.
- The actual Encyclopedia SVG is loaded for each E2E route.
- Save/reload preserves polymer discovery order, unrelated molecule Collection data, Engineering unlocks, and active application selection. The transient Chamber Sample is not restored.
- All 25 structural records/assets and education-content checks are validated by existing authorities and tests.

## 7. Engineering and FIELD integration

| Application path | Recipe | Required production evidence | Cost on success |
|---|---|---|---|
| Wear protection | `br-sulfur-wear` | Discovered polybutadiene and sulfur stock | S: 1 |
| Thermal protection | `pan-phenolic-thermal` | PAN, phenolic resin, phosphoric acid conditioning, and stock | P: 1, H: 3, O: 4 |
| Control insulation | `pvc-insulation` | Discovered PVC | No element stock |

The integrated browser journey verifies missing requirements block fabrication, eligible recipes consume their exact BASE STOCK, fabrication persists once, and PolymerSample remains untouched. The three persistent applications are `WEAR_SKIN`, `THERMAL_SHELL`, and `CONTROL_INSULATION`; fabrication and active selection remain separate.

The existing FIELD authority retains the targeted **0.5** mitigation factor. Orthogonal hazard response, inactive behavior, persistence, and no added durability/charge/maintenance systems are covered by `tests/collector-applications.test.mjs` and `tests/material-progression-closure.test.mjs`.

## 8. Resource lifecycle and legacy removal

Existing browser probes record finite graph group, geometry, material, layout, bond allocation, fit, disposal, and batch-generation evidence. Task⑩ additionally calls the actual viewer `dispose()` and asserts zero active finite groups, geometries, and materials afterward; runtime metrics remain stable after disposal. Listener abort, animation-frame cancellation, and resize observer disposal are code-derived from the production dispose path.

`tests/reaction-lab-legacy-removal.test.mjs` verifies all seven retired modules and static/runtime import paths are absent. The finite Sample renderer remains separately validated by the pointer browser gate.

## 9. Performance measurement

Baseline: Task⑨ production main `3a6eec8eea889fd59e661ec802a784a1788717a9`. The comparison uses the same GitHub runner, Chromium revision, flags, dataset, device scale factor, and viewport. Each viewport/motion pair has one warm-up and four measured actual-pointer polyethylene completions. Frame intervals are sampled between `requestAnimationFrame` callbacks while completion feedback is active; elapsed completion is measured from Sample event to Sample-present event.

| Viewport | Motion | Baseline frame P50/P95/max | Task⑩ frame P50/P95/max | Baseline / Task⑩ completion P50/P95 | Tolerance | Result |
|---|---|---:|---:|---:|---:|---|
| 390×844 | Normal | PENDING | PENDING | PENDING | PENDING | PENDING |
| 390×844 | Reduced | PENDING | PENDING | PENDING | PENDING | PENDING |
| 1280×900 | Normal | PENDING | PENDING | PENDING | PENDING | PENDING |
| 1280×900 | Reduced | PENDING | PENDING | PENDING | PENDING | PENDING |

Regression tolerance is `max(documented measurement floor, 3×MAD of the four baseline trial summaries)`. The comparator requires matching browser revision, flags, module count, resource counts, disposal counts, and layout/allocation counts. The precise values and raw trial intervals will be added to `docs/evidence/polymer-integrated-production-closure.json`; full raw browser evidence remains in the Actions artifact.

**NOT MEASURED:** per-frame JavaScript update duration, WebGL submission CPU duration, GPU execution time, and physical device memory. No historical pre-Task⑨ morphology CPU/GPU baseline exists, so no speedup claim is made.

## 10. Browser and PWA

Required final browser surfaces: 390×844 and 1280×900, normal and reduced motion. The browser gate records Chromium product/revision, viewport, route, target duration, frame samples, resource counters, console exceptions, and failed local requests. Screenshots and raw traces are uploaded as GitHub Actions artifacts rather than committed as large binary files.

The final PWA gate regenerates and checks the authority-derived 25 polymer SVGs, hashes, current service worker/precache, retired module paths, and offline integrity. Local validation before browser CI: authority 25/25; 25 validated polymer SVGs; 352 verified precache assets current; PWA test passed. Final CI result: PENDING.

## 11. Final gate matrix

| Gate | Status | Evidence |
|---|---|---|
| 25 routes and chemistry invariants | PENDING | Route fixtures / chemistry CI |
| Actual pointer route-family coverage | PENDING | 9 routes × 2 viewports |
| Finite Sample, event order, timing | PENDING | Browser evidence JSON |
| Close/purge/reopen/disposal lifecycle | PENDING | Resource probe and disposal evidence |
| New/known discovery and Encyclopedia | PENDING | Browser journey JSON and SVG loading |
| Persistence and schema compatibility | PENDING | Browser reload and existing persistence tests |
| Engineering eligibility/fabrication | PENDING | UI journey and atomicity tests |
| Collector Shell and FIELD mitigation | PENDING | Integrated browser journey and authority tests |
| Legacy removal | PENDING | Legacy removal test |
| 25 SVG integrity and visual QA | PENDING | Authority/assets tests and 25×2 viewport review |
| Performance profile and baseline comparison | PENDING | Machine-readable comparison JSON |
| Offline/PWA | PENDING | Precache check and `tests/pwa.test.mjs` |
| Required CI and repository hygiene | PENDING | PR #341 checks |
| Merge and final main verification | PENDING | Main SHA to be recorded after merge |

## 12. Unresolved issues

- Desktop integrated E2E failed once after a Sample completed, while opening the Collection for its Encyclopedia check. Browser console errors and failed local requests were zero. The latest branch waits for complete dialog closure and an unobstructed real pointer target; this must pass in the final run.
- The unrelated `field-return-flow` job has an existing Safe Extraction browser timing assertion (`site-seeking` observed before `site-ready`). It will be retried after the workflow run completes; if it reproduces, the test wait will be made state-based without changing gameplay.
- GPU execution time, per-frame JavaScript time, render submission time, and device memory are not measured by these headless tools.

## 13. Final closure

**Task④–⑩: NOT CLOSED.** PR #341 and main merge are pending the final desktop integrated E2E, performance, CI, review, and post-merge checks. The final main SHA, merge commit, artifact references, and closure decision will be recorded here before this report is finalized.
