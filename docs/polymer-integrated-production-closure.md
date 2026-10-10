# Molecule Craft Polymer Integrated Production Closure — Task⑩

**Acceptance status: PASS.** The required implementation, performance, resource, PWA, and repository gates passed on Task⑩ candidate `99e090d78d9ada43935ef12cec4f44753798e4e2`. PR #341 is the publication vehicle; final closure takes effect after its merge and post-merge verification.

## 1. Executive summary

Task⑩ validates the Task④–⑨ polymer production system as one gameplay path: production progression, exact FEED, real pointer polymerization, finite `PolymerSample`, discovery and Encyclopedia, save/reload, Engineering fabrication, Collector Shell activation, and FIELD mitigation.

No production chemistry, route catalog, finite Sample schema, atom/bond mapping, SVG authority/assets, Engineering balance, FIELD factor, or retired morphology authority was changed. Changes are browser-test instrumentation and sequencing, CI workflow/comparison scripts, the Stage B benchmark harness, this report, and a state-based wait in the unrelated Safe Extraction browser test.

## 2. Recovery and source authority

| Item | Result |
|---|---|
| Repository / PR | `miyatayuuma/molecule-craft`, [PR #341](https://github.com/miyatayuuma/molecule-craft/pull/341) |
| Initial remote PR head | `77cf1cfcf5257ca34dd9a0818d7b8e309dda87c5` |
| Immutable Task⑨ baseline main | `3a6eec8eea889fd59e661ec802a784a1788717a9` |
| Candidate used for integrated CI and profiling | `99e090d78d9ada43935ef12cec4f44753798e4e2` |
| Recovered unpublished local edits | None found. The supplied source snapshot had no `.git` metadata; remote branch commits remained authoritative. No reset, branch deletion, or force push was used. |
| Final PR diff audit | 11 files: validation workflow; this report; three performance scripts; six browser tests. No production runtime, chemistry, route catalog, or structural asset authority changed. |

The Safe Extraction readiness wait uses authored state rather than a fixed delay. Browser-process cleanup in Safe Extraction, LOADOUT optical alignment, and Ring visual calibration now waits for Chrome exit and retries profile-directory removal. These test-only changes affect no gameplay behavior; the Ring visual check passes.

## 3. Chemistry, route, and structural authority

The finite-polymer validation workflow passed all route fixtures and chemistry/discovery regressions. The route catalog remains 25 unique routes and 25 polymer IDs. Source atom/bond mapping, conservation, byproducts, route evidence, and sample identity checks passed; no chemistry invariants changed.

| Route ID | Polymer ID | Result |
|---|---|---|
| `polyethylene-coordination` | `polyethylene` | PASS |
| `polypropylene-coordination` | `polypropylene` | PASS |
| `ethylene-propylene-coordination` | `ethylene-propylene-copolymer` | PASS |
| `polyisobutylene-cationic` | `polyisobutylene` | PASS |
| `polystyrene-radical` | `polystyrene` | PASS |
| `polyvinyl-chloride-radical` | `polyvinyl-chloride` | PASS |
| `polychlorotrifluoroethylene-radical` | `polychlorotrifluoroethylene` | PASS |
| `polyacrylonitrile-radical` | `polyacrylonitrile` | PASS |
| `polyacrylic-acid-radical` | `polyacrylic-acid` | PASS |
| `polyethylene-oxide-anionic-ring-opening` | `polyethylene-oxide` | PASS |
| `polyethylene-terephthalate-direct-polycondensation` | `polyethylene-terephthalate` | PASS |
| `polyethylene-adipate-direct-polycondensation` | `polyethylene-adipate` | PASS |
| `polylactic-acid-direct-polycondensation` | `polylactic-acid` | PASS |
| `polyglycolic-acid-direct-polycondensation` | `polyglycolic-acid` | PASS |
| `phenol-formaldehyde-resole` | `phenol-formaldehyde-resin` | PASS |
| `polyethylene-adipamide-direct-polycondensation` | `polyethylene-adipamide` | PASS |
| `polybutadiene-coordination-1-4` | `polybutadiene` | PASS |
| `styrene-butadiene-radical` | `styrene-butadiene-copolymer` | PASS |
| `nitrile-butadiene-radical` | `nitrile-butadiene-rubber` | PASS |
| `polyisoprene-coordination-1-4` | `polyisoprene` | PASS |
| `butyl-rubber-cationic` | `butyl-rubber` | PASS |
| `polyvinylidene-fluoride-radical` | `polyvinylidene-fluoride` | PASS |
| `vinylidene-fluoride-hexafluoropropylene-radical` | `vinylidene-fluoride-hexafluoropropylene-copolymer` | PASS |
| `polytetrafluoroethylene-radical` | `polytetrafluoroethylene` | PASS |
| `nylon-6-6-direct-polycondensation` | `nylon-6-6` | PASS |

Evidence: finite-validation run `38080664821`, step “Finite completion, chemistry and discovery regressions”; repository run `38080664827`, job `polymer-fragment-authority`.

## 4. Actual-pointer validation and desktop recovery

The standalone actual-pointer regression passed nine representative routes at both 390×844 and 1280×900: `polyethylene-coordination`, `ethylene-propylene-coordination`, `polyethylene-oxide-anionic-ring-opening`, `polyethylene-terephthalate-direct-polycondensation`, `phenol-formaldehyde-resole`, `styrene-butadiene-radical`, `butyl-rubber-cationic`, `nylon-6-6-direct-polycondensation`, and `polystyrene-radical`. The continuous progression journey passed on mobile and desktop for polybutadiene, polyacrylonitrile, phenol-formaldehyde resin, and PVC. Each viewport produced four samples; browser exceptions, failed local requests, bad local responses, and horizontal overflow were zero.

### Desktop polybutadiene manual step 2

The reproduced failure was confined to `tests/material-progression-browser.test.mjs`: its continuous journey carried a projected dock plan across additional snapshot, screenshot, and canvas-measurement work. The standalone nine-route harness did not have that sequence. A plan computed before this work could be stale relative to the live candidate pose and be rejected as `no-dock-pose`. The original failed run did not preserve a complete pose trace, so the exact coordinate or pose component that caused the rejection is not known.

The test-only correction now captures the before state and screenshot, reads the current canvas bounds, then obtains a fresh `polymerDockPlan` immediately before the real gesture. It records the plan, candidate, camera, bounds, before/after state, screenshots, and dock result. No production chemistry, docking threshold, overlap check, pointer expectation, or retry was changed.

On final measured candidate `99e090d78d9ada43935ef12cec4f44753798e4e2`, route `polybutadiene-coordination-1-4`, viewport 1280×900, manual step 2:

- Before: `WAITING`, `manualStepCount=1`, consumed IDs 1 and 2, all four monomer IDs reserved, `sampleId=null`.
- Candidate: the real reserved `1-3-butadiene-3` monomer.
- Projected active-end target: `(662.019, 586.128)` CSS px. Canvas: `(x=212, y=238, w=856, h=617)`. Camera: distance 15, azimuth 0, elevation 0, far 500.
- Pointer: start `(863.700, 699.704)`, end `(662.019, 586.128)`; real CDP mouse move/press, 12 interpolated moves at 20 ms, release, 40 ms initial hold. Plan-to-pointer-start gap: 0 ms.
- After: `manualStepCount=2`, state `AUTO_PENDING`, third monomer consumed, `dockAttempt.ok=true`; browser exceptions 0.

Evidence: finite-validation run `38080664821`, job `114296733877`, artifact `reaction-lab-finite-polymer-validation-evidence` (ID `11680134221`), including `POLYMER_POINTER_DOCK_SUCCESS` and before/after screenshots.

## 5. Integrated gameplay, discovery, persistence, Engineering, and FIELD

The production progression checkpoint led through actual molecule access, Reaction Lab, exact FEED, pointer polymerization, finite Sample completion, discovery, and the structural Encyclopedia SVG. The same journey then verified Engineering eligibility, UI fabrication, actual BASE STOCK costs, save/reload, Collector Shell activation, and targeted FIELD mitigation.

Acceptance outcomes on mobile and desktop:

- Real reserved monomer instances were used; every polymer result matched the selected route and finite Sample identity.
- Newly discovered polymers were registered once. Known-entry navigation did not duplicate discovery; structural Encyclopedia SVGs loaded.
- Missing fabrication prerequisites blocked the action. Eligible recipes consumed the required BASE STOCK; the transient Sample was not used as stock.
- Discovery, molecule Collection, fabrication, and active application selection survived reload; transient PolymerSample state did not.
- FIELD used the correct active applications and affected only the targeted hazard; no artificial immunity was introduced. The existing mitigation factor remains 0.5.
- Browser exceptions, failed local requests, and bad local responses were zero.

| Fabrication path | Recipe | Verified BASE STOCK cost |
|---|---|---|
| Wear protection | `br-sulfur-wear` | S: 1 |
| Thermal protection | `pan-phenolic-thermal` | P: 1, H: 3, O: 4 |
| Control insulation | `pvc-insulation` | No element stock |

The persistent applications remain `WEAR_SKIN`, `THERMAL_SHELL`, and `CONTROL_INSULATION`; recipe balance and FIELD authority were unchanged.

Evidence: finite-validation run `38080664821`, steps “Integrated gameplay, discovery, Engineering and FIELD E2E — mobile/desktop”; uploaded journey JSON and screenshots in artifact `11680134221`.

## 6. Finite resource lifecycle and retired modules

The nine-route pointer gate passed at both viewports, plus reduced-motion coverage. It verified 650 ms normal and 250 ms reduced-motion feedback, discovery close/reopen, next-FEED purge, close-before-ready, viewer disposal, and zero retired morphology-module fetches. The finite Sample graph remained route-correct and bounded.

For the current profiled candidate, a ready polyethylene graph owns one active group, 48 objects, 47 geometries, and 47 materials. The browser test then calls `viewer.dispose()`, asserts active groups/geometries/materials reach zero, checks disposal counter increases account for the complete geometry/material set, and confirms runtime metrics remain stable after disposal. The 47 finite geometries match the graph's atom and visible-bond geometry; no layout runs after readiness. Profile counters report 4 finite layout calls, 1 completion fit call, 23 bond-visual allocations, and 0 completion layouts after ready for the first normal warm-up. Baseline and candidate resource, disposal, layout, and allocation counts matched in the same-condition comparator.

Listener lifecycle: the viewer binds its long-lived listeners to one `AbortController` and aborts them on disposal; repeated open/close/reopen browser coverage passed. Listener counts are not exposed as a separate runtime metric, so this item is supported by the disposal path and lifecycle tests rather than a numeric listener counter.

Evidence: finite-validation run `38080664821`, job `114296733877`, steps “Production pointer path…” and “Gate finite completion resource evidence”; artifact `11680134221`.

## 7. Same-condition performance comparison

Immutable baseline: Task⑨ main `3a6eec8eea889fd59e661ec802a784a1788717a9`. Measured candidate: `99e090d78d9ada43935ef12cec4f44753798e4e2`. Both were measured on the same GitHub runner with Chromium `Chrome/154.0.8037.97` (`@b510e9d7cd3a2fbd78d0ddc42234103206c5f78d`), the same flags, dataset, device scale factor 1, and viewport. Each viewport/motion pair used one warm-up plus four actual-pointer measured trials. Values are milliseconds; completion is P50/P95 over the four measured trials.

| Viewport | Motion | Baseline frame P50/P95/max | Candidate frame P50/P95/max | Baseline completion P50/P95 | Candidate completion P50/P95 | Comparison |
|---|---|---:|---:|---:|---:|---|
| 390×844 | Normal | 16.7 / 16.8 / 33.3 | 16.7 / 16.8 / 33.3 | 654.5 / 665.7 | 651.7 / 659.9 | PASS |
| 390×844 | Reduced | 16.7 / 16.7 / 33.4 | 16.7 / 16.8 / 16.8 | 255.8 / 265.8 | 256.8 / 264.4 | PASS |
| 1280×900 | Normal | 133.4 / 166.6 / 166.6 | 133.4 / 150.0 / 150.0 | 855.3 / 897.5 | 862.9 / 881.0 | PASS |
| 1280×900 | Reduced | 16.7 / 150.0 / 150.0 | 16.7 / 150.0 / 150.0 | 441.8 / 445.0 | 436.9 / 445.4 | PASS |

The headless desktop runner produced coarse requestAnimationFrame samples (five intervals per normal trial and two per reduced trial). The comparator accounts for this quantization when both baseline and candidate sampling is coarse, while preserving all raw intervals and observed values. No frame samples were discarded. The comparator also checks browser revision, runtime/resource counts, disposal counts, module requests, and layout/allocation counts.

### Repository Stage B threshold reconciliation

An earlier repository guardrail run `38050337359` reported a full Stage B plus 29-rule matcher median trial P95 of `8.3500 ms` against the unchanged `8.333 ms` limit, an overrun of `0.0167 ms`. The same-runner paired comparison on final measured candidate `99e090d…` used one warm-up and four 150-step trials per source:

| Source | Trial P95 values (ms) | Median trial P95 | Pooled P95 |
|---|---|---:|---:|
| Task⑨ baseline | 7.9, 6.4, 6.6, 6.1 | 6.5 | 6.7 |
| Task⑩ candidate | 6.1, 5.9, 6.0, 6.1 | 6.05 | 6.1 |

The full 29-rule matcher repository gate then passed on run `38080664827`: 384 candidates in each of four trials, trial P95 values `[6.0, 5.6, 5.7, 5.7]` ms, median and pooled P95 `5.7 ms`, below the unchanged `8.333 ms` limit. The paired candidate P95 was `0.6 ms` below the baseline pooled P95. The earlier isolated overrun did not recur. This points to runner/measurement variance; the exact transient scheduling source cannot be established. The 8.333 ms assertion remains enabled and unchanged.

Evidence: Stage B job `114296733696`, artifact `task10-stage-b-performance-comparison` (ID `11680596067`); repository guardrail job `114296733782`.

**Not measured:** per-frame JavaScript update CPU duration, GPU execution time, WebGL submission CPU duration, and physical device memory. Submission is not treated as GPU execution. No pre-Task⑨ morphology-era measurements are inferred.

## 8. SVG, Encyclopedia, PWA, and repository integrity

- Polymer Fragment Authority: 25/25 records and drawing inputs validated; all 25 production structural SVG paths generated and checked for source atom/bond mapping and deterministic bytes. No structural authority or SVG redesign was made.
- Encyclopedia/education checks passed; unknown polymer entries remain undisclosed and required known entries/assets resolve.
- Generated offline release was current: 352 verified precache assets. PWA integrity passed hash, dependency closure, service worker, offline fallback, and retired-module-path checks.
- Repository hygiene, whitespace/diff checks, generated asset consistency, and PWA freshness passed.

Evidence: repository run `38080664827`, job `polymer-fragment-authority`; finite-validation run `38080664821`, “Collection, hygiene, offline integrity”; FIELD Insight run `38080664820`.

## 9. Final CI results on the measured candidate

All three required workflows passed on measured candidate `99e090d78d9ada43935ef12cec4f44753798e4e2`.

| Workflow | Run | Result |
|---|---:|---|
| Reaction Lab finite polymer validation | `38080664821` | SUCCESS — 25-route chemistry/discovery; mobile and desktop 9-route pointer suites; mobile and desktop integrated E2E; baseline/candidate profiling; comparison; resource evidence; Collection/PWA/offline gates |
| Repository validation | `38080664827` | SUCCESS — repository guardrails, full-match Stage B performance, polymer authority/regressions, generated PWA freshness/integrity, diff hygiene; Ring visual cleanup job passed |
| FIELD Insight balance validation | `38080664820` | SUCCESS — lifecycle, balance, player-facing checks, repository hygiene, generated PWA freshness |

The finite validation artifact is [run 38080664821](https://github.com/miyatayuuma/molecule-craft/actions/runs/38080664821/artifacts/11680134221). The Stage B raw comparison is [artifact 11680596067](https://github.com/miyatayuuma/molecule-craft/actions/runs/38080664821/artifacts/11680596067).

## 10. Review, publication, and closure decision

On measured candidate `99e090d78d9ada43935ef12cec4f44753798e4e2`, PR #341 was open and mergeable. The final diff contains 11 files: workflow, report, three performance scripts, and six browser tests. The changes add CI/test instrumentation and report evidence; no production chemistry, route, or SVG authority files changed. The review snapshot contained zero submitted reviews and zero inline review threads before the final Codex diff audit.

**Task⑩ technical acceptance: PASS.** All chemistry, mobile/desktop interaction, integrated gameplay, performance, resource, PWA, repository, and FIELD gates passed. The PR is ready for the authorized merge; Task⑩ is CLOSED after the merge commit, updated `main` SHA, and post-merge verification are recorded.

## 11. Known measurement limitations

Headless desktop frame callbacks are coarse and are reported with their raw distributions; the comparison is limited to same-runner/same-Chromium behavior. GPU execution, frame-local CPU duration, and physical memory are not observable in this harness. Listener counts are not directly instrumented. These limitations do not affect chemistry, interaction commits, persistence, finite resource disposal, PWA integrity, or the unchanged Stage B hard threshold.
