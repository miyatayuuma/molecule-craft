# FIELD Particle Performance P4 — renderer query authority

Start main: `53ddf5c0fa766fd0cdf35375a2f7e0679612753f` (P3 / PR #323).

`rendererDustCandidates` inverses the current camera transform on every draw. Its world AABB is camera ± `(logical Canvas/CSS dimension / 2 + 35) / scale`, conservatively expanded by floating-point roundoff padding. The original screen-space closed ±35 px predicate remains the final authority. Ready state is evaluated after querying. The renderer uses the existing P2 128-world-unit grid, synchronized by P3 after flow, vortex and cluster movement; no separate index, movement list, visibility cache or ready-state membership is introduced. The grid's existing canonical ordinal sort restores exactly `map.dust` order, including overlapping translucent glows. First construction is runtime-only and shared with engine queries; subsequent draws do not visit remote dust.

Only candidate discovery changes. Screen arithmetic, dust animation, glow sprites, center shapes, Carbon geometry, flow trails, Rare visuals, Canvas commands/compositing, DPR, density, physics, resource yield and reduced-motion behavior remain unchanged. Draw-call batching is deferred to P5 evidence.

## Counter authority

P1 `renderScanned` still counts records actually visited by the dust loop; `renderNotReady`, `renderOffscreen` and `rendered` partition those records. P4 adds `renderFullScanEquivalent` (canonical population per draw), `renderSpatialQueries`, `renderGridCellsVisited` (all cells intersecting the closed conservative envelope, including empty cells), `renderCandidatesReturned` and optional descriptive `renderQueryMs`. The existing `dustRenderMs` includes query plus exact filtering/drawing. No timing values are CI thresholds. Diagnostic work is captured separately from uninstrumented CPU timings, and repeat work counters must match exactly.

## Equivalence gates

`tests/renderer-spatial-query.test.mjs` independently freezes the P3 literal ready/screen/±35 predicate. Its test-only full-scan provider replaces only candidate discovery in a transient renderer import; production has no fallback. 24 seeds × four fixtures × both motion settings × eight states yield 1,536 exact comparisons of final canonical references/metadata/order and complete Canvas command/property streams (including color, alpha and compositing). Follow, fresh camera, BURST zoom, DRIVE, normal/forced extraction and warp, region transition, flow/vortex movement and active cluster expansion are exercised. Explicit closed-margin probes cover every edge, inside/outside ±35, an exact grid-aligned query boundary, negative coordinates, camera crossing, ready equality and respawn. A proxy probe proves remote static records receive no position/ready reads after grid construction. P2/P3 moving-membership oracles remain independent gates.

Frozen P1 gameplay signatures retain 1e-8 tolerance. P1's 18 PNG baselines are not regenerated. Current screenshots are byte-identical to all 18 P1 files and fresh P3 captures; SHA256 evidence is retained in `tests/fixtures/field-particle-p4/visual-comparison.json`.

```sh
node --test tests/renderer-spatial-query.test.mjs tests/dust-spatial-index.test.mjs tests/dynamic-dust-registry.test.mjs tests/field-particle-performance.test.mjs tests/field-particle-render-counters.test.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-repository-hygiene.mjs
node tests/repository-hygiene.test.mjs
node scripts/build-precache.mjs --check
node tests/pwa.test.mjs
```

## Measured work

Raw evidence: `tests/fixtures/field-particle-p4/`. Each row describes 60 fixed steps and 60 draws of the unchanged seed-41 P1 input trace. All work counts match between normal/reduced motion except intentionally suppressed flow trails. Every fixture passes the <=15% candidate gate, including Dynamic-heavy.

| Fixture | Full-scan equivalent / s | Candidates / s | Rendered / s | Reduction | Ready / screen rejects | Cells / frame |
|---|---:|---:|---:|---:|---:|---:|
| Normal | 271,800 | 7,324 | 4,837 | 97.305% | 435 / 2,052 | 94.55 |
| Dense | 815,400 | 21,950 | 14,342 | 97.308% | 1,221 / 6,387 | 96.28 |
| Awakened | 271,800 | 5,790 | 4,643 | 97.870% | 180 / 967 | 91.93 |
| Dynamic-heavy | 271,800 | 25,037 | 16,562 | 90.788% | 5,905 / 2,570 | 91.82 |

One query per draw. Glow and center draw counts equal rendered counts. Normal/Dense/Awakened have zero flow trails and Carbon draws on this one-second trace; Dynamic-heavy has 5,611 flow strokes (zero in reduced motion) and 681 Carbon draws. Final drawing work is unchanged from P3, while 264,476 / 793,450 / 266,010 / 246,763 former dust visits per second are removed respectively. Ready/offscreen rejection totals deliberately differ because remote records never enter the new loop.

P2 assist+pickup candidates remain exactly 2,195 / 6,495 / 1,019 / 12,694 per second. P3 dynamic registry populations remain 634 / 1,902 / 631 / 634; visits = updates remain 38,040 / 114,120 / 37,860 / 38,040, with zero static visits. No grid cell-size or simulation authority is changed.

## Mobile descriptive timings

Fresh paired P3/P4 Chromium 153.0.8010.0 / SwiftShader, Linux x64, CSS 390×844, emulated DPR 2, unchanged production cap 1.75 (Canvas 683×1477). Each measurement uses 60 warm-up + 180 timed frames. These are CPU simulation/render submission times, not GPU completion or physical-device FPS. Captures precede delivery commit; `basis` is the start main and runtime SHA256 identifies measured source. All first-pass data is retained, including isolated max spikes.

| Fixture | Motion | P3 CPU median / p95 / max ms | P4 CPU median / p95 / max ms | P4 simulation median / p95 | P4 renderer median / p95 |
|---|---|---:|---:|---:|---:|
| Normal | normal | 2.3 / 3.1 / 5.2 | 2.4 / 3.2 / 6.8 | 0.4 / 0.7 | 2.0 / 2.6 |
| Dense | normal | 3.6 / 5.5 / 9.7 | 3.2 / 4.8 / 9.6 | 0.8 / 1.0 | 2.3 / 3.2 |
| Awakened | normal | 2.5 / 2.9 / 9.5 | 2.4 / 3.0 / 9.1 | 0.5 / 0.6 | 2.0 / 2.5 |
| Dynamic-heavy | normal | 3.1 / 6.3 / 11.3 | 2.6 / 4.6 / 10.5 | 0.5 / 0.8 | 2.1 / 3.6 |
| Normal | reduced | 2.3 / 2.7 / 4.1 | 2.1 / 2.6 / 8.9 | 0.5 / 0.6 | 1.7 / 2.1 |
| Dense | reduced | 3.8 / 5.5 / 7.4 | 2.8 / 3.6 / 9.1 | 0.8 / 1.0 | 2.0 / 2.5 |
| Awakened | reduced | 2.3 / 2.7 / 3.7 | 2.2 / 2.5 / 3.1 | 0.4 / 0.6 | 1.8 / 2.0 |
| Dynamic-heavy | reduced | 2.6 / 3.0 / 5.3 | 2.5 / 4.2 / 8.9 | 0.4 / 0.7 | 2.0 / 3.5 |

Normal's first-pass p95 is 0.1 ms higher, whereas reduced and Dense improve. Dynamic-heavy reduced renderer p95 rises despite identical Canvas commands and reduced dust work; this observation alone does not identify a causal regression. Independent Normal confirmation is retained to assess recurring query overhead, rather than discarding the first pass. Software/shared-host variance limits absolute timing authority.

## Remaining renderer work / P5

In the normal-motion one-second diagnostic pass, query time is 2.3 / 4.8 / 1.9 / 8.3 ms total versus inclusive dust-loop time 33.4 / 67.0 / 18.2 / 81.3 ms. Query is therefore about 7–10% of that instrumented dust path; the remainder includes exact predicates and existing particle Canvas submission. Whole-renderer median remains approximately 1.7–2.3 ms and also includes backgrounds, route/hazard/region geometry, player/effects and other non-dust work. This is sufficient evidence that full-population candidate discovery is removed, but does not establish particle draw calls as the sole remaining bottleneck. P5 should profile integrated P1→P4 costs before considering a limited exact-visual draw optimization. No adaptive DPR or drawing optimization is authorized by these measurements alone.

Same-page confirmation uses an optional `FIELD_RENDERER_COMPARE=1` benchmark path. A transient test-only renderer adapter replaces candidate discovery with the canonical full array; all screen predicates/drawing remain identical. Both implementations share one Canvas/backend, the same warmed seed/input trace and ABBA/BAAB ordering. Each implementation has 720 timed frames per motion setting; raw passes and samples are retained in `p4-same-page-abba.json`.

| Motion | Full-scan CPU median / p95 / max | P4 CPU median / p95 / max | Renderer median / p95 full scan → P4 |
|---|---:|---:|---:|
| Normal | 2.2 / 2.8 / 6.5 | 2.0 / 2.8 / 7.7 | 1.8 / 2.3 → 1.6 / 2.3 |
| Reduced | 1.9 / 2.5 / 4.2 | 1.8 / 2.3 / 4.3 | 1.5 / 2.0 → 1.4 / 1.9 |

Normal p95 is unchanged in this controlled confirmation and reduced p95 improves. Query management does not show a recurring p95 increase. Earlier separate-process confirmation is also retained: Normal P3 2.1/2.7/3.3 → P4 2.3/3.4/4.9 ms, reduced 2.0/2.5/4.4 → 2.0/2.6/7.9 ms. Dynamic-heavy confirmation normal is 2.7/5.8/9.0 → 2.9/4.7/10.5 ms and reduced 2.4/3.8/11.6 → 2.3/3.3/9.4 ms. This variation reinforces the use of deterministic work/equivalence plus a controlled comparison, rather than a timing-only CI gate.

Local validation: 89 relevant tests PASS, including 1,536 renderer oracle comparisons, 24-seed × four-fixture frozen animation/membership oracle, P2 assist/pickup oracle and frozen P1 gameplay. All 18 images match bytes. Repository hygiene has zero warnings; generated PWA freshness/integrity verifies 348 assets. Integrated CI remains the delivery gate; existing browser timing failures must be tracked separately from P4 fixture stability.
