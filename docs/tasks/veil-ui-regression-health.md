# Veil UI regression health

## Goal
Restore `tests/veil-ui-check.mjs` as a fully green production UI regression test after recent UI simplification and Task A loadout integration.

## Scope
- Remove stale assertions that reference deleted DOM such as `stock-c` / `stock-o`.
- Update stale expectations that still assume repeat craft-to-tank controls.
- Preserve behavioral coverage for C/O access, handmade molecule discovery, loadout selection, launch auto-synthesis, propulsion, cooling, return, reset, and persistence.
- Keep encyclopedia assertions aligned with the current separation of reference content and gameplay supply controls.
- Keep CHO spatial completion coverage independent from saved loadout affordability.
- Do not change product behavior unless the test exposes a real regression.

## Completion criteria
- `tests/veil-ui-check.mjs` passes to completion.
- `tests/supply-tanks.test.mjs` remains green.
- Repository hygiene passes.
- Changes are merged to `main`.

## Status
Completed on 2026-09-08. The regression suite was aligned with current loadout/auto-synthesis and encyclopedia behavior, and the full Veil UI check is green again.
