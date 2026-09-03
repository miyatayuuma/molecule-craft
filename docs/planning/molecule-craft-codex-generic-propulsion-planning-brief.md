# Molecule Craft — Codex Planning Brief
## Generic Propulsion / Generic Tank Runtime v1

### Status at handoff

- Repository: `miyatayuuma/molecule-craft`
- Base: latest `main`
- Confirmed main commit at handoff: `45148bbb9bf66daf88af8891bf4d88a2ee09d583`
- The previous ChatGPT Work task was deleted after stalling. Its local edits were **not** committed or merged.
- Therefore, plan from current `main`; do not assume any Work-side implementation exists.
- PR #21 is already merged and added the game-balance registry:
  - `src/veil/molecule-roles.js`
  - `tests/molecule-roles.test.mjs`
  - architecture routing update

The immediate request to Codex is to **produce an implementation plan first**, not to redesign the game balance.

---

# 1. Project intent

Molecule Craft has two linked loops:

1. Explore and collect atoms.
2. Manually assemble molecules in the 3D craft workspace.
3. Discover a molecule.
4. Mass-produce/use that discovered molecule from BASE STOCK.
5. Its molecular properties change expedition capability.
6. Use that capability to reach deeper resources and discover more molecules.

The important design goal is not merely filling an encyclopedia.  
**Different molecules the player builds should create meaningful differences in gameplay.**

---

# 2. Gameplay invariants that must not be broken

## Craft / inventory

- Placing an atom into the craft workspace temporarily checks it out of BASE STOCK.
- Removing an atom or using “片付ける” returns it to BASE STOCK.
- Bonding, breaking bonds, and conformation changes do not consume extra resources.
- The completed molecule in the craft workspace is a **template/discovery**, not a consumable stored object.
- Mass production consumes atoms from BASE STOCK.
- Atoms currently checked out into the craft workspace cannot also be used for mass production.

## Expedition

- Free normal flight must always remain available.
- Running out of fuel/propellant must never make the player immobile.
- Voluntary return keeps 100% of expedition cargo.
- Dust Eater forced return only loses part of **that expedition’s cargo**.
- BASE STOCK, encyclopedia, discoveries, and existing progression are not lost on forced return.
- H₂ BURST remains an emergency/short-duration propulsion system, not a permanent movement upgrade.
- COMBUSTION DRIVE remains sustained high-speed propulsion.
- FLOW/CHAIN should not become a hidden performance buff again.

## UI

- Prefer direct manipulation, meters, and visible behavior over long explanatory text.
- Do not reintroduce explanation-heavy supply UI.
- Current supply flow is:
  **Collector Shell → tank → compatible discovered molecule → 3D model → encyclopedia → craft → mass production/fill**

---

# 3. Current runtime before this task

The current runtime is still largely hard-coded around:

- H₂-only BURST
- CH₄ + O₂-only COMBUSTION DRIVE
- tank capacity fixed by tank use rather than selected molecule

Relevant current modules:

- `src/veil/molecule-roles.js` — newly added game-balance source of truth
- `src/veil/growth.js` — current active H₂/CH₄/O₂ drive definitions and progression
- `src/veil/resources.js` — resources, tank storage, mass production, save/migration
- `src/veil/supply.js` — Collector Shell / tank selection UI
- `src/veil/engine.js` — propulsion simulation
- `src/veil/ui.js` — expedition HUD/input
- `src/veil/telemetry.js`
- `src/veil/config.js` only if needed

Start by reading:

1. `AGENTS.md`
2. `docs/architecture.md`

Then only the modules above and their direct dependencies.

Do **not** start by reading all of:

- `src/app.js`
- `data/molecules.json`
- generated SVGs
- vendor
- Git history

Inspect only specific molecule records if IDs/formulas need confirmation.

---

# 4. Game-performance source of truth

`src/veil/molecule-roles.js` is the authoritative game-balance registry.

Do not move these values into the chemistry DB.  
Do not re-research physical properties and redesign the numbers unless there is a clear internal contradiction that makes implementation impossible.

The values deliberately combine:

- real chemistry where useful, especially combustion O₂ stoichiometry;
- compressed game values for capacity, energy, heat, cooling, and thrust.

---

# 5. Registered roles

## Propellants

| Molecule | Capacity | Molecules / BURST | Burst Power | Full-tank BURSTs |
|---|---:|---:|---:|---:|
| H₂ | 120 | 40 | 1.00 | 3 |
| NH₃ | 96 | 12 | 0.82 | 8 |
| N₂ | 80 | 10 | 0.72 | 8 |
| CO₂ | 72 | 8 | 0.62 | 9 |
| n-C₄H₁₀ | 40 | 4 | 0.52 | 10 |

Design intent:

- H₂ can hold many molecules but has low mass/volumetric usefulness; its weakness is represented by **large molecules-per-BURST consumption**, not by an artificially tiny molecule-count tank.
- Later propellants trade peak burst power for more BURST uses.
- BURST ordering should feel:
  **H₂ > NH₃ > N₂ > CO₂ > n-C₄H₁₀**

---

# 6. Registered fuels

CH₄ is the runtime baseline.

Expected continuous-drive model:

```text
baseFuelRate = current CH₄ consumption rate

fuelConsumptionRate = baseFuelRate / energy
oxygenConsumptionRate = fuelConsumptionRate * oxygenPerFuel
```

The COMBUSTION DRIVE top speed should remain common across fuels in v1.  
Fuel differentiation comes from:

- tank capacity
- fuel consumption efficiency
- O₂ demand
- later, heat factor

| Fuel | Capacity | O₂ / fuel | Energy | Heat factor |
|---|---:|---:|---:|---:|
| H₂ | 28 | 0.50 | 0.30 | 0.75 |
| NH₃ | 24 | 0.75 | 0.40 | 0.70 |
| CH₃OH methanol | 20 | 1.50 | 0.80 | 0.85 |
| C₂H₂ ethyne/acetylene | 12 | 2.50 | 1.45 | 1.25 |
| CH₄ methane | 18 | 2.00 | 1.00 | 1.00 |
| dimethyl ether | 14 | 3.00 | 1.65 | 1.00 |
| C₂H₅OH ethanol | 16 | 3.00 | 1.54 | 0.95 |
| C₂H₆ ethane | 14 | 3.50 | 1.78 | 1.05 |
| C₃H₈ propane | 11 | 5.00 | 2.55 | 1.10 |
| n-C₄H₁₀ | 9 | 6.50 | 3.31 | 1.15 |
| isobutane | 9 | 6.50 | 3.29 | 1.13 |
| n-C₅H₁₂ | 7 | 8.00 | 4.10 | 1.20 |
| n-C₆H₁₄ | 6 | 9.50 | 5.19 | 1.25 |
| 1-butanol | 10 | 6.00 | 3.02 | 1.00 |
| isobutanol | 10 | 6.00 | 3.00 | 0.98 |

O₂ is currently the only oxidizer.

Current O₂ capacity remains **36** in this task.

A later tank-repair progression is expected to increase it:

```text
36 → 48 → 60
```

Do not implement that repair progression in this task, but avoid architecture that makes dynamic O₂ capacity difficult.

---

# 7. Coolant data already exists but coolant runtime is NOT in this task

Registered coolant candidates currently include:

- H₂O
- NH₃
- CO₂
- methanol
- ethanol
- ethylene glycol
- propylene glycol
- N₂

Each has game values such as:

- `capacity`
- `coolingPower`
- `environmentTolerance`

Fuel records also already contain `heatFactor`.

For this task:

- retain these values;
- do not duplicate them elsewhere;
- generic tank architecture should allow coolant to use the same capacity-resolution mechanism later;
- do **not** implement heat accumulation, coolant consumption, overheat, or environment modifiers yet;
- do not show coolant candidates as usable if runtime support is not yet active.

The next likely task is Heat / Coolant v1.

---

# 8. Target behavior for Generic Propulsion / Generic Tank Runtime v1

The plan should cover all of the following.

## A. Molecule-specific tank capacity

Replace the assumption that one tank use has one fixed molecule capacity.

Effective capacity must resolve from:

```text
tank use + selected molecule
```

Examples:

- propellant H₂ → 120
- propellant n-butane → 40
- fuel CH₄ → 18
- fuel H₂ → 28
- fuel n-hexane → 6
- oxidizer O₂ → 36

Changing the molecule in a one-kind tank should never leave `amount > capacity`.

## B. Generic propellant runtime

A discovered compatible propellant should be fillable and usable.

One BURST consumes:

```text
moleculesPerBurst
```

Use `burstPower` to create real movement-performance differences while preserving the existing H₂ BURST control feel and short-duration role.

Do not make normal flight dependent on propellant.

## C. Generic fuel runtime

A discovered compatible fuel should be fillable and usable with O₂.

Keep current COMBUSTION DRIVE interaction/top-speed feel as the baseline.

Consumption should reflect:

- `energy`
- `oxygenPerFuel`

Important invariants:

- releasing the drive input must not waste already-paid fuel;
- avoid unnecessary rounding loss;
- if either fuel or O₂ runs out, DRIVE stops;
- remaining contents of the non-limiting tank are preserved.

A continuous/fractional internal model is acceptable if save/runtime integrity remains clean.  
A packet model is also acceptable if it correctly preserves partial progress.

## D. Oxidizer

Only O₂ is active as oxidizer in v1.

No new oxidizers.

## E. Generic expedition loadout

Current H₂/CH₄/O₂-specific expedition preparation should evolve so a run can represent at least:

- propellant molecule ID + amount
- fuel molecule ID + amount
- oxidizer molecule ID + amount

Avoid adding a new H₂/CH₄ special-case every time another molecule is added.

Compatibility adapters are fine while refactoring.

---

# 9. Supply / production behavior

Maintain existing one-kind-tank rules:

- same molecule → top up;
- different molecule → old contents are expelled/replaced;
- residual contents persist after expedition;
- one tank contains one molecule type.

Mass production remains:

```text
BASE STOCK atoms → produce one molecule → directly fill tank
```

The finished molecule visible in the craft workspace is not consumed.

Checked-out craft atoms are not available to production.

---

# 10. Two important compatibility paths that must not disappear

## A. Ordinary mass production for molecules with no tank role

Discovered molecules such as H₂O must still have a normal BASE STOCK → molecule mass-production path even if they are not currently usable in a tank.

This matters for future:

- repair
- shell interaction
- special molecule consumption

Do not let “no tank role” mean “cannot mass-produce”.

## B. Legacy finished-molecule inventory → tank

Older saves may still have finished molecule inventory in `state.molecules`.

If a stored molecule now has a compatible tank role, there must be a way to transfer that **existing finished-molecule inventory** into the appropriate tank.

New production can still go directly from atoms to tank.

Do not silently delete or automatically rewrite old finished-molecule inventory.

---

# 11. Save migration is a critical planning item

Current resources save is schema v4.

The largest semantic migration issue is old H₂ propellant amount.

Old meaning:

```text
H₂ tank amount 0–3 == number of BURST uses
```

New meaning:

```text
H₂ tank amount == molecule-count game units
40 H₂ per BURST
120 H₂ == 3 BURSTs
```

Migration must preserve gameplay value:

```text
0 → 0
1 → 40
2 → 80
3 → 120
```

Do not use an ambiguous runtime heuristic.  
A schema bump to v5 is reasonable if needed.

Also explicitly verify:

- legacy CH₄ amount semantics
- legacy O₂ amount semantics
- old v1/v2/v3 migrations
- future-schema protection
- corrupted-save protection
- cross-tab conflict protection
- residual tank contents after reload

Existing player propulsion capability must not be accidentally reduced by migration.

---

# 12. HUD / supply UI requirements

Keep the current Collector Shell UI architecture.

## Propellant UI should communicate

- selected molecule
- current amount / molecule-specific capacity
- available BURST count
- relative burst power

## Fuel UI should communicate

- current amount / molecule-specific capacity
- relative energy/endurance
- required O₂

For fuel comparison, “required O₂” should mean:

```text
fullTankO2 = fuel capacity * oxygenPerFuel
```

Examples intentionally can exceed the current O₂ capacity of 36.

This is desirable because it naturally reveals the future progression problem:

> “I discovered a high-performance fuel, but my O₂ tank cannot exploit all of it.”

Avoid adding long tutorial text.

---

# 13. Progression gating

Fresh-save progression must remain:

```text
H₂ discovery
→ H₂ BURST
→ reach C
→ CH₄ discovery
→ reach O
→ O₂ discovery
→ COMBUSTION DRIVE
```

Later-role molecules existing in the chemistry DB must not skip early progression.

A role candidate should not be presented as usable just because its DB record exists.

Respect:

- actual molecule discovery state
- actual element availability/acquisition
- current progression

N/F/P/S/Cl currently do not have general expedition collection fields.  
Do not make unavailable-element molecules appear practically craftable on a fresh save merely because their role profile exists.

---

# 14. Known hidden coupling / implementation trap

Current `MOLECULE_USES` in `growth.js` is not just a neutral role registry.

It is also involved in existing progression/signal logic; ordinary DB molecules can be excluded from unknown-signal discovery if they are inserted there.

PR #21 intentionally created `molecule-roles.js` separately to avoid this coupling.

The plan should explicitly decide how to:

- make the new role registry drive tank/runtime eligibility;
- preserve current progression-specific `MOLECULE_USES` behavior where still needed;
- avoid mass-copying all role candidates into `MOLECULE_USES`;
- avoid silently changing unknown-signal candidate order/eligibility.

---

# 15. Telemetry

Existing expedition telemetry should continue to work.

Prefer extending it to record:

- propellant molecule ID
- propellant consumed
- fuel molecule ID
- fuel consumed
- O₂ consumed
- BURST count
- DRIVE active time

This is useful later when balancing atom field abundance against demand.

Do not change the existing debug-only output behavior unnecessarily.

---

# 16. Resource-balance philosophy

Do **not** try to fully balance atom rarity in this task.

Atom resource value will be tuned later through playtesting of:

```text
field supply
×
demand from propellant / fuel / repair / coolant / other systems
```

Example:

If N becomes scarce, NH₃ competes across fuel/propellant/coolant roles, and that competition determines N’s actual game value.

Therefore:

- do not rebalance H/C/O/N field distribution now;
- instrument the system enough to make later playtesting meaningful.

---

# 17. Explicit non-goals for this task

Do not include these in the implementation scope:

- Heat accumulation runtime
- coolant consumption
- overheat behavior
- environment-based coolant modifiers
- O₂ tank repair progression
- new element field/stage
- repair molecules
- special molecule world interactions
- new oxidizers
- additional fuel/propellant candidates
- major chemistry DB changes
- normal flight rebalance
- Dust Eater rebalance
- FLOW/CHAIN gameplay buffs

---

# 18. Focused regression risks the plan should address

## Save / inventory

- old H₂ 3-BURST capacity becoming 3 molecules
- CH₄/O₂ residual amounts being damaged
- capacity overflow after molecule replacement
- old finished molecule inventory becoming stranded
- no-role molecule production disappearing
- future saves being overwritten
- save failure leaving stock/tank partially mutated

## Runtime

- propellant UI allows a molecule that BURST code cannot consume
- fuel UI allows a molecule that COMBUSTION runtime cannot consume
- fuel/O₂ rounding destroys residual resources
- high-energy fuel does not actually extend endurance
- `oxygenPerFuel` does not match runtime O₂ use
- H₂ no longer gives 3 full-tank BURSTs
- normal movement stops when propulsion resources are empty

## Progression

- later discovered DB molecules bypass H → C → O progression
- unknown-signal discovery is altered by role registration
- unavailable elements are shown as currently usable

## UI

- current H₂/CH₄/O₂ path disappears
- 320 px class mobile layouts become unusable
- tank header still assumes one global capacity
- comparison meters use old hard-coded H₂/CH₄ values

---

# 19. Tests that should appear in the plan

Use focused tests rather than unrelated full-suite ritual runs.

Likely relevant:

- `tests/molecule-roles.test.mjs`
- `tests/supply-tanks.test.mjs`
- `tests/growth.test.mjs`
- expedition-core tests
- save/migration tests
- veil UI / mobile UI checks
- telemetry tests if extended
- repository hygiene

Add focused tests for at least:

1. each propellant’s capacity / molecules-per-BURST / full-tank BURST count;
2. real selected propellant driving BURST consumption;
3. multiple fuels driving consumption from `energy` and `oxygenPerFuel`;
4. preservation of non-limiting fuel/O₂ remainder;
5. molecule-specific tank capacities;
6. H₂ old-save `1/2/3 → 40/80/120` migration;
7. legacy finished-molecule inventory transfer path;
8. no-role molecule ordinary mass production;
9. fresh-save H → C → O progression unchanged;
10. unsupported coolant roles still not exposed as active runtime.

If runtime assets change, regenerate only the necessary generated outputs and rebuild precache **last**.

---

# 20. Completion target for the later implementation

The eventual implementation should be considered complete when:

1. All 5 registered propellants can be selected, filled, and used for BURST after legitimate discovery.
2. All registered fuels can be selected and filled after legitimate discovery.
3. Fuel `capacity`, `energy`, and `oxygenPerFuel` affect real runtime behavior.
4. O₂ remains the only active oxidizer.
5. Tank capacity is molecule-specific everywhere: UI, validation, save, expedition.
6. H₂ full tank still means 3 BURSTs.
7. Existing H₂/CH₄/O₂ saves retain equivalent propulsion capability.
8. Legacy finished-molecule inventory can be moved into compatible tanks.
9. No-role discovered molecules remain mass-producible.
10. Fresh-save H → C → O progression remains intact.
11. The same tank-capacity resolver can support coolant in the next task.
12. Focused regression review passes.

---

# 21. What Codex should return now

For this turn, return a **concrete implementation plan**, not implementation yet.

The plan should identify:

- owning modules and expected responsibility changes;
- data-flow changes from supply → save → expedition → engine → HUD;
- proposed save schema/migration strategy;
- how fractional/continuous fuel consumption will be represented safely;
- how generic tank capacity will be resolved;
- how the `MOLECULE_USES` hidden coupling will be avoided;
- test plan mapped to each major change;
- any genuine blocker or specification contradiction.

Prefer a staged plan that minimizes regression risk and avoids a large rewrite.

Do not ask for approval of ordinary engineering details if the existing code makes a clear minimal choice possible. The user will review the plan at the design level before implementation.
