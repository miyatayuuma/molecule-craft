# H → C → O / Expedition Core v1

This release keeps the v36 continuous H/C/O world and replaces its passive-upgrade exploration model with a finite-sortie loop:

> collect → stay for one more cluster → attract danger → spend propulsion → return → craft → change the next sortie

It adds no element, molecule, stage, attack, boss, loadout screen or recipe-gacha expansion.

## Propulsion roles

Ordinary flight is the same before and after H₂ discovery: speed 164, idle drift 29 and suction radius 30. FLOW/CHAIN never enters speed, steering or pickup-radius calculations.

| Action | Sortie capacity | Output | Intended decision |
|---|---:|---:|---|
| H₂ BURST | 4 | speed 800 for 0.7s | Emergency separation or one precise current crossing |
| COMBUSTION DRIVE | 6 packets | speed 460; 4s per packet | Hold for efficient sustained travel; release preserves the packet remainder |

One H₂ is consumed only when a valid BURST starts. A combustion packet consumes `CH₄ × 1 + O₂ × 2` only when held propulsion needs a new four-second packet. Launching does not destroy unused stock, and returning does not require refund bookkeeping: the sortie capacity mirrors what is available at the base, while actual use is saved atomically.

H₂ remains deliberately poor as normal travel: four short uses cannot become an unlimited cruise. The authored outer current is thin enough for one correctly timed BURST to cross, but normal thrust stalls physically. CH₄ alone has no action. Discovering O₂ turns the earlier fuel into a sustained drive that crosses the deep opposing flow without checking an inventory flag.

H₂O remains discoverable, visible in the collection and mass-producible. Expedition code has no water consumer and Inner Horizon has no H₂O requirement.

## Dust Eaters and return pressure

DUST EATERS are rendered as light-swallowing cores with orbiting grains, wakes and distorted particle rings. They have no face, teeth, health or attack interaction.

- The first 18 seconds of a sortie are safe.
- Threat then rises from elapsed time and dust collected during the current sortie.
- Thresholds at 10 / 38 / 70 / 105 / 145 threat add up to five bodies.
- Each body converges on a fixed speed of 178. It does not scale with recipes, ship speed or progress.
- Bodies use lead pursuit and mild separation, so one can be outrun by later propulsion while several can form closing angles.
- HUD pressure appears only after a body exists and shows count and nearest distance rather than another permanent progress system.

Contact ends the sortie. A voluntary return settles 100% of new dust; capture discards 15% of only that sortie's dust before the remaining fractional dust is converted at three units per atom. Existing atoms, molecules, recipes, collection records, visited regions and other permanent progress are never subtracted.

Element discovery itself is permanent when C or O is first observed, even if the player is caught later. This prevents a capture from erasing knowledge while still making the unbanked material meaningful.

## Preserved H/C/O world

The fixed route skeleton, seeded interior variation and continuous coordinates remain unchanged. H follows readable lines, Carbon Drift releases radial C-rich bursts from authored clusters, and Oxygen Surge moves O-rich particles through fast three-lane flows. Visited regions remain selectable replenishment anchors.

Correct handmade structures can still be discovered without first receiving a hint. Once discovered, their exact H/C/O cost is used by the existing immediate-plus-hold production control. Optional database molecules such as CO₂ receive collection entries but no expedition action merely by existing.

Key hints remain deterministic: enough H suggests H₂, first C suggests CH₄, and first O suggests O₂ and H₂O. Seeded unknown signals can change optional discovery order or grant dust; the third eligible miss guarantees a hint. Randomness never gates the H → C → O path.

## Tunable boundaries

`src/veil/config.js` owns ordinary flight, collection feel and all sortie/pursuit values under `EXPEDITION`. `src/veil/growth.js` owns molecule roles, BURST/DRIVE output, packet duration, molecule cost and region boundaries. `src/veil/universe.js` owns authored routes, moving dust and physical currents. Resource settlement and base-stock protection live in `src/veil/resources.js`.

The drive API separates a momentary action (`beginBurst`) from held intent (`setCombustionHeld`). A future cruise controller can operate the same held intent without changing molecule costs or inventory storage.

## Automated evidence and remaining playtest

`tests/expedition-core.test.mjs` verifies:

- base stock is uncapped while sortie fuel is capped;
- invalid repeated BURST input cannot double-spend;
- releasing COMBUSTION DRIVE preserves its active packet;
- FLOW/CHAIN cannot change movement or pickup results;
- no eater appears during the safe interval;
- normal flight is eventually caught by fixed-speed pursuers;
- one emergency BURST increases separation by more than 250 world units in the controlled chase;
- eight seconds of combustion increases separation from one eater by more than 1000 world units;
- six finite drive packets still end in capture after additional bodies arrive;
- voluntary and captured settlement preserve all base-owned state and apply loss only to current cargo.

`tests/growth.test.mjs` retains continuity, C-cluster, moving-O, handmade-key-molecule, exact economy, optional signal and save-migration checks. `tests/veil-ui-check.mjs` drives the production DOM through cargo collection, return settlement, capped H₂ use, held combustion, release, unchanged H₂O stock and automatic captured return. The full test suite also covers chemistry, collection, geometry, input and offline release integrity.

These are deterministic mechanical checks, not a claim that the risk curve is subjectively final. Phone playtesting still needs to judge when the first pursuer feels fair, whether a four-BURST limit creates good timing decisions, whether holding DRIVE remains comfortable, and whether the 15% loss creates tension without discouraging another sortie.
