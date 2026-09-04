# Supply / Craft UI v2

Baseline: `main` at `45148bbb9bf66daf88af8891bf4d88a2ee09d583`.

## Implemented

- `src/veil/molecule-roles.js` now supplies active propellant/fuel/oxidizer eligibility, molecule-specific tank capacities and whole-molecule combustion packets.
- All five registered propellants can be selected and consumed by BURST. `moleculesPerBurst` controls cost and `burstPower` changes real movement while H₂ remains the strongest three-use baseline.
- All fifteen registered fuels can run COMBUSTION DRIVE with O₂. Fuel `energy` controls paid packet duration and `oxygenPerFuel` controls whole-molecule O₂ cost; releasing input preserves paid time and non-limiting remainder.
- Collector Shell loadout is represented as propellant, fuel and oxidizer slots containing molecule ID plus amount.
- Resource saves use schema v6. Legacy tank contents are preserved, while the removed finished-molecule inventory is deliberately discarded without conversion or refund.
- Completed models act as production designs. A fixed-time hold consumes BASE STOCK atoms in one atomic batch and forms molecules directly inside a compatible tank; replacing contents visibly discards the old load.
- Supply candidates use lightweight SVG thumbnails while only the selected molecule mounts a 3D viewer. Loaded candidates sort first, comparison bars retain the loaded marker, and coolant remains hidden until thermal runtime exists.
- The field and supply panel share the same Collector Shell drawing. Active tank roles have distinct colors and symbols.
- The supply detail owns the explicit craft and collection routes. Selecting a craft target cleans the workspace and shows its formula/atom requirements; launching exploration cleans both workspace and target.
- Telemetry records the selected molecule and amount used per tank role.

## Validation

- All 46 `*.test.mjs` tests pass after regenerating the PWA precache.
- Both jsdom production integration checks pass.
- Repository hygiene passes with zero warnings.
- PWA precache was regenerated last as release `61bedf9ac79bb514` with 242 verified assets.
