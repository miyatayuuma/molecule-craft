# Task⑤ PIB orientation feasibility — BLOCKED

Start authority: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `6a2f056a13ddea48c1d55218f3a58f1b3d058c62`, Draft/Open/Unmerged. Both matched GitHub. PR #345 stayed Open/Unmerged. All five inline threads were resolved; the latest 6a2f056 review request still had no completed receipt. HEAD had no PR-triggered workflow runs, which is not CI PASS. The latest branch campaign is older source50c0b38f: Repository39740905733/FIELD39740905500 succeeded, Finite39740905764 failed. Those results are not acceptance of this checkpoint.

**No production orientation repair is adopted.** The rigid-view feasibility of anchor30 remains unresolved. This is a bounded negative result for one graph-shadow method, not a proof that every rigid pose is impossible. The original formal GPU campaign remains **0/3**. No new GPU/browser campaign was run.

Evidence: [manifest](polymer-local-fragment-task5-evidence/recovery/pib-orientation-6a2f056a/manifest.json). Reuse the [nine exact native captures](polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/manifest.json), [prior raster calibration](polymer-local-fragment-task5-pib-raster-parity.md), and [prior occlusion ledger](polymer-local-fragment-task5-pib-recovery.md). The 85→9-pixel investigation, 8192-direction study, 405-pose grid and five-pose/two-focus study were not repeated. No new universal CPU/native error bound or pixel-perfect prerequisite is imposed.

## Geometric constraints and identified conflict

All sites retain their actual 11 atoms and 10 bonds. Graph digest: `f7bd07a6bc990bb0157fe2e917b2df5a7c1c4510a0a924c137dccad5b914b7b6`. The inherited Float32 mesh geometry, local quaternions and matrices come from the existing exact capture; original XYZ, origins, camera and measured 262×309 safe rectangle are fixed. The selected shell and rotation-invariant whole-graph depth budget remain those of production.

For a unit view normal `n` and bond axis `v`, end-on compression follows `sin(theta)=||v×n||`. A large projected cylinder length alone is insufficient: endpoint spheres can obscure its ends, another atom can split its visible section, and another cylinder can overwrite pixels. Roll changes fit scale and discrete coverage, even when the nominal normal is fixed. The actual perspective eye also depends on the fitted translation/scale, so orthographic angles alone do not decide acceptance.

The camera-direction condition for a sphere shadow can be stated without scanning directions. Let `O` be the eye in model coordinates, `c=K−O` the vector to an occluding sphere of radius `r`, and `p(t)=A−O+tV` a point on a requested connection. Its ray intersects that sphere when

`D(t) = (p(t)·c)^2 − ||p(t)||^2 (||c||^2−r^2) >= 0`,

with a forward intersection and the near ray parameter `(p(t)·c−sqrt(D(t)))/||p(t)||^2` between zero and one. Since `D(t)` is quadratic, its roots bound the blocked intervals for that fixed eye. Cylinder front surfaces, finite ends and their area must still be evaluated; an axis shadow is not the formal cylinder-area or continuous-pixel criterion.

For an orthographic diagnostic, the separation between blocker `K` and the infinite bond line is

`d(n)=|n·((K−A)×v)| / ||v×n||`.

This explains why normals derived only from bond-axis gaps can miss a shadow from another methyl group. Maximizing the numerator does **not** maximize `d(n)` because its denominator changes too. Simultaneous feasibility requires intersection of the endpoint, other-atom, bond-overlap, area, continuity, atom-fraction, scale and fit constraints. No global existence/nonexistence proof is obtained here.

Before creating new poses, a fixed component experiment used one retained reference per anchor. Each of its ten bonds was rendered (a) alone, (b) with endpoint spheres, (c) with all spheres, and (d) in the full graph. Full graph is reused within each anchor: **93 CPU rasters**, within the predeclared cap123. Counterfactual removal is diagnostic only; production never hides atoms or bonds.

At anchor30 reference boundary0:

| Bond | Endpoint-only area / required | Full-graph area / required | Endpoint/full continuous CSS px | Cause |
|---|---:|---:|---:|---|
| 32 C30–C34 | 63 /61.821 | 62 /61.821 | 7.870 /7.870 | Endpoint-limited, already close to 7.75 |
| 33 C30–C35 | 180 /94.474 | 91 /94.474 | 29.286 /14.395 | **H5 occludes89 additional pixels** |
| 34 C35–H32 | 51 /37.672 | 51 /37.672 | 7.456 /7.456 | Endpoint spheres; continuous length fails |
| 35 C35–H33 | 81 /46.535 | 81 /46.535 | 12.839 /12.839 | Passing at this pose |

The 89-pixel attribution is independently bound to the **existing native ID mask** in the added regression: pixels visible as bond33 in the endpoint-only CPU counterfactual are H5 in that native mask; zero are attributed to another object. The native mask was not newly captured. Other-bond removal makes no requested-bond-metric difference at these three reference poses; atom-metric changes under counterfactual removal are not adjudicated. This is a local finding, not proof that cylinder overlap never matters elsewhere. Full decomposition of every specified bond and the full-graph atom fractions is retained.

## One bounded graph-shadow candidate method, rejected

The protocol was saved before evaluation. It chooses a second seed using the strongest observed nonendpoint atom shadow and the weakest endpoint-limited bond. Project `(K−A)×v_shadow` onto the plane perpendicular to the latter bond axis, use the sign closest to the retained normal, and preserve the initial roll by minimal normal rotation. This is a general graph/coordinate-derived heuristic, not a PIB quaternion or a production rule using saved candidates.

SLSQP then maximizes the minimum independent normalized atom-fraction/diameter, cylinder-area/continuous-length/width/length and Q ratios. Each seed permits at most800 evaluations and80 iterations; rotation-vector x/y components are bounded by±40°, z by±90° (these are not independent view-tilt/roll bounds). The retained reference is a feasibility control. At0/17 there is no nonendpoint shadow at the reference, so the duplicate second seed is not solved. Actual counts: **73 +25 +50 +4 =152** unique evaluations, with all history retained. `best` means the best minimum-margin evaluated point, including finite-difference points, not necessarily the final SLSQP iterate.

The smooth proxy uses96 atom-disk rays,40×9 cylinder-side quadrature and97 continuity samples. It omits cylinder caps/other-cylinder shadows and facets/pixels; negative own-sphere ray discriminants are clamped. A zero continuous run can produce a flat constraint. In particular, anchor30 graph seed stopped after four evaluations at zero minimum margin. An optimizer return is **not** feasibility, optimality or successful repair. These limits are reasons to reject its use as a production selector.

Finalists were fixed from those solves, plus the three references: **7 poses ×3 arithmetic modes =21** mesh rasters, within cap27. Python fit independently reproduces production JS fit within1e−8 for scale/position. Independent atom/bond/Q margins and separate actual safe-region/depth gates are checked; no new focus/pivot/DOM/scale rule is introduced. Arithmetic modes are sensitivity checks, not proven uncertainty bounds for unseen orientations.

| Anchor / candidate | Minimum mesh ratio over3 modes | Partial A03/A04 across3 modes |
|---|---:|---|
| 0 reference / optimized | 1.187616 /1.136097 | Both predicted PASS |
| 17 reference / optimized | 1.074366 /1.127004 | Both predicted PASS |
| 30 reference | .962091 | FAIL |
| 30 reference-seed max-min | .822449 | FAIL |
| 30 graph-shadow seed | 0 | FAIL |

The anchor30 reference-seed candidate has bond33 area87<95.259 and bond34 continuous6.374<7.75: the smooth proxy does not preserve the formal mesh margin. The graph-shadow seed improves bond33 to101>=93.850 and bond34 continuous18.520, but makes bond32 and35 **zero pixels / zero continuous length**. Its angles to the normal are16.13° and19.99°, respectively, versus34 at90°. This directly demonstrates the competing occlusion constraints for that candidate. It does not show that every interpolation or every other normal is infeasible.

None of these CPU predictions includes new A06 photometry, actual pointer focus/reset, or formal source-bound three-anchor GPU acceptance. 0/17 partial predictions cannot be promoted to full PASS. No supportable anchor30 candidate exists in this fixed experiment, so no production change or formal browser campaign follows it.

## Validation, review and disposition

- **38 deterministic tests PASS /0 FAIL /0 SKIP**, including the new native-mask shadow regression, fixed PLA/PET, all25 final/95 intermediate geometry, observation, raster, static/resource/heap contracts. This does not certify browser/performance acceptance.
- Precache freshness: **353 verified assets**, unchanged. Repository hygiene, syntax and diff checks are recorded in the manifest. No production/PWA bytes, graph/XYZ/IDs/origins, bond orders,160-iteration ceiling, chemistry/visibility thresholds,40 directions/one local attempt,650/250ms feedback, Stage B cache/fixed steps/baseline/warm-up/trials, save schema or performance budgets change.
- A separate read-only reviewer examined the three tools and evidence. It confirmed the shadow/fit/metric findings and requested corrections to the seed's mathematical description, actual budgets, selection rule, rotation bounds and proxy limitations; those descriptive corrections are applied without rerunning searches or altering numeric observations. This is a diagnostic-code review, **not final release review**. External Codex review status is recorded separately on the PR.
- Formal PIB remains original **0/3**. Final all25 actual browser/fixed12jobs, V0–V8/C01–C09/S10–S16, PAN4/NBR1 L1, normal/reduced/mobile/desktop/DPR, final resource/lifecycle/PF3cycle/heap, Save/Collection/Engineering, Repository Validation/FIELD browser gates, strict Stage B/Finite real RAF, final-source release review, merge and post-merge are **NOT_RUN/NOT_CERTIFIED** at this checkpoint.
- PR #354 stays **Draft/Open/Unmerged**, main unchanged. No Task⑤ failure transfers to Task⑥. A diagnostic checkpoint `[skip ci]` prevents unrelated expensive campaigns; it does not waive any mandatory release gate.

Smallest restart: use the now-identified **H5 shadow cone on bond33 together with endpoint visibility of bonds32/34/35** as the coupled system. The single-shadow numerator heuristic and smooth-side proxy are rejected; neither a blind direction sweep nor a repeat of raster-parity diagnosis addresses this failure. A future selector needs supportable actual-cylinder area/continuity constraints before another fixed-budget candidate experiment or formal GPU campaign. Current rigid XYZ feasibility remains unresolved; changing chemistry/coordinates or relaxing the gates is not justified.

## Reproduction

The following are offline diagnostic replays, not new campaigns or formal acceptance. The Python tool requires NumPy/SciPy; versions and hashes are in the manifest. Run from repository root:

```sh
node scripts/analyze-polymer-task5-orientation-feasibility.mjs
OPENBLAS_NUM_THREADS=1 python scripts/solve-polymer-task5-orientation.py
node scripts/check-polymer-task5-orientation-candidates.mjs
node --test tests/polymer-task5-orientation-feasibility.test.mjs tests/polymer-task5-raster-parity.test.mjs tests/polymer-task5-pla-recovery.test.mjs tests/polymer-task5-pet-recovery.test.mjs tests/polymer-fragment-task4.test.mjs tests/polymer-observation.test.mjs tests/polymer-raster-grading.test.mjs tests/polymer-static-render.test.mjs tests/polymer-allocation-window.test.mjs tests/polymer-heap-grading.test.mjs
node scripts/build-precache.mjs --check
node scripts/check-repository-hygiene.mjs
```

These three scripts and the new regression are owned by this ledger. They are never imported into production RAF and perform no GPU readback. The retained candidate quaternions are evidence only.
