# MC-COMPARE-01 P1-R1 — physical instrument

Entrypoint: `/` (or `/molecule-craft/` on GitHub Pages). Open **図鑑 → 分子 → くらべる**. The physical instrument is the default, and `?comparePhysics=0` selects the previous nonphysical comparison as a reversible fallback.

## Interaction contract

- Pull any bead freely in two dimensions; the string follows and sways. The two tails spread toward the left and right instead of dangling vertically. Releasing anywhere automatically draws the bead closest to the analyser onto its central support, without a narrow drop target. Background horizontal drags, keyboard arrows and gamepad remain available.
- The strand uses Verlet integration with gravity, distance constraints, weak bend resistance and local bead contact. Each gap contains four rope segments; two descending sides are visible. The visible rope is a lit Three.js three-ply tube, not a decorative SVG connector.
- When WebGL is unavailable, the same physical state is rendered on a 2D canvas with a static Blender render of the same CC-BY pedestal. The fallback image is produced by `scripts/prepare-compare-pedestal.py` from the original `.blend`, not a newly modeled asset.
- A fixed, high-contrast instrument readout separates the property label, large tabular digits, unit and measurement status, without covering the pedestal or the focused bead. Equal values intentionally show equal readouts; their beads remain separate. Unknown molecules never reveal their identity, image or physical value.
- The BlendSwap `Scifi pedestal turntable` replaces the temporary CC0 hologram projector; the authored mesh, UVs and mapped surfaces are preserved. The underlying rope dynamics and control scheme are unchanged.

## Asset/license sources

- Preferred stage (installed): `Scifi pedestal turntable` by **bill1411**, BlendSwap, https://blendswap.com/blend/22567 — **CC BY 3.0**. Source ZIP was provided by the user in GitHub Release [`compare-stage-source`](https://github.com/miyatayuuma/molecule-craft/releases/tag/compare-stage-source). Source and conversion details: `assets/compare/ATTRIBUTION.md`. The production files are `assets/compare/scifi-pedestal.glb` (1024px texture maps for mobile) and `assets/compare/pedestal-preview.png`.
- Former temporary stage, retained as a reversible backup: `Hologram Projector`, Grab3D, https://grab3d.com/models/sci-fi/hologram-projector/ — CC0 1.0, 2026. The original GLB is `assets/compare/hologram-projector-cc0.glb`.
- Rope dynamics and twisted-strand visual ideas: Codevember 2026, day 04 (Tangle), by mrdoob, https://github.com/mrdoob/codevember-2026/tree/main/04 — MIT; our implementation is a browser/DOM-oriented adaptation, not a copy of the WebGPU engine.
- GLTFLoader and BufferGeometryUtils: Three.js r180, MIT (see `vendor/three/LICENSE`).

## Visual evaluation

Continue evaluating visual rope, stage fit, touch control, inertia, discovery masking, gamepad, and mobile performance on real devices. The legacy comparison remains accessible with `?comparePhysics=0` if a regression is found.
