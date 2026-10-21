# Issue #352 — independent main / post-merge final review

Independent reviewer agent, 2026-10-21 JST. **Final adjudication: Task④ CLOSABLE; the required technical acceptance conditions for CLOSED are satisfied.** Issue #352 was still OPEN at the final read-only check; recording this evidence and closing that Issue is the remaining administrative action for the primary agent. No mandatory technical blocker remains in the reviewed main evidence.

No new CI run, performance retry, browser measurement or production change was initiated by this reviewer. Evidence is the actual ordinary main push run following the authorized PR merge, independently downloaded raw artifacts, direct GitHub job/log states, immutable source/tree checks and offline recomputation. Previous failed runs remain valid historical evidence.

## Actual merged authority

- Starting main: `6c676317ff590dd756685168484c79788b5a329b`.
- Reviewed PR #353 HEAD: `e5ce3d1b5168e670990b40081cc9246922289d90`.
- PR #353 direct GitHub state: MERGED / closed.
- Actual merge and fetched current main: `593ac571e4d664f7af885855352142874dd227ab`.
- Main and reviewed HEAD tree: **exactly identical**, `7dad9ba4df1824276efc9121b0de5829f7704610`.
- The main push workflow's checkout log confirms actual `593ac571...`, not the pre-merge HEAD or synthetic PR ref.
- Ordinary post-merge run: `39520340651`; Stage B job `118962378077`, Finite job `118962378468`. Both completed / success, every listed step completed / success, no skipped or failed step.

Repository run `39518445543` (8/8 jobs) and FIELD Insight run `39518445509` (1/1 job) are the completed **PR acceptance evidence reused by complete tree identity**. They are not described as new main Repository/FIELD executions. Their exact source/tree and all-success steps were independently reviewed before merge; no unreviewed source or generated-output change occurred during merge. The separate robot review completed on exact PR HEAD with no findings; the independent pre-merge review found no blocking issue.

PWA refresh run `39520340528` completed / success with every step successful. Pages run `39520340329` completed build / deploy / report-build-status, every step successful. These deployment results do not substitute for performance acceptance.

## Post-merge ordinary Stage B: independently PASS

Artifact `12310827735`, 8,014-byte ZIP. Independently downloaded `/tmp/issue352-main-stage-b-independent.zip`; SHA256 equals the GitHub artifact digest:

`e36a462c177c016f678fdf39bd6c79c47e941385efb144b46e93f55354df5249`

Extracted raw directory: `/tmp/issue352-main-stage-b-independent/`.

| Member | Bytes | SHA256 |
|---|---:|---|
| baseline.json | 32248 | `7c8d02d1fa72656f2203c8aa679985cab75dadf016454df7a617cc1cd6cbe9a6` |
| candidate.json | 31948 | `765cc047127a03bbaed1023749e3152ab92cb0907b0be53aeef994a51d5b5395` |
| comparison.json | 61924 | `b5cbf1f3b0d560613f87a73c9a90154c1fb7d60de2d0fafcca189f3628e18453` |

All three extracted files match their ZIP members. Both full profile JSON values and the entire comparison JSON exactly match the directly retrieved job log's structured outputs. Re-ran the unchanged comparator **offline** with exact baseline SHA `4bc202c0eb1f51de0350c3a0b4be36c7178cba53` and actual main candidate SHA `593ac571...`; exit 0 and resulting JSON exactly equals the saved comparison.

| Profile | Trial 1 P95 | Trial 2 P95 | Trial 3 P95 | Trial 4 P95 | Pooled P95 |
|---|---:|---:|---:|---:|---:|
| Immutable baseline | 8.3 ms | 13.3 ms | 8.0 ms | 8.3 ms | 10.7 ms |
| Actual main | **5.9 ms** | **5.0 ms** | **5.1 ms** | **5.1 ms** | **5.1 ms** |

All four comparison checks pass. Absolute budget remains `8.333333333333334 ms`; computed relative allowance `0.45000000002619345 ms`. Main measured-trial maxima are 7.1 / 6.3 / 5.7 / 6.0 ms; no measured main step exceeds the absolute budget. Baseline hard-gate failure is retained and grants no exemption: main independently satisfies every absolute and relative condition.

Independently recomputed all warm-up/trial percentile/max values from all 1,500 finite nonnegative saved durations. Both 600-value measured pooled arrays exactly contain all four measured trial arrays. One warm-up and four measured rows per source, 150 retained durations each, are intact; no slow step or trial was removed. Workload remains six methane/oxygen/2-butene instances, 29 full matcher rules and 384 final candidates in every saved row. Browser errors are empty. The profiler and measurement boundary remain unchanged `measureFixedSteps(180)` / first 30 discarded / next 150 retained. Stored `frameIntervalsMs` is still fixed-step wall duration, not GPU presentation.

Both Stage B source profiles use Chrome **155.0.8059.84**, exact revision `5869fe313571d75152b77813cf0a4ee26a4e6df0`, same viewport 390×844 / DPR1 and normal motion. This is a change from the pre-merge/frozen ordinary Stage B job's `.39`; no source/workflow browser selection or threshold change was introduced. Baseline and candidate within this ordinary job use the exact same browser. Results are not a favorable-runner selection or rerun of unchanged source waiting for success.

## Post-merge ordinary Finite: independently PASS

Artifact `12310984792`, 210 members, 17,551,053-byte ZIP. Independently downloaded `/tmp/issue352-main-finite-independent.zip`; SHA256 equals the GitHub artifact digest:

`0b4c8c09aa705523ad40823bd0c4d76671e2630dd285b6899a62179ffc8c778e`

Complete extraction: `/tmp/issue352-main-finite-independent/`. Every extracted archive member's bytes match the ZIP. All four baseline/candidate × mobile/desktop ordinary performance documents are present, each containing ten records: normal/reduced motion, one warm-up plus four measured trials per mode. **All 40 completions, including eight warm-ups, remain in evidence.** Independently checked raw interval count/value/statistic integrity, exact source SHA, trial ordering, 650/250 ms feedback target, no ready-state layout, zero retired-module fetches and viewer resource disposal / stable post-dispose runtime / renderer disposal / event-controller abortion.

The unchanged offline Finite comparator, using immutable baseline and actual main source SHA, exits 0 and reproduces the entire saved comparison JSON exactly. All four conditions pass every unchanged P50/P95/max/completion-latency check. Offline resource-gate reproduction also exactly matches the stored summary.

| Condition | Main / baseline long-frame counts | Main maximum interval | All comparison checks |
|---|---:|---:|---|
| Mobile normal | 0 / 0 | 16.8 ms | PASS |
| Mobile reduced | 1 / 0 | 33.3 ms | PASS under unchanged allowance |
| Desktop normal | 24 / 24 | 116.8 ms | PASS |
| Desktop reduced | 8 / 8 | 116.7 ms | PASS |

Finite baseline and main both use Chrome **155.0.8059.39**, revision `3ff7ac5a9224be9156d7f8703a06e22890aafd34`. This differs from the separate Stage B job's browser, while each actual comparison is same-condition internally. No claim is made that all jobs used one global Chrome revision.

Independent main-artifact checks also confirm:

- 25 unique accepted routes / 25, fallback 0, severe overlaps 0.
- Both viewport representative browser reports contain all 13 actual-pointer routes plus reduced motion, with no layout fallback. Read-only resource checks reproduce the expected finite atoms/bonds, one active sample group and cleanup evidence.
- Both failure-boundary reports keep committed sample/discovery, contain zero unverified geometry, and keep failed-display gestures inert.
- Both integrated journey reports have actual main source SHA, 22 steps, no browser errors / failed local requests / bad local responses. Save/reload, persisted shell selection and FIELD launch with all selected applications succeed.
- Actual-pointer gameplay, orbit/zoom/reset, generic release/recovery, next FEED/purge, Collection and Engineering, save/reload, trusted FIELD confirmation, close/reopen/disposal, no retired assets and PWA/offline tests all complete successfully.
- PWA integrity reports 353 hashed assets; generated assets/PWA freshness and hygiene checks succeed. This is 25-route deterministic geometry and representative browser coverage, not a false assertion of 25 interactive routes or real-device GPU coverage.

## Cause, confidence and preserved risks

The production repair removes a directly observed excess: repeated matcher geometry dominates approximately 98% of diagnostic step wall time and CPU samples repeatedly contain world-transform matrix work. The immutable-main oracle proves full 384-candidate outputs while reducing coordinate calculations 19,968→14 and canonical atom-pair calculations 9,216→48 per step. Changed next-step poses rebuild caches. This satisfies the user's explicit cause-backed option to minimize demonstrated production hotpath excess without changing meaning. It changes no physics, chemistry, graph/origin/bond order, sample identity, save schema, fixture, baseline, matcher rules, trial count, warm-up or threshold.

The exact GC/JIT/OS mechanism concentrating the old failed main durations into particular clusters remains unproven. That old failure has no matching runtime/scheduler clocks. Instrumented CPU/GC evidence is separate and cannot retrospectively prove each old interval's cause. Diagnostic RAF contamination / first-180-only buffers, split-runner controls and unavailable <5% same-runner overhead estimate remain explicit limitations. Current ordinary acceptance does not erase the frozen old failure.

Desktop Finite long frames up to 116.8 ms remain real measurements and prevent a 60-fps guarantee. Historical geometry-generation tail, older Finite/GPU/presentation uncertainty and real-device/visual acceptance limitations remain for Task⑤/⑥. They are not covertly repaired by the fixed-step cache or waived by baseline failure. PR #345 has not been merged as part of this repair.

## Final independent disposition

The reviewed repair is merged without tree changes, and actual main now passes the mandatory Stage B gate plus all post-merge Finite steps with independently reproduced raw comparisons. Exact-tree PR Repository/FIELD acceptance remains valid and is explicitly distinguished from new main runs. PWA/Pages succeeded. **Task④ can be formally CLOSED and handed to Task⑤ once Issue #352 records this evidence and is closed.** No additional favorable timing run is warranted or requested.

Full directly retrieved post-merge logs:

- `/tmp/issue352-main-stage-b.log` — SHA256 `26ebc4cb5e0571492cc1d99e4545e868f184bc65b49b26e7587d2fadcc81720e`.
- `/tmp/issue352-main-finite-validation.log` — SHA256 `ba216ad527ae7a6591f43723337f9a7b438b783fddb6ca55d854b5a971c802a3`; primary agent should retain it with the complete raw JSON bundle and artifact digest.
