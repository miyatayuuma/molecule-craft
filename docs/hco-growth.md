# H → C → O / Expedition Core v2

The current continuous H/C/O world uses a finite-sortie exploration loop:

> collect → stay for one more cluster → attract danger → spend propulsion → return → craft → change the next sortie

It adds no element, molecule, stage, attack, boss, loadout screen or recipe-gacha expansion.

## Propulsion roles

Ordinary flight is the same before and after H₂ discovery: speed 164, idle drift 29 and suction radius 30. FLOW/CHAIN never enters speed, steering or pickup-radius calculations.

| Action | Sortie capacity | Output | Intended decision |
|---|---:|---:|---|
| H₂ BURST | H₂ × 3 | speed 760 for 0.65s | Emergency separation or one precise current crossing |
| COMBUSTION DRIVE | CH₄ × 18 / O₂ × 36 | speed 470; 2s per CH₄ × 1 + O₂ × 2 | Hold for efficient sustained travel; release preserves the packet remainder |

Before launch, molecules move explicitly from uncapped BASE STOCK into independent Collector Shell tanks. A full-supply action commits only when every missing molecule is available; otherwise the UI shows the transferable amount and exact shortage without a partial transfer. One loaded H₂ is consumed only when a valid BURST starts. Combustion consumes loaded `CH₄ × 1 + O₂ × 2` only when held propulsion needs a new two-second packet. Unused tank contents remain loaded, and actual use is saved atomically without touching BASE STOCK.

H₂ remains deliberately poor as normal travel: three short uses cannot become an unlimited cruise. The authored outer current is thin enough for one correctly timed BURST to cross, but normal thrust stalls physically. CH₄ alone has no action. Discovering O₂ turns the earlier fuel into up to 36 seconds of sustained drive that crosses the deep opposing flow without checking an inventory flag.

H₂O remains discoverable, visible in the collection and mass-producible. Expedition code has no water consumer and Inner Horizon has no H₂O requirement.

## Dust Eaters and return pressure

DUST EATERS are rendered as light-swallowing cores with orbiting grains, wakes and distorted particle rings. They have no face, teeth, health or attack interaction.

- The first 20 seconds of a sortie are safe.
- Threat then rises from elapsed time and dust collected during the current sortie.
- Thresholds at 8 / 24 / 38 / 58 / 84 threat add up to five bodies.
- Each body converges on a fixed speed of 168. It does not scale with recipes, ship speed or progress.
- Bodies use weak per-slot prediction, alternating flank offsets and separation. One trails or pressures a turn; later bodies approach on different lines and narrow exits.
- HUD pressure appears only after a body exists and shows count and nearest distance rather than another permanent progress system.

Contact ends the sortie. A voluntary return settles 100% of new dust; capture discards 15% of only that sortie's total dust, allocated deterministically across H/C/O before the remainder is converted at three units per atom. Existing atoms, molecules, recipes, collection records, visited regions and other permanent progress are never subtracted.

Element discovery itself is permanent when C or O is first observed, even if the player is caught later. This prevents a capture from erasing knowledge while still making the unbanked material meaningful.

## Preserved H/C/O world

The fixed route skeleton, seeded interior variation and continuous coordinates remain unchanged. H follows readable lines, Carbon Drift uses two-lane mixed flows and 36-particle C-rich clusters, and the deep Oxygen routes use four moving lanes with two dust units per particle. The shallow route gap is shortened so movement keeps producing pickups. Visited regions remain selectable replenishment anchors.

The deterministic balance run currently separates three choices: a 30-second saving sortie returns about 57 atoms without fuel; a 55-second Carbon sortie returns about 280 atoms while using H₂ only under pressure; a 35-second deep Oxygen sortie returns about 647 atoms while spending CH₄ × 18 and O₂ × 36. The deep run's fuel ingredients are worth 162 atoms, leaving about 485 net atoms—more than three minutes at the measured safe outer rate.

Correct handmade structures can still be discovered without first receiving a hint. Once discovered, quantity controls preview the exact total H/C/O cost and commit one atomic production batch; MAX uses the limiting element. Optional database molecules such as CO₂ receive collection entries but no expedition action merely by existing.

Key hints remain deterministic: enough H suggests H₂, first C suggests CH₄, and first O suggests O₂ and H₂O. Seeded unknown signals can change optional discovery order or grant dust; the third eligible miss guarantees a hint. Randomness never gates the H → C → O path.

## Tunable boundaries

`src/veil/config.js` owns ordinary flight, collection feel and all sortie/pursuit values under `EXPEDITION`. `src/veil/growth.js` owns molecule roles, BURST/DRIVE output, packet duration, density profiles and region boundaries. `src/veil/universe.js` owns authored routes, moving dust and physical currents. Resource settlement and base-stock protection live in `src/veil/resources.js`. `src/veil/telemetry.js` records one-run metrics and prints them only with `?expeditionDebug=1`.

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

`tests/growth.test.mjs` retains continuity, C-cluster, moving-O, handmade-key-molecule, exact economy, optional signal and save-migration checks. `tests/supply-production.test.mjs` and `tests/supply-tanks.test.mjs` cover batch economy, capped transfer and persistence. `tests/veil-ui-check.mjs` drives the production and supply DOM through cargo collection, return settlement, capped H₂ use, held combustion, release, unchanged H₂O stock and automatic captured return. The full test suite also covers chemistry, collection, geometry, input and offline release integrity.

Run `node scripts/simulate-expedition.mjs` for the per-15-second enemy, cargo, depth and fuel comparison. These are deterministic mechanical checks, not a claim that the risk curve is subjectively final. Phone playtesting still needs to judge when the first pursuer feels fair, whether three BURST cards create good timing decisions, whether holding DRIVE remains comfortable, and whether the 15% loss creates tension without discouraging another sortie.
