# MC-COMPARE-01 P1-R2 — physical instrument

Entrypoint: `/` (or `/molecule-craft/` on GitHub Pages). Open **図鑑 → 分子 → くらべる**. The physical instrument is the default, and `?comparePhysics=0` selects the previous nonphysical comparison as a reversible fallback.

## Interaction contract

- Pull any bead in two dimensions; adjacent material and the whole strand follow the hand rather than stretching from a fixed guide. The strand forms a slack, shallow arc, sways in a mild ambient current and settles with a restrained release impulse. Releasing anywhere nominates the bead nearest the analyser, then gradually draws it to the socket; the reading switches only after the nominated bead arrives and the others stay separated. Background horizontal drags nominate the nearest bead after a small coast; keyboard arrows and gamepad remain available.
- The strand uses 2D Verlet integration with buoyancy, constant-length distance constraints (including at the held bead), weak bend resistance and local bead contact. Moving the grabbed bead first translates the surrounding rope cohesively, then the solver enforces rest lengths; attraction steers the connected material into place over multiple frames, without an instant positional cut. Distance-only corrective sweeps maintain the segment rest lengths during magnetic movement. Each gap contains four rope segments. The visible rope is a lit Three.js three-ply tube, not a decorative SVG connector.
- When WebGL is unavailable, the same physical state is rendered on a 2D canvas with a static Blender render of the same CC-BY pedestal. The fallback image is produced by `scripts/prepare-compare-pedestal.py` from the original `.blend`, not a newly modeled asset.
- The compact instrument shows only the property label, large tabular digits and unit, without covering the pedestal or focused bead. Instructional captions (including the former snapping and spacing explanations), English status labels and bead count are removed. Beads have a thin, translucent rim, a subtle specular highlight and softer depth shading instead of thick outlines. Equal values intentionally show equal readouts; their beads remain separate. Unknown molecules never reveal their identity, image or physical value.
- The BlendSwap `Scifi pedestal turntable` replaces the temporary CC0 hologram projector; the authored mesh, UVs and mapped surfaces are preserved. The underlying rope dynamics and control scheme are unchanged.

## Asset/license sources

- Preferred stage (installed): `Scifi pedestal turntable` by **bill1411**, BlendSwap, https://blendswap.com/blend/22567 — **CC BY 3.0**. Source ZIP was provided by the user in GitHub Release [`compare-stage-source`](https://github.com/miyatayuuma/molecule-craft/releases/tag/compare-stage-source). Source and conversion details: `assets/compare/ATTRIBUTION.md`. The production files are `assets/compare/scifi-pedestal.glb` (1024px texture maps for mobile) and `assets/compare/pedestal-preview.png`.
- Former temporary stage, retained as a reversible backup: `Hologram Projector`, Grab3D, https://grab3d.com/models/sci-fi/hologram-projector/ — CC0 1.0, 2026. The original GLB is `assets/compare/hologram-projector-cc0.glb`.
- Rope dynamics and twisted-strand visual ideas: Codevember 2026, day 04 (Tangle), by mrdoob, https://github.com/mrdoob/codevember-2026/tree/main/04 — MIT; our implementation is a browser/DOM-oriented adaptation, not a copy of the WebGPU engine.
- GLTFLoader and BufferGeometryUtils: Three.js r180, MIT (see `vendor/three/LICENSE`).

## Visual evaluation

Continue evaluating visual rope, stage fit, touch control, inertia, discovery masking, gamepad, and mobile performance on real devices. The legacy comparison remains accessible with `?comparePhysics=0` if a regression is found.
