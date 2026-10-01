# FIELD Particle Performance Closure — P5

Start main: `eda186afb36a485f9f4becf472c4faa9a95ede9c` (P4 / PR #324).

**Decision: Class C — non-particle Canvas bottleneck.** No production optimization is added in P5. **CLOSED — No Further Optimization Required.** Production source, Canvas drawing and PWA outputs remain byte-identical to P4; P5 adds test-only profiling, evidence verification and this integrated authority.

## Architecture and invariants

Before P2–P4, assist, pickup, dynamic animation and drawing discovered candidates by traversing the entire dust population. Final runtime uses one map-local 128-unit spatial grid, canonical ordinal ordering for assist/pickup/renderer queries, and a separate stable flow/vortex reference registry for animation ownership. Cluster expansion keeps its existing owner and synchronizes the same grid after movement. Renderer query includes the original ±35 CSS-pixel margin and retains exact ready/screen predicates and original drawing.

No density, placement, spacing, physics, radius, fixed-step frequency, respawn, resource value, Rare Ecology, visual style, glow, DPR or reduced-motion behavior changes are permitted. Particle omission and quality reduction cannot satisfy closure. Gameplay tolerance stays `1e-8`; all 18 frozen P1 PNGs must match bytes.

## Reproduction

```sh
node --test tests/field-renderer-profile.test.mjs tests/field-profile-authority.test.mjs
CHROME_BIN=/path/to/chromium FIELD_PROFILE_MODE=coarse FIELD_PROFILE_OUTPUT=test-results/field-particle-p5/coarse node scripts/profile-field-particles.mjs
node scripts/summarize-field-profile.mjs test-results/field-particle-p5/coarse/raw.json.gz test-results/field-particle-p5/coarse/aggregate.json
CHROME_BIN=/path/to/chromium FIELD_PROFILE_MODE=components FIELD_PROFILE_OUTPUT=test-results/field-particle-p5/components node scripts/profile-field-particles.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-field-visual-baseline.mjs
node scripts/check-field-profile-evidence.mjs --current
```

Use distinct `FIELD_PROFILE_OUTPUT` directories for phases. Five runs per fixture/motion/condition are mandatory for timing authority; `--smoke` uses two short runs solely for structural checks. `history` requires `FIELD_PROFILE_ROOTS` mapping `p1`–`p4` to detached Git checkouts of the original stages. Original production code is imported from those checkouts; a transient HTML adapter only returns already collected raw timing arrays. No historical production copies or full-scan fallbacks are shipped.

```sh
git worktree add --detach /tmp/field-p5-p1 da356db2d1f86f1d6b2e0533e07a4af7cad36030
git worktree add --detach /tmp/field-p5-p2 a331c09c52a9579a8f4d7016402aa57028af9b42
git worktree add --detach /tmp/field-p5-p3 53ddf5c0fa766fd0cdf35375a2f7e0679612753f
git worktree add --detach /tmp/field-p5-p4 eda186afb36a485f9f4becf472c4faa9a95ede9c
FIELD_PROFILE_ROOTS='{"p1":"/tmp/field-p5-p1","p2":"/tmp/field-p5-p2","p3":"/tmp/field-p5-p3","p4":"/tmp/field-p5-p4"}' FIELD_PROFILE_MODE=history FIELD_PROFILE_OUTPUT=test-results/field-particle-p5/history CHROME_BIN=/path/to/chromium node scripts/profile-field-particles.mjs
```

Use the pinned browser installation and unchanged `FIELD_CHROME_ARGS` in `.github/workflows/repository-validation.yml`; verify its exact revision before collecting. Run phases serially on one otherwise idle benchmark host. Historical commits must be fetched locally before worktree construction.

CSS viewport is 390×844, emulated DPR 2 with unchanged production cap 1.75. Pinned `@sparticuz/chromium@153.0.0` reports `HeadlessChrome/153.0.8010.0`, revision `@86cee6df69e0463a839c0cc8435c9d4c259434d3`; SwiftShader, Linux x64 matches P4. A numeric Chrome version alone is insufficient provenance. Timers measure CPU simulation and Canvas submission, not asynchronous GPU completion or physical-device FPS. Each primary run uses 60 warm-up and 180 timed frames. Conditions alternate forward/reverse order for five rounds. Components use a separate 60-frame timed window and cannot be mixed with primary-window samples.

## Measurement semantics

Profiling is test-only source adaptation, with fail-closed ownership anchors and exact Canvas/state comparisons. Section clocks occur once at section boundaries, not per particle. Sections cover world background, stars, route/FIELD geometry, hazards, dust, pickup effects, structures/shocks, Dust Eaters, player/trail and remaining overlays. Accounting must sum to the instrumented render body.

Query time contains stable-order restoration; a test-only sort wrapper installed once per profiled run separately attributes the canonical ordinal sort. It is active only during renderer drawing, never simulation queries. Whole-frame diagnostic omission variants isolate glow, center geometry, flow strokes, Carbon geometry and culling-only. Their timing differences are marginal estimates, not additive per-call costs. Center geometry includes Carbon; Carbon is a subset. Negative/no-op differences are noise, not negative costs. Ready/screen culling and metadata are included in the culling-only estimate, after subtracting inclusive query time.

Uninstrumented baseline timing is primary. Instrumented timing identifies section proportions; its overhead must be reported rather than silently treated as production cost. Median and p95 summaries are medians of five per-run statistics; max is the largest observed frame across all runs. Raw samples and source hashes are retained. Stable fixture/counter/completeness checks are hard gates; clock values are not.

Condition 1 is dust mean share ≥40% in Dense or Dynamic-heavy. Condition 2 is uninstrumented Dense renderer p95 growth ≥25% over Normal, with more than half of the corresponding instrumented renderer-tail increase attributable to dust. Attribution uses matched frames in the renderer's 92.5–97.5 percentile cohort; summing independent section p95s would be invalid. Condition 3 requires an exact-visual prototype to reproduce ≥10% renderer p95 improvement. A trigger admits investigation, not adoption of a visually different or consistently slower implementation.

## Residual bottleneck decision

Five baseline/profiled pairs per fixture and motion mode, alternating AB/BA, produce Class C. Route/FIELD geometry owns **59.10%** of the combined instrumented renderer means. The dust share stays below 40% in both stress fixtures. Dense renderer p95 grows less than 25% from Normal. Neither admission condition holds, so no draw prototype or production draw optimization is warranted; Condition 3 is not asserted without a prototype.

| Fixture | Dust mean share normal / reduced | Largest non-particle section |
|---|---:|---|
| normal | 16.96% / 20.61% | route/FIELD geometry |
| dense | 33.05% / 36.19% | route/FIELD geometry |
| awakened | 14.33% / 16.27% | route/FIELD geometry |
| dynamic-heavy | 28.81% / 30.92% | route/FIELD geometry |

| Condition 2 | Normal → Dense renderer p95 | Growth | Dust share of matched tail increase | Trigger |
|---|---:|---:|---:|---|
| normal | 3.30 → 4.00 ms | 21.21% | 138.00% | no: growth <25% |
| reduced | 3.20 → 3.50 ms | 9.38% | 84.31% | no: growth <25% |

Tail attribution can exceed 100% because other sections get cheaper in the same cohort; it is a marginal difference, not a partition of total cost. No time budget, visual density, DPR, frame frequency or gameplay tolerance is relaxed. Class C closes as **No Further Optimization Required** for FIELD particles; route/FIELD geometry is a separate future profiling task.

## Final 390×844 CPU submission profile

Uninstrumented baseline simulation, renderer and frame values are the production timing authority. Dust values come from the separately instrumented exact-command renderer. Units are ms; median/p95 are medians of five per-run statistics, max is the maximum observed across all five runs. These are not physical mobile GPU timings.

| Fixture | Motion | Simulation median / p95 | Renderer median / p95 | Dust median / p95 | CPU median / p95 / max |
|---|---|---:|---:|---:|---:|
| normal | normal | 0.40 / 0.60 | 2.60 / 3.30 | 0.40 / 0.80 | 3.10 / 3.80 / 8.00 |
| dense | normal | 0.90 / 1.10 | 3.10 / 4.00 | 1.00 / 1.40 | 4.10 / 5.20 / 9.70 |
| awakened | normal | 0.50 / 0.60 | 2.50 / 3.50 | 0.30 / 0.90 | 3.00 / 4.00 / 8.70 |
| dynamic-heavy | normal | 0.50 / 0.70 | 3.10 / 4.00 | 0.90 / 1.30 | 3.60 / 4.70 / 13.10 |
| normal | reduced | 0.40 / 0.60 | 2.20 / 3.20 | 0.40 / 1.00 | 2.70 / 3.60 / 5.60 |
| dense | reduced | 1.00 / 1.20 | 2.80 / 3.50 | 1.00 / 1.50 | 3.80 / 4.60 / 14.80 |
| awakened | reduced | 0.40 / 0.50 | 2.40 / 3.70 | 0.30 / 1.20 | 2.90 / 4.10 / 8.10 |
| dynamic-heavy | reduced | 0.50 / 0.70 | 2.70 / 3.60 | 0.80 / 1.20 | 3.20 / 4.10 / 6.40 |

Instrumentation overhead is explicit: instrumented renderer mean differs from baseline by normal/normal +0.02 ms, dense/normal -0.02 ms, awakened/normal +0.09 ms, dynamic-heavy/normal +0.16 ms, normal/reduced +0.05 ms, dense/reduced -0.01 ms, awakened/reduced +0.01 ms, dynamic-heavy/reduced +0.04 ms. This includes clocks, sort attribution and ordinary run variation; it is not subtracted to invent a production speedup. P5's unchanged runtime cannot cause a new P4→P5 optimization gain.

## Renderer section means

Per-frame means, normal / reduced motion, ms. The section names identify aggregate source boundaries, not individual Canvas calls. Sub-resolution aggregate means and zero p95 do not prove a section has no cost. Independent medians/p95s cannot be summed.

| Section | Normal fixture | Dense | Awakened | Dynamic-heavy |
|---|---:|---:|---:|---:|
| background | 0.064 / 0.062 | 0.068 / 0.064 | 0.063 / 0.067 | 0.079 / 0.078 |
| stars | 0.171 / 0.159 | 0.167 / 0.161 | 0.172 / 0.172 | 0.177 / 0.166 |
| routeFieldGeometry | 1.822 / 1.506 | 1.818 / 1.537 | 1.696 / 1.626 | 1.852 / 1.598 |
| hazards | 0.050 / 0.060 | 0.055 / 0.052 | 0.248 / 0.238 | 0.078 / 0.056 |
| dust | 0.455 / 0.473 | 1.086 / 1.063 | 0.402 / 0.424 | 0.969 / 0.879 |
| pickupEffects | 0.005 / 0.004 | 0.008 / 0.007 | 0.001 / 0.001 | 0.011 / 0.009 |
| shockStructures | 0.002 / 0.003 | 0.001 / 0.003 | 0.004 / 0.005 | 0.002 / 0.002 |
| dustEaters | 0.002 / 0.001 | 0.001 / 0.000 | 0.001 / 0.001 | 0.001 / 0.001 |
| playerTrail | 0.069 / 0.036 | 0.061 / 0.036 | 0.066 / 0.047 | 0.056 / 0.034 |
| otherOverlays | 0.014 / 0.011 | 0.014 / 0.013 | 0.065 / 0.059 | 0.014 / 0.012 |

## Population scaling and query attribution

Visible population below is the strict viewport snapshot after the unchanged 60-frame warm-up; rendered population is the mean over frames 60–239, after readiness and the existing ±35 px margin. It is distinct from P1's fresh-camera snapshot and first-second counters.

| Fixture | Total | Visible / visible ready at frame 60 | Mean rendered / frame | Renderer median / p95 normal | Dust median / p95 normal |
|---|---:|---:|---:|---:|---:|
| normal | 4,530 | 75 / 65 | 136.20 | 2.60 / 3.30 | 0.40 / 0.80 |
| dense | 13,590 | 221 / 192 | 401.61 | 3.10 / 4.00 | 1.00 / 1.40 |
| awakened | 4,530 | 53 / 50 | 105.17 | 2.50 / 3.50 | 0.30 / 0.90 |
| dynamic-heavy | 4,530 | 349 / 244 | 253.70 | 3.10 / 4.00 | 0.90 / 1.30 |

Dense renders 2.95× Normal's dust; renderer p95 grows only 21.21%. Dust itself scales with visible drawing work, but it does not pass the declared material-bottleneck threshold. Dynamic-heavy has more local candidates and flow trails, not an omitted population.

| Fixture | Motion | Inclusive query median / p95 | Stable ordinal sort median / p95 |
|---|---|---:|---:|
| normal | normal | 0.10 / 0.20 | 0.00 / 0.10 |
| dense | normal | 0.20 / 0.30 | 0.10 / 0.20 |
| awakened | normal | 0.10 / 0.20 | 0.00 / 0.10 |
| dynamic-heavy | normal | 0.10 / 0.20 | 0.10 / 0.20 |
| normal | reduced | 0.10 / 0.20 | 0.00 / 0.10 |
| dense | reduced | 0.20 / 0.30 | 0.10 / 0.20 |
| awakened | reduced | 0.10 / 0.20 | 0.00 / 0.10 |
| dynamic-heavy | reduced | 0.10 / 0.30 | 0.10 / 0.20 |

## Dust component diagnostics

The separate frames 60–119 window uses five repeats per omission. Entries below are signed mean differences (complete − omission), not additive call costs. Culling-only subtracts its inclusive query time and still includes metadata.

| Fixture | Motion | Ready/screen/metadata estimate | Glow marginal | Center marginal | Flow marginal | Carbon marginal |
|---|---|---:|---:|---:|---:|---:|
| normal | normal | 0.01 | 0.29 | 0.06 | 0.04 | 0.02 |
| dense | normal | 0.04 | 0.54 | 0.11 | -0.04 | -0.01 |
| awakened | normal | 0.02 | 0.21 | 0.07 | 0.00 | 0.02 |
| dynamic-heavy | normal | 0.04 | 0.57 | 0.15 | 0.08 | 0.04 |
| normal | reduced | 0.04 | 0.21 | 0.01 | -0.02 | -0.01 |
| dense | reduced | 0.08 | 0.59 | 0.14 | 0.14 | 0.02 |
| awakened | reduced | 0.03 | 0.19 | 0.06 | -0.04 | -0.06 |
| dynamic-heavy | reduced | 0.04 | 0.57 | 0.24 | 0.01 | 0.15 |

The deterministic Canvas/counter probe independently matches each complete variant’s 60-frame rendered-ID-count sequence. Normal/Dense/Awakened submit **zero flow or Carbon draws** in this window, and all reduced-motion runs submit zero flow strokes: their nonzero omission differences are measurement noise, not attributed flow/Carbon cost. Dynamic-heavy submits 17,411 glow/center draws, 5,189 normal-motion flow strokes and 1,625 Carbon shapes; reduced motion preserves all except flow. Center includes Carbon, so the two estimates must not be added. Secondary complete dust shares stay below 40% (Dense 26.69%/32.60%, Dynamic-heavy 32.15%/33.74%), corroborating the primary decision. No omission variant ships in production.

## Integrated P1→P5 work authority

Each counter row covers the same seed-41 first-second input trace: 60 fixed slices and 60 draws, rather than browser wall-clock frame frequency. Counts are unchanged in reduced motion except intentionally suppressed flow strokes.

| Fixture | Stage | Assist + pickup visits / s | Dynamic visits / s | Renderer candidates / s | Rendered / s |
|---|---|---:|---:|---:|---:|
| normal | P1 | 543,600 | 271,800 | 271,800 | 4,837 |
| normal | P2 | 2,195 | 271,800 | 271,800 | 4,837 |
| normal | P3 | 2,195 | 38,040 | 271,800 | 4,837 |
| normal | P4 | 2,195 | 38,040 | 7,324 | 4,837 |
| normal | P5 final | 2,195 | 38,040 | 7,324 | 4,837 |
| dense | P1 | 1,630,800 | 815,400 | 815,400 | 14,342 |
| dense | P2 | 6,495 | 815,400 | 815,400 | 14,342 |
| dense | P3 | 6,495 | 114,120 | 815,400 | 14,342 |
| dense | P4 | 6,495 | 114,120 | 21,950 | 14,342 |
| dense | P5 final | 6,495 | 114,120 | 21,950 | 14,342 |
| awakened | P1 | 543,600 | 271,800 | 271,800 | 4,643 |
| awakened | P2 | 1,019 | 271,800 | 271,800 | 4,643 |
| awakened | P3 | 1,019 | 37,860 | 271,800 | 4,643 |
| awakened | P4 | 1,019 | 37,860 | 5,790 | 4,643 |
| awakened | P5 final | 1,019 | 37,860 | 5,790 | 4,643 |
| dynamic-heavy | P1 | 543,600 | 271,800 | 271,800 | 16,562 |
| dynamic-heavy | P2 | 12,694 | 271,800 | 271,800 | 16,562 |
| dynamic-heavy | P3 | 12,694 | 38,040 | 271,800 | 16,562 |
| dynamic-heavy | P4 | 12,694 | 38,040 | 25,037 | 16,562 |
| dynamic-heavy | P5 final | 12,694 | 38,040 | 25,037 | 16,562 |

| Fixture | Combined P1 visits / s | P5 visits / s | Removed / s | Reduction |
|---|---:|---:|---:|---:|
| normal | 1,087,200 | 47,559 | 1,039,641 | 95.626% |
| dense | 3,261,600 | 142,565 | 3,119,035 | 95.629% |
| awakened | 1,087,200 | 44,669 | 1,042,531 | 95.891% |
| dynamic-heavy | 1,087,200 | 75,771 | 1,011,429 | 93.031% |

These are visit counts across different paths, not equal-duration operations or an FPS multiplier. Normal removes 1,039,641 visits per simulated second with 60 draws. P3 static visits remain zero; dynamic registry populations stay 634 / 1,902 / 631 / 634 and actual updates equal visits.

## Same-session historical CPU comparison

Each P1–P4 stage runs original production code from its detached commit in the same browser process, alternating stage order over five rounds. The original harness includes its diagnostic-probe lifecycle before timing; P5’s separate integrated harness does not. P1–P4 rows compare within the history phase; the separately collected P5 row uses the same format, viewport, engine, inputs, warm-up and sample count, but **must not be presented as a causal P4→P5 speedup**. P4 and P5 production code is identical. Shared software-raster/backend variation and retained RAF stalls limit timing attribution.

| Fixture | Motion | Stage | Simulation median / p95 | Renderer median / p95 | CPU median / p95 / max |
|---|---|---|---:|---:|---:|
| normal | normal | P1 | 1.20 / 3.00 | 2.80 / 6.60 | 4.20 / 8.30 / 27.80 |
| normal | normal | P2 | 0.60 / 0.80 | 2.70 / 6.00 | 3.40 / 6.70 / 15.70 |
| normal | normal | P3 | 0.40 / 0.60 | 2.70 / 6.30 | 3.10 / 6.80 / 12.20 |
| normal | normal | P4 | 0.40 / 0.60 | 2.90 / 6.50 | 3.40 / 6.90 / 12.00 |
| normal | normal | P5 | 0.40 / 0.60 | 2.60 / 3.30 | 3.10 / 3.80 / 8.00 |
| dense | normal | P1 | 3.60 / 6.90 | 3.40 / 6.50 | 7.20 / 12.70 / 22.50 |
| dense | normal | P2 | 1.50 / 1.90 | 3.90 / 7.80 | 5.30 / 9.60 / 16.30 |
| dense | normal | P3 | 0.90 / 1.10 | 4.00 / 7.40 | 4.90 / 8.50 / 13.50 |
| dense | normal | P4 | 0.90 / 1.10 | 4.10 / 7.10 | 5.00 / 8.40 / 16.40 |
| dense | normal | P5 | 0.90 / 1.10 | 3.10 / 4.00 | 4.10 / 5.20 / 9.70 |
| awakened | normal | P1 | 1.20 / 3.10 | 3.10 / 7.60 | 4.60 / 9.30 / 20.40 |
| awakened | normal | P2 | 0.60 / 0.80 | 3.50 / 7.50 | 4.20 / 8.50 / 21.00 |
| awakened | normal | P3 | 0.40 / 0.60 | 3.40 / 7.70 | 3.90 / 8.20 / 19.50 |
| awakened | normal | P4 | 0.40 / 0.60 | 3.60 / 7.30 | 4.10 / 7.70 / 13.30 |
| awakened | normal | P5 | 0.50 / 0.60 | 2.50 / 3.50 | 3.00 / 4.00 / 8.70 |
| dynamic-heavy | normal | P1 | 1.30 / 3.50 | 3.70 / 8.40 | 5.20 / 10.20 / 23.60 |
| dynamic-heavy | normal | P2 | 0.70 / 1.10 | 3.80 / 8.50 | 4.60 / 9.40 / 17.70 |
| dynamic-heavy | normal | P3 | 0.50 / 1.00 | 3.80 / 8.20 | 4.40 / 9.00 / 28.90 |
| dynamic-heavy | normal | P4 | 0.50 / 0.90 | 4.10 / 8.70 | 4.70 / 9.20 / 16.40 |
| dynamic-heavy | normal | P5 | 0.50 / 0.70 | 3.10 / 4.00 | 3.60 / 4.70 / 13.10 |
| normal | reduced | P1 | 1.20 / 1.50 | 2.60 / 6.30 | 3.90 / 7.50 / 16.40 |
| normal | reduced | P2 | 0.70 / 0.80 | 2.70 / 5.90 | 3.40 / 6.60 / 20.10 |
| normal | reduced | P3 | 0.40 / 0.60 | 2.50 / 5.70 | 3.00 / 6.50 / 11.80 |
| normal | reduced | P4 | 0.40 / 0.60 | 2.50 / 6.30 | 3.00 / 6.70 / 14.70 |
| normal | reduced | P5 | 0.40 / 0.60 | 2.20 / 3.20 | 2.70 / 3.60 / 5.60 |
| dense | reduced | P1 | 3.20 / 7.20 | 3.20 / 6.30 | 6.60 / 12.50 / 19.90 |
| dense | reduced | P2 | 1.40 / 1.90 | 3.60 / 7.40 | 5.00 / 9.30 / 18.80 |
| dense | reduced | P3 | 0.80 / 1.00 | 3.60 / 6.70 | 4.50 / 8.10 / 18.90 |
| dense | reduced | P4 | 0.80 / 1.10 | 3.70 / 7.00 | 4.70 / 8.00 / 15.70 |
| dense | reduced | P5 | 1.00 / 1.20 | 2.80 / 3.50 | 3.80 / 4.60 / 14.80 |
| awakened | reduced | P1 | 1.20 / 2.00 | 3.10 / 7.00 | 4.50 / 8.60 / 15.80 |
| awakened | reduced | P2 | 0.60 / 0.80 | 3.30 / 6.80 | 4.00 / 8.20 / 13.30 |
| awakened | reduced | P3 | 0.40 / 0.60 | 3.20 / 6.90 | 3.80 / 7.20 / 16.60 |
| awakened | reduced | P4 | 0.40 / 0.60 | 3.40 / 6.70 | 3.80 / 7.10 / 19.90 |
| awakened | reduced | P5 | 0.40 / 0.50 | 2.40 / 3.70 | 2.90 / 4.10 / 8.10 |
| dynamic-heavy | reduced | P1 | 1.20 / 3.60 | 3.20 / 7.70 | 4.80 / 10.20 / 23.90 |
| dynamic-heavy | reduced | P2 | 0.70 / 1.00 | 3.70 / 8.20 | 4.50 / 8.90 / 27.20 |
| dynamic-heavy | reduced | P3 | 0.50 / 1.00 | 3.60 / 7.70 | 4.10 / 8.40 / 20.40 |
| dynamic-heavy | reduced | P4 | 0.40 / 0.90 | 3.60 / 7.90 | 4.10 / 8.50 / 17.90 |
| dynamic-heavy | reduced | P5 | 0.50 / 0.70 | 2.70 / 3.60 | 3.20 / 4.10 / 6.40 |


## Preservation and release validation

- Frozen P1 gameplay signatures PASS at unchanged `1e-8`: player position/velocity, assist, pickup identity/order/count, resources, Rare, chain/best chain, respawn, hazards and regions.
- P2 24-seed spatial-query oracle and P3 24-seed × four-fixture exact animation/grid membership oracle PASS. Dynamic static visits remain zero.
- P4 renderer oracle PASS: 24 seeds × four fixtures × two motion settings × eight states = 1,536 ordered-reference/Canvas-stream comparisons. P5’s transparent profiler adds 64 exact Canvas/state comparisons.
- All **18/18 PNG files are byte-identical** to frozen P1 manifest SHA256 values; neither visual nor gameplay oracles were regenerated.
- All four performance fixtures, both motion modes, complete five-run primary/component/history coverage and raw-stat recomputation PASS. Timing values remain descriptive, never hard CI gates.
- Routine browser profile sanity checks PASS at 390×844 plus 320×568, 430×932 and 1440×900. Different viewport timings are not directly compared.
- Repository hygiene: zero warnings, 133 reachable production modules. Relevant maintained CI and PWA integrity/freshness PASS: 348 verified assets, unchanged release `5de90ff20e975e6b`.
- Production `src/`, PWA outputs, density, physics, economy, Rare Ecology and rendering commands are unchanged from start main.

## Evidence and limits

Raw measurements and provenance are retained under [`tests/fixtures/field-particle-p5/`](../tests/fixtures/field-particle-p5/). [`evidence.json`](../tests/fixtures/field-particle-p5/evidence.json) records checksums, runtime/tool source hashes, exact engine, decision, component work and all 18 visual hashes. `coarse-raw.json.gz` contains 80 runs; `components-raw.json.gz` 240; `history-raw.json.gz` 160; `browser-raw.json.gz` the eight standard counter/visual fixture results. No first-pass outlier is deleted. Supplementary different-revision/partial measurements are explicitly excluded from closure authority.

```sh
node scripts/check-field-profile-evidence.mjs
# Final closure additionally verifies captured runtime equals current source:
node scripts/check-field-profile-evidence.mjs --current
```

Captured matched-engine job: [110258271982](https://github.com/miyatayuuma/molecule-craft/actions/runs/36828112228/job/110258271982), source head `88ca0dd912940573de5270b69e612d37f6c664b6`. The recorded runtime SHA256 values are unchanged through final delivery. Routine CI checks retained five-run completeness/checksums plus short live structural samples; it does not recollect the entire multi-hour historical profile on every PR.

No production timers or diagnostic UI are added. Runtime source hashes identify the actual captured implementation independently of the harness commit. Historical P1–P4 checkouts run their original production code, with only a test HTML raw-array adapter; historical implementations are not shipped. CI uses short structural profiles and offline retained-five-run verification, not flaky clock budgets. Full five-run collection remains an explicit manual protocol.

The initial full-Chrome capture had the same numeric version but a different revision (`@16bd491dedbcbf51ea052faf4a1e4443cb826f26`). Its completed coarse data, partial component data and browser results remain supplementary and cannot satisfy matched-P4 authority. The first collection deadline and package-loader setup errors were fixture/infrastructure defects, repaired rather than labeled known browser flakes. Lost local captures are excluded.

Known browser failures are separate: matched-profile head `88ca0dd` had two Safe Extraction readiness failures, then passed code-identical standalone rerun 110380974668. Safe Extraction readiness (`site-seeking` versus `site-ready`) failed on head `8ae55c2` then passed on its code-identical standalone job rerun (110273201087). An earlier Ring DevTools-startup failure likewise passed its identical-code rerun (110258241453); an initial reaction trajectory wait passed rerun 110249606297. No production authority was changed to admit these gates. The matched-profile job itself passed without a profile retry.

Largest residual CPU submission cost is authored route/FIELD geometry. Background, stars, hazards, transient effects, structures, Dust Eaters and player/trail are separately reported; this trace does not prove the worst-case cost of an active Dust Eater encounter. Asynchronous GPU/raster/composition and physical Android/iOS performance remain unmeasured. A future non-particle Canvas task or real-device profile can investigate those costs while preserving visual/gameplay authority. Adaptive DPR, thinning, batching, sprites and quality changes are not introduced or justified by this closure.

Final source-of-truth links: [P1 authority](field-particle-performance.md), [P2 spatial query](field-particle-spatial-query.md), [P3 animation](field-particle-dynamic-update.md), [P4 renderer query](field-particle-renderer-query.md).
