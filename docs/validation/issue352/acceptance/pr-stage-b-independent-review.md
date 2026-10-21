# Issue #352 / PR #353 — independent ordinary Stage B evidence review

Independent reviewer agent; 2026-10-21 JST. Read-only verification and offline recomputation only. No browser profile, CI rerun or new performance trial was performed for this review.

## Scope and authority

- PR #353 candidate HEAD: `e5ce3d1b5168e670990b40081cc9246922289d90`.
- Ordinary run `39518445476`, Stage B job `118956164582`.
- Directly fetched GitHub job status: completed / success. All listed steps are completed / success, none skipped. Checkout log independently confirms this exact HEAD. The oracle/comparator contract suite reports 10 tests / 10 pass / 0 fail.
- Artifact ID `12308328094`, `task10-task11-stage-b-performance-comparison`.
- Downloaded ZIP `/tmp/issue352-pr-stage-b.zip`: SHA256 `78d089f4a5f727a7b9d684fe2e94e15be09d64d79ad58ea089228a3368ff146b`.

Independently checked ZIP members exactly match the three extracted files. Both complete profile JSONs and the complete comparison JSON also exactly match their corresponding structured JSON values in the directly fetched job log.

| Raw file | Bytes | SHA256 |
|---|---:|---|
| baseline.json | 35077 | `b84252a4e50aa88a17b68265d5ba55a29b86cd76292d196a49f7045dc0acb2e8` |
| candidate.json | 37955 | `88f0de74c5a6462e9f57f5482642cf01fa1b043140685b8b204248fd30b2acee` |
| comparison.json | 70685 | `18e8fbc9399ee1539ccbffe82f983477d6bb49ef2ddf51367a8e29e820d4adee` |

## Source and unchanged measurement contract

Immutable baseline is `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`; candidate raw source matches the PR HEAD. `scripts/profile-reaction-lab-stage-b.mjs` and `scripts/compare-reaction-lab-stage-b.mjs` have no diff between pre-repair main `6c676317` and candidate `e5ce3d1b`.

Workflow still runs the ordinary profiler on both source roots, not the diagnostic wrapper. Both profiles report Node `v22.23.3`, Chrome `155.0.8059.39`, exact revision `3ff7ac5a9224be9156d7f8703a06e22890aafd34`, protocol `1.3`, mobile 390×844 / DPR1, normal motion. The Chrome revision is also the frozen failed ordinary run's revision; diagnostic Chrome `.84` is not substituted here.

Both profiles retain one warm-up row and four measured rows, each with all 150 retained durations from the unchanged `measureFixedSteps(180)` / discard-first-30 method. Every saved row reports 384 final candidates and reaction ID `complete-28-methane-combustion`. Workload fields remain six instances of methane + oxygen + 2-butene, 29 full matcher rules and minimum 384 candidates. Browser error arrays are empty. The existing raw format reports candidate count at the last step; this limitation has not been relabelled per-step proof. Deterministic oracle tests separately preserve full candidate enumeration.

Independently checked all 1,500 saved warm-up + measured durations are finite and nonnegative; every p50/p95/p99/max agrees with nearest-rank recomputation. Both pooled arrays exactly equal all four measured arrays sorted, containing all 600 values each. Warm-ups are retained but excluded from pooled acceptance as in the unchanged method. No slow step or trial has been removed.

## Strict comparison reproduced exactly

Ran the unchanged comparator offline against the downloaded raw baseline/candidate files, with their exact source SHA environment variables. Exit code 0. The resulting parsed JSON exactly equals the complete saved comparison JSON, including all raw trials, threshold, tolerance, checks, classification and pass flag.

| Ordinary profile | Trial 1 P95 | Trial 2 P95 | Trial 3 P95 | Trial 4 P95 | Pooled P95 |
|---|---:|---:|---:|---:|---:|
| Baseline | 6.1 ms | 5.7 ms | 5.7 ms | 7.1 ms | 6.0 ms |
| Candidate | 4.3 ms | 4.2 ms | 3.9 ms | 4.0 ms | 4.0 ms |

Unchanged absolute budget: `8.333333333333334 ms`. Computed relative tolerance: `0.6000000000021828 ms`. All four comparison checks pass; classification `both-within-budget-no-significant-regression`. Candidate maximum durations by trial are 5.6 / 6.7 / 4.3 / 7.3 ms, with zero measured steps above the absolute budget. Baseline maxima are 12.7 / 6.2 / 6.0 / 14.6 ms; those tails remain included and are not used to waive any candidate requirement.

The valid conclusion is **this ordinary PR Stage B strict acceptance PASS**, supported by raw durations and independent offline reproduction. It does not prove the GC/OS mechanism of frozen failed clusters. That historical failure remains valid evidence. The cause-backed repair independently removes confirmed redundant read-only geometry computations while preserving candidates and chemistry; no threshold or measurement relaxation was necessary.

## Remaining release boundary

At this direct GitHub status check, the same run's Finite job `118956164754` is still `in_progress`, not PASS. Repository/FIELD completion and full final release review were not checked in this Stage B-only review and are not approved by inference. Required merge and main post-merge Stage B verification are also outstanding. This review does not close Issue #352 or declare Task④ CLOSED.
