# UI State Model Audit

This note records the current UI-state ownership before introducing a central coordinator. It is intentionally descriptive: runtime behavior is unchanged in this milestone.

## Scope

Primary user-visible modes:

- `CRAFT`
- `LOADOUT`
- `EXPLORE`
- `COLLECTION`
- `MENU`

Secondary dialogs such as HELP / INFO / RESET remain subordinate to `MENU`/CRAFT orchestration and are not promoted to primary modes here.

## Current ownership map

| State signal | Current writer / owner | Current readers | Risk |
| --- | --- | --- | --- |
| `veilUI.active` | `src/veil/ui.js` | `src/app.js`, reset/update gates | Exploration runtime state is independent from DOM visibility. |
| `#veil-view.hidden` | `src/veil/ui.js`, startup normalization in `src/craft-connections.js` | implicit CSS/DOM behavior | Can disagree with `veilUI.active` or `body.dataset.mode`. |
| `body.dataset.mode` | `src/veil/ui.js`, startup normalization in `src/craft-connections.js` | CSS / global mode styling | Represents only craft/veil today, not all primary UI modes. |
| `.app-shell.inert` | `src/veil/ui.js`, startup normalization in `src/craft-connections.js` | browser input/focus behavior | A stale `true` value makes the craft shell unusable even when exploration is hidden. |
| `#supply-dialog.open` | `src/veil/supply.js` | `src/app.js` `canLeave` / `canSupply` gates | LOADOUT lifecycle is not owned by `game-shell.js`. |
| `launchBusy` | `src/veil/supply.js` | LOADOUT launch handlers | Launch substate only; must not be treated as application mode. |
| `#collection-dialog.open` | `src/collection-ui.js` | local collection logic | Collection dialog lifecycle is independent from `game-shell.js`. |
| `collectionOpen` | `src/app.js` via `collection-ui.js` `onOpenChange` | `canOpen`, launch/reset gates | Duplicates `#collection-dialog.open` and can drift if callbacks do not run. |
| `#menu-dialog.open` and other `dialog.sheet` | `src/game-shell.js` | `gameShell.isOpen()` / `src/app.js` gates | `gameShell.isOpen()` sees sheet dialogs but is not the universal dialog owner. |
| `gameShell.isOpen()` | derived in `src/game-shell.js` | `src/app.js` | Derived aggregate overlaps with direct dialog state checks. |

The application therefore has no single primary-mode value. The active screen is inferred from multiple booleans and DOM properties.

## Required primary-mode invariants

These are the target invariants for the next milestone. They define what must be true after a completed transition.

| Mode | `veilUI.active` | `#veil-view.hidden` | `.app-shell.inert` | `body.dataset.mode` | LOADOUT | COLLECTION | MENU |
| --- | ---: | ---: | ---: | --- | --- | --- | --- |
| `CRAFT` | `false` | `true` | `false` | `craft` | closed | closed | closed |
| `LOADOUT` | `false` | `true` | `false` | `craft` | open | closed | closed |
| `EXPLORE` | `true` | `false` | `true` | `veil` | closed | closed | closed |
| `COLLECTION` | `false` | `true` | `false` | `craft` | closed | open | closed |
| `MENU` | `false` | `true` | `false` | `craft` | closed | closed | open |

Notes:

- `body.dataset.mode` remains `craft` for modal craft-side modes in the minimal design. A future coordinator does not need to introduce new CSS modes unless useful.
- `.app-shell.inert` is an exploration-only invariant. Dialog modality already handles craft-side modal input suppression.
- `veilUI.active` is exploration-runtime state, but after a committed transition it must agree with the primary mode.

## State transitions

| From | Event | To | Required completion condition |
| --- | --- | --- | --- |
| CRAFT | open LOADOUT | LOADOUT | supply dialog open, exploration inactive |
| LOADOUT | close | CRAFT | supply dialog closed, craft interactive |
| LOADOUT | launch succeeds | EXPLORE | LOADOUT closed, exploration initialized and committed |
| LOADOUT | launch fails | LOADOUT | exploration inactive/hidden, craft shell interactive, LOADOUT restored for retry |
| EXPLORE | normal return | CRAFT | RAF/input/audio stopped, exploration hidden, craft interactive |
| EXPLORE | forced return | CRAFT | same invariant as normal return |
| CRAFT | open collection | COLLECTION | collection dialog open only |
| COLLECTION | close | CRAFT | collection dialog closed, craft interactive |
| CRAFT | open menu | MENU | menu dialog open only |
| MENU | close | CRAFT | menu dialog closed, craft interactive |

## Current impossible-state checks

The following combinations are invalid after any completed transition and should become diagnosable assertions in the next milestone:

- `veilUI.active === false` while `body.dataset.mode === 'veil'`
- `veilUI.active === false` while `#veil-view.hidden === false`
- `veilUI.active === true` while `#veil-view.hidden === true`
- `#veil-view.hidden === true` while `.app-shell.inert === true`
- craft-side mode while `.app-shell.inert === true`
- EXPLORE while LOADOUT is open
- EXPLORE while COLLECTION is open
- EXPLORE while MENU is open
- more than one of LOADOUT / COLLECTION / MENU open at once
- `collectionOpen !== #collection-dialog.open`

Some of these are currently recoverable at startup through `normalizeExplorationMode()`, but startup normalization is recovery, not ownership.

## Highest-risk current transition

`LOADOUT -> EXPLORE` remains the most dangerous boundary.

Current sequence in `src/veil/supply.js`:

1. LOADOUT launch preparation succeeds.
2. launch fill is committed.
3. LOADOUT dialog closes.
4. `onLaunchReady()` calls exploration launch.
5. if exploration launch reports failure, LOADOUT reopens.

Current sequence inside `src/veil/ui.js` sets exploration-facing UI state (`active=true`, veil visible, body mode `veil`, app shell inert) before all renderer/HUD/audio/first-frame work is known to have succeeded. Synchronous rollback exists, but the commit boundary is still distributed across modules.

This is a structural risk even after the pointer-lifecycle and PWA freshness fixes.

## Minimal ownership change for milestone 2

Introduce one small UI-state coordinator for primary-mode transitions only. It should own the final synchronization of:

- veil visibility
- `.app-shell.inert`
- `body.dataset.mode`
- mutually-exclusive LOADOUT / COLLECTION / MENU dialog state
- primary mode identity

It should not own:

- exploration physics/run state
- tank fill / resource transaction state
- craft drag / relaxation / 3D interaction substates
- LOADOUT gesture state
- collection internal tab/detail state
- audio/renderer internals

`src/veil/ui.js` should continue to own exploration runtime (`run`, `active`, RAF, input), but must request/commit primary-mode transitions through the coordinator rather than independently mutating global UI state.

## Launch transaction boundary for milestone 2+

The recommended transaction boundary is UI/exploration runtime only:

`prepare run -> initialize renderer/HUD/input -> validate first frame -> commit EXPLORE mode`

LOADOUT resource-fill commitment should remain outside rollback for now. Reversing tank/base-stock mutations would expand the task into persistence/resource transaction semantics and is not required to restore UI-state consistency.

## Milestone 1 conclusion

The root architectural issue is not one stale flag; it is duplicated ownership. The current application uses DOM state and booleans as both source-of-truth and derived state across different modules. The next implementation milestone should centralize only primary UI mode transitions, then move exploration launch's visible-state commit behind successful initialization.
