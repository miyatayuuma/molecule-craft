# Issue #352 — independent frozen fixed-step review

Reviewer: independent review agent, 2026-10-21 JST. This is a separate agent's source/evidence review, not a GitHub account approval. No new browser/performance trial and no production edit was made for this review.

## Authority and reproducibility

- Production authority: `6c676317ff590dd756685168484c79788b5a329b` (tree `2e9bdad7345ae8437721d3a234368646868a4e5f`).
- Immutable comparison baseline: `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`.
- Frozen post-merge evidence: commit `d1ac3b6fd07c29ec33cda998439e6b50e857672e`, run `39454378232`, Stage B job `118737239196`.
- Independently checked `frozen-distributions.json` against every cited source blob's SHA256 and original profile values. Ten profiles contain 50 warm-up/trial rows and 7,500 retained durations. Every row has 150 durations, nearest-rank P95 at sorted index 142, and final candidate count 384.

## Measurement boundary

`scripts/profile-reaction-lab-stage-b.mjs` calls `measureFixedSteps(180)`, then discards its first 30 durations. It runs one such warm-up call and four measured calls: 150 retained warm-up durations plus 4 × 150 retained measured durations. The same fixture is reset before each call. The first 30 steps of each call are also executed; they are not part of the saved 150.

`measureFixedSteps()` invokes `integrateStageAStep()` synchronously. Its saved `lastFixedStepDurationMs` is `performance.now()` at the end of that function minus `fixedStepStarted` at its beginning. It includes active-body selection, physics integration, body-to-Three group synchronization, polymer runtime, and generic reaction assessment. It excludes the caller's simulation-clock increment, duration-array append, CDP serialization, the RAF callback's other work, and `renderer.render()`.

The saved name `frameIntervalsMs` is misleading if read without its producer: these are fixed-step wall-clock durations, not RAF or GPU presentation intervals. OS descheduling or V8 interruption during the function can extend the wall-clock result. The saved number is not thread CPU time. Old SwapBuffers/futex observations cannot establish the cause of this failure.

`git diff 4bc202c0 6c676317` shows no changes to the profiler, Stage A/B physics modules, generic core matcher, `integrateStageAStep()`, `measureFixedSteps()`, or generic `reactionStep()` body. The added polymer error check is unreachable after the early return for a non-polymer fixture. This excludes a newly edited implementation in those specific functions; it does not exclude indirect effects or pre-existing redundant work.

## What the frozen durations do and do not establish

Indices below are zero-based within the retained 150, after the 30 discarded steps.

- Candidate trial 1: P95 10.0 ms; 12 steps exceed 8.333333333333334 ms, at 9, 40, 51–53, 97–100, and 121–123.
- Baseline trial 3: P95 11.0 ms; 31 exceedances, concentrated near 11–40, with additional isolated exceedances. Its failure grants the candidate no exemption.
- The same source's other trials have different slow positions. Historical evidence includes broad slow clusters in both baseline and candidate and also much faster profiles under the same reported Chrome revision. Thus a fixed index is not itself evidence of a chemistry transition.
- All retained rows report final count 384 and final reaction ID `complete-28-methane-combustion`. These fields are returned from the last fixed step only. The frozen raw profiles do not contain per-step candidate counts, poses, reaction states, CPU time, GC or JIT events.
- Accordingly, the frozen profiles alone cannot prove that every slow step had the same internal state, nor identify JavaScript CPU execution versus a runtime or OS interruption. There is no direct proof of a Task④-specific geometry regression.

The fixture starts six molecules of methane/oxygen/2-butene, spaced by 25 Å, with captured feed orientations and cleared velocities. However, `setGeometry()`, `setSimulationClock()`, and `measureFixedSteps()` are separate awaited CDP evaluations. RAF can run between these evaluations. Therefore exact per-trial initial body-state equality is not established merely by resetting the same poses and clock. This is a measurement limitation to inspect, not proof of the observed failure or grounds to silently change the accepted method.

## Falsifiable cause assessment

| Hypothesis | Existing support / limitation | Minimal discriminating evidence | Repair only if supported |
|---|---|---|---|
| A: physics computation | Physics is measured; implementation unchanged. No per-step physics durations saved. | Section times plus CPU samples; compare slow and ordinary steps without changing bodies. | Optimize a demonstrated redundant physics computation while preserving its numerical contract. |
| B: matcher/state cost | Full reaction assessment repeatedly transforms the same atoms and recomputes pair metrics. Frozen raw lacks per-step state. | Section times, bounded operation counts, pre/post fixture states and per-step state flags. | Step-local reuse of demonstrated identical read-only values; retain every candidate, diagnostic, dwell and arbitration. |
| C: V8 GC/JIT | Allocation-heavy candidate assessment is visible in source; clusters vary by trial. No GC/JIT trace proves causality. | Bounded V8 trace/CPU profile with timing alignment and explicit overhead accounting. | Reduce confirmed avoidable allocations or repair a demonstrated profiler/runtime defect, without changing warm-up. |
| D: OS scheduling | Wall-clock measurement includes interruption; cross-run medians vary substantially. No scheduler or thread-CPU record in frozen failure. | Identified renderer thread CPU and scheduler deltas or equivalent trace coverage of actual fixed-step work. | Environment treatment only with demonstrated dependence; no runner selection. |
| E: boundary/profiler | Correct CPU-work boundary but wall time, misleading field name, only last-step workload counters, and CDP reset interleaving. No arithmetic defect found. | Verify raw boundary and record initial/state equality plus overhead; do not replace strict measurements with diagnostics. | Correct a demonstrated defect while preserving accepted measured work and counts. |
| F: other | No specific additional cause proven. | Only a narrow probe motivated by new evidence. | No speculative production change. |

## Step-local cache semantic assessment

Within one generic `reactionStep()`, candidate assessment does not mutate molecule poses or records. The actual `commit()` occurs only after all candidates and contact bookkeeping are assessed. `scoreReactionGeometry()`, `supplementalSelectionCenter()` and bond-endpoint scoring read coordinate arrays rather than modifying them.

Therefore a lazy coordinate cache scoped to this invocation can reuse `atomWorldAngstrom(item,index)` results without crossing a physics, pointer or commit boundary. Likewise, minimum real-atom distance, minimum canonical nonbonded separation ratio and severe-overlap OR depend only on the two participant items' current atoms/poses/parameters, not on candidate bindings or reaction roles. Multiple candidate pathways can reuse that read-only pair result.

Safest constraints: key by item identity and atom index; use an ordered pair identity key unless symmetry is separately verified; allocate/reset the cache for each `reactionStep()`; keep lazy evaluation to preserve unused/invalid-path behavior; do not cache supplemental selection, eligibility, dwell, reaction candidates or commit decisions. Every 29-rule / 384-candidate assessment and complete diagnostic must still run. No cross-step memoization is justified here.

Before accepting such a repair, compare complete cached versus uncached diagnostic and state outputs over moving/oriented bodies, multiple participant roles, supplemental choice, overlap boundaries, dwell, reaction commit/arbitration and subsequent fixed steps. A static cache argument does not prove that redundant work caused the frozen timing clusters. A measured reduction of that work may be a justified hotpath repair, but its confidence must be stated separately from any unproven GC/OS explanation of the old failure.

## Independent determination

Frozen failure is valid and retained. **Task④ remains BLOCKED at this review boundary.** The evidence warrants one pre-budgeted diagnostic to distinguish section cost, runtime interruption, scheduling and fixture state, not ordinary-CI retries of unchanged source. No threshold, baseline, 29 rules, 384 candidates, warm-up, trial count, slow-step inclusion or GPU contract change is justified by this review.
