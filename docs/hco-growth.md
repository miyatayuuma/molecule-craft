# H → C → O / Expedition Core v4

The current continuous H/C/O world uses a finite-sortie exploration loop:

> collect → stay for one more cluster → attract danger → spend propulsion → return → craft → change the next sortie

It adds no element, molecule, stage, attack, boss, loadout screen or recipe-gacha expansion.

## Propulsion roles

Ordinary flight is the same before and after H₂ discovery: speed 164, idle drift 29 and suction radius 30. FLOW/CHAIN never enters speed, steering or pickup-radius calculations.

| Action | Sortie capacity | Output | Intended decision |
|---|---:|---:|---|
| BURST | H₂ × 120 = 3 uses; later propellants use their own capacity/cost/power | 0.65s; selected molecule changes thrust | Emergency separation or one precise current crossing |
| COMBUSTION DRIVE | selected fuel capacity / O₂ × 36 | speed 470; packet duration follows fuel energy and O₂ ratio | Hold for efficient sustained travel; release preserves the packet remainder |

Before launch, a completed handmade model acts as the production design. Holding its role button consumes atoms directly from uncapped BASE STOCK and forms molecules inside the selected Collector Shell tank; there is no separate finished-molecule inventory. Capacity resolves from tank use plus selected molecule. A valid BURST consumes that propellant's `moleculesPerBurst`; H₂ consumes 40 and still provides three full-tank uses. Combustion buys the smallest whole-molecule packet that satisfies the selected fuel's `oxygenPerFuel`; its paid duration is `fuel amount × 2s × energy`. Unused and non-limiting tank contents remain loaded, and actual use is saved atomically without touching BASE STOCK. Replacing a tank visibly discards its old contents and never refunds them.

H₂ remains deliberately poor as normal travel: three short uses cannot become an unlimited cruise. The authored outer current is thin enough for one correctly timed BURST to cross, but normal thrust stalls physically. Later propellants trade peak power for more uses. Fuel alone has no combustion action; O₂ remains the sole active oxidizer. Fuel energy changes endurance while the COMBUSTION top speed stays common.

H₂O remains discoverable and visible in the collection. It has no active tank role, persistent finished inventory, expedition consumer or Inner Horizon requirement.

## Collector Shell, Dust Eaters and return pressure

The controlled object is a temporary Collector Shell deployed from the base and continuously tethered by the ANCHOR FIELD. The shell moves, gathers dust, carries propulsion tanks and holds current-sortie cargo; the base itself never enters the atomic universe.

DUST EATERS are field-disrupting particle phenomena, rendered as light-swallowing cores with orbiting grains, wakes and distorted particle rings. They destabilize the shell's holding and structural fields rather than eating a biological ship, and have no face, teeth, health or attack interaction.

- The first 20 seconds of a sortie are safe.
- Threat then rises from elapsed time and dust collected during the current sortie.
- Thresholds at 8 / 24 / 38 / 58 / 84 threat add up to five bodies.
- Each body converges on a fixed speed of 168. It does not scale with recipes, ship speed or progress.
- Bodies use weak per-slot prediction, alternating flank offsets and separation. One trails or pressures a turn; later bodies approach on different lines and narrow exits.
- HUD pressure appears only after a body exists and shows count and nearest distance rather than another permanent progress system.

Voluntary return starts a 0.8-second ANCHOR LOCK. The existing stable contraction is the lock itself, so no second presentation delay is stacked after it. Physics and contact remain active while the field forms; repeated return input cannot restart it, new propulsion input is blocked, and an H₂ BURST already in flight retains its short inertia. Lock completion performs stable RETRACT and settles 100% of new dust.

Contact before lock completion destabilizes the holding field and switches the same sequence to emergency RETRACT. The Task 1 particles are the 15% of only that sortie's total dust spilling from that field, allocated deterministically across H/C/O before the remainder is converted at three units per atom. Existing atoms, tank contents, recipes, collection records, visited regions and other permanent progress are never subtracted.

Element discovery itself is permanent when C or O is first observed, even if the player is caught later. This prevents a capture from erasing knowledge while still making the unbanked material meaningful.

## Preserved H/C/O world

The fixed route skeleton, seeded interior variation and continuous coordinates remain unchanged. H follows readable lines, Carbon Drift uses two-lane mixed flows and 36-particle C-rich clusters, and the deep Oxygen routes use four moving lanes with two dust units per particle. The shallow route gap is shortened so movement keeps producing pickups. Visited regions remain selectable replenishment anchors.

The deterministic balance run currently separates three choices: a 30-second saving sortie returns about 57 atoms without fuel; a 55-second Carbon sortie returns about 280 atoms while using H₂ only under pressure; a 35-second deep Oxygen sortie returns about 647 atoms while spending CH₄ × 18 and O₂ × 36. The deep run's fuel ingredients are worth 162 atoms, leaving about 485 net atoms—more than three minutes at the measured safe outer rate.

Correct handmade structures can still be discovered without first receiving a hint. Once discovered, supported propellants, fuels and oxidizers become eligible for direct production into their tanks; other molecules remain collection discoveries only. Role data does not enter progression-specific `MOLECULE_USES`, so merely registering a role never changes unknown-signal order or the fresh H → C → O path. Coolant profiles remain hidden until thermal runtime exists.

Key hints remain deterministic: enough H suggests H₂, first C suggests CH₄, and first O suggests O₂ and H₂O. Seeded unknown signals can change optional discovery order or grant dust; the third eligible miss guarantees a hint. Randomness never gates the H → C → O path.

## Tunable boundaries

`src/veil/config.js` owns ordinary flight, collection feel and all sortie/pursuit values under `EXPEDITION`. `src/veil/molecule-roles.js` owns role performance, capacities and whole-molecule combustion packets. `src/veil/growth.js` owns shared BURST/DRIVE output, density profiles and region boundaries. `src/veil/universe.js` owns authored routes, moving dust and physical currents. Resource settlement, schema v6 migration and base-stock protection live in `src/veil/resources.js`. `src/tank-charge.js` owns fixed-time hold charging and cancellation. `src/veil/collector-shell.js` supplies the shared field/supply-shell drawing. `src/veil/telemetry.js` records molecule IDs and consumption per run and prints them only with `?expeditionDebug=1`.

The drive API separates a momentary action (`beginBurst`) from held intent (`setCombustionHeld`).

## Automated evidence and remaining playtest

`tests/expedition-core.test.mjs` and `tests/expedition-balance.test.mjs` verify:

- base stock is uncapped while explicit sortie tanks are capped and persisted;
- invalid repeated BURST input cannot double-spend;
- releasing COMBUSTION DRIVE preserves its active packet;
- FLOW/CHAIN cannot change movement or pickup results;
- no eater appears during the safe interval;
- normal flight is eventually caught by fixed-speed pursuers;
- one emergency BURST increases separation by more than 250 world units in the controlled chase;
- eight seconds of combustion increases separation from one eater by more than 1000 world units;
- full CH₄/O₂ capacity is finite and continued greed still ends in capture after additional bodies arrive;
- voluntary and captured settlement preserve all base-owned state and apply loss only to current cargo.
- saving, normal and deep strategies have distinct fuel, risk and return profiles;
- deep net return exceeds three minutes at the safe outer rate;
- BURST spam, DRIVE always-on, fuel saving, fuel exhaustion and the fixed five-body cap remain bounded.

`tests/generic-propulsion.test.mjs` exercises every registered propellant and fuel, performance ordering, integer combustion packets, remainder preservation and staged coolant eligibility. `tests/growth.test.mjs` retains continuity, C-cluster, moving-O, handmade-key-molecule, optional signal and save-migration checks. `tests/supply-production.test.mjs` and `tests/supply-tanks.test.mjs` cover direct atom-to-tank batches, old finished-inventory removal, one-kind replacement, molecule capacities and schema v2–v6 persistence. `tests/tank-charge.test.mjs` covers the 1.5-second full charge, proportional top-up/release, replacement phase and cancellation safety. `tests/veil-ui-check.mjs` drives the Collector Shell and supply DOM through cargo collection, return settlement, completed-molecule long-press supply, explicit collection/craft routes, capped H₂ use, held combustion and automatic captured return.

Run `node scripts/simulate-expedition.mjs` for the per-15-second enemy, cargo, depth and fuel comparison. These are deterministic mechanical checks, not a claim that the risk curve is subjectively final. Phone playtesting still needs to judge when the first pursuer feels fair, whether three BURST cards create good timing decisions, whether holding DRIVE remains comfortable, and whether the 15% loss creates tension without discouraging another sortie.
