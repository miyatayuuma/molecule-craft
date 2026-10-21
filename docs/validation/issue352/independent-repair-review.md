# Issue #352 — independent minimal-repair review

Reviewer: independent agent, 2026-10-21 JST. This is an independent source/evidence assessment, not a GitHub account approval. The reviewer did not edit production or run new browser/performance trials. Reviewed viewer SHA256: `a4930261924a5a1cc29147c813ad6035e83787c9d9f1eb66befab03c57ec1121`.

## Result at this boundary

**No blocking correctness finding in the proposed step-local geometry repair.** Its cause-backed scope is confirmed redundant matcher geometry work. This review does not establish the exact GC/JIT/OS cause of the frozen post-merge slow clusters, does not replace ordinary strict acceptance, and does not declare Task④ CLOSED.

The repair creates two lazy caches inside each `reactionStep()` invocation: atom positions keyed by item identity and atom index, and participant-pair metrics keyed by ordered item identities. It uses the original `atomWorldAngstrom()` and canonical nonbonded evaluator on a miss. Neither cache survives this function call. It retains every candidate, rule, geometry constraint, supplemental selection, contact update, diagnostic, ready candidate and arbitration/commit decision. It adds no fixture/test condition to production.

All candidate assessments precede the final production `commit()`. During this interval the called geometry/core helpers do not mutate body or group poses. Cached coordinate arrays are consumed read-only. Pair metrics depend on the two items, their real atoms, poses and canonical parameters, not the candidate pathway. Grouping the same minimum/OR reductions per ordered pair preserves their meaning. Every later fixed step constructs new caches after physics/body synchronization; pointer and commit work cannot make a previous call's cached geometry stale.

## Independent deterministic oracle

`tests/reaction-lab-step-geometry-cache.test.mjs` directly extracts the uncached `reactionStep()` and coordinate helpers from immutable pre-repair main `6c676317ff590dd756685168484c79788b5a329b` using `git show`, then runs current production `reactionStep()` in the same VM harness. It does not copy a retired production implementation into fixtures. Both sides use real compiled production catalog/core functions, canonical nonbonded calculations, actual preview atoms and Three transforms.

The five tests pass with exact structured comparisons of complete diagnostics, every matcher call/result, candidate enumeration, arbitration inputs/results, commit inputs and trajectory observations. Coverage includes:

- All 29 production rules and their real labelled pathways, with changed orientations/positions in subsequent steps.
- The full six-body Stage B fixture and all 384 candidates.
- Supplemental participant choice, busy state and test isolation; no candidate reduction.
- Canonical overlap and geometry-window boundary perturbations, environment gating, dwell accumulation, actual selected arbitration and commit input.
- Moving bodies away after readiness, manipulation reset, polymer-owned and active-transformation early returns.

The 384-candidate fixture independently confirms the diagnosed operation counts and their removal:

| Computation per reaction step | Immutable uncached main | Proposed production repair |
|---|---:|---:|
| World-atom coordinate evaluation | 19,968 | 14 |
| Canonical real-atom pair geometry | 9,216 | 48 |
| Candidate diagnostics | 384 | 384 |

These exact counts are assertions. The next step changes pose/orientation and reaches cumulative 28 coordinate / 96 pair evaluations while still matching every uncached diagnostic, proving both caches are rebuilt. These are operation counts, not timing measurements. The harness records production commit inputs but does not run the entire Three presentation/save lifecycle; browser/E2E acceptance is still necessary.

Executed after the repair: `node --test tests/reaction-lab-step-geometry-cache.test.mjs` → 5/5 PASS; `node scripts/check-repository-hygiene.mjs` → PASS, 0 warnings. Both workflow entries that invoke the immutable Git oracle use `fetch-depth: 0`.

## Independent diagnostic cross-check and limits

Re-read the original instrumented section/state and CPU-profile JSONs downloaded from the bounded diagnostic. Both frozen baseline and main show exactly 19,968 coordinate calls and 9,216 pair calls per observed fixed step. Every retained section record has 384 final candidates and zero animation/polymer/busy state flags.

Across the retained first 180 section records in each of five calls:

| Instrumented source | Mean physics section | Mean matcher section | Matcher / summed fixed-step wall time |
|---|---:|---:|---:|
| Baseline | 0.08567 ms | 5.54033 ms | 98.13% |
| Frozen main | 0.08122 ms | 5.42789 ms | 98.13% |

CPU samples include `assess`, `atomWorldAngstrom`, `updateWorldMatrix` and `multiplyMatrices` repeatedly. This independently supports matcher geometry as a dominant removable computation in both sources, rather than a new physics integration cost. CPU samples also include GC, but they do not identify the mechanism of the old failed steps.

Critical diagnostic limits are retained:

1. The instrumented `active` flag is enabled and disabled in separate CDP evaluations around fixture-reset and synchronous measurement evaluations. RAF can execute while it remains enabled. Actual indices are 209–224, not 180. The fixed-size typed array stores only the first 180 records; later out-of-bounds writes are not retained, although operation counters continue. Thus those rows cannot be labelled the strict profile's exact 180 manual steps or mapped to its retained slow-step indices. The counters / total observed step count remain exactly constant in these records.
2. The first diagnostic run captured controls and then failed instrumentation prevalidation. The subsequent run captured only the missing instrumented profiles. Controls and instrumented profiles therefore use different runners. The planned same-runner <5% overhead check is unavailable; the table is instrumented diagnostic wall time, not strict production cost or a causal estimate of instrumentation overhead.
3. Diagnostic Chrome `155.0.8059.84` / revision `5869fe313571d75152b77813cf0a4ee26a4e6df0` differs from frozen failed ordinary Chrome `155.0.8059.39` / revision `3ff7ac5a9224be9156d7f8703a06e22890aafd34`. This prevents a same-environment causal attribution of the original failure.
4. Trace/CPU samples cover the broader recording interval, not an independently CPU-clock-mapped record of each old slow step. Missing CPU samples are not themselves proof of OS scheduling. V8/OS/other interruption may still explain particular clusters; none is asserted as established.

These limitations do not negate the directly observed repeated computation or its deterministic removal. They prevent claiming that the old cluster mechanism, an overhead-adjusted absolute cost, or the strict performance gate has already been proven.

## Preservation and acceptance conditions

Only generic matcher read-only geometry reuse changes in production. Physics integration, chemical graph/atom origins/bond orders, all 25 finite routes, geometry generation, sample identity, fallback, save schema, FIELD, pointer/release lifecycle, renderer and completion timing remain outside the repair. Workflow changes add the oracle test only; baseline SHA, 8.333333333333334 ms threshold, 29 rules, 384 candidates, warm-up and four measured trials are unchanged.

Proceed to the required ordinary CI and browser/E2E guardrails, then review their complete raw values and merge authority. Post-merge strict Stage B must separately pass. Any new failure remains evidence and keeps Issue #352 / Task④ BLOCKED; this source review cannot waive it.
