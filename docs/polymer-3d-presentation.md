# Finite Polymer 3D Presentation

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

The profile contains one warm-up and four measured trials per viewport and motion mode. Raw `requestAnimationFrame` intervals, each trial's P50/P95/maximum, completion time, and interval count remain in the uploaded evidence. For frame P50/P95 comparison, the gate gives each measured trial equal weight by comparing the median of the four trial-level percentiles; the report also retains pooled P50/P95/maximum. Baseline-derived MAD tolerances and the existing coarse-sampling floors are unchanged. This matters when headless reduced-motion runs capture only one or two intervals per trial: a pooled P50 can jump by a refresh interval solely because the baseline has an even total count and the candidate an odd total count. That pooled result remains visible in the report, while the pass/fail comparison uses the four equally weighted trials. Per-trial layout-generation time is derived from successive snapshots of the cumulative `layoutComputationMs` counter; it is not inferred from frame intervals.

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
