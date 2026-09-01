# Expedition UX integration progress

Baseline: `main` at `1e0dde91a60a6a741a2e983ffdb12be20f0dd0c9` (Task 2 merged).

## Phase 1 — propulsion HUD

- Implemented: compact H₂ BURST and effective COMBUSTION gauges; the latter uses the limiting CH₄/O₂ packet count plus the active packet remainder.
- Changed: `src/veil/growth.js`, `src/veil/ui.js`, `index.html`, `veil.css`, `tests/growth.test.mjs`.
- Pending: Phase 2 quantity production, Phase 3 tanks, Phase 4–5 setting/ANCHOR LOCK, Phase 6 integration reviews.
- Tests: `growth`, `expedition-core`, `source-contracts`, and `veil-ui-check` pass.
- Next: commit the stable Phase 1 checkpoint, then start Phase 2.

## Phase 2 — quantity production

- Implemented: explicit −/＋/+5/+10/MAX quantity controls, full H/C/O cost and before/after preview, one-click atomic batch production, duplicate-tap guard, and a 12-atom-capped atom-to-molecule animation.
- Changed: `src/veil/resources.js`, `src/veil/supply.js`, `index.html`, `veil.css`, `README.md`, `docs/architecture.md`, production tests; removed the unused hold-production helper and test.
- Pending: Phase 3 tanks, Phase 4–5 setting/ANCHOR LOCK, Phase 6 integration reviews.
- Tests: `supply-production`, `growth`, `expedition-core`, `source-contracts`, and `veil-ui-check` pass.
- Next: commit and checkpoint Phase 2, then implement persistent expedition tanks in Phase 3.
