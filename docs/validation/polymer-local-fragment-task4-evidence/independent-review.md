# Task④ independent review — final code/science review

Verdict: **No outstanding major defect found in the reviewed production geometry and failure-boundary code. Conditional approval for hosted CI; this is not browser/performance acceptance or authorization to bypass failed gates.**

Base main: `37b7d2cde1e60cd28575784a252382f4599c391f`.
Reviewed branch: `feat/polymer-local-fragment-task4`, live working tree before commit/hosted CI.

Reviewed content hashes (SHA256):
- src/polymer-fragment-3d-layout.js: `96b87ff09ca838113a5c885c3b3b20f1c959f6199dd54320ab51f7ab3f51e687`
- src/reaction-lab-viewer.js: `d6eb8bb7f107ef4ba0ede460439c2bece2a9b1527510cfd883910b75fcea2729`
- tests/polymer-fragment-task4.test.mjs: `b76cc70635c7d8cf9e2ccb7fe6c3567a4f3978a69fea9f3ee4a0676cac35bab6`
- tests/reaction-lab-polymer-browser.test.mjs: `8800231f4d9b4c327ace3299cee4bd63463d32f5b0fd346cb5affd2a452a61ee`

## Scope and independent checks

Read AGENTS.md, architecture ownership and Task①/③ authority boundaries; audited production chemical-environment model, source/origin initialization, deterministic constraint solver, semantic resolver, strict fallback wrapper and viewer callers/failure states. Inspected new fixtures, evidence-generation script, chemistry authority document and representative browser/fault-injection test changes. No production/test files were edited by reviewer.

Independently ran `node --test tests/polymer-fragment-task4.test.mjs` after the final geometry/fallback metadata changes: **8 tests PASS, 0 FAIL**. This includes 25 actual final Core samples, all initial/intermediate commit graphs, graph/origin immutability, repeated full-input equality, changed source identities/poses, atom/bond remapping, G0–G7 metrics, malformed/degenerate sources, invalid chemistry, nonconvergence and canonical fallback metadata restoration. Independently ran syntax checks for final viewer/browser-test changes.

Opened the four cited official NIST CCCBDB pages and verified the document's local numerical analogues: acetonitrile C≡N1.157Å/C–C1.458Å/180°; formamide C–N1.350Å/C=O1.210Å and planar-N angles118.5–121.6°; methyl formate acyl C–O1.334Å/alkyl C–O1.437Å/C=O1.200Å/C–O–C114.8°; dimethyl ether C–O–C111.2°. Methyl-formate assumed-coordinate caveat is retained. These support local illustrative targets, not measured polymer conformations.

Checked latest structured all25 evidence: 25/25 accepted; maximum bond residual0.006146543 world, angle residual6.468592°, plane deviation0.064863084 world; severe overlaps0. Baseline passes0/25 under these new local checks, although legacy acceptance was weaker. All three generated geometry/performance/projection files had the same reviewed layout source hash when inspected. The 25 projection rows contain three viewport measurements each; they remain analytical fit evidence, not raster/DOM acceptance.

## Findings resolved during review

1. **Amide N–alkyl bond over-shortening:** corrected selection to the actual carbonyl C–amide N edge; acyl C–N1.35Å and N–alkyl1.47Å now remain distinct. All-polyamide negative regression checks added.
2. **Malformed `point:{}` source accepted as complete pose:** explicit finite XYZ validation and coincident source-bond rejection now produce rejected diagnostics; negative tests exercise them.
3. **Semantic resolver false success with missing source records:** required source instances are now traversed from actual graph origins, with missing topology/incorrect source correspondence returning unresolved reasons. Missing-source negative regression added.
4. **Strict geometry exception escaping viewer:** safe wrapper separates invalid graph, rejected normal solve and chemically validated fallback. Viewer suppresses unverified meshes while preserving committed chemistry/byproducts/discovery and permitting next FEED.
5. **Repeated solve on initial failure:** latched polymerBeginError guard now prevents fixed-step retries until reinitialization. Runtime also pauses on intermediate displayError; rack recovery is explicitly available. Browser failure QA checks no additional solves over550ms.
6. **Fallback atom metadata not certified by XYZ checks:** fallback now supplies XYZ only; metadata, origins, graph and bounds are reconstructed from the canonical plan. Corrupt id/element/origin regression passes.
7. **Consumed incoming monomer surviving final display failure:** viewer catch now removes residual instances in actual consumedInstanceIds through existing disposal. Browser failure QA asserts consumed IDs and live instances are disjoint.
8. **13-route browser expansion retained12-route expectations:** discovery cardinality/order and resource expectations updated to13; duplicate fault block removed from performance branch.

The final viewer/fault-injection changes above were inspected and syntax-checked; their real-browser execution remains pending hosted CI.

## Scientific and implementation assessment

- Actual graph is read-only; emitted chemical edges are exact input edges. Bond/angle/steric constraints never add real atoms, bonds, artificial continuations or source instances.
- Environment classification explicitly separates nitrile linear centers, aromatic/sp2/carbonyl/amide planes, sp3 centers and lone-pair oxygen/nitrogen classes. The previously incorrect N–alkyl target has been corrected.
- Terminal nitrile projection follows actual neighbors and does not shift the backbone center. Aromatic shape restraints are local to final rings; amide/ester/retained alkene planes do not assert cis/trans statistics.
- PF transferred terminal H follows its actual bonded heavy atom while retaining provenance. Source-origin groups do not imply a chemical junction; PF semantic output explicitly avoids a certified backbone claim.
- Iteration/storage bounds are explicit. Contact-candidate optimization still performs full all-pair final acceptance, so omitted newly approaching candidates cannot be silently accepted as severe overlaps.
- Determinism is defined for ordered full input/version/budget, with timing excluded. Reindexing preserves provided atom IDs/origins; permutation-invariant XYZ is not claimed.
- Semantic target sets are tied to source reaction sites and final adjacency, with no geometry-nearest or final-fixture-index hard-coding. Actual PF bridge/hydroxymethyl and motif sets are checked.
- Fixed tolerance values are clearly engineering budgets for an illustrative geometry model. The document avoids calling its coordinates experimental Å or full steric/energy certification. Unsupported chemistry rejects explicitly.

## Remaining required gates and limits

**Hosted browser, strict Finite real-RAF and Stage B comparisons have not been observed by this reviewer.** Local Node timings show increased tail cost relative to baseline; even after optimization they cannot establish rendering non-regression. Gate thresholds, timing contracts and real RAF must stay unchanged, and a failed required gate blocks merge/CLOSED.

The new browser fault tests use test-server-only injection enabled solely for ordinary QA; performance runs must use unmodified production source. Initial/final error recovery, consumption cleanup and disposal are code-reviewed but not browser-certified here.

PF L2 attachment-site chemistry remains unverified and is not solved by XYZ. Task⑤ retains bond lanes, final renderer tokens, annotation/focus, DOM safe-region/raster occlusion, DPR/resize/GPU lifecycle and final interactions. No conclusion about material microstructure, energetic minima, physical-device UX or child comprehension is established.

A reviewed SHA/PR, actual required CI results, merge disposition and post-merge source/main evidence must be appended by the owner. Any substantive code changes after these hashes require targeted review; the review must not be represented as unconditional Task④ CLOSED.
