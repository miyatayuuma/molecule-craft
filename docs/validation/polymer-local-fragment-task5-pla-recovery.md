# Task⑤ PLA recovery — retained feasible pose

Starting main: `593ac571e4d664f7af885855352142874dd227ab`. Starting PR #354: `dc70f7e2edd20d40bf1432855ff7fc6c24f6de24`. This record certifies the bounded geometry repair below; Task⑤ remains **BLOCKED** by PIB simultaneous visibility and downstream unexecuted gates.

## Reproduction and cause

The frozen actual re-FEED input is unchanged: `polymer-sample-2-2`, 39 atoms / 38 bonds, route `polylactic-acid-direct-polycondensation`, input SHA256 `d66858f2b16e770772842f03eb32eb0174847db142f39ae5d5f0735446b54828`, graph digest `0e2881feedc95881932ed5f49a8f5a8a899d33afb4d4ef51f0a273078d1a0556`.

[Before replay](polymer-local-fragment-task5-evidence/recovery/pla-replay-before.json) reproduces `POLYMER_GEOMETRY_UNAVAILABLE`. At iteration160, C13–O15–C22 is130.22020239488634° against target114.8° (error15.420202394886346°, allowed15°). No bond, plane or steric violation remains.

[Full before trace](polymer-local-fragment-task5-evidence/recovery/pla-solver-before.json.gz) retains every iteration's full chemical diagnostics, coordinates at0/1/8/16/32/64/96/128/160, and every sweep's five projection-stage violations and target angle. These are instrumented **test-only** imports; production has no trace hooks.

| iteration160, sweep8, after | angle ° | maximum bond error | maximum plane deviation | joint acceptance |
|---|---:|---:|---:|---|
| nonbonded |130.22103551961007|.016804029210223614|.042871150193249566|FAIL angle|
| angle |129.65363470083759|.038897258051396655|.011658282236307056|PASS|
| ring (PLA has none) |129.65363470083759|.038897258051396655|.011658282236307056|PASS|
| plane |129.65247444804237|.03889667132955599|.010190818569792448|PASS|
| distance |130.22020239488634|.01939479817962897|.010005929116924593|FAIL angle|

The first jointly feasible stage is iteration134/sweep1 after plane. No full-sweep endpoint is feasible in0–160. This establishes **B+E**: angle correction works, subsequent distance projection undoes acceptance while reducing an already acceptable bond error, and the existing end-of-sweep checkpoint misses the feasible pose. Initialization begins with the target angle correct but25 severe overlaps and other angle/plane violations; the trace does not prove initial placement optimal or a unique physical conformer. It does disprove the need to waive an inconsistent chemical constraint: a jointly feasible pose exists.

## Minimal repair

At the existing eight-iteration checkpoint cadence, also independently validate all chemical constraints after the last plane projection and before distance projection. Keep the best jointly accepted such pose separately. Original terminal successes and original full-sweep feasible checkpoints take precedence, preserving every already accepted canonical/PET output. Use the extra checkpoint only when the terminal pose fails and no original full-sweep feasible checkpoint exists. Reapply exact terminal nitrile projection and independently validate in the caller as before.

No route/sample/SHA exception, threshold change, extra iteration or source-coordinate offset was added. Graph, orders, atom IDs/origins, sample identity, fallback, invalid-chemistry rejection and stereochemical uncertainty are unchanged. The maximum remains160 iterations; angle15°, plane.08, bond.08 and existing steric criteria are unchanged.

[After replay](polymer-local-fragment-task5-evidence/recovery/pla-replay-after.json) PASS: target129.65247444804237°, error14.852474448042372°, maximum bond error.03889667132955599, maximum plane deviation.010190818569792448, zero violations in every category, no fallback. [After trace](polymer-local-fragment-task5-evidence/recovery/pla-solver-after.json.gz) records the same solver trajectory and the validated retained output.

## Regression and computation cost

- Frozen PET remains PASS, restored iteration64 and identical XYZ/diagnostics. [Before](polymer-local-fragment-task5-evidence/recovery/pla-recovery-pet-before.json) / [after](polymer-local-fragment-task5-evidence/recovery/pla-recovery-pet-after.json).
- Existing actual PET docking replay PASS:14 safe depth-resolved endpoints; same graph and input. This remains a Node endpoint replay, not new browser docking evidence. [Report](polymer-local-fragment-task5-evidence/recovery/pla-recovery-docking-replay.json).
- Existing14 geometry tests PASS:25 canonical samples, all95 intermediate graphs, Nylon-6,6, PAN/NBR linear nitriles, PF real rings/transferred-H, graph/origin/identity, deterministic regeneration, invalid input, fallback and no severe overlap. [Log](polymer-local-fragment-task5-evidence/recovery/pla-recovery-geometry-after.tap).
- New frozen PLA tests PASS: full joint constraints, immutable input, IDs/orders/origins, deterministic output, no fallback and short infeasible solve rejection. Added to the mandatory CI pre-browser gate; the existing explicit PLA replay remains mandatory.
- Existing23 observation, PNG/ID-mask grading, allocation, static-render and heap contracts PASS. [Log](polymer-local-fragment-task5-evidence/recovery/pla-recovery-contracts.tap).

[Fixed computation comparison](polymer-local-fragment-task5-evidence/recovery/pla-recovery-geometry-comparison.json): Node24.19.0, one full warm-up and four trials/source,27 inputs (25 canonical + frozen PET/PLA), alternating source order; every measurement retained. Baseline/candidate total1092.928/1150.157ms (+5.24%); P50 3.734/3.964ms, P95 38.720/43.605ms, max62.415/61.132ms. Only the previously rejected frozen PLA output changes; all25 canonical and frozen PET outputs are byte-identical. These short Node measurements do not establish a statistical performance bound and **do not replace Stage B or Finite real-RAF acceptance**.

Reproduce from repository root:

```sh
SOLVER_SOURCE_REF=dc70f7e2edd20d40bf1432855ff7fc6c24f6de24 SOLVER_EVIDENCE_DIR=test-results/pla-trace-before node scripts/diagnose-polymer-task5-solver.mjs docs/validation/polymer-local-fragment-task5-evidence/recovery/pla-refeed-geometry-input.json
SOLVER_SOURCE_REF=working-tree SOLVER_EVIDENCE_DIR=test-results/pla-trace-after node scripts/diagnose-polymer-task5-solver.mjs docs/validation/polymer-local-fragment-task5-evidence/recovery/pla-refeed-geometry-input.json
node --test tests/polymer-task5-pla-recovery.test.mjs tests/polymer-task5-pet-recovery.test.mjs tests/polymer-fragment-task4.test.mjs tests/polymer-fragment-3d-layout.test.mjs
node scripts/compare-polymer-task5-geometry.mjs
```

## Remaining hard gate

PIB source/XYZ and its existing actual raster evidence are unchanged by this repair. The original40-direction/one-local-attempt-per-anchor campaign has no simultaneous witness at anchors0/17/30. Saved actual PNG/ID-mask and per-view missing sets are retained in the [PIB conflict report](polymer-local-fragment-task5-evidence/recovery/pib-visibility-conflict.json).

| anchor |40 views with all required atoms|with all required bonds|with both|best retained view and missing set|
|---|---:|---:|---:|---|
|0|4|1|0|yaw0/pitch0: H4 missing; all10 bonds recovered|
|17|3|0|0|yaw45/pitch30: all11 atoms recovered; bonds28/29 missing|
|30|4|0|0|yaw45/pitch−60: backbone C31 and C–H bond12 missing|

Different poses recover different sets; that is not simultaneous acceptance. No global geometric-impossibility claim is made. A bounded numeric refinement of saved seeds predicts an improved anchor17 pose but still fails anchor30; numerical scores are not PNG acceptance. Narrowing the focus scope and an analytic projected-gap orientation also failed to resolve the full cohort; neither was adopted in production. The renderer/fit/grader remain unchanged.

Per Task③ A07/S12, the failed IDs return to Task⑤ orientation/local-fit work. Thresholds, graph/XYZ, all-H and same-view requirements remain intact. Until this gate passes, no new all12 static campaign or formal Finite performance run is started. V0–V8/C01–C09/S10–S16, final PAN/NBR L1, lifecycle/PF heap, Stage B/FIELD/Repository and final independent review/merge/post-merge are not certified by this geometry repair. Historical PASS/FAIL records remain historical.

The conflict ledger is reproducible from the retained original artifact directory with `node scripts/summarize-polymer-task5-pib.mjs <artifact/task5/polyisobutylene> <output-directory>`; the script first checks the frozen JSON identity and every actual/mask/photometry PNG hash for the three failed40-view sets. It adds no view or browser execution.
