# H → C → O growth loop

This phase extends H Veil into one continuous coordinate space. It keeps the v35 H home course and adds two distinct collection regions, four key molecule roles, and a visible inner horizon. It does not add a world generator, enemies, bosses, a product tree, or molecule-slot UI.

## Player arc

1. **H Veil, before H₂** — speed 138, drift 25, suction radius 17. The central line is playable, while fast shoulders and gaps expose the weak collector. At H24 the game offers a return to crafting.
2. **H₂ discovery** — the ordinary ship immediately changes to speed 208, drift 34, suction radius 62 and a larger CHAIN bonus. Stored H₂ powers a short 670-speed boost with +90 suction. A physical opposing current at the old outer veil requires that thrust.
3. **Carbon Drift** — fixed routes connect visibly to H Veil. Carbon is concentrated in authored masses, not painted onto H lines. Entering a mass releases 30 radial particles (24 C, 6 H); nearby routes guide the player through the burst. Mass centres and small route details vary by seed and return after 42 seconds.
4. **CH₄ discovery** — CH₄ stores one C and four H as fuel. It has no standalone power and does not unlock a gate. Its description and loadout keep the missing oxidizer visible.
5. **Oxygen Surge** — three-lane O-rich streams move along their routes, lateral turbulence bends the ship, and broad heat strata reduce thrust. A cool eddy offers a readable recovery route.
6. **O₂ and H₂O discovery** — O₂ is consumed only as oxidizer: one CH₄ plus two O₂ produces a 3.2-second, 960-speed combustion boost. H₂O is consumed automatically above the heat threshold, removes heat, and sustains cooling for four seconds.
7. **Inner Horizon** — the final opposing hot current is a numeric force and heat field. H₂ thrust alone, cooling alone, or combustion without cooling stalls. Combustion while H₂O removes heat crosses it; no inventory flag opens a door. The reached horizon stays visible as the promise of a later phase.

Region names change only as coordinates cross authored boundaries. The renderer blends blue H clouds into violet Carbon Drift and then warm Oxygen Surge, while all old and new routes remain in one map. Reloading resumes from the deepest visited region. The supply selector can also start a new run at H Veil or another visited anchor, so H replenishment remains short.

## Crafting and economy

The first valid handmade completion of any database molecule registers it as discovered. H₂, CH₄, O₂ and H₂O have explicit expedition roles; ordinary records such as CO₂ register and mass-produce without receiving a special action. The database can gain action metadata later without changing the inventory or craft graph.

Mass production is available only after first completion and consumes the exact H/C/O atom counts. It uses the existing immediate press plus hold repeat control. Removing a handmade molecule to storage does not refund its placed atoms. Combustion consumes `CH₄ × 1 + O₂ × 2`; cooling consumes `H₂O × 1` only when heat requires it.

Dust uses a persistent fractional balance: three dust units become one atom. Ordinary routes naturally mix small amounts of H/C/O, while each region remains the fastest source of its main element. A visited region becomes a replenishment anchor, avoiding a forced full traversal for every shortage.

## Hints, chance and collection

Key hints are deterministic:

- H inventory reveals the H₂ hint.
- First C reveals CH₄.
- First O reveals O₂ and H₂O.
- Correct structures can always be discovered before any hint.

Each region has an authored unknown signal with a seeded roll. It can grant an optional H/C/O-only database structure hint or a resource bonus. The hint chance is 38%, the third eligible miss is guaranteed, and the same region requires 45 more collected atoms before another reward. Randomness changes optional discovery order; it cannot block the key loop.

The collection percentage remains optional. Exploration controls access to C/O; the number of collected molecules still unlocks later N/Cl/S/P/F and craft parts under the existing collection rules. Existing saves migrate discovered structures and any C/O already present in the workspace.

## Tunable systems

Flight, drive, collection, heat, signal and region values live in `src/veil/growth.js`. The base H course remains in `src/veil/config.js` and `src/veil/map.js`. Fixed H/C/O connections and variable cluster contents live in `src/veil/universe.js`. A later cruise controller can call the same drive actions and resource consumers without changing the HUD or inventory schema.

## Automated evidence and remaining playtest

`tests/growth.test.mjs` checks the authored skeleton plus seed variation, the fixed-time H gain before/after H₂, actual opposing-current crossing, carbon burst output, moving O streams, the heat/cooling matrix, handmade recognition of all four key structures, exact molecule costs, CH₄/O₂ consumption, H₂O consumption, ordinary molecule production, signal pity, fractional dust persistence, and v35 migration.

At the current values, a straight 12-second H entry simulation collects H10 before H₂ and H20 after discovery. In the hot-band matrix, H₂ with or without cooling and combustion without cooling all stall; combustion plus cooling reaches Inner Horizon in about 4.8 seconds from the hot-band entrance and consumes two boost activations and one H₂O in the unlimited-fuel test fixture.

These deterministic tests show that the loop is reachable and the upgrades have mechanical value. They do not decide whether a real player wants another run, whether mobile steering stays comfortable through all regions, or whether repeated audio is tiring. Those remain device playtest questions.
