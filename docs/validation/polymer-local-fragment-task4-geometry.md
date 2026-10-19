# Task④ — Actual finite-fragment chemical geometry

## Authority and scope

Start/main authority: `37b7d2cde1e60cd28575784a252382f4599c391f`, Tasks①–③ PRs #346/#347/#350 merged. PR #345 remains OPEN, HEAD `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`; its retained strict Finite/Stage B failures are not waived. This task neither imports its resize/footer patch nor diagnoses that historical GPU wait again. Final PR, source SHA, CI, independent review and merge disposition are recorded in the PR and this evidence directory.

Normative inputs: [Task① authority](polymer-local-fragment-task1-authority.md), [route matrix](polymer-local-fragment-route-matrix.md), [Task② education](polymer-local-fragment-task2-education.md), [education matrix](polymer-local-fragment-task2-education-matrix.md), [Task③ visual spec](polymer-local-fragment-task3-visual-spec.md), [visual matrix](polymer-local-fragment-task3-visual-matrix.md). Their chemistry/progression, finite-only and uncertain-stereochemistry boundaries remain unchanged.

Only actual `PolymerSample.fragment` atoms/bonds/origins are placed. Input is read-only. The Core, route records, byproduct partition, save schemas and source identities do not change. Constraints between nonbonded neighbors are numerical restraints, never returned as chemical edges. No extension atoms, end caps, extra repeat units, network junctions or bulk models are generated.

## Reproducible evidence and measurement budget

- `node --test tests/polymer-fragment-3d-layout.test.mjs tests/polymer-fragment-task4.test.mjs`
- `node scripts/validate-polymer-task4.mjs docs/validation/polymer-local-fragment-task4-evidence`
- `node scripts/project-polymer-task4.mjs docs/validation/polymer-local-fragment-task4-evidence/analytical-projections.json`

[validation-25.json](polymer-local-fragment-task4-evidence/validation-25.json) is generated from actual production Core representative sequences, u0…uN/generation1 and 190-step preview source poses, identical to Task③. It stores full-input and graph SHA256, counts/orders, XYZ, source tuple targets, every bond/angle/plane measurement and failures. Baseline is imported without alteration from the pinned main via `git show`; old XYZ is evaluated with the NEW chemical diagnostics. No copied historical source is committed. Reproduction requires Git history and Node (measured v24.19.0).

[generation-performance.json](polymer-local-fragment-task4-evidence/generation-performance.json) retains exactly two warmups and four measured solves for EACH route and build, baseline then candidate in one Node process. Layout and production diagnostics are included; preview preparation and test oracle are outside the timing window. No trial is discarded or repeated to select a pass. Algorithm changes produce distinct measurements; these local CPU timings do not replace browser strict gates. Baseline/candidate fixture, Node revision, trial counts and methodology remain identical.

The projection script preserves Task③ camera FOV42°, d15, 48 orientations, 32-step scale search, .92 fit margin, visual radii, three canvas budgets and safe rectangles. Its 75 results are analytical enclosing-sphere projections, not screenshots or DOM/raster acceptance. Graph digest/selector equality with Task③ is tested; pixel equality is not required.

## Measured root causes and algorithm decisions

Existing acceptance certified all 25, yet none passed the new complete local checks. Source monomers preserve alkene angles after conversion to saturated centers; some centers deviate by ~50–67°. PAN had a C–C≡N angle about118° despite `accepted=true`. Source-length preference also ignores changed bond order. The former weak simultaneous spring relaxation cannot fix these while remaining tethered to source poses. Therefore source-derived deterministic placement is retained as initialization, while only its local chemical constraints/relaxation and diagnostics are replaced.

1. Validate actual connected graph, origins, supported valence/charge/elements/orders, duplicate edges and size bound before coordinate work.
2. Retain source-instance poses and inter-origin traversal for initial placement. It is provenance-based initialization, not a chemical residue or junction inference. Transferred terminal H is initialized from its ACTUAL heavy-atom neighbor, without changing its phenol origin.
3. Classify sp, aromatic, sp²/carbonyl, sp³, amide N, amine N, ether O, acyl O and hydroxyl O from actual adjacency. Actual three-member cycles use triangle closure, rather than unconstrained sp³ angles; this preserves PEO's pre-opening intermediate.
4. Project bond lengths, analytical angle gradients, local coplanarity and van der Waals contact floors. Six-member actual aromatic cycles use movable regular-hexagon shape restraints; only each ring is planar, never the whole fragment. Amide/ester and diene neighborhoods have coplanarity restraints without fixing cis/trans signs.
5. At most160 outer iterations, eight fixed constraint sweeps each. Rebuild a conservative contact candidate list each outer iteration; newly active contacts are considered next iteration. Full diagnostics, including ALL nonbonded pairs, run for acceptance. Deterministic early exit every8 iterations requires stricter length≤.02world, angle≤5°, plane≤.035world, and no acceptance violations. Bounded accepted results may miss that stricter quality target, reported separately.
6. Terminal nitrile N is placed along the actual neighbor–C line with its actual C≡N length; it does not move the backbone center. Then center XYZ and calculate bounds and final diagnostics.

Work is O(I×(N² + sum degree²)), memory O(N²), N≤256, I≤160; all production samples have≤79 atoms. Working angle projections use scalar arithmetic to avoid transient vector allocation. No random search, route-specific handmade XYZ, per-frame solve, or solve during orbit/reset is introduced.

This is an illustrative constrained geometry generator, not a force field or an experimental conformation/energy minimum. Different actual source identities/poses can produce different valid conformations. The acceptance tests do not establish tacticity, cis/trans statistics, bulk composition or crystallinity.

## Units, reference values and frozen tolerances

The existing `src/bond-geometry.js` defines structural world units per angstrom=.78. V2 explicitly adopts that display calibration; output XYZ and residuals remain **world units**, not absolute experimentally measured Å. Old adaptive scale and uncalibrated absolute labels are retired for this solver.

Reference anchors (NIST CCCBDB SRD101, Release22, retrieved2026-10-19): [acetonitrile](https://cccbdb.nist.gov/exp2x.asp?casno=75058) C≡N1.157Å, C–C1.458Å, C–C–N180°; [dimethyl ether](https://cccbdb.nist.gov/exp2x.asp?casno=115106&charge=0) C–O–C111.2°; [methyl formate](https://cccbdb.nist.gov/exp2x.asp?casno=107313&charge=0) acyl C–O1.334Å, alkyl C–O1.437Å, C=O1.200Å, C–O–C114.8°; [formamide](https://cccbdb.nist.gov/exp2x.asp?casno=75127&charge=0) acyl C–N1.350Å, C=O1.210Å, planar N with angles118.5–121.6°. These are local analogues, not experimental measurements of the 25 polymer fragments. Methyl-formate coordinates use stated assumptions; no broader molecular/cartesian data are copied.

| Environment | Model target | Acceptance / interpretation |
|---|---|---|
| C–C single / C=C / aromatic cycle | 1.52 /1.34 /1.40Å ×.78 | Idealized covalent/model values; ring order1/2 remains in actual graph, mean aromatic length does not alter orders |
| nitrile C≡N / adjoining C–C | 1.157 /1.458Å ×.78 | Explicit nitrile local analogue |
| C=O / acyl C–O / ether or alcohol C–O | 1.21 /1.334 /1.43Å ×.78 | Distinguish shortened acyl bond from alkyl bond |
| acyl C–N / N–alkyl C | 1.35 /1.47Å ×.78 | N belonging to amide does NOT shorten every bond attached to it |
| C–H / N–H / O–H / C–F / C–Cl | 1.09 /1.01 /.97 /1.35 /1.77Å ×.78 | Existing covalent scale with ordinary neutral local targets |
| sp / aromatic, sp², carbonyl, amide N / sp³ | 180° /120° /109.4712206345° | Carbonyl120° is an illustrative central target, allowing differing pair angles; not exact experimental OCO/NCO values |
| amine N / ether O / acyl O / hydroxyl O | 107° /111.2° /114.8° /108.5° | Separate lone-pair and conjugated environments; actual small-cycle pairs use triangle-specific targets |
| all bonds | target residual≤.08world (≈.103Å under model calibration) | Frozen engineering validity budget; includes each order/environment, stricter than old .35world test/.62 acceptance |
| all local angles | target residual≤15°, linear≤3° | Frozen illustrative-local budget, not spectroscopic precision. Small-ring pairs use own targets; no tolerance widening after failure |
| actual aromatic rings, local sp² groups, amide/ester/diene coplanarity | maximum out-of-plane distance≤.08world | First noncollinear triple plane; retain individual values, no whole-chain plane |
| nonbonded, graph distance≥3 | severe floor=.55×vdW radius sum×.78; repulsion target=.70×sum×.78 | H1.2/C1.7/N1.55/O1.52/F1.47/Cl1.75Å from existing contact-radius convention. This excludes catastrophic contact, not full energetic/steric certification. 1–2 and1–3 contacts covered by bond/angle diagnostics |

Charged atoms, unsupported elements/environments, valence excess, malformed endpoints/orders and disconnected chemical graphs are not generalized to invented chemistry. They throw TypeError. Generic arbitrary chemical-ring chemistry beyond the actual source aromatic/three-member cases is not scientifically certified by this model.

## API, semantics, determinism and failure boundary

`createPolymerFragment3DLayout(sample,{sourceRecordsByInstanceId,maxIterations=160})` retains output atoms/bonds/origins/bounds/continuations and adds version2 chemical diagnostics. It validates finite complete XYZ source points; absent, mismatched or coincident source poses explicitly reject. Source-derived seed rejection is not reclassified as invalid chemical graph. `maxIterations` clamps valid positive finite budgets to1–160.

For the same ordered full input/budget/version, XYZ AND diagnostics reproduce exactly; timings are external. Atom IDs are preserved even when the input graph is deliberately reindexed; origins and bond endpoints follow the supplied ordering. Permutation-invariant XYZ is not promised, and no internal normalization renumbers atoms. Original Core graphs continue to have dense index IDs.

`polymerGeometryModel` / `polymerGeometryDiagnostics` expose read-only constraints and the exact per-environment measurements. `resolvePolymerFragmentTargets(sample,{sourceRecordsByInstanceId,route})` supplies index/bond/origin-tuple sets for backbone, actual ends, side attachments, rings, carbonyl, ester/amide/ether/acid, nitrile, retained nonaromatic C=C, methyl, PF methylene/hydroxymethyl and source groups. Source vinyl/diene sites identify chain paths; condensation uses all shortest heavy-atom paths between source reaction anchors, retaining both aromatic paths. No proximity/longest-path/fixture final-index selector is used. Missing or mismatched source/route evidence produces `resolved:false` with reasons. PF returns `actual-PF-heavy-fragment-not-certified-backbone`, never an asserted three-way junction.

`createSafePolymerFragmentPlan` is the viewer boundary: invalid chemistry throws; rejected valid solve can try the old finite fallback only if its entire actual graph and NEW chemical checks pass. Missing/degenerate source evidence never licenses fallback certification. Otherwise `POLYMER_GEOMETRY_UNAVAILABLE` is thrown. The viewer suppresses unverified meshes and exposes a recoverable display error, keeping the committed Sample/byproducts/discovery events/next FEED; it does not overwrite saves or pretend an invalid model completed. Source setup failure pauses before docking. Strict tests cover both accepted fallback and rejected coincident fallback.

## Validation status and remaining ownership

Local deterministic suites cover all25, every initial/intermediate actual commit, Task③ graph/target correspondence, immutable inputs, changed object/identity/pose, atom/bond reordering, invalid graphs/poses, bounded nonconvergence and cyclic/branched cross-origin topology. The latter must either solve within the model scope or reject explicitly; it is not additional chemistry route certification. Existing source-contract/Core/discovery/progression tests are also required.

Browser coverage uses the existing real-pointer suite at390×844 and1280×900, adding PAN to the retained12 routes. It checks completion, graph meshes, manipulation/reset, close/reopen, next FEED, resource lifetime and reduced PE. This is representative integration, not Task⑤'s final all-screen visual acceptance or a physical-device test. The current local environment has no Chromium binary; hosted CI is the browser/performance execution authority. No browser result is claimed before its actual run is inspected.

Independent review initially found over-shortened N–alkyl bonds, malformed source-point acceptance and incomplete semantic-source reporting; fixes and negative regressions are included. Final independent review must inspect the delivered source/evidence and any browser or performance limitations.

Task⑤ receives this geometry API, exact merged SHA only after merge, accepted fixtures and read-only semantic groups. It still owns L1 triple-lane rendering, final tokens, annotation/selection/local focus, DOM safe-region fitting, final raster occlusion and interactions, DPR/resize/GPU lifecycle reconciliation with #345. PF L2 attachment-site chemistry is explicitly UNVERIFIED: coordinates do not repair it. Task⑥ still owns full25×V/state/device acceptance, strict integration and child observation.

Final acceptance/merge status: **BLOCKED**. Required hosted acceptance has an unresolved failure; PR #351 remains open. No main merge or post-merge acceptance is claimed.

## Local results on the delivered source

All25 final samples, all initial/intermediate Core graphs and both ordered fixture conventions pass the delivered chemical gate. Final u0…uN maximum bond residual=0.006147world, maximum angle residual=6.468592°, maximum plane deviation=0.064863world, severe overlaps=0, nitrile local centers=5 (PAN4/NBR1, linear within3°). Graph digests equal the Task③ inputs; Nylon-6,6 retains79 atoms and PF retains its actual two rings, one bridge, hydroxymethyl and transferred-H provenance.

Node measured100 solves/build: baseline median/P95/max=8.964/36.335/44.500ms; candidate=7.250/100.661/136.328ms. Median and tail differ; **tail generation cost increases**, so this is not a blanket performance non-regression claim. Solves are commit-only and bounded; strict browser comparison is a separate mandatory gate.

75/75 fixed-camera analytical projections satisfy full fit, bounds-center≤1px, occupancy.70–.94 (±.01), H diameter≥4px where present, heavy diameter≥6px. This is not DOM/raster/occlusion acceptance.

Local tests:12 geometry/negative/determinism tests,37 Core/discovery/progression/source-contract tests, PWA353 assets and repository hygiene0 warnings passed. Initial independent-review findings were corrected; browser fault injection additionally tests latched initial failure, committed failure without consumed monomer remnants, discovery retention and next-FEED recovery. No GPU/RAF or hosted result is inferred from these local checks.

## First hosted acceptance and cause-backed recovery

PR [#351](https://github.com/miyatayuuma/molecule-craft/pull/351), source `de02802dd1e78fc08157d1ba0320b9894e4488dc`, [run39197944147](https://github.com/miyatayuuma/molecule-craft/actions/runs/39197944147) attempt1: Stage B and ordinary mobile pointer/failure QA **FAIL**. Raw comparison, exact browser/source conditions, ZIP digests and failure state are retained in `polymer-local-fragment-task4-evidence/ci-first-*`. FIELD run39197944105 passed.

Stage B trial P95 baseline7.6/7.3/7.5/11.7ms (pooled8.7), candidate7.6/7.4/7.4/12.8ms (pooled9.5); absolute limit8.333333333ms, unchanged relative tolerance.45ms. Candidate median-trial difference−.05ms passes; pooled+.8ms fails. Both baseline and candidate exceed the hard gate. Generic integration/matcher/profiler/comparator are unchanged by Task④ and its solver does not directly run for methane+oxygen+2-butene, but indirect code/runtime effects and environment are not excluded. This is NOT a proven noise-only or existing-only failure. No pass is substituted and no old job is rerun.

The mobile suite reached all13 ordinary routes (including PAN), observation/close/reopen and reduced PE before its new fault recovery check. That negative check exposed an actual implementation defect: Core `sampleDismiss()` only clears SAMPLE, so an explicitly abandoned failed initial WAITING transaction survives next FEED. The source repair recreates only that failed transient Core at explicit next-FEED purge. Normal Core locking, graph edits, completed Sample dismissal, byproducts and persistence are unchanged. The existing fault QA remains mandatory. Downstream desktop/integrated/Finite-comparison stages were SKIPPED in this first job and are not accepted.

A new necessary repaired-source commit receives ordinary CI; it is separate evidence and does not claim the Stage B cause was fixed. Required failed gates continue to block merge/CLOSED. Final disposition belongs to the PR's exact source authority and retained run records.

## Required failed-display gesture repair

GitHub review thread `PRRT_kwDOUHvkUc6tyGMM` found that ready display-error samples have fit=null yet old pinch/wheel handlers still dereference fit. Added one observation predicate requiring ready, fit, layoutPlan, no displayError and not suspended; failed displays accept neither observation pointers nor wheel zoom. The actual fault QA now dispatches wheel and two-touch pinch and asserts no browser exception, no active pointer, unchanged camera and preserved sample identity. This is a failure-boundary fix, not Task⑤ renderer work.

On the preceding recovery source `a6dafe8b65191983ae9e5967c00d18350a16db12`, Stage B run39198475297/job117886273971 PASS: baseline trial P95 4.4/4.2/4.4/6.0ms (pooled4.4), candidate4.3/4.1/4.1/4.2ms (pooled4.2), unchanged budget8.333333333ms/tolerance.3ms. Exact Chrome/Node/source conditions and all raw trials are retained in `ci-second-stage-b-*`, artifact12162907251 ZIP SHA256 `a1766d98d4e8bb748795139ca1d9773e3ed73df9876d03f9784e5af826759e49`. The mobile ordinary and failure/re-FEED suite passed on that source. This does not explain or erase the first Stage B FAIL. The gesture repair still requires its own ordinary acceptance on its exact source.

## Final source acceptance disposition — BLOCKED

Measured production source: `0f3e51de1a6e05770a74e008cbda9e0303fabf4d`, tree `7851c23621810ee818ae55614fe7e9e7702a72d3`. Subsequent evidence-only publication does not change the measured runtime. Main remains `37b7d2cde1e60cd28575784a252382f4599c391f`; PR #345 remains OPEN/unmerged. Task④ PR #351 stays OPEN. Merge, actual merged SHA and post-merge verification are **NOT EXECUTED**, because mandatory acceptance is incomplete.

### Mandatory repository blocker

[Repository run39199007958](https://github.com/miyatayuuma/molecule-craft/actions/runs/39199007958), candidate job117887858346, fails `tests/reaction-lab-browser.test.mjs:280`: **Release removes linear throw momentum**. The immutable Task⑩ baseline control reached its measurement and passed (trial P95 7.8/8.0/7.6/7.7ms; pooled7.8ms). The candidate fails the preceding generic water-drag assertion and therefore its Stage B measurement in this job is NOT_EXECUTED. Seven other Repository jobs pass. The dedicated Reaction Lab Stage B comparison is a distinct successful job and cannot substitute for this required functional failure. Raw failure excerpt is `ci-final-guardrails-failure.txt`; hosted baseline-control artifact12163371759 has ZIP SHA256 `31751fac12c486d9592a6fe926fc0aefb44c488bd0244824910944a3cd92d7ed`.

Bounded source review confirms no Task④ edits to the generic release handler, manipulation module, integrator or failing test. New pointer guards fall through identically when no polymer display exists. The handler still synchronously zeros the selected body's velocity. CDP release and subsequent snapshot occur in separate requests, so intervening physical steps are a plausible explanation; however the log contains only actual:false, without velocity or fixed-step counters. Neither an existing-only defect, an environmental flake nor absence of an indirect regression is established. No threshold/test relaxation or unchanged-source rerun is used to hide this failure.

Resume condition: instrument only the failing release boundary to retain velocity XYZ/finite status immediately before release, immediately after handler reset and at assertion; include selected/down/pointer IDs, fixed-step counter and simulation clock. Determine whether reset failed or later force integration produced velocity. Repair the demonstrated cause, validate both release and subsequent-physics contracts without weakening either, then complete all required CI on the repaired exact source. See independent `gate-disposition-review.md`. This task does not expand into an unrelated global physics rewrite.

### Hosted FIELD and retained failure history

FIELD run39199007969 first fails before Page.navigate: Chromium DevTools readiness times out. Application assertions are NOT_EXECUTED in that invocation. A single job-only infrastructure diagnostic rerun on the same source, job117890148182, completes the actual desktop/mobile FIELD assertions and hygiene: PASS. Both logs are retained (`ci-final-field-startup-failure.txt`, `ci-final-field-retry-pass.txt`). No failed performance job was rerun.

The superseded recovery source a6 Finite run39198475297 also has a retained strict FAIL: Desktop reduced-motion maximum RAF133.3ms exceeds unchanged116.9ms allowance; P50/P95/completion checks pass independently. Raw four-condition performance inputs and comparator are `ci-second-completion-*`; artifact12163302340 ZIP SHA256 `40257c9e76dc2f85cf4969f8b6b0b5df15fd78d088b571f807f8ef17d3933cc4`. Source0f ordinary CI was necessary for the separate reviewed failed-display gesture repair; it does not establish a performance root-cause repair. No trial is removed, no favorable trial selected and no failed history erased.

On source0f, dedicated Stage B run39199007973/job117887858370 PASS: baseline trial P95 3.9/4.1/4.0/4.2ms, pooled4.1; candidate5.5/4.2/4.1/3.9ms, pooled4.3; unchanged hard budget8.333333333ms and tolerance.3ms. Full trials/comparison are `ci-final-stage-b-*`; artifact12162748689 ZIP SHA256 `cdb299f928b13c48fb586b910023d2b61ef1a9e5d92b1736527eef19bfeb2ed2`. This PASS is evidence for that job/source, not permission to ignore the separate required guardrail FAIL.

### Task⑤ handoff state

Geometry source SHA256 remains `96b87ff09ca838113a5c885c3b3b20f1c959f6199dd54320ab51f7ab3f51e687`; generated25-route and75-projection evidence matches it exactly. `createPolymerFragment3DLayout`, `createSafePolymerFragmentPlan`, `polymerGeometryModel`, `polymerGeometryDiagnostics` and `resolvePolymerFragmentTargets` are reviewable in PR #351. Actual accepted fixtures and index/bond/origin-tuple semantic sets are in `validation-25.json`, generated by the documented scripts. There is **no merged Task④ SHA** to consume yet.

Independent production/scientific reviews found no remaining major code defect after their listed repairs; the separate evidence review explicitly withholds CLOSED because the required guardrail is unresolved. This is constrained illustrative geometry, not a force-field minimum or experimentally validated material conformation. PF L2, L1 triple-lane rendering, annotation/local focus, DOM safe-region fit, final raster occlusion and broader renderer/device acceptance remain outside this completion claim.

### Completed final Finite browser/performance evidence

Source0f Finite run39199007973/job117887858605 completes **PASS**, including12 geometry tests, 13 ordinary representative routes at390×844 and1280×900 plus reduced PE, real FEED/docking/completion, graph mesh counts, orbit/zoom/reset, close/reopen, re-FEED, source/final failure injection, failed-display wheel/pinch, resource evidence, integrated mobile/desktop discovery→Engineering→FIELD journeys, Collection and unchanged353-asset PWA closure. `ci-final-browser-summary.json` retains28 route/motion observations and26 screenshot hashes; six PAN/Nylon/PF images and the exact failure/gesture/journey logs are committed alongside it. All full raw images and state logs are retained in artifact12163079912, verified ZIP SHA256 `d394051cceab152c8a40a13a7f3b9c4cd7db63718802e33572204b5a017ea74a`.

All16 strict real-RAF/completion checks across the four viewport/motion conditions pass unchanged. Raw measured+warmup inputs and comparator are `ci-final-completion-*`. Baseline remains historical Task⑩ SHA4bc202c, not task-start main; Chrome155.0.8059.39/revision3ff7ac5a... is identical across builds. This does not isolate every Task④-vs-start-main effect or erase earlier failing runs.

| Viewport / motion | Baseline / candidate pooled RAF P95 (ms) | Baseline / candidate max (ms) | Baseline / candidate completion P95 (ms) | Result |
|---|---:|---:|---:|---|
| Mobile / normal |16.8 /16.7|33.2 /33.4|665.0 /663.3|PASS|
| Mobile / reduced |16.7 /16.8|16.8 /16.8|256.6 /264.6|PASS|
| Desktop / normal |150.0 /150.0|150.0 /150.0|895.0 /757.3|PASS|
| Desktop / reduced |150.1 /16.7|150.1 /16.7|436.1 /286.0|PASS|

These are actual SwiftShader/headless RAF samples, including coarse Desktop counts (normal24/20, reduced12/4 intervals baseline/candidate). The frozen comparator evaluates median-of-trial P50/P95, maxima, latency, resources and source/browser conditions. No synthetic frames or floor changes are introduced. A relative PASS does not claim 60fps Desktop rendering or physical-device validation. Local all25 generation-tail increase remains documented separately. **The unresolved Repository release-velocity guardrail still blocks Task④ despite this Finite PASS.**

[Machine-readable final acceptance and source provenance](polymer-local-fragment-task4-evidence/ci-final-acceptance.json) ties every hosted result to its job/run/source. The evidence-only publication preserves those failed results; any automatically scheduled CI is not a root-cause repair or a substitute for the documented resume conditions.
