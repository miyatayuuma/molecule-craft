# MC-COMPARE-01 P1-R1 — opt-in physical instrument preview

Preview entrypoint: `/?comparePhysics=1` (or `/molecule-craft/?comparePhysics=1` on GitHub Pages). Open **図鑑 → 分子 → くらべる**. The normal encyclopedia is unchanged without the query parameter.

## Interaction contract

- Drag the beads left or right to pull a continuous material coordinate across the central support; release to snap to a molecule. Keyboard arrows and gamepad remain available.
- The strand uses Verlet integration with gravity, distance constraints, weak bend resistance and local bead contact. Each gap contains four rope segments; two descending sides are visible. The visible rope is a lit Three.js three-ply tube, not a decorative SVG connector.
- The central display reads the focused molecule's molar mass or atom count. Equal values intentionally show equal readouts; their beads remain separate. Unknown molecules never reveal their identity, image or physical value.
- This is an **opt-in visual prototype**, not the final accepted artwork. The real Blender `Scifi pedestal turntable` still needs its author-distributed source file (Blend Swap 22567, CC-BY). The current pedestal is the CC0 `Hologram Projector` with its floating hologram hidden, temporarily restyled to fit the instrument.

## Asset/license sources

- Preferred stage (awaiting official download): `Scifi pedestal turntable`, Blend Swap, https://blendswap.com/blend/22567 — Creative Commons Attribution. The release must give the author credit after official source acquisition and conversion.
- Temporary stage: `Hologram Projector`, Grab3D, https://grab3d.com/models/sci-fi/hologram-projector/ — CC0 1.0, 2026. The shipped file is `assets/compare/hologram-projector-cc0.glb`.
- Rope dynamics and twisted-strand visual ideas: Codevember 2026, day 04 (Tangle), by mrdoob, https://github.com/mrdoob/codevember-2026/tree/main/04 — MIT; our implementation is a browser/DOM-oriented adaptation, not a copy of the WebGPU engine.
- GLTFLoader and BufferGeometryUtils: Three.js r180, MIT (see `vendor/three/LICENSE`).

## Acceptance remains open

Before changing the default compare view, verify visual rope, stage fit, touch control, inertia, discovery masking, gamepad, mobile performance and selected final asset in a real browser. The page being accessible is not by itself approval of the visual quality.
