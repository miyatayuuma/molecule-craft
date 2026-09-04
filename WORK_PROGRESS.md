# Heat / Coolant v1

Baseline: `main` at `0583135` (merged Supply / Craft UI v2).

## Implemented

- COMBUSTION DRIVE now has a separate 0–100 propulsion heat loop. Methane reaches overheat after about ten uninterrupted seconds; normal flight and BURST remain thermally independent.
- Overheat stops combustion at 100, preserves already paid packet time, naturally cools at 14 points per second and automatically re-ignites held input after reaching 55.
- The automatic thermostat starts at 35. One durably consumed coolant molecule funds one second of cooling at the molecule profile's `coolingPower`; failed saves grant neither cooling nor local consumption.
- All eight registered coolant profiles are active through the existing schema v6 coolant tank and direct-production flow.
- Collector Shell compares coolant output and capacity. The flight HUD shows heat, thermal state, coolant identity and remaining amount, with compact cooling/depletion/overheat/recovery cues.
- Ambient region heat remains separate in v1. Telemetry now includes coolant loadout/consumption, maximum propulsion heat and overheat count.

## Validation

- The dedicated thermal test covers every coolant profile, hard cutoff, paid-buffer preservation, automatic recovery, depletion, save rejection, BURST independence and telemetry.
- The cooled 35-second deep scenario returns about 647 gross / 404 net atoms; the no-coolant always-on scenario overheats and remains capturable.
- Production jsdom checks pass, including persisted automatic H₂O consumption.
- Headless Chromium at 390×844 and 320×568 shows no viewport overflow or control overlap.
- All 47 Node test cases pass, both production jsdom checks pass, and repository hygiene reports zero warnings.
- PWA precache was regenerated last as release `56c9b61ebe0a1060` with 242 verified assets.

## Deferred

- Environment-specific coolant suitability and manual coolant controls remain future work.
- O₂ tank repair remains the next separate progression-system candidate.

# Previous: Supply / Craft UI v2

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
