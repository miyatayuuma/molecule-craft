# Molecule Craft — Project Handoff / Design Context
## Codex / future development reference

**Repository:** `miyatayuuma/molecule-craft`  
**Snapshot date:** 2026-09-03  
**Confirmed latest main at handoff:** `45148bbb9bf66daf88af8891bf4d88a2ee09d583`

> This document is the broad project handoff.
> It intentionally contains both committed direction and speculative ideas.
> **Do not treat every idea in this document as an implementation requirement.**
> Each section labels its status.

---

# 0. Status labels

Use these labels when interpreting this document.

- **[CORE]** — fundamental product/game principle; preserve unless explicitly changed.
- **[IMPLEMENTED]** — already present in main at this handoff.
- **[CONFIRMED]** — agreed design direction, intended for implementation.
- **[NEXT]** — likely near-term task.
- **[CANDIDATE]** — plausible future design, not yet committed.
- **[SPECULATIVE]** — idea worth retaining, may never be implemented.
- **[REJECTED]** — explicitly tried/rejected or intentionally abandoned. Do not resurrect without a new explicit request.
- **[WATCH]** — known regression/debt/risk to re-check when touching related code.

---

# 1. Product identity

## [CORE] What Molecule Craft is

Molecule Craft is intended to combine:

1. **3D molecular construction**
2. **resource exploration**
3. **molecule discovery**
4. **mass production from collected atoms**
5. **gameplay effects derived from the properties of the molecules the player created**

The long-term loop is:

```text
EXPLORE
→ collect atoms
→ RETURN
→ manually build a molecule in 3D
→ discover it
→ mass-produce / load / use it
→ its properties alter expedition capability or world interaction
→ reach new resources / environments
→ discover more molecules
```

The game should not become only:

- an encyclopedia completion game,
- a recipe-clicking crafting game,
- or an arcade exploration game with chemistry as cosmetic flavor.

The key payoff is:

> **“I built a different molecule, and because its properties are different, the game now behaves differently.”**

---

# 2. Core craft philosophy

## [CORE] 3D craft is a workbench, not a recipe UI

The player should directly manipulate a molecular model.

Avoid turning molecule creation into:

- “choose recipe”
- “press craft”
- “correct answer” buttons
- invisible auto-construction

The player should be able to reason through:

- atoms,
- valence,
- unpaired electrons,
- bond order,
- rings,
- molecular geometry,
- conformational freedom.

---

# 3. Craft inventory semantics

## [CORE]

Atoms in the craft workspace are **temporarily checked out from BASE STOCK**.

Rules:

- Placing an atom into the craft workspace decreases BASE STOCK immediately.
- An atom not present in BASE STOCK cannot be placed.
- Bonding, breaking bonds, structural rearrangement, and conformation changes do not consume more resources.
- Removing an atom individually returns it to BASE STOCK.
- `片付ける` returns all workspace atoms to BASE STOCK, then clears atoms/bonds.
- Workspace atoms must not simultaneously count as mass-production inventory.

## [CORE]

A completed molecule in the workspace is **not a consumable object**.

It serves as:

- a discovery,
- a structural template,
- a gateway to later mass production.

Do not return to the earlier “store completed molecule from the craft workspace” model.

---

# 4. Molecular interaction / conformation direction

## [IMPLEMENTED / CORE]

The intended interaction is:

```text
molecule completes
→ settles into a stable structure
→ player grabs any atom
→ swipes / drags
→ force propagates through the molecular skeleton
→ movable bonds respond according to their actual constraints
→ whole molecule sways / changes conformation
```

The desired presentation is physical, not symbolic.

Internal classifications such as:

- ROTATABLE
- RESTRICTED
- LOCKED

may exist, but should not be shown as explicit stamps/icons/numbered axes during ordinary play.

## [IMPLEMENTED]

The repository already contains:

- conformation engine
- torsion model
- force/velocity drag
- whole-skeleton sway
- rigid fragments
- steric handling
- ring/chain intersection protection
- rollback for invalid geometry
- post-release settlement

Relevant modules are documented in `docs/architecture.md`.

---

# 5. Chemistry coverage

## [IMPLEMENTED]

Current chemistry support includes approximately:

- elements: H / C / N / O / F / P / S / Cl
- single / double / triple bonds
- unpaired-electron bonding interaction
- rings
- aromatic structures
- special bonds
- molecule recognition
- formula generation
- 3D stabilization
- conformational motion

Current data snapshot:

- ~162 molecules
- 24 functional groups
- 17 craft parts
- ~179 generated molecule/part models

## [CORE]

`data/molecules.json` should remain a **chemistry / molecular fact database**.

Do not turn it into the game-balance database.

Game properties such as:

- fuel
- propellant
- oxidizer
- coolant
- repair
- shell interaction
- future special effects

belong in game-side data.

---

# 6. Current exploration identity

## [CORE]

The current exploration design is based on:

```text
collect
→ get greedy
→ stay longer / go deeper
→ threat rises
→ spend propulsion resources to escape or push deeper
→ return safely
```

It is a Risk / Reward loop.

## [IMPLEMENTED]

Current continuous H → C → O expedition space includes:

- H Veil
- Carbon Drift
- Oxygen Surge
- Inner Horizon / frontier

Normal flight remains free.

Current baseline values around this handoff include:

- normal speed ~164
- idle drift ~29
- suction radius ~30

Treat exact values in source as authoritative.

---

# 7. H₂ BURST role

## [CORE]

H₂ is not a permanent speed upgrade.

It is:

> **primitive short-duration gas propulsion / emergency burst**

Intended role:

- strong instantaneous acceleration
- short duration
- emergency escape
- crossing difficult flow
- tactical use under Dust Eater pressure

Do not restore large permanent movement/suction bonuses from owning H₂.

---

# 8. COMBUSTION DRIVE role

## [CORE / IMPLEMENTED baseline]

CH₄ + O₂ currently powers sustained high-speed travel.

Its role is:

- continuous propulsion
- deeper travel
- sustained escape
- stronger route commitment than BURST

The drive is intended to create meaningful resource sink.

Fuel should not be a decorative “one molecule per trip” resource.

---

# 9. Dust Eater

## [CORE / IMPLEMENTED]

Dust Eater is a pursuit / pressure mechanic, not a combat enemy.

Conceptually it is closer to:

> **a field-disrupting phenomenon that destabilizes the Collector Shell holding field**

rather than a biological monster.

Current intent:

- initial safety period
- pressure increases with expedition duration and collection
- multiple pursuers can narrow escape routes
- the player does not defeat them
- contact causes forced return

Avoid casually turning this into attack/combat/boss gameplay.

---

# 10. Return rules

## [CORE / IMPLEMENTED]

### Voluntary return

```text
ANCHOR LOCK
→ stable RETRACT
→ 100% of current expedition cargo retained
```

Approximate current anchor lock: ~0.8 s.

### Forced return

Dust Eater contact:

```text
holding field disruption
→ visible particle loss
→ emergency collapse / retract
→ only current expedition cargo loses a fraction
```

Current target loss: ~15%.

Never remove:

- BASE STOCK
- previous molecules
- encyclopedia discoveries
- progression
- permanent systems

on forced return.

---

# 11. Collector Shell / supply architecture

## [IMPLEMENTED / CORE]

The expedition body is the **Collector Shell**.

The shell is not the base itself; it is a temporary collection/expedition structure linked back through the Anchor Field.

Current supply path:

```text
Collector Shell
→ tank type
→ compatible discovered molecule
→ molecule 3D model
→ encyclopedia
→ craft
→ mass production / fill
```

Current tank categories:

- propellant
- fuel
- oxidizer
- coolant

The UI should remain object/action driven rather than tutorial-text driven.

---

# 12. Tank production semantics

## [IMPLEMENTED / CORE]

Current desired production concept:

```text
BASE STOCK atoms
→ produce one molecule
→ directly fill selected tank
```

The molecule currently completed in the craft workspace is not consumed.

Tank rules:

- one molecule type per tank
- same type → top up
- different type → replace/expel previous tank contents
- expedition leftovers persist

## [WATCH]

Older saves may still contain already-produced molecules in `state.molecules`.

Those old inventories must not become stranded when generic tank roles are introduced.

A compatible existing finished-molecule inventory should retain a path into its tank.

## [CORE]

Molecules with no current tank role must remain mass-producible.

Future systems may consume them for:

- repair
- shell interaction
- special molecule effects
- other systems not yet designed

---

# 13. Context Diet / architecture rules

## [IMPLEMENTED / CORE development practice]

`src/app.js` has already been reduced.

Responsibility has been split into modules such as:

- `src/craft-workspace.js`
- `src/craft-controls.js`
- `src/craft-panel.js`
- `src/craft-connections.js`

`src/app.js` should remain focused on:

- Three.js scene integration
- 3D input
- bonding / structural manipulation integration
- startup orchestration

Do not move ordinary craft inventory/UI responsibility back into `src/app.js`.

Always begin repository work from:

1. `AGENTS.md`
2. `docs/architecture.md`

Then read only task-owned modules and direct dependencies.

---

# 14. Repository context-efficiency rules

## [CORE development practice]

Avoid unnecessary context loading.

Normally do not read:

- full `src/app.js` for unrelated tasks
- full `data/molecules.json`
- vendor
- generated molecule SVGs
- Git history
- unrelated old PRs
- unrelated tests

unless a verified dependency/regression requires it.

Do not re-run unrelated tests only to prepare a commit/PR.

---

# 15. Molecule game-role registry

## [IMPLEMENTED]

PR #21 introduced:

`src/veil/molecule-roles.js`

This is the current game-balance source of truth for molecule roles.

It is intentionally separate from the chemistry DB.

It currently contains profiles for:

- propellant
- fuel
- oxidizer
- coolant

and relevant performance values.

## [WATCH]

Do not simply copy all profiles into the older `MOLECULE_USES` structure in `growth.js`.

`MOLECULE_USES` currently has hidden coupling with progression / signal logic.

Role registration must not silently change unknown-signal discovery eligibility/order.

---

# 16. Generic propellant balance

## [CONFIRMED]

Registered propellant candidates:

| Molecule | Capacity | Molecules/BURST | Burst Power | Full tank BURSTs |
|---|---:|---:|---:|---:|
| H₂ | 120 | 40 | 1.00 | 3 |
| NH₃ | 96 | 12 | 0.82 | 8 |
| N₂ | 80 | 10 | 0.72 | 8 |
| CO₂ | 72 | 8 | 0.62 | 9 |
| n-C₄H₁₀ | 40 | 4 | 0.52 | 10 |

Design rationale:

- H₂ can have a high molecule count in the tank.
- Its practical weakness is low useful mass/volumetric density.
- In game terms this is represented by high molecule consumption per BURST.
- Later propellants have lower instantaneous power but better endurance.

Desired feel:

```text
H₂ > NH₃ > N₂ > CO₂ > n-C₄H₁₀
```

for instantaneous BURST performance.

---

# 17. Generic fuel balance

## [CONFIRMED]

Fuel candidates currently registered:

| Fuel | Capacity | O₂/fuel | Energy | Heat factor |
|---|---:|---:|---:|---:|
| H₂ | 28 | 0.50 | 0.30 | 0.75 |
| NH₃ | 24 | 0.75 | 0.40 | 0.70 |
| methanol | 20 | 1.50 | 0.80 | 0.85 |
| ethyne / acetylene | 12 | 2.50 | 1.45 | 1.25 |
| methane | 18 | 2.00 | 1.00 | 1.00 |
| dimethyl ether | 14 | 3.00 | 1.65 | 1.00 |
| ethanol | 16 | 3.00 | 1.54 | 0.95 |
| ethane | 14 | 3.50 | 1.78 | 1.05 |
| propane | 11 | 5.00 | 2.55 | 1.10 |
| n-butane | 9 | 6.50 | 3.31 | 1.15 |
| isobutane | 9 | 6.50 | 3.29 | 1.13 |
| n-pentane | 7 | 8.00 | 4.10 | 1.20 |
| n-hexane | 6 | 9.50 | 5.19 | 1.25 |
| 1-butanol | 10 | 6.00 | 3.02 | 1.00 |
| isobutanol | 10 | 6.00 | 3.00 | 0.98 |

Expected runtime model:

```text
baseFuelRate = current methane fuel rate
fuelConsumptionRate = baseFuelRate / energy
oxygenConsumptionRate = fuelConsumptionRate * oxygenPerFuel
```

## [CORE]

v1 should keep common COMBUSTION DRIVE top speed.

Fuel differentiation should come primarily from:

- capacity
- consumption efficiency
- O₂ requirement
- later heat burden

Do not make highest `energy` automatically mean “fastest”.

---

# 18. O₂ / oxidizer

## [CONFIRMED]

O₂ is the only active oxidizer for the current generic-combustion phase.

Current capacity:

```text
36
```

No additional oxidizers are planned for the immediate task.

---

# 19. O₂ tank repair progression

## [CONFIRMED direction, NOT IMPLEMENTED]

A future permanent progression system should repair/restore the O₂ tank.

Current rough target:

```text
36 → 48 → 60
```

This is intended to solve the problem created by discovering higher-density fuels:

> “I have a strong fuel, but my O₂ tank is too small to exploit all of it.”

The repair should feel like restoring damaged machinery rather than a magical level-up.

## [CANDIDATE repair materials]

Possible candidates discussed:

- 1,3-butadiene
- styrene

Possible loop:

```text
discover repair-capable molecule
→ complete it in craft
→ choose “use for repair”
→ mass-produce from BASE STOCK
→ add repair progress
→ restore +12 O₂ capacity
```

Exact:

- repair molecules
- required quantities
- number of repair stages

are **not fully locked**.

Do not implement them from this document alone unless the task explicitly asks for Tank Repair.

---

# 20. Heat / Coolant system

## [CONFIRMED direction, NOT IMPLEMENTED]

Coolant should not behave like “a fourth mandatory fuel”.

Its role is:

> **allow sustained COMBUSTION DRIVE use by controlling heat**

Basic intended system:

```text
COMBUSTION DRIVE active
→ heat accumulates
→ short usage is fine without coolant
→ long continuous usage becomes thermally limited
→ coolant removes heat
→ coolant allows longer continuous DRIVE
```

Normal flight should not require coolant.

BURST should either produce negligible heat or remain independent in v1.

## [CONFIRMED]

When coolant is absent:

- player must still be able to move normally
- COMBUSTION DRIVE should degrade/stop due to overheat rather than causing total failure/death
- after cooling, DRIVE becomes available again

Possible heat model:

```text
heat += baseHeatRate * fuel.heatFactor
heat -= coolantRate * coolant.coolingPower
heat -= naturalCooling when not driving
```

Simple 0–100 game heat is preferred over a detailed thermodynamic simulation.

## [CONFIRMED rough feel]

- first few seconds of DRIVE: coolant mostly unnecessary
- ~5–10+ seconds continuous use: heat becomes noticeable
- long escape/deep travel: coolant becomes valuable

Exact timing must be tuned in playtesting.

---

# 21. Coolant candidates

## [IMPLEMENTED data / runtime not active]

Current registered coolant candidates include:

- H₂O
- NH₃
- CO₂
- methanol
- ethanol
- ethylene glycol
- propylene glycol
- N₂

Data includes values such as:

- `capacity`
- `coolingPower`
- `environmentTolerance`

Fuel profiles already contain `heatFactor`.

## [CORE direction]

Different coolants should become situationally valuable rather than forming one strict upgrade chain.

Possible identity:

- H₂O — baseline, accessible, solid general cooling
- NH₃ — strong cooling but competes for N and other roles
- CO₂ — dual-use with propellant
- methanol / ethanol — fuel vs coolant resource tradeoff
- ethylene glycol — specialist/high-end long-duration coolant
- propylene glycol — specialist alternative
- N₂ — potential extreme/cryogenic niche

## [CONFIRMED]

H₂ should probably **not** also become a general coolant role in the near term.

It already has strong fuel + propellant identity; giving it a third major role risks over-centralizing H₂.

---

# 22. Environment × coolant interaction

## [CANDIDATE, likely future]

Coolant value may increase in specific fields.

Possible environment modifiers:

### High-temperature region

- weaker natural cooling
- higher coolant consumption
- high-performance coolant becomes valuable

### High-energy / radiation-like region

- increased DRIVE heat generation
- higher `heatFactor` impact

### Long pursuit corridor

- longer uninterrupted DRIVE requirement
- coolant total capacity/endurance matters

### Very cold region

- coolant freeze/low-temperature tolerance could matter
- `environmentTolerance` may become useful

### Special pressure/environment

- some coolant classes may gain mild suitability bonuses

## [CORE constraint]

Avoid “this stage requires exactly molecule X”.

Prefer:

```text
cheap coolant works but consumes more / forces rests
better coolant gives margin and endurance
```

Multiple molecules should solve the same problem with different efficiency.

---

# 23. Resource-value philosophy

## [CONFIRMED]

Do not decide atom value only from an abstract rarity table.

Actual resource value should emerge from:

```text
field abundance
×
demand from fuel
×
demand from propellant
×
demand from coolant
×
repair demand
×
future molecule interactions
```

Example:

If N becomes scarce, NH₃ can compete between:

- fuel
- propellant
- coolant

That competition gives N strategic value.

## [NEXT / future tuning]

Field atom distributions should be tuned through telemetry and playtesting after major molecular resource sinks exist.

Do not prematurely lock final H/C/O/N abundance ratios.

---

# 24. Fresh-save progression

## [CORE]

Current progression should remain understandable:

```text
H
→ manually discover H₂
→ gain H₂ BURST
→ reach C
→ discover CH₄
→ reach O
→ discover O₂
→ unlock sustained combustion travel
→ deeper progression
```

Later molecules in the database must not silently bypass this early progression.

A DB record existing is not the same as the player having:

- discovered the molecule
- acquired its elements
- earned access to its gameplay role

---

# 25. Element availability problem

## [WATCH]

The chemistry/craft database already supports:

- N
- F
- P
- S
- Cl

but current expedition gathering is primarily H/C/O.

This means a fresh save may technically know about palettes/chemistry that has no legitimate resource supply yet.

Near-term rule:

> **Do not present an element as practically usable when no acquisition path exists.**

Long-term solution should be new element exploration/progression, not simply giving the player huge free stocks.

---

# 26. Next Element Vertical Slice

## [CONFIRMED direction, element not chosen]

After H/C/O systems mature, introduce new elements **one meaningful vertical slice at a time**.

Do not unlock elements purely because they are next in periodic-table order or database order.

A new element should ideally unlock at least one meaningful system:

- new fuel
- new propellant
- new coolant
- repair material
- shell/world interaction
- another strategic chemical role

The exact next element is not currently locked.

N is an obvious candidate because NH₃/N₂ already have many game roles, but do not assume this without an explicit task.

---

# 27. Special Molecule Interaction

## [CANDIDATE]

Long-term goal: molecule properties should affect more than propulsion.

Potential category:

### Shell/material interaction

Examples discussed:

- metallic shell → appropriate acid treatment
- organic shell → appropriate organic solvent

Possible molecules:

- HCl
- H₂SO₄
- acetone
- dichloromethane
- others if chemically reasonable

Important direction:

- avoid arbitrary “key item” chemistry
- multiple plausible molecules may solve the same material problem
- their cost/efficiency/safety can differ

## [SPECULATIVE]

Possible future interactions may include:

- dissolving deposits
- cleaning/stripping layers
- extracting materials
- modifying environmental structures
- material-specific transport/processing

No implementation commitment exists yet.

---

# 28. Molecule role philosophy

## [CORE]

Not every one of 162 molecules needs a game ability.

Avoid:

```text
every molecule must have a special power
```

Instead:

- chemistry DB remains broad
- game roles attach only where meaningful
- some molecules are primarily educational/discovery content
- some become strategic resources
- some may gain roles later

This keeps chemistry believable and game balance tractable.

---

# 29. Multiple-solutions principle

## [CORE future design principle]

Whenever practical, avoid single molecular keys.

Prefer:

```text
several chemically plausible molecules
→ same broad function
→ different efficiency / cost / side effects / resource competition
```

This is especially desirable for:

- fuel
- propellant
- coolant
- repair
- material/shell interactions

---

# 30. Telemetry philosophy

## [IMPLEMENTED foundation / CONFIRMED extension]

Expedition telemetry exists and should remain debug-oriented.

Useful future measurements include:

- expedition time
- max depth / region
- atoms collected
- return type
- threat / Dust Eater count
- propellant molecule
- propellant consumed
- BURST count
- fuel molecule
- fuel consumed
- O₂ consumed
- DRIVE active time
- coolant molecule
- coolant consumed
- overheat events
- unused remaining tank contents

The point is to support real balancing of:

```text
resource supply
vs
resource demand
vs
player survival / reward
```

not to over-instrument arbitrary analytics.

---

# 31. Current generic propulsion task

## [NEXT — separate task brief exists]

The immediate planned implementation after PR #21 is:

> **Generic Propulsion / Generic Tank Runtime v1**

Main goals:

- molecule-specific tank capacity
- all registered propellants usable
- all registered fuels usable
- generic selected-molecule expedition loadout
- fuel `energy` and `oxygenPerFuel` drive actual consumption
- H₂ old-save 3 uses migrate to 120 molecule units
- preserve existing finished-molecule inventory paths
- preserve ordinary no-tank mass production
- keep coolant runtime inactive for now

A separate detailed task brief has been prepared for Codex.

---

# 32. Generic propulsion save migration issue

## [NEXT / CRITICAL]

Current save schema around this handoff is v4.

Old H₂ tank semantics:

```text
amount 1 = 1 BURST
amount 2 = 2 BURSTs
amount 3 = 3 BURSTs
```

New generic propellant semantics:

```text
40 H₂ = 1 BURST
120 H₂ = 3 BURSTs
```

Required migration concept:

```text
0 → 0
1 → 40
2 → 80
3 → 120
```

Use explicit schema migration, not an ambiguous heuristic.

Verify old CH₄/O₂ semantics separately.

---

# 33. General production / inventory compatibility

## [WATCH]

Two paths are particularly easy to accidentally delete during tank refactors:

### A. No-tank molecule production

A discovered molecule with no current tank role still needs a normal mass-production path.

### B. Old finished molecule inventory

Old finished molecules already present in saves need a meaningful transfer/use path.

Do not assume “new direct-to-tank production” makes old inventory irrelevant.

---

# 34. `MOLECULE_USES` hidden coupling

## [WATCH]

Current `src/veil/growth.js` contains `MOLECULE_USES`.

Historically it served several responsibilities:

- current progression key molecules
- current tank uses
- hints / descriptions
- participation in signal candidate filtering

PR #21 deliberately separated generic game-role data into:

`src/veil/molecule-roles.js`

Do not collapse these structures back together casually.

A future refactor may separate:

- progression/key-discovery metadata
- gameplay role metadata
- generic molecule presentation metadata

but preserve behavior while doing so.

---

# 35. Review-debt watch list

## [WATCH — revalidate, do not assume every item is still an active bug]

Historical review findings that should be checked when touching related systems:

1. **No-tank mass production**
   - Tank UI refactors may remove the only visible production path for H₂O and other ordinary molecules.

2. **Legacy finished molecule inventories**
   - H₂ / CH₄ / O₂ or future role molecules can become stranded after switching to direct atom→tank production.

3. **Progress hints**
   - Keep short useful progression feedback.
   - Current `growthGoal()` already contains concise H→H₂→C→CH₄→O₂ guidance; do not replace it with long tutorials.

4. **Unavailable element palettes**
   - N/F/P/S/Cl can be chemically supported while still lacking expedition supply.

5. **Gesture arbitration**
   - Bond midpoint long-press vs assist-atom hit priority has historically been a risk.
   - Electron/direct atom hits should retain correct priority.

6. **Rigid-group merging**
   - Non-conjugated diene-like structures must not become globally rigid just because constraint groups share one atom.
   - Preserve aromatic / double-bond / ring rigidity without locking legitimate single-bond rotation.

These are reminders for targeted regression work, not an instruction to open unrelated code during every task.

---

# 36. Discovery Island

## [REJECTED]

A previous vertical slice called **Discovery Island** attempted:

> “put molecules into an island / sandbox and alter terrain or the environment”

It was implemented, tried, and rejected as not fun in that form.

Do not restore Discovery Island or island-centric gameplay from old history.

The underlying broader concept:

> molecules should have effects in the world

is still valid, but should be implemented through more grounded systems such as:

- propulsion
- cooling
- repair
- material interactions
- resource processing

rather than resurrecting the island design.

---

# 37. Explicitly rejected / retired directions

## [REJECTED]

Do not restore these without an explicit new instruction:

- Discovery Island as the primary world loop
- large permanent H₂ movement/suction buff
- FLOW/CHAIN gameplay power buffs
- H₂O as a mandatory Inner Horizon/progression key
- automatic H₂O consumption for progression
- storing the completed craft molecule as a consumable inventory object
- visible ROTATABLE / LOCKED stamps/icons/axis numbers on completed molecules
- explanation-heavy molecule supply UI
- making Dust Eater into a normal combat enemy

---

# 38. FLOW / CHAIN philosophy

## [CORE]

FLOW/CHAIN are primarily feel/reward feedback:

- sound
- suction trajectory
- visual response
- rhythm

They should not quietly increase:

- raw speed
- suction radius
- permanent progression capability

unless a future task explicitly redesigns this system.

---

# 39. UI philosophy

## [CORE]

Prefer:

- visible objects
- direct manipulation
- meters
- short labels
- animation
- clear state transitions

over:

- paragraphs of explanation
- heavy tutorial screens
- abstract menu trees

When text is needed, keep it brief and operational.

---

# 40. Mobile

## [CORE development requirement]

The main loop must remain viable on narrow mobile widths, including approximately 320 px class screens.

When changing:

- tank UI
- craft controls
- expedition HUD
- long-press production

verify touch target and overflow behavior.

---

# 41. PWA / generated output discipline

## [IMPLEMENTED repository rule]

Generated assets should not be edited directly.

Known generated paths/tools include:

- `scripts/build-molecule-db.mjs` → `data/molecules.json`
- `scripts/build-collection-assets.mjs` → molecule SVG assets
- `scripts/build-precache.mjs` → `precache-manifest.js`

If runtime assets change, rebuild necessary generated outputs.

Rebuild precache **last**.

---

# 42. Testing discipline

## [CORE development practice]

Use focused tests.

Typical mappings are documented in `docs/architecture.md`.

Do not run the entire unrelated molecular-physics suite for a small propulsion/UI change unless a dependency justifies it.

Before merge, focus review on:

- accidental feature loss
- save migration
- unique operation paths removed by UI refactor
- fresh-save reachability
- pointer priority regressions
- runtime asset / offline consistency

---

# 43. Git / execution workflow

## [CORE project workflow]

For ordinary implementation tasks:

- no intermediate permission check is required
- investigate only the needed scope
- implement
- run relevant tests
- fix task-caused issues
- commit
- push
- create PR
- merge to main

unless the user explicitly says:

- research only
- do not merge
- stop before PR
- etc.

Do not re-read the whole repository just for commit/PR/merge.

Report only genuine blockers such as:

- authentication
- branch protection
- tool limitations
- platform policy

---

# 44. Work/Codex usage preference

## [CURRENT workflow preference]

The user has moved away from relying on ChatGPT Work for heavy implementation because of stalls/reconnection/restart cost.

Current preferred split:

- Chat: design discussion, system balance, requirements, review
- Codex: planning and repository implementation

Codex should receive:

1. this global handoff
2. a task-specific brief
3. latest `AGENTS.md` / `docs/architecture.md`

and then plan/implement locally without requiring the entire conversation history.

---

# 45. Near-term roadmap

## [CONFIRMED rough order]

A reasonable current sequence is:

### 1. Generic Propulsion / Generic Tank Runtime v1
- molecule-specific tank capacities
- generic propellants
- generic fuels
- O₂ consumption
- save migration
- HUD/supply integration

### 2. O₂ Tank Repair v1
- permanent O₂ capacity progression
- likely 36 → 48 → 60
- repair materials / progress

### 3. Heat / Coolant v1
- heat from sustained DRIVE
- fuel heatFactor
- coolant capacity/coolingPower
- overheat/recovery
- coolant HUD

### 4. Next Element Vertical Slice
- add one new meaningful resource progression

### 5. Environment × Molecule Performance
- field heat/cold/pressure/etc.
- coolant/environment suitability
- fuel/cooling tradeoffs

### 6. Special Molecule Interactions
- acids / solvents / repair / material effects
- only when grounded in meaningful gameplay

Exact order between Tank Repair and Heat/Coolant can be changed if implementation dependencies suggest it.

---

# 46. Potential 1.0 gate

## [CANDIDATE product milestone]

A plausible “1.0-quality core” gate:

- 3D craft is stable
- explore → collect → craft → discover → mass-produce → load/use → explore loop is complete
- H/C/O Risk/Reward expedition works
- several fuels/propellants have real reasons to choose between them
- at least one permanent progression system exists (e.g. O₂ tank repair)
- at least one meaningful new-element vertical slice beyond H/C/O exists
- at least one molecule-property system beyond fuel/propellant exists
- known P1/P2 regressions are cleared
- save/PWA compatibility is stable
- main loop is playable on mobile

This is not a release commitment; it is a useful quality target.

---

# 47. Speculative future ideas worth retaining

## [SPECULATIVE]

These are ideas, not roadmap commitments.

### Molecular material processing

- acid dissolves/reacts with suitable deposits
- solvent strips organic coating
- coolant enables thermal extraction
- oxidizer enables controlled processing

### Resource refinement

- raw field material may need molecular treatment before becoming collectable
- different molecules may yield different efficiency

### Shell maintenance

- molecules could repair/modify Collector Shell subsystems
- propulsion/cooling/storage could become partially modular

### Environmental hazards

- hot field
- cryogenic field
- corrosive region
- high-pressure region
- electrically disruptive region

These should be added only if they create interesting molecular choices rather than arbitrary counters.

### Molecular transport / storage traits

Some molecules could differ in:

- packing density
- volatility
- pressure requirement
- cryogenic difficulty

But avoid full engineering simulation unless it directly improves gameplay.

### Other propulsion chemistry

Future oxidizers or non-combustion propulsion might eventually exist, but **do not add them during current generic-fuel v1**.

### Fuel cell / energy systems

H₂ and other molecules could eventually power non-propulsion systems.

No current commitment.

### Polymer/material crafting

Functional groups / monomers may eventually matter for:

- repair
- structural materials
- insulation
- sealing

This could make molecules such as styrene/butadiene more meaningful.

No current implementation commitment.

---

# 48. Design anti-patterns

## [CORE]

Avoid these patterns:

### “Database means ability”

Just because a molecule exists in the chemistry DB does not mean it needs a game power.

### “One molecule = one key”

Avoid arbitrary lock/key gating when multiple chemistry solutions are plausible.

### “Higher tier = strictly better”

Prefer tradeoffs:

- power vs endurance
- density vs O₂ demand
- fuel efficiency vs heat
- coolant performance vs resource scarcity
- specialist vs generalist

### “Realism for realism’s sake”

Use real chemistry to make choices intuitive, but compress/abstract when needed for fun.

### “Game numbers with no physical direction”

Even when abstracted, values should have a coherent physical story.

---

# 49. Decision hierarchy when specification is incomplete

## [CORE]

When implementing unspecified details, prefer this order:

1. preserve existing behavior outside the requested change
2. preserve core game philosophy
3. use current game-role registry as the balance source of truth
4. choose the smallest architecture change that enables the requested system
5. maintain save compatibility
6. maintain mobile/PWA usability
7. prefer chemically plausible behavior
8. optimize realism only after gameplay clarity

---

# 50. What to do when starting a new Codex task

1. Read this document for overall intent.
2. Read the task-specific brief.
3. Fetch latest `main`.
4. Read `AGENTS.md`.
5. Read `docs/architecture.md`.
6. Open only owning modules.
7. Confirm whether anything in the global handoff is:
   - core invariant
   - confirmed task requirement
   - candidate/speculative idea
8. Do not implement speculative material unless the task explicitly promotes it to scope.
9. Return a concrete plan when asked for a plan.
10. During implementation, validate focused regression risks before merge.

---

# 51. Current known state summary

At this handoff:

## [IMPLEMENTED]

- mature 3D molecule craft foundation
- context-diet module split
- H/C/O continuous exploration
- H₂ emergency BURST baseline
- CH₄ + O₂ continuous DRIVE baseline
- Dust Eater pressure/forced return
- safe voluntary return
- Collector Shell / tank supply UI
- direct BASE STOCK → tank production
- persistent one-kind tanks
- role/performance registry in `molecule-roles.js`

## [NEXT]

- make propellant/fuel runtime generic and molecule-driven

## [CONFIRMED FUTURE]

- O₂ tank repair
- Heat / Coolant
- next-element progression
- broader molecule-property gameplay

## [CANDIDATE / SPECULATIVE]

- environmental coolant suitability
- material/shell interactions
- acids/solvents
- repair chemistry
- processing/refinement systems
- polymer/material utility

## [REJECTED]

- Discovery Island
- permanent H₂ stat buff
- H₂O progression key
- visible torsion/lock stamps
- explanation-heavy supply UI

---

# 52. Final interpretation rule

This project evolves through design iteration.

If old code, Git history, or older documents conflict with:

1. an explicit current user task,
2. current `main`,
3. this handoff’s **[CORE]/[CONFIRMED]** sections,

then prioritize the newer/current direction.

Treat **[CANDIDATE]** and **[SPECULATIVE]** sections as idea preservation only.

Do not resurrect **[REJECTED]** designs unless the user explicitly reopens them.
