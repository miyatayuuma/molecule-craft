# Task④ GPU presentation / OS wait isolation — 2026-10-20

Authority rechecked on2026-10-21 Asia/Tokyo after resume; source and CI states unchanged. No new diagnostic or acceptance retry after resume.

## Authority and decision

Start main `37b7d2cde1e60cd28575784a252382f4599c391f`; start PR351 `0036e0f68f8fcce863d05fe2073950ad15461642`. FIELD test-only repair is integrated as `bce74c85b9121cbcaf5af83e58d9b86d62f36fe9`. Main remains unchanged; PR351 remains OPEN / UNMERGED. PR345 is independent and unchanged.

Decision **D — Indeterminate**, with partial support for software GPU execution/scheduling and presentation blocking. No cause-backed Task④/viewer production defect was established; no speculative production repair was made. An instrumented run's lower long-frame count is not a repaired ordinary acceptance. Task④ remains **BLOCKED**, with no Task⑤ merged authority.

## Fixed one-campaign experiment

Protocol and instrumentation commit `e9c74a9fa71700014a12e2ee65c81b3bd5562119`, branch `diagnostic/task4-gpu-os-wait`; workflow [39360186742](https://github.com/miyatayuuma/molecule-craft/actions/runs/39360186742), job118424317023 completed all ten trial captures.

One baseline/candidate pair only; baseline4bc202c0 then candidate0036, separate fresh profiles on the same runner. Chrome155.0.8059.39 / revision@3ff7ac5a9224be9156d7f8703a06e22890aafd34 and executable SHA2569bfb381296dffe75f3419d07b6cc64525105ed117d1453a4ef3b291cb97d2b58 unchanged before/after. Same existing headless ANGLE/SwiftShader flags, normal motion, mobile390×844 DPR1, PE trusted pointer fixture. Each side: one retained warm-up plus four measured completions. No extra campaign, no negative-control performance substitution, no selection/retry or threshold change.

| Diagnostic condition | Warm-up long intervals >25ms | Measured trial1/2/3/4 long intervals | Measured total |
|---|---:|---|---:|
| Baseline4bc202c0 | 2 | 9 / 1 / 2 / 0 | 12 |
| Candidate0036 | 3 | 1 / 1 / 0 / 1 | 3 |

| Diagnostic condition | Warm-up max (ms) | Measured trial1/2/3/4 max (ms) | Measured trial1/2/3/4 P95 (ms) |
|---|---:|---|---|
| Baseline4bc202c0 | 116.6 | 33.4 / 33.4 / 33.3 / 16.8 | 33.4 / 16.8 / 33.3 / 16.8 |
| Candidate0036 | 66.7 | 33.3 / 33.4 / 16.7 / 33.3 | 16.8 / 16.8 / 16.7 / 16.7 |

All profile values and all ten traces remain separate from ordinary acceptance. This table neither erases old run39251826085 candidate5 vs baseline2/allowed3, nor proves a performance improvement. Warm-ups are retained and excluded only by the existing declared warm-up policy.

## What the new observations establish

- SystemInfo identifies the GPU device as ANGLE Vulkan SwiftShader (software, SwANGLE5.0.0), not a physical-GPU measurement. Baseline target renderer2514/GPU2471 and candidate renderer2813/GPU2761 match trace CrRendererMain/CrGpuMain, process types/cmdlines and before/after Linux starttime. Target identities are stable in the samples.
- All ten trial clock-mark offset brackets intersect. Their uncertainty widths are0.693–1.693ms. GPU/renderer trace events share the trace domain; proc read brackets are mapped through these intersections. Browser/trace anchor variation12–102μs and approximate registration-to-first-RAF matching are retained. No sub-ms exact ordering claim is made.
- GPU main is sampled sleeping at `futex_do_wait` inside long presentation spans, while four GPU-process `Thread<00>`…`Thread<03>` workers have positive CPU execution and runqueue-delay deltas and are sampled R. R means runnable/running, not proof of simultaneous execution. GPU-main blocking and worker runnable scheduling delay are different observations.
- Example candidate measured trial2: RAF interval33.4ms; overlapping SwapBuffers28.536ms wall/0.482ms thread CPU; five wholly enclosed GPU-main samples are S/futex. Across a larger enclosing37.30–37.43ms proc read interval, GPU-main CPU7.582ms/runqueue delay1.931ms. Worker CPU18.626–26.219ms and runqueue delay5.336–12.686ms are over their own enclosing read intervals. These are **not exact gap contribution percentages**, nor values to sum across threads and divide by one wall interval.
- Trace records pending_swaps=max_pending_swaps=1 and Swap throttled, compositor submission/swap-post-submit/finish/ack steps, plus native RequestAnimationFrame→FireAnimationFrame IDs. Trial2 includes pending RAF requests2114/2115 delivered after30.114/30.154ms. GPU completion, begin-frame delivery, callback delay and throttling have an observed temporal sequence; this does not by itself prove the particular wait causes the RAF gap.
- In that trial the largest overlapping renderer RunTask is4.571ms wall/2.290ms CPU. The recorded main-thread work does not explain the whole33.4ms interval as one CPU-saturated task. V8/GC events and task walls/CPU are retained in analysis; no GC-based repair is justified.
- PE resource counts match for corresponding trials: one active group,48 objects,47 geometries,47 materials; layoutCalls8/bond allocations69/completionFit2/layoutAfterReady0 in trial1. Equal resource counts do not prove equal fragment screen area, overdraw, shader work or graphics execution cost. Candidate coordinate changes may alter raster work; that contribution remains unresolved.

## Limits and unresolved mechanisms

The sampler uses about0.36–0.41 CPU core (1.325–1.873s CPU over3.58–4.98s observed wall), separate from tracing and fixture overhead. Its requested5ms polling has retained actual read durations/cadence and occasional longer sampling intervals. Observer-induced scheduling disturbance cannot be ruled out, so the instrumented counts are never ordinary PASS evidence.

Kernel perf is present but permission denied at perf_event_paranoid4; readable scheduler-switch tracepoint data and hardware queue counters were not available through this capture. `sched_schedstats=0` is retained; `/proc/PID/task/TID/schedstat` exports `sched_info.run_delay/pcount` independently (Linuxv6.17 `fs/proc/base.c`, `include/linux/sched/stat.h`). Positive enclosing deltas are observable; zeros do not prove no wait. Counter accounting updates and read bracketing preclude an exact per-gap partition.

Instant wchan samples do not expose user-space futex callers, dependency targets, wakeup edges or worker-to-swap completion causality. Hardware GPU submit/presentation queues are NOT_AVAILABLE in this SwiftShader campaign; Chromium compositor pipeline steps are not substituted for hardware counters. One non-target renderer2832 exits/is unavailable for575 reads, explicitly retained; target renderer/GPU-main observations are distinguished.

The existing Node CDP parser represents trace numeric identifiers as doubles. Large surface/display IDs exceed Number.MAX_SAFE_INTEGER and may be rounded; they are not treated as exact per-frame identity. Small flow IDs and native RAF request IDs are retained. This is a diagnostic limitation, not a proposed ordinary-test threshold change.

Unproven: direct GPU-wait→RAF causal dependence; the mechanism of the old ordinary five intervals; Task④ production regression; relative contributions of software rendering, driver/compositor synchronization, host scheduling, and instrumentation. Baseline also stalls. No resize-only, snapshot-only, geometry-only, or physical-driver cause is asserted. The prior canvas height synchronization evidence remains separate.

## Cause-backed changes and FIELD

The only change from0036 to PR351 bce74c85 is `tests/material-progression-browser.test.mjs` (18 additions/6 deletions), copied exactly from1378aa30; the one-off regression workflow is omitted. No diagnostic observer is integrated into PR351.

Initial launch and reload both wait for PARTIAL or running FIELD; expose/hit-check the intended confirmation; send one trusted native press/release; observe the click after production's listener and assert target/button0/trusted plus synchronous PARTIAL hidden; then require Supply closed and running visible FIELD. No fixed100ms sleep, synthetic click or click retry. Smooth scrolling is not asserted as the old failure cause. Earlier regression39353360567 desktop/mobile evidence is preserved separately from new ordinary CI.

Independent code review found initialization/stop failure paths that could skip evidence保存, plus wchan/comm read brackets ending too early. All were fixed **before** the single campaign. The independent final analysis recomputed every raw RAF interval in all ten trials, checked identities/clocks and found no remaining major finding. It supports D Indeterminate and the stated limitations; it ran no additional browser campaign.

The completed independent review covers diagnostic code, all ten raw trial analyses and the FIELD diff. An optional post-CI final-report follow-up review did not execute because that reviewer reached its usage limit; final CI/report reconciliation was performed by the primary agent. It is not represented as an additional independent review.

## Geometry and ordinary acceptance

Runtime and geometry fixtures are byte-identical to0036. Local geometry/release tests17/17 PASS; no fallback/chemical graph/origin/sample-identity semantics changed. Existing all25 accepted XYZ/geometry, PAN/NBR nitrile and PF actual two-ring/H-origin provenance remain protected. Local repository hygiene and353 PWA assets pass. Ordinary CI is a separate complete run on exact HEADbce74c85, triggered once by the demonstrated FIELD test defect repair; no favorable performance rerun is selected.

| Ordinary workflow on exact HEADbce74c85 | Result |
|---|---|
| Repository39360743636, all8 jobs | PASS |
| Finite39360743634, both jobs | PASS |
| FIELD Insight39360743535 | PASS |
| All25 geometry / graph fixture regression | 25/25 PASS; fallback0; severe overlaps0 |
| Mobile/desktop13-route pointer QA; geometry-failure handling | PASS |
| Initial/reloaded FIELD native confirmation, both viewports | Four trusted/correctTarget/button0/partialHidden=true boundaries; PASS |
| Save/Collection/Engineering/re-FEED/disposal/offline/PWA | PASS |

Finite ordinary comparison retained all40 profiles (normal/reduced × mobile/desktop × baseline/candidate × warm-up+four measured), including all raw RAF intervals. The following statistics use the four measured trials per condition under the unchanged comparator:

| Condition | >25ms counts B/C | Max frame ms B/C | Completion P95 ms B/C | Result |
|---|---:|---:|---:|---|
| 390px normal | 0 / 0 | 16.8 / 16.8 | 659.0 / 663.3 | PASS |
| 390px reduced | 0 / 0 | 16.8 / 16.8 | 259.4 / 264.6 | PASS |
| 1280px normal | 23 / 21 | 116.8 / 116.6 | 772.5 / 697.2 | PASS |
| 1280px reduced | 9 / 8 | 116.7 / 116.6 | 316.2 / 319.2 | PASS |

The ordinary Finite browser was Chrome155.0.8059.84 / revision@5869fe313571d75152b77813cf0a4ee26a4e6df0, identical across its baseline/candidate pair. It differs from the separately instrumented diagnostic Chrome155.0.8059.39. The ordinary workflow used the existing ubuntu-latest job; no favorable runner/browser selection or retry was performed. These are distinct measurements, not matched instrumented/uninstrumented negative controls.

Dedicated StageB strict comparison: baseline trialP95[8.0,10.9,7.6,8.4]ms / pooled8.6ms; candidate[8.0,7.5,8.0,8.0]ms / pooled7.9ms. Its unchanged candidate hard gates and relative comparator PASS. Baseline absolute exceedances are retained. Independent Repository control: baseline[7.0,7.7,6.7,6.6]ms / pooled6.9ms; candidate[6.5,6.7,6.6,6.8]ms / pooled6.6ms; PASS. These separate jobs are not pooled. StageB fixed step/workload, real RAF, feedback650/250ms and all acceptance thresholds are unchanged.

**All current ordinary CI passes, yet closure remains BLOCKED under the user's explicit D branch.** The only PR synchronization repairs a demonstrated FIELD test defect; Finite production is unchanged. The new PASS does not causally repair/explain the old required FAIL, and choosing it as replacement proof would overstate the bounded experiment. No further unchanged-source performance retry was made. No new current CI failure is asserted. Merge/post-merge are not performed because the required root-cause discrimination remains indeterminate, not because a present CI job failed.


The old failed ordinary runs, earlier StageB/Finite failures, all40 prior diagnostic profiles and ten old normal windows remain authoritative historical evidence. There is no blanket performance PASS claim.

## Evidence retention and next boundary

Prior14 binary parts were reconstructed and each part/full gzip SHA256 verified: a34dc297c6ae96d6d7c01e73412401d3633d7e4cf5034cef80b86aa9895e79bd. Prior all40 profiles/full observations/authority were also checksum-verified. New original artifact12236574307 was independently downloaded and ZIP SHA256-verified01c4d270d341e688b90b280544eff52c517aa9672330157cfb60896e66d3a659.

`gpu-os-manifest.json` records binary-part order/hashes for all ten completion trace windows, all proc rows/observations/catalogues/profiles/authority/host records, exact decoded diagnostic log, analysis script and derived analysis. Every uploaded binary part's Git blob hash was checked against local bytes. Windows use a fixed sample-minus100ms through max(target,completion)+150ms boundary, retain every trial including warm-ups and all intersecting events/metadata, and are never chosen by pass/fail. Original noncompletion trace traffic/PNGs remain in the30-day Actions artifact; durable scope is explicitly narrower. Full ordinary Finite/StageB/Repository-guardrail/FIELD critical-job logs, all Finite artifact JSONs, comparisons and final workflow/job states are added to the final evidence authority. Auxiliary job states and original artifact references are retained; their full logs/screenshots are not copied into the durable bundle.

Minimum next observation: connect the GPU-main futex caller/wait target and software-worker completion/wakeup to compositor queue completion, with scheduler-switch/user-space-stack authority and sufficiently low/metered observation overhead. Capture a failure under the unchanged ordinary acceptance conditions. Only a new explicitly bounded discriminating protocol can authorize another diagnostic; this campaign is exhausted. Do not silently rerun unchanged source, change runners for favorable timing, relax thresholds, alter fixed-step/workload/650–250ms, or use synthetic RAF.

No merge or post-merge verification is claimed. Task⑤ must keep the existing geometry API `createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId})` and evidence at0036; Task④ is not closed by this report.
