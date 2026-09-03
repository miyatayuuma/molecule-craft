# Generic Propulsion / Generic Tank Runtime v1

Baseline: `main` at `45148bbb9bf66daf88af8891bf4d88a2ee09d583`.

## Implemented

- `src/veil/molecule-roles.js` now supplies active propellant/fuel/oxidizer eligibility, molecule-specific tank capacities and whole-molecule combustion packets.
- All five registered propellants can be selected and consumed by BURST. `moleculesPerBurst` controls cost and `burstPower` changes real movement while H₂ remains the strongest three-use baseline.
- All fifteen registered fuels can run COMBUSTION DRIVE with O₂. Fuel `energy` controls paid packet duration and `oxygenPerFuel` controls whole-molecule O₂ cost; releasing input preserves paid time and non-limiting remainder.
- Collector Shell loadout is represented as propellant, fuel and oxidizer slots containing molecule ID plus amount.
- Resource saves use schema v5. Legacy H₂ 0/1/2/3 BURST units migrate to 0/40/80/120 molecule-count units; legacy CH₄/O₂ and finished molecule inventory are preserved.
- Existing finished molecule inventory can transfer into compatible tanks before new atom-to-tank production. Molecules without an active tank role remain ordinarily mass-producible.
- Supply comparison and expedition HUD use selected molecule data. Coolant candidates remain data-only and hidden until the thermal runtime exists.
- Telemetry records the selected molecule and amount used per tank role.

## Validation

- All 45 `*.test.mjs` tests pass.
- Both jsdom production integration checks pass.
- Repository hygiene passes with zero warnings.
- PWA precache was regenerated last as release `5493e8738c14b935` with 240 verified assets.
