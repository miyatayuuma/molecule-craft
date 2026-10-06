# Polymer growth molecular continuity

## Chemistry boundary and molecular grammar

`src/reaction-lab-polymerization.js` remains the finite chemistry authority. After the actual four-unit `PolymerSample` finishes its normal presentation, `src/reaction-lab-viewer.js` resolves the displayed carbon backbone from the sample's atom origins and rendered atom positions. Units 1–4 retain those coordinates, bonds, ordering, and orientation as the authority; they are never laid out again for the cinematic.

`src/polymer-growth-plan.js` measures the displayed C–C bond lengths and directed local backbone turns. It extracts each actual repeat unit's displayed atoms and internal bonds and uses one of those four actual units as the continuation template. Added PE repeat units therefore inherit the same six atoms, five intramolecular bonds, atom sizes, C–C spacing, local zigzag, and styling as the finite fragment. The first new C–C bond continues the last measured turn at the actual growth tip. Stage B animates four recognizable Feed monomers into units 5–8, then holds the completed 8-unit molecular chain for camera settle (1.5 s normal motion; 800 ms reduced motion) before Stage C begins.

From unit 9 onward, the planner groups repeated uses of that same molecular template into four-unit chunks with entry/exit centers, tangents, and torsion endpoints. Chunk boundaries have consecutive shared centerline stations and explicit cross-chunk C–C connector bonds. Internal molecular bonds keep the measured displayed geometry. The chunk grouping does not create per-chunk meshes: atom and bond transforms are written into fixed `InstancedMesh` pools.

The planner carries two shape scales. Atom and bond placement preserves the C–C zigzag. A separate centerline moves only at repeat-unit scale and supplies the slowly changing chain heading. The centerline is seeded from the stable PolymerSample id. Three broad, correlated heading/depth/torsion keys generate persistent curvature; smooth interpolation avoids independent per-chunk angle noise. Both molecular transforms and the coarse tube use that one centerline. This is an educational flexible-chain presentation, not a molecular-dynamics or conformational-statistics simulation.

The continuation is presentation only. It does not create Stage B bodies or actual molecule instances, consume additional monomers, reserve Feed slots, or change `PolymerSample` evidence, discovery, or lifecycle. Feed uses a fixed pool that presents each Stage B monomer as a recognizable molecule; later supply can become a compact repeat marker or particle as its screen size falls.

## Screen-space LOD authority

The viewer measures CSS-pixel size after camera framing on every active cinematic frame:

- Representative heavy-atom diameter projects the production carbon sphere diameter (`2 × modelAtomRadius('C')`, currently 0.6624 world units) at the current depth. Added molecular units use the same canonical atom radii as the finite fragment.
- Representative backbone bond length projects a C–C bond into viewport CSS pixels.
- The lower normalized readability score owns the blend, so detail remains molecular only while both atoms and bonds can be read.

The preserved Task ① thresholds are 2.5–4.5 CSS px for representative heavy-atom diameter and 4–8 CSS px for C–C bond length. The normalized minimum score passes through smoothstep from molecular weight 0 to 1; coarse weight is its complement. A 0.04 score deadband retains fully molecular or fully coarse state at the edges when camera projection jitters. Elapsed time and unit count do not select representation. A missing projection sample retains the previous blend.

During growth, the displayed finite fragment and every readable incorporated unit remain atomistic. Camera pullback begins only when the complete visible backbone approaches the live safe region. This makes the same spheres and bonds visibly shrink before the screen-space score falls into the LOD transition. During the transition, atomistic detail and the coarse tube follow the same centerline and exchange opacity smoothly. At coarse completion, unreadable atomistic atoms—including the growth tip—are removed. Feed follows its own screen-size presentation ladder.

## Bounded renderer

The presentation has a fixed 72-unit total: four actual units plus at most 68 added units. Its carbon path reserves 176 points and its shared unit centerline reserves 72 stations. The coarse mesh reserves 576 vertices and 3,408 indices (8 radial sides); only the visible centerline prefix is drawn. For the six-atom / five-bond PE template, fixed instance capacities are 408 continuation atoms, 408 continuation bonds (including one inter-unit connector per repeat), 36 Feed atoms, 30 Feed bonds, 12 intermediate marker atoms, 6 marker bonds, and 6 particles. The actual finite-fragment meshes remain the original authority. The cinematic has 10 scene objects, 5 geometries, and 9 materials; it creates no per-unit or per-chunk `Mesh` objects. The lit coarse tube targets 2.8 CSS px apparent width and caps world-space radius compensation at 0.5 units.

The temporary pools and tube are disposed on Lab close, lifecycle cancellation, completion handoff, purge, and explicit disposal. Cleanup restores the finite sample's original atom and bond opacity/depth-write state and camera distance. No cinematic projection or LOD measurements run during ordinary idle Reaction Lab frames. Reduced motion shortens presentation and camera response while retaining the same molecular → smaller molecular → coarse meaning and screen-space thresholds.

## Camera and chain shape

The camera projects the complete visible path against the largest clear rectangle derived from the live canvas and equipment bounds. Before changing distance, it pans in the camera plane to center the whole path in that safe rectangle. During growth it moves outward only when the centered path approaches the fit target, using a 76% safe-region major-span target with a 1.8% fit margin; it does not move because a unit counter changed. The final path must occupy 60–85% of the safe-region major span and at least 24% of its minor span, stay centered within 12 CSS px, keep the growth tip and visible carbon path inside the safe frame, and avoid clipping. The camera is held still during the long-chain observation phase.

Trajectory validation measures unit-center positions, never the C–C zigzag. The deterministic path retains the chemistry-derived first tangent, uses persistent seeded changes rather than periodic sine motion or independent chunk rotations, and is reviewed against a projected path/chord ratio around the Task ① baseline of 1.15. Bounds guard against a straight ruler, a tangled path, and excessive local bends. Task ② static morphology remains separate and is not used during this cinematic or its hold.

## Evidence, performance, and regression

`tests/polymer-growth-plan.test.mjs` checks actual-coordinate anchoring, measured 4→5 bond spacing and turn, continuation-template integrity, every chunk seam, Stage B atom/bond placement and Feed proof, deterministic correlated curvature, shared coarse centerline, CSS-pixel LOD thresholds and hysteresis, fixed capacities, stable hold resources, and disposal. `tests/reaction-lab-polymer-browser.test.mjs` drives the production PE route with real pointer gestures at 390×844 and 1280×900 and captures Frames A–F from actual fragment through coarse long-chain hold. It also reviews reduced motion, lifecycle cleanup, and existing polymer chemistry/discovery routes. CI artifacts contain screenshots, per-frame metrics, and browser profiles.

The current-main performance baseline is Task ① merge `ac34cea7953b6d295acb7c0c035aa87d29045605`. Its production browser profile recorded normal-motion update/render p95 of 2.2/2.4 ms on mobile and 1.7/3.5 ms on desktop; reduced-motion p95 was 1.0/1.6 ms and 2.5/5.0 ms. `scripts/summarize-polymer-growth-profile.mjs` compares candidate update and CPU render-submission p95 against those values and reports frame-interval p50/p95/peak separately. Isolated headless SwiftShader spikes are not treated as sustained renderer cost.

The PE workflow runs chemistry, fixture, discovery, collection, reduced-motion, lifecycle, offline/PWA, and repository-hygiene regressions. Because the viewer was touched, `tests/polymer-morphology.test.mjs` also guards the frozen Task ② authority, plan, and renderer. This task does not add a morphology bridge, multiple chains, chemistry graph growth, or resource consumption.
