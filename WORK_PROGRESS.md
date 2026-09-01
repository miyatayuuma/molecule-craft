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

## Phase 3 — explicit propulsion tanks

- Implemented: persistent H₂/CH₄/O₂ Collector Shell tanks separate from BASE STOCK; atomic full-fill actions; exact transferable/required/shortage preview; effective COMBUSTION packets/seconds; shortage buttons preselect Phase 2 production quantities.
- Save migration: schema 2 → 3 transfers the former capped automatic load into tanks and subtracts the same molecules from BASE STOCK, preserving total inventory and immediate expedition capability.
- Changed: `src/veil/resources.js`, `src/veil/supply.js`, `index.html`, `veil.css`, targeted docs and expedition/resource/DOM tests.
- Pending: Phase 4–5 setting/ANCHOR LOCK, Phase 6 integration reviews.
- Tests: `supply-tanks`, `supply-production`, `expedition-core`, `growth`, `veil`, `veil-reset`, and `veil-ui-check` pass.
- Next: commit and checkpoint Phase 3, then integrate Collector Shell / ANCHOR FIELD setting and risk-bearing return lock.

## Phase 4–5 — Collector Shell setting and risk-bearing return

- Implemented: Collector Shell / ANCHOR FIELD terminology and shell rendering; Dust Eater is presented as a holding-field disruption that spills expedition cargo before emergency retrieval.
- Return flow: voluntary return now starts a single 0.8 s stable `ANCHOR LOCK`; world physics and Dust Eater contact remain active until completion. Contact during the lock switches to the existing Task 1 cargo scatter and Task 2 emergency retrieval. Repeated return input cannot reset or compete with either transition.
- Propulsion: new input is blocked during the lock, while already-paid COMBUSTION packet time and an already-started H₂ BURST retain their short inertia. Empty tanks still allow free normal movement and voluntary return.
- Changed: `src/veil/config.js`, `src/veil/ui.js`, `src/veil/renderer.js`, exploration HUD/help copy and styles, focused setting docs, and return/expedition tests.
- Pending: Phase 6 integration reviews, mobile-width visual verification, full test/PWA run, and final PR sync.
- Tests: focused expedition, return VFX, Task 1 loss-particle, audio, supply, and DOM interaction suites pass.
- Next: commit and checkpoint Phase 4–5, then review the complete craft → supply → expedition → return loop twice.
