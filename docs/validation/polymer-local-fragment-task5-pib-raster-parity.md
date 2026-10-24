# Task⑤ PIB raster parity recovery — BLOCKED

Start: main `593ac571e4d664f7af885855352142874dd227ab`, PR #354 HEAD `d100a76bcdb183f3669a6a93283dee2c91f3113f`, Draft/Open/Unmerged. GitHub authority matched both SHAs; all five inline review threads were resolved. The starting HEAD had zero workflow runs, not a successful CI result. PR #345 stayed open/unmerged and was not changed. This work changes offline tools, their regression tests and this evidence ledger only. **No production orientation repair is adopted.**

[Evidence manifest](polymer-local-fragment-task5-evidence/recovery/pib-raster-parity-d100a76b/manifest.json) binds the exact scripts, Node v24.19.0, source capture manifest, all results and test log. The [original nine captures](polymer-local-fragment-task5-evidence/recovery/pib-exact-mesh-519a686c/manifest.json), their quaternions, Float32 vertex/index arrays, local/world matrices and masks are unchanged. Historical quaternions remain NOT_CAPTURED. No newly captured quaternion is attributed to the historical campaign.

## Fixed raster experiment and cause

Budget: nine existing captures × eight fixed arithmetic/coverage modes = **72 CPU renders**, zero new orientations, zero GPU/browser experiments. Subsequent executions only regenerated identical observations after adding trace fields and assertions; they were not additional searches. The modes were old legacy4, independently evaluated third edge, raw-coordinate culling, no culling, sequential Float32 matrix arithmetic, perspective depth, grid8 and Float64. All modes and failures are retained.

The old CPU algorithm computes the third barycentric weight as `1-u-v`. At exact shared edges, cancellation can make this slightly negative, reject coverage, or bypass exact-zero edge ownership. Evaluating the third edge independently fixes the demonstrated defect. The analyzer exports this option; its default legacy replay remains unchanged so the original evidence is reproducible. It is test-only and never enters production RAF.

| Capture | Old difference | Background/object | Object/object | Corrected difference |
|---|---:|---:|---:|---:|
| control0 y0 p0 | 7 | 7 | 0 | 0 |
| control0 y90 p−60 | 1 | 1 | 0 | 0 |
| control17 y45 p30 | 14 | 11 | 3 | 0 |
| control17 y135 p30 | 16 | 14 | 2 | 4 |
| control30 y45 p−60 | 6 | 5 | 1 | 1 |
| control30 y90 p−60 | 6 | 5 | 1 | 1 |
| boundary30 #0 | 14 | 13 | 1 | 1 |
| boundary30 #1 | 15 | 13 | 2 | 0 |
| boundary30 #2 | 6 | 4 | 2 | 2 |
| Total | **85** | **73** | **12** | **9** |

Of the original 85 differences, 77 disappear with independent edges; one new edge difference appears, leaving nine. `parity-analysis.json.gz` retains every original and corrected difference pixel, native/CPU object IDs, background/object versus object/object, triangle IDs, barycentric weights, legacy third weight, signed distance to the closest edge, raw/snapped orientation, depth and all mode outcomes. It also retains per-target atom fractions/count effects and all ten target bond areas, widths, projected lengths and continuous visible lengths for every capture.

| Mechanism | Evidence and disposition |
|---|---|
| Triangle coverage / edge ownership | Confirmed CPU defect above. Four complete native masks now match exactly. |
| Subpixel quantization / exact-edge convention | Eight remaining pixels lie exactly on snapped triangle edges (signed distance zero). Seven are background/object, one is atom2/atom36 ownership at boundary30 #0. Their native result is compatible with the alternate precision modes. This identifies the coverage boundary; it does not uniquely establish the uncaptured native compiler/build convention. |
| Float32 vertex calculation | Group/local/world authority and projection are reused. Sequential Float32 arithmetic was measured separately; it does not eliminate the residual. The native FMA/SPIR-V implementation is not reconstructed or asserted. |
| Front/back culling | Captured material side is respected. Raw-coordinate or disabled culling does not improve the corrected result overall. No production culling change is supported. |
| Depth interpolation / comparison | One remaining pixel: boundary30 #2 at (143,279), native atom35 versus CPU bond33. Competing depth difference is `5.960464477539063e-8` (one Float32 ULP near NDC 1). Perspective-depth mode resolves that pixel, but not all residuals. Exact native interpolation/rounding is unobserved. |
| Clipping / viewport | Captured vertex depths span 11.5533–25.1335, inside near .1 / far500. No near/far intersection is involved. Viewport projection/readback dimensions and orientation are supported by four fully matching masks; screen clipping alone does not account for the listed residuals. |
| Object ID / readback | All native pixels in all nine masks decode to the captured object IDs or background; zero foreign/mixed colors. Single-sample ID attachment, SRGB color conversion and Y reversal remain those of the existing probe. No ID-corruption evidence was found. |

These mechanisms are distinguished as confirmed versus compatible. The remaining native arithmetic cannot be uniquely deduced from saved pixels. **Pixel-perfect CPU parity is not a required release gate.** For the nine calibrated poses, uncertainty is already bounded by their actual masks; an unseen pose does not inherit that bound.

After the correction, all target measurements are identical to native except boundary30 #2: atom35 visible fraction differs by .000916167 and bond33 area by one pixel (CPU84/native83). All target continuous lengths agree exactly and no target or joint partial decision flips. The original best boundary30 #0 still has actual bond33 area **91 <94.474167779** and bond34 continuous **7.456203238 <7.75**. Its FAIL is not explained away by CPU arithmetic. These are A03/A04 partial measurements, not A06/Q/pointer/reset acceptance.

## One generic focus rule, rejected

The confirmed production scorer mismatch remains: its 33 centerline samples are not the formal lane-area observable. This work does not replace one with the other under the same label.

One follow-up budget was fixed before evaluation: **five retained orientations × two focus rules = ten fits**, each measured with independent-edge legacy4, grid8 and Float64 (30 CPU renders). The orientations are the existing best graph-facet pose for0/17 and the three saved boundary30 poses. No orientation is optimized or added.

The single candidate rule uses the selected feature AABB pivot specified by Task③ §8 and the maximal shell fit within the existing measured safe rectangle (minus a 1e-6 numerical fit margin), retaining the whole-graph rotation-invariant near/far budget. The reference keeps the shell AABB pivot and .92 scale headroom. Actual inherited local matrices are asserted equal to the frozen XYZ matrices before prediction. Graph, XYZ, radii, local quaternions, camera, DOM rectangle and all thresholds are preserved.

Atom visible fraction, lane visible area, continuous length, minimum projected width/length, local Q, fit bounds and depth are evaluated separately. The minimum normalized margin ranks those independent measurements, never the centerline proxy. Three arithmetic modes and additional guards of two area pixels, one CSS pixel continuous length and .01 atom fraction are sensitivity screening only, not a certified error bound for unseen poses.

| Retained orientation | Reference minimum margin | Candidate minimum margin | Partial result across three modes |
|---|---:|---:|---|
| facet0 | 1.187616 | 1.191247 | Both predicted PASS; no formal acceptance |
| facet17 | 1.074366 | 1.089847 | Both predicted PASS; additional continuous guard fails |
| boundary30 #0 | .962091 | .942474 | Both FAIL |
| boundary30 #1 | .954432 | .920539 | Both FAIL |
| boundary30 #2 | .899252 | .950033 | Both FAIL |

At candidate boundary30 #0, bond33 has 106 pixels versus111.408912 required and bond34 continuous7.446872; changing the pivot/scale does not solve its coupled area/length deficit. All three anchor30 candidate poses fail every arithmetic mode. Therefore this rule is **not adopted in production**. This is neither a proof that every rigid pose is impossible nor grounds for another unbounded direction sweep.

## Validation and closure

- Relevant deterministic tests: **37 PASS, 0 FAIL, 0 SKIP**, including frozen PLA/PET, all25 final/95 intermediate graph/geometry authority, observation, optical grading, static/resource/heap, and two new native-mask raster regressions. The tests preserve legacy replay and retain the one-pixel ownership difference/failed boundary.
- PWA freshness: **353 assets**. Repository hygiene: zero warnings after adding this ownership reference. Syntax and diff checks pass. Runtime, generated PWA assets, save schema, chemistry, origin, geometry solver and performance thresholds are unchanged.
- Formal PIB remains the original **0/3**. No new actual PNG/ID-mask/A06/real-pointer local-focus/reset campaign was run. No CPU prediction is promoted to acceptance.
- Final all25 browser/12 static jobs, V0–V8/C01–C09/S10–S16, PAN4/NBR1 L1, motion/device/DPR, PF3cycle/resource/heap, Save/Collection/Engineering, Repository/FIELD browser gates, strict Stage B and Finite real RAF are **NOT_RUN / NOT_CERTIFIED on this checkpoint**. Baselines, trials, warm-up, comparator and 650/250ms contracts are unchanged. A checkpoint commit with `[skip ci]` does not waive these gates.
- Independent code review is requested against the saved code checkpoint; a receipt is required before claiming that review complete. It cannot replace the unmet acceptance gates.
- PR #354 stays **Draft / Open / Unmerged**, main unchanged, no merge or post-merge SHA. Task⑤ is **BLOCKED**, and no unmet requirement is moved to Task⑥.

The next minimal decision is a demonstrably generic orientation-generation/ranking repair that jointly improves lane area and continuous visibility on the fixed graph, with explicit prediction uncertainty. The demonstrated shared-edge bug and calibrated metric effects no longer justify restarting raster diagnosis from scratch or requiring unconditional all-pixel equality. Reuse these captures and the rejected focus rule; preserve the existing40 directions/one-anchor attempt for a supportable formal candidate. If no supportable candidate is available, retain the blocker rather than modifying XYZ, hiding atoms, inserting a PIB quaternion or relaxing a gate.

## Reproduction

First decompress the nine captures with the recipe in [the exact-mesh ledger](polymer-local-fragment-task5-pib-recovery.md#exact-mesh-follow-up--actual-capture-519a686c-still-blocked). Then, from the repository root:

```sh
node scripts/analyze-polymer-task5-raster-parity.mjs test-results/pib-exact-replay
node scripts/diagnose-polymer-task5-focus-rule.mjs test-results/pib-exact-replay
node --test tests/polymer-task5-raster-parity.test.mjs tests/polymer-task5-pla-recovery.test.mjs tests/polymer-task5-pet-recovery.test.mjs tests/polymer-fragment-task4.test.mjs tests/polymer-observation.test.mjs tests/polymer-raster-grading.test.mjs tests/polymer-static-render.test.mjs tests/polymer-allocation-window.test.mjs tests/polymer-heap-grading.test.mjs
node scripts/build-precache.mjs --check
node scripts/check-repository-hygiene.mjs
```

The two new scripts and the exported legacy renderer are owned by this document and the native-mask regression tests. They are not imported by production. The preserved protocols and full observations allow independent replay without another GPU job.
