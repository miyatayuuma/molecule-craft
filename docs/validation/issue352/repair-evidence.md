# Issue #352 — measured matcher cost and minimal repair

The immutable failed run39454378232 is retained; it is never reclassified PASS.
Authority and all frozen durations: [forensic audit](forensic-audit.md),
[raw distributions](frozen-distributions.json). Independent review:
[frozen evidence](independent-forensic-review.md).

## Bounded diagnostics and limits

Run39517457453 / artifact12308481455 retained both controls. ZIP SHA256
`ddf933691c0185d56dd3cd206a74e82e2600d8658dbcdda1954d0d84a4b033e4`.
Baseline trial P95:5.8/6.7/8.8/5.7ms; main5.9/5.7/5.6/5.8ms.
These are diagnostic observations, not acceptance or replacement of the old FAIL.
The instrumented baseline never initialized: an insertion pattern matched twice.
Only the two missing instrumented profiles followed, in run39517735362 /
artifact12308651641, ZIP SHA256
`c1e59dc11215f461c4cd486bb799b6be89843048c55b4686b76d05419b407c83`.
All raw intervals and relevant entry/exit body/state are retained in
`control-results.json.gz` and `instrumented-results.json.gz`; complete instrumented
CPU profiles and Chrome traces reconstruct from `diagnostic-traces-manifest.json`.

The diagnostic tool is `scripts/diagnose-issue352-fixed-step.mjs`. The historical
run versions and one-shot workflow remain in Git history33c3fb93/eab37655; no
automatic diagnostic workflow is installed by the final repair. The final tool
also corrects its collection boundary, without executing another profile.

New diagnostic Chrome155.0.8059.84 differs from frozen failure Chrome155.0.8059.39;
these are not same-browser reruns of the old failed comparison. Baseline and main
within each diagnostic use the same reported browser.

Important limits: controls/instrumentation used different runners after the
harness correction; a causal <5% instrumentation-overhead estimate is unavailable.
The historical instrumented version enabled counters across asynchronous fixture
setup and result reads. Recorded indices209–224 exceed180 because RAF steps were
also observed. The typed arrays preserve their first180 entries, including RAF
and a partial synchronous sequence. Their rows cannot be relabelled as the150
strict retained steps. Counters divided by recorded steps are nevertheless exactly
19,968 coordinate transformations and9,216 canonical atom-pair evaluations for
every row; captured candidate counts are384 and flags are0. All recorded rows
are retained. No follow-up experiment was used to improve these results.

## Cause actually demonstrated

Section samples for both sources place about98% of observed fixed-step wall time
in reaction matching, about0.08–0.09ms in physics, about0.02ms in synchronization,
and effectively no polymer work. CPU samples independently show `assess`,
`updateWorldMatrix`, `multiplyMatrices` and `atomWorldAngstrom` as leading costs.
The same atoms are repeatedly transformed and the same participant-pair atom
distances evaluated for multiple labelled pathways, although no pose changes
during assessment. This unnecessary work exists in production, not just a probe.

Instrumented main trial4 also exceeds the budget (P95≈8.8ms). Its long synchronous
task records1198.216ms wall and1187.497ms thread CPU (99.1%);41 scavenges total
47.725ms, maximum2.18ms. Earlier three main measured tasks have38.5–41.1ms
scavenges and virtually no compile work. This reproduces a CPU-dominated slowdown
under instrumentation; OS main-thread descheduling is not its dominant total
cost. GC contributes, but does not by itself explain the entire CPU-time rise.
It is not a precise attribution of the old frozen clusters, which have no CPU,
GC or scheduler timestamps. No GPU/presentation mechanism is inferred.

Confidence: **high** that repeated read-only matcher geometry is the dominant
removable hotpath cost; **unresolved** which runtime/host event caused each old
cluster. The repair removes this demonstrated cost and allocation pressure rather
than asserting a false GC/OS root cause or changing the measurement contract.

## Production repair and semantic protection

Only generic `reactionStep()` gains lazy caches keyed by item identity/atom index
and ordered participant-pair identity. They exist for one invocation, before the
final commit. All29 rules,384 fixture candidates, supplemental choices, per-pathway
geometry constraints, complete diagnostics, dwell, arbitration and commit remain.
Physics, profiler, threshold, baseline, warmup, four trials and all slow values
are unchanged. No cache crosses physics/pointer/commit boundaries.

The independent oracle test reads uncached main6c676317 directly from Git history
and compares full outputs against the repaired production function over all29
rules, moving/oriented next steps, busy/isolation, supplemental roles, overlap
and geometry boundaries, environment/dwell and real arbitration/commit inputs.
The384-candidate fixture drops from19,968→14 coordinate transforms and9,216→48
canonical atom-pair evaluations while retaining every output. A changed next step
recomputes them. This is genuine production reuse, not a reduced matcher workload.

All25 geometry, graph/bond/origin/sample identity and fallback implementation
files are unchanged. No chemistry catalog, save schema, pointer/release code,
FIELD confirmation, renderer/GPU code or PR345 changes. PWA is regenerated for
the single runtime source edit. Ordinary strict CI and post-merge verification
must still pass; this document alone does not close Task④.
