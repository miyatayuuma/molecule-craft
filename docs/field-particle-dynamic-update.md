# FIELD Particle Performance P3 — dynamic update authority

Start main: `a331c09c52a9579a8f4d7016402aa57028af9b42` (P2 / PR #322).

`src/veil/dynamic-dust-registry.js` owns runtime-only simulation ownership, held in a WeakMap rather than map/run persistence. `engine.createRun` finalizes it after universe Rare replacement and expedition wrapper Nitrogen composition, so registry entries reference the final canonical objects. Dense test population is also composed before this boundary. It holds unique flow-or-vortex references in original array order. A reused run explicitly resets it; array replacement/length changes rebuild at composition boundaries, while integrations changing properties/order in place must call `resetDynamicDustRegistry`. Lazy construction supports direct `animateUniverse` tooling; it constructs the registry once, never traverses static dust on subsequent steps. Availability and visual visibility do not affect membership.

`animateUniverse` iterates this registry with the exact P2 equations and vortex-before-flow priority. Existing P2 128-unit grid membership synchronization immediately follows position writes, before assist and swept pickup queries. The index's existing same-cell early return is reused; no second index or maintenance scan is added. Cluster expansion retains its existing cluster.particles ownership and updates membership through the same API. Production clusters are disjoint from flow/vortex; tests assert that rather than silently dropping possible movement authority. Rare placement/identity/respawn, fixed steps, physics, density and renderer are unchanged.

Diagnostics retain `dynamicScanned` as records visited, `dynamicUpdated` as actual flow/vortex position updates and `clusterUpdated` as cluster position updates. Added fields: `dynamicFullScanEquivalent`, `dynamicRegistrySize` (gauge), `dynamicStaticVisited`, `vortexUpdated`, `flowUpdated`, `dynamicSameCellMoves`, `dynamicCellRelocations`, `clusterSameCellMoves`, `clusterCellRelocations`. Membership counts describe indexed movements; direct callers without a P2 index have no registered cell to relocate. Regular engine flight builds the index before animation. A proxy-based test counts actual static flow/vortex/position property reads after registry construction and proves zero, independently of the diagnostic counter. Browser measurements include membership maintenance, with initialization excluded by unchanged P1 warm-up.

## Validation authority

`tests/helpers/full-scan-animation-oracle.mjs` freezes the complete P2 animation function from start main, with its SHA256. It is test-only, never imported by production, and is not generated from the new implementation. `tests/dynamic-dust-registry.test.mjs` compares all flow/vortex/cluster coordinates, angles, ready states and events exactly over 180 steps for 24 seeds × Normal/Dense/Awakened/Dynamic-heavy (17,280 steps total). Both normal time progression and long jumps exercise flow wrap and vortex phase. Grid cell records compare directly with floor(world coordinate / 128), and zero-radius queries must find every moving particle. Explicit probes cover same-cell, x/y/diagonal crossings, negative and multi-cell motion, active cluster expansion, both-property vortex priority and write order. Conditional Rare-with-flow canonical replacement is tested synthetically: current production Rare sockets are static, so no Rare density or placement is changed to create that edge case.

Frozen P1 gameplay signatures and 1e-8 tolerance stay untouched. P2's exact full-scan assist/pickup provider oracle, Rare respawn/suppression and all four candidate counts remain gates. The 18 fixed visual files and oracle are not regenerated. `scripts/benchmark-field-particles.mjs` enforces dynamic <=20% for Normal/Dense plus exact repeated work counters and zero static visits, never absolute timing. Dynamic-heavy uses complete population equivalence instead of a percentage gate.

```sh
node --test tests/dynamic-dust-registry.test.mjs tests/dust-spatial-index.test.mjs tests/field-particle-performance.test.mjs tests/field-particle-render-counters.test.mjs
CHROME_BIN=/path/to/chromium node scripts/benchmark-field-particles.mjs
node scripts/check-repository-hygiene.mjs
node tests/repository-hygiene.test.mjs
node scripts/build-precache.mjs --check
node tests/pwa.test.mjs
```

## P4 boundary

Simulation ownership is independent of camera visibility. P4 can query the P2 spatial grid but must not redefine dynamic dust as visible dust. Rendering, visual culling, glow, draw-call style, DPR and reduced-motion semantics are untouched in P3. P4 owns renderer full-dust scan removal and draw-call overhead; no rendering optimization is implemented here.

## Measured acceptance

Raw evidence: `tests/fixtures/field-particle-p3/`. Paired P2/P3 Chromium 153.0.8010.0 / SwiftShader on Linux x64, CSS 390×844, emulated DPR 2, unchanged production DPR cap 1.75 / Canvas 683×1477, 60 warm-up + 180 timed frames. CPU simulation/render submission timing is not GPU completion or physical-device FPS. Captures precede the delivery commit, so `basis` is the start commit and runtime source SHA256 records identify the measured implementation. Initial source hashes were recorded immediately after capture without changing runtime files; future reports record them directly. The initial concurrent oracle/benchmark probe is retained separately and is not the paired timing authority.

| Fixture | Registry | Full-scan equivalent / s | Visited = updated / s | Static visits | Reduction | Same cell / relocations | Vortex / flow updates |
|---|---:|---:|---:|---:|---:|---:|---:|
| normal | 634 | 271,800 | 38,040 | 0 | 86.004% | 36,320 / 1,720 | 7,680 / 30,360 |
| dense | 1,902 | 815,400 | 114,120 | 0 | 86.004% | 108,935 / 5,185 | 23,040 / 91,080 |
| awakened | 631 | 271,800 | 37,860 | 0 | 86.071% | 36,147 / 1,713 | 7,680 / 30,180 |
| dynamic-heavy | 634 | 271,800 | 38,040 | 0 | 86.004% | 36,320 / 1,720 | 7,680 / 30,360 |

Normal/Dense visits are 13.996% of baseline (gate <=20%). Awakened is 13.930%. No dust or dynamic authority is removed: Normal has 128 vortex-priority + 506 flow-priority particles, Awakened 128 + 503; original vortex particles also carry flow metadata and still update only by vortex. The separate forced-cluster one-second probe has 2,160 cluster updates, 2,126 same-cell writes and 34 relocations; ordinary one-second P1 traces do not burst a cluster and therefore have zero cluster writes.

P2 assist+pickup candidate scans remain exactly 2,195 / 6,495 / 1,019 / 12,694 per second for Normal / Dense / Awakened / Dynamic-heavy, including both motion settings. Normal remains 99.596% below P1 assist/pickup scans; no broadphase radius or exact predicate changed.

| Fixture | Motion | P2 CPU median / p95 / max ms | P3 CPU median / p95 / max ms | Simulation median / p95 P2 → P3 ms |
|---|---|---:|---:|---:|
| normal | normal | 2.20 / 3.40 / 12.20 | 2.10 / 2.70 / 14.00 | 0.50 / 0.80 → 0.40 / 0.50 |
| dense | normal | 3.80 / 5.60 / 13.90 | 3.50 / 5.30 / 7.40 | 1.30 / 1.60 → 0.90 / 1.10 |
| awakened | normal | 2.70 / 3.30 / 5.00 | 2.50 / 2.90 / 5.30 | 0.60 / 0.80 → 0.40 / 0.60 |
| dynamic-heavy | normal | 2.80 / 5.20 / 10.00 | 3.00 / 7.30 / 17.30 | 0.60 / 1.00 → 0.50 / 1.00 |
| normal | reduced | 2.10 / 2.80 / 4.50 | 2.20 / 2.70 / 6.20 | 0.50 / 0.80 → 0.40 / 0.60 |
| dense | reduced | 3.30 / 4.80 / 13.70 | 3.60 / 5.10 / 15.50 | 1.10 / 1.50 → 0.80 / 1.00 |
| awakened | reduced | 2.30 / 2.90 / 5.30 | 2.40 / 2.60 / 4.00 | 0.50 / 0.70 → 0.40 / 0.50 |
| dynamic-heavy | reduced | 2.60 / 3.30 / 8.80 | 2.50 / 3.90 / 10.70 | 0.60 / 0.80 → 0.50 / 0.70 |

Normal p95 falls from 3.4→2.7 ms and reduced 2.8→2.7 ms in the fresh paired run; prior P2 stored values were 2.8/2.5 ms. Those cross-run values demonstrate environment variation, not an absolute CI timing authority. Simulation median/p95 improves in all settings except Dynamic-heavy normal p95 (unchanged 1.0 ms); no recurring registry/index-owned timing increase is observed. Normal max 14.0 ms is a renderer submission spike (13.7 ms), retained rather than hidden. Dynamic-heavy total normal p95 rises 5.2→7.3 ms with renderer p95 4.0→6.8 ms; Dense reduced total p95 also rises 4.8→5.1 ms despite simulation p95 1.5→1.0 ms. Renderer code, commands, particle work and screenshots are unchanged. Backend/shared-host variance is a plausible explanation, rather than a proven causal attribution; isolated Dynamic-heavy confirmation is recorded separately.

All 18 representative visual images are byte-identical to both P1 frozen files and the P2 paired captures. All renderer counts and dynamic update counts remain exact. P4 renderer scans remain 271,800/s for Normal/Awakened/Dynamic-heavy and 815,400/s Dense; Normal still rejects 238,448 offscreen and renders 4,837 dust per second. No renderer optimization is included.

Isolated Dynamic-heavy confirmation (all first-pass data retained):

- Normal CPU median/p95/max: 2.90 / 5.70 / 24.10 → 2.20 / 4.80 / 9.10 ms; simulation p95 1.00 → 0.70 ms.
- Reduced CPU median/p95/max: 2.70 / 4.60 / 12.30 → 2.40 / 3.60 / 13.50 ms; simulation p95 0.90 → 0.70 ms.

Validation completed: 32 targeted tests pass including 24-seed × four-fixture animation/membership oracle, frozen P1 gameplay and P2 broadphase oracle. 18 screenshots match bytes, repeated performance work counters are deterministic, PWA verifies 348 hashed assets and hygiene reports zero warnings. Existing stale supplementary probes remain outside maintained CI as recorded in P1/P2; no unrelated test authority is relaxed.
