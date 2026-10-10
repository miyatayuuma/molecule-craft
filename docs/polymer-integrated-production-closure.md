# Molecule Craft Polymer Integrated Production Closure — Task⑩

**Acceptance status: PASS.** The required implementation, performance, resource, PWA, and repository gates passed on Task⑩ candidate `ac0fea55575f78d705248ae063336bdaf14ab1bb`. PR #341 is the publication vehicle; final closure takes effect after its merge and post-merge verification.

## 1. Executive summary

Task⑩ validates the Task④–⑨ polymer production system as one gameplay path: production progression, exact FEED, real pointer polymerization, finite `PolymerSample`, discovery and Encyclopedia, save/reload, Engineering fabrication, Collector Shell activation, and FIELD mitigation.

No production chemistry, route catalog, finite Sample schema, atom/bond mapping, SVG authority/assets, Engineering balance, FIELD factor, or retired morphology authority was changed. Changes are browser-test instrumentation and sequencing, CI workflow/comparison scripts, the Stage B benchmark harness, this report, and a state-based wait in the unrelated Safe Extraction browser test.

## 2. Recovery and source authority

| Item | Result |
|---|---|
| Repository / PR | `miyatayuuma/molecule-craft`, [PR #341](https://github.com/miyatayuuma/molecule-craft/pull/341) |
| Initial remote PR head | `77cf1cfcf5257ca34dd9a0818d7b8e309dda87c5` |
| Immutable Task⑨ baseline main | `3a6eec8eea889fd59e661ec802a784a1788717a9` |
| Candidate used for integrated CI and profiling | `ac0fea55575f78d705248ae063336bdaf14ab1bb` |
| Recovered unpublished local edits | None found. The supplied source snapshot had no `.git` metadata; remote branch commits remained authoritative. No reset, branch deletion, or force push was used. |
| Final PR diff audit | 9 files: validation workflow; this report; two performance scripts; four browser tests; Safe Extraction browser timing test. No unrelated production or structural assets changed. |

The Safe Extraction adjustment replaces a timing-dependent assertion wait with a state-based wait. It changes no gameplay behavior and allowed its existing repository job to pass.

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

Evidence: finite-validation run `38041725665`, step “Finite completion, chemistry and discovery regressions”; repository run `38041725630`, job `polymer-fragment-authority`.

## 4. Actual-pointer validation and desktop recovery

The standalone actual-pointer regression passed nine representative routes at both 390×844 and 1280×900: `polyethylene-coordination`, `ethylene-propylene-coordination`, `polyethylene-oxide-anionic-ring-opening`, `polyethylene-terephthalate-direct-polycondensation`, `phenol-formaldehyde-resole`, `styrene-butadiene-radical`, `butyl-rubber-cationic`, `nylon-6-6-direct-polycondensation`, and `polystyrene-radical`. The four-route continuous journey passed on mobile and desktop for polybutadiene, polyacrylonitrile, phenol-formaldehyde resin, and PVC. Each viewport produced four samples; browser exceptions, failed local requests, bad local responses, and horizontal overflow were zero.

### Desktop polybutadiene manual step 2

The reproduced failure was confined to `tests/material-progression-browser.test.mjs`: its continuous journey carried a projected dock plan across additional snapshot/screenshot/canvas-measurement work. The standalone nine-route harness did not have that continuous-journey sequence. A plan computed before that work could be stale relative to the live candidate pose and be rejected as `no-dock-pose`. The initial failed run did not preserve the detailed pose trace, so the evidence does not support a more specific claim about which evolving coordinate or pose component triggered the rejection.

The test-only correction now captures the before state and screenshot, reads the current canvas bounds, then obtains a fresh `polymerDockPlan` immediately before the actual gesture. It logs the plan, projected target, candidate, camera, bounds, before/after state, screenshots, and dock result on failure and on the targeted success case. No production chemistry, docking threshold, overlap check, pointer expectation, or retry was changed.

On candidate `ac0fea…`, route `polybutadiene-coordination-1-4`, viewport 1280×900, manual step 2:

- Before: `WAITING`, `manualStepCount=1`, consumed IDs 1 and 2, all four monomer IDs reserved, `sampleId=null`.
- Candidate: real reserved `1-3-butadiene-3` monomer.
- Projected active-end target: `(662.019, 586.128)` CSS px. Canvas: `(x=212, y=238, w=856, h=617)`. Camera: distance 15, azimuth 0, elevation 0, far 500.
- Pointer: start `(862.822, 699.292)`, end `(662.019, 586.128)`; real CDP mouse move/press, 12 interpolated moves at 20 ms, release, 40 ms initial hold. Plan-to-pointer-start gap: 0 ms.
- After: `manualStepCount=2`, state `AUTO_PENDING`, third monomer consumed, `dockAttempt.ok=true`; browser exceptions 0.

Evidence: finite-validation run `38041725665`, artifact `reaction-lab-finite-polymer-validation-evidence` (ID `11666407747`), including `POLYMER_POINTER_DOCK_SUCCESS` and the before/after screenshots.

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

Evidence: finite-validation run `38041725665`, steps “Integrated gameplay, discovery, Engineering and FIELD E2E — mobile/desktop”; uploaded journey JSON and screenshots in artifact `11666407747`.

## 6. Finite resource lifecycle and retired modules

The nine-route pointer gate passed at both viewports, covering ready timing, discovery close/reopen, next-FEED purge, close-before-ready, and viewer disposal. The finite Sample graph remained bounded and route-correct. On the profiled candidate, a ready graph owned one group with 47 geometries and 47 materials; after `viewer.dispose()`, active groups, objects, geometries, and materials were zero, with disposal counters accounting for the geometry/material set. A profile reported 4 finite layout calls and 1 completion fit call for the warm-up, with 0 layouts after ready; cumulative bond visual allocation counters were 23 after warm-up and 69 after the first measured completion. Baseline/candidate resource and allocation counts matched in the same-condition comparator. Retired morphology module fetches were zero; legacy-removal checks and PWA path checks passed.

Listener lifecycle: the viewer binds its long-lived listeners to one `AbortController` and aborts them on disposal; repeated open/close/reopen browser coverage passed. Listener counts are not exposed as a separate runtime metric, so this item is supported by the disposal code path and lifecycle tests rather than a numeric listener counter.

Evidence: finite-validation run `38041725665`, steps “Production pointer path…” and “Gate finite completion resource evidence”; artifact `11666407747`.

## 7. Same-condition performance comparison

Immutable baseline: Task⑨ main `3a6eec8eea889fd59e661ec802a784a1788717a9`. Candidate: `ac0fea55575f78d705248ae063336bdaf14ab1bb`. Both were measured on the same GitHub runner, Chromium `Chrome/154.0.8037.97` (`@b510e9d7cd3a2fbd78d0ddc42234103206c5f78d`), same flags, dataset, device scale factor 1, and viewport. Each viewport/motion pair used one warm-up plus four actual-pointer measured trials.

Values are milliseconds. Completion is reported as trial P50/P95 over four measured trials; with four samples the nearest-rank P95 is the maximum trial value. Raw frame intervals and trial measurements are in the workflow artifact.

| Viewport | Motion | Baseline frame P50/P95/max | Candidate frame P50/P95/max | Baseline completion P50/P95 | Candidate completion P50/P95 | Comparison |
|---|---|---:|---:|---:|---:|---|
| 390×844 | Normal | 16.7 / 16.7 / 33.3 | 16.7 / 16.7 / 16.8 | 655.2 / 658.7 | 658.1 / 658.5 | PASS |
| 390×844 | Reduced | 16.7 / 16.7 / 16.8 | 16.7 / 16.7 / 16.8 | 259.2 / 259.9 | 256.5 / 259.6 | PASS |
| 1280×900 | Normal | 100.0 / 100.1 / 116.7 | 100.0 / 100.1 / 116.6 | 719.6 / 730.0 | 707.3 / 720.0 | PASS |
| 1280×900 | Reduced | 33.4 / 116.7 / 116.7 | 33.5 / 100.1 / 100.1 | 313.1 / 315.7 | 297.4 / 314.8 | PASS |

The desktop headless runner produced coarse rAF samples (4–6 intervals per normal trial and 2 per reduced trial). The comparator accounts for this sampling resolution in its measurement floor while preserving raw intervals and all observed values; no frame samples were discarded. The comparator also checks browser revision, runtime/resource counts, disposal counts, module requests, and layout/allocation counts.

### Repository Stage B threshold reconciliation

The earlier repository run `37943473333` reported 9.0000 ms against the unchanged 8.333 ms threshold in `tests/reaction-lab-browser.test.mjs`. This is a generic Reaction Lab Stage B + full 29-rule matcher gate, separate from polymer completion profiling.

The same-runner baseline/candidate comparison on run `38041725665` used a warm-up and four 150-step trials per source. Baseline trial p95 values were `[5.0, 4.5, 7.9, 4.6]` ms (median 4.8; pooled 4.8); candidate values were `[4.6, 4.3, 4.4, 4.3]` ms (median 4.35; pooled 4.4). All were below 8.333 ms; candidate pooled p95 improved by 0.4 ms (8.333%). The latest repository guardrail run `38041725630` also passed the full matcher gate: 384 candidates in each of four trials, median and pooled p95 5.5 ms, below the same threshold.

Classification: **benchmark/runner variance; no Task⑩ regression found.** The isolated 9 ms event did not reproduce in paired same-condition trials. The exact transient scheduling/contention source is not recoverable from that run, so it is not attributed more narrowly. The 8.333 ms assertion remains unchanged and enabled.

Evidence: stage-B job `114183143486`, artifact `task10-stage-b-performance-comparison` (ID `11666206797`); repository gate job `114183143156`.

**Not measured:** per-frame JavaScript update CPU duration, GPU execution time, WebGL submission CPU duration, and physical device memory. Submission is not treated as GPU execution. No pre-Task⑨ morphology-era measurements are inferred.

## 8. SVG, Encyclopedia, PWA, and repository integrity

- Polymer Fragment Authority: 25/25 records and drawing inputs validated; all 25 production structural SVG paths generated and checked for source atom/bond mapping and deterministic bytes. No structural authority or SVG redesign was made.
- Encyclopedia/education checks passed; unknown polymer entries remain undisclosed and required known entries/assets resolve.
- Generated offline release was current: 352 verified precache assets. PWA integrity passed hash, dependency closure, service worker, offline fallback, and retired-module-path checks.
- Repository hygiene, whitespace/diff checks, generated asset consistency, and PWA freshness passed.

Evidence: repository run `38041725630`, job `polymer-fragment-authority`; finite-validation run `38041725665`, “Collection, hygiene, offline integrity”; FIELD Insight run `38041725674`.

## 9. Final CI results on the measured candidate

| Workflow | Run | Result |
|---|---:|---|
| Reaction Lab finite polymer validation | `38041725665` | SUCCESS — 25-route chemistry/discovery; mobile and desktop 9-route pointer suites; mobile and desktop integrated E2E; baseline/candidate profiling; comparison; resource evidence; Collection/PWA/offline gates |
| Repository validation | `38041725630` | SUCCESS — repository guardrails, Stage B performance, polymer authority/regressions, generated PWA freshness/integrity, diff hygiene |
| FIELD Insight balance validation | `38041725674` | SUCCESS — lifecycle, balance, desktop/mobile player-facing checks, repository hygiene, generated PWA freshness |

The finite validation artifact is [run 38041725665](https://github.com/miyatayuuma/molecule-craft/actions/runs/38041725665/artifacts/11666407747). The Stage B raw comparison is [artifact 11666206797](https://github.com/miyatayuuma/molecule-craft/actions/runs/38041725665/artifacts/11666206797).

## 10. Review, publication, and closure decision

At the final implementation candidate, PR #341 was open and mergeable, with zero submitted reviews and zero unresolved review threads. The nine-file diff was audited; no production chemistry or asset authority changes are present.

**Task⑩ acceptance: PASS.** All technical, performance, resource, PWA, repository, and FIELD gates passed. The remaining publication action is to merge the existing PR #341, then verify the merge commit, main ref, and post-merge required checks. Task⑩ is CLOSED only after that publication verification is recorded.

## 11. Known measurement limitations

Headless desktop frame callbacks are coarse and are reported with their raw distributions; the comparison is limited to same-runner/same-Chromium behavior. GPU execution, frame-local CPU duration, and physical memory are not observable in this harness. Listener counts are not directly instrumented. These limitations do not affect chemistry, interaction commits, persistence, finite resource disposal, PWA integrity, or the unchanged Stage B hard threshold.
