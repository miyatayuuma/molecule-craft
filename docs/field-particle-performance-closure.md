# FIELD particle performance — integrated profiling authority

P5 starts from P4 main `eda186afb36a485f9f4becf472c4faa9a95ede9c`. This document owns the integrated profile and final decision; P1's gameplay and visual oracles remain immutable. Closure is pending the integrated measurements and validation.

## Architecture and invariants

Before P2–P4, assist, pickup, dynamic animation and drawing discovered candidates by traversing the entire dust population. Final runtime uses one map-local 128-unit spatial grid, canonical ordinal ordering for assist/pickup/renderer queries, and a separate stable flow/vortex reference registry for animation ownership. Cluster expansion keeps its existing owner and synchronizes the same grid after movement. Renderer query includes the original ±35 CSS-pixel margin and retains exact ready/screen predicates and original drawing.

No density, placement, spacing, physics, radius, fixed-step frequency, respawn, resource value, Rare Ecology, visual style, glow, DPR or reduced-motion behavior changes are permitted. Particle omission and quality reduction cannot satisfy closure. Gameplay tolerance stays `1e-8`; all 18 frozen P1 PNGs must match bytes.

## Reproduction

```sh
node --test tests/field-renderer-profile.test.mjs tests/field-profile-authority.test.mjs
CHROME_BIN=/path/to/chromium FIELD_PROFILE_MODE=coarse node scripts/profile-field-particles.mjs
node scripts/summarize-field-profile.mjs test-results/field-particle-p5/raw.json.gz test-results/field-particle-p5/aggregate.json
CHROME_BIN=/path/to/chromium FIELD_PROFILE_MODE=components node scripts/profile-field-particles.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-field-visual-baseline.mjs
```

Use distinct `FIELD_PROFILE_OUTPUT` directories for phases. Five runs per fixture/motion/condition are mandatory for timing authority; `--smoke` uses two short runs solely for structural checks. `history` requires `FIELD_PROFILE_ROOTS` mapping `p1`–`p4` to detached Git checkouts of the original stages. Original production code is imported from those checkouts; a transient HTML adapter only returns already collected raw timing arrays. No historical production copies or full-scan fallbacks are shipped.

CSS viewport is 390×844, emulated DPR 2 with unchanged production cap 1.75. Chromium 153.0.8010.0, SwiftShader, Linux x64 matches the earlier authority. Timers measure CPU simulation and Canvas submission, not asynchronous GPU completion or physical-device FPS. Each primary run uses 60 warm-up and 180 timed frames. Conditions alternate forward/reverse order for five rounds. Components use a separate 60-frame timed window and cannot be mixed with primary-window samples.

## Measurement semantics

Profiling is test-only source adaptation, with fail-closed ownership anchors and exact Canvas/state comparisons. Section clocks occur once at section boundaries, not per particle. Sections cover world background, stars, route/FIELD geometry, hazards, dust, pickup effects, structures/shocks, Dust Eaters, player/trail and remaining overlays. Accounting must sum to the instrumented render body.

Query time contains stable-order restoration; a test-only sort wrapper installed once per profiled run separately attributes the canonical ordinal sort. It is active only during renderer drawing, never simulation queries. Whole-frame diagnostic omission variants isolate glow, center geometry, flow strokes, Carbon geometry and culling-only. Their timing differences are marginal estimates, not additive per-call costs. Center geometry includes Carbon; Carbon is a subset. Negative/no-op differences are noise, not negative costs. Ready/screen culling and metadata are included in the culling-only estimate, after subtracting inclusive query time.

Uninstrumented baseline timing is primary. Instrumented timing identifies section proportions; its overhead must be reported rather than silently treated as production cost. Median and p95 summaries are medians of five per-run statistics; max is the largest observed frame across all runs. Raw samples and source hashes are retained. Stable fixture/counter/completeness checks are hard gates; clock values are not.

Condition 1 is dust mean share ≥40% in Dense or Dynamic-heavy. Condition 2 is uninstrumented Dense renderer p95 growth ≥25% over Normal, with more than half of the corresponding instrumented renderer-tail increase attributable to dust. Attribution uses matched frames in the renderer's 92.5–97.5 percentile cohort; summing independent section p95s would be invalid. Condition 3 requires an exact-visual prototype to reproduce ≥10% renderer p95 improvement. A trigger admits investigation, not adoption of a visually different or consistently slower implementation.

## Integrated result

Pending retained CI measurements. Production remains P4 while profiling completes. Measurements lost during execution-environment recovery are excluded from final authority. Local recovery also blocked Chromium Unix socket creation; CI performs the same-version browser measurement rather than substituting a different rendering mode.
