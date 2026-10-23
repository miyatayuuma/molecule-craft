# Task⑤ PIB boundary-constrained recovery — UNRESOLVED / BLOCKED

Starting GitHub authority: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `92da7771cb3f17930d3163236fd042bbd1499d85`. PR #354 was Draft/Open/Unmerged with five resolved inline threads; PR #345 remained Open/Unmerged and untouched. Exact-source diagnostic review [6366335968](https://github.com/miyatayuuma/molecule-craft/pull/354#issuecomment-6366335968), created 2026-10-23 13:44:56 UTC, reported no major issues. It is not a final release review. There were zero workflow runs for the starting HEAD, not a CI PASS.

**Result: UNRESOLVED.** Twelve predeclared candidate slots produced four distinct poses; every pose fails actual-mesh CPU grading in all three established arithmetic modes. There is no actual GPU witness and no complete exclusion proof. Task⑤ remains BLOCKED, formal GPU remains the previous 0/3, and Task③ is unchanged. No production repair or main merge is justified.

All inputs and failures are retained in the [hash-bound evidence directory](polymer-local-fragment-task5-evidence/recovery/pib-boundary-92da7771/manifest.json). The [coupled ledger](polymer-local-fragment-task5-coupled-feasibility.md), [orientation ledger](polymer-local-fragment-task5-orientation-feasibility.md), [native raster calibration](polymer-local-fragment-task5-pib-raster-parity.md) and their full evaluation histories remain authoritative. None of the old COBYQA, smooth proxy, shadow heuristic, 8192-direction or 405-candidate searches was restarted.

## Actual boundaries and finite construction

The single seed is the prior retained best rotation vector `[-.054539559717073846, -.10453805899021659, .08315483688476073]` degrees, relative to the same boundary30#0 reference. Every proposed pose uses the same explicit-quaternion production fit, .92 headroom, shell pivot, safe rectangle and whole-graph depth budget. The original graph, XYZ, sphere/cylinder Float32 vertices, local matrices, element radii, atom origins and bond orders are fixed.

Two seed CPU rasters were made: full native graph and bond33 plus its two endpoint spheres. **88 pixels** visible as bond33 in the latter are H5 in the full raster. This is the new seed, not the old reference's 89-pixel result. Their native convex projected silhouettes locate the occlusion boundary. Each convex hull uses actual tessellated native mesh vertices; no smooth sphere-shadow function is used. Front-surface triangle depth and disjoint depth envelopes choose the nearby relevant blockers. Possible new depth ordering is not assumed safe: it is checked by each full raster.

At bond34, the production grader has projected native cylinder length12.956049664px, 26 half-pixel sampling steps, and visible samples11…26. Its measured continuous run is15×length/26 = **7.474644037px**. The next blocked sample at j10 can be recovered only by moving the C35 silhouette away from pixel center(222.5,231.5) while retaining cylinder coverage. The H32-side run already reaches the trimmed cylinder endpoint: there is no j27 inside that lane. The second construction therefore asks for projected cylinder-end displacement/length gain with the existing run intervals. Its fixed-step linearization explicitly does not predict the grader's later `ceil(length*2)` changes.

For a fixed pixel, positive clearance means outside the projected occluder. Central ±.01-degree rotation-vector component perturbations **only project** the fitted native meshes; they do not rasterize or evaluate a visibility score. Illustrative measured boundary derivatives, in pixels per degree (length row: CSS pixels per degree):

| Boundary | Seed value | ∂x | ∂y | ∂z |
|---|---:|---:|---:|---:|
| H5 clearance at bond33 pixel(183.5,233.5) | -.206949 | +2.245782 | -1.806862 | -1.032666 |
| C35 clearance at bond34 j10 pixel(222.5,231.5) | -.396724 | -.072184 | -.304633 | +.931247 |
| H5 clearance guarding bond32 pixel(162.5,260.5) | +.056419 | -2.200964 | +1.526686 | +.961499 |
| bond35 cylinder interior margin at pixel(204.5,194.5) | +.013112 | +.047949 | +.106938 | +.238215 |
| bond34 projected cylinder length | 12.956050 | -.172586 | -.094865 | +.022939 |

The H5 boundary direction that frees bond33 is opposed to the H5 boundary protecting bond32; increasing z clearance for the bond34 start is also opposed to the listed H5/bond33 z direction. These are local measured directions, **not a universal contradiction**. The complete records include every relevant retained pixel boundary for bonds32/33/35, the bond34 current run, cylinder coverage and occluders. Bond35 has no failing metric in this experiment; its protections never become an active LP constraint.

Before any raster, the protocol fixed **12 candidate slots, 38 CPU rasters, at most1 GPU diagnostic, no restart**. The construction combines the nearest4/8/12 H5-loss pixel sets, the two bond34 boundary directions and 1°/4° trust boxes (3×2×2). It uses finite linear programs, with strict local guards for retained visible screen cells and shared minimax slack for newly exposed cells. Target gain clearance .08px and retained-cell tolerance .04px are **proposal-generation parameters**, never changed acceptance thresholds. Actual unchanged optical gates decide all results.

The preparation first stopped after the two seed rasters because it attempted j27 beyond the trimmed cylinder. The error log is retained. Before generating/evaluating any candidate, that preparation bug was repaired with the above endpoint-length branch. The saved baseline PNGs were decoded and reused, with no repeat seed raster. `linear-input.json.gz` preserves the exact pre-candidate constraints; the candidate list was completely generated before any candidate raster. The fixed counts and stop conditions were unchanged. No result-dependent restart occurred.

All LPs have **positive residual slack**, so none satisfies even this local linear construction. Strict fixed-screen-cell guards are conservative and can overconstrain a feasible pose that shifts its visible pixels. Projected hull linearization also omits raster quantization, changes of closest hull edge, sample floor/ceil changes and new depth switches. Consequently, LP failure supplies **no certified excluded orientation region**. The candidates are nevertheless retained and checked by complete native-mesh CPU rendering to test the construction against actual pixels, rather than reporting the LP optimum as success.

## All candidate results

Each slot received legacy4 / shader32 / float64 full-graph raster grading. All11 required atoms and all10 required bonds were checked independently for visible atom fraction/diameter, bond area/continuous length/width/projected length, Q and actual fit/depth. Every atom, bond35 and all remaining six target bonds pass; fit/depth and Q pass. Bond33 and bond34 fail in every row. Bond32 also fails where shown. Full quaternions, fit, unrounded metrics, all independent margins, active boundary constraints and predicted boundary movements are saved.

| Slot | Minimum across3 modes | bond33 area L/S/F | Required area | bond34 continuous px | bond32 L/S/F |
|---|---:|---|---:|---:|---|
| a4-start-r1 | .964033147 | 92/92/92 | 94.648607 | 7.471256891 | P/P/P |
| a4-start-r4 | .964033147 | 92/92/92 | 94.648607 | 7.471256891 | P/P/P |
| a4-end-r1 | .945889144 | 92/91/91 | 94.564585 | 7.484758905 | F/F/F |
| a4-end-r4 | .945889144 | 92/91/91 | 94.564585 | 7.484758905 | F/F/F |
| a8-start-r1 | .946492119 | 92/91/91 | 94.573371 | 7.482495852 | F/F/F |
| a8-start-r4 | .946492119 | 92/91/91 | 94.573371 | 7.482495852 | F/F/F |
| a8-end-r1 | .946492119 | 92/91/91 | 94.573371 | 7.482495852 | F/F/F |
| a8-end-r4 | .946492119 | 92/91/91 | 94.573371 | 7.482495852 | F/F/F |
| a12-start-r1 | .949416666 | 93/93/93 | 94.616559 | 7.474049180 | F/P/P |
| a12-start-r4 | .949416666 | 93/93/93 | 94.616559 | 7.474049180 | F/P/P |
| a12-end-r1 | .949416666 | 93/93/93 | 94.616559 | 7.474049180 | F/P/P |
| a12-end-r4 | .949416666 | 93/93/93 | 94.616559 | 7.474049180 | F/P/P |

Required continuous length remains **7.75px**. L/S/F means legacy4/shader32/float64; P/F means PASS/FAIL. Identical rows are explicitly counted as repeated candidate slots, not twelve distinct orientations. The 1° and4° boxes choose the same optima because active pixel-retention boundaries, rather than the box radius, bind the local problems. The largest new bond33 area93 does not rescue its approximately94.617 requirement; it also loses bond32 in legacy4. The best new joint minimum.964033 is below the prior retained.964470, so the old failure remains the better measured reference.

Actual diagnostic CPU raster count is **38 =2 seed+12×3**, including duplicate-slot evaluations. Routine retained-evidence regressions are separately labelled validation, not additional candidate selection.

## GPU discrimination and stopping

**New GPU diagnostics:0.** Every candidate fails bond34 continuity by at least.265241px, with exact agreement on that length among the three CPU modes. The nine saved native/CPU calibration poses had zero corrected target-continuity differences; their sole remaining target metric difference was one bond33 area pixel at another pose. This observation is not an a-priori uncertainty bound for an unseen GPU pose. It nevertheless supplies no concrete mechanism supporting a continuity recovery here. Therefore the optional near-miss GPU exception is not exercised. There is no new native ID mask, actual screenshot/photometry capture or actual GPU PASS; the CPU PNGs are labelled CPU explicitly.

The finite construction is exhausted. There is no attempt to spend the unused GPU allowance on a speculative pose, and no extra seed, enlarged trust box or sweep. **FEASIBLE is not established; PROVEN_INFEASIBLE is not established; UNRESOLVED remains.** Zero SO(3) or local quaternion regions are safely excluded. Next work needs a less restrictive boundary construction that can exchange visible pixels while jointly preserving the bond32/34 runs and bond33 area, or a conservative full-region exclusion certificate. It must not restart these twelve slots as a new blind search, relax Task③, or modify graph/XYZ.

## Validation and release state

The change consists only of two offline diagnostic tools, a retained-evidence regression, this ledger and evidence. All production, renderer, geometry generator, graph/XYZ/origin/identity, save schema and PWA bytes are unchanged from the starting HEAD. Prior coupled/orientation/native-mesh/parity evidence manifests and their file/input hashes are verified before committing. The old41-test suite plus3 new regression tests passes; fixed PLA/PET and25 final/95 intermediate geometry remain PASS. PWA freshness verifies353 assets and repository hygiene has0 warnings. These deterministic checks do not certify new browser or timing acceptance.

All25 final browser/fixed12 visual jobs, V0–V8/C01–C09/S10–S16, PAN/NBR L1, final resource/lifecycle/PF heap, strict Stage B, Finite real RAF, Repository/FIELD/PWA browser, final release review, merge and post-merge verification are **NOT_RUN / NOT_CERTIFIED for this checkpoint** because formal PIB3/3 is unmet. Historical successful tests and failed strict runs remain retained; none is relabelled as current-source acceptance. No failed hard gate is skipped or weakened for release, and no Task⑤ failure is transferred to Task⑥.

PR #354 remains Draft/Open/Unmerged. Main is unchanged. Any new diagnostic source review is separate from final release review. The diagnostic checkpoint uses `[skip ci]` solely to avoid an unjustified full browser campaign; it supplies no release waiver.

To validate the frozen records without restarting the experiment:

```sh
node --test tests/polymer-task5-boundaries.test.mjs
```

`scripts/diagnose-polymer-task5-boundaries.mjs` and `scripts/solve-polymer-task5-boundaries.py` are owned by this ledger, not imported by production. The experiment refuses overwrite; its preparation-only resume path requires baseline masks and refuses an existing candidate list. No rerun is part of routine validation.
