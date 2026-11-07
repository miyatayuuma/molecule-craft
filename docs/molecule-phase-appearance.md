# Molecule Craft — phase appearance data

## Source of truth

`data/phase-appearance.json` is a small curated registry keyed by canonical molecule ID.
`node scripts/build-molecule-db.mjs` embeds the registry as `phaseAppearance` in **all 142**
records of `data/molecules.json`; each record has `liquid` and `gas` entries.
Regenerating molecules cannot discard these properties.

- `kind: colored` means a characteristic hue is supported by the linked scientific reference.
  `labelJa` is a qualitative physical description, while `renderColor` is an **illustrative**
  sRGB hexadecimal swatch chosen for screen readability, *not* a measured spectral color.
- `kind: colorless` means the linked source expressly identifies the phase as colorless.
- `kind: none` means **unverified / no notable characteristic stored**. The UI uses a
  neutral transparent-looking sample, **not** a claim that the real substance is colorless.

Records with a colored liquid need not have a measured boiling point. Color metadata is
independent from boiling-point metadata and does not permit the observation cycle to invent
boiling-point values. Some materials (e.g. 2,4-dinitrotoluene) melt to yellow liquid but may
decompose before a useful normal boiling-point demonstration.

In the physics comparison view, `phaseAppearanceFor(record,phase)` supplies a neutral tint
for both `colorless` and `none`. Appearance records are only forwarded to the visual renderer
for **discovered** molecules. The underlying saved progress and molecular graphs are unchanged.

## Sources

The per-phase PubChem compound pages are stored directly alongside each curated value in
`data/phase-appearance.json`. This deliberately leaves the rest of the 142-molecule catalog
at `kind: none`, instead of guessing the hue from atom colors, oxidation, mixtures, or age.
