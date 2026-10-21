# Task⑤ finite Sample renderer — implementation and acceptance

Starting main: `593ac571e4d664f7af885855352142874dd227ab`. Task①–④ canonical documents remain normative. This branch changes display and read-only observation evidence only. Geometry solver, chemical edits, atom origins, save schema, 29 matcher rules, 384 candidates/fixed step and Issue #352 step-local reuse remain authoritative.

## Ownership

- `src/reaction-lab-viewer.js`: source mesh transfer by actual origin, 1/2/3 camera-facing lanes, pooled cylinders, completion, group transforms, pointer ownership, resize/context lifecycle. Every finite sphere/cylinder owns its geometry/material; no instancing introduced without a measured benefit. Close disposes GPU resources, retains the graph/pose, and reconstructs on reopen.
- `src/reaction-lab-polymer-presentation.js` の数値観察部: fixed tokens, deterministic DOM largest empty rectangle, 48 orientations, enclosing cubes for atom spheres and full cylinder envelopes, perspective fit, read-only source/after/byproduct partition validation.
- 同moduleの `createPolymerObservationUi`: neutral state, element/bond legend, visible-mesh raycast selection, candidate disambiguation, semantic-target annotation, local focus, distinct comparison/concept identities. Source geometry is captured before source meshes transfer; source graphs and actual Core byproduct graphs retain their origin tuples.
- Core `comparisonEvidence()` returns a cloned read-only byproduct graph snapshot. It does not edit chemistry, save or progression.

## PR #345 reconciliation

PR #345 remains OPEN/unmerged, head `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`. Its resize/footer findings are reused, without merging its other diagnostics or changing its failed evidence. Task⑤ reserves the same 160 CSS px footer before FEED and after completion, and only changes the drawing buffer if real dimensions/capped DPR differ. ResizeObserver coalesces to one RAF. DPR is clamped to [1,2]. No same-buffer reset is requested.

## Validation budget and current status

Local deterministic tests: all25 geometry/origin contracts; actual 29-rule matcher equivalence and 384-candidate cache invalidation; all25 × three DOM-shaped canvas budgets fit and reset deterministically; 1/2/3 lane tokens; DPR/no-op resize; negative comparison partitions. These are numeric/source tests, not raster acceptance.

Hosted first implementation campaign: existing Repository/FIELD/Finite workflows once on the new implementation SHA. Their Stage B immutable baseline, 150 warmup, four trials, strict 8.333333333333334 ms budget, Finite one warmup + four normal/reduced trials, 650/250 ms real-RAF contracts and comparators are unchanged. No failed trial may be dropped or reclassified. Necessary source fixes require their own recorded run.

Local Chrome 156.0.8078.47 starts with a fatal `process_singleton_posix.cc` Unix socket permission error in this environment. Browser acceptance is hosted; local DevTools startup failure is not a renderer PASS or an environmental explanation of hosted performance.

Status: IN_PROGRESS. No merge/CLOSED claim before complete visual, interaction, lifecycle, strict performance, review and main acceptance. PF attachment chemistry L2 remains unassessed. Physical-device and child observation belong to Task⑥.


## Static campaign declared before execution

Three viewports (360×780, 390×844, 1280×800), two motion modes, DPR1 all25 routes, DPR2 the16 distinct C01–C09/S10–S16 routes. Twelve jobs; each one actual FEED/pointer execution per route. At each completed actual sample: overview PNG and complete40 yaw/pitch masks, then at most one selected atom+shell focus per actual atom, each the same40 directions when unresolved targets remain. No camera motion, roll addition or geometry solve during this static campaign. Static readback never enters Finite/Stage B performance windows. Every view and failed target remains recorded. Comparison states are traversed with actual pointer controls and tested through close/reopen and resize. A07 ring simultaneity, residual target IDs and local witnesses are explicit. Raster luminance and continuous-lane raster grading are still pending; masks alone do not certify them.

Independent GitHub review of first source found stale comparison identity after close/reopen and a missing active-comparison resize fit. The next implementation reconstructs comparison on reopen and refits its separate display group on resize; actual comparison state lifecycle tests accompany these changes.


First candidate `d2029ff`: Stage B strict PASS and mobile/desktop13-pointer plus integrated gameplay PASS; Finite comparison FAILS preflight moduleFetchCount148 versus expected146, so timing acceptance is not claimed. Observation code is consolidated into the existing presentation module; the comparator and exact baseline+one module contract remain unchanged. Static source `9f7a873` fails at PET with fit=null in mobile conditions; prior completed10 routes have all40 mask coverage, but no A06/continuous-raster certification. Failure-input capture and one direct360×780 PET diagnostic are added before any root-cause claim. A DPR2 PAA pointer failure records a27.74px reactive-site offset despite the pointer at target; static campaign pointers now make exactly two corrections using the visible incoming/target indicators within the same gesture, retaining the existing acquisition and geometry gates.


The initial null assertion was subsequently located at `displayGraph.layoutUnitCount`, **before the fit assertion**. It signifies a missing verified layout/display-error boundary, not evidence of a camera fit defect. Earlier ledger shorthand "fit null" is superseded by this distinction. Actual Core Sample/source coordinates and generator diagnostics are captured before assertions and replayed directly into the protected geometry API. No geometry tolerance or camera threshold is changed to conceal this failure.


Independent review of `6400361` found that a comparison could fall through to ordinary canvas gestures and grab hidden byproducts/change the shared camera. The next repair rejects canvas pointer ownership in comparison/concept states and tests real two-finger events. Module-budget repaired source `1daf130` passes preflight but FAILS mobile Finite normal/reduced P95 and maximum-frame gates; desktop timing checks pass. Redundant identical static-frame GPU submissions and single-lane transforms during pure group motion are removed, while real RAF callbacks, dynamic frames, geometry, resources, timer and comparators remain unchanged. The new submission/skip counters make that work explicit; no frame is synthesized or dropped from the raw timing evidence. Full raster jobs depend on the short actual-pointer/compare diagnostic so a known state/input failure blocks expensive dependent acceptance instead of producing misleading partial passes.
