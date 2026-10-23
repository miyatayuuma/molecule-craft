# Task⑤ PIB coupled mesh feasibility — UNRESOLVED / BLOCKED

The subsequent finite [native-boundary diagnosis](polymer-local-fragment-task5-boundary-recovery.md) retained twelve candidate slots/four distinct poses, all FAIL in three CPU modes. It does not replace or rerun this experiment; joint feasibility remains UNRESOLVED and Task⑤ BLOCKED.

Start authority: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `6d508e753e2c7bd8cf3b2578d81311936c9e8250`. Both matched GitHub and remote refs. PR #354 was Draft/Open/Unmerged; PR #345 remained Open/Unmerged. All five inline threads were resolved. Codex receipt [6364897951](https://github.com/miyatayuuma/molecule-craft/pull/354#issuecomment-6364897951) covers the starting diagnostic commit, not this change or final release. The starting HEAD had zero workflow runs; this is not CI PASS.

**Disposition: UNRESOLVED.** No simultaneous witness was found by the one bounded, actual-mesh local solve below. No safe interval exclusion or exhaustive SO(3) coverage was implemented, so **PROVEN_INFEASIBLE is not established**. No production repair, GPU acceptance campaign, threshold change, or merge follows this result. Task③ remains unchanged.

The [manifest](polymer-local-fragment-task5-evidence/recovery/pib-coupled-6d508e75/manifest.json) retains the protocol, every evaluation, optimizer termination, final three-mode confirmation, source/input hashes and validation. The prior [orientation ledger](polymer-local-fragment-task5-orientation-feasibility.md), [recovery ledger](polymer-local-fragment-task5-pib-recovery.md), [raster calibration](polymer-local-fragment-task5-pib-raster-parity.md) and native captures remain authoritative. The previous 8192 directions, 405 candidates, 152 smooth-proxy evaluations and 21 finalist rasters were **not rerun**.

## Coupled experiment

The protocol was written before the first new evaluation. It allowed at most **240 objective evaluations**, **400 optimizer iterations**, and **9 fixed confirmation rasters**, with no second seed, restart, or sweep. Actual work was **25 objective evaluations and 3 confirmation rasters**. The unused budget does not authorize another search. Regression replays are validation of retained observations, not new candidate selection.

The sole seed is the saved boundary30#0 quaternion from the native-mesh evidence. Variables are the three components of a rotation vector, each bounded by ±6 degrees, left-multiplied onto that quaternion. These are component bounds, not independent Euler angles or a spherical view-angle bound. The saved camera rotation is identity, so the implementation's world-axis increment equals the stated camera-axis increment for this frozen input. No orientations from a new direction grid are generated.

For every evaluation:

- Keep the actual graph, all native sphere/cylinder Float32 attributes, inherited local matrices, XYZ, IDs, origin and bond order fixed.
- Refit that explicit quaternion with the unchanged production shell pivot, .92 fit headroom, 262×309 safe region and rotation-invariant whole-graph depth limit. Required-target arrays are empty **only in the fit call** to bypass its rejected smooth scorer; the full actual target sets are still graded below. Explicit-quaternion fit selects no alternative orientation.
- Render the **complete graph**, with sphere/cylinder facets, front-face/depth tests and independently evaluated barycentric edges. Use the previously calibrated legacy4 arithmetic, without the discarded smooth-side or graph-shadow proxies.
- Independently grade all 11 target atoms and 10 bonds, including atom fraction/diameter, cylinder visible area/continuous length/projected width/projected length, and local Q. Maximize their **minimum normalized margin**, without capping passing ratios at 1. Safe-region fit and every atom's near/far envelope are separate hard guards.

COBYQA's local quadratic model proposes trust-region steps; every accepted observation/objective is recomputed from the discrete full mesh raster. Initial radius was 1 degree, terminal radius .025 degrees, target minimum margin 1.02. The target is an optimizer stop condition for CPU screening, not a new acceptance threshold. The unchanged formal thresholds decide the recorded pass/fail fields.

The solver stopped after 25 evaluations because its trust-region radius reached its configured lower bound. Its `success: true` means this numerical termination, **not feasibility or optimality**. The best evaluated point rotates by components `[-.054539559717073846, -.10453805899021659, .08315483688476073]` degrees. It is a diagnostic witness of failure only; it is not imported into production.

| Anchor30 measurement | Saved reference | Best new actual-mesh CPU candidate | Required |
|---|---:|---:|---:|
| Minimum normalized margin | .962091 | .964470 | ≥1 |
| bond32 area | 62 | 63 | 61.702819 at new pose |
| bond32 continuous CSS px | 7.869507 | 7.849078 | ≥7.75 |
| bond33 area | 91 | 92 | 94.628705 at new pose |
| bond34 continuous CSS px | 7.456203 | 7.474644 | ≥7.75 |
| bond35 continuous CSS px | 12.838561 | 12.834141 | ≥7.75 |

Reference values are bound to the retained seed; the complete unrounded rows are in the history. At the new pose, bond32 and bond35 pass, every requested atom passes, Q=52.9812065, and the fit/near/far guards pass. **bond33 area and bond34 continuity fail simultaneously.** All three fixed arithmetic modes agree on those two failures and on the .964470 minimum. bond34 area is49/50/50 pixels across modes, but its area condition passes in every mode; that pixel variation does not change this disposition.

The remaining six control-confirmation rasters (0/17) were not run because anchor30 already fails. No actual GPU/browser work was run. Arithmetic agreement among three CPU modes is empirical sensitivity evidence and does not bound an unseen native compiler's raster uncertainty.

## Proof boundary and smallest missing fact

This experiment neither covers the ±6-degree component box exhaustively nor excludes its unevaluated points. It also says nothing conclusive about the rest of SO(3), alternative roll, or other focus transforms permitted by the existing contract. A trust-region stop, a finite-difference response, an optimizer model, or the largest sampled score is not a safe upper bound. **Zero orientation regions were certified infeasible.** The selected minimum is a measured value, not a global optimum.

The smallest unresolved question is whether a permitted pose can simultaneously keep bond33 above its pose-dependent half-lane-area threshold and bond34 above7.75px continuous length **while retaining bond32/35 and all remaining target/fit/depth conditions**. No additional historical quaternion or GPU capture is needed to state that question; the frozen inputs are present. The missing result is either a reproducible joint witness or a conservative exclusion certificate.

A valid interval approach would have to enclose the *fitted* projected native geometry and depth ordering over each quaternion/focus cell, retain every pixel/sample whose ownership is uncertain, and upper-bound both possible area and possible continuous run. The continuous grader changes `ceil(projectedLength*2)` and floored pixel indices discontinuously; shader/subpixel rounding and sphere/cylinder boundaries also matter. Unbounded gradients or a smooth sphere-shadow function do not supply that certificate. This work implements no such enclosure and claims no exclusion. Starting another blind sweep or relaxing Task③ is therefore unjustified. Resume with that missing bound/witness method, not a larger invocation of this local optimizer.

## Validation and release status

**41 tests PASS, 0 FAIL, 0 SKIP**, including the three new retained-observation regressions, the fixed PLA/PET inputs, all25 final/95 intermediate geometry, observation/raster/static/resource/heap contracts and prior native-mask regressions. PWA freshness verifies **353 assets**; repository hygiene reports **0 warnings**. Syntax and diff checks pass. Exact logs are retained in the manifest. These deterministic checks do not replace browser or timing acceptance. All production/runtime/PWA bytes remain identical to the start commit; the changes are three offline tools, a retained-evidence regression, this ledger and immutable observations.

Formal PIB GPU anchor0/17/30 remains the original **0/3**. No CPU result is promoted to PASS. All25 browser, fixed12 visual jobs, V0–V8/C01–C09/S10–S16, PAN4/NBR1 L1, final resource/lifecycle/PF3cycle/heap, normal/reduced/mobile/desktop/DPR, Save/Collection/Engineering, strict Stage B, strict Finite real RAF, Repository Validation, FIELD Insight, final-source PWA browser validation, final release review and post-merge verification remain **NOT_RUN / NOT_CERTIFIED for this checkpoint**. The historical source50c0b38f Repository/FIELD PASS and Finite FAIL remain historical, and are not substituted for current-source gates.

PR #354 stays **Draft/Open/Unmerged**, main unchanged. PR #345 is untouched. No Task⑤ failure transfers to Task⑥. The diagnostic checkpoint uses `[skip ci]` to avoid an unjustified full browser campaign; it does not waive any release gate. External diagnostic source review is requested separately; it cannot establish release readiness.

## Retained-observation validation

Run the regression without restarting the optimizer:

```sh
node --test tests/polymer-task5-coupled-mesh.test.mjs
```

`scripts/solve-polymer-task5-coupled-mesh.py`, `scripts/polymer-task5-coupled-mesh-oracle.mjs`, and `scripts/check-polymer-task5-coupled-mesh.mjs` are owned by this document. They are offline tools, never production imports or RAF work. The solver and confirmation commands refuse to overwrite an existing experiment; routine verification must use the frozen records and tests. NumPy/SciPy versions, the pre-evaluation protocol and actual stop reason are saved.
