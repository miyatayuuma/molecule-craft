# Task④ release guardrail recovery

Authority: PR #351, `feat/polymer-local-fragment-task4`. Recovery start main is `37b7d2cde1e60cd28575784a252382f4599c391f`; prior HEAD is `adcea5693163829cc0ffe5904badd1387897e17d`. PR #345 remains open and is not changed or merged by this work. Final acceptance status and exact tested/merged SHAs are recorded in the PR recovery acceptance comment; this pre-acceptance document does not claim a merge.

## Frozen experiment and root cause

One diagnostic synchronization was budgeted, followed by one cause-backed repair/ordinary acceptance synchronization. No outcome-based rerun, baseline change, gate relaxation, workload change or synthetic frame is authorized. Local Chromium cannot start because the execution environment rejects its Unix socket (`EPERM`); local browser PASS is not claimed.

Diagnostic source `524982c68affe5e5a04753d759628a780f073feb` retains the original asynchronous `<1e-12` assertion. It adds an armed localhost observer only around the water release handler, never in a physics or RAF step. Run `39249295469`, job `118048847547` supplies [the full frozen record](polymer-local-fragment-task4-evidence/release-frozen-diagnostic.json).

| Observation | Fixed steps | Body | Velocity norm (Å/ps) |
| --- | ---: | --- | ---: |
| Trusted pointerup received | 204 | water-1 | 0 |
| After final manipulation update | 204 | water-1 | 0 |
| Immediately after synchronous reset | 204 | water-1 | 0 |
| After endManipulation / pointer cleanup | 204 | water-1 | 0 |
| Original asynchronous assertion snapshot | 204 | water-1 | 0 |
| Next independent snapshot | 206 | water-1 | 8.743996682324036e-10 |
| Explicit eight additional production steps | 214 | water-1 | 4.242627435971848e-9 |

Case B is demonstrated: the same real pointer and body are released, reset XYZ is exactly `[0,0,0]`, selected/down state and active pointers clear, and normal time resumes. No physics step occurs within the synchronous boundary. A later valid snapshot can already have a finite nonzero velocity from ordinary forces. Distant waters are not force-free. The original assertion therefore tests a scheduling-dependent later state rather than the zero-throw release contract. The exact number of steps in the older failing run `39199007958` remains unknown because its frozen log did not record them; this experiment does not invent that history.

A deterministic test additionally starts the owned body with nonzero velocity and runs the actual production handlers. It proves the reset is effective rather than merely observing a body that was already stationary. In the same four-water geometry, actual Stage B steps then produce nonzero finite velocity from a zero release state. The diagnostic pair decomposition alone is only one pair; the final shared browser test sums all snapshot pair forces when checking the next physical step.

## Minimal repair and protected contracts

The final production source removes the temporary diagnostic observer entirely. Relative to adcea, its only runtime change connects window `blur` to existing `cancelAllPointers()` followed by `updateCommandBar()`.

The separate blur defect was reproduced with actual production handler/event-registration code on an EventTarget: without a blur registration, selected/down/pointer ownership remains active when pointerup is absent. The original failure is retained in `release-blur-before.txt.gz` (raw SHA256 `204a26fedf7e1a462ffdc13b88f75541143cbe2527a9268eebf0f614c2c69af5`). Independent review caught the need to restore the disabled UI as well as pointer state; both are now asserted. The listener uses the existing abort signal for disposal.

The common water test now registers one-shot bubble listeners on the same canvas after production initialization. Both immutable baseline and candidate are required to deliver trusted down/up events for the same pointer and instance. The after-handler snapshot is taken within the release dispatch; XYZ must equal `[0,0,0]` exactly. Listener exceptions and missing/unexpected events fail explicitly, without an asynchronous fallback. Capture/selected/down/time mode cleanup is checked independently.

The later CDP snapshot records browser time, node command-completion time, fixed-step difference, simulation-clock difference, velocity and finite state. It is not required to remain stationary. A single evaluation advances one production step and seven further steps; the first velocity is checked against the sum of all canonical pair forces, body mass, timestep and damping law. The exact release-zero assertion has no tolerance relaxation. Native CDP touchCancel and Escape/close/reopen cover event wiring and identity preservation.

The new blur browser test is an independent candidate-required fixture, so the historical performance baseline is not assigned a new feature contract. Acquisition and movement use native CDP pointer input; window blur is an explicitly dispatched DOM lifecycle event, not an OS focus-change test. It asserts synchronous zero velocity, capture/pointer cleanup, normal time, preserved IDs, and FEED/slot/LIGHT/HEAT/pH control recovery.

No Stage B integrator, matcher, profile, comparator, fixed baseline SHA, 650/250ms feedback contract, geometry algorithm, chemistry graph, origin, save schema or renderer lifecycle has been changed. No per-frame layout or diagnostic work is added.

## Geometry and evidence preservation

The requested geometry tests pass 12/12. The 25-route validator and 75 analytical projections were executed once. Both complete generated files are byte-identical to the prior committed evidence: graph/origin/identity, XYZ, semantic targets and all quality metrics are unchanged. See [regression hashes and results](polymer-local-fragment-task4-evidence/release-geometry-regression.json).

- All 25 accepted; severe overlaps 0.
- Max bond residual `0.006146543008233696` world.
- Max angle residual `6.468591961469741°`.
- Max plane deviation `0.06486308344375737` world.

The reproduction entrypoint also emits its built-in two-warm-up/four-measurement commit-time timings. These are retained in `release-geometry-generation-performance.json`; they are not a new per-frame performance claim and are not directly comparable to the older 100-solves/build campaign. The older geometry solve P95 tail increase remains part of Task④ history.

Two historical log text views contained trailing whitespace that failed Repository validation. Exact original bytes are retained in deterministic gzip archives; only the text views were normalized. `release-log-preservation.json` records both raw and archive SHA256 values. Original failures remain failures.

## Validation history — distinct sources and gates

The prior `0f3e51de` source had dedicated Stage B/Finite PASS but Repository release FAIL; its candidate Repository Stage B measurement was not executed. The unchanged-runtime adcea automatic result is separate: Repository Stage B passed, whitespace failed, and Finite mobile-normal maximum frame failed (50ms against 49.5ms allowed). Its full comparison is retained in `release-prior-head-finite-comparison.json`.

The diagnostic synchronization is not acceptance:

- Repository release observation succeeded; the job subsequently failed the unchanged Stage B per-trial gate: `[8.6,8.1,7.8,7.8]ms`, pooled `8.0ms`. Raw trials: `release-diagnostic-repository-performance.json`.
- Dedicated Stage B failed its absolute gate: candidate `[7.9,7.6,9.2,9.7]ms`, pooled `8.4ms`. Baseline `[7.9,12.9,8.5,8.3]ms`, pooled `11.5ms`. Relative checks passed, but do not waive the absolute failures. Full raw intervals: `release-diagnostic-stage-b-comparison.json`.
- Finite mobile actual-pointer QA passed. Desktop Nylon66 completion recorded one frame / zero intervals, so its sampler assertion failed. Downstream integrated/performance gates did not execute. Exact error and artifact identity: `release-diagnostic-finite-failure.json`.
- These timing/sample failures are retained without claiming a proven host-noise cause or a proven Task④ geometry regression.

Final source acceptance must independently run Repository, FIELD, Finite and Stage B under ordinary conditions. A failed required gate retains BLOCKED status; no separate PASS substitutes for it. No unchanged-source retry follows this campaign.

## Review and Task⑤ handoff

Independent review checked release/post-physics separation, strict assertion strength, instance/pointer ownership, no hidden skip/fallback, legacy baseline API compatibility, blur controls, source scope, geometry preservation and unchanged performance contracts. The UI recovery finding was fixed and reviewed. Review scope and exact file hashes are retained in `release-independent-review.json`. CI/native browser execution is not claimed by static review.

Geometry API remains `createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId})` with the existing semantic resolver and validated finite fallback. The Task①–③ authorities and Task④ geometry document remain canonical. Task⑤ can adopt only the eventual merged main SHA after required gates pass; until then there is no merged Task④ authority or post-merge PASS.
