# LOADOUT v2 hardware assets

`assets/loadout-v2/loadout-hardware-master.jpg` is the approved attachment supplied with S2.

- source dimensions: 1536 × 921
- source format: JPEG bytes stored with the repository `.jpg` extension
- SHA-256: `03c2350c664d23c1446293e35fd504e3724a732e792f79adbf65d6040ec086ea`
- extraction: spatial, edge-aware background flood matte from the approved master; no redraw, generative fill, resize or style transfer
- design mapping: `xDesign = xSource / 1536 × 1000`, `yDesign = ySource / 921 × 600`

The four transparent PNGs retain the source hardware pixels and use the ownership split encoded by `src/veil/loadout-hardware-layout.js`. `scripts/export-loadout-hardware-layout.mjs` generates the developer-only SVG layout artifact from that metadata.
