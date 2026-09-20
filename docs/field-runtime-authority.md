# FIELD runtime authority

Production FIELD runtime is allowlist-based. A spawned, rendered, or interactive object must belong to one of the categories below and have a current gameplay/state owner.

| Category | Current authority |
| --- | --- |
| Environment / Geometry | Routes, open-field geometry/background, Deep Nitrogen/Core approach geometry, authored landmarks. |
| Managed Resources | H, C, N, O plus post-Awakening trace P/S/F/Cl. Rare ecology uses ordinary contact pickup, run cargo and settlement rather than anomaly/progression-object semantics. |
| Environmental Hazards | Hazard taxonomy authority: mechanical, thermal, abrasive, electrical and their subtypes/intensity fields. |
| Active Agents | Dust Eater and other explicitly autonomous FIELD agents. Agents are not hazards. |
| Current Progression Objects | Normal Insight, Critical Insight, Core, and current chapter markers. |
| Navigation / Recovery Infrastructure | Insight Extraction, the authored Safe Extraction Site, checkpoints, and separate normal/forced return lifecycle infrastructure. |

## Retired runtime

The finite Rare Survey from PR #233 is retired from production gameplay. P/S/F/Cl anomaly sites, anomaly dust/markers, proximity scanning, run-local specimen cargo, finite claim settlement, presentation UI, and developer-map overlays are not runtime authorities.

`rareEcologyEligible` is the persistent post-Core gate. Once World Awakening is committed, P/S/F/Cl can occupy deterministic managed-resource sockets through the Rare ecology authority; the retired finite Survey remains absent.

Legacy schema-v8 saves may still contain deprecated Rare Survey metadata such as claimed anomaly IDs. The persistence layer preserves/ignores unknown current-schema metadata rather than using it to reconstruct runtime. Existing P/S/F/Cl inventory is preserved and remains stock-accessible; only the retired acquisition system is removed.

This authority is intentionally scoped to FIELD runtime. Save migrations, compatibility readers, reset journals, workspace compatibility, Graph, Encyclopedia, and LOADOUT legacy code are outside this cleanup unless they directly spawn/render/interact in FIELD.
