# Post-Core material progression

The material economy uses the existing World Awakening, FIELD resource, CRAFT,
Reaction Lab, polymer discovery, fabrication and Collector Shell authorities.
There is no additional progression manager or saved unlock map.

## Authority and boundaries

| Boundary | Production authority | Next action |
|---|---|---|
| Core fracture | `engine.beginShock` / `resources.recordCoreFracture` | Pending destruction persists; return normally |
| Normal return | `resources.settleExpedition` / `commitWorldAwakening` | Commits `progress.worldAwakened` and `rareEcologyEligible`; captured return does not |
| Rare Ecology | `rare-ecology.applyRareEcology` / existing FIELD pickup | P/S/F/Cl replace authored ordinary sockets only after Awakening |
| Inventory | `run.elementDust` → `settleExpedition` → `state.elements` | Rare cargo enters canonical BASE STOCK; positive stock enables its CRAFT element |
| Molecular inputs | `craft-workspace` checkout, constitutional recognition, `collection-state` discovery | Discovered species appear in Reaction Lab FEED; FEED is not a second inventory |
| Molecular reaction | `reaction-lab-core` / existing 29-entry catalog | Canonical outputs register molecular discovery and can become later FEED species |
| Polymerization | `polymerization-routes`, `reaction-lab-polymerization` | Finite source instances produce a representative runtime PolymerSample |
| Polymer discovery | `reaction-lab-discovery` / `polymer-collection-state` | Separate persistent discovery enables engineering input evidence |
| Fabrication | `engineering-fabrication` / `resources.fabricateEngineering` | World Awakening, discoveries and actual consumables gate `engineering.fabricated` |
| Collector Shell | `resources.collectorShellState` / selection APIs | Fabricated applications can be independently activated at zero cost |
| FIELD | launch snapshot → `run.collectorMaterial` → `engine.stepRun` | Fixed 0.5 response modifiers; existing region subtitle reports the reduction |
| Reload / reset | resource schema 9, collection schema 3, polymer schema 1 | Existing loaders sanitize; canonical full reset clears this progression |

World Awakening is committed on normal return and affects the next launch.
There is no pre-Awakening Rare socket population or fabrication availability.
Fabricated-only state gives no FIELD bonus. All three active applications survive
reload and are copied into the next run once; no per-particle storage lookup exists.

## Chemistry reconciliation

The three application representatives are **BR + sulfur**, **PAN + phenolic resin
+ phosphoric-acid conditioning**, and **PVC**. Their monomers are ordinary CRAFT
discoveries feeding the production Reaction Lab polymer controller. The closed
29-reaction catalog does not synthesize these monomers. A separate existing
chemistry-to-polymer connection uses ethylene-oxide acid/base cleavage →
ethylene-glycol → PET (or polyethylene adipate). No reaction or polymer route is
added to manufacture a sequential prerequisite that the catalog never had.

The ⑩C task's chemistry wording was reconciled with this existing catalog: CRAFT
→ representative FEED → application polymers is the application path; existing
ethylene-glycol chemistry → polymer continuity is separately verified.

## Save contract

| Checkpoint | Persisted evidence after reload |
|---|---|
| A: awakened, before Rare acquisition | Awakening and Rare Ecology gate |
| B: Rare acquired, before fabrication | Canonical elemental inventory |
| C: polymer discovered, before fabrication | Polymer discovery and fabrication eligibility |
| D: fabricated, inactive | Three permanent unlocks, zero active slots, no passive material factors |
| E: fabricated, active | Valid active slots, unchanged inventory from toggles |
| F: full shell | All three active slots and all three cached factors on FIELD entry |

Checkpoint C preserves the closed ⑨ boundary, as confirmed during reconciliation:
**PolymerSample is Chamber runtime state, not page-reload inventory.** Its visible
sample survives Lab close/reopen and fabrication, and the next FEED purges it.
Page reload restores discovery; that discovery is sufficient to continue
fabrication. There is no new Reaction Lab save architecture.

Missing engineering/shell fields default safely. Unknown IDs and nonboolean
values cannot create fabrication or active state. Unfabricated active selections
are removed. Partial maps and v8 saves preserve valid inventory and prior campaign
progress. Fabrication does not consume discovery or Sample; only S × 1 for rubber
and P × 1 + O × 4 + H × 3 for thermal conditioning are consumed. PVC costs no
additional elemental stock. Duplicate fabrication costs nothing.

Rare sockets retain the existing replenishment and positive supply floor. Using a
Rare resource elsewhere does not permanently exhaust its source. CRAFT clear
refunds checked-out atoms; reacquisition, repeated FEED and free reactivation keep
the material path open. No durability, charge, maintenance, tier, O₂ upgrade,
Core repair or DOCK Treatment is introduced.

## Executable verification

`tests/material-progression-closure.test.mjs` imports the production catalogs and
controllers to assert the three applications, seven valid recipe references,
fixed FIELD targets, checkpoints A–F, old/partial/invalid saves, real Sample event
registration, resource costs, duplicate protection and canonical full reset.

Its fixture begins with `createInitialResourcesState()` and a previously completed
CHO/pre-Core campaign. All ⑩ fields remain initial: no Core fracture, Awakening,
Rare stock, polymer discovery, fabricated or active state is granted. The flight
uses real steering, combustion, coolant, BURST and SHOCK transactions with Dust
Eaters enabled, reaches the Core, and returns through a real safe site. It then
flies to P/S/Cl sockets, picks up and settles them, checks out CRAFT atoms, bonds
and recognizes the required molecules. Runtime polymer instances are consumed by
the production controller and their actual events register discovery. It does
not attempt to replay the already closed entire pre-CHO campaign.

`tests/material-progression-browser.test.mjs` resumes that earned, polymer-free
checkpoint in the full application at **390 × 844**. It uses actual pointer flight
to acquire another Rare P and taps the ship at a safe site to return. Actual FEED
picker clicks and reactive-site drags produce BR, PAN, phenolic resin and PVC;
the Collection handoff leads to actual fabrication buttons. PAN remains
unavailable until resin exists. Sample Bay survives the fabrication round trip.
All three materials then toggle freely, persist through page reload, launch FIELD
and show the existing reduction labels without horizontal overflow. Authored
hazard positions are controlled exposure fixtures for feedback, not a claim of
manual navigation through every hazard zone.

`collector-applications.test.mjs` provides exact inactive physics digests, paired
effective response assertions and orthogonality. Existing ⑦ pointer reaction
acceptance includes both ethylene-oxide → ethylene-glycol rules; the closure test
checks the resulting species against the actual PET FEED and produces its sample.
The ⑨ suite still covers all 25 routes. Existing ⑩A/B suites cover all alternative
recipes, atomic save failure rollback and effect isolation.

Both new tests run in repository CI. FIELD spatial-index, dynamic-registry,
renderer-query/counter, retained P5 and Chromium dense benchmark gates remain the
performance evidence. This work adds tests and authority documentation; it does
not change the FIELD hot path, catalog, save schema or response constants.
