# FIELD Particle Performance P2 — spatial query authority

Start main: `da356db2d1f86f1d6b2e0533e07a4af7cad36030` (P1 / PR #321).

`src/veil/dust-spatial-index.js` owns a map-local uniform grid, 128 world units per cell. The index is held in a WeakMap, never in persisted map/run data. Array identity/population changes rebuild it at an explicit composition boundary; `createRun` invalidates a reused map. Production dust array order remains fixed during a run. An integration deliberately reordering the same array or moving a static dust must call `resetDustSpatialIndex` / `updateDustSpatialMembership` respectively. Runtime flow/vortex/cluster updates already call the membership API at the existing position writes; there is no separate population scan for membership maintenance.

Queries conservatively include the closed assist AABB and swept pickup segment AABB expanded by the original radius. Each record belongs to one cell; results sort by original array ordinal rather than IDs or bucket insertion order. `dust.ready` stays independent of membership. Engine exact distance/segment predicates, direction, yield, availability, effects, chain, event and pickup ordering are unchanged. Renderer and the full `animateUniverse` dust traversal are untouched except the permitted membership update at movement writes.

`tests/dust-spatial-index.test.mjs` covers grid boundaries, negative coordinates, movement, swept high-speed BURST/DRIVE, active assist ties/near-ties, simultaneous pickup ordering, 24 arbitrary seeds, all moving-record membership over 360 updates, cluster expansion, and stationary Rare respawn/suppression. Its transient test-only engine adapter replaces just the candidate provider with full-array traversal; it is not available in production. Event payloads, every player field, effects, dust state and pickup identity/order/time compare exactly. `tests/field-particle-performance.test.mjs` continues to compare all four P1 traces to the frozen pre-instrumentation oracle at the unchanged 1e-8 tolerance; neither the oracle nor fixed images are regenerated.

`assistScanned` and `pickupScanned` retain the P1 definition of records actually visited by the engine loop; they now count spatial candidates. Added counters expose queries, exact checks, full-scan equivalents and reduction ratio; `pickupDistanceTests` still has its original definition and equals `pickupExactChecks`. Renderer/dynamic counters preserve their definitions. A one-time O(N) index build is required at flight initialization; no second per-slice full-map maintenance pass is introduced. Browser timing excludes initialization through the unchanged P1 warm-up, and includes ongoing moving membership maintenance.

## Reproduction

```sh
node --test tests/dust-spatial-index.test.mjs tests/field-particle-performance.test.mjs tests/field-particle-render-counters.test.mjs
node scripts/benchmark-dust-grid.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-repository-hygiene.mjs
node tests/repository-hygiene.test.mjs
node scripts/build-precache.mjs --check
node tests/pwa.test.mjs
```

`scripts/benchmark-dust-grid.mjs` compares 32/64/96/128-unit grid candidate/update cost on P1 fixtures. Its timing is descriptive rather than a CI threshold. 128 reduces membership migration and measured query+update overhead while all candidates still undergo original exact predicates. This choice tunes only index cells, never gameplay radii.

Normal/Dense hard gates are respectively <=15% / <=20% of full-scan equivalent. No absolute browser timing CI gate is introduced. Same-backend paired P1/P2 measurements distinguish CPU simulation and renderer submission from RAF/raster scheduling; no physical Android GPU claim is made.

P3 remains Dynamic Dust Update / animateUniverse Full-Scan Removal. P2 does not optimize drawing or reduce dynamic targets, particle count, visual density, physics or economy.

## Measured acceptance

Frozen P1 evidence is unchanged. P2 measurements are in `tests/fixtures/field-particle-p2/`: paired P1/P2 browser JSON, Dense confirmation pairs, grid tuning and visual hash comparison. Headless Chromium 153 / SwiftShader, same 390×844 CSS viewport, DPR 2 emulation, production Canvas cap 1.75, unchanged 60 warm-up + 180 measured frames. Scan counters below are one simulated second (60 fixed slices with P1 inputAt).

| Fixture | P1 full-scan equivalent | P2 assist candidates | P2 pickup candidates | Total candidates | Reduction | Assist / pickup exact checks |
|---|---:|---:|---:|---:|---:|---:|
| normal | 543,600 | 1,306 | 889 | 2,195 | 99.596% | 881 / 572 |
| dense | 1,630,800 | 3,872 | 2,623 | 6,495 | 99.602% | 2,680 / 1,737 |
| awakened | 543,600 | 831 | 188 | 1,019 | 99.813% | 684 / 95 |
| dynamic-heavy | 543,600 | 7,543 | 5,151 | 12,694 | 97.665% | 3,831 / 2,622 |

Normal is 0.404% of baseline (gate <=15%); Dense is 0.398% (gate <=20%). All fixtures make 60 assist and 60 pickup queries. Normal's exact pickup tests fall from 243,295 to 572/s while the same 10 pickups occur. Density, placements and dynamic/render work remain unchanged.

| Fixture | Motion | P1 CPU median / p95 / max ms | P2 CPU median / p95 / max ms | P1 → P2 simulation median ms |
|---|---|---:|---:|---:|
| normal | normal | 2.30 / 3.40 / 5.00 | 2.20 / 2.80 / 5.70 | 0.80 → 0.50 |
| dense | normal | 3.70 / 5.60 / 15.40 | 4.20 / 7.70 / 9.50 | 1.70 → 1.40 |
| awakened | normal | 3.00 / 3.40 / 7.40 | 2.20 / 2.90 / 3.30 | 1.00 → 0.50 |
| dynamic-heavy | normal | 3.50 / 6.70 / 25.00 | 2.70 / 4.50 / 8.90 | 1.10 → 0.60 |
| normal | reduced | 2.40 / 3.00 / 9.40 | 1.80 / 2.50 / 3.10 | 0.90 → 0.50 |
| dense | reduced | 4.00 / 6.20 / 13.70 | 3.90 / 5.60 / 7.60 | 2.10 → 1.30 |
| awakened | reduced | 2.20 / 3.10 / 3.50 | 2.20 / 2.90 / 12.70 | 0.80 → 0.50 |
| dynamic-heavy | reduced | 2.40 / 3.40 / 25.80 | 2.50 / 3.60 / 7.10 | 0.90 → 0.60 |

Initial Dense normal-motion total p95 rose with renderer submission (3.2→6.0 ms) while simulation median fell. This was not hidden or attributed to index correctness. An isolated repeat confirmed the following; raw first-pass and repeat values are both retained:

- Dense normal CPU median/p95/max: 4.50 / 7.70 / 13.70 → 3.20 / 5.40 / 11.40 ms.
- Dense reduced CPU median/p95/max: 4.40 / 5.50 / 16.00 → 2.80 / 4.10 / 4.60 ms.

Normal p95 improves in both motion settings relative to the paired P1 run and stored P1 baseline (3.5/3.0 ms). No continuing index-owned frame regression is observed. Software-raster and shared-host variation remain limits; absolute FPS or max spikes are not hard gates. Ongoing moving-membership cost is included in simulation time.

All 18 paired visual images are byte-identical. Dynamic-heavy normal still has 5,611 flow strokes and 681 Carbon center shapes per 60 draws. Normal renderer still scans 271,800 records/s, rejecting 238,448 offscreen, rendering 4,837; draw policy/counts are not optimized in P2.

P3 remaining dynamic scans: Normal/Awakened/Dynamic-heavy 271,800/s; Dense 815,400/s. Updates remain 38,040 / 37,860 / 38,040 / 114,120 respectively. P3 can reuse `updateDustSpatialMembership` without changing query authority or availability.

Validation: P1's original 3,600-frame signatures pass for all four scenarios with instrumentation enabled and disabled, tolerance 1e-8. Full-scan oracle covers 24 seeds, exact per-frame player/events/effects, high-speed swept pickup, active equal/near-equal assist ties, moving/cluster cells and Rare normal respawn/Infinity suppression. Maintained FIELD regressions, independent Canvas spy and PWA/hygiene pass. The two stale supplementary probes recorded by P1 are unchanged and remain separate from maintained gates.
