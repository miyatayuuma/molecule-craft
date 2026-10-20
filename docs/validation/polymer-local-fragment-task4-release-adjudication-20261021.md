# Task④ final release adjudication — 2026-10-21 JST

## Authority and scope

Start main: `37b7d2cde1e60cd28575784a252382f4599c391f`. Reviewed PR351 HEAD: `bce74c85b9121cbcaf5af83e58d9b86d62f36fe9`, tree `2e9bdad7345ae8437721d3a234368646868a4e5f`. PR345 remains OPEN/unmerged at `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`.

The user's final release instruction supersedes the earlier requirement to identify the GPU/OS internal cause before merge. It does not waive any existing performance, chemistry, functional or evidence gate. No new browser/GPU diagnostic, geometry development, acceptance retry, threshold/baseline/workload change or production change is part of this adjudication.

Frozen evidence is retained unchanged at commit `9a8cbe4c438f7bf9a8eaf90912a9ea45ffca5264`, especially `docs/validation/polymer-local-fragment-task4-gpu-os-final-20261020.md` and its checksum manifest. Earlier BLOCKED statements are historical decisions under their stated requirements; this report supersedes their release disposition, not their measurements.

## Evidence classes and risk disposition

| Class | Verified evidence | Disposition |
|---|---|---|
| Current ordinary acceptance | Repository39360743636 all8 jobs, Finite/StageB39360743634 both jobs, FIELD39360743535; all completed SUCCESS, attempt1 on HEADbce74c85 | Valid current mandatory gates; not causal proof that an old timing failure was repaired |
| Historical failed acceptance | Initial StageB; a6 desktop-reduced max; 0f generic-release assertion; adcea mobile maximum50ms vs49.5ms; 0036/run39251826085 mobile normal long-frame count5 vs baseline2/allowed3; earlier PR345 failures | Remain FAIL; not removed, relabeled PASS or explained as proven host noise |
| Instrumented diagnostics | Prior40 diagnostic profiles and latest10 GPU/OS trials, warm-ups included; diagnostic code not integrated into PR351 | Mechanism observations only; not ordinary acceptance and not performance repair proof |
| Cause-backed functional repairs | Failed-display next-FEED recovery; fit-null gesture guard; release-zero assertion moved to synchronous dispatch with separate canonical subsequent-physics verification; blur pointer/control recovery; FIELD state/trusted-click test repair | Their direct contracts have deterministic/browser evidence; not asserted to fix GPU timing |
| Residual performance risk | Desktop latest normal/reduced max116.6ms; earlier Node100-solve P95 increases36.335→100.661ms; unknown source/driver/software-raster/host contributions | Explicitly accepted for Task④ geometry integration under unchanged current strict gates; follow through Task⑤ renderer/lifecycle work and Task⑥ final acceptance |

The final FIELD integration changes only `tests/material-progression-browser.test.mjs` from0036, copying the reviewed repair from1378aa30. It removes a fixed100ms wait and requires state readiness, intended hit target, one trusted native click, synchronous PARTIAL dismissal, Supply closure and actual FIELD start, initially and after reload. No hidden click retry or synthetic click substitutes for the assertion. This is a necessary test correction followed by one ordinary CI synchronization; no favorable unchanged-source performance rerun was selected.

The performance comparator/profiler, immutable baseline4bc202c0, StageB fixed-step/workload, real RAF and650/250ms feedback remain unchanged. All current40 ordinary profiles retain one declared warm-up plus four measured trials in every B/C × viewport × motion condition. Diagnostic and ordinary Chromium revisions differ; their counts are not treated as a controlled observer-overhead comparison.

GPU evidence establishes SwiftShader GPU-main futex samples, worker CPU/runqueue deltas and presentation throttling. It does not establish futex target/wakeup causality, old failure attribution or a Task④-specific regression. The sampler itself consumes approximately0.36–0.41 CPU core. Neither an absence-of-risk claim nor a permanent block follows from that uncertainty.

## Geometry acceptance

25/25 final actual Core graphs and intermediate samples pass chemical geometry checks; fallback0, severe overlaps0. Atomic IDs, edges/orders, origins and sample identity are preserved. Maximum final bond residual0.006146543world, angle residual6.468592°, plane deviation0.064863084world. These are bounded illustrative conformations, not force-field minima or measured polymer conformations. PF L2 attachment-site chemistry remains explicitly unverified and is not repaired by coordinates.

Primary-agent verification in this adjudication: 17/17 targeted deterministic geometry/release tests PASS; PWA353 hashed assets current; repository hygiene0 warnings; PR diff whitespace PASS. Four latest evidence bundles were reconstructed with every part and full SHA256 verified. No browser timing result was inferred from these Node checks.

## Independent adjudication

**RELEASE_ELIGIBLE** — the new independent reviewer completed its review after all current CI finished. It independently verified old/new evidence part and full hashes, all40 ordinary profile slots, exact unchanged-comparator recomputation (complete JSON equality), all10 diagnostic trial/profile relationships and17 deterministic tests. No remaining concrete mandatory-condition violation or demonstrated severe Task④-specific unrepaired production regression was found. The old failures remain failures and the mechanism risk remains open. See `polymer-local-fragment-task4-release-independent-review-20261021.md` for its exact scope and rationale.

The primary adjudicator independently agrees. Current mandatory acceptance is satisfied; earlier GPU cause attribution is not an additional Task④ gate under the final instruction. Eligibility is not proof that prior timing failures were repaired. Final Task④ CLOSED still requires merge and the stated post-merge verification.

## Integration and post-merge protocol

Decision: **RELEASE_ELIGIBLE**, merge authorized by the existing user instruction. Actual merge and post-merge results are not yet claimed in this pre-merge record. Merge must pin the reviewed HEAD, recheck main/reviews/checks, preserve this risk record in PR351, and never merge PR345.

Existing Repository/FIELD workflows are pull_request-only. Finite/StageB also runs on push to main. Post-merge verification will explicitly distinguish (a) newly executed main Finite/StageB/geometry/integrated FIELD/PWA, (b) local main geometry/hygiene/PWA checks, and (c) prior Repository/FIELD acceptance reused only if the entire merged tree equals the reviewed accepted tree. It will not claim nonexistent fresh main Repository/FIELD workflows. No workflow-trigger expansion or outcome-driven retry is authorized here.

## Task⑤ handoff

Adopt only the actual merged authority after post-merge disposition. Preserve `createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId})`, safe fallback and semantic resolver, graph/origin/sample identity, error recovery and strict acceptance contracts. Task⑤ owns ball-and-stick materials/bond lanes, safe-region/camera/occlusion, mobile/desktop manipulation, resize/DPR/buffer/disposal and bounded real-RAF performance work. Reconcile PR345's resize repair separately; do not silently cherry-pick or merge it. Task⑥ retains final all25×state/device acceptance and physical-device limitations.
