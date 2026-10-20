# Task④ independent final release adjudication

Reviewer: newly assigned independent release reviewer (`independent_release_review`). Reviewed after all three current CI workflows completed, 2026-10-21 Asia/Tokyo. This review is independent of the earlier GPU diagnostic and production reviewers. No new browser, GPU, or performance campaign was executed.

**Decision: RELEASE_ELIGIBLE** for PR #351 HEAD `bce74c85b9121cbcaf5af83e58d9b86d62f36fe9` against main `37b7d2cde1e60cd28575784a252382f4599c391f`.

This is a release decision under the user's current acceptance instruction, not proof that historical performance failures have been causally repaired. No concrete unfulfilled current mandatory gate, uncorrected major production defect, or invalid CI replacement was found. The former D/Indeterminate disposition accurately describes diagnostic uncertainty; making complete GPU/OS internal causal attribution an additional release prerequisite is no longer justified by the current task.

## Review scope and independent checks

Read repository AGENTS.md and the relevant architecture map, production geometry and viewer diffs, release recovery implementation/test contracts, FIELD test change, geometry authority and validation, historical failed comparison records, final GPU/OS report and prior reviews. Reviewed evidence worktree commit `9a8cbe4c438f7bf9a8eaf90912a9ea45ffca5264` separately from the production PR HEAD.

Independently checked every part's bytes/SHA256 and concatenated file bytes/SHA256 for all four `gpu-os-manifest.json` bundles. Also verified every file/part in `remaining-evidence-manifest.json`, including all fourteen old trace parts. This establishes integrity and completeness against the committed manifests, not independent physical authenticity of a GitHub runner.

All 40 current ordinary profiles retain one warm-up plus four numbered measurements for each baseline/candidate × mobile/desktop × normal/reduced condition. Reran the unchanged `scripts/compare-polymer-performance.mjs` OFFLINE against the four exact retained profile inputs with frozen expected source SHAs. Result PASS; the entire recomputed comparison object equals the saved comparison object exactly. No measurements were rerun or discarded.

All ten new instrumented diagnostic profiles match their raw profile measurements and analysis; long-interval counts independently match: baseline warm-up2/measured12; candidate warm-up3/measured3. The 40 earlier diagnostic rows and 40 old ordinary acceptance profiles are retained separately. Diagnostics are not substituted for ordinary acceptance.

Executed deterministic geometry/release suites: **17/17 PASS**, zero skipped, covering all25 final graphs, intermediate actual graphs, preservation/determinism, semantic source identity, invalid chemistry/source poses, accepted/rejected fallback, failure boundaries, synchronous release/ownership, subsequent actual Stage B force response, and blur wiring. These are not browser performance results.

Independently queried GitHub commit workflows for exact HEAD: Repository39360743636, Finite39360743634, FIELD39360743535 are completed/success. Frozen authority records all three as attempt1, no rerun; primary agent additionally inspected live complete job/step states. New independent review is not a GitHub account approval and must not be represented as one.

## Findings and disposition

- **Chemical graph/origin/sample identity:** preserved. Runtime chemical graph, reaction route data, reaction progression, Stage B integrator and persistence source are unchanged. Geometry validates rather than rewrites graph chemistry. Tests compare all25 against Task③ graph digests and preserve ordered atom IDs, endpoints/bond orders, origins and inputs. Geometry source SHA256 remains `96b87ff09ca838113a5c885c3b3b20f1c959f6199dd54320ab51f7ab3f51e687`. Frozen current CI geometry accepts25/25, fallback0. This certifies the stated constrained illustrative local model, not experimental conformers or arbitrary polymer chemistry.
- **Release boundary repair:** justified. Exact XYZ zero is now tested inside the trusted pointerup dispatch, with pointer/instance ownership and cleanup. Subsequent ordinary-force acceleration is tested separately. This corrects the former asynchronous assertion's contract mismatch without weakening the zero-reset requirement. Historical failing run lacks exact step counters and is not retroactively assigned invented observations. Blur listener cleanup/UI recovery is a bounded demonstrated production repair, not unrelated physics redesign.
- **FIELD repair:** justified necessary test change. The old immediate inspection/fixed100ms wait could miss asynchronously exposed PARTIAL. New state wait, pointer hit check, single native press/release, trusted intended click, same-dispatch hidden check, Supply closure and running FIELD establish the intended behavior initially and after reload. Four retained desktop/mobile boundaries all have trusted/correctTarget/button0/partialHidden=true. There is no synthetic click, click retry, threshold change or application-state bypass. Production and geometry are byte-identical between0036 andbce.
- **Current ordinary acceptance:** a legitimate single attempt after this distinct needed FIELD test repair, not unchanged-source rerunning until favorable performance. Performance results on that run can be accepted for current HEAD even though FIELD repair does not explain old Finite failures. Claiming causal repair of those failures would be false. The changing browser between historical and current campaigns is disclosed; each current baseline/candidate pair uses the same exact browser.
- **Contracts:** comparison/profile source, immutable baseline `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`, fixed step/workload, warm-ups/trial policy, real RAF and650/250ms feedback remain intact. Workflow changes add geometry/failure/blur coverage. No diagnostic observer is merged. No gate is skipped or replaced by synthetic frames, altered allowance, a different baseline, or a selected trial subset.
- **New production regression:** no remaining major code defect or reproducible Task④-specific production regression was established. This is not proof of absence. Historical strict failures remain empirical failures; isolated variably failing frames plus incompletely discriminating diagnostics do not establish a specific new defect whose correction is a current blocking condition.
- **PR #345:** independent and must remain unmerged. Task④ does not require its unaccepted resize changes or diagnostic routing. Relative-to-main inspection shows no merge of its footer reservation/resize remedy. Potential future renderer/resize work must reconcile that branch and preserve its evidence.

## Explicit residual risk accepted for this release

Current Finite relative comparison PASS is not a60fps guarantee. Desktop retains21 normal and8 reduced intervals over25ms, maxima116.6ms; baseline has23/9 and116.8/116.7ms respectively. Historical normal mobile FAIL in run39251826085, candidate5 vs baseline2/allowed3 long intervals, remains a failure; previous max-frame and Stage B failures also remain in their source-specific history. Their mechanism and Task④ attribution are unproven.

The ten-trial SwiftShader diagnostic observes GPU-main futex sleeping, worker execution/runqueue delay and presentation throttling, but does not connect a specific futex dependency/wakeup edge to each RAF gap or explain the old ordinary five intervals. The sampler consumes about0.36–0.41 CPU core; instrumentation disturbance and changed browser mean diagnostic improvement is not production non-regression proof. Hardware-GPU queues and physical-device performance are unverified. Source coordinate changes may change raster work; equal resource counts do not exclude that.

Geometry-generation tail increase in the earlier100-solve comparison remains disclosed. Bounded commit-only solves and passing ordinary acceptance justify release under existing gates; they do not establish equal worst-case solve latency. PF attachment-site L2 certification, L1 triple-lane rendering, final safe-region/occlusion/visual tokens and physical-device/all25 visual acceptance retain Task⑤/⑥ ownership. Preserving the existing PF graph and qualifying its limitations is appropriate; this review does not certify unsupported three-way junction chemistry.

These are concrete follow-up risks, not a finding that the current required gates fail. Keep them in the final PR disposition and future renderer work rather than declaring GPU uncertainty harmless or authorizing unbounded new diagnostics.

## Merge and post-merge verification boundary

Before merge, recheck unchanged main/HEAD, checks, unresolved reviews and mergeability; preserve old failures and this risk disposition. Do not merge PR #345.

If the actual merged main tree equals the reviewed HEAD tree, previously completed Repository/FIELD evidence remains evidence for identical source. Their workflows are pull_request-only, so explicitly report evidence reuse; do not claim new main Repository/FIELD workflow runs. Execute/inspect main's naturally triggered Finite workflow (includes strict Stage B, geometry and integrated FIELD), and targeted main geometry/PWA/hygiene as planned. No outcome-driven retry is justified. New post-merge mandatory failure must reopen the final Task④ disposition even though this pre-merge review is RELEASE_ELIGIBLE.

No merge or post-merge result is asserted by this review. Release eligibility permits proceeding; Task④ CLOSED depends on the actual merge and the stated verification boundary succeeding.
