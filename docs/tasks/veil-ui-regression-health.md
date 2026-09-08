# Veil UI regression health

## Goal
Restore `tests/veil-ui-check.mjs` as a fully green production UI regression test after recent UI simplification and Task A loadout integration.

## Scope
- Remove stale assertions that reference deleted DOM such as `stock-c` / `stock-o`.
- Update stale expectations that still assume repeat craft-to-tank controls.
- Preserve behavioral coverage for C/O access, handmade molecule discovery, loadout selection, launch auto-synthesis, propulsion, cooling, return, reset, and persistence.
- Do not change product behavior unless the test exposes a real regression.

## Completion criteria
- `tests/veil-ui-check.mjs` passes to completion.
- `tests/supply-tanks.test.mjs` remains green.
- Repository hygiene passes.
- Precache remains consistent if source files change.
- Changes are merged to `main`.
