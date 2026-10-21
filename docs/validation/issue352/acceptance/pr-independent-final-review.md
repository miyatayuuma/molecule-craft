# Issue #352 / PR #353 — independent final pre-merge release review

Independent reviewer agent, 2026-10-21 JST. **Determination: RELEASE_ELIGIBLE for the reviewed HEAD, subject to actual merge and required main post-merge verification. Task④ is not yet CLOSED at this pre-merge boundary.** No correctness, required-test, or evidence-integrity blocker remains in the completed PR evidence reviewed below.

This is a separate agent's review, not a second GitHub account approval. No new browser/performance trial, CI rerun, source edit or threshold change was made for this final review. Work consisted of direct GitHub read-only status/log retrieval, artifact download, source/tree comparison and offline raw-data recomputation.

## Reviewed source and review state

- Base main: `6c676317ff590dd756685168484c79788b5a329b`.
- PR #353 HEAD: `e5ce3d1b5168e670990b40081cc9246922289d90`.
- Reviewed tree: `7dad9ba4df1824276efc9121b0de5829f7704610`.
- The normal Stage B/Finite workflow checks out the exact HEAD. Repository/FIELD jobs using PR merge ref use synthetic merge `a86f6c962af691c58a36f43253b49fbc48bc2395`. Independently fetched `refs/pull/353/merge` and verified its tree exactly equals the reviewed HEAD tree. These are not mislabeled actual main runs.
- Direct PR review summary: code review completed on this exact HEAD, `has_any_findings:false`, `has_unresolved_findings:false`. Direct review-thread listing is empty. Independent semantic review and immutable-main oracle results are recorded separately in `docs/validation/issue352/independent-repair-review.md`.

## All ordinary required PR jobs completed

Directly fetched final GitHub job/step states. All 11 jobs below are completed / success, and every listed step has success; no skipped, failed or pending step is substituted for PASS.

| Workflow run | Jobs | Independent result |
|---|---|---|
| `39518445476` | Stage B `118956164582`; Finite `118956164754` | 2/2 PASS, every step successful |
| `39518445543` | Repository: ring calibration, field-particle baseline, guardrails, field-return flow, polymer authority, six-member conformation, aromatic geometry, loadout optical acceptance | 8/8 PASS, every step successful |
| `39518445509` | FIELD Insight `118956165214` | 1/1 PASS, every step successful |

Repository guardrails job `118956164938` includes the independent pre-repair-main geometry oracle, physics/chemistry/save tests, generic pointer/reaction browser regression, synchronous release/blur contracts, CRAFT/FIELD regressions and PWA checks. Its separate candidate full-matcher raw record reports 384 candidates in every saved trial, trial P95 **2.0 / 1.9 / 2.1 / 1.9 ms**, pooled **1.9 ms**, unchanged 8.333333333333334 ms budget. The independent baseline control reports 7.5 / 7.9 / 8.0 / 7.8 ms, pooled 7.9 ms, exit 0. Baseline success is not used to waive candidate acceptance.

## Independent Stage B raw verification

Artifact `12308328094`; ZIP SHA256 `78d089f4a5f727a7b9d684fe2e94e15be09d64d79ad58ea089228a3368ff146b`. Independently checked archive members, file hashes, complete raw profile JSONs and comparison JSON against the directly fetched job log. All values match. The unchanged offline comparator reproduces the entire saved comparison JSON exactly, including every raw trial, checks and pass flag.

| Source | Four ordinary measured-trial P95 values | Pooled P95 |
|---|---|---:|
| Immutable baseline `4bc202c0eb1f51de0350c3a0b4be36c7178cba53` | 6.1 / 5.7 / 5.7 / 7.1 ms | 6.0 ms |
| Reviewed candidate `e5ce3d1b` | 4.3 / 4.2 / 3.9 / 4.0 ms | 4.0 ms |

All four checks pass with unchanged absolute budget 8.333333333333334 ms and computed relative tolerance 0.6000000000021828 ms. Candidate measured-trial maxima are 5.6 / 6.7 / 4.3 / 7.3 ms; every measured candidate step is below the budget in this ordinary run. Warm-up values remain retained separately and are not removed from evidence.

Both sources report exact Chrome `155.0.8059.39`, revision `3ff7ac5a9224be9156d7f8703a06e22890aafd34`, Node `v22.23.3`, 390×844 / DPR1, normal motion, six methane/oxygen/2-butene instances, 29 matcher rules, 384 final candidates and the unchanged warm-up + four 150-retained-step trials. This is ordinary profiling, not injected diagnostic timing. The profiler and comparator have no diff against pre-repair main. The saved final candidate count remains a last-step observation, not falsely relabelled per-step telemetry.

All 1,500 saved baseline/candidate warm-up and measured durations are finite/nonnegative and independently reproduce every nearest-rank percentile/maximum; both 600-value measured pooled arrays exactly contain all four trial arrays. See the separate detailed `/tmp/issue352-stageb-independent-review.md` for raw member hashes and verification details.

## Independent Finite raw and regression verification

Finite artifact `12310501924`, 210 archive members, 17,532,979-byte ZIP. SHA256 independently equals the GitHub artifact digest: `5eab5ec2d2e457c04fb26b656bbdb2b49db21755afe3be565286195c8356ae51`.

Downloaded archive: `/tmp/issue352-pr-finite-independent.zip`; complete extraction: `/tmp/issue352-finite-independent/`. No profile was selected or dropped. The four ordinary baseline/candidate × mobile/desktop performance documents each contain all ten completions: normal and reduced motion, each with warm-up trial 0 and measured trials 1–4. **All 40 profile records, including eight warm-ups, are present.** Independently checked raw interval counts, finite nonnegative values, per-trial percentile/max summaries, 650/250 ms target contracts, no post-ready layout, no retired module fetches and each viewer's zero-resource disposal state/stable runtime/renderer disposal/event abort flags.

Ran the unchanged `compare-polymer-performance.mjs` offline with the exact baseline/candidate source SHA variables. The result exactly equals the complete saved comparison JSON. All four viewport/motion conditions pass every frame P50/P95/maximum and completion-latency check. Re-ran the resource-evidence gate offline against the downloaded browser JSONs; its complete summary also matches the saved summary exactly.

- Mobile normal: candidate long intervals 1 versus baseline 0, maximum 33.4 ms; within the unchanged one-additional-long-frame contract.
- Mobile reduced: candidate and baseline long intervals 0, candidate maximum 16.8 ms.
- Desktop normal: candidate and baseline long intervals 24; candidate maximum 116.7 ms.
- Desktop reduced: candidate and baseline long intervals 8; candidate maximum 116.7 ms.

Desktop has substantial long frames and is not a 60-fps guarantee. The unchanged relative gate passes; these values remain a renderer/performance risk for Task⑤/⑥, not hidden or replaced by the fixed-step improvement.

Raw geometry report independently has 25 accepted unique routes / 25 routes, fallback 0, severe overlap 0. Production geometry/graph/bond-order/origin/sample/fallback modules are unchanged by this repair.

The two representative browser JSONs each contain 13 actual-pointer routes plus reduced motion (14 rows). The unchanged resource gate confirms atom/bond-owned geometry counts, one active finite group, no post-ready layout, and zero retired-module requests at mobile/desktop. Both Task④ failure-boundary JSONs preserve committed sample and discovery, have zero unverified geometries and keep failed-display gestures inert. This is 25-route deterministic geometry plus representative browser coverage, not a false claim of 25 interactive routes.

Both integrated journey documents match the reviewed HEAD, contain 22 steps, and have empty browser errors / failed local requests / bad local responses. Their saved records include actual pointer FEED for BR/PAN/PF/PVC, discovery/Collection, Engineering, save/reload, persisted Collector Shell selection, trusted FIELD launch and three application effects. The actual completed browser job also verifies orbit/zoom/reset/pointer actions, next-FEED/purge, close/reopen/disposal, close-before-ready, generic reactions, Collection discovery/reload and PWA/offline behavior. The completed FIELD Insight job separately covers persistent seed, weighting/rescue/re-arm, critical protection, desktop/mobile interaction and live threats.

PWA freshness and integrity passed with 353 hashed assets; generated-asset diff checks succeeded. Hygiene and dependency closure passed. No source or test failure was bypassed.

## Cause-backed repair and remaining uncertainty

The independently demonstrated cause-backed repair target is excessive repeated matcher geometry work: approximately 98% of observed fixed-step diagnostic wall time, backed by CPU stacks and 19,968 coordinate / 9,216 pair calculations per step. The real production repair uses step-local lazy read-only reuse; the immutable-main oracle proves 14 / 48 calculations with every 384-candidate diagnostic, dwell, arbitration and commit input preserved. Both caches rebuild after the next step's pose/orientation change. Physics, profiler, rules, baseline, warm-up, trial count, slow-value inclusion and thresholds are unchanged.

The user explicitly permits minimizing demonstrated production hotpath excess without changing its meaning. On that instruction, this measured removal plus unchanged ordinary strict acceptance supports release eligibility. It is not permission to claim complete historical mechanism attribution. Constant redundant work alone does not establish why the old failed run had particular three-/four-step clusters. The frozen failure lacks matching CPU/GC/scheduler clocks. Its exact GC/JIT/OS contributions remain unresolved.

Instrumented slowdown/CPU/GC observations are separate evidence. Their RAF-inclusive active window, first-180-only section buffers, control/instrument split runners, unavailable same-runner <5% overhead estimate and different diagnostic Chrome revision remain limits. No diagnostic is used in place of ordinary acceptance. The frozen post-merge FAIL and previous Finite/GPU/desktop risks are retained. PR #345 is not changed or merged.

## Release boundary and required next step

The completed reviewed PR evidence supports **RELEASE_ELIGIBLE**, not a retrospective PASS for the old failed run. No source/evidence blocker requires withholding the actual merge on this record. After merge, independently confirm actual main SHA and tree identity, then require ordinary post-merge Stage B strict PASS and any other mandatory main checks. A new post-merge failure must retain Issue #352 and Task④ as BLOCKED. Only successful completion of that boundary supports Task④ CLOSED and formal Task⑤ handoff.

## Retrieved full logs for evidence retention

- `/tmp/issue352-repository-guardrails.log` — job `118956164938`, SHA256 `c0625f25220858831c79efe840064091142f297c76e18c4fb34373fa18f03fec`.
- `/tmp/issue352-finite-validation.log` — job `118956164754`, SHA256 `3d8c3244033c8a0b1a30342a37868c1a189b0deae1ebb43eb3f301edf49bf7db`.
- `/tmp/issue352-field-insight.log` — job `118956165214`, SHA256 `875460492d4c1f51723e91c66820e77b2e788c4a46f45c7175e84d7efbda00fd`.
- `/tmp/issue352-repository-candidate-raw.json` — exact candidate full-matcher JSON parsed from the completed Repository log.
