# Polymer growth continuity

## Chemistry boundary

`src/reaction-lab-polymerization.js` remains the finite chemistry authority. After the existing `PolymerSample` graph finishes its normal presentation, the viewer resolves the displayed carbon backbone and newest continuation end from that sample's real atom origins and rendered atom positions. For polyethylene only, `src/polymer-growth-plan.js` keeps those exact points and extends the same backbone for up to 72 presentation-only repeat units. The plan has no DOM, Three.js, Feed, inventory, persistence, or chemistry dependency.

The continuation is presentation only. It does not create Stage B bodies or actual molecule instances, consume additional monomers, reserve Feed slots, or change `PolymerSample` evidence, discovery, or lifecycle. Incoming ethene uses the same screen scale as the chain: a recognizable molecule when its atoms are readable, a compact repeat marker at intermediate scale, and a particle at small scale. Feed and chain use fixed instance pools.

## Screen-space LOD authority

The viewer measures CSS-pixel size after camera framing on every active cinematic frame:

- Representative heavy-atom diameter projects the production carbon sphere diameter (`2 × modelAtomRadius('C')`, currently 0.6624 world units) at the current depth. Added molecular units use the same canonical atom radii as the finite fragment.
- Representative backbone bond length projects the current centerline C–C segment into viewport CSS pixels.
- The lower normalized readability score owns the blend, so detail remains molecular only while both atoms and bonds can be read.

The committed thresholds are 2.5–4.5 CSS px for the representative heavy-atom diameter and 4–8 CSS px for the backbone C–C bond. The normalized minimum score passes through smoothstep from molecular weight 0 to 1; coarse weight is its complement. A 0.04 score deadband retains fully molecular or fully coarse state at the edges when camera projection jitters. Elapsed time and chain age do not select representation. A missing projection sample retains the previous blend.

During growth, the full displayed finite fragment and every readable incorporated unit remain atomistic. A camera pullback starts only when the complete visible backbone approaches the live safe region. This makes the same spheres and bonds visibly shrink before the screen-space score falls into the LOD transition. Within the transition, atomistic detail and a tube occupy the same backbone coordinates and exchange opacity smoothly. At coarse completion, unreadable atomistic atoms—including the growth tip—are removed. Feed follows the same atom-size logic.

## Bounded renderer

The maximum PE continuation is 72 units, two backbone points per unit, and 176 total backbone points. The coarse mesh reserves 1,408 vertices and 8,400 indices (8 radial sides); its visible draw range grows along the path. For the ethene template, fixed instanced capacities are 432 chain atoms, 432 chain bonds, 36 Feed atoms, 30 Feed bonds, 12 intermediate marker atoms, 6 marker bonds, and 6 particles. The renderer has 10 scene objects, 5 geometries, and 9 materials. Repeats never allocate individual `Mesh` objects. The coarse tube targets 2.8 CSS px apparent width, remains a lit 3D surface, and has bounded world-space compensation.

The temporary pools and tube are disposed on Lab close, tab/lifecycle cancellation, completion handoff, purge, and explicit disposal. Cleanup restores the finite sample's original atom and bond opacity/depth-write state and camera distance. No cinematic projection or LOD measurements run during ordinary idle Reaction Lab frames. Reduced motion shortens the presentation and camera response while retaining the same molecular → smaller molecular → coarse meaning and screen-space thresholds.

## Camera and chain shape

The camera projects the complete visible path against the largest clear rectangle derived from the live canvas and equipment bounds. Before changing distance, it pans in the camera plane to center the whole path in that safe rectangle; this avoids paying for an off-center endpoint with unnecessary zoom-out. During growth it moves outward only when the centered path approaches the fit target, using a 76% safe-region major-span target with a 1.8% fit margin; it does not move because an age counter changed. The final path must occupy 60–85% of the safe-region major span and at least 24% of its minor span, stay centered within 12 CSS px, keep every centerline point and tip inside the safe frame, and avoid clipping. The camera is held still during the long-chain observation phase.

The deterministic PE continuation preserves the chemistry-derived first tangent, then uses three persistent, seeded camera-plane direction changes rather than periodic sine motion or per-unit random jitter. Browser curvature review samples the rendered path once per incorporated repeat unit, smoothing the intrinsic bond-level zigzag, and checks projected path length / chord length above 1.10, cumulative turn, and maximum local turn. The plan is one broad, calm chain, not a coil or an ensemble. Static morphology remains an independent Task ② renderer and is not used during this cinematic or its hold.

## Evidence and regression

`tests/polymer-growth-plan.test.mjs` checks finite-fragment anchoring, CSS-pixel LOD thresholds and hysteresis, screen-space broad-curvature bounds, whole-readable-chain persistence, same-path crossfade, fixed capacities, stable hold resources, and disposal. `tests/reaction-lab-polymer-browser.test.mjs` drives the production Stage B PE route with real pointer gestures at 390×844 and 1280×900, captures Frames A–F (`frame-a-anchor` through `frame-f-long-chain-hold`), reviews reduced motion and cleanup, and verifies existing route chemistry/discovery remains compatible. CI artifacts contain the screenshots and browser metrics. Task ② morphology is guarded by `tests/polymer-morphology.test.mjs` and is unchanged by this presentation correction.

`scripts/summarize-polymer-growth-profile.mjs` reports update, CPU render-submission, and frame-interval p50 / p95 / peak from the production browser probe. These timings describe sustained samples; isolated headless SwiftShader submission spikes are reported separately and are not treated as a sustained renderer cost.
