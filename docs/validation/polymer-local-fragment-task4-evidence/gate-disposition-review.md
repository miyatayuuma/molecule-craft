# Task④ final gate disposition — independent evidence review

## Superseded a6 finite performance failure

Independently read retained comparison and Desktop raw performance files under `/tmp/task4-ci-evidence/finite-second/_temp/polymer-performance/`.

Candidate `a6dafe8b65191983ae9e5967c00d18350a16db12`, immutable baseline `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`: Desktop reduced-motion maximum RAF interval133.3ms exceeds the existing116.9ms allowance (baseline maximum100.1ms plus16.8ms). The raw sample count is12 intervals per build, three per measured trial. Candidate trial2 values are16.7/83.3/133.3ms. Median-of-trial P95≈108.35ms versus baseline≈100.05ms passes its own16.8ms tolerance; P50 and completion P95 also pass. Those passes do not cancel the independent maximum check. The retained comparison is correctly **FAIL**.

The133.3ms interval is the last interval in trial2, extending into the deliberately included post-ready tail frame. It straddles the presentation event rather than being entirely before readiness. This is covered intentionally by the unchanged gate; excluding it would change acceptance after observing failure.

Candidate layout generation deltas3.5/4.5/3.0/3.9ms are per-trial cumulative solve costs; retained metrics report fallback0 and no completion layout after ready. The synchronous geometry solve precedes the Sample event that starts completion-frame collection. Therefore the evidence does not identify direct layout CPU duration as the133.3ms delay. It also does not isolate GPU/resize synchronization, scheduling, GC, observer/serialization work or other causes. Small sample count and the broadly coarse Desktop frame cadence limit causal precision; neither “noise” nor a known existing GPU cause is established.

No new measurement, retry, threshold change or code change was performed by this review.

## Latest-source acceptance

The parent reports final gesture-source `0f3e51...` Stage B PASS and an in-progress finite run. Those latest results were not included in the supplied raw files and are not independently certified here. The earlier Stage B and a6 finite failures remain evidence tied to their measured source SHAs.

The latest source contains a required, independently reviewed error-gesture fix. Running its ordinary required CI is legitimate source validation; it must not be described as proving that the gesture fix repaired performance. Evaluate the entire one-run result for that exact source, without selecting individual favorable trials or silently replacing failed history.

While latest finite or required FIELD execution is pending, merge/CLOSED remains withheld. If latest finite passes, record it as a pass of that actual run/source while retaining the older FAIL and unknown cause. If latest finite fails, remain BLOCKED: the smallest justified next step is a bounded investigation of the particular failed metric, source and execution window before a cause-backed fix—not an unchanged-source performance rerun or threshold adjustment.

## FIELD startup disposition

The parent reports FIELD failure at the160×100ms DevTools-readiness assertion before Page.navigate, plus one job-only rerun as infrastructure diagnosis. I independently inspected `tests/field-insight-discovery-browser.test.mjs`: the DevTools endpoint assertion precedes WebSocket setup, Runtime/Page enable and navigation to the application. Thus, if the retained log is at that assertion as reported, the application/FIELD assertions were **NOT EXECUTED** in that failed invocation. Classify it as browser-startup/tooling failure, not a demonstrated FIELD functional regression; the underlying Chromium-startup cause is still unknown. The full hosted log was not supplied as a local file to this reviewer, so its exact contents remain owner-reported.

A single narrowly scoped infrastructure rerun is distinct from retrying a failed performance result. It does not by itself satisfy FIELD acceptance. Required resume conditions are: inspect its actual same-source outcome; confirm DevTools becomes ready, navigation/application initialization occur, and all real FIELD assertions complete successfully. Preserve both invocation IDs/results. If it again fails before navigation, mark FIELD NOT_VERIFIED/BLOCKED and investigate Chromium startup evidence; do not waive it or claim product PASS. No further retry is recommended by this review.

## Concrete completion evidence still needed

1. Completed latest-source finite result with all four viewport/motion cells, raw intervals and unchanged comparator; record exact source and runtime/tree authority.
2. Actual successful latest-source FIELD functional execution, or an explicit unresolved startup blocker.
3. Required Stage B/source correspondence and all other mandatory CI results reconciled to the PR head before merge.
4. After successful gates only, actual merged main SHA and post-merge evidence. Pending or failing required gates do not meet Task④ CLOSED.

## Latest required guardrail failure — generic release momentum

The parent reports latest exact-source0f3e51 repository run39199007958/job117887858346 failing `tests/reaction-lab-browser.test.mjs:280`, “Release removes linear throw momentum,” before candidate Stage B profiling starts. Baseline control reportedly completed trial P95[7.8,8.0,7.6,7.7]ms, pooled7.8ms; the candidate measurement for this invocation is **NOT EXECUTED**, not PASS or a performance FAIL. The reported earlier separate Stage B PASS cannot replace this mandatory functional guardrail. Other seven job passes likewise do not turn the required guardrail into a pass. Preserve both run-level and source-level outcomes.

Independent source-only audit: the failed fixture feeds four water molecules, then uses setGeometry to place the first near origin and the others far away, applies an actual CDP five-move mouse drag with18ms delays, releases, and obtains a snapshot in a subsequent CDP request. It asserts the selected body's velocity norm<1e−12. This is a non-polymer scene; the actual water slot set has no exact polymer route. Task④ changes neither endPointer/endManipulation bodies, the manipulation module, Stage B integrator nor this generic test. New pointer guards/predicate evaluate false for absent polymer visual/presentation, so their specialized branches do not apply to this fixture.

The unchanged endPointer performs the final manipulation update, then endManipulation synchronously copies group pose to the body, writes velocity=[0,0,0], clears selection/down and restores normal time. Subsequent fixed steps may legitimately change a released body's velocity through physics. Because mouseReleased and snapshot are separate requests, one or more real RAF/fixed steps can occur between the reset and observation. This establishes a plausible timing/force hypothesis, not the cause of the observed failure. The retained report provides only actual:false: velocity magnitude/components, finiteness, release identity and number of intervening steps are unknown. It cannot distinguish a tiny residual, natural acceleration, a missed release/reset or nonfinite/body-state fault. Do not classify it as noise, a proven pre-existing issue or a demonstrated Task④ production regression.

### Concrete bounded resume condition

Task④ is **BLOCKED** while this required guardrail fails, regardless of the pending finite result. No rerun or production edit was performed or recommended as an immediate action by this review.

The smallest useful next investigation is a separately scoped, fixed-budget reproduction of this release fixture with retained failure evidence: exact source/browser/input IDs, event order, selected/down/active-pointer state, body velocity/components/finiteness immediately before and synchronously after release reset, fixed-step counter/simulation clock at release and at the assertion snapshot, and forces/velocity updates if a step intervened. Observe release state atomically rather than adding arbitrary sleeps or widening the tolerance. A test-only observer can capture the pointerup boundary; keep instrumentation out of performance acceptance.

Only after that evidence identifies the mechanism should a change be chosen. If reset is missed or velocity survives the actual release boundary, repair the demonstrated production path. If reset is exactly zero and later physics changes velocity, explicitly separate the release-boundary invariant from post-release dynamics in the test while retaining meaningful checks for both; do not simply weaken the existing numerical requirement to obtain PASS. Then run the necessary targeted regression and the normal required gate on the repaired exact source. An unchanged-source favorable rerun would not resolve this causal gap.

The parent reports same-source FIELD infrastructure rerun117890148182 SUCCESS, so its actual completed result can satisfy FIELD once retained and source-matched. This does not affect the independent release guardrail failure. Final finite profiling is still pending as of this addendum; retain its eventual actual result separately. No main merge/CLOSED is justified with the guardrail unresolved.

## Final published evidence spot-check

Independently read the newly retained `ci-final-stage-b-{baseline,candidate,comparison}.json`, `ci-final-field-{startup-failure,retry-pass}.txt`, `ci-final-guardrails-failure.txt` and final Task④ geometry authority. No tests or experiments were run.

- Stage B raw candidate explicitly names `0f3e51de1a6e05770a74e008cbda9e0303fabf4d`; baseline is `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`. Browser/revision and six-body/29-rule/384-candidate workload agree. Baseline trial P95=3.9/4.1/4.0/4.2ms, pooled4.1ms; candidate5.5/4.2/4.1/3.9ms, pooled4.3ms. Budget8.333333ms, tolerance0.3ms and all four checks PASS match the authority document.
- FIELD startup log is an actual line24 DevTools endpoint timeout. The retry log explicitly records persistent Seed/balance regression, Chromium desktop/mobile interaction and hygiene PASS. Same-source binding is supplied by the referenced GitHub run/job authority; the excerpt itself does not contain a source SHA and should not be presented as standalone SHA provenance.
- The actual guardrail excerpt confirms baseline control pooled7.8ms PASS, followed by candidate generic browser line280 release-momentum assertion actual:false and exit1. No velocity/counter data appear. The authority correctly retains this as an unresolved required failure, without substituting the separate dedicated Stage B success.
- Local commit d5b8451b284b1e2e0a1df0e6ee033f1dd2451367 has tree7851c23621810ee818ae55614fe7e9e7702a72d3, matching the documented measured tree. The0f commit object is not present in this local clone; exact0f SHA is independently visible in retained Stage B source fields, while its tree binding remains GitHub authority supplied by the owner.

Final evidence-writing verdict: **Approve the reviewed BLOCKED disposition and handoff.** No mandatory correction found in the reviewed claims. No merged SHA/post-merge verification is invented, failure history is preserved, scientific/renderer limits remain explicit, and the next release-boundary investigation is narrow and cause-seeking. Latest-source Finite outcome must still be appended with exact run/source/results when complete; regardless of that outcome the unresolved required release guardrail prevents Task④ CLOSED.
