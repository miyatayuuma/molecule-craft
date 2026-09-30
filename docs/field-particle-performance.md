# FIELD particle performance authority — P1

Measurement-only baseline. Source basis: `aa6e854204a080b74c30092e9455923b922b4d32` (PR #320). No particle constants, placement, spacing, physics, resources, assist/pickup radius, respawn, hazard or Rare Ecology rules changed. Optimization is outside P1.

## Reproduction and evidence

```sh
node --test tests/field-particle-performance.test.mjs tests/field-particle-render-counters.test.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-repository-hygiene.mjs
node tests/repository-hygiene.test.mjs
node tests/pwa.test.mjs
node scripts/build-precache.mjs --check
```

`FIELD_CHROME_ARGS` accepts a JSON array of browser flags. `FIELD_BENCH_OUTPUT` changes the output directory (default `test-results/field-particle-p1`). `FIELD_BENCH_ROOT` and `FIELD_VISUAL_ONLY=1` allow rendering an explicitly checked-out original source for comparison. Runtime has no diagnostic UI or URL switch; only test-created runs attach `particleDiagnostics`. Counters accumulate; take differences to obtain per-frame/per-second work. Phase `*Ms` values require an optional diagnostic clock. Timer-free counters and production runs never call that clock.

Fixture seed is 41. All stock is zero, post-CHO Nitrogen and combustion routes are enabled. Normal uses production universe. Dense deep-copies the authored population twice with new IDs, deterministic offsets and preserved cluster-particle identity, yielding exactly 3× dust; production density constants remain untouched. Awakened enables committed `worldAwakened`, `rareEcologyEligible` and fractured Core. Dynamic-heavy starts at production Oxygen vortex center (-500,-8380), where flow/vortex work is visible. These are declared benchmark conditions, not a distribution claim about player inventories.

Frozen evidence: [gameplay oracle](../tests/fixtures/field-particle-p1/gameplay.json), [browser measurements](../tests/fixtures/field-particle-p1/browser-baseline.json), [population / visual manifest](../tests/fixtures/field-particle-p1/manifest.json). Images and gameplay were generated using an isolated checkout of the source basis, before diagnostic changes; the oracle is not derived from the instrumented implementation. The manifest contains SHA-256 checksums. Do not auto-regenerate an oracle after an optimization to make a failure pass.

## Particle population

Population below is the fixed starting camera after renderer acquisition. Visible means strict CSS viewport inclusion (no 35px renderer margin), independently of ready state. Renderer counters below cover a moving one-second trace, and include the 35px margin, so they should not be compared to this snapshot as if both were the same frame.

| Fixture | Total | Visible / visible ready | Inside | Ready | Flow / vortex / unique dynamic | Cluster | Rare |
|---|---:|---:|---:|---:|---:|---:|---:|
| normal | 4,530 | 61 / 61 | 1.35% | 4,062 | 634 / 128 / 634 | 468 | 0 |
| dense | 13,590 | 180 / 180 | 1.32% | 12,186 | 1902 / 384 / 1902 | 1404 | 0 |
| awakened | 4,530 | 48 / 48 | 1.06% | 4,062 | 631 / 128 / 631 | 468 | 28 |
| dynamic-heavy | 4,530 | 332 / 260 | 7.33% | 4,062 | 634 / 128 / 634 | 468 | 0 |

Outside ratios are 100% minus inside. `flowDust` and `vortexDust` overlap: all 128 vortex records also carry flow metadata; production's `if vortex / else if flow` updates each once. Use `dynamicDust` for the union. Rare includes either legacy rare-kind dust or current Rare Ecology; in these fixtures all Rare counts are current ecology. Awakened has 28 P/S/F/Cl particles and 631 unique dynamics, because three flow sockets are replaced by Rare Ecology.

## Simulation work

Counts are totals over 60 slices = one simulated second with fixed `inputAt(frame)`, no rendering effects on simulation. Every fixture probes twice in the browser and demands exact agreement for non-time counters. Instrumented and uninstrumented 3,600-frame gameplay traces independently match the original-main oracle.

| Fixture | Assist scanned / nearby | Pickup scanned / distance tests / hits | Dynamic scanned / updated |
|---|---:|---:|---:|
| normal | 271,800 / 300 | 271,800 / 243,295 / 10 | 271,800 / 38,040 |
| dense | 815,400 / 954 | 815,400 / 729,968 / 29 | 815,400 / 114,120 |
| awakened | 271,800 / 92 | 271,800 / 243,543 / 3 | 271,800 / 37,860 |
| dynamic-heavy | 271,800 / 1,705 | 271,800 / 242,168 / 33 | 271,800 / 38,040 |

Cluster updates are separately counted (`clusterUpdated`); they are zero during these first-second measurement traces, but full 60-second gameplay signatures include cluster/respawn state. Nearby assist means ready records inside the full assist radius before nearest-target selection. Pickup hits are particles passing the exact swept segment collision test, not an approximation of spatial-query candidates.

Normal: assist + pickup inspect 543,600 records/s for 300 nearby assist records and 10 pickup hits. The remaining **543,290 inspections/s** are outside those actual nearby/hit sets (including unavailable records). Pickup performs 243,295 exact distance tests/s. Dynamic processing checks 271,800 records/s while updating 38,040: **233,760 static-record inspections/s (86.0%)**. Dense: assist + pickup inspect 1,630,800/s; **1,629,817** are outside nearby/hit sets, and dynamic processing wastes **701,280** static inspections/s. These counts describe avoidable global candidate traversal, not a promise to eliminate every narrow-phase rejection.

## Renderer work

One second below also contains 60 draws; per-frame values are totals ÷60. Renderer work depends on display frame count, unlike simulation's fixed slices. Normal renders 80.62 dust records/frame on average after margin/ready filtering, despite visiting 4,530 records every draw.

| Fixture | Scanned | Not ready | Offscreen reject | Rendered | Glow / center calls | Flow strokes / Carbon shapes |
|---|---:|---:|---:|---:|---:|---:|
| normal | 271,800 | 28,515 | 238,448 | 4,837 | 4,837 / 4,837 | 0 / 0 |
| dense | 815,400 | 85,461 | 715,597 | 14,342 | 14,342 / 14,342 | 0 / 0 |
| awakened | 271,800 | 28,260 | 238,897 | 4,643 | 4,643 / 4,643 | 0 / 0 |
| dynamic-heavy | 271,800 | 29,665 | 225,573 | 16,562 | 16,562 / 16,562 | 5,611 / 681 |

`scanned = notReady + offscreen + rendered`. Every visible dust causes one glow draw and one center-shape fill; Carbon shapes are a subset of centers. Reduced motion preserves scan/render/glow/center counts for these non-boosted traces and suppresses flow trail strokes. A Canvas API spy independently verifies the counters by subtracting an otherwise identical empty-dust render, and verifies instrumentation leaves the command sequence identical.

## Browser time measurements

Headless Chromium 153.0.8010.0, Linux x64, **SwiftShader software rendering**, CSS viewport 390×844, emulated DPR 2, production Canvas DPR cap 1.75 (683×1477 backing pixels). Screenshots normalize to 390×844. No DPR downgrade or FPS cap was introduced. 60 warm-up frames followed by 180 samples per fixture/motion variant. Main frame timers measure uninstrumented `stepRun + renderer.draw` CPU submission; phase timers/counters are captured separately. CPU submission does not include asynchronous GPU/raster completion. RAF intervals include scheduling/raster contention and must not be equated with simulation time.

| Fixture | Motion | CPU frame median / p95 / max (ms) | Simulation median | Renderer median | RAF interval median / p95 / max (ms) |
|---|---|---:|---:|---:|---:|
| normal | normal | 2.70 / 3.50 / 15.10 | 0.90 | 1.80 | 16.70 / 16.70 / 5466.40 |
| dense | normal | 4.90 / 8.30 / 14.00 | 2.30 | 2.60 | 33.30 / 50.10 / 5833.10 |
| awakened | normal | 3.20 / 3.60 / 18.70 | 1.10 | 2.00 | 33.30 / 50.00 / 1416.50 |
| dynamic-heavy | normal | 3.70 / 9.60 / 21.70 | 1.10 | 2.50 | 66.60 / 100.00 / 10649.60 |
| normal | reduced | 2.70 / 3.00 / 7.40 | 1.00 | 1.70 | 33.30 / 83.40 / 3449.90 |
| dense | reduced | 5.00 / 8.60 / 12.10 | 2.50 | 2.50 | 33.30 / 50.00 / 3733.20 |
| awakened | reduced | 2.60 / 3.30 / 6.70 | 1.00 | 1.70 | 33.30 / 50.00 / 1083.30 |
| dynamic-heavy | reduced | 3.10 / 4.70 / 8.80 | 1.00 | 2.00 | 66.60 / 83.40 / 9616.20 |

Large RAF outliers occur in this shared software-rendered host. They are preserved in the raw report, not silently trimmed or reclassified as gameplay regressions. Time values are descriptive and never hard CI gates. Mobile viewport emulation is covered; physical Android GPU timing is not covered and must remain an explicit limit on device-performance claims. Fixture stability is established by exact work-counter repeats and original-main gameplay comparison, not by timer repeatability.

## Primary target and P2 contract

Confirmed count-dependent CPU waste is global candidate traversal. Assist + pickup have twice the full-map inspections of each dynamic/render pass. Their combined diagnostic phase time is greater than the dust-render phase in Normal and Dense on this host; Dynamic-heavy additionally has significant visible draw work. Full renderer time includes authored fields/background and asynchronous software-raster costs, so it does not demonstrate a device-independent reversal of particle optimization priority. Keep P2 simulation spatial query, P3 dynamic traversal, P4 renderer traversal / draw overhead as the work order. Real-device GPU profiling may refine P4, but is not a basis for changing particle visibility.

P2 is **Simulation Broadphase / Assist & Pickup Spatial Query**. Replace only candidate retrieval; retain the existing exact distance/segment tests, ready checks, assist tie behavior and original `map.dust` iteration order for pickups. Dynamic flow/vortex movement and cluster bursts must update the query's membership before assist/pickup; collection/respawn may not leave stale eligibility. Cover negative coordinates, cell boundaries, large swept motion, ties, dense overlaps, unavailable dust, Rare suppression and cluster release. Compare all four fixed traces to the frozen oracle at absolute float tolerance **1e-8**; IDs, ordering, element/value/count and structural fields must remain exact. Every existing particle must remain collectible from the same path.

P2–P4 may not change dust placement/count, density, yield, respawn, assist, pickup, fixed physics, hazard intensity or Rare Ecology. Visual optimization must draw the same particles for the same viewport/motion state with the same glow size, colors, flow trails, Carbon geometry, Rare identity and route readability. Reducing displayed particle count is not performance closure. No time threshold should be invented from this machine's baseline; work reduction and identical behavior are the primary comparison evidence.

## Visual authority and validation

18 fixed images cover Veil, Carbon, Oxygen, Frontier, Nitrogen and each of Rare P/S/F/Cl, in normal and reduced motion. `visual()` sets the declared camera/player coordinate and render time 2 without simulating pickup, then resets the renderer. All 18 instrumented-main images are byte-identical to the independently rendered original-main images on the same browser/backend. Pixel identity is evidence for P1, not a cross-GPU hard gate for P4; compare the named visual properties and record backend/viewport differences.

Relevant maintained FIELD regressions, deterministic oracle tests, Canvas spy, repository hygiene, PWA hash/dependency closure and the new browser work gate pass. Two additional legacy probes already fail on the unmodified source basis: `tests/veil.test.mjs` imports a removed workspace-key export, and `tests/route-field-render.test.mjs` expects a stale minimum challenge-stroke count despite soft-extent rejection. Neither is a timing flake or caused by P1; they are outside the current workflow's maintained FIELD gates and their runtime code is untouched. Keep those findings separate from P1 regressions.

The first P1 CI browser attempt completed all measurements but exposed a benchmark-owned Chromium profile cleanup race (`ENOTEMPTY`). Cleanup now awaits process termination and uses bounded filesystem retries before declaring success. This was repaired as a fixture lifecycle defect, not dismissed as an existing browser flake.
