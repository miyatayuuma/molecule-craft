# Local finite polymer 3D — Task① canonical authority

## 1. Objective, scope and authority hierarchy

This document is the normative foundation for the **new local-fragment Tasks①–⑥**. Unqualified task numbers in historical documents refer to the **former presentation Tasks①–⑪**, not this roadmap. Task① changes documentation only; it neither certifies a finished new viewer nor starts Tasks②–⑥.

The product MUST show exactly the actually synthesized finite fragment as a readable, rotatable ball-and-stick model. It MUST NOT add synthesized-looking units to approximate a reference image. The final product requires later implementation and acceptance on main.

Authority, in decreasing order within each domain:

1. The project requirements and explicit decisions in §10 govern the new product direction. They do not rewrite chemical results.
2. Exact route/environment/cadence/evidence data and the guarded polymerization Core determine reaction results. The resulting `sample.fragment` is the runtime chemical graph authority.
3. `data/polymer-fragment-authority.json` determines **static Encyclopedia illustrations**, with its own provenance; it is not a replacement runtime Sample graph.
4. Layout functions derive presentation coordinates; the viewer owns transient meshes, transforms and controls. Neither may redefine chemistry.
5. Earlier plans, screenshots and CI records explain history only. They cannot override current source or serve as newly executed validation.

The [all-25 route matrix](polymer-local-fragment-route-matrix.md) is part of this contract. Source keys S1–S15 resolve in §13. MUST/MUST NOT are requirements; “observed” describes inspected baseline behavior; “validation target” does not assert a demonstrated defect.

## 2. Verified GitHub baseline and source SHAs

Inspection date: 2026-10-18. A fresh local clone had clean `main`; a dedicated branch `docs/polymer-local-fragment-task1` was created from the fetched main, with no inherited local edits.

| Authority | Verified value / significance |
|---|---|
| Starting main | `c2b106ee97a4148084507fc1d3e3eaab61759062` (tree `1586d8213034c43fbc9abf1ecc5b25c331b26273`) |
| Former Task⑪ merge | `c6cc7b0b15eff565a12f5d5f596d355051c373b8`, [PR #342](https://github.com/miyatayuuma/molecule-craft/pull/342) |
| Former Task⑩ merge / immutable performance baseline | `4bc202c0eb1f51de0350c3a0b4be36c7178cba53`, [PR #341](https://github.com/miyatayuuma/molecule-craft/pull/341) |
| Resources future-schema protection | Starting main above, [PR #344](https://github.com/miyatayuuma/molecule-craft/pull/344); preserve it |
| Independent recovery PR | [#345](https://github.com/miyatayuuma/molecule-craft/pull/345), OPEN/unmerged; HEAD `95f3fd1bf0334be32ca8d1b095a0956d2f14582d`; 0 unresolved review threads at preflight |
| #345 actual acceptance | Run [38742853900](https://github.com/miyatayuuma/molecule-craft/actions/runs/38742853900): finite and paired Stage B checks FAILED. Later skipped checks do not replace those results. Repository and FIELD checks succeeded on that candidate. These are remote historical results, not Task① executions. |
| Other open PR | [#189](https://github.com/miyatayuuma/molecule-craft/pull/189), navigation/Collection work; no intended documentation-file overlap |
| Documentation overlap | #345 and #189 changed-file lists contain none of this Task①'s documentation files. Source overlap must still be reconciled before later implementation. |

#345 contains C9 footer reservation and WebGL same-buffer resize guards. These are **not on the inspected main**. This task does not copy, modify, merge, close or restart that PR. Merge publication, exact resulting main SHA, fresh review and check outcomes belong to the Task① PR record; the starting source baseline above remains immutable and is not relabeled as the merge SHA.

## 3. Historical Tasks①–⑪ reconciliation

The former [rebaseline](../planning/polymer-presentation-rebaseline.md) was audited at `7d58d91fcaeee5ee7b3998027814e4ae5e767e28`. Its “current production” statements describe that tree only. The source history below was inspected specifically to establish replacement/deletion, not to repeat performance diagnosis.

| Former task / merge authority | Original objective and implemented disposition | Ownership today / retained reuse |
|---|---|---|
| Predecessor scale-up, [#329](https://github.com/miyatayuuma/molecule-craft/pull/329), `d2ee2f6126413117be0a752196f9e136dafce8df` | Early PE display scale-up, later superseded by continuity work. **RETIRED**. | No supported scale-up owner. Finite chemistry remains S1–S3. |
| ① Growth continuity, [#330](https://github.com/miyatayuuma/molecule-craft/pull/330), `92c2ce0e394c7b3440e0a7d786fdb94dc44aeffe`; refinements #332/#333 | PE finite seed → synthetic repeat incorporation → coarse chain/LOD/camera scale-out. Later revisions reached 72 display units/points in the rebaseline description; not 72 real reacted units. **RETIRED**. | `polymer-growth-plan.js` / cinematic removed at former ⑨. Preserve only real source mesh continuity in S4. |
| ② Static morphology, [#331](https://github.com/miyatayuuma/molecule-craft/pull/331), `a25702d66ee00efc1a66989ed64488510925df93` | 25 profiles / five visual archetypes; static multi-chain material scene, automatic production reachability only for PE. Other previews were localhost probes. **RETIRED**. | Authority/plan/renderer removed at ⑨. No morphology profile is a current requirement. |
| ③ Chain→morphology bridge, [#334](https://github.com/miyatayuuma/molecule-craft/pull/334), `7d58d91fcaeee5ee7b3998027814e4ae5e767e28` | PE centerline registration, temporary tube, camera transition and morphology reveal/hold before Bay. **RETIRED**. | Bridge plan/renderer and state removed at ⑨; shared general camera survives in S4. |
| ④ Rebaseline audit, [#335](https://github.com/miyatayuuma/molecule-craft/pull/335), `4e33021d46ecb2c345c7c01054af9b38e0e4b85a` | Chose actual finite samples and structural Encyclopedia images. **HISTORICAL-ONLY** as an execution plan; finite/no-bulk decision retained. | This document supersedes its future task instructions. Keep its historical evidence. |
| ⑤ Simplification, [#336](https://github.com/miyatayuuma/molecule-craft/pull/336), `3050fed9c89f16aed19c2323db94fef5f9f9765e` | Bypassed synthetic spectacle/Bay; retained central finite sample and bounded completion. **ACTIVE**, with layout/controls improved by ⑪. | S4 `renderPolymerGraph`, `finishPolymerSample`, S7 discovery. |
| ⑥ Fragment authority, [#337](https://github.com/miyatayuuma/molecule-craft/pull/337), `a40a373456194c85c659b49a75b0ed0c600fe268` | 25 validated static drawing inputs: 19 repeat, five copolymer local motifs, one independent PF network motif. **ACTIVE**. | S9. Reuse source/port/provenance validation for illustrations, never substitute its graph for a live sample. |
| ⑦ 2D pilots, [#338](https://github.com/miyatayuuma/molecule-craft/pull/338), `4631312ac63b2b0db09992fd47036d1aa99fd90f` | Nine structure SVG pilots. **REPLACED** pilot-only rollout boundary; renderer/validator **ACTIVE**. | S10; the old nine-only narrative in the Task⑦ record is historical. |
| ⑧ 25-entry rollout, [#339](https://github.com/miyatayuuma/molecule-craft/pull/339), `43c7a1baf7fcb25d2d88b522c0a18b37f172d3d3` | All 25 SVGs and reviewed structure/property/application/caution text. **ACTIVE**. | S8–S10. Collection is static SVG, not a cached runtime 3D sample. |
| ⑨ Cleanup, [#340](https://github.com/miyatayuuma/molecule-craft/pull/340), `3a6eec8eea889fd59e661ec802a784a1788717a9` | Deleted seven runtime modules, old probes/tests/profiler/docs/evidence; replaced workflow with finite validation. **ACTIVE** removal boundary. | S14 negative reachability test protects removal; no restoration. |
| ⑩ Integrated closure, #341 / SHA in §2 | Integrated FEED→sample→discovery→save→Engineering→FIELD plus performance evidence. **HISTORICAL-ONLY** acceptance record; current tests **ACTIVE**. | S15 and existing workflow/comparators. Its no-generalized-3D non-goal was subsequently superseded by ⑪. |
| ⑪ Finite 3D, #342 / SHA in §2 | Added finite XYZ layout, perspective fit and sample-group orbit/zoom/reset without extending chemistry. **ACTIVE**. | S4–S6; this is the implementation foundation, not work still waiting to be invented. |

## 4. Retired versus retained inventory

| Subsystem | Classification / production reachability | Current boundary and evidence |
|---|---|---|
| Hero-chain / synthetic extension / LOD scale-out | **RETIRED**, unreachable | No `src/polymer-growth-plan.js` or `src/reaction-lab-polymer-cinematic.js`; S14 checks references across production/build/PWA. |
| Static morphology | **RETIRED**, unreachable | No `src/polymer-morphology-authority.js`, `-plan.js`, `-renderer.js`. No retained live material scene. |
| Chain→morphology bridge | **RETIRED**, unreachable | No `src/polymer-morphology-bridge.js` or `-bridge-renderer.js`; no bridge camera/hold state. |
| Sample Bay overlay/docking/per-frame layout | **REPLACED**, old path unreachable | Replaced at #336 with central bounded completion. S4 has no Bay layout calls; retained `sampleId` is not a Bay feature. |
| Old preview probes and morphology tests/profiler | **RETIRED** | Cleanup commit deletes them; current `polymerDisplayBounds`/`polymerResourceSnapshot` inspect only finite layout/lifetime, not morphology. |
| Deleted growth/morphology/bridge design documents | **HISTORICAL-ONLY** | Read in Git at the task merge SHAs above: [growth](https://github.com/miyatayuuma/molecule-craft/blob/92c2ce0e394c7b3440e0a7d786fdb94dc44aeffe/docs/polymer-growth-continuity.md), [morphology](https://github.com/miyatayuuma/molecule-craft/blob/a25702d66ee00efc1a66989ed64488510925df93/docs/static-polymer-morphology.md), [bridge](https://github.com/miyatayuuma/molecule-craft/blob/7d58d91fcaeee5ee7b3998027814e4ae5e767e28/docs/polymer-morphology-bridge.md). Do not restore absent paths. |
| Exact FEED, graph edits, byproducts, source meshes | **ACTIVE**, all 25 routes | S1–S4. Their continued presence does not revive synthetic repeats. |
| Finite 3D layout and 2D finite fallback | **ACTIVE** | S5 preferred, S6 fallback through S4. Neither adds graph atoms. |
| Static 25-entry Encyclopedia pipeline | **ACTIVE**, build-time | S9/S10 → SVG → S8. No live 3D coordinate sharing. |
| Completion/discovery/Collection/Engineering/FIELD | **ACTIVE** | S4/S7/S8/S11/S12. Preserve all IDs and progression semantics. |

## 5. Current 25-route finite chemistry contract

Fresh route enumeration and actual Core replay confirm **25 unique route IDs / 25 unique polymer IDs / 25 Encyclopedia IDs**; **five samples use three source instances and twenty use four**. The matrix is exhaustive, not a pilot list.

`completionEvidence.unitCount` counts **consumed source molecule instances**, not necessarily chemical repeat units. PET's four inputs are two acid and two glycol molecules; PF's four inputs are two phenols and two formaldehydes. Neither is four complete repeat units. `representativeSequence` is the actual bounded gameplay sequence, not evidence of bulk sequence statistics or ratios.

S1 validates exact unique Feed sets, catalog ownership, environment, cadence and evidence. S2 reserves real instances, performs manual/automatic guarded edits and checks connectedness, valence, partition, element/charge conservation, byproducts, required features and completion counts. S3 neither creates atoms nor guesses products from coordinates. Inherited generic 29-reaction Stage B chemistry remains separate from these polymer routes.

The matrix records emitted graphs, including H, endpoint orders and ring cycle rank. Side groups are not evidence of branched macromolecular chains. No current sample supplies a three-arm inter-unit network junction. PF has a methylene-linked two-ring fragment plus a hydroxymethyl group and one water product; `presentation.kind='network'` / `networkCapabilities` describe capability, not extra actual crosslinks. The Encyclopedia's independent four-ring / three-bridge motif MUST remain explicitly separate.

`evidence.interUnitLinks` counts committed growth/link steps. It is **not generally the total number of bonds crossing atom-origin instance IDs**: PF has three committed links but four such bonds, because a transferred phenol H remains attached to formaldehyde-derived O. Origin grouping is provenance, not an infallible chemical-residue partition. Task④ MUST use actual bonds and MUST NOT infer branch degree from a raw origin quotient alone.

## 6. Finite graph and atom-origin invariants

- `sample.fragment.atoms`, `.bonds` and `.atomOrigins` MUST remain unchanged by layout/rendering. Preserve elements/charges, index ordering, endpoints, bond orders and origin tuples. No hidden/extra atom, fake terminal cap, ghost unit or graph “tidying”.
- Each main-graph atom maps to exactly one `(instanceId, sourceAtomIndex)`; source atoms partition between fragment and actual byproducts. Condensed-away water atoms MUST NOT reappear in the main sample.
- Core `graphFromComponent()` assigns dense atom IDs anew after a reaction edit. Stable cross-step provenance is the origin tuple, **not a numeric atom ID assumed to survive every chemistry commit**. Preserve the finalized Sample's IDs/index mapping; do not renumber it in presentation.
- A `PolymerSample` contains `polymerId`, `routeId`, `batchGeneration`, `sampleId`, `fragment`, `representation`, `evidence`. It is ephemeral runtime evidence, not an inventory molecule, Stage B rigid body or persisted 3D object.
- Continuations are Core valence-deficit metadata, not synthesized atoms/bonds. The six condensation samples and PF have zero declared deficit continuations despite route-level marker categories. Do not manufacture ports from that category.
- Layout coordinates MUST NOT replace the graph, enter the molecule DB, influence product matching, change source-origin evidence or be used as a new reaction-authority cache.

Sources: S1 `validatePolymerizationRouteAuthority`; S2 `graphFromComponent`, `validateSourcePartition`, `validateMainGraph`, `applyStepPlan`, `makeSample`; S3 guarded edits; fresh matrix replay.

## 7. Current geometry, layout and rendering ownership

Production dataflow (different arrow paths retain different authority):

- FEED → exact route / reserved instances (S1/S4) → guarded reaction edits (S2/S3) → transformed finite graph → runtime `PolymerSample` (S2).
- Finite graph + source local preview poses/origins → XYZ plan (S5, or S6 fallback) → existing atom meshes/bond cylinders in Three.js (S4) → completion and ready events → discovery/Collection (S7/S8).
- Separately: static fragment authority (S9) → deterministic 2D structure layout/SVG (S10) → Encyclopedia image (S8). No runtime XYZ array flows here.

| Responsibility | Observed current implementation / reuse constraint |
|---|---|
| Source coordinates | S4 `createInstance()` uses prepared preview or 190 preview steps, centers atom coordinates by mass, stores `item.record`; `initializePolymerBatch()` captures those local records by instance ID. Source points are not continually sampled world-space docking positions. |
| XYZ generation | S5 `createPolymerFragment3DLayout()`: validates input/origins/endpoints; groups by source instance; traverses actual cross-origin bonds; picks origin-key-derived azimuths; uses radius/order-based link targets and simplified local angle/steric/source-plane restraints; centers output XYZ. |
| Determinism | Same graph, origins (including instance-ID strings), source poses, iteration setting and implementation yield the same result. Identical polymer names alone do not guarantee identical coordinates across batches. Hashing is provenance-based, not thermal sampling. |
| Bounds and iteration | Default 96 relaxation iterations; implementation clamps a caller request to 1–160. “At most 96” is only the default viewer call, not the API maximum. Intramonomer lengths are preferred from source poses, not optimized from a calibrated force field. |
| Acceptance / fallback | Nonfinite coordinates, disconnected source-unit placement, missing source poses, excessive bond error or severe overlap reject the plan. S4 uses S6 finite layout with diagnostics. Malformed input may throw before a diagnostic result; caller catch paths are not proof of a complete safe display. Later geometry work must exercise them. |
| Mesh identity | S4 `mergePolymerSourceAtoms()` attaches actual reserved monomer meshes by origin tuple; `atomByGraphIndex` maps graph endpoints. `renderPolymerGraph()` updates on committed graph changes, not every RAF; `updatePolymerGraphVisual()` interpolates an already generated target. |
| Bond grammar | `updatePolymerBondVisuals()` uses cylinders between graph endpoints, one lane for order <2, **two lanes for every order >=2**. Thus PAN's four and NBR's one order-3 bonds are graph-preserved but visually indistinguishable from double bonds. Confirmed presentation limitation **L1**, owned by Task⑤; no runtime fix in Task①. Source aromatic rings are explicit alternating bonds, not a newly assigned stereo/resonance graph. |
| Framing / controls | S4 `fitFinitePolymerToWorkArea()` uses XYZ extent + atom radii, a conservative sphere, perspective/near/far constraints and safe canvas inset. Existing camera stays; completed group is transformed. Ready drag rotates the group except where a remaining monomer owns the hit; wheel/pinch scale it; reset restores fitted transform. User zoom may intentionally leave initial safe rectangle. Preserve input ownership. |
| Allocation / disposal | Existing source spheres/materials are reused during synthesis. Bond mesh pool grows as needed, hides then prunes surplus. Close saves group transform and disposes GPU resources via `suspendPolymerVisual()`; reopen rebuilds sphere resources on the retained mesh identities and bonds from the same graph/plan. Purge/clear/dispose release resources, RAF, events and observer. No persistent mesh cache. |
| Resize / RAF | Baseline `resize()` unconditionally calls `renderer.setSize` for nonzero canvas rect, updates camera aspect; ResizeObserver and completion fit call it. Initial DPR cap is set at viewer creation. There is no C9 footer reservation/same-buffer guard on this main. Task⑤ must reconcile #345 and preserve its eventual repairs, rather than claim they are already integrated. |
| 2D versus 3D | S6 retains an outdated “shared ... live samples and generated SVGs” comment and exported SVG helper, but the current generator S10 builds all 25 static structures independently. S6 is live fallback, **not the current 25-SVG generator**. Its XY relaxation with retained source Z is not molecular 3D authority. Documentation corrects ownership; source comment is untouched. |

The layout is a bounded presentation heuristic, not a force field, molecular dynamics, energy minimum or experimental conformer. Existing tests check graph identity and bounded errors; they do not prove every bond angle, nitrile linearity, stereo correctness or legibility on all devices.

## 8. Completion, discovery and persistence boundaries

| Information | Owner / lifetime / required preservation |
|---|---|
| Source, transformed graph and byproduct atom partition | S2/S3 transaction; runtime chemical evidence, never renderer-authored |
| Sample identity / route counts / feature evidence | S2 `makeSample()`; retained during the current Lab batch, no reload Sample schema |
| XYZ, group orientation/scale, fit, animation, mesh pools | S4/S5; transient view state, preserved through close/reopen in memory only |
| Sample registration event | S4 `finishPolymerSample()`: emits route/polymer/sample/batch/source-instance/byproduct identity; **does not serialize the entire fragment** into the event |
| Discovery versus reveal | S7 `handlePolymerSampleEvent()` validates and registers polymer/byproduct discoveries immediately, queueing `awaiting-present`. `sample-present` gates Collection reveal, not initial registration. Early `sample-dismiss` cancels reveal without undoing discoveries; duplicate/stale sample/batch handling remains. |
| Persistent polymer discoveries | S11 schema 1, `molecule-craft.polymer-collection.v1`: `{id, at, order}` entries only. No graph, `sampleId` or coordinates. |
| Persistent resources / molecule discoveries / Workspace | S12: resources schema 9 plus independent Collection/Workspace keys and migrations; protect future schemas, reset journals/epochs and old-tab write guards. No layout-owned persistence. |
| Encyclopedia structure metadata / narrative | S8–S10: static catalog, content and drawing-authority source, independent of a particular live Sample or pose |
| Engineering / FIELD | S12: eligibility consumes discoveries/routes plus existing costs/progression; fabrication/collector settings belong to resources. Transient Samples are not stock or yield. FIELD effects do not read XYZ. |

**Decision: no save-schema update, no persisted presentation coordinates and no geometry-driven migration are needed or permitted by Tasks④/⑤.** No exception was found. Presentation changes MUST NOT change reaction results, unlock conditions, collection identity, permanent chemistry, fabrication eligibility/cost, resources or saved progress. Registration timing and reveal gating MUST remain separate.

The completion feedback targets remain **650 ms normal / 250 ms reduced motion**, real RAF delivery and the existing animation-readiness conditions. These are not guarantees that every observed wall-clock completion equals its timer target. Preserve event order, close/reopen, known-entry action, next FEED/purge, pointer docking and automatic fallback.

## 9. Reference-image interpretation and scientific limits

The supplied reference expresses depth, separation, visible atoms/bonds and a chain-like local shape. It does not authorize its atom count, chain length, complete coil or material-scale structure. Improve the exact existing graph's positions, lighting, occlusion, framing and operation. If three/four source molecules cannot look like a long photographed chain, accept that scale limit and label the actual fragment; do not fabricate growth.

Connectivity/bond orders/origins are certain **within the implemented reaction model**, not an assertion that all route chemistry has independent experimental validation. Coordinates are an illustrative possible pose. No tacticity, cis/trans distribution, bulk comonomer ratio, random/block sequence, crystalline packing or cured crosslink density may be inferred from one generated example. Keep route qualifiers even if absent on another route; absence is not positive stereo authority.

PF inspection additionally found `phenolAttachmentSite()` selects the first available carbon-bound H by atom index, without an explicit ortho/para filter. Replay attaches the final hydroxymethyl carbon to source phenol C2 (OH is on C0); see S2 and `data/molecules.json` record `phenol`. This is a **confirmed site-selection implementation fact / chemistry-validation target L2**, not an independently completed chemistry-defect diagnosis. Do not describe it as an independently reviewed network structure or silently replace it with the Encyclopedia motif. If chemical review establishes a route defect, a separately scoped chemistry change is required before claiming that route chemically validated; graph-preserving Tasks④/⑤ cannot repair it by moving atoms or selecting a different graph. Task② must distinguish implemented observations from general network teaching. This does not leave the Task① display-authority decision open.

## 10. Explicit final design decisions

| ID / resolved issue | Normative decision and rationale | Affected components / evidence |
|---|---|---|
| D1 — Image versus sample | Render exactly the actual finite graph. No unit extension, implicit reacted copies, longer hero strand or synthetic Feed. Visual ambition is bounded by actual synthesis. | S1–S5; explicit product requirement |
| D2 — Local versus whole polymer | Call it the actual finite gameplay fragment, with representative local interpretation where applicable. Never a reconstructed complete macromolecule or unique physical conformer. | S2 sample evidence; S5 heuristic; route qualifiers |
| D3 — Graph versus coordinates | Graph and provenance are read-only inputs; XYZ is disposable modeled geometry. Keep both authorities distinct. | S2/S3/S5; §6 |
| D4 — Complex topology | Draw all actual branches, rings and multiple bonds; do not straighten by deleting bonds or invent a PF junction. Side groups, origin-transfer edges and material-level networks must be distinguished. | Matrix replay; S2; L1/L2; S9 independent PF motif |
| D5 — 2D versus 3D | Reuse chemical source references, not SVG coordinates as physical geometry. Keep static drawing input/outputs separate; finite fallback remains until an equivalent safe fallback is validated. | S4/S6/S9/S10 |
| D6 — Completion and interaction | Preserve current synthesis/docking, 650/250 targets, event identity/order, group controls and lifecycle; improve geometry/renderer behind that boundary. | S4/S7; #345 reconciliation in §2 |
| D7 — Historical authority | Retain useful history, label its baseline and supersession; never restore removed modules as reusable production code. | §3/§4; S14; rebaseline history |
| D8 — Persistence/gameplay | No save schema, coordinate persistence, migration, progression or resource change. Discovery data survives independently of meshes. | S7/S11/S12 |
| D9 — Reproducibility/failure | Same full inputs must regenerate the same view; malformed/unconverged inputs must fail visibly safely without altering chemistry. Test fallback paths; do not treat present metric checks as exhaustive chemistry proof. | S4/S5/S13 |
| D10 — Acceptance honesty | Fix L1 in Task⑤; validate L2 separately from coordinates. Later tasks must retain strict thresholds/real RAF and disclose missing evidence. #345 failures are not accepted results. | S13/S15 and #345 checks |

## 11. Reuse versus replacement boundary for Tasks④/⑤

**Task④** may replace/improve S5's placement, angle classification, torsions, overlap handling and diagnostics behind the existing graph/origin contract. Reuse route fixtures, source-preview adapter and graph identity checks. Test cross-origin transferred atoms, aromatic restraint, nitrile/carbonyl local geometry, heterogeneous source molecule sizes, exact deterministic inputs and invalid-input behavior. Current `angleFor()` reduces any multiple-bond center to a 120-degree target; nitrile-specific geometry therefore needs explicit evaluation. This is a validation target, not a fresh measured angle failure. No chemical-route repair or new source graph is authorized by a coordinate change.

**Task⑤** may improve S4's atom/bond resources, order-aware bond grammar (L1), materials/light, fit/occlusion, touch controls, resize/DPR and disposal. Preserve existing source-mesh identity mapping, read-only graph, docking hit ownership, completion/discovery events and ordinary molecule camera behavior. Reconcile against then-latest main/#345 before touching resize or sampling; do not reintroduce completion buffer synchronization. Pooling/instancing choices require evidence, not assumption.

Neither task owns Encyclopedia graph replacement, resource economics, source atom remapping, new persistent coordinates, route expansion or resurrection of morphology. Current 2D assets and their independent PF motif remain supported. Exact ball/stick sizes, camera numbers, visual presets and educational copy are intentionally delegated to Tasks②/③.

## 12. Non-regression requirements

- Keep all 25 exact routes, environment/process qualifiers, manual/automatic cadence, guarded edits, finite graphs, origins, orders, byproducts, evidence and identity.
- Keep discovery deduplication, registration/reveal separation, known-entry access, saved discoveries, future-schema protection and reset/old-tab behavior.
- Keep Collection/Encyclopedia/Engineering/FIELD and current PWA output consistency.
- Keep real pointer operation, completion, re-FEED, close/reopen/purge/dispose and normal/reduced-motion behavior on mobile/desktop.
- Do not relax Stage B fixed workload/steps/trials or its `8.333333333333334 ms` hard budget; do not change finite comparator thresholds/baseline/sampling to hide a failure. Keep 650/250 targets and real RAF; never insert synthetic frames.
- No per-frame layout solve, synthetic unit resource, retained retired module or unbounded geometry/material allocation. Measure renderer CPU submission, RAF intervals and GPU execution separately; unavailable metrics remain unmeasured.

## 13. Evidence links and Task① validation results

All relative source links below refer to the inspected main SHA in §2. Symbols identify exact ownership without depending on mutable line numbering. Historical source links are pinned to historical merge commits. The matrix additionally links each route's exact source line at the starting SHA.

| Key | Source and inspected symbols |
|---|---|
| S1 | [route data](../../data/polymerization-routes.json), [route compiler](../../src/polymerization-routes.js): `validatePolymerizationRouteAuthority`, `resolvePolymerizationRoute`; [catalog](../../data/polymers.json), [content](../../data/polymer-encyclopedia.json) |
| S2 | [polymer Core](../../src/reaction-lab-polymerization.js): `graphFromComponent`, `validateSourcePartition`, `validateMainGraph`, `vinylPlan`, `dienePlan`, `mixedInitialChainPlan`, `epoxidePlan`, `condensePlan`, `phenolAttachmentSite`, `planFor`, `makeSample` |
| S3 | [graph edits](../../src/reaction-graph-edits.js): `applyGuardedGraphEdits`, `graphConnectedComponents`, `validateGraphAtomConservation` |
| S4 | [viewer](../../src/reaction-lab-viewer.js): `createInstance`, `polymerPresentationPlan`, `renderPolymerGraph`, `mergePolymerSourceAtoms`, `updatePolymerBondVisuals`, `fitFinitePolymerToWorkArea`, `finishPolymerSample`, `advancePolymerCompletion`, `suspendPolymerVisual`, `restorePolymerVisual`, `resize`; [startup](../../src/app.js) `createReactionLabViewer` / sample listeners |
| S5 | [XYZ layout](../../src/polymer-fragment-3d-layout.js): `buildUnitTransforms`, `angleFor`, `relaxGeometry`, `createPolymerFragment3DLayout` |
| S6 | [finite fallback](../../src/reaction-lab-polymer-presentation.js): `createPolymerPresentationPlan`, legacy `polymerPresentationSvg` export |
| S7 | [discovery](../../src/reaction-lab-discovery.js): `validatePolymerSampleEvent`, `handlePolymerSampleEvent`, `handlePolymerSamplePresent`, `handlePolymerSampleDismiss` |
| S8 | [Collection](../../src/collection-ui.js): `renderPolymerDetail`, `openPolymer`, `registerDiscoveredPolymer`; [Encyclopedia model](../../src/polymer-encyclopedia.js) |
| S9 | [static fragment data](../../data/polymer-fragment-authority.json), [validator](../../scripts/polymer-fragment-authority.mjs), [authority explanation](../polymer-fragment-authority.md) |
| S10 | [asset build](../../scripts/build-collection-assets.mjs): `generatePolymerStructureAssets` call; [structure SVG](../../scripts/polymer-structure-svg.mjs): `POLYMER_2D_PRODUCTION_IDS`, `createPolymerStructureLayout`, `generatePolymerStructureAssets` |
| S11 | [polymer state](../../src/polymer-collection-state.js): `snapshot`, `registerDiscoveredPolymer`; [persistence](../../src/polymer-collection-persistence.js): `save`, `load`, future-schema guards |
| S12 | [Workspace/future-resource guards](../../src/workspace-persistence.js), [resource persistence](../../src/veil/resources-persistence.js), [molecule Collection persistence](../../src/collection-persistence.js), [Engineering](../../src/engineering-fabrication.js): `compileEngineeringAuthority`, `fabricationEligibility`; [resources](../../src/veil/resources.js) `configureEngineering` / fabrication; [collector applications](../../src/veil/collector-applications.js) |
| S13 | [all-route fixtures](../../tests/reaction-lab-polymerization-fixtures.test.mjs), [geometry tests](../../tests/polymer-fragment-3d-layout.test.mjs), [browser tests](../../tests/reaction-lab-polymer-browser.test.mjs) |
| S14 | [legacy removal gate](../../tests/reaction-lab-legacy-removal.test.mjs); [exact deletion commit](https://github.com/miyatayuuma/molecule-craft/commit/3a6eec8eea889fd59e661ec802a784a1788717a9) |
| S15 | [finite workflow](../../.github/workflows/reaction-lab-finite-polymer-validation.yml), [repository workflow](../../.github/workflows/repository-validation.yml), [Stage B comparator](../../scripts/compare-reaction-lab-stage-b.mjs), [finite comparator](../../scripts/compare-polymer-performance.mjs), [former Task⑩ evidence](../polymer-integrated-production-closure.md), [former Task⑪ evidence](../polymer-3d-presentation.md) |

CI applicability fixed before creating the Task① PR: live GitHub reported `main.protected=false` and repository/inherited rulesets `[]`. Task① requires route/matrix/document consistency, scoped diff, independent review and integration verification; any subsequently discovered required GitHub gate must also pass. Existing workflows run unchanged. A failed automatic check is not globally exempted: inspect its exact cause and unchanged runtime/data/assets/tests/workflow authority. Only a demonstrated independent, pre-existing performance failure may remain separate under the explicit Task①/#345 exception; a Task① regression or unexplained new failure is not waived. Keep any failure recorded as FAIL, with no threshold change, skip or outcome-driven retry. A successful documentation merge must never be described as overall production performance acceptance.

Task① local checks (Node v24.19.0; current checkout, no runtime/data edits):

| Check | Result / actual scope |
|---|---|
| Matrix inventory + actual Core replay, using Appendix A | PASS: unique IDs/set equality/sequence unit counts and all graph/count/port/order/origin-bond metrics match 25 rows. No assumption from names. |
| `node --test tests/polymerization-routes.test.mjs tests/reaction-lab-polymerization-fixtures.test.mjs tests/polymer-fragment-3d-layout.test.mjs tests/reaction-lab-legacy-removal.test.mjs tests/reaction-lab-polymer-discovery.test.mjs tests/polymer-collection-persistence.test.mjs` | PASS: 42 tests, 0 failures, 0 skips. Includes 25 route fixtures and all-25 geometry replay, missing-source fallback diagnostics, removal/discovery/save boundaries. |
| Geometry evidence from that execution | PASS within existing test assertions: 25/25 accepted, fallback 0, severe overlaps 0; maximum bond error 0.2505 in current presentation units, maximum aromatic-plane deviation 0.0769. These checks do not certify all local angles or physical-device visuals. |
| Repository hygiene / whitespace / links / scope | PASS: hygiene 772 files, 137 reachable production modules, 0 warnings; `git diff --check`; 47 relative Markdown links resolve across seven Task① documents; seven-file documentation-only allowlist. No general Markdown linter is configured. Appendix A is the executable matrix check. |
| Offline consistency | PASS: `node scripts/build-precache.mjs --check` and `node tests/pwa.test.mjs`; 353 hashed assets verified, no generated asset changes. |
| Fresh browser/GPU/paired Stage B campaign | NOT_RUN locally; not needed to validate a documentation-only authority. Existing GitHub workflows are allowed to run unchanged and their real outcomes are recorded separately. |
| New renderer/geometry/educational acceptance | NOT_APPLICABLE to Task①; Tasks②–⑥ own it. |
| Independent review / PR CI / merge / post-merge | Publication evidence belongs to the Task① PR and final report; no self-review or historical CI is claimed as independent approval or fresh passing CI. |

## 14. Task②–⑥ dependency and acceptance handoff

| New task | Exact inputs / required output / acceptance ownership |
|---|---|
| ② Educational standards | This authority + all 25 matrix rows, actual source graph, qualifiers and separate static examples. Define a small set of learning goals and classify every route's observable chain, substituent, ring, link, copolymer and network-capability features. Distinguish finite Feed instance count from repeat count and actual PF sample from its independent junction illustration. Define child-observation acceptance without asserting a user study already happened. No renderer change. |
| ③ Appearance/visual acceptance | Accepted Task② classification + current source/S13. Define ball/stick/material/color, depth/occlusion, mobile/desktop fit/zoom/reset and representative screenshots with objective pass/fail criteria. Include PAN/NBR triple bonds and PF caveat. No independent choice of extra chemistry or longer samples. No production change. |
| ④ Geometry | Accepted ②/③ + then-current S2 finalized graph and S5 boundary. Produce deterministic 25-route coordinates, exact graph/origin preservation, input/failure tests, length/angle/ring/overlap metrics and justified scientific limitations. Escalate confirmed chemistry defects separately; do not mask L2 with different coordinates. No save change. |
| ⑤ Renderer/UX | Accepted geometry + ③ visual contract + then-current S4/#345 authority. Complete order-faithful atom/bond rendering, framing, operation, completion, resize/DPR, disposal and real RAF profiling. Resolve L1. Retain exact graph and completion/discovery contracts; no hard-gate relaxation. |
| ⑥ Production acceptance | Accepted ①–⑤ + current main/PR reconciliation. Validate all 25 geometries/identities, mobile/desktop actual browser pointer and E2E including Collection/save/reload/re-FEED, normal/reduced motion, lifecycle/resources, strict Stage B/finite performance, repository/FIELD/PWA, independent review, merge and post-merge evidence. If scientific review confirms L2, its resolution/qualification must be explicit before chemical credibility is claimed. |

Task① closes only with a reviewed, validated documentation commit merged to main and exact merged files/SHA verified. Later implementation work (L1, L2 evaluation, full visuals/performance) is not hidden under a Task① PASS. Unresolved required Task① review/CI/merge gates mean **BLOCKED**; independent #345 failures alone do not reopen settled design or justify a performance waiver.

## Appendix A — reproducible matrix verification

Run from the repository root with Node. The script reads only production inputs plus the matrix and executes the actual DOM/Three.js-free Core. Columns `U`, `A/B/μ`, `O`, `P`, `X`, `W` are defined in the matrix. It writes nothing. Its checks supplement structural review rather than claim independent physical chemistry validation.

```js
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReactionLabPolymerizationCore, POLYMER_COMMIT_DWELL_MS} from './src/reaction-lab-polymerization.js';
import {validatePolymerizationRouteAuthority} from './src/polymerization-routes.js';
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const authority = await read('data/polymerization-routes.json');
const polymers = await read('data/polymers.json');
const content = await read('data/polymer-encyclopedia.json');
const ids = new Set([...authority.routes.flatMap(r => r.feedSpecies), 'water']);
const records = (await read('data/molecules.json')).filter(r => ids.has(r.id));
validatePolymerizationRouteAuthority(authority, {polymers, molecules: records});
const md = await readFile('docs/validation/polymer-local-fragment-route-matrix.md', 'utf8');
const rows = md.split('\n').filter(l => l.startsWith('| `') && l.includes(' / `'))
  .map(l => l.split('|').slice(1, -1).map(c => c.trim()));
const parsed = rows.map(c => ({polymer: c[0].match(/`([^`]+)`/)[1],
  route: c[0].match(/\/ `([^`]+)`/)[1], u: Number(c[1]),
  family: c[2].replaceAll('`', ''), graph: c[3], orders: c[4],
  ports: Number(c[5]), cross: Number(c[6]), water: Number(c[7])}));
assert.equal(parsed.length, 25);
assert.equal(new Set(parsed.map(r => r.route)).size, 25);
assert.deepEqual(parsed.map(r => r.route).sort(), authority.routes.map(r => r.routeId).sort());
for (const set of [polymers.map(p => p.id), content.map(p => p.id)])
  assert.deepEqual(parsed.map(r => r.polymer).sort(), set.sort());
const distribution = {};
for (const route of authority.routes) {
  const row = parsed.find(r => r.route === route.routeId);
  assert.equal(row.polymer, route.polymerId);
  assert.equal(row.u, route.completionEvidence.unitCount);
  assert.equal(row.u, route.representativeSequence.length);
  assert.equal(row.family, `${route.builder}; ${route.transformFamilies.join(', ')}`);
  distribution[row.u] = (distribution[row.u] ?? 0) + 1;
  const instances = route.representativeSequence.map((species, i) =>
    ({id: `u${i}`, species, batchGeneration: 1}));
  const core = createReactionLabPolymerizationCore({records,
    routes: authority.routes, sitePatterns: authority.sitePatterns});
  assert.equal(core.beginBatch({activeSlots: route.feedSpecies, batchGeneration: 1,
    instances, environment: new Set(route.environment.requires)}).ok, true);
  let result;
  for (let i = 1; i < instances.length; i++) {
    const start = i <= route.interactionCadence.manualSteps
      ? core.beginManualStep(instances[i].id) : core.beginAutomaticStep(instances[i].id);
    assert.equal(start.ok, true, route.routeId);
    result = core.advanceFixedStep(POLYMER_COMMIT_DWELL_MS);
    assert.equal(result.committed, true);
  }
  const sample = result.sample, g = sample.fragment;
  const adj = g.atoms.map(() => []);
  for (const b of g.bonds) { adj[b.a].push(b.b); adj[b.b].push(b.a); }
  const seen = new Set([0]), queue = [0];
  for (const a of queue) for (const b of adj[a]) if (!seen.has(b)) { seen.add(b); queue.push(b); }
  assert.equal(seen.size, g.atoms.length);
  assert.equal(row.graph, `${g.atoms.length}/${g.bonds.length}/${g.bonds.length-g.atoms.length+1}`);
  assert.equal(row.orders, [...new Set(g.bonds.map(b => b.order))].sort().join(','));
  assert.equal(row.ports, sample.representation.continuations.length);
  assert.equal(row.cross, g.bonds.filter(b =>
    g.atomOrigins[b.a].instanceId !== g.atomOrigins[b.b].instanceId).length);
  assert.equal(row.water, sample.evidence.byproducts.filter(b => b.species === 'water').length);
  assert.equal(new Set(g.atomOrigins.map(o => `${o.instanceId}:${o.sourceAtomIndex}`)).size, g.atoms.length);
  assert.equal(new Set(g.atomOrigins.map(o => o.instanceId)).size, row.u);
}
assert.deepEqual(distribution, {'3': 5, '4': 20});
console.log('PASS: 25 unique route rows, actual finite Core graphs and unit distribution');
```
