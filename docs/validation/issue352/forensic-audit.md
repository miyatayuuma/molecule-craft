# Issue #352 — frozen fixed-step audit and bounded experiment

Authority: main `6c676317ff590dd756685168484c79788b5a329b`, tree
`2e9bdad7345ae8437721d3a234368646868a4e5f`; evidence `d1ac3b6`.
Issue352 OPEN; PR351 MERGED; PR345 OPEN, untouched. No new performance run
preceded this audit. `frozen-distributions.json` retains every duration from nine
saved files (ten profiles), including warmups, with original file SHA256.

## Measurement and workload

`scripts/profile-reaction-lab-stage-b.mjs` runs 180 synchronous integrations per
profile, discards the first 30, retains 150, first as warmup then four trials.
The excluded 30 steps exist in every call; the initial warmup also contains 180
steps. Each trial restores Feed orientations, zero velocities, matcher state,
and the original simulation clock, positioning six bodies at 25 Å spacing.
`measureFixedSteps` executes inside one synchronous Runtime.evaluate; RAF cannot
interleave it. `frameIntervalsMs` is a historical name for durations, not RAF.

The timer starts before active-body selection, then includes physics integration,
body-to-Three synchronization, polymer runtime and full reactionStep. It ends
after reactionStep. Simulation-clock increment and pushing each duration are
outside the timer. Both wall-clock pauses and JS execution count. No render,
SwapBuffers, completion animation or asynchronous GPU presentation is directly
invoked within this boundary. Earlier GPU/futex evidence cannot attribute it.

Every saved row reports 384 final candidates and the same methane-combustion
reaction ID. This count is last-step evidence, **not per-step verification**.
Profiler, Stage B physics, core matcher, integrateStageAStep and measureFixedSteps
are identical between immutable 4bc202c0 and main. Task④'s extra polymer guard
is unreachable: this fixture has no polymer route. No code branch selects steps
51/97/121 or trial3; no periodic state transition explains those indices.
Saved profiles do not contain per-step reaction state, CPU time, GC or scheduler
counters, so identical counts alone do not prove identical runtime state.
Reset and measurement use separate CDP evaluations, allowing RAF between them;
the diagnostic captures entry/exit state in the same synchronous measure call.

## Frozen observations

Indices here are zero-based retained-step indices (add30 for integration index).
Candidate trial1: isolated9,40 plus runs51–53,97–100,121–123 (12 slow steps).
Baseline trial3: 31 slow steps, concentrated around11–40, plus isolated steps.
Candidate P95 10/7.7/7.9/7.9; baseline7.5/7.2/11/8.1. Pooled8.1/8.8.
Earlier first CI has late clusters in both profiles; other saved runs have
isolated tails, with medians ranging3.3–7.4ms despite identical Chrome revision.
This is evidence of variable execution conditions, not proof of host causality.
Chrome155.0.8059.39 @3ff7ac5a…; Node22.23.3; failed runner Ubuntu24.04.5,
image20261012.334.1, hosted agent2.337.0, Azure westcentralus. Hardware/CPU
frequency and V8 internal state are not preserved in the original profile.

## Falsifiable hypotheses

| Hypothesis | Existing evidence / limitation | Falsifier / minimal additional observation | Cause-backed repair if verified |
|---|---|---|---|
| A physics work | Physics source unchanged; repeated six-body fixture | Section durations and CPU stacks show physics not dominant | Remove proven redundant physics work, preserve forces |
| B matcher/state | 384 candidates; repeated atom transforms and all-atom pair scans for each pathway; no indexed transition | Section timers, candidate/state counters and CPU samples; fast matcher or actual state transition would refute constant-work explanation | Step-local reuse of identical geometry, retain every candidate/rule/diagnostic |
| C JIT/GC | Allocation-heavy matcher; raw wall time cannot identify GC | V8 GC/compile trace and CPU samples aligned with slow steps | Remove demonstrated excess allocation; never drop slow measurements |
| D scheduling | Both sources vary across runs and show clusters | Trace task wall vs thread CPU; cannot infer OS wait merely from missing samples | Environment intervention only if independently demonstrated |
| E timer/profiler | Same synchronous performance.now boundary, ordinary0.1ms quantization | Section total consistency, instrumentation controls | Repair only demonstrated boundary defect, preserve target |
| F other | No direct evidence | Trace/counters reveal another task or mechanism | Only the identified cause |

## Precommitted diagnostic budget

One diagnostic workflow, one runner, no runner selection, four browser profiles
in fixed order: frozen baseline control, frozen main control, baseline instrumented,
main instrumented. Each uses the unchanged fixture, warmup and four150-step
trials (180 including30 discarded steps). No ordinary CI or strict acceptance
retry. Instrumentation is injected by a diagnostic-only server transformation;
served production files are read-only, exact source SHAs retained.

Instrumented profiles collect fixed-size section arrays, counters, before/after
state snapshots outside timed steps,1ms CPU samples and V8/renderer task trace.
No console logging or PerformanceObserver in steps. Overhead target <5% median
versus same-source control; if exceeded, timing is diagnostic-only and cannot
prove absolute production cost. Trace task tdur can distinguish trial-wide CPU
from non-CPU time; it may not resolve every individual slow step. Failure to
reproduce is reported, never repaired by another identical acceptance run.

All four profiles and traces are retained, irrespective of outcome. Diagnostics
do not satisfy the strict gate. Production changes require evidence of a specific
removable cost and semantic equivalence tests, followed by ordinary acceptance.

Diagnostic run39517457453 retained both controls; instrumentation failed before
collecting any profile because `const started=performance.now();` occurred twice.
The bounded remainder uses the unique following `stageAForces` boundary and
validates transformation before browser launch. Only the two missing instrumented
profiles run; controls are not repeated. This splits the original same-runner
control/instrument comparison across runners, so a causal overhead estimate is
unavailable. Instrumented times cannot establish strict production performance.
