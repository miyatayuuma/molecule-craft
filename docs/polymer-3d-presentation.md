# Finite Polymer 3D Presentation

> Current roadmap authority: [local-fragment Task① canonical specification](validation/polymer-local-fragment-task1-authority.md) distinguishes the former Task⑪ implementation/evidence recorded here from the new Tasks①–⑥, and corrects source-pose, iteration-limit, bond-rendering and current-main/#345 ownership assumptions. Acceptance runs below remain historical evidence at their stated SHAs.

## Authority and boundary

The chemical authority remains the finite `PolymerSample` graph:

- `sample.fragment.atoms`
- `sample.fragment.bonds`
- `sample.fragment.atomOrigins`
- `sample.representation`

`src/polymer-fragment-3d-layout.js` derives renderer coordinates from that graph and the live source monomer poses. It does not add atoms or bonds, change atom IDs or origins, or write coordinates into chemistry, reaction docking, discovery, save data, Engineering, or FIELD. `src/reaction-lab-polymer-presentation.js` remains the 2D SVG layout authority.

The layout groups atoms by `atomOrigins[].instanceId`, preserves each source monomer's internal coordinate frame, and places connected units using the actual cross-unit bond endpoints. A deterministic origin-derived azimuth selects a representative torsion around flexible links. A bounded relaxation then minimizes internal bond drift, cross-unit bond error, local angle error, and close nonbonded contacts. Bond targets use covalent-radius and bond-order estimates calibrated against source intramonomer geometry. Aromatic source rings receive stronger coordinate tethers and a plane-restraint force derived from their source coordinates.

The implementation is a presentation heuristic. It is not a molecular force field or molecular-dynamics simulation. It does not infer or label stereochemistry where the route has no stereo authority. One deterministic conformer is a representative view, not a claim about a polymer's unique physical conformation.

## Validation and fallback

`createPolymerFragment3DLayout()` returns XYZ coordinates, XYZ bounds, original bond and origin mappings, iteration counts, source-coordinate fallback count, maximum and mean bond error, minimum nonbonded distance, severe overlap count, ring restraint count, depth span, and an acceptance reason.

The layout is accepted only when coordinates are finite, all source units are connected, every atom has a source pose, maximum bond error stays within the configured bound, and severe overlap count is zero. A failed layout is recorded and the viewer uses the existing finite layout as a visible-safe fallback. The fallback does not change the chemical graph. CI requires zero fallback across all 25 production routes.

The 25-route test builds the same representative `PolymerSample` graphs as the production polymerization core and obtains source poses from `createPreviewModel()`. It compares atom count, atom IDs, bond endpoints and orders, origins, deterministic regeneration, XYZ bounds, bond geometry, depth, severe overlaps, and fallback count. It checks aromatic rings in every route remain within 0.12 Å of a local plane, representative-route maximum bond error remains within 0.35 Å, and the 10 named diversity routes have measurable depth. Separate geometry cases check a linked aromatic ring's planarity and fail-closed diagnostics for missing source poses. CI uploads per-route timing and geometry diagnostics as `polymer-3d-layout/validation-25.json`.

## Renderer and completion transition

Reaction-time pointer docking continues to use the live finite graph. The 3D layout is calculated once per committed polymer graph update and only changes positions of the existing source atom meshes. Bonds remain bounded cylinders attached to those same atom meshes. The completion pose is fitted from the 3D atom extent with perspective and atom radii accounted for. A conservative bounding sphere keeps every orientation inside the initial safe region.

The completed pose transition shares the existing 650 ms normal and 250 ms reduced-motion completion window. Reduced motion skips the added model-orientation transition. The original camera remains fixed for the ordinary Reaction Lab and is not replaced by an orbit camera.

When `sampleReady` becomes true, one-finger or mouse drag rotates the PolymerSample group, two-finger pinch or wheel changes its scale within near-clip and zoom limits, and **視点リセット** restores the fitted center, orientation, and scale. These gestures do not select monomers or invoke polymer chemistry. The group transform survives Lab close/reopen; the next FEED purges the prior Sample through the existing finite-resource lifecycle.

## Resource lifetime and performance

The renderer reuses source atom meshes, maintains bounded bond mesh/material pools, performs no layout work per frame, and disposes the finite graph resources on Lab close or purge. Reopening reconstructs the same graph meshes from the retained Sample and restores the saved group transform.

The browser gate records completion elapsed time, frame intervals, layout time, layout iterations, bond visual allocations, geometry/material counts, and disposal deltas at 390×844 and 1280×900. JavaScript and GPU execution times that the browser cannot measure are reported as `NOT_MEASURED`. The finite-polymer workflow compares completion performance against Task⑩ main (`4bc202c0eb1f51de0350c3a0b4be36c7178cba53`) under the same mobile and desktop profile conditions. The inherited Stage B regression gate remains in place.

The profile contains one warm-up and four measured trials per viewport and motion mode. Raw `requestAnimationFrame` intervals, each trial's P50/P95/maximum, completion time, and interval count remain in the uploaded evidence. For frame P50/P95 comparison, the gate gives each measured trial equal weight by comparing the median of the four trial-level percentiles; the report also retains pooled P50/P95/maximum. Baseline-derived MAD tolerances and the existing coarse-sampling floors are unchanged. Sampling is classified as coarse when both builds record at most 32 frame intervals in aggregate across their four measured trials. The existing coarse floors then apply even if the candidate's pooled P95 improves below 100 ms. This matters when headless reduced-motion runs capture only one or two intervals per trial: a pooled P50 can jump by a refresh interval solely because the baseline has an even total count and the candidate an odd total count. That pooled result remains visible in the report, while the pass/fail comparison uses the four equally weighted trials. Per-trial layout-generation time is derived from successive snapshots of the cumulative `layoutComputationMs` counter; it is not inferred from frame intervals.

### Initial desktop reduced-motion failure diagnosis

The original failing run was GitHub Actions run `38108574355`, candidate `a3bfc66b97200e854f4c1611bce1ebeeadf1e569`, compared with Task⑩ main `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`. Both profiles used Chrome `154.0.8037.97` revision `@b510e9d7cd3a2fbd78d0ddc42234103206c5f78d`, SwiftShader/ANGLE, and the same `1280×900` viewport and reduced-motion route on the same finite-validation job.

|Measured trial|Task⑩ interval count / P50 / P95 (ms)|Task⑪ interval count / P50 / P95 (ms)|Task⑩ completion (ms)|Task⑪ completion (ms)|Task⑪ layout delta (ms)|
|---:|---:|---:|---:|---:|---:|---:|
|1|2 / 16.6 / 150.1|2 / 16.7 / 116.7|418.4|414.1|6.6|
|2|2 / 16.7 / 133.3|1 / 133.2 / 133.2|428.3|267.6|7.2|
|3|2 / 16.7 / 150.0|2 / 16.7 / 133.3|427.9|431.6|5.5|
|4|2 / 16.7 / 150.0|2 / 16.6 / 150.0|429.0|425.7|5.8|

The pooled intervals were 8 baseline values and 7 candidate values, yielding pooled P50 values of `16.7 ms` and `116.7 ms`. The four trial P50s instead have medians of `16.7 ms` for both builds. Candidate completion P95 was `431.6 ms` versus `429.0 ms` baseline, within the existing 15 ms floor; frame P95 and maximum checks also passed. The failure therefore came from pooling sparse intervals with unequal sample counts, not from repeated layout work or a measured GPU regression. This evidence does not establish GPU execution time; it remains `NOT_MEASURED`.

## Known limits

- Coordinates are a deterministic visual conformer based on the monomer preview poses and simplified bond/angle/steric constraints.
- Flexible-link torsions are selected deterministically for reproducibility, not predicted thermodynamically.
- The finite network route displays only links present in the PolymerSample graph; no bulk crosslinks or material-scale morphology are invented.
- The fit preserves a complete initial model across rotations; user zoom can intentionally move atoms outside the initial safe rectangle while remaining inside camera clipping limits.

## Task ⑪ acceptance record — 2026-10-12

The measured candidate was `9aae5745507a91c627e53a528488f5f1dad37ed0`; the immutable Task ⑩ main baseline was `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`. The commits between the previously visually reviewed runtime revision and this candidate changed CI comparison/tests and architecture documentation only; the polymer renderer and layout source were unchanged. The final validation runs were [Reaction Lab finite polymer validation](https://github.com/miyatayuuma/molecule-craft/actions/runs/38208425451), [Repository validation](https://github.com/miyatayuuma/molecule-craft/actions/runs/38208425518), and [FIELD Insight balance validation](https://github.com/miyatayuuma/molecule-craft/actions/runs/38208425450). All three latest attempts passed.

### Stage B hard limit

Both same-condition comparisons used six instances, the complete 29-rule matcher, 384 candidates in each measured fixed step, one 150-step warm-up, four measured trials of 150 steps, and the unchanged `8.333 ms` per-trial-P95 and pooled-P95 limit.

| Gate | Task ⑩ trial P95 (ms) | Task ⑪ trial P95 (ms) | Task ⑩ pooled P95 (ms) | Task ⑪ pooled P95 (ms) | Result |
| --- | --- | --- | ---: | ---: | --- |
| Independent same-job comparison | 5.3, 5.2, 6.5, 6.0 | 5.2, 4.9, 4.9, 4.8 | 5.9 | 5.0 | Pass; no significant regression |
| Repository hard-gate rerun | 6.5, 6.7, 6.5, 6.2 | 6.1, 6.4, 6.1, 6.3 | 6.6 | 6.3 | Pass |

The independent comparison recorded the exact Task ⑩ and Task ⑪ source SHAs, all 600 pooled intervals per build, and the raw four-trial distributions. The Task ⑪ candidate passed every measured-trial P95 and pooled P95 check in both gates.

### Completion and frame comparison

Each cell below gives the Task ⑩ value followed by the Task ⑪ value. Completion P95 is the maximum of four measured completion trials; frame P95 is the median of the four per-trial P95 values.

| Viewport | Motion | Completion P95 (ms) | Frame P95 (ms) | Result |
| --- | --- | ---: | ---: | --- |
| 390×844 | Normal | 662.9 → 660.2 | 16.8 → 16.8 | Pass |
| 390×844 | Reduced | 266.0 → 261.2 | 16.8 → 16.8 | Pass |
| 1280×900 | Normal | 1191.1 → 1108.0 | 191.7 → 183.3 | Pass |
| 1280×900 | Reduced | 568.5 → 541.0 | 191.7 → 183.3 | Pass |

All four candidate completion P95 values were at or below the Task ⑩ values. Candidate layout generation took 5.7–11.5 ms per measured completion. It ran zero times after readiness. The candidate used exactly one additional bounded module request (`145 → 146`), and retired module requests remained zero. At each ready sample the viewer held 47 geometries and 47 materials; each purge or close disposed all 47 of both kinds, matching the baseline lifecycle counts. The resource-evidence gate passed.

### Route, interaction, and PWA checks

- All 25 production routes passed finite graph and 3D geometry validation with zero layout fallback and zero severe overlaps.
- Mobile and desktop actual-pointer QA each passed 12 representative completion routes, including all nine requested polymer types, with completion screenshots captured in the run artifact.
- Integrated gameplay, discovery, Engineering, and FIELD E2E passed at mobile and desktop viewports.
- Collection, repository hygiene, and offline integrity passed. The PWA check validated 353 hashed assets and their dependency closure, icons, 159 numbered entries/previews, and verified offline fallback.
- The single prior P0 review thread about UTF-8 source corruption is resolved and outdated.

An earlier candidate attempt recorded one desktop-normal completion outlier (`1131.8 ms` versus a `907.2 ms` Task ⑩ maximum). The repeat at the same product-code revision passed all four viewport/motion conditions; the succeeding desktop-normal candidate P95 was `1108.0 ms` versus `1191.1 ms` baseline. The raw trials remain available in the linked workflow artifacts; the earlier outlier is retained here rather than hidden.

A follow-up validation at docs-only head `7e546de17313ae0f4a6be6194af6146930ce51a` found another desktop-normal completion outlier: one candidate trial had a `465.3 ms` first-frame offset and completed in `879.5 ms`, versus a Task ⑩ maximum of `730.3 ms`; the other three candidate trials completed in `669.0`, `705.3`, and `704.1 ms`. The trace does not establish the cause of the first-frame delay. In desktop reduced motion, both builds produced only eight frame intervals, but the candidate's pooled P95 improved to `83.3 ms` from `116.6 ms`. The old classifier incorrectly treated that candidate as fine-sampled because its P95 fell below `100 ms`, so sparse-sample P50 and maximum checks failed. The comparator now classifies from aggregate interval counts and retains the existing coarse numerical floors. The repeated run on the corrected head is recorded separately in its workflow results.

## Task ⑪ final acceptance evidence — 2026-10-14 (pre-merge)

The earlier **Local validation** section is retained as the original implementation-time record. The evidence below is the final remote CI acceptance evidence; the earlier local measurements are not treated as the final Stage B result.

### Authority and Stage B attempt

- PR #342: [Task⑪ finite polymer 3D presentation](https://github.com/miyatayuuma/molecule-craft/pull/342)
- Measured candidate SHA: `1f66611cf1dbf594bd53d89249486daad5d09cdf`
- Immutable Task⑩ baseline SHA: `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`
- Workflow: [Reaction Lab finite polymer validation, run 38364302028](https://github.com/miyatayuuma/molecule-craft/actions/runs/38364302028)
- Failed-job-only retry: attempt 2, job `115621532713`, `stage-b-performance-comparison`, SUCCESS. The original failed job `115185631827` and its artifact remain in the run history.
- Comparison artifact: [attempt 2 raw intervals and comparison JSON](https://github.com/miyatayuuma/molecule-craft/actions/runs/38364302028/artifacts/11862515555)

Both profiles used Chrome `154.0.8037.97`, revision `@b510e9d7cd3a2fbd78d0ddc42234103206c5f78d`, 390×844 normal motion, six instances, the full 29-rule matcher, 384 candidates per fixed step, one 150-step warm-up, and four measured trials of 150 steps. The original `8.333333333333334 ms` hard limit and all comparison checks were unchanged.

| Profile | Task⑩ baseline trial P95 (ms) | Task⑪ candidate trial P95 (ms) | Baseline pooled P95 (ms) | Candidate pooled P95 (ms) | Median trial P95: baseline → candidate (ms) |
| --- | --- | --- | ---: | ---: | ---: |
| Independent Stage B, attempt 2 | 7.2, 7.0, 10.8, 7.4 | 7.4, 7.0, 7.2, 7.1 | 8.2 | 7.2 | 7.30 → 7.15 |

The candidate passed every-trial and pooled absolute hard gates, plus median-trial and pooled relative-regression checks. Its maximum trial P95 was 7.4 ms. The baseline had one 10.8 ms trial above the same hard limit; the prior attempt also had an above-limit baseline trial and one candidate trial at 9.0 ms. Those failures remain visible in the original run and are not replaced by the retry. The latest result supports acceptance of the candidate under the unchanged contract; the exact source of trial-tail variability is not isolated, so it remains a measurement risk rather than a demonstrated production regression.

### Final CI and visual evidence

- The same workflow run's finite-validation job passed: finite chemistry/discovery, all 25 routes' 3D geometry, mobile and desktop pointer QA, integrated mobile/desktop E2E, four-condition completion comparison, resource lifecycle, collection, and offline/PWA integrity.
- [Repository validation, run 38364301997](https://github.com/miyatayuuma/molecule-craft/actions/runs/38364301997): SUCCESS.
- [FIELD Insight balance validation, run 38364302013](https://github.com/miyatayuuma/molecule-craft/actions/runs/38364302013): SUCCESS.
- The finite-validation artifact for run 38364302028 is [available here](https://github.com/miyatayuuma/molecule-craft/actions/runs/38364302028/artifacts/11796451947). Its mobile and desktop screenshots were inspected for the 12 captured representative polymer routes, including the nine requested model types. The finite polymer sample remains inside the viewer; the inspected rotated, reset, mobile, desktop, and reduced-motion views showed no severe sample overlap or clipping. The geometry evidence reports 25/25 accepted layouts, fallback 0, and severe overlap 0.
- The existing completion contract remains 650 ms normal motion and 250 ms reduced motion. Missing frame intervals are not synthesized; the job's profiling and finite-resource evidence gates passed.
- The previously reported UTF-8 P0 review thread is resolved and outdated; unresolved blocking review threads: 0.

### Scientific limits and remaining closure step

The viewer remains a deterministic representative conformer derived from the authoritative finite `PolymerSample` graph. It is not molecular dynamics, an experimental structure, or an assignment of strict stereochemistry. No synthetic bulk morphology or chemistry-authority change is introduced.

This record is **pre-merge acceptance** at the measured candidate SHA. PR merge and post-merge main CI verification are recorded only after those operations succeed.
