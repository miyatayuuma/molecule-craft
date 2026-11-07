# MC-COMPARE-01 P1-R4 — one pinned bead, freely drifting rope

Entrypoint: `/` (or `/molecule-craft/` on GitHub Pages). Open **図鑑 → 分子 → くらべる**. The physical instrument is the default, and `?comparePhysics=0` selects the previous nonphysical comparison as a reversible fallback.

## Interaction contract

- Pull any bead in two dimensions: the selected bead trails the pointer by a small bounded amount, followed by its neighbours as tension travels through the slack strand. The rope no longer translates as a rigid body. Each bead interval has **2× the former physical rope length**, and screen positions are **not** fixed by molecular-property spacing: the beads drift into unequal separations under physical constraints. Release nominates the bead nearest the analyser and gradually attracts only that bead to the socket; the measurement changes after arrival. Background drags, keyboard arrows and gamepad remain available.
- The strand uses 2D Verlet integration with buoyancy, constant-length distance constraints (including at the held bead), weak bend resistance and local bead contact. **Exactly one bead is pinned to the pedestal while idle.** The rest float in two broad, slowly moving lateral air pockets with no per-bead destination coordinates; the deterministic initial shape is not a restoring guide. A short off-screen warm-up removes ruler-like initial spacing. Input temporarily substitutes a softly moving one-bead anchor, propagated exclusively by the solver; no other particles are kinematically translated by a grab or magnet. Distance-only correction passes keep the four subsegments per bead interval at fixed rest lengths. The visible rope is a lit Three.js three-ply tube, not a decorative SVG connector.
- When WebGL is unavailable, the same physical state is rendered on a 2D canvas with a static Blender render of the same CC-BY pedestal. The fallback image is produced by `scripts/prepare-compare-pedestal.py` from the original `.blend`, not a newly modeled asset.
- The compact instrument shows only the property label, large tabular digits and unit, without covering the pedestal or focused bead. Instructional captions (including the former snapping and spacing explanations), English status labels and bead count are removed. **One shared material stylesheet** gives the relationship tree and physical strand the same refined spherical gradients, thin translucent rims and subtle highlights. Equal values intentionally show equal readouts; their beads remain separate. Unknown molecules never reveal their identity, image or physical value.
- The BlendSwap `Scifi pedestal turntable` replaces the temporary CC0 hologram projector; the authored mesh, UVs and mapped surfaces are preserved.

## Asset/license sources

- Preferred stage (installed): `Scifi pedestal turntable` by **bill1411**, BlendSwap, https://blendswap.com/blend/22567 — **CC BY 3.0**. Source ZIP was provided by the user in GitHub Release [`compare-stage-source`](https://github.com/miyatayuuma/molecule-craft/releases/tag/compare-stage-source). Source and conversion details: `assets/compare/ATTRIBUTION.md`. The production files are `assets/compare/scifi-pedestal.glb` (1024px texture maps for mobile) and `assets/compare/pedestal-preview.png`.
- Former temporary stage, retained as a reversible backup: `Hologram Projector`, Grab3D, https://grab3d.com/models/sci-fi/hologram-projector/ — CC0 1.0, 2026. The original GLB is `assets/compare/hologram-projector-cc0.glb`.
- Rope dynamics and twisted-strand visual ideas: Codevember 2026, day 04 (Tangle), by mrdoob, https://github.com/mrdoob/codevember-2026/tree/main/04 — MIT; our implementation is a browser/DOM-oriented adaptation, not a copy of the WebGPU engine.
- GLTFLoader and BufferGeometryUtils: Three.js r180, MIT (see `vendor/three/LICENSE`).

## Visual evaluation

Continue evaluating visual rope, stage fit, touch control, inertia, discovery masking, gamepad, and mobile performance on real devices. The legacy comparison remains accessible with `?comparePhysics=0` if a regression is found.
