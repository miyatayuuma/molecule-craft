# Polymer Presentation Rebaseline — Task④ Audit and Task⑤–⑩ Contracts

## Authority and disposition

Audit baseline: remote main at 7d58d91fcaeee5ee7b3998027814e4ae5e767e28, confirmed from refs/heads/main at task start. This is the merge of PR #334. All source findings below refer to that exact tree.

Task① Polymer Growth Continuity, Task② Static Polymer Morphology, and Task③ Polymer Chain → Material Morphology Bridge are closed as implementations of their former brief. They are not a mandate to retain their visual product direction. This document supersedes their user-facing direction for future work while retaining their current implementation details as the audit baseline.

The new authority is:

- Reaction Lab teaches the actual finite polymerization: real Feed molecules, actual reactive sites, graph edits, repeat formation, and completion.
- The completion view retains only the route-authored finite PolymerSample fragment, completion feedback, and an Encyclopedia action. The route’s existing completionEvidence.unitCount is authoritative: current routes produce three- or four-unit samples. No generated units are added after the actual chemistry ends.
- Encyclopedia entries explain chemically correct repeat units or representative local motifs. No full-chain, whole-coil, or bulk-morphology 3D model is a production goal.
- Route recognition, finite graph chemistry, PolymerSample identity/evidence, discovery, collection save, and Engineering remain gameplay authorities.

This is an audit and a future implementation contract. No production code, chemistry graph, sample lifecycle, save schema, or rendering behavior is changed by Task④.

## Baseline facts

Current main contains 25 polymer catalog entries, 25 exact Feed routes, 25 encyclopedia entries, and 25 generated polymer SVG thumbnails. The morphology authority also has 25 rows across five display archetypes, but only polyethylene automatically enters the production long-chain/morphology path. All 25 plans can be viewed only by an explicit localhost test probe.

Seventeen catalog records have a repeatUnit display string. Eight have repeatUnit=null: ethylene-propylene-copolymer, phenol-formaldehyde-resin, polybutadiene, styrene-butadiene-copolymer, nitrile-butadiene-rubber, polyisoprene, butyl-rubber, and vinylidene-fluoride-hexafluoropropylene-copolymer. The repeatUnit strings are explanatory text; the finite transformed atom/bond graph and continuation ports are the structure authority.

The GitHub workspace had no usable local repository checkout, so local branch, staged/unstaged/untracked state and local test execution were unavailable. Remote branch and PR searches found no Task④ name collision or open polymer PR. The unrelated open PR #189 was left untouched. Remote-only source inspection and publication are used for this documentation change.

## A. Rebaseline decision

| Surface | Current production behavior | Future behavior |
|---|---|---|
| Reaction start | Exact route selected from the active Feed; actual monomer instances are reserved. | Keep unchanged. |
| Reaction steps | Pointer docking operates on actual reactive sites; fixed-step dwell commits finite atom/bond graph transforms; actual monomer atom meshes are carried into the fragment. | Keep and make this the visual center of the feature. |
| Completion | Every route creates a finite PolymerSample with route, sample, batch, atom-origin, link, feature, and byproduct evidence. PE then starts a display-only scale-up. | Keep Sample authority. Display only its exact route-authored finite graph. |
| PE post-completion spectacle | Four actual units remain as the visual seed; four readable visual Feed units are added; up to 68 more generated repeats reach 72 presentation units; coarse LOD and camera pullback follow; a static multi-chain model is bridged in. | Remove the entire synthetic extension, LOD, morphology, bridge, camera scale-out, and morphology hold path. |
| Sample Bay | A generated DOM overlay places the finite sample after the cinematic and holds it before discovery presentation. | Replace the Bay overlay with an in-chamber finite-fragment completion state. |
| Encyclopedia | Stable 25-entry catalog and independent discovery state; existing SVG is a 192×128 atom/bond thumbnail generated from the finite graph. | Preserve the entry and current data authority. Replace/upgrade its image to an annotated structure asset, not a full material model. |
| Gameplay authority | Discovery and fabrication depend on polymer IDs/routes, not on a displayed morphology or stored Sample mesh. | Keep unchanged; presentation must not be written into save state. |

### Source authority map

- Startup and production reachability: src/app.js, createReactionLabViewer dynamic import and createReactionLabDiscoveryCoordinator wiring (lines 121–132).
- Route and exact Feed authority: data/polymerization-routes.json; src/polymerization-routes.js, validatePolymerizationRouteAuthority, resolvePolymerizationRoute, polymerizationRoutes; src/reaction-lab-viewer.js, initializePolymerBatch and advancePolymerRuntime.
- Finite polymer graph: src/reaction-lab-polymerization.js, createReactionLabPolymerizationCore; src/reaction-graph-edits.js guarded graph edits; src/reaction-lab-viewer.js, reconcilePolymerCommit, renderPolymerGraph, mergePolymerSourceAtoms, finishPolymerSample.
- Task① extension: src/polymer-growth-plan.js, HERO_CHAIN_BUDGET, createPolymerGrowthAnchor, createHeroChainPlan, screenSpaceMolecularWeight, heroGrowthFrame; src/reaction-lab-polymer-cinematic.js, createPolymerCinematic; caller startPolymerCinematic and advancePolymerPresentation in src/reaction-lab-viewer.js.
- Task② morphology: src/polymer-morphology-authority.js, polymerMorphologyProfile; src/polymer-morphology-plan.js, createPolymerMorphologyPlan; src/polymer-morphology-renderer.js, createPolymerMorphologyRenderer.
- Task③ bridge: src/polymer-morphology-bridge.js, resamplePolylineByArcLength, createPolymerMorphologyBridgePlan, interpolatePolymerBridgeCenterline; src/polymer-morphology-bridge-renderer.js, createPolymerMorphologyBridgeRenderer; callers startPolymerMorphologyBridge and advancePolymerMorphologyBridge in src/reaction-lab-viewer.js.
- Finite presentation and thumbnail generator: src/reaction-lab-polymer-presentation.js, createPolymerPresentationPlan and polymerPresentationSvg; scripts/build-collection-assets.mjs.
- Sample event and presentation gate: src/reaction-lab-viewer.js, finishPolymerSample and sample-present/sample-dismiss dispatch; src/reaction-lab-discovery.js, validatePolymerSampleEvent and handlePolymerSampleEvent/Present/Dismiss.
- Catalog and entry UI: data/polymers.json, data/polymer-encyclopedia.json; src/polymer-catalog.js, src/polymer-encyclopedia.js, src/polymer-collection-state.js, src/polymer-collection-persistence.js, src/collection-ui.js.
- Downstream authority: src/engineering-fabrication.js and docs/architecture.md, Engineering fabrication.

## B. Runtime ownership inventory

Legend: KEEP is production gameplay or an existing supported entry point. MOVE / REPLACE means preserve the job in a smaller, scientifically grounded form. DELETE means it has no place in the future product and becomes removable at the listed task. “Production reachable” describes the current baseline, not the future design.

| # | Responsibility; source symbol | Caller → callee and production reachability | Owner, resource lifecycle, tests/probes and downstream dependency | Decision and risk |
|---|---|---|---|---|
| 1 | Exact route recognition; resolvePolymerizationRoute and polymerCatalog | app.js → Collection connection → reaction-lab-viewer initializePolymerBatch → polymerCore.beginBatch. Reachable on all 25 routes. | Route and Feed IDs are data authority; no renderer resource. Tests: polymerization-routes.test.mjs, reaction-lab-polymerization.test.mjs, browser route coverage. Feeds finite chemistry, discovery, and fabrication. | KEEP. Do not broaden route matching or change chemistry as part of display work. |
| 2 | Reactive-site operation and finite graph transform; createReactionLabPolymerizationCore | Viewer advancePolymerRuntime → beginManualStep/beginAutomaticStep/advanceFixedStep → guarded reaction-graph-edits. Production actual-pointer path for all routes. | Owns the active transaction and its finite atomOrigins/bonds/byproducts/evidence; no new persistent chemistry records. Tests: reaction-lab-polymerization.test.mjs and per-route fixtures. | KEEP. UI may not synthesize or substitute a result graph. |
| 3 | Finite fragment rendering and atom continuity; renderPolymerGraph, mergePolymerSourceAtoms, updatePolymerGraphVisual, createPolymerPresentationPlan | Viewer commit reconciliation maps original monomer meshes into the finite graph, eases positions, and rebuilds visible bonds. All routes. | State is polymerGraphVisual. Geometry/materials are created for bonds and disposed by updatePolymerBondVisuals; finite graph group is disposed at next Feed/clear. Tests: reaction-lab-polymer-browser.test.mjs and route fixtures. | KEEP with Task⑤’s bounded graph presentation. Current updatePolymerBondVisuals removes and recreates bond meshes, CylinderGeometry and MeshStandardMaterial during each animation update; inspect this churn while changing the finite renderer. |
| 4 | Synthetic molecular continuation and long-chain growth; createPolymerCinematic/createHeroChainPlan | After a finite PE sample settles, startPolymerCinematic uses the actual four-unit fragment as an anchor/template, then advance/render add presentation-only repeats. Reachable only for PE. | New root, fixed InstancedMesh pools, tube, markers, particles and materials are allocated on PE completion and disposed at completion, close, purge, clear or cancellation. Tests: polymer-growth-plan.test.mjs, PE browser test, growth profiler. No actual graph, Sample or Feed changes. | DELETE in Task⑤/⑨. Preserve row 3’s real finite graph continuity; do not preserve visual-only continuation units. Risk: old browser tests assert the 72-unit hold and must be replaced. |
| 5 | Coarse LOD, growth framing and camera pullback; screenSpaceMolecularWeight, heroGrowthFrame, viewer framing/readability helpers | advancePolymerPresentation → cinematic.advance/render, per-frame projection, safe-region and obstacle calculations. PE only. | Bounded point and centerline arrays are allocated when viewer opens; active measurements run during the cinematic. Shared camera and pan state must be disentangled without altering ordinary molecule camera behavior. Tests: growth-plan and PE browser visual gates. | DELETE in Task⑤/⑨. Keep the general Reaction Lab camera, pointer, zoom and molecule view logic. Remove only polymer cinematic camera authority and its arrays. |
| 6 | 25 morphology profiles and five archetypes; POLYMER_MORPHOLOGY_PROFILES/polymerMorphologyProfile | Static import in reaction-lab-viewer; production bridge queries PE only. The localhost probe can request any catalog ID. | Small module-level JS profile table; no GPU allocation until a plan is created. Tests: polymer-morphology.test.mjs checks 25:25 mapping and five archetypes. No gameplay dependency. | DELETE in Task⑨. Do not reuse archetype geometry as encyclopedia chemistry. |
| 7 | Static morphology plan and renderer; createPolymerMorphologyPlan/createPolymerMorphologyRenderer | PE production bridge and localhost-only showMorphologyPreview call both create a plan and renderer. No other route starts production morphology. | Plan owns seeded strand arrays; renderer creates shared static BufferGeometry/Material plus optional instanced junction geometry/material. Disposed after hold, close, purge or preview hide. Tests: polymer-morphology.test.mjs and browser preview. | DELETE in Task⑨ after Task⑧ assets are independent. Preserve only source graph/route data needed by the new fragment pipeline. |
| 8 | heroStrand and network hero-path selection; createPolymerMorphologyPlan and longestTreeHero | Called only as part of the static morphology plan. PE’s chain selection chooses a longest strand; network uses a longest continuous tree path. | Pure plan data, no independent renderer. Included in plan and registration. Tests: morphology topology and network path checks. | DELETE. An arbitrary visual “hero strand” cannot remain an encyclopedia structural authority. |
| 9 | Arc-length resampling and hero similarity registration; resamplePolylineByArcLength/createPolymerMorphologyBridgePlan | startPolymerMorphologyBridge takes the Task① centerline and morphology hero, then registers orientation/translation/rotation/uniform scale. PE only. | Pure temporary arrays and transform in polymerMorphologyBridge state. No chemistry graph mutation. Tests: polymer-morphology-bridge.test.mjs. | DELETE in Task⑨. It connects two representations that the new product no longer displays together. |
| 10 | Transition bridge mesh; createPolymerMorphologyBridgeRenderer | startPolymerMorphologyBridge allocates one temporary dynamic tube; advancePolymerMorphologyBridge updates its vertices/normals/bounds each active frame. | One mesh, one geometry, one material; disposed at morphology reveal completion or cancellation. Tests: bridge unit test and PE browser test. | DELETE. Remove its exact geometry/material ownership with the bridge state. |
| 11 | Morphology overlap, camera transition, reveal and hold; advancePolymerMorphologyBridge | Triggered when PE cinematic finishes. Normal timeline: 220 ms overlap, 2,600 ms registration, 1,150 ms reveal, 1,600 ms hold; reduced: 80/720/360/650 ms. | Static morphology stays allocated while initially transparent during overlap/registration, bridge mesh is updated per frame, camera distance/pan/far are changed then restored. Hold currently traverses morphology material state per frame. Tests: bridge lifecycle, safe framing, close/purge and reduced-motion browser checks. | DELETE. Retain no morphology hold state or camera transition. |
| 12 | Sample Bay overlay and dock; generated data-polymer-sample-bay div, polymerSampleBayLayout/dockPolymerSample | Viewer creates the div at startup; after old cinematic/bridge cleanup the finite fragment is docked to a safe upper corner and held. All routes. | CSS overlay plus live graph group position/scale. Each dock and hold frame calls polymerSampleBayLayout → polymerPresentationPlan, which runs 180 relaxation passes with pairwise atom checks. A discovered Sample remains in hold until the next Feed or Lab close, so the work repeats without a time bound. Browser tests assert its position and no equipment overlap. | MOVE / REPLACE in Task⑤. Put the finite graph at the Reaction Lab center and use a bounded completion state/control. Remove the polymer-specific Bay overlay/layout, not the Sample authority. |
| 13 | PolymerSample completion, identity, event contract; finishPolymerSample and core state SAMPLE | Final committed graph → finishPolymerSample → molecule-craft:reaction-lab-polymer-sample; sample-present is dispatched after the visible hold; sample-dismiss is dispatched on premature close/purge. | Core owns runtime sample/evidence and source IDs; viewer owns a not-ready/ready presentation flag. Sample is not a Stage B instance and is not persisted. Tests: fixtures, polymer discovery and browser lifecycle. Drives discovery but not fabrication directly. | KEEP. Preserve event names and sampleId/batchGeneration identity, preflight ordering, and early-dismiss behavior. Keep sample-present as the transition gate for discovery reveal. |
| 14 | Static polymer SVG asset generation; polymerPresentationSvg/build-collection-assets.mjs | Build script deterministically replays each validated route through the chemistry core, then writes assets/models/polymer-{id}.svg. Not a runtime scene. | 25 192×128 vector thumbnails, source graph-derived but laid out with a 2D presentation relaxation; CPK-like atom spheres, bonds and continuation marks. Tests: polymer assets through Collection browser test and generated-file hygiene. | MOVE / REPLACE in Task⑦/⑧. Keep the existing output path and build owner if possible; upgrade the depiction and test source/asset determinism. |
| 15 | Polymer Encyclopedia and Collection entry surface; createPolymerEncyclopediaModel/openPolymer | Collection UI combines polymers.json and polymer-encyclopedia.json, hides undiscovered details, and opens known polymer entries. | DOM and static SVG image; no morphology renderer. Tests: polymer-catalog.test.mjs, collection-polymer-browser.test.mjs. Discovery/save and existing engineering links depend on stable IDs, not entry layout. | KEEP the stable 25 entries, discovery gate, Collection tab and polymer IDs. Replace only the old image/content presentation under Tasks⑥–⑧. |
| 16 | Discovery registration/reveal queue; validatePolymerSampleEvent/handlePolymerSampleEvent | Viewer sample event → app event listener → discovery coordinator → Collection registerDiscoveredPolymer/byproduct → sample-present enables reveal session. | Coordinator owns in-memory queue; Collection owns durable entries. Sample rejection occurs before mutation. Tests: reaction-lab-polymer-discovery.test.mjs and browser route. | KEEP. Do not couple discovery to the presence or successful render of an asset. |
| 17 | Polymer discovery save; createPolymerCollectionPersistence | Polymer Collection state → molecule-craft.polymer-collection.v1, independently versioned and reset-epoch guarded. | Persistent storage holds discovered IDs, timestamp and order only. No sample graph or renderer resource. Tests: polymer-collection-persistence.test.mjs. | KEEP. Never add visual model or asset-ready flags to the save schema. |
| 18 | Engineering fabrication; compileEngineeringAuthority/fabricationEligibility | Collection configuration compiles recipes from current polymer IDs/routes/molecules; polymer discovery is a required capability input. | Fabricated applications persist in resources state. PolymerSample is not stock and is not consumed. Tests: engineering-fabrication.test.mjs. | KEEP. Preserve exact route IDs and capability checks. |
| 19 | Local preview, profiling and test harness; showMorphologyPreview, morphology snapshots, profile, growth summarizer | Only installed on localhost with reactionLabTest=1; test scripts invoke it. The morphology preview may render all 25 rows; ordinary production never invokes it. | Preview owns a temporary renderer and scene/camera snapshot; cleanup is asserted. Profile buffers are test-only. Tests include polymer-morphology-browser.test.mjs, reaction-lab-polymer-browser.test.mjs, scripts/summarize-polymer-growth-profile.mjs. | MOVE / REPLACE in Task⑨ with concise finite-sample/asset visual probes. Do not retain unused morphology preview endpoints just for old screenshots. |
| 20 | Old Task①–③ reports and morphology evidence; docs/polymer-growth-continuity.md, docs/static-polymer-morphology.md, docs/polymer-morphology-bridge.md, docs/evidence/* | Documentation and screenshots/JSON describe the old UX and its evidence. Not runtime callers. | Tracked evidence includes mobile/desktop screenshots and bridge/performance JSON. | DELETE in Task⑨ after new contracts and required historical facts are merged into Git history or this audit. Do not keep copied “legacy” code/docs. Keep this rebaseline roadmap as the next implementation authority. |

### KEEP / MOVE / DELETE totals

- KEEP: 8 responsibility rows.
- MOVE / REPLACE: 3 rows.
- DELETE: 9 rows.

These counts are responsibility rows, not source-file counts. A single viewer module contains all three categories.

## C. Performance and resource cost

### Verified resource counts

| Measurement | Evidence and value | Meaning |
|---|---|---|
| Task① hero chain | docs/polymer-growth-continuity.md and reaction-lab-polymer-browser.test.mjs: fixed 10 scene objects, 5 geometries, 9 materials; capacities 408 continuation atom instances, 408 continuation bond instances, 36 Feed atoms, 30 Feed bonds, 12 marker atoms, 6 marker bonds, 6 particles; coarse tube up to 576 vertices/3,408 indices. | PE cinematic capacity, not actual chemistry growth and not all pools fully visible simultaneously. |
| Task② plan maximum | src/polymer-morphology-plan.js: 48 members, 28 junctions, 3,600 plan points, 21,600 vertices, 129,600 indices. Renderer cap: 2 objects, 2 geometries, 2 materials. | Hard upper bound, not current PE allocation. |
| Actual PE plan in tracked Task③ evidence | docs/evidence/polymer-morphology-bridge/morphology-bridge-390.json and -1280.json: 36 strands, 7,536 vertices, 43,920 indices, 1 morphology object/geometry/material, no junctions. | Measured structural counts for the exercised PE sample, both viewport sizes. |
| Task③ peak | Same evidence and reaction-lab-polymer-browser.test.mjs: at most 12 objects, 7 geometries, 11 materials during PE bridge. The bridge itself is 1 object/geometry/material, 72 points × 8 radial sides = 576 vertices and 3,408 indices. | Task① + PE static Task② + one temporary bridge; object count is not a measured GPU draw-call count. |
| Browser CPU submission timing | docs/evidence/polymer-morphology-bridge/performance-comparison.json, Task③ branch long-chain-hold: mobile 390 update p95 0.6 ms / renderer submission p95 0.7 ms; desktop 1280 update p95 0.7 ms / renderer submission p95 0.9 ms. Maxima were 14.2/90.4 ms mobile and 13.1/139.2 ms desktop. | This measures the PE long-chain hold, not bridge or morphology. Renderer time is CPU submission, not GPU completion; the evidence attributes headless frame tails to scheduling jitter. |
| Task① earlier comparison | docs/polymer-growth-continuity.md records its baseline comparison: normal update/render-submission p95 2.2/2.4 ms at 390 and 1.7/3.5 ms at 1280; reduced 1.0/1.6 and 2.5/5.0 ms. | Task① baseline; not a Task②/③ isolated measurement. |

No morphology-specific CPU time, GPU completion time, mobile GPU memory, bytes retained, or actual draw-call count is recorded in tracked evidence. Do not report these as measured. The existing tests establish bounded counts, stable static holds and disposal, not a GPU-time or device-memory profile.

### Cost ownership

| Domain | Current cost owner and live/inactive behavior | Decommission result and retained cost |
|---|---|---|
| CPU, finite chemistry | The route core performs fixed-step actual graph operations. This is the gameplay cost and remains. Finite graph animation updates positions while a committed graph is settling. | KEEP finite route work and graph interpolation. |
| CPU, bond regeneration | updatePolymerGraphVisual calls updatePolymerBondVisuals during each finite graph animation update. That helper disposes/rebuilds per-bond cylinders/materials. | Task⑤ should decide a fixed bond-mesh update or one-time rebuild per committed graph; preserve the actual bond-formation continuity. |
| CPU, Bay layout | Each dockPolymerSample(1) call from advancePolymerPresentation reruns polymerSampleBayLayout → polymerPresentationPlan on the dock frame and every hold frame. A discovered Sample stays in hold until the next Feed or Lab close, so this cost is unbounded in duration. The layout runs 180 deterministic passes × N(N−1)/2 pair checks. Current Nylon 6,6 input has 88 source atom records and removes three water byproducts, leaving about 79 main-fragment atoms: 3,081 pairs per pass, about 554,580 candidate pair checks per layout call. At 60 calls/sec that is about 33.3 million pair checks/sec; for H hold frames the estimate is 554,580 × H. This is source-derived arithmetic, not measured CPU time or a finite upper bound; actual call rate varies with the frame loop. | Removing the Bay’s repeated per-frame layout in Task⑤ removes this continuing CPU cost. Keep one build-time layout call per generated asset and one finite graph layout per reaction commit. |
| CPU, Task① active only | PE start builds a 72-unit plan; while the cinematic is active, projection/readability, camera safe-rect, instance transforms, and coarse tube state update each frame. No such LOD calculations run during an ordinary idle Lab frame. | Remove all post-completion extension and its per-frame metrics. |
| CPU, Task③ active only | Morphology plan/framing is built once; temporary bridge tube updates vertices/normals/bounds every frame during overlap and registration. Material opacity is traversed during reveal; current morphology hold still traverses materials each frame. | Remove plan, bridge update, reveal and hold traversal. |
| CPU, ordinary idle | advancePolymerPresentation is called from tick when the Lab is open, then updatePolymerGraphVisual exits immediately when there is no sample animation. Renderer still draws the general Reaction Lab scene. | Retained cost is the general Lab tick/render and actual chemistry. |
| GPU objects/buffers | No global morphology cache exists. PE morphology and bridge are created only after the PE cinematic; all are explicitly disposed on hold completion, close, purge, clear and cancellation. Preview is created only by localhost probe. | Remove temporary PE objects; there is no persistent morphology buffer leak evidenced. |
| Transparent/hidden resources | During bridge overlap/registration the morphology renderer is allocated and attached while its opacity is zero; it remains resident for its later reveal. The temporary bridge starts hidden and is enabled as opacity rises. Exact draw submission of zero-opacity meshes is not measured. | Task⑤’s bypass eliminates the allocations. |
| Viewer-open allocations | Task① projector arrays (176 point slots, 72 centerline slots), 24 obstacle boxes, safe-rect workspace, vectors/maps and state are created when the viewer is constructed, although not all are active. localhost profile arrays are test-only. | Remove growth-only arrays/state in Task⑤/⑨; retain shared viewer and chemistry structures. |
| Memory/reset/repeat | Morphology/cinematic renderers expose idempotent dispose methods. Viewer cleanup is wired to close, clear and purge; browser tests assert zero objects/geometry/materials and repeat runs. No retained cache or stale model is evidenced. | Preserve lifecycle tests for the new sample renderer. Do not add cache keyed by polymer ID. |
| Asset build | build-collection-assets.mjs builds polymer SVGs once, at build/test time. It replays routes into a deterministic finite graph. | Replace the graphic template in Task⑦/⑧. This is not a production frame cost. |

GPU draw calls, device memory, and performance improvement after removal must be measured in Task⑩ if claimed. Static bounds support the conclusion that Task①/②/③ assets are temporary and bounded; their deletion removes code, planned geometry and per-frame work, not a demonstrated persistent leak.

## D. Task⑤ Reaction Lab simplification architecture

### Completion sequence

1. Keep exact Feed ownership and all existing site selection/dwell/chemistry guards.
2. On each committed step, carry the actual consumed monomer atoms into the finite polymer graph; render the actual new inter-unit bonds and the resulting repeat topology.
3. On the route-authoritative final step, retain the exact PolymerSample fragment/evidence. Do not append display-only atoms or a synthetic chain.
4. Keep the actual sample fragment centered in the Reaction Lab work area with the existing fixed camera. Scale the finite graph group only as needed to fit; do not auto-pull back, invent a bulk view, or add pan-to-morphology behavior.
5. Add a new bounded completion-feedback interval: 650 ms normal, 250 ms reduced motion. This is a new completion state, not reuse of the current Sample Bay hold, which persists until next Feed/Lab close. At the end, dispatch the existing sample-present event and make FEED available.
6. Show polymer name plus a concise “polymerization complete” status and a clearly labeled Encyclopedia action. Do not make an image or renderer prerequisite for completion.
7. The Encyclopedia action should use the existing collectionGame.openPolymer(id) entry point. The app wrapper closes the Reaction Lab through closeAndWait() first, then opens the known entry; discovery-created entries continue through the existing reveal queue and return action.
8. On next FEED, purge the transient finite graph and preserve existing sample-dismiss behavior if the user leaves before the presentation-ready event.

### Task⑤ change boundary and gates

Allowed: reaction-lab-viewer.js presentation state/calls/DOM, a narrow app.js callback for opening a known entry, polymer CSS/markup, the polymer browser test and focused tests. A small refactor to finite bond geometry is allowed only to remove per-frame allocation churn while preserving finite graph geometry.

Prohibited: any chemistry/route/site-pattern/Feed requirement change; any change to sample identity, atomOrigins, completion evidence, byproduct authority, discovery/save schemas, or fabrication; any synthetic continuation; any static morphology, bridge, whole-chain viewer or new save format.

Acceptance gates:

- Pointer-driven production reactions still operate on the actual Feed monomers and reactive sites.
- All 25 routes still produce route-authoritative unit/link/byproduct/qualifier evidence.
- Visible bonds connect the actual source atoms at each committed finite graph step.
- Final visible fragment has exactly route.completionEvidence.unitCount units and matches sample.fragment; no generated visual units exist beyond that graph.
- PE, copolymer, step-growth and network completions all use the same bounded completion/ready/event contract.
- New and known discoveries work. A new entry appears through the existing Collection reveal flow; a known entry opens through the explicit Encyclopedia action.
- Early close and purge preserve the current dismiss/registration ordering; Sample is never a Stage B instance and no sample geometry is persisted.
- Normal/reduced motion and 390×844 / 1280×900 screenshots show the entire finite structure and completion action without clipping or obscuring controls.
- Snapshot/probe asserts cinematic and morphology bridge inactive/absent; no old long-chain hold is required.

Focused gates: reaction-lab-polymerization tests, all-route fixtures, polymer discovery, Collection polymer, persistence, fabrication, reaction-lab polymer browser QA, and relevant repository hygiene. Do not run a full unrelated regression solely for this task.

## E. 25-polymer structure authority matrix

The catalog and route references below are the current main authority. The “property focus” is an educational candidate to verify and support in Task⑧; it is not a newly published property claim. No structure may be redrawn from an AI-generated visual. For every entry, the final graph/port authority must resolve against data/molecules.json source atoms/bonds plus its route transform.

| polymerId; routeId; current class/topology | Current repeat/sequence and required connection | Structural feature, caution and property focus candidate |
|---|---|---|
| polyethylene; polyethylene-coordination; polyolefin / addition / linear | Repeat text –CH₂–CH₂–. Four ethene units, three inter-unit links. Show carbon-to-carbon continuation at both ends. | Unsubstituted saturated carbon backbone. Candidate: regular chain packing/flexibility relates to processing-dependent crystallinity and stiffness. Existing caveat: the finite four-unit chain is not molecular weight, branch distribution or bulk material. |
| polypropylene; polypropylene-coordination; polyolefin / addition / linear | –CH₂–CH(CH₃)–. Four propene units, three links; continuation through both backbone carbons. | Pendant methyl on alternate backbone carbon. Do not assign isotactic/syndiotactic/atactic order; route explicitly says stereochemistry not specified. Candidate: methyl substitution and tacticity affect packing/crystallinity. |
| ethylene-propylene-copolymer; ethylene-propylene-coordination; polyolefin-copolymer / copolymer / copolymer | No single repeat string. Local sample ethene → propene → ethene, three units/two links. Show both comonomer fragments and both ports; label sequence as a local example only. | Mixed saturated carbon backbone; no alternating/block sequence or bulk ratio claim. Candidate: comonomer content/sequence changes chain packing and flexibility; require caveat. |
| polyisobutylene; polyisobutylene-cationic; polyolefin / addition / linear | –CH₂–C(CH₃)₂–. Four isobutene units/three links. | Gem-dimethyl backbone substitution. Tacticity not specified. Candidate: bulky substitution changes local geometry and packing; avoid universal bulk-property claims. |
| polystyrene; polystyrene-radical; vinyl-polymer / addition / linear | –CH₂–CH(C₆H₅)–. Four styrene units/three links. | Pendant phenyl attached at substituted backbone carbon. Tacticity not specified. Candidate: bulky aromatic side groups affect segmental motion and glassy behavior; distinguish polymer structure from foamed/plasticized products. |
| polyvinyl-chloride; polyvinyl-chloride-radical; vinyl-polymer / addition / linear | –CH₂–CHCl–. Four vinyl chloride units/three links. | Pendant chlorine on the carbon backbone. No tacticity or plasticizer state is assigned. Candidate: C–Cl polarity and formulation/plasticizer choice affect stiffness and use; do not imply one product grade. |
| polychlorotrifluoroethylene; polychlorotrifluoroethylene-radical; fluoropolymer / addition / linear | –CF₂–CFCl–. Four chlorotrifluoroethylene units/three links. | Fluorinated backbone with one chlorine per two-carbon repeat. Candidate: substitution pattern and packing relate to barrier/chemical behavior; grade and thermal history caveat required. |
| polyacrylonitrile; polyacrylonitrile-radical; vinyl-polymer / addition / linear | –CH₂–CH(CN)–. Four acrylonitrile units/three links. | Pendant nitrile on carbon backbone. No tacticity specified. Candidate: polar nitrile groups and intermolecular association; distinguish PAN precursor from carbonized/drawn fiber. |
| polyacrylic-acid; polyacrylic-acid-radical; vinyl-polymer / addition / linear | –CH₂–CH(COOH)–. Four acrylic-acid units/three links. | Pendant carboxylic acid; current feed is acid form. Candidate: ionization/pH and hydration alter behavior; do not silently draw a salt or specify solvent. |
| polyethylene-oxide; polyethylene-oxide-anionic-ring-opening; polyether / ring-opening / linear | –CH₂–CH₂–O–. Four ethylene-oxide units/three links; oxygen is part of the backbone and the ring is opened. | Ether oxygen in the chain. Candidate: backbone polarity/solvation; crystallinity depends on molecular weight and conditions. Do not show a crosslink or closed epoxide. |
| polyethylene-terephthalate; polyethylene-terephthalate-direct-polycondensation; polyester / polycondensation / linear | –O–CH₂–CH₂–O–CO–C₆H₄–CO–. Current finite sequence alternates terephthalic acid and ethylene glycol; four feed units, three links, three waters. | Aromatic terephthalate and ester backbone, para-substituted ring from the terephthalic-acid source. Candidate: aromatic/ester segments support stiffness/cohesion; do not imply drawn textile fiber or processing texture. |
| polyethylene-adipate; polyethylene-adipate-direct-polycondensation; polyester / polycondensation / linear | –O–CH₂–CH₂–O–CO–(CH₂)₄–CO–. Alternating adipic acid/ethylene glycol, four units/three links/three waters. | Aliphatic polyester with four methylenes between carbonyls. Candidate: flexible aliphatic segment plus polar ester links; crystallinity/softness are condition-dependent. |
| polylactic-acid; polylactic-acid-direct-polycondensation; polyester / polycondensation / linear | –O–CH(CH₃)–CO–. Four lactic-acid units/three links/three waters. | Ester backbone and methyl-bearing stereogenic carbon. Source molecule records have no explicit stereochemical field and route says stereochemistry not specified. Candidate: stereochemistry and thermal history influence ordering; do not draw a single tacticity. |
| polyglycolic-acid; polyglycolic-acid-direct-polycondensation; polyester / polycondensation / linear | –O–CH₂–CO–. Four glycolic-acid units/three links/three waters. | Compact aliphatic polyester repeat with no methyl substituent. Candidate: compactness/ester density relates to packing and hydrolysis; support claims and conditions in Task⑧. |
| phenol-formaldehyde-resin; phenol-formaldehyde-resole; phenolic / condensation-network / network | No canonical linear repeat. The current route consumes four Feed units (two phenol, two formaldehyde), reports three inter-unit links and one water, but its sample has representation.continuations=[]; validateMainGraph(...network:true) rejects valence deficits, and freeAromaticCH selects only the first available aromatic C-H. It therefore does not provide a branched junction. | Keep the network classification and never redraw this sample as a chain or claim its graph is branched. For the Encyclopedia, Task⑥ must author and review a separate atom-mapped resole motif from a cited structural authority. In the current phenol source graph, ring atom 0 bears OH; ring atoms 1 and 5 are ortho and atom 3 is para. Candidate sites are not route continuation ports. Map selected phenolic sites and formaldehyde-derived methylene carbons, account for displaced H atoms, and validate bond order, valence, element balance, connectivity and motif boundaries. The motif must be labelled as Encyclopedia authority, not as the current PolymerSample. Canada’s assessment confirms ortho/para reactivity and basic-catalysed resole formation: https://www.canada.ca/en/environment-climate-change/services/evaluating-existing-substances/screening-assessment-phenol-formaldehyde-resins-group.html. If the reviewed mapping is not ready, block this asset and Task⑧’s 25/25 gate rather than invent ports. Do not imply a fully cured commercial resin. |
| polyethylene-adipamide; polyethylene-adipamide-direct-polycondensation; polyamide / polycondensation / linear | –NH–CH₂–CH₂–NH–CO–(CH₂)₄–CO–. Alternating ethylenediamine/adipic-acid, four units/three links/three waters. | Polyamide backbone with amide links and short diamine residue. Candidate: amide association plus methylene spacing affects cohesion; do not label as a fiber grade. |
| polybutadiene; polybutadiene-coordination-1-4; diene-polymer / addition / linear | Current repeatUnit is null. Route explicitly uses 1,4 diene transform; four 1,3-butadiene units/three links. Task⑥ must derive and review a local 1,4 motif from the actual graph before publishing a canonical string. | Residual C=C lies in the backbone. Cis/trans and microstructure are explicitly unspecified. Candidate: unsaturation and microstructure influence flexibility; unvulcanized only, no sulfur-crosslink depiction. |
| styrene-butadiene-copolymer; styrene-butadiene-radical; diene-copolymer / copolymer / copolymer | No single repeat string. Local sample 1,3-butadiene → styrene → 1,3-butadiene, three units/two links. | 1,4 diene-derived backbone plus pendant phenyl from styrene. No fixed sequence, bulk ratio or vulcanization claim. Candidate: aromatic fraction, diene microstructure and cure affect rubber properties. |
| nitrile-butadiene-rubber; nitrile-butadiene-radical; diene-copolymer / copolymer / copolymer | No single repeat string. Local sample 1,3-butadiene → acrylonitrile → 1,3-butadiene, three units/two links. | Diene unsaturation plus pendant nitrile; no sequence, ratio, solvent or cure state asserted. Candidate: nitrile content and cure affect polarity/chemical compatibility; do not assign a universal grade. |
| polyisoprene; polyisoprene-coordination-1-4; diene-polymer / addition / linear | Current repeatUnit is null. Route uses 1,4 diene transform; four isoprene units/three links. Task⑥ must derive the local 1,4 motif from the actual transformed graph. | Methyl-substituted unsaturated backbone; cis/trans microstructure unspecified. Candidate: microstructure controls chain flexibility/packing. Do not depict sulfur-crosslinked rubber. |
| butyl-rubber; butyl-rubber-cationic; diene-copolymer / copolymer / copolymer | No single repeat string. Local sample isobutene → isoprene → isobutene, three units/two links. Show as a local motif, not the bulk ratio. | Isobutene-rich commercial material is not represented by the sample’s 2:1 local display ratio. No exact sequence or vulcanization is asserted. Candidate: sparse unsaturation/cure sites and composition affect elastomer behavior; cite grade-specific claims. |
| polyvinylidene-fluoride; polyvinylidene-fluoride-radical; fluoropolymer / addition / linear | –CH₂–CF₂–. Four vinylidene-fluoride units/three links. | Alternating CH₂/CF₂ backbone. Route notes regiochemistry varies and stereochemistry is not specified. Candidate: phase/polymorph and processing affect properties; do not assert one crystal form. |
| vinylidene-fluoride-hexafluoropropylene-copolymer; vinylidene-fluoride-hexafluoropropylene-radical; fluoropolymer-copolymer / copolymer / copolymer | No single repeat string. Local sequence VDF → HFP → VDF, three units/two links. Derive both component fragments from transformed graphs; label local sequence only. | Fluorinated copolymer with variable regiochemistry and composition. Do not claim exact sequence or phase fraction. Candidate: composition and irregularity affect crystallinity/flexibility; require composition caveat. |
| polytetrafluoroethylene; polytetrafluoroethylene-radical; fluoropolymer / addition / linear | –CF₂–CF₂–. Four tetrafluoroethylene units/three links. | Perfluorinated carbon backbone; no tacticity exception is present in route. Candidate: fluorination and chain packing explain chemical stability/thermal behavior; grade and processing caveat required. |
| nylon-6-6; nylon-6-6-direct-polycondensation; polyamide / polycondensation / linear | –NH–(CH₂)₆–NH–CO–(CH₂)₄–CO–. Alternating hexamethylenediamine/adipic-acid, four units/three links/three waters. | Long diamine/adipate residues, amide donors/acceptors and two methylene spacings. Candidate: hydrogen bonding and packing relate to strength/moisture response; do not imply a drawn fiber or fixed crystallite form. |

### Structure authority findings

- The route file is the exact authority for representativeSequence, feedSpecies, transformFamilies, sitePatternIds, completionEvidence and presentation qualifiers.
- Network labels are not proof that a finite sample contains branch ports. For phenol-formaldehyde, src/reaction-lab-polymerization.js freeAromaticCH, phenolMethylolationPlan, phenolBridgePlan and validateMainGraph(...network:true) produce no declared continuation ports; route presentation.continuationMarkers and networkCapabilities are labels, not atom mapping.
- The polymer catalog supplies family, formation, topology, reactants and an optional repeatUnit display string. polymer-catalog.test.mjs checks population/content but does not validate repeat-unit connection atom indices.
- reaction-lab-polymerization.js constructs atomOrigins, graph bonds, byproducts and representation continuation markers. The per-route fixtures verify conservation and evidence. This transformed finite graph is the source for an actual local fragment.
- data/molecules.json stores monomer atom/bond coordinates but no separate stereochemistry field in the inspected feed records. Route qualifiers are authoritative for “not specified” and regiochemical exceptions.
- Copolymer representativeSequence is a finite local sample, not bulk composition, random/block/alternating statistics or a canonical repeat sequence. Butyl rubber’s displayed 2:1 feed pattern especially must not be presented as an actual material ratio.
- Network topology must be drawn with branch/junction continuation ports. No linear-repeat fallback is allowed.
- The current SVG thumbnails are route-derived finite samples, not evidence that the current layout is a reviewed repeat-unit diagram or 3D conformer.

## F. Encyclopedia content and asset architecture

### Existing schema and keep-the-model-small rule

- data/polymers.json remains the chemical catalog: stable ID/name/family/formation/topology/reactants/repeatUnit.
- data/polymerization-routes.json remains reaction authority: exact route, representative monomer sequence, transformation and completion evidence.
- data/polymer-encyclopedia.json remains narrative authority: 25 records with id, number, description, three details and concepts. The current shape has no dedicated structurePropertyExplanation or representativeApplications field.
- src/collection-ui.js already renders discovery-gated detail, classification, formation, topology, source molecules, repeatUnit or a representative/network caption, byproducts, route qualifiers and discovery order. src/polymer-encyclopedia.js enforces one-to-one ID/number/content validation.
- Extend these records only where a field is missing. In general, Task⑥ should reference existing routes, source atom origins and continuation ports rather than duplicate a chemistry graph, molecule database, route catalog or coordinates. Explicit exception: phenol-formaldehyde’s current route sample has no branch ports. Its Encyclopedia-only network motif must be a separately cited and chemically reviewed atom-mapped structure with explicit provenance; it must not be presented as the current PolymerSample or alter runtime chemistry under this audit contract.

### Visual asset specification

- Primary view: deterministic SVG 2D structural illustration, generated from validated source atoms/bonds and explicit port/repeat metadata. Reuse the existing assets/models/polymer-{polymerId}.svg path and build-collection-assets.mjs ownership if the detail view can support the richer asset. Keep the existing filename contract; do not add parallel thumbnails.
- Default illustration types: homogeneous validated repeat unit with left/right continuation bonds and an n/bracket; copolymer local segment with component labels and a “local example only” note, without a fixed n or ratio claim; network local junction with at least three chemically validated branches and no linear repeat bracket. Every network branch must map to an approved source structure. The current phenol-formaldehyde route does not supply those ports; fail closed until its separate motif authority passes review.
- The graph renderer must preserve element identity, bond order, aromaticity and authorized stereochemical wedges. Carbon-bound hydrogens may be implicit only when the notation convention says so. Heteroatoms and functional groups must be labeled, not color-only.
- Element colors follow src/chemistry.js ELEMENTS; bond order/connection identity must remain legible in monochrome. Use a high-contrast background consistent with Collection. File type: SVG image/svg+xml with title/accessible label and stable viewBox. A 960×540 viewBox is the default pilot canvas; smaller detail layouts may use a validated crop, not a different drawing.
- Repeat ends use explicit continuation marks and labels. Never cap a polymer port as a real terminal atom. Copolymer and network exceptions must be printed as notes, not implied by color.
- The 2D SVG is the required asset for all 25 entries. 3D ball-and-stick is optional and only justified where local geometry adds information that the reviewed data actually specifies. It is a short local fragment, not a coil, whole chain, or bulk scene. Do not invent tacticity, conformer, crosslink density or coordinates.
- Generated assets must be byte-deterministic from data/source, independent of user seed or runtime, and traceable to polymerId, routeId, atom-origin references and generator version. For the phenol-formaldehyde Encyclopedia exception, also record the reviewed motif-source citation and authority version. Regenerate through the source script; do not hand-edit generated SVGs.
- QA must include actual rendered mobile detail at 390×844 and desktop at 1280×900, element/bond/port legibility, clipping/overlap, accessible title, and regenerated-output equality. Existing browser tests already cover the Collection detail image path and no horizontal overflow.

### Pilot set

Use nine pilot entries, not all 25:

1. polyethylene — simple saturated carbon repeat and baseline ports.
2. polypropylene — methyl side group and unspecified tacticity.
3. polyvinyl-chloride — heteroatom side group and unspecified tacticity/plasticizer.
4. polystyrene — pendant aromatic ring.
5. polyethylene-terephthalate — aromatic polyester backbone and step-growth residue pairing.
6. nylon-6-6 — polyamide links and alternating acid/diamine residues.
7. polytetrafluoroethylene — perfluorinated backbone.
8. styrene-butadiene-copolymer — copolymer/diene local motif and sequence caveats.
9. phenol-formaldehyde-resin — non-linear network pilot, gated on a separately sourced, atom-mapped branch motif; current route-generated sample is not a network-junction drawing.

This includes the baseline structure forms requested and at least one network. The set spans homopolymer, comonomer, aromatic side/backbone, polycondensation, fluorinated, and network render rules. Existing morphology screenshot pilots are a separate legacy visual test and do not replace these structure pilots.

## G. Safe decommission plan

| Phase | Exact removal/transition candidates | Prerequisite and affected paths | Regression, disposal and rollback gate |
|---|---|---|---|
| 1 — Task⑤, bypass old presentation | Remove the calls into startPolymerCinematic/startPolymerMorphologyBridge from completion; stop creating growth/morphology objects; remove Bay overlay/dock path and per-frame Bay layout. Keep old module files temporarily so this is a narrow behavior change. | Source: src/reaction-lab-viewer.js; narrow app.js callback for known Collection entry; reaction-lab CSS/markup; polymer browser test. Depends only on this audit and current route authority. | Run actual-pointer PE and representative non-PE routes; reduced motion; new/known discovery; close-before-ready; next FEED; check exact sample evidence and zero old-renderer resources. Roll back by reverting only presentation call/UI change; Sample graph/save is untouched. |
| 2 — Tasks⑥–⑧, new structure authority/assets | Add validated repeat/local/network port mapping that references existing route graph; generate the pilot then all 25 upgraded SVGs; update Encyclopedia copy with structure-property explanation, representative applications and caution. New pipeline must not import morphology or bridge modules. | data/polymer-fragment-authority.json only if necessary; otherwise minimal schema extension of existing polymer catalog; data/polymer-encyclopedia.json; scripts/build-collection-assets.mjs; assets/models/polymer-*.svg; schema/tests/Collection view. Depends Task⑤ contract and current route/source graphs. | Per-entry graph-port validation, repeat closure, correct copolymer/network caveats, all 25 generated assets, deterministic regeneration and mobile/desktop QA. Keep old current assets until the replacement output for a given entry passes; generated assets are reversible from route/data source. |
| 3 — Task⑨, delete retired code and QA | Delete src/reaction-lab-polymer-cinematic.js; src/polymer-growth-plan.js; src/polymer-morphology-authority.js; src/polymer-morphology-plan.js; src/polymer-morphology-renderer.js; src/polymer-morphology-bridge.js; src/polymer-morphology-bridge-renderer.js. Remove their imports/state/helpers/snapshot fields/probe API from reaction-lab-viewer.js. Remove or replace tests/polymer-growth-plan.test.mjs, tests/polymer-morphology*.test.mjs, old morphology/long-chain assertions in tests/reaction-lab-polymer-browser.test.mjs, scripts/summarize-polymer-growth-profile.mjs, .github/workflows/polymer-scale-up-validation.yml, docs/polymer-growth-continuity.md, docs/static-polymer-morphology.md, docs/polymer-morphology-bridge.md and docs/evidence/polymer-morphology-bridge/* plus docs/evidence/static-polymer-morphology/*. | Requires Task⑤ has no production caller and Tasks⑥–⑧ asset authority/tests no longer import old visual modules. Keep generated polymer SVG output at its supported path. Update docs/architecture.md and workflow path gates. | Search/import graph must show no production import/reachability; repository hygiene and PWA precache check; finite reaction/discovery/save/fabrication tests remain. New tests replace rather than delete chemistry, sample, or asset coverage. Roll back by reverting Task⑨ only; Tasks⑤–⑧ continue to function without the legacy implementation. |
| 4 — Task⑩, integrated closure | No remaining feature deletion; final integration and performance/visual proof. | Depends Tasks⑤–⑨. Production runtime/modules/Collection/engineering paths and current save schemas. | Actual Feed → pointer reaction → bounded completion → discovery/known Encyclopedia entry → next gameplay → reload → fabrication. Test 390×844 and 1280×900, route/evidence, offline assets, no old modules, no asset gaps, dispose on close/purge/replay, performance metrics. |

Task⑨ must not delete the polymerization core, polymer route/catalog, finite graph renderer, PolymerSample events, discovery coordinator, polymer collection persistence, existing Collection IDs, Engineering, or the new route-derived SVG generator.

## H. Revised Task⑤–⑩ implementation contracts

### Task⑤ — Reaction Lab Presentation Simplification

- Depends on Task④ and current route/sample authority.
- Change only post-commit visual state, completion feedback, Sample Bay presentation, narrow app/Collection callback, and relevant tests/styles.
- Keep actual site operation, finite atom graph/bonds, route evidence, byproducts, events, discoveries and Sample readiness.
- Prohibit synthetic units, LOD, camera scale-out, morphology, bridge and chemistry/save changes.
- Gate: 25 route fixtures, actual-pointer representative routes, exact fragment/evidence match, PE and non-PE discovery, known-entry action, reduced motion, early close/purge, no old resource allocation, 390×844 and 1280×900 QA.
- Explicit non-goal: generalized 3D polymer viewer.

### Task⑥ — Polymer Fragment Authority

- Depends on Task⑤ so it cannot depend on retired completion presentation.
- Define per-entry draw authority: homogeneous repeat, copolymer local motif, or network local motif; source route; repeat grouping; continuation port(s); named functional groups; stereo/regio status; caveats.
- Use existing actual source atoms, bond orders, route transforms and sample atom origins when they actually express the target motif. Explicit PF exception: the route sample has no network ports, so do not retrofit three ports onto it. Create a separately cited/reviewed Encyclopedia motif authority with atom mappings for phenolic ortho/para sites and methylene bridges, explicit hydrogen displacement, valid valence/bond/element balance, connected branches and a clear statement that it is not the gameplay Sample. Do not add unsupported stereochemistry or coordinates.
- Validate all 25 records against polymer IDs/routes or documented independent structural authority, source atom indices, bond valence, repeat ports, local-fragment closure and topology. Explicitly test the PF exception’s mapped graph has at least three connected network branches, preserves aromatic substitution and atom/element accounting, and is not mislabeled as the route-generated sample. Test copolymers carry no bulk-ratio assertion.
- Gate: 25:25 records, zero unknown/missing port references, zero unsupported stereo claims. Route-derived entries must match the route graph; the PF exception must match its separately cited and reviewed motif authority. Its current sample graph cannot pass the branched-network gate.
- Non-goals: runtime UI, chemistry route changes, bulk structure model or fabrication changes.

### Task⑦ — Encyclopedia Visual Asset Foundation

- Depends on Task⑥.
- Build one deterministic source-graph-to-SVG pipeline, existing file-path compatibility, molecule element palette, bond-order/aromatic drawing, ports, repeat brackets/labels, annotations, accessibility labels and regenerated-file checking.
- Pilot the nine selected polymers. Add optional 3D local fragment only if exact geometry and stereo are authorized; no generated art as chemical authority.
- Gate: source traceability, deterministic byte equality, manual structural review, mobile 390×844 and desktop 1280×900 readability, no clipping, and correct port/bond/element counts. PF may enter the pilot only after its three-branch motif passes Task⑥’s independent authority review.
- Prohibited: morphology reuse, whole-chain or bulk imagery, chemistry/schema duplication, runtime Three.js model caching.

### Task⑧ — 25 Polymer Encyclopedia Rollout

- Depends on Task⑦ pilot review.
- Produce/verify one structure asset per stable polymerId and fill reviewed structure notes, structure-property explanation, representative applications and caution where needed. Preserve catalog order/numbering and discovery gating.
- Treat route qualifiers as binding: stereo/regio unspecified stays unspecified; copolymer sequence/composition is not asserted; PF remains a non-linear network and its asset uses only the separately approved motif authority; PB/PI microstructure is not invented.
- Gate: 25/25 content and assets; unique IDs; valid sources; no broken asset; every route caveat visible where relevant; per-entry mobile/desktop QA; deterministic rebuild; missing/incorrect asset count zero.
- Prohibited: modifying polymer route recognition, finite chemistry, Sample lifecycle, saves, or Engineering.

### Task⑨ — Legacy Morphology Cleanup

- Depends on Task⑤ bypass and Task⑧ assets/tests.
- Delete the exact modules, state, probe fields, old tests/probes/docs/evidence/workflow listed in Phase 3. Update architecture map and current validation workflow; retain shared Reaction Lab camera/renderer and actual finite polymer graph.
- Gate: no old production import/call; old morphology/long-chain symbols absent from production source and bundle; new visual tests cover sample/asset authority; hygiene/PWA/offline checks pass; lifecycle probes see no retained geometry/material.
- Prohibited: deleting chemistry, Collection discovery, polymer storage, Engineering, or the replacement SVG generator.

### Task⑩ — Integrated Polymer Closure

- Depends on Tasks⑤–⑨.
- Run all-route exact Feed and conserved graph/evidence fixtures; actual-pointer production routes spanning addition, ring-opening, step-growth, copolymer and network; sample presentation/readiness; discovery and known encyclopedia opening; next Feed; reload of polymer discovery; downstream Engineering eligibility/fabrication.
- Gate: mobile and desktop visual QA, reduced motion, error-free browser console, no obsolete module/resource, all assets offline/precache-valid, save/reload and fabrication tests, measured finite-completion CPU/render profile compared with current baseline.
- Prohibited: new chemistry, routes, bulk simulation or a full polymer 3D viewer.

## I. Task④ validation and remaining limits

Verified from current main or tracked evidence:

- Remote main pinned at 7d58d91fcaeee5ee7b3998027814e4ae5e767e28.
- Catalog, routes and encyclopedia each contain 25 unique polymer IDs; morphology profiles are 25:25 and five archetypes; 25 existing polymer SVG paths are present.
- Current ownership was traced from app startup and exact viewer call sites into core, renderer, discovery, save and fabrication modules.
- All 20 responsibility rows are classified: 8 KEEP, 3 MOVE / REPLACE, 9 DELETE.
- Downstream dependencies use route/polymer/discovery IDs, not morphology state.
- Task③ disposal paths and bounded counts are confirmed in source and tests; no persistent morphology cache is present.
- The proposed Task⑤ path keeps the existing Sample identity/event order and uses a known Collection API; Task⑥–⑩ contracts follow the dependency sequence above.
- Current combined status for the baseline commit returned no individual status entries. This is not reported as a passing status-check run.
- The baseline’s GitHub Actions run [37632313851](https://github.com/miyatayuuma/molecule-craft/actions/runs/37632313851) for Polymer growth continuity also failed at the PE performance summary. At 390 px reduced motion, update P95 was 1.50× and renderer-submission P95 1.8125× the recorded baseline, exceeding the workflow’s 1.35× threshold. This run used the exact Task④ start SHA, so it is a pre-existing main failure, not caused by this documentation PR. The final audit PR’s Polymer growth continuity run [37724785668](https://github.com/miyatayuuma/molecule-craft/actions/runs/37724785668) passed the same performance step and both viewport pointer-path QA checks with unchanged production source, so the baseline threshold failure did not repeat; no performance improvement is claimed.

Remote validation and remaining limits:

- No local test suite, script or repository-hygiene command was run because this workspace has no usable checkout.
- PR CI run [37724785668](https://github.com/miyatayuuma/molecule-craft/actions/runs/37724785668) passed bounded chemistry/discovery regressions, actual-pointer production QA at 390×844 and 1280×900, reduced-motion checks, the PE performance summary, Collection, hygiene and offline integrity. This is a fresh CI run on unchanged production code, not a new Task④-specific visual test.
- Repository validation run [37724785663](https://github.com/miyatayuuma/molecule-craft/actions/runs/37724785663) passed repository guardrails, polymerization gameplay closure, Encyclopedia graph/UI, persistence, hygiene, PWA freshness/integrity and diff whitespace checks. Its separate field-return-flow job failed at tests/safe-extraction-browser.test.mjs:29: expected site-ready, received site-seeking. No file in that flow changed in this docs-only PR, so it is recorded as an unrelated current-check failure, not a Task④ regression.
- No Task②/③ morphology CPU time, GPU completion, draw-call count or device-memory measurement is available. Counts and code-derived estimates are labelled above; run a focused profile only if Task⑩ needs a post-removal delta.
- Structural property/application statements in the matrix are candidate teaching links, not verified encyclopedia copy. Task⑧ must review/source them before publication.

Task⑤ has no dependency on the PF Encyclopedia motif and can proceed from the current route-authoritative finite Sample. Task⑥ has an explicit fail-closed gate for that motif: the existing resole route labels network capability but emits no continuation ports, so no branched PF asset may be approved until separate structural authority and atom mapping are reviewed. This does not block Task⑤, but it is a prerequisite to passing Task⑥–⑧ network coverage. The next recommended task is Task⑤ — Reaction Lab Presentation Simplification.
